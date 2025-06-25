"""
Chat API Router for ClauseIQ Document Conversations.

Provides REST endpoints for document chat functionality:
- Create chat sessions
- Send messages and get AI responses  
- Retrieve chat history
- Manage chat sessions

SECURITY:
- All endpoints require authentication
- User can only access their own documents and chat sessions
- Proper error handling and validation
"""
from typing import Dict, Any
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field

from auth import get_current_user
from middleware.api_standardization import APIResponse, create_success_response, create_error_response
from middleware.versioning import versioned_response
from services.chat_service import get_chat_service
from services.pinecone_vector_service import get_pinecone_vector_service
from config.logging import get_foundational_logger, log_exception

# 🚀 FOUNDATIONAL LOGGING: Proper chat logger
logger = get_foundational_logger("chat")

router = APIRouter(tags=["chat"])

# Request/Response Models
class CreateChatSessionRequest(BaseModel):
    """Request to create a new chat session."""
    pass  # No additional fields needed - document_id comes from URL

class CreateChatSessionResponse(BaseModel):
    """Response for creating a chat session."""
    session_id: str
    document_id: str
    message: str = "Chat session created successfully"

class SendMessageRequest(BaseModel):
    """Request to send a message in a chat session."""
    message: str = Field(..., min_length=1, max_length=2000, description="Message content")

class ChatMessageResponse(BaseModel):
    """Response model for a chat message."""
    role: str
    content: str
    sources: list = []
    timestamp: str

class SendMessageResponse(BaseModel):
    """Response for sending a message."""
    user_message: ChatMessageResponse
    ai_response: ChatMessageResponse

class ChatSessionSummary(BaseModel):
    """Summary of a chat session."""
    session_id: str
    created_at: str
    updated_at: str
    message_count: int

class ChatSessionResponse(BaseModel):
    """Full chat session with message history."""
    session_id: str
    document_id: str
    created_at: str
    updated_at: str
    messages: list

# 🚀 FOUNDATIONAL API ENDPOINTS - THE FUTURE OF CHAT!

# Response Models for Foundational Architecture
class FoundationalSessionResponse(BaseModel):
    """Response for foundational get/create session."""
    session_id: str
    document_id: str
    messages: list = []
    created_at: str
    updated_at: str
    message: str = "Session ready for chat"

class FoundationalMessageRequest(BaseModel):
    """Request to send a message in foundational architecture."""
    message: str = Field(..., min_length=1, max_length=2000, description="Message content")

class FoundationalMessageResponse(BaseModel):
    """Response for foundational message sending."""
    ai_response: ChatMessageResponse
    session_id: str
    timestamp: str

class ChatHistoryResponse(BaseModel):
    """Response for chat history retrieval."""
    session_id: str
    document_id: str
    messages: list = []
    message_count: int
    created_at: str
    updated_at: str

@router.post("/{document_id}/chat/sessions", response_model=APIResponse[CreateChatSessionResponse])
@versioned_response
async def create_chat_session(
    request: Request,
    document_id: str,
    session_request: CreateChatSessionRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new chat session for a document."""
    correlation_id = getattr(request.state, 'correlation_id', None)
    
    try:
        chat_service = get_chat_service()
        
        # Check if chat service is available
        if not await chat_service.is_available():
            return create_error_response(
                code="CHAT_SERVICE_UNAVAILABLE",
                message="Chat service is currently unavailable. Please try again later.",
                correlation_id=correlation_id
            )
        
        result = await chat_service.create_chat_session(document_id, current_user["id"])
        
        if not result["success"]:
            return create_error_response(
                code="CHAT_SESSION_CREATION_FAILED",
                message=result["error"],
                correlation_id=correlation_id
            )
        
        response_data = CreateChatSessionResponse(
            session_id=result["session_id"],
            document_id=result["document_id"]
        )
        
        return create_success_response(
            data=response_data,
            correlation_id=correlation_id
        )
        
    except Exception as e:
        logger.error(f"Error creating chat session: {e}")
        return create_error_response(
            code="INTERNAL_SERVER_ERROR",
            message="An unexpected error occurred while creating the chat session",
            correlation_id=correlation_id
        )

@router.post("/{document_id}/chat/{session_id}/messages", response_model=APIResponse[SendMessageResponse])
@versioned_response
async def send_message(
    request: Request,
    document_id: str,
    session_id: str,
    message_request: SendMessageRequest,
    current_user: dict = Depends(get_current_user)
):
    """Send a message in a chat session and get an AI response."""
    correlation_id = getattr(request.state, 'correlation_id', None)
    
    try:
        chat_service = get_chat_service()
        
        result = await chat_service.send_message(
            document_id, 
            session_id, 
            current_user["id"], 
            message_request.message
        )
        
        if not result["success"]:
            return create_error_response(
                code="MESSAGE_SEND_FAILED",
                message=result["error"],
                correlation_id=correlation_id
            )
        
        response_data = SendMessageResponse(
            user_message=ChatMessageResponse(**result["user_message"]),
            ai_response=ChatMessageResponse(**result["ai_response"])
        )
        
        return create_success_response(
            data=response_data,
            correlation_id=correlation_id
        )
        
    except Exception as e:
        logger.error(f"Error sending message: {e}")
        return create_error_response(
            code="INTERNAL_SERVER_ERROR",
            message="An unexpected error occurred while sending the message",
            correlation_id=correlation_id
        )

@router.get("/{document_id}/chat/status", response_model=APIResponse[dict])
@versioned_response
async def get_chat_status(
    request: Request,
    document_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get chat availability status for a document."""
    correlation_id = getattr(request.state, 'correlation_id', None)
    
    try:
        from database.service import get_document_service
        doc_service = get_document_service()
        
        # Get document and verify access
        document = await doc_service.get_document_for_user(document_id, current_user["id"])
        if not document:
            return create_error_response(
                code="DOCUMENT_NOT_FOUND",
                message="Document not found or access denied",
                correlation_id=correlation_id
            )
        
        chat_service = get_chat_service()
        
        # Use new document pipeline for better status tracking
        from services.document_pipeline import get_document_processor
        processor = get_document_processor()
        processing_status = await processor.get_processing_status(document_id, current_user["id"])
        
        logger.info(f"🔍 Debug chat status for {document_id}:")
        logger.info(f"  User ID: {current_user['id']}")
        logger.info(f"  Document found: {document is not None}")
        logger.info(f"  Processing status: {processing_status}")
        
        status_data = {
            "chat_available": await chat_service.is_available(),
            "rag_processed": processing_status.get("rag_processed", False),
            "ready_for_chat": processing_status.get("ready_for_chat", False),
            "processing_status": processing_status.get("status", "unknown"),
            "chunk_count": processing_status.get("chunk_count", 0),
            "session_count": len(document.get("chat_sessions", [])),
            "text_length": processing_status.get("text_length", 0),
            "processed_at": processing_status.get("processed_at"),
            "error": processing_status.get("error")
        }
        
        logger.info(f"  Final status data: {status_data}")
        
        return create_success_response(
            data=status_data,
            correlation_id=correlation_id
        )
        
    except Exception as e:
        logger.error(f"Error getting chat status: {e}")
        return create_error_response(
            code="INTERNAL_SERVER_ERROR",
            message="An unexpected error occurred while checking chat status",
            correlation_id=correlation_id
        )

@router.get("/{document_id}/chat/{session_id}", response_model=APIResponse[ChatSessionResponse])
@versioned_response
async def get_chat_session(
    request: Request,
    document_id: str,
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a chat session with full message history."""
    correlation_id = getattr(request.state, 'correlation_id', None)
    
    try:
        chat_service = get_chat_service()
        
        result = await chat_service.get_chat_session(document_id, session_id, current_user["id"])
        
        if not result["success"]:
            return create_error_response(
                code="CHAT_SESSION_NOT_FOUND",
                message=result["error"],
                correlation_id=correlation_id
            )
        
        response_data = ChatSessionResponse(**result["session"])
        
        return create_success_response(
            data=response_data,
            correlation_id=correlation_id
        )
        
    except Exception as e:
        logger.error(f"Error getting chat session: {e}")
        return create_error_response(
            code="INTERNAL_SERVER_ERROR",
            message="An unexpected error occurred while retrieving the chat session",
            correlation_id=correlation_id
        )

@router.get("/{document_id}/chat/sessions", response_model=APIResponse[list])
@versioned_response
async def list_chat_sessions(
    request: Request,
    document_id: str,
    current_user: dict = Depends(get_current_user)
):
    """List all chat sessions for a document."""
    correlation_id = getattr(request.state, 'correlation_id', None)
    
    try:
        chat_service = get_chat_service()
        
        result = await chat_service.list_chat_sessions(document_id, current_user["id"])
        
        if not result["success"]:
            return create_error_response(
                code="DOCUMENT_ACCESS_DENIED",
                message=result["error"],
                correlation_id=correlation_id
            )
        
        # Convert to response models
        sessions = [ChatSessionSummary(**session) for session in result["sessions"]]
        
        return create_success_response(
            data=sessions,
            correlation_id=correlation_id
        )
        
    except Exception as e:
        logger.error(f"Error listing chat sessions: {e}")
        return create_error_response(
            code="INTERNAL_SERVER_ERROR",
            message="An unexpected error occurred while listing chat sessions",
            correlation_id=correlation_id
        )

@router.delete("/{document_id}/chat/{session_id}", response_model=APIResponse[dict])
@versioned_response
async def delete_chat_session(
    request: Request,
    document_id: str,
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a chat session."""
    correlation_id = getattr(request.state, 'correlation_id', None)
    
    try:
        chat_service = get_chat_service()
        
        result = await chat_service.delete_chat_session(document_id, session_id, current_user["id"])
        
        if not result["success"]:
            return create_error_response(
                code="CHAT_SESSION_DELETE_FAILED",
                message=result["error"],
                correlation_id=correlation_id
            )
        
        return create_success_response(
            data={"message": result["message"]},
            correlation_id=correlation_id
        )
        
    except Exception as e:
        logger.error(f"Error deleting chat session: {e}")
        return create_error_response(
            code="INTERNAL_SERVER_ERROR",
            message="An unexpected error occurred while deleting the chat session",
            correlation_id=correlation_id
        )

# 🚀 FOUNDATIONAL API ENDPOINTS - THE FUTURE OF CHAT!

# Response Models for Foundational Architecture
class FoundationalSessionResponse(BaseModel):
    """Response for foundational get/create session."""
    session_id: str
    document_id: str
    messages: list = []
    created_at: str
    updated_at: str
    message: str = "Session ready for chat"

class FoundationalMessageRequest(BaseModel):
    """Request to send a message in foundational architecture."""
    message: str = Field(..., min_length=1, max_length=2000, description="Message content")

# 🎯 FOUNDATIONAL ENDPOINT: Get or create THE session
@router.post("/{document_id}/session", response_model=APIResponse[FoundationalSessionResponse])
@versioned_response  
async def get_or_create_session(
    request: Request,
    document_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    🚀 FOUNDATIONAL ARCHITECTURE: Get or create THE chat session for a document.
    
    This implements the core principle: ONE SESSION PER DOCUMENT
    No more session chaos - just clean, simple chat architecture!
    
    Returns THE session for this document, creating it if needed.
    """
    correlation_id = getattr(request.state, 'correlation_id', None)
    
    try:
        logger.info(f"🎯 FOUNDATIONAL: Getting/creating session for document {document_id}")
        logger.debug(f"🔍 User ID: {current_user.get('id')}, Correlation: {correlation_id}")
        
        # Get chat service
        chat_service = get_chat_service()
        logger.debug(f"📡 Chat service obtained: {type(chat_service)}")
        
        # Call the service
        logger.debug(f"📞 Calling get_or_create_session with doc_id={document_id}, user_id={current_user['id']}")
        result = await chat_service.get_or_create_session(document_id, current_user["id"])
        logger.debug(f"📋 Service result: {result}")
        
        if result["success"]:
            # Build response data carefully
            response_data = FoundationalSessionResponse(
                session_id=result["session_id"],
                document_id=result["document_id"],
                messages=result.get("messages", []),
                created_at=result.get("created_at", ""),
                updated_at=result.get("updated_at", "")
            )
            
            logger.info(f"✅ FOUNDATIONAL: Session {result['session_id']} ready for document {document_id}")
            return create_success_response(
                data=response_data,
                correlation_id=correlation_id
            )
        else:
            error_msg = result.get("error", "Failed to create session")
            logger.error(f"❌ FOUNDATIONAL: Service failed: {error_msg}")
            return create_error_response(
                code="SESSION_CREATION_FAILED",
                message=error_msg,
                correlation_id=correlation_id
            )
            
    except Exception as e:
        log_exception(logger, "💥 FOUNDATIONAL: Exception in get_or_create_session", e)
        return create_error_response(
            code="INTERNAL_ERROR",
            message="Internal server error",
            correlation_id=correlation_id
        )

# 🎯 FOUNDATIONAL ENDPOINT: Send message without session_id complexity!
@router.post("/{document_id}/message", response_model=APIResponse[SendMessageResponse])
@versioned_response
async def send_message_foundational(
    request: Request,
    document_id: str,
    message_request: FoundationalMessageRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    🚀 FOUNDATIONAL ARCHITECTURE: Send message using THE session for this document.
    
    No session_id needed in URL! Clean and simple like ChatGPT.
    The system automatically uses THE session for this document.
    """
    try:
        logger.info(f"🎯 FOUNDATIONAL: Sending message to document {document_id}")
        
        chat_service = get_chat_service()
        result = await chat_service.send_message_foundational(
            document_id, 
            current_user["id"], 
            message_request.message
        )
        
        if result["success"]:
            user_message = ChatMessageResponse(
                role=result["user_message"]["role"],
                content=result["user_message"]["content"],
                sources=result["user_message"].get("sources", []),
                timestamp=result["user_message"]["timestamp"]
            )
            
            ai_response = ChatMessageResponse(
                role=result["ai_response"]["role"],
                content=result["ai_response"]["content"],
                sources=result["ai_response"].get("sources", []),
                timestamp=result["ai_response"]["timestamp"]
            )
            
            response_data = SendMessageResponse(
                user_message=user_message,
                ai_response=ai_response
            )
            
            logger.info(f"✅ FOUNDATIONAL: Message sent successfully to document {document_id}")
            return create_success_response(
                data=response_data,
                correlation_id=getattr(request.state, 'correlation_id', None)
            )
        else:
            logger.error(f"❌ FOUNDATIONAL: Failed to send message: {result.get('error')}")
            return create_error_response(
                code="MESSAGE_SEND_FAILED",
                message=result.get("error", "Failed to send message"),
                correlation_id=getattr(request.state, 'correlation_id', None)
            )
            
    except Exception as e:
        log_exception(logger, "💥 FOUNDATIONAL: Exception in send_message", e)
        return create_error_response(
            code="INTERNAL_ERROR",
            message="Internal server error",
            correlation_id=getattr(request.state, 'correlation_id', None)
        )

# 🎯 FOUNDATIONAL ENDPOINT: Get chat history without complexity!
@router.get("/{document_id}/history", response_model=APIResponse[ChatHistoryResponse])
@versioned_response
async def get_chat_history_foundational(
    request: Request,
    document_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    🚀 FOUNDATIONAL ARCHITECTURE: Get chat history for THE session of this document.
    
    Simple and clean - no session selection complexity!
    """
    try:
        logger.info(f"🎯 FOUNDATIONAL: Getting chat history for document {document_id}")
        
        chat_service = get_chat_service()
        result = await chat_service.get_session_history(document_id, current_user["id"])
        
        if result["success"]:
            messages = result.get("messages", [])
            response_data = ChatHistoryResponse(
                session_id=result["session_id"],
                document_id=document_id,
                messages=messages,
                message_count=len(messages),
                created_at=result.get("created_at", ""),
                updated_at=result.get("updated_at", "")
            )
            
            logger.info(f"✅ FOUNDATIONAL: Retrieved {len(messages)} messages for document {document_id}")
            return create_success_response(
                data=response_data,
                correlation_id=getattr(request.state, 'correlation_id', None)
            )
        else:
            logger.error(f"❌ FOUNDATIONAL: Failed to get history: {result.get('error')}")
            return create_error_response(
                code="HISTORY_RETRIEVAL_FAILED",
                message=result.get("error", "Failed to get chat history"),
                correlation_id=getattr(request.state, 'correlation_id', None)
            )
            
    except Exception as e:
        log_exception(logger, "💥 FOUNDATIONAL: Exception in get_chat_history", e)
        return create_error_response(
            code="INTERNAL_ERROR",
            message="Internal server error",
            correlation_id=getattr(request.state, 'correlation_id', None)
        )

# Health check endpoint for RAG system
@router.get("/rag/health")
async def rag_health_check():
    """Health check for the RAG system (MongoDB + Pinecone)."""
    try:
        chat_service = get_chat_service()
        pinecone_service = get_pinecone_vector_service()
        
        # Check service availability
        chat_available = await chat_service.is_available()
        pinecone_health = await pinecone_service.health_check()
        
        # Get storage statistics
        storage_stats = await pinecone_service.get_total_storage_usage()
        
        overall_status = "healthy" if chat_available and pinecone_health.get("status") == "healthy" else "degraded"
        
        return {
            "status": overall_status,
            "timestamp": datetime.utcnow().isoformat(),
            "services": {
                "chat_service": "healthy" if chat_available else "unhealthy",
                "pinecone_vectors": pinecone_health.get("status", "unknown"),
                "mongodb": "healthy"  # Assumed healthy if chat service works
            },
            "storage_stats": storage_stats,
            "capabilities": {
                "document_chat": chat_available,
                "vector_search": pinecone_health.get("status") == "healthy",
                "embedding_generation": chat_available
            }
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }
