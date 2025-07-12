"""
Chat API Router for ClauseIQ Document Conversations.

Clean foundational architecture - ONE SESSION PER DOCUMENT.

Provides REST endpoints for document chat functionality:
- Get/create THE session for a document
- Send messages and get AI responses  
- Retrieve chat history
- Chat system health

SECURITY:
- All endpoints require authentication
- User can only access their own documents and chat sessions
- Proper error handling and validation
"""
from typing import Dict, Any, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field

from auth import get_current_user
from middleware.api_standardization import APIResponse, create_success_response_with_request, create_error_response_with_request
from middleware.versioning import versioned_response
from services.chat_service import get_chat_service
from services.pinecone_vector_service import get_pinecone_vector_service
from config.logging import get_foundational_logger, log_exception

# 🚀 FOUNDATIONAL LOGGING: Proper chat logger
logger = get_foundational_logger("chat")

router = APIRouter(tags=["chat"])

# Request/Response Models
class SendMessageRequest(BaseModel):
    """Request to send a message to THE document session."""
    message: str = Field(..., min_length=1, max_length=2000, description="Message content")

class ChatMessageResponse(BaseModel):
    """Response model for a chat message."""
    role: str
    content: str
    timestamp: str
    id: str
    sources: list = []
    model_used: Optional[str] = None  # Add model_used field

class SendMessageResponse(BaseModel):
    """Response for sending a message."""
    message: ChatMessageResponse
    session_id: str

class SessionResponse(BaseModel):
    """Response for getting/creating THE session."""
    session_id: str
    document_id: str
    user_id: str
    created_at: str
    updated_at: str
    message_count: int
    messages: list = []

class ChatHistoryResponse(BaseModel):
    """Response for chat history."""
    session_id: str
    messages: list
    created_at: str
    updated_at: str

class HealthResponse(BaseModel):
    """Response for health check."""
    chat_service: str
    rag_service: str
    vector_storage: str
    timestamp: str


# 🚀 FOUNDATIONAL ENDPOINTS

@router.post("/{document_id}/session", response_model=APIResponse[SessionResponse])
async def get_or_create_session(
    document_id: str,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    🎯 FOUNDATIONAL: Get or create THE single session for a document.
    
    Simple, clean architecture - no session management complexity!
    """
    try:
        logger.info(f"🎯 Getting/creating session for document {document_id}")
        
        chat_service = get_chat_service()
        result = await chat_service.get_or_create_session(document_id, current_user["id"])
        
        if not result["success"]:
            logger.warning(f"Failed to get/create session: {result.get('error')}")
            # Determine appropriate HTTP status based on error type
            error_message = result["error"]
            if "not found" in error_message.lower() or "access denied" in error_message.lower():
                raise HTTPException(status_code=404, detail=error_message)
            elif "not ready" in error_message.lower():
                raise HTTPException(status_code=422, detail=error_message)
            else:
                raise HTTPException(status_code=400, detail=error_message)
        
        session = result["session"]
        
        response_data = SessionResponse(
            session_id=session["session_id"],
            document_id=session["document_id"],
            user_id=session["user_id"],
            created_at=session["created_at"],
            updated_at=session["updated_at"],
            message_count=len(session.get("messages", [])),
            messages=session.get("messages", [])
        )
        
        logger.info(f"✅ Session ready: {session['session_id']}")
        return create_success_response_with_request(
            data=response_data,
            message="Session ready",
            request=request
        )
        
    except Exception as e:
        logger.error(f"❌ Error in get_or_create_session: {e}")
        log_exception(logger, e, "Error getting/creating session")
        raise HTTPException(status_code=500, detail="Failed to get or create session")


@router.post("/{document_id}/message", response_model=APIResponse[SendMessageResponse])
async def send_message(
    document_id: str,
    message_data: SendMessageRequest,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    🎯 FOUNDATIONAL: Send message to THE document session.
    
    No session_id needed - just send to THE session!
    """
    try:
        logger.info(f"💬 Sending message to document {document_id}")
        
        chat_service = get_chat_service()
        result = await chat_service.send_message(
            document_id=document_id,
            user_id=current_user["id"],
            message=message_data.message
        )
        
        if not result["success"]:
            logger.warning(f"Failed to send message: {result.get('error')}")
            # Determine appropriate HTTP status based on error type
            error_message = result["error"]
            if "not found" in error_message.lower():
                raise HTTPException(status_code=404, detail=error_message)
            elif "not ready" in error_message.lower() or "not available" in error_message.lower():
                raise HTTPException(status_code=503, detail=error_message)
            else:
                raise HTTPException(status_code=400, detail=error_message)
        
        message = result["message"]
        
        response_data = SendMessageResponse(
            message=ChatMessageResponse(
                role=message["role"],
                content=message["content"],
                timestamp=message["timestamp"],
                id=message["id"],
                sources=message.get("sources", []),
                model_used=message.get("model_used")  # Include model_used field
            ),
            session_id=result["session_id"]
        )
        
        logger.info(f"✅ Message sent to session {result['session_id']}")
        return create_success_response_with_request(
            data=response_data,
            message="Message sent successfully",
            request=request
        )
        
    except Exception as e:
        logger.error(f"❌ Error in send_message: {e}")
        log_exception(logger, e, "Error sending message")
        raise HTTPException(status_code=500, detail="Failed to send message")


@router.get("/{document_id}/history", response_model=APIResponse[ChatHistoryResponse])
async def get_chat_history(
    document_id: str,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    🎯 FOUNDATIONAL: Get chat history for THE document session.
    """
    try:
        logger.info(f"📜 Getting chat history for document {document_id}")
        
        chat_service = get_chat_service()
        result = await chat_service.get_session_history(document_id, current_user["id"])
        
        if not result["success"]:
            logger.warning(f"Failed to get chat history: {result.get('error')}")
            # Determine appropriate HTTP status based on error type
            error_message = result["error"]
            if "not found" in error_message.lower():
                raise HTTPException(status_code=404, detail=error_message)
            else:
                raise HTTPException(status_code=400, detail=error_message)
        
        response_data = ChatHistoryResponse(
            session_id=result["session_id"],
            messages=result["messages"],
            created_at=result["created_at"],
            updated_at=result["updated_at"]
        )
        
        logger.info(f"✅ Retrieved {len(result['messages'])} messages")
        return create_success_response_with_request(
            data=response_data,
            message="Chat history retrieved successfully",
            request=request
        )
        
    except Exception as e:
        logger.error(f"❌ Error in get_chat_history: {e}")
        log_exception(logger, e, "Error getting chat history")
        raise HTTPException(status_code=500, detail="Failed to get chat history")


@router.get("/{document_id}/status", response_model=APIResponse[dict])
async def get_chat_status(
    document_id: str,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Check if a document is ready for chat."""
    try:
        logger.info(f"🔍 Checking chat status for document {document_id}")
        
        chat_service = get_chat_service()
        
        # Try to get or create session to check document status
        result = await chat_service.get_or_create_session(document_id, current_user["id"])
        
        if result["success"]:
            session = result["session"]
            status_data = {
                "ready": True,
                "chat_available": True,  # Frontend expects this field
                "ready_for_chat": True,  # Frontend expects this field
                "rag_processed": True,   # Frontend expects this field
                "processing_status": "ready",  # Frontend expects this field
                "session_id": session["session_id"],
                "message_count": len(session.get("messages", [])),
                "last_updated": session["updated_at"],
                "chunk_count": 0,  # Could be populated from document
                "text_length": 0   # Could be populated from document
            }
            logger.info(f"✅ Document {document_id} is ready for chat")
        else:
            status_data = {
                "ready": False,
                "chat_available": False,
                "ready_for_chat": False,
                "rag_processed": False,
                "processing_status": "error",
                "reason": result["error"],
                "error": result["error"]
            }
            logger.info(f"⏳ Document {document_id} not ready: {result['error']}")
        
        return create_success_response_with_request(
            data=status_data,
            message="Chat status retrieved",
            request=request
        )
        
    except Exception as e:
        logger.error(f"❌ Error in get_chat_status: {e}")
        log_exception(logger, e, "Error getting chat status")
        raise HTTPException(status_code=500, detail="Failed to get chat status")


@router.get("/health", response_model=APIResponse[HealthResponse])
async def get_health_status(request: Request):
    """Get health status of chat-related services."""
    try:
        logger.info("🏥 Checking chat system health")
        
        chat_service = get_chat_service()
        pinecone_service = get_pinecone_vector_service()
        
        # Check chat service
        chat_available = await chat_service.is_available()
        chat_status = "healthy" if chat_available else "unhealthy"
        
        # Check RAG service
        rag_available = await chat_service.rag_service.is_available()
        rag_status = "healthy" if rag_available else "unhealthy"
        
        # Check vector storage
        try:
            storage_info = await pinecone_service.get_total_storage_usage()
            vector_status = "healthy"
        except Exception:
            vector_status = "unhealthy"
        
        response_data = HealthResponse(
            chat_service=chat_status,
            rag_service=rag_status,
            vector_storage=vector_status,
            timestamp=datetime.utcnow().isoformat()
        )
        
        overall_status = "All systems healthy" if all([
            chat_status == "healthy",
            rag_status == "healthy", 
            vector_status == "healthy"
        ]) else "Some systems experiencing issues"
        
        logger.info(f"🏥 Health check complete: {overall_status}")
        return create_success_response_with_request(
            data=response_data,
            message=overall_status,
            request=request
        )
        
    except Exception as e:
        logger.error(f"❌ Error in health check: {e}")
        log_exception(logger, e, "Error in health check")
        raise HTTPException(status_code=500, detail="Health check failed")


@router.delete("/{document_id}/history", response_model=APIResponse[Dict[str, Any]])
async def clear_chat_history(
    document_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
) -> APIResponse[Dict[str, Any]]:
    """
    🗑️ Clear chat history for a document.
    
    Removes all messages from the chat session while keeping the session structure.
    """
    try:
        user_id = current_user["id"]
        
        logger.info(f"🗑️ Clear history request for document {document_id} by user {user_id}")
        
        chat_service = get_chat_service()
        result = await chat_service.clear_chat_history(document_id, user_id)
        
        if result["success"]:
            logger.info(f"✅ Successfully cleared chat history for document {document_id}")
            return create_success_response_with_request(
                data=result["data"],
                message=f"Chat history cleared ({result['data']['messages_cleared']} messages removed)",
                request=request
            )
        else:
            logger.error(f"❌ Failed to clear chat history: {result.get('error')}")
            raise HTTPException(
                status_code=400,
                detail=result.get("error", "Failed to clear chat history")
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error clearing chat history for document {document_id}: {e}")
        log_exception(logger, e, f"Error clearing chat history for document {document_id}")
        raise HTTPException(status_code=500, detail="Internal server error")
