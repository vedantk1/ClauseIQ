"""
Service layer for database operations.
Provides async document and user management operations using the database abstraction layer.
"""
import asyncio
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime

from .factory import DatabaseFactory
from .interface import DatabaseInterface

logger = logging.getLogger(__name__)


class DocumentService:
    """Service layer for document operations using new database abstraction."""
    
    def __init__(self):
        self._db: Optional[DatabaseInterface] = None
    
    async def _get_db(self) -> DatabaseInterface:
        """Get database instance."""
        if self._db is None:
            self._db = await DatabaseFactory.get_database()
        return self._db
    
    # Document operations
    async def save_document(self, document_dict: Dict[str, Any]) -> str:
        """Save document and return document ID."""
        db = await self._get_db()
        return await db.save_document(document_dict)
    
    async def save_document_for_user(self, document_dict: Dict[str, Any], user_id: str) -> str:
        """Save document for specific user."""
        document_dict["user_id"] = user_id
        return await self.save_document(document_dict)
    
    async def get_document(self, doc_id: str) -> Optional[Dict[str, Any]]:
        """Get document by ID."""
        db = await self._get_db()
        # For backward compatibility, we need to get the user_id somehow
        # This is a limitation of the old interface
        return await db.get_document(doc_id, "")
    
    async def get_document_for_user(self, doc_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Get document by ID for specific user."""
        db = await self._get_db()
        return await db.get_document(doc_id, user_id)
    
    async def update_document_last_viewed(self, doc_id: str, user_id: str) -> bool:
        """Update the last_viewed timestamp for a document."""
        try:
            db = await self._get_db()
            current_time = datetime.utcnow().isoformat()
            return await db.update_document_field(doc_id, user_id, "last_viewed", current_time)
        except Exception as e:
            logger.error(f"Failed to update last_viewed for document {doc_id}: {e}")
            return False
    
    async def get_documents_for_user(self, user_id: str, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        """Get documents for user with pagination."""
        db = await self._get_db()
        return await db.list_documents(user_id, limit, offset)
    
    async def delete_document(self, doc_id: str) -> bool:
        """Delete document by ID."""
        # This is a limitation - we need user_id for the new interface
        # For now, we'll implement a workaround
        logger.warning("delete_document called without user_id - this is deprecated")
        return False
    
    async def delete_document_for_user(self, doc_id: str, user_id: str) -> bool:
        """Delete document for specific user and clean up RAG data and PDF files."""
        try:
            # First get document to check for PDF file
            document = await self.get_document_for_user(doc_id, user_id)
            
            # Clean up PDF file if it exists
            pdf_file_id = document.get('pdf_file_id') if document else None
            if pdf_file_id:
                try:
                    from services.file_storage_service import get_file_storage_service
                    file_storage = get_file_storage_service()
                    await file_storage.delete_file(pdf_file_id, user_id)
                    logger.info(f"Cleaned up PDF file {pdf_file_id} for document {doc_id}")
                except Exception as e:
                    logger.warning(f"Could not clean up PDF file for document {doc_id}: {e}")
                    # Continue with document deletion even if PDF cleanup fails
            
            # Then, clean up RAG data from vector storage
            try:
                from services.rag_service import get_rag_service
                rag_service = get_rag_service()
                await rag_service.delete_document_from_rag(doc_id, user_id)
                logger.info(f"Cleaned up RAG data for document {doc_id}")
            except Exception as e:
                logger.warning(f"Could not clean up RAG data for document {doc_id}: {e}")
                # Continue with document deletion even if RAG cleanup fails
            
            # Finally delete from MongoDB
            db = await self._get_db()
            result = await db.delete_document(doc_id, user_id)
            
            if result:
                logger.info(f"Successfully deleted document {doc_id} for user {user_id}")
            
            return result
            
        except Exception as e:
            logger.error(f"Error deleting document {doc_id}: {e}")
            return False
    
    async def delete_all_documents_for_user(self, user_id: str) -> int:
        """Delete all documents for user and clean up RAG data."""
        db = await self._get_db()
        documents = await db.list_documents(user_id, limit=1000)  # Get all documents
        count = 0
        for doc in documents:
            # Use the service method to ensure RAG cleanup
            if await self.delete_document_for_user(doc["id"], user_id):
                count += 1
        return count
    
    async def get_documents_count(self) -> int:
        """Get total documents count."""
        # This is approximate since we need to aggregate across users
        logger.warning("get_documents_count is deprecated - use user-specific methods")
        return 0
    
    # User operations
    async def create_user(self, user_data: Dict[str, Any]) -> str:
        """Create new user."""
        db = await self._get_db()
        return await db.create_user(user_data)
    
    async def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Get user by email."""
        db = await self._get_db()
        return await db.get_user_by_email(email)
    
    async def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user by ID."""
        db = await self._get_db()
        return await db.get_user_by_id(user_id)
    
    async def update_user(self, user_id: str, update_data: Dict[str, Any]) -> bool:
        """Update user data."""
        db = await self._get_db()
        return await db.update_user(user_id, update_data)
    
    async def delete_user(self, user_id: str) -> bool:
        """Delete user."""
        db = await self._get_db()
        return await db.delete_user(user_id)
    
    # Convenience methods for backward compatibility
    async def update_user_password(self, email: str, new_hashed_password: str) -> bool:
        """Update user password by email."""
        user = await self.get_user_by_email(email)
        if user:
            return await self.update_user(user["id"], {"hashed_password": new_hashed_password})
        return False
    
    async def update_user_preferences(self, user_id: str, preferences: Dict[str, Any]) -> bool:
        """Update user preferences."""
        return await self.update_user(user_id, preferences)
    
    async def get_user_preferred_model(self, user_id: str) -> str:
        """Get user's preferred AI model."""
        user = await self.get_user_by_id(user_id)
        if user and "preferred_model" in user:
            return user["preferred_model"]
        return "gpt-4o-mini"  # Default model
    
    # User interaction methods
    async def get_user_interactions(self, document_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user interactions for a document."""
        db = await self._get_db()
        return await db.get_user_interactions(document_id, user_id)
    
    async def save_user_interaction(self, document_id: str, clause_id: str, user_id: str, 
                                  note: Optional[str] = None, is_flagged: bool = False) -> Dict[str, Any]:
        """Save or update user interaction for a clause (backward compatibility)."""
        from datetime import datetime
        import uuid
        
        db = await self._get_db()
        
        # Get existing interactions
        existing_interactions = await self.get_user_interactions(document_id, user_id) or {}
        
        # Initialize interaction if it doesn't exist
        if clause_id not in existing_interactions:
            existing_interactions[clause_id] = {
                "clause_id": clause_id,
                "user_id": user_id,
                "notes": [],
                "is_flagged": False,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            }
        
        interaction = existing_interactions[clause_id]
        
        # Handle note (for backward compatibility, replace first note or add new)
        if note is not None:
            note_obj = {
                "id": str(uuid.uuid4()),
                "text": note,
                "created_at": datetime.now().isoformat()
            }
            
            # Initialize notes array if it doesn't exist (migration compatibility)
            if "notes" not in interaction:
                interaction["notes"] = []
            elif "note" in interaction:
                # Migrate old single note to notes array
                if interaction["note"]:
                    old_note = {
                        "id": str(uuid.uuid4()),
                        "text": interaction["note"],
                        "created_at": interaction.get("created_at", datetime.now().isoformat())
                    }
                    interaction["notes"] = [old_note]
                else:
                    interaction["notes"] = []
                del interaction["note"]  # Remove old field
            
            # For backward compatibility, replace first note if exists, otherwise add
            if len(interaction["notes"]) > 0:
                interaction["notes"][0] = note_obj
            else:
                interaction["notes"].append(note_obj)
        
        # Update flag status
        interaction["is_flagged"] = is_flagged
        interaction["updated_at"] = datetime.now().isoformat()
        
        # Save to database
        await db.save_user_interactions(document_id, user_id, existing_interactions)
        
        return interaction
    
    async def add_note(self, document_id: str, clause_id: str, user_id: str, text: str) -> Dict[str, Any]:
        """Add a new note to a clause."""
        from datetime import datetime
        import uuid
        
        db = await self._get_db()
        
        # Get existing interactions
        existing_interactions = await self.get_user_interactions(document_id, user_id) or {}
        
        # Initialize interaction if it doesn't exist
        if clause_id not in existing_interactions:
            existing_interactions[clause_id] = {
                "clause_id": clause_id,
                "user_id": user_id,
                "notes": [],
                "is_flagged": False,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            }
        
        interaction = existing_interactions[clause_id]
        
        # Initialize notes array if it doesn't exist (migration compatibility)
        if "notes" not in interaction:
            interaction["notes"] = []
        elif "note" in interaction:
            # Migrate old single note to notes array
            if interaction["note"]:
                old_note = {
                    "id": str(uuid.uuid4()),
                    "text": interaction["note"],
                    "created_at": interaction.get("created_at", datetime.now().isoformat())
                }
                interaction["notes"] = [old_note]
            else:
                interaction["notes"] = []
            del interaction["note"]  # Remove old field
        
        # Create new note
        new_note = {
            "id": str(uuid.uuid4()),
            "text": text,
            "created_at": datetime.now().isoformat()
        }
        
        # Add note to array
        interaction["notes"].append(new_note)
        interaction["updated_at"] = datetime.now().isoformat()
        
        # Save to database
        await db.save_user_interactions(document_id, user_id, existing_interactions)
        
        return new_note
    
    async def update_note(self, document_id: str, clause_id: str, user_id: str, note_id: str, text: str) -> Dict[str, Any]:
        """Update an existing note."""
        from datetime import datetime
        
        db = await self._get_db()
        
        # Get existing interactions
        existing_interactions = await self.get_user_interactions(document_id, user_id) or {}
        
        if clause_id not in existing_interactions:
            raise ValueError("Interaction not found")
        
        interaction = existing_interactions[clause_id]
        
        # Find and update the note
        if "notes" not in interaction:
            raise ValueError("No notes found")
        
        note_found = False
        for note in interaction["notes"]:
            if note["id"] == note_id:
                note["text"] = text
                note_found = True
                break
        
        if not note_found:
            raise ValueError("Note not found")
        
        interaction["updated_at"] = datetime.now().isoformat()
        
        # Save to database
        await db.save_user_interactions(document_id, user_id, existing_interactions)
        
        # Find and return the updated note
        updated_note = None
        for note in interaction["notes"]:
            if note["id"] == note_id:
                updated_note = note
                break
        
        if not updated_note:
            raise ValueError("Updated note not found after save")
        
        return updated_note
    
    async def delete_note(self, document_id: str, clause_id: str, user_id: str, note_id: str) -> bool:
        """Delete a specific note."""
        from datetime import datetime
        
        db = await self._get_db()
        
        # Get existing interactions
        existing_interactions = await self.get_user_interactions(document_id, user_id) or {}
        
        if clause_id not in existing_interactions:
            return False
        
        interaction = existing_interactions[clause_id]
        
        # Find and remove the note
        if "notes" not in interaction:
            return False
        
        original_length = len(interaction["notes"])
        interaction["notes"] = [note for note in interaction["notes"] if note["id"] != note_id]
        
        if len(interaction["notes"]) == original_length:
            return False  # Note not found
        
        interaction["updated_at"] = datetime.now().isoformat()
        
        # Save to database
        await db.save_user_interactions(document_id, user_id, existing_interactions)
        
        return True
    
    async def delete_user_interaction(self, document_id: str, clause_id: str, user_id: str) -> bool:
        """Delete user interaction for a clause."""
        db = await self._get_db()
        
        # Get existing interactions
        existing_interactions = await self.get_user_interactions(document_id, user_id)
        if not existing_interactions or clause_id not in existing_interactions:
            return False
        
        # Remove the interaction
        del existing_interactions[clause_id]
        
        # Save updated interactions
        await db.save_user_interactions(document_id, user_id, existing_interactions)
        
        return True
    
    async def update_document_rag_metadata(self, doc_id: str, user_id: str, rag_data: Dict[str, Any]) -> bool:
        """Update document with RAG processing metadata."""
        db = await self._get_db()
        
        # Update document with RAG metadata (accept all fields from rag_data)
        rag_metadata = {
            "rag_processed": rag_data.get("rag_processed", True),
            "ready_for_chat": rag_data.get("ready_for_chat", False),
            "text_length": rag_data.get("text_length"),
            "chunk_count": rag_data.get("chunk_count", 0),
            "processing_status": rag_data.get("processing_status", "completed"),
            "processed_at": rag_data.get("processed_at"),
            "rag_vector_store_id": rag_data.get("vector_store_id"),
            "rag_file_id": rag_data.get("file_id"),
            "rag_chunk_count": rag_data.get("chunk_count", 0),
            "rag_processed_at": datetime.now().isoformat(),
            "pinecone_stored": rag_data.get("pinecone_stored", False),
            "chunk_ids": rag_data.get("chunk_ids", []),
            "embedding_model": rag_data.get("embedding_model"),
            "storage_service": rag_data.get("storage_service")
        }
        
        # Remove None values to avoid overwriting with null
        rag_metadata = {k: v for k, v in rag_metadata.items() if v is not None}
        
        # Use update operation instead of save to avoid duplicate key error
        success = await db.update_document(doc_id, user_id, rag_metadata)
        return success
    
    async def mark_document_for_rag_reprocessing(self, doc_id: str, user_id: str) -> bool:
        """Mark document as needing RAG reprocessing due to failure."""
        db = await self._get_db()
        document = await db.get_document(doc_id, user_id)
        if not document:
            return False
        
        # Mark for reprocessing
        document.update({
            "rag_processed": False,
            "rag_needs_reprocessing": True,
            "rag_last_error": datetime.now().isoformat()
        })
        
        await db.save_document(document)
        return True
    
    async def get_documents_needing_rag_processing(self, user_id: str) -> List[Dict[str, Any]]:
        """Get documents that need RAG processing."""
        # This would need to be implemented in the database interface
        # For now, return empty list
        return []
    
    async def get_all_documents_for_cleanup(self) -> List[Dict[str, Any]]:
        """Get all documents for cleanup operations (admin use only)."""
        db = await self._get_db()
        # This is an admin operation, so we can access all documents
        collection = db._get_collection("documents")
        cursor = collection.find({})
        documents = []
        async for doc in cursor:
            documents.append(doc)
        return documents
    
    async def cleanup_document_sessions(self, doc_id: str) -> bool:
        """Remove all chat sessions (legacy and foundational) from a document."""
        db = await self._get_db()
        collection = db._get_collection("documents")
        
        # Remove both chat_sessions array and chat_session object
        result = await collection.update_one(
            {"id": doc_id},
            {
                "$unset": {
                    "chat_sessions": "",
                    "chat_session": ""
                }
            }
        )
        
        return result.modified_count > 0
    
    # Health check
    async def get_database_info(self) -> Dict[str, Any]:
        """Get database information."""
        return await DatabaseFactory.health_check()
    
    async def update_document_data(self, document_id: str, user_id: str, update_data: Dict[str, Any]) -> bool:
        """Update document data safely through the service layer."""
        try:
            db = await self._get_db()
            return await db.update_document(document_id, user_id, update_data)
        except Exception as e:
            logger.error(f"Failed to update document {document_id}: {e}")
            return False
    
    # PDF File Operations
    async def store_pdf_file(self, document_id: str, user_id: str, file_data: bytes, 
                           filename: str, content_type: str = "application/pdf") -> bool:
        """Store PDF file for a document and update document metadata."""
        try:
            from services.file_storage_service import get_file_storage_service
            file_storage = get_file_storage_service()
            
            # Store the PDF file
            file_id = await file_storage.store_file(
                file_data=file_data,
                filename=filename,
                content_type=content_type,
                user_id=user_id,
                metadata={'document_id': document_id}
            )
            
            # Update document with PDF metadata
            pdf_metadata = {
                'pdf_file_id': file_id,
                'pdf_file_size': len(file_data),
                'pdf_content_type': content_type,
                'pdf_stored_at': datetime.now().isoformat(),
                'has_pdf_file': True
            }
            
            # Update document
            db = await self._get_db()
            success = await db.update_document(document_id, user_id, pdf_metadata)
            
            if success:
                logger.info(f"Successfully stored PDF file {filename} for document {document_id}")
            else:
                # Rollback file storage if document update fails
                await file_storage.delete_file(file_id, user_id)
                raise Exception("Failed to update document with PDF metadata")
            
            return success
            
        except Exception as e:
            logger.error(f"Failed to store PDF file for document {document_id}: {e}")
            return False
    
    async def get_pdf_file(self, document_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Get PDF file for a document."""
        try:
            # First get document to get PDF file ID
            document = await self.get_document_for_user(document_id, user_id)
            if not document or not document.get('has_pdf_file'):
                return None
            
            pdf_file_id = document.get('pdf_file_id')
            if not pdf_file_id:
                return None
            
            # Get file from storage
            from services.file_storage_service import get_file_storage_service
            file_storage = get_file_storage_service()
            
            return await file_storage.get_file(pdf_file_id, user_id)
            
        except Exception as e:
            logger.error(f"Failed to get PDF file for document {document_id}: {e}")
            return None
    
    async def get_pdf_file_stream(self, document_id: str, user_id: str):
        """Get PDF file stream for efficient downloading."""
        try:
            # First get document to get PDF file ID
            document = await self.get_document_for_user(document_id, user_id)
            if not document or not document.get('has_pdf_file'):
                return None, None
            
            pdf_file_id = document.get('pdf_file_id')
            if not pdf_file_id:
                return None, None
            
            # Get file metadata and stream
            from services.file_storage_service import get_file_storage_service
            file_storage = get_file_storage_service()
            
            metadata = await file_storage.get_file_metadata(pdf_file_id, user_id)
            stream = await file_storage.get_file_stream(pdf_file_id, user_id)
            
            return metadata, stream
            
        except Exception as e:
            logger.error(f"Failed to get PDF file stream for document {document_id}: {e}")
            return None, None
    
    async def has_pdf_file(self, document_id: str, user_id: str) -> bool:
        """Check if document has a PDF file."""
        try:
            document = await self.get_document_for_user(document_id, user_id)
            return document.get('has_pdf_file', False) if document else False
        except Exception as e:
            logger.error(f"Failed to check PDF file for document {document_id}: {e}")
            return False
    
    # Atomic operations for race condition prevention
    async def create_or_get_chat_session(self, document_id: str, user_id: str, session_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Atomically create chat session if it doesn't exist, or return existing session."""
        db = await self._get_db()
        return await db.create_or_get_chat_session(document_id, user_id, session_data)
    
    async def add_chat_message_atomic(self, document_id: str, user_id: str, message: Dict[str, Any]) -> bool:
        """Atomically add a message to the chat session."""
        db = await self._get_db()
        return await db.add_chat_message_atomic(document_id, user_id, message)

    async def clear_chat_messages(self, document_id: str, user_id: str) -> bool:
        """Clear all messages from the chat session."""
        db = await self._get_db()
        return await db.clear_chat_messages(document_id, user_id)

    async def update_clause_rewrite(self, document_id: str, clause_id: str, user_id: str, rewrite_suggestion: str) -> Optional[Dict[str, Any]]:
        """Update a clause with a rewrite suggestion."""
        try:
            db = await self._get_db()
            
            # Get the current document
            document = await db.get_document(document_id, user_id)
            if not document:
                raise ValueError("Document not found")
            
            # Find and update the specific clause
            clauses = document.get("clauses", [])
            updated_clause = None
            
            for clause in clauses:
                if clause.get("id") == clause_id:
                    clause["rewrite_suggestion"] = rewrite_suggestion
                    clause["rewrite_generated_at"] = datetime.utcnow().isoformat()
                    updated_clause = clause
                    break
            
            if not updated_clause:
                raise ValueError("Clause not found")
            
            # Update the document with the modified clauses
            success = await db.update_document_field(document_id, user_id, "clauses", clauses)
            
            if success:
                return updated_clause
            else:
                raise Exception("Failed to update document with rewrite suggestion")
                
        except Exception as e:
            logger.error(f"Failed to update clause rewrite for document {document_id}, clause {clause_id}: {e}")
            raise

    # Note: Document-based PDF methods are above in the "PDF File Operations" section
    # The methods below provide direct file storage access if needed

def get_document_service() -> DocumentService:
    """Get async document service instance."""
    return DocumentService()
