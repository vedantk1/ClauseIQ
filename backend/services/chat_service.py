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
    
    # 🚀 FOUNDATIONAL ARCHITECTURE: ONE SESSION PER DOCUMENT
    async def get_or_create_session(self, document_id: str, user_id: str) -> Dict[str, Any]:
        """
        🎯 FOUNDATIONAL METHOD: Get or create THE single session for a document.
        
        This implements the core architectural principle:
        ONE SESSION PER DOCUMENT - No more session chaos!
        
        Returns THE session for this document, creating it if needed.
        """
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
            
            # 🎯 FOUNDATIONAL LOGIC: Check if THE session already exists
            existing_session = document.get("chat_session")
            
            if existing_session:
                logger.info(f"Found existing session {existing_session['session_id']} for document {document_id}")
                return {
                    "success": True,
                    "session_id": existing_session["session_id"],
                    "document_id": document_id,
                    "messages": existing_session.get("messages", []),
                    "created_at": existing_session.get("created_at"),
                    "updated_at": existing_session.get("updated_at")
                }
            
            # 🚀 CREATE THE SESSION - The one and only!
            session_id = str(uuid.uuid4())
            now = datetime.utcnow().isoformat()
            
            session_data = {
                "session_id": session_id,
                "document_id": document_id,
                "user_id": user_id,
                "messages": [],
                "created_at": now,
                "updated_at": now
            }
            
            # Store THE session in document (singular field)
            from database.factory import DatabaseFactory
            db = await DatabaseFactory.get_database()
            await db.update_document(document_id, user_id, {"chat_session": session_data})
            
            logger.info(f"🎯 FOUNDATIONAL: Created THE session {session_id} for document {document_id}")
            return {
                "success": True,
                "session_id": session_id,
                "document_id": document_id,
                "messages": [],
                "created_at": now,
                "updated_at": now
            }
            
        except Exception as e:
            logger.error(f"Error in get_or_create_session: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    # 🚀 FOUNDATIONAL ARCHITECTURE: Send message without session_id complexity
    async def send_message_foundational(
        self, 
        document_id: str, 
        user_id: str, 
        message: str
    ) -> Dict[str, Any]:
        """
        🎯 FOUNDATIONAL METHOD: Send message using THE session for this document.
        
        No session_id parameter needed - we use THE session!
        This is the future of clean chat architecture.
        """
        try:
            # Get THE session for this document
            session_result = await self.get_or_create_session(document_id, user_id)
            if not session_result["success"]:
                return session_result
            
            session_id = session_result["session_id"]
            
            # Use existing send_message logic with THE session
            return await self.send_message(document_id, session_id, user_id, message)
            
        except Exception as e:
            logger.error(f"Error in send_message_foundational: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def get_session_history(self, document_id: str, user_id: str) -> Dict[str, Any]:
        """
        🎯 FOUNDATIONAL METHOD: Get chat history for THE session of this document.
        
        Simple and clean - no session selection complexity!
        """
        try:
            # Get THE session for this document
            session_result = await self.get_or_create_session(document_id, user_id)
            if not session_result["success"]:
                return session_result
            
            return {
                "success": True,
                "messages": session_result.get("messages", []),
                "session_id": session_result["session_id"],
                "created_at": session_result.get("created_at"),
                "updated_at": session_result.get("updated_at")
            }
            
        except Exception as e:
            logger.error(f"Error getting session history: {e}")
            return {
                "success": False,
                "error": str(e)
            }

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
            logger.info(f"🎯 FOUNDATIONAL: send_message called with session_id={session_id}")
            
            # Get document and verify access
            document = await self.doc_service.get_document_for_user(document_id, user_id)
            if not document:
                return {
                    "success": False,
                    "error": "Document not found or access denied"
                }
            
            # 🚀 FOUNDATIONAL: Check for THE session (singular)
            foundational_session = document.get("chat_session")
            if foundational_session and foundational_session["session_id"] == session_id:
                logger.info(f"🎯 FOUNDATIONAL: Using foundational session {session_id}")
                return await self._process_message_foundational(document, foundational_session, message, user_id)
            
            # 🔄 LEGACY: Fallback to old sessions array for backward compatibility
            chat_sessions = document.get("chat_sessions", [])
            session_index = None
            for i, session in enumerate(chat_sessions):
                if session["session_id"] == session_id:
                    session_index = i
                    break
            
            if session_index is None:
                logger.error(f"❌ Session {session_id} not found in document {document_id}")
                logger.debug(f"🔍 Available sessions: {[s.get('session_id') for s in chat_sessions]}")
                logger.debug(f"🔍 Foundational session: {foundational_session.get('session_id') if foundational_session else 'None'}")
                return {
                    "success": False,
                    "error": "Chat session not found"
                }
            
            logger.info(f"🔄 LEGACY: Using legacy session array index {session_index}")
            return await self._process_message_legacy(document, chat_sessions, session_index, message, user_id, document_id)
            
        except Exception as e:
            logger.error(f"Error in send_message: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    async def _process_message_foundational(self, document: dict, session: dict, message: str, user_id: str) -> Dict[str, Any]:
        """Process message using foundational architecture (single session)."""
        try:
            document_id = document["id"]
            
            # Add user message
            user_message = ChatMessage(
                role="user",
                content=message
            )
            
            # Get current messages
            messages = session.get("messages", [])
            messages.append({
                "role": user_message.role,
                "content": user_message.content,
                "sources": user_message.sources,
                "timestamp": user_message.timestamp
            })
            
            # Generate AI response
            ai_response_data = await self._generate_ai_response(document, message, messages)
            
            # Add AI response to messages
            messages.append(ai_response_data)
            
            # Update session with new messages
            updated_session = {
                **session,
                "messages": messages,
                "updated_at": datetime.utcnow().isoformat()
            }
            
            # Save to database
            from database.factory import DatabaseFactory
            db = await DatabaseFactory.get_database()
            await db.update_document(document_id, user_id, {"chat_session": updated_session})
            
            logger.info(f"✅ FOUNDATIONAL: Message processed for session {session['session_id']}")
            
            return {
                "success": True,
                "user_message": {
                    "role": user_message.role,
                    "content": user_message.content,
                    "sources": user_message.sources,
                    "timestamp": user_message.timestamp
                },
                "ai_response": ai_response_data
            }
            
        except Exception as e:
            logger.error(f"Error in _process_message_foundational: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    async def _process_message_legacy(self, document: dict, chat_sessions: list, session_index: int, message: str, user_id: str, document_id: str) -> Dict[str, Any]:
        """Process message using legacy architecture (sessions array)."""
        try:
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
            
            # Generate AI response
            ai_response_data = await self._generate_ai_response(document, message, chat_sessions[session_index]["messages"])
            
            # Add AI response
            chat_sessions[session_index]["messages"].append(ai_response_data)
            chat_sessions[session_index]["updated_at"] = datetime.utcnow().isoformat()
            
            # Save to database
            from database.factory import DatabaseFactory
            db = await DatabaseFactory.get_database()
            await db.update_document(document_id, user_id, {"chat_sessions": chat_sessions})
            
            return {
                "success": True,
                "user_message": {
                    "role": user_message.role,
                    "content": user_message.content,
                    "sources": user_message.sources,
                    "timestamp": user_message.timestamp
                },
                "ai_response": ai_response_data
            }
            
        except Exception as e:
            logger.error(f"Error in _process_message_legacy: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    async def _generate_ai_response(self, document: dict, message: str, conversation_history: list) -> dict:
        """Generate AI response using RAG."""
        try:
            document_id = document["id"]
            user_id = document["user_id"]
            
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
                    # DEBUG: Log conversation history to identify the issue
                    logger.info(f"🔍 Conversation history has {len(conversation_history)} messages")
                    if conversation_history:
                        logger.info(f"🔍 Last message: {conversation_history[-1].get('content', '')[:100]}...")
                    
                    # Retrieve relevant chunks using updated RAG service with conversation context
                    rag_result = await self.rag_service.retrieve_relevant_chunks(
                        message, document_id, user_id, conversation_history
                    )
                    
                    relevant_chunks = rag_result["chunks"]
                    enhanced_query = rag_result["enhanced_query"]
                    
                    # DEBUG: Log RAG processing results
                    logger.info(f"🔍 Original query: '{message}'")
                    logger.info(f"🔍 Enhanced query: '{enhanced_query}'")
                    logger.info(f"🔍 Found {len(relevant_chunks)} chunks")
                    
                    # Generate response using enhanced query
                    rag_response = await self.rag_service.generate_rag_response(
                        message, relevant_chunks, enhanced_query
                    )
                    
                    ai_response_content = rag_response["response"]
                    ai_sources = rag_response["sources"]
            
            # Create AI response message
            ai_message = ChatMessage(
                role="assistant",
                content=ai_response_content,
                sources=ai_sources
            )
            
            return {
                "role": ai_message.role,
                "content": ai_message.content,
                "sources": ai_message.sources,
                "timestamp": ai_message.timestamp
            }
            
        except Exception as e:
            logger.error(f"Error generating AI response: {e}")
            return {
                "role": "assistant",
                "content": "I apologize, but I encountered an error while processing your message. Please try again.",
                "sources": [],
                "timestamp": datetime.utcnow().isoformat()
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
