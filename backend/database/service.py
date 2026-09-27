"""
Service layer for database operations.
Provides async document and workspace management operations using the database abstraction layer.
"""
import asyncio
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime

from .factory import DatabaseFactory
from .interface import DatabaseError, DatabaseInterface
from workspace import WORKSPACE_ID

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

    async def save_document_for_workspace(self, document_dict: Dict[str, Any], workspace_id: str) -> str:
        """Save document for a specific workspace."""
        document_dict["workspace_id"] = workspace_id
        return await self.save_document(document_dict)

    async def get_document_for_workspace(self, doc_id: str, workspace_id: str) -> Optional[Dict[str, Any]]:
        """Get document by ID for a specific workspace."""
        db = await self._get_db()
        return await db.get_document(doc_id, workspace_id)

    async def update_document_last_viewed(self, doc_id: str, workspace_id: str) -> bool:
        """Update the last_viewed timestamp for a document."""
        try:
            db = await self._get_db()
            current_time = datetime.utcnow().isoformat()
            return await db.update_document_field(doc_id, workspace_id, "last_viewed", current_time)
        except Exception as e:
            logger.error("Document last-viewed update failed: %s", type(e).__name__)
            return False

    async def get_documents_for_workspace(self, workspace_id: str, limit: int = 0, offset: int = 0) -> List[Dict[str, Any]]:
        """Get documents for the workspace with pagination."""
        db = await self._get_db()
        return await db.list_documents(workspace_id, limit, offset)

    async def get_document_summaries_for_workspace(self, workspace_id: str, limit: int = 0, offset: int = 0) -> List[Dict[str, Any]]:
        """Get content-free metadata for the Library in one scoped read."""
        db = await self._get_db()
        return await db.list_document_summaries(workspace_id, limit, offset)

    async def list_source_snapshots_for_search(
        self, workspace_id: str, limit: int,
    ) -> tuple[int, List[Dict[str, Any]]]:
        """Read only current source snapshots in the server-selected workspace."""
        db = await self._get_db()
        return await db.list_source_snapshots_for_search(workspace_id, limit)

    async def delete_document_for_workspace(self, doc_id: str, workspace_id: str) -> bool:
        # Index publication and physical cleanup share one local lifecycle lock.
        # Keep it until Mongo deletion completes, not just until vector removal.
        from services.library_semantic.lifecycle import document_lock
        async with document_lock(workspace_id, doc_id):
            return await self._delete_document_for_workspace_locked(doc_id, workspace_id)

    async def _delete_document_for_workspace_locked(self, doc_id: str, workspace_id: str) -> bool:
        """Delete document for a specific workspace and clean up RAG data and PDF files."""
        try:
            # First get document to check for PDF file
            document = await self.get_document_for_workspace(doc_id, workspace_id)
            if not document:
                return False

            if document.get("semantic_index"):
                from services.library_semantic.service import LibrarySemanticService
                from services.library_semantic.vectors import create_vectors
                vectors = await create_vectors(self)
                try:
                    await LibrarySemanticService(self, vectors).remove_locked(workspace_id, document)
                finally:
                    await vectors.close()

            # Remove every file in this document's namespace, including an old
            # replacement file no longer referenced by the current pointer.
            from database.library_answers import AnswerRepository
            await AnswerRepository(self).purge_document(workspace_id, doc_id)

            try:
                from services.file_storage_service import get_file_storage_service
                file_storage = get_file_storage_service()
                if not await file_storage.delete_document_files(
                    doc_id, workspace_id, referenced_file_id=document.get("pdf_file_id")
                ):
                    return False
                logger.info("Cleaned up stored PDF files")
            except Exception as e:
                logger.warning("Stored PDF cleanup failed: %s", type(e).__name__)
                return False

            # Then, clean up RAG data from vector storage
            try:
                from services.rag_service import get_rag_service
                rag_service = get_rag_service()
                if not await rag_service.delete_document_from_rag(doc_id, workspace_id):
                    return False
                logger.info("Cleaned up document RAG data")
            except Exception as e:
                logger.warning("Document RAG cleanup failed: %s", type(e).__name__)
                return False

            # Finally delete from MongoDB
            db = await self._get_db()
            result = await db.delete_document(doc_id, workspace_id)

            if result:
                logger.info("Deleted document successfully")

            return result

        except Exception as e:
            logger.error("Document deletion failed: %s", type(e).__name__)
            return False

    async def delete_all_documents_for_workspace(self, workspace_id: str) -> int:
        """Delete all documents for the workspace and clean up RAG data."""
        db = await self._get_db()
        count = 0
        # Re-read the first page after successful deletions. Stop on partial
        # failure so retries remain explicit and a failed record cannot loop.
        while True:
            documents = await db.list_documents(workspace_id, limit=100)
            if not documents:
                break
            for doc in documents:
                if not await self.delete_document_for_workspace(doc["id"], workspace_id):
                    raise DatabaseError("Document cleanup is incomplete; retry deletion.")
                count += 1
        return count

    async def get_workspace_model(self, workspace_id: str) -> str:
        """Return the configured model for the local workspace."""
        return await self.get_system_ai_model()

    async def get_workspace_generation_settings(self, workspace_id: str) -> Dict[str, str]:
        """Read the model and effort from one configuration snapshot."""
        config = await self.get_system_config("system_ai_model", raise_on_error=True)
        from ai_models.models import resolve_retired_model_selection
        from config.environments import get_environment_config
        stored_model = (config or {}).get("model_id") or get_environment_config().ai.default_model
        model = resolve_retired_model_selection(stored_model)
        effort = (config or {}).get("reasoning_effort", "medium") if model == stored_model else "medium"
        return {"model_id": model, "reasoning_effort": effort}

    async def get_workspace_api_key(self, workspace_id: str) -> Optional[str]:
        """Resolve the local operator-supplied API key without caching plaintext."""
        from services.workspace_service import get_workspace_service
        return await get_workspace_service().get_api_key()

    # User interaction methods
    async def get_user_interactions(self, document_id: str, workspace_id: str) -> Optional[Dict[str, Any]]:
        """Get user interactions for a document."""
        db = await self._get_db()
        return await db.get_user_interactions(document_id, workspace_id)

    async def save_user_interaction(self, document_id: str, clause_id: str, workspace_id: str,
                                  note: Optional[str] = None, is_flagged: bool = False) -> Dict[str, Any]:
        """Save or update user interaction for a clause (backward compatibility)."""
        from datetime import datetime
        import uuid

        db = await self._get_db()

        # Get existing interactions
        existing_interactions = await self.get_user_interactions(document_id, workspace_id) or {}

        # Initialize interaction if it doesn't exist
        if clause_id not in existing_interactions:
            existing_interactions[clause_id] = {
                "clause_id": clause_id,
                "workspace_id": workspace_id,
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
        await db.save_user_interactions(document_id, workspace_id, existing_interactions)

        return interaction

    async def add_note(self, document_id: str, clause_id: str, workspace_id: str, text: str) -> Dict[str, Any]:
        """Add a new note to a clause."""
        from datetime import datetime
        import uuid

        db = await self._get_db()

        # Get existing interactions
        existing_interactions = await self.get_user_interactions(document_id, workspace_id) or {}

        # Initialize interaction if it doesn't exist
        if clause_id not in existing_interactions:
            existing_interactions[clause_id] = {
                "clause_id": clause_id,
                "workspace_id": workspace_id,
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
        await db.save_user_interactions(document_id, workspace_id, existing_interactions)

        return new_note

    async def update_note(self, document_id: str, clause_id: str, workspace_id: str, note_id: str, text: str) -> Dict[str, Any]:
        """Update an existing note."""
        from datetime import datetime

        db = await self._get_db()

        # Get existing interactions
        existing_interactions = await self.get_user_interactions(document_id, workspace_id) or {}

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
        await db.save_user_interactions(document_id, workspace_id, existing_interactions)

        # Find and return the updated note
        updated_note = None
        for note in interaction["notes"]:
            if note["id"] == note_id:
                updated_note = note
                break

        if not updated_note:
            raise ValueError("Updated note not found after save")

        return updated_note

    async def delete_note(self, document_id: str, clause_id: str, workspace_id: str, note_id: str) -> bool:
        """Delete a specific note."""
        from datetime import datetime

        db = await self._get_db()

        # Get existing interactions
        existing_interactions = await self.get_user_interactions(document_id, workspace_id) or {}

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
        await db.save_user_interactions(document_id, workspace_id, existing_interactions)

        return True

    async def delete_user_interaction(self, document_id: str, clause_id: str, workspace_id: str) -> bool:
        """Delete user interaction for a clause."""
        db = await self._get_db()

        # Get existing interactions
        existing_interactions = await self.get_user_interactions(document_id, workspace_id)
        if not existing_interactions or clause_id not in existing_interactions:
            return False

        # Remove the interaction
        del existing_interactions[clause_id]

        # Save updated interactions
        await db.save_user_interactions(document_id, workspace_id, existing_interactions)

        return True

    async def update_document_rag_metadata(self, doc_id: str, workspace_id: str, rag_data: Dict[str, Any]) -> bool:
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
            "vector_stored": rag_data.get("vector_stored", False),
            "chunk_ids": rag_data.get("chunk_ids", []),
            "embedding_model": rag_data.get("embedding_model"),
            "storage_service": rag_data.get("storage_service")
        }

        # Remove None values to avoid overwriting with null
        rag_metadata = {k: v for k, v in rag_metadata.items() if v is not None}

        # Use update operation instead of save to avoid duplicate key error
        success = await db.update_document(doc_id, workspace_id, rag_metadata)
        return success

    async def mark_document_for_rag_reprocessing(self, doc_id: str, workspace_id: str) -> bool:
        """Mark document as needing RAG reprocessing due to failure."""
        db = await self._get_db()
        document = await db.get_document(doc_id, workspace_id)
        if not document:
            return False

        # Mark for reprocessing
        document.update({
            "rag_processed": False,
            "rag_needs_reprocessing": True,
            "rag_last_error": datetime.now().isoformat()
        })

        return await db.update_document(doc_id, workspace_id, {
            "rag_processed": False,
            "rag_needs_reprocessing": True,
            "rag_last_error": document["rag_last_error"],
        })

    async def get_documents_needing_rag_processing(self, workspace_id: str) -> List[Dict[str, Any]]:
        """Get documents that need RAG processing."""
        # This would need to be implemented in the database interface
        # For now, return empty list
        return []

    async def get_all_documents_for_cleanup(self) -> List[Dict[str, Any]]:
        """Get local workspace documents for cleanup operations."""
        db = await self._get_db()
        collection = db._get_collection("documents")
        cursor = collection.find({"workspace_id": WORKSPACE_ID})
        documents = []
        async for doc in cursor:
            documents.append(doc)
        return documents

    async def cleanup_document_sessions(self, doc_id: str, workspace_id: str) -> bool:
        """Remove all chat sessions (legacy and foundational) from a document."""
        db = await self._get_db()
        collection = db._get_collection("documents")

        # Remove both chat_sessions array and chat_session object
        result = await collection.update_one(
            {"id": doc_id, "workspace_id": workspace_id},
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

    async def update_document_data(self, document_id: str, workspace_id: str, update_data: Dict[str, Any]) -> bool:
        """Update document data safely through the service layer."""
        try:
            db = await self._get_db()
            return await db.update_document(document_id, workspace_id, update_data)
        except Exception as e:
            logger.error("Document update failed: %s", type(e).__name__)
            return False

    async def update_document_if(
        self, document_id: str, workspace_id: str,
        expected: Dict[str, Any], update_data: Dict[str, Any],
    ) -> bool:
        """Apply server-owned claim conditions without hiding database failures."""
        try:
            db = await self._get_db()
            return await db.update_document_if(document_id, workspace_id, expected, update_data)
        except Exception as e:
            logger.error("Conditional document update failed: %s", type(e).__name__)
            raise DatabaseError("Failed to conditionally update document") from None

    # PDF File Operations
    async def store_pdf_file(self, document_id: str, workspace_id: str, file_data: bytes,
                           filename: str, content_type: str = "application/pdf") -> bool:
        """Attach a new PDF to an existing scoped document, preserving prior files.

        An uncertain pointer write is checked before cleanup. If that check also
        fails, keep the new file: deleting a potentially attached original would
        turn a recoverable storage problem into document loss.
        """
        try:
            db = await self._get_db()
            if not await db.get_document(document_id, workspace_id):
                return False

            from services.file_storage_service import get_file_storage_service
            file_storage = get_file_storage_service()

            # Store the PDF file
            file_id = await file_storage.store_file(
                file_data=file_data,
                filename=filename,
                content_type=content_type,
                workspace_id=workspace_id,
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

            try:
                success = await db.update_document(document_id, workspace_id, pdf_metadata)
            except Exception as e:
                logger.warning("PDF pointer update outcome is uncertain: %s", type(e).__name__)
                success = False

            if success:
                logger.info("Stored PDF file successfully")
                return True

            try:
                current = await db.get_document(document_id, workspace_id)
            except Exception as e:
                logger.error("PDF pointer verification failed; stored file retained: %s", type(e).__name__)
                return False

            if current and current.get("pdf_file_id") == file_id:
                if current.get("has_pdf_file"):
                    return True
                logger.error("PDF pointer is attached without complete metadata; stored file retained")
                return False

            # Only the newly uploaded, confirmed-unattached file is eligible.
            # Never delete a previous original or the document namespace here.
            if not await file_storage.delete_file(file_id, workspace_id):
                logger.error("Unattached PDF rollback is incomplete")
            return False

        except Exception as e:
            logger.error("PDF file storage failed: %s", type(e).__name__)
            return False

    async def get_pdf_file(self, document_id: str, workspace_id: str) -> Optional[Dict[str, Any]]:
        """Get PDF file for a document."""
        try:
            # First get document to get PDF file ID
            document = await self.get_document_for_workspace(document_id, workspace_id)
            if not document or not document.get('has_pdf_file'):
                return None

            pdf_file_id = document.get('pdf_file_id')
            if not pdf_file_id:
                return None

            # Get file from storage
            from services.file_storage_service import get_file_storage_service
            file_storage = get_file_storage_service()

            return await file_storage.get_file(pdf_file_id, workspace_id)

        except Exception as e:
            logger.error("PDF file retrieval failed: %s", type(e).__name__)
            return None

    async def get_pdf_file_stream(self, document_id: str, workspace_id: str):
        """Get PDF file stream for efficient downloading."""
        try:
            # First get document to get PDF file ID
            document = await self.get_document_for_workspace(document_id, workspace_id)
            if not document or not document.get('has_pdf_file'):
                return None, None

            pdf_file_id = document.get('pdf_file_id')
            if not pdf_file_id:
                return None, None

            # Get file metadata and stream
            from services.file_storage_service import get_file_storage_service
            file_storage = get_file_storage_service()

            metadata = await file_storage.get_file_metadata(pdf_file_id, workspace_id)
            stream = await file_storage.get_file_stream(pdf_file_id, workspace_id)

            return metadata, stream

        except Exception as e:
            logger.error("PDF file stream failed: %s", type(e).__name__)
            return None, None

    async def has_pdf_file(self, document_id: str, workspace_id: str) -> bool:
        """Check if document has a PDF file."""
        try:
            document = await self.get_document_for_workspace(document_id, workspace_id)
            return document.get('has_pdf_file', False) if document else False
        except Exception as e:
            logger.error("PDF file status check failed: %s", type(e).__name__)
            return False

    # Atomic operations for race condition prevention
    async def create_or_get_chat_session(self, document_id: str, workspace_id: str, session_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Atomically create chat session if it doesn't exist, or return existing session."""
        db = await self._get_db()
        return await db.create_or_get_chat_session(document_id, workspace_id, session_data)

    async def add_chat_message_atomic(self, document_id: str, workspace_id: str, message: Dict[str, Any]) -> bool:
        """Atomically add a message to the chat session."""
        db = await self._get_db()
        return await db.add_chat_message_atomic(document_id, workspace_id, message)

    async def clear_chat_messages(self, document_id: str, workspace_id: str) -> bool:
        """Clear all messages from the chat session."""
        db = await self._get_db()
        return await db.clear_chat_messages(document_id, workspace_id)

    async def update_clause_rewrite(self, document_id: str, clause_id: str, workspace_id: str, rewrite_suggestion: str, generation: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        """Update a clause with a rewrite suggestion."""
        try:
            db = await self._get_db()

            # Get the current document
            document = await db.get_document(document_id, workspace_id)
            if not document:
                raise ValueError("Document not found")

            # Find and update the specific clause
            clauses = document.get("clauses", [])
            updated_clause = None

            for clause in clauses:
                if clause.get("id") == clause_id:
                    clause["rewrite_suggestion"] = rewrite_suggestion
                    clause["rewrite_generated_at"] = datetime.utcnow().isoformat()
                    if generation is not None:
                        clause["rewrite_generation"] = generation
                    updated_clause = clause
                    break

            if not updated_clause:
                raise ValueError("Clause not found")

            # Update the document with the modified clauses
            success = await db.update_document_field(document_id, workspace_id, "clauses", clauses)

            if success:
                return updated_clause
            else:
                raise Exception("Failed to update document with rewrite suggestion")

        except Exception as e:
            logger.error("Clause rewrite update failed: %s", type(e).__name__)
            raise

    # ================== SYSTEM CONFIG OPERATIONS ==================
    # For storing system-wide application configuration

    async def get_system_config(self, key: str, *, raise_on_error: bool = False) -> Optional[Dict[str, Any]]:
        """Get a system configuration by key."""
        try:
            db = await self._get_db()
            collection = db._get_collection("system_config")
            config = await collection.find_one({"key": key})
            if config:
                config["_id"] = str(config["_id"])
            return config
        except Exception as e:
            logger.error("System configuration lookup failed: %s", type(e).__name__)
            if raise_on_error:
                from services.ai.generation import AIRequestError
                raise AIRequestError("Could not read model settings. Restore the local database connection before making AI requests.", 503) from None
            return None

    async def set_system_config(self, key: str, data: Dict[str, Any], workspace_id: str = WORKSPACE_ID) -> bool:
        """Set a system configuration. Creates or updates."""
        try:
            db = await self._get_db()
            collection = db._get_collection("system_config")

            config_data = {
                "key": key,
                **data,
                "updated_at": datetime.now().isoformat(),
                "updated_by": workspace_id
            }

            # Upsert the config
            result = await collection.update_one(
                {"key": key},
                {"$set": config_data},
                upsert=True
            )

            return result.acknowledged
        except Exception as e:
            logger.error("System configuration update failed: %s", type(e).__name__)
            return False

    async def delete_system_config(self, key: str) -> bool:
        """Delete a system configuration."""
        try:
            db = await self._get_db()
            collection = db._get_collection("system_config")
            result = await collection.delete_one({"key": key})
            return result.deleted_count > 0
        except Exception as e:
            logger.error("System configuration deletion failed: %s", type(e).__name__)
            return False

    # System AI Model configuration
    async def set_system_ai_model(self, model_id: str, workspace_id: str = WORKSPACE_ID,
                                  reasoning_effort: str = "medium") -> bool:
        """
        Set the system-wide AI model for the workspace.

        Args:
            model_id: An active OpenAI model ID, such as 'gpt-6-sol'
            workspace_id: Workspace making the change

        Returns:
            True if successful, False otherwise
        """
        try:
            from ai_models.models import AIModelConfig

            # Validate the model ID
            if not AIModelConfig.is_valid_model(model_id):
                logger.error("Invalid system AI model ID")
                return False
            if reasoning_effort not in AIModelConfig.get_model_by_id(model_id).reasoning_efforts:
                return False

            return await self.set_system_config("system_ai_model", {
                "model_id": model_id,
                "reasoning_effort": reasoning_effort,
                "configured_at": datetime.now().isoformat()
            }, workspace_id)
        except Exception as e:
            logger.error("System AI model update failed: %s", type(e).__name__)
            return False

    async def get_system_ai_model(self) -> str:
        """
        Get the system-wide AI model.

        Returns:
            The configured model ID, or the default model if not configured.
        """
        return (await self.get_workspace_generation_settings(WORKSPACE_ID))["model_id"]

    async def get_system_ai_model_config(self) -> Optional[Dict[str, Any]]:
        """
        Get the full system AI model configuration including metadata.

        Returns:
            Dict with model_id, configured_at, and updated_by, or None if not configured.
        """
        return await self.get_system_config("system_ai_model")

    # Query Gate Model configuration (for conversation context gate)
    async def set_query_gate_model(self, model_id: str, workspace_id: str = WORKSPACE_ID) -> bool:
        """
        Set the query gate model used for conversation context detection.

        Args:
            model_id: An active OpenAI model ID, such as 'gpt-6-sol'
            workspace_id: Workspace making the change

        Returns:
            True if successful, False otherwise
        """
        try:
            from ai_models.models import AIModelConfig

            # Validate the model ID
            if not AIModelConfig.is_valid_model(model_id):
                logger.error("Invalid query gate model ID")
                return False

            return await self.set_system_config("query_gate_model", {
                "model_id": model_id,
                "configured_at": datetime.now().isoformat()
            }, workspace_id)
        except Exception as e:
            logger.error("Query gate model update failed: %s", type(e).__name__)
            return False

    async def get_query_gate_model(self) -> str:
        """
        Get the query gate model for conversation context detection.

        Returns:
            The configured model ID, resolving retired choices, or the Sol default.
        """
        config = await self.get_system_config("query_gate_model", raise_on_error=True)
        if config and "model_id" in config:
            from ai_models.models import resolve_retired_model_selection
            return resolve_retired_model_selection(config["model_id"])
        from ai_models.models import DEFAULT_QUERY_GATE_MODEL
        return DEFAULT_QUERY_GATE_MODEL

    async def get_query_gate_model_config(self) -> Optional[Dict[str, Any]]:
        """
        Get the full query gate model configuration including metadata.

        Returns:
            Dict with model_id, configured_at, and updated_by, or None if not configured.
        """
        return await self.get_system_config("query_gate_model")

    # Document Auto-Delete configuration
    async def set_auto_delete_config(self, days: int, workspace_id: str = WORKSPACE_ID) -> bool:
        """
        Configure the auto-delete period for workspace documents.

        Args:
            days: Number of days after which documents are auto-deleted (0 to disable)
            workspace_id: Workspace making the change

        Returns:
            True if successful, False otherwise
        """
        return await self.set_system_config("document_auto_delete", {
            "enabled": days > 0,
            "days": days,
            "configured_at": datetime.now().isoformat()
        }, workspace_id)

    async def get_auto_delete_config(self) -> Dict[str, Any]:
        """
        Get the auto-delete configuration.

        Returns:
            Dict with 'enabled' (bool), 'days' (int), and metadata
            Defaults to disabled; retention must be explicitly enabled.
        """
        config = await self.get_system_config("document_auto_delete")
        if not config:
            # Return default configuration
            return {
                "enabled": False,
                "days": 0,
                "configured_at": None,
                "updated_by": None
            }
        return {
            "enabled": config.get("enabled", False),
            "days": config.get("days", 0),
            "configured_at": config.get("configured_at"),
            "updated_by": config.get("updated_by")
        }


    # UI Settings configuration
    async def set_ui_settings(self, settings: Dict[str, Any], workspace_id: str = WORKSPACE_ID) -> bool:
        """
        Configure UI settings like toast notifications.

        Args:
            settings: Dict with UI settings (e.g., toast_notifications_enabled)
            workspace_id: Workspace making the change

        Returns:
            True if successful, False otherwise
        """
        current = await self.get_ui_settings()
        updated = {**current, **settings, "configured_at": datetime.now().isoformat()}
        return await self.set_system_config("ui_settings", updated, workspace_id)

    async def get_ui_settings(self) -> Dict[str, Any]:
        """
        Get UI settings configuration.

        Returns:
            Dict with UI settings
            Defaults to toast_notifications_enabled=True if not configured
        """
        config = await self.get_system_config("ui_settings")
        if not config:
            return {
                "toast_notifications_enabled": True,
                "configured_at": None,
                "updated_by": None
            }
        return {
            "toast_notifications_enabled": config.get("toast_notifications_enabled", True),
            "configured_at": config.get("configured_at"),
            "updated_by": config.get("updated_by")
        }

    async def get_expired_documents(self, days: int) -> List[Dict[str, Any]]:
        """
        Get documents that are older than the specified number of days.

        Args:
            days: Number of days after which documents are considered expired

        Returns:
            List of expired documents
        """
        try:
            from datetime import timedelta

            db = await self._get_db()
            collection = db._get_collection("documents")

            # Calculate the cutoff date
            cutoff_date = (datetime.utcnow() - timedelta(days=days)).isoformat()

            # Build query
            query = {
                "workspace_id": WORKSPACE_ID,
                "$or": [
                    {"created_at": {"$lt": cutoff_date}},
                    {"created_at": None, "upload_date": {"$lt": cutoff_date}}
                ]
            }

            # Get expired documents
            cursor = collection.find(
                query,
                {"id": 1, "workspace_id": 1, "filename": 1, "created_at": 1, "upload_date": 1}
            )

            documents = []
            async for doc in cursor:
                doc["_id"] = str(doc["_id"])
                documents.append(doc)

            return documents

        except Exception as e:
            logger.error("Expired document lookup failed: %s", type(e).__name__)
            raise DatabaseError("Expired document lookup failed") from None

    async def cleanup_expired_documents(self) -> Dict[str, Any]:
        """
        Delete documents that have exceeded the auto-delete period.

        Returns:
            Dict with cleanup statistics
        """
        result = {
            "deleted_count": 0,
            "failed_count": 0,
            "errors": [],
            "run_at": datetime.now().isoformat()
        }

        try:
            # Get auto-delete configuration
            config = await self.get_auto_delete_config()

            if not config.get("enabled"):
                logger.info("Document auto-delete is disabled, skipping cleanup")
                result["skipped"] = True
                result["reason"] = "Auto-delete is disabled"
                return result

            days = config.get("days", 0)
            if days <= 0:
                logger.info("Auto-delete days is 0 or negative, skipping cleanup")
                result["skipped"] = True
                result["reason"] = "Auto-delete days must be positive"
                return result

            # Get expired documents
            expired_docs = await self.get_expired_documents(days)

            if not expired_docs:
                logger.info(f"No documents older than {days} days found for cleanup")
                return result

            logger.info(f"Found {len(expired_docs)} documents older than {days} days for cleanup")

            # Delete each expired document
            for doc in expired_docs:
                try:
                    doc_id = doc.get("id")
                    workspace_id = doc.get("workspace_id")

                    if doc_id and workspace_id == WORKSPACE_ID:
                        success = await self.delete_document_for_workspace(doc_id, workspace_id)
                        if success:
                            result["deleted_count"] += 1
                            logger.info("Auto-deleted expired document")
                        else:
                            result["failed_count"] += 1
                            result["errors"].append("Failed to delete an expired document")
                    else:
                        result["failed_count"] += 1
                        result["errors"].append("Expired document metadata is incomplete")

                except Exception as e:
                    result["failed_count"] += 1
                    result["errors"].append("Failed to delete an expired document")
                    logger.error("Expired document deletion failed: %s", type(e).__name__)

            logger.info(f"Auto-delete cleanup completed: {result['deleted_count']} deleted, {result['failed_count']} failed")

            return result

        except Exception as e:
            logger.error("Document cleanup failed: %s", type(e).__name__)
            result["errors"].append("Document cleanup failed")
            return result



# Global singleton instance
_document_service = None

def get_document_service() -> DocumentService:
    """Get async document service instance (singleton)."""
    global _document_service
    if _document_service is None:
        _document_service = DocumentService()
    return _document_service
