"""
Chat Service for ClauseIQ Document Conversations.

Handles chat sessions, message history, and integration with the RAG service
for document-based question answering.

FEATURES:
- Chat session management per document
- Message history persistence in MongoDB
- Integration with RAG service for intelligent responses
- Source attribution and transparency
- User isolation and security
"""
import logging
import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime

from database.service import get_document_service
from services.rag_service import RAGService, ChatMessage, ChatSession

logger = logging.getLogger(__name__)

class ChatService:
    """Service for managing document chat functionality."""
    
    def __init__(self):
        self.doc_service = get_document_service()
        self.rag_service = RAGService()
    
    async def is_available(self) -> bool:
        """Check if chat service is available."""
        return await self.rag_service.is_available()
    
    async def create_chat_session(self, document_id: str, user_id: str) -> Dict[str, Any]:
        """Create a new chat session for a document."""
        try:
            # Verify user owns the document
            document = await self.doc_service.get_document_for_user(document_id, user_id)
            if not document:
                return {
                    "success": False,
                    "error": "Document not found or access denied"
                }
            
            # Check if document has RAG enabled
            if not document.get("rag_processed", False):
                return {
                    "success": False,
                    "error": "Document is not ready for chat. Please wait for processing to complete."
                }
            
            session_id = str(uuid.uuid4())
            session = ChatSession(
                session_id=session_id,
                document_id=document_id,
                user_id=user_id,
                messages=[],
                created_at=datetime.utcnow().isoformat(),
                updated_at=datetime.utcnow().isoformat()
            )
            
            # Store session in document
            chat_sessions = document.get("chat_sessions", [])
            chat_sessions.append({
                "session_id": session.session_id,
                "document_id": session.document_id,
                "user_id": session.user_id,
                "messages": [],
                "created_at": session.created_at,
                "updated_at": session.updated_at
            })
            
            # Update document with new session using direct DB update
            from database.factory import DatabaseFactory
            db = await DatabaseFactory.get_database()
            await db.update_document(document_id, user_id, {"chat_sessions": chat_sessions})
            
            logger.info(f"Created chat session {session_id} for document {document_id}")
            return {
                "success": True,
                "session_id": session_id,
                "document_id": document_id
            }
            
        except Exception as e:
            logger.error(f"Error creating chat session: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def send_message(
        self, 
        document_id: str, 
        session_id: str, 
        user_id: str, 
        message: str
    ) -> Dict[str, Any]:
        """Send a message in a chat session and get an AI response."""
        try:
            # Get document and verify access
            document = await self.doc_service.get_document_for_user(document_id, user_id)
            if not document:
                return {
                    "success": False,
                    "error": "Document not found or access denied"
                }
            
            # Find the chat session
            chat_sessions = document.get("chat_sessions", [])
            session_index = None
            for i, session in enumerate(chat_sessions):
                if session["session_id"] == session_id:
                    session_index = i
                    break
            
            if session_index is None:
                return {
                    "success": False,
                    "error": "Chat session not found"
                }
            
            # Add user message
            user_message = ChatMessage(
                role="user",
                content=message
            )
            
            chat_sessions[session_index]["messages"].append({
                "role": user_message.role,
                "content": user_message.content,
                "sources": user_message.sources,
                "timestamp": user_message.timestamp
            })
            
            # Generate AI response using RAG
            if not await self.is_available():
                ai_response_content = "I'm sorry, but the AI service is currently unavailable. Please try again later."
                ai_sources = []
            else:
                # Check if document has RAG processing
                if not document.get("rag_processed", False):
                    ai_response_content = "I'm sorry, but this document is not ready for chat yet. Please wait for processing to complete."
                    ai_sources = []
                else:
                    # Retrieve relevant chunks using updated RAG service
                    relevant_chunks = await self.rag_service.retrieve_relevant_chunks(
                        message, document_id, user_id
                    )
                    
                    # Generate response
                    rag_response = await self.rag_service.generate_rag_response(
                        message, relevant_chunks
                    )
                    
                    ai_response_content = rag_response["response"]
                    ai_sources = rag_response["sources"]
            
            # Add AI response
            ai_message = ChatMessage(
                role="assistant",
                content=ai_response_content,
                sources=ai_sources
            )
            
            chat_sessions[session_index]["messages"].append({
                "role": ai_message.role,
                "content": ai_message.content,
                "sources": ai_message.sources,
                "timestamp": ai_message.timestamp
            })
            
            # Update session timestamp
            chat_sessions[session_index]["updated_at"] = datetime.utcnow().isoformat()
            
            # Save updated document using direct DB update
            from database.factory import DatabaseFactory
            db = await DatabaseFactory.get_database()
            await db.update_document(document_id, user_id, {"chat_sessions": chat_sessions})
            
            logger.info(f"Processed message in session {session_id}")
            return {
                "success": True,
                "user_message": {
                    "role": user_message.role,
                    "content": user_message.content,
                    "timestamp": user_message.timestamp
                },
                "ai_response": {
                    "role": ai_message.role,
                    "content": ai_message.content,
                    "sources": ai_message.sources,
                    "timestamp": ai_message.timestamp
                }
            }
            
        except Exception as e:
            logger.error(f"Error sending message: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def get_chat_session(self, document_id: str, session_id: str, user_id: str) -> Dict[str, Any]:
        """Get a chat session with message history."""
        try:
            # Get document and verify access
            document = await self.doc_service.get_document_for_user(document_id, user_id)
            if not document:
                return {
                    "success": False,
                    "error": "Document not found or access denied"
                }
            
            # Find the chat session
            chat_sessions = document.get("chat_sessions", [])
            for session in chat_sessions:
                if session["session_id"] == session_id:
                    return {
                        "success": True,
                        "session": session
                    }
            
            return {
                "success": False,
                "error": "Chat session not found"
            }
            
        except Exception as e:
            logger.error(f"Error getting chat session: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def list_chat_sessions(self, document_id: str, user_id: str) -> Dict[str, Any]:
        """List all chat sessions for a document."""
        try:
            # Get document and verify access
            document = await self.doc_service.get_document_for_user(document_id, user_id)
            if not document:
                return {
                    "success": False,
                    "error": "Document not found or access denied"
                }
            
            chat_sessions = document.get("chat_sessions", [])
            
            # Return session summaries (without full message history)
            session_summaries = []
            for session in chat_sessions:
                session_summaries.append({
                    "session_id": session["session_id"],
                    "created_at": session["created_at"],
                    "updated_at": session["updated_at"],
                    "message_count": len(session.get("messages", []))
                })
            
            return {
                "success": True,
                "sessions": session_summaries
            }
            
        except Exception as e:
            logger.error(f"Error listing chat sessions: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def delete_chat_session(self, document_id: str, session_id: str, user_id: str) -> Dict[str, Any]:
        """Delete a chat session."""
        try:
            # Get document and verify access
            document = await self.doc_service.get_document_for_user(document_id, user_id)
            if not document:
                return {
                    "success": False,
                    "error": "Document not found or access denied"
                }
            
            # Remove the session
            chat_sessions = document.get("chat_sessions", [])
            original_count = len(chat_sessions)
            chat_sessions = [s for s in chat_sessions if s["session_id"] != session_id]
            
            if len(chat_sessions) == original_count:
                return {
                    "success": False,
                    "error": "Chat session not found"
                }
            
            # Save updated document using direct DB update
            from database.factory import DatabaseFactory
            db = await DatabaseFactory.get_database()
            await db.update_document(document_id, user_id, {"chat_sessions": chat_sessions})
            
            logger.info(f"Deleted chat session {session_id}")
            return {
                "success": True,
                "message": "Chat session deleted successfully"
            }
            
        except Exception as e:
            logger.error(f"Error deleting chat session: {e}")
            return {
                "success": False,
                "error": str(e)
            }


# Global chat service instance
_chat_service = None

def get_chat_service() -> ChatService:
    """Get the global chat service instance."""
    global _chat_service
    if _chat_service is None:
        _chat_service = ChatService()
    return _chat_service
