"""
Service layer for database operations.
Provides backward compatibility with existing MongoDocumentStorage interface
while using the new database abstraction layer.
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
        """Delete document for specific user."""
        db = await self._get_db()
        return await db.delete_document(doc_id, user_id)
    
    async def delete_all_documents_for_user(self, user_id: str) -> int:
        """Delete all documents for user."""
        db = await self._get_db()
        documents = await db.list_documents(user_id, limit=1000)  # Get all documents
        count = 0
        for doc in documents:
            if await db.delete_document(doc["id"], user_id):
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
        """Save or update user interaction for a clause."""
        from datetime import datetime
        
        db = await self._get_db()
        
        interaction_data = {
            "clause_id": clause_id,
            "user_id": user_id,
            "note": note,
            "is_flagged": is_flagged,
            "updated_at": datetime.now().isoformat()
        }
        
        # Get existing interactions
        existing_interactions = await self.get_user_interactions(document_id, user_id) or {}
        
        # Add created_at if this is a new interaction
        if clause_id not in existing_interactions:
            interaction_data["created_at"] = datetime.now().isoformat()
        else:
            # Preserve the original created_at timestamp
            interaction_data["created_at"] = existing_interactions[clause_id].get("created_at", datetime.now().isoformat())
        
        # Update the interactions
        existing_interactions[clause_id] = interaction_data
        
        # Save to database
        await db.save_user_interactions(document_id, user_id, existing_interactions)
        
        return interaction_data
    
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
    
    # Health check
    async def get_database_info(self) -> Dict[str, Any]:
        """Get database information."""
        return await DatabaseFactory.health_check()


class CompatibilityService:
    """
    Backward compatibility service that provides synchronous interface
    to the async DocumentService for existing code.
    """
    
    def __init__(self):
        self._doc_service = DocumentService()
        self._loop: Optional[asyncio.AbstractEventLoop] = None
    
    def _get_loop(self) -> asyncio.AbstractEventLoop:
        """Get or create event loop."""
        try:
            return asyncio.get_event_loop()
        except RuntimeError:
            # Create new loop if none exists
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            return loop
    
    def _run_async(self, coro):
        """Run async function synchronously."""
        loop = self._get_loop()
        if loop.is_running():
            # If we're already in an async context, we can't use run()
            # Create a task and get the result
            task = asyncio.create_task(coro)
            # This is a workaround - in production, the calling code should be async
            return asyncio.run_coroutine_threadsafe(coro, loop).result()
        else:
            return loop.run_until_complete(coro)
    
    # Synchronous wrappers for all methods
    def save_document(self, document_dict: Dict[str, Any]) -> str:
        return self._run_async(self._doc_service.save_document(document_dict))
    
    def save_document_for_user(self, document_dict: Dict[str, Any], user_id: str) -> str:
        return self._run_async(self._doc_service.save_document_for_user(document_dict, user_id))
    
    def get_document(self, doc_id: str) -> Optional[Dict[str, Any]]:
        return self._run_async(self._doc_service.get_document(doc_id))
    
    def get_document_for_user(self, doc_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        return self._run_async(self._doc_service.get_document_for_user(doc_id, user_id))
    
    def get_documents_for_user(self, user_id: str) -> List[Dict[str, Any]]:
        return self._run_async(self._doc_service.get_documents_for_user(user_id))
    
    def get_all_documents(self) -> List[Dict[str, Any]]:
        """Get all documents - deprecated."""
        logger.warning("get_all_documents is deprecated")
        return []
    
    def delete_document(self, doc_id: str) -> bool:
        return self._run_async(self._doc_service.delete_document(doc_id))
    
    def delete_document_for_user(self, doc_id: str, user_id: str) -> bool:
        return self._run_async(self._doc_service.delete_document_for_user(doc_id, user_id))
    
    def delete_all_documents_for_user(self, user_id: str) -> int:
        return self._run_async(self._doc_service.delete_all_documents_for_user(user_id))
    
    def get_documents_count(self) -> int:
        return self._run_async(self._doc_service.get_documents_count())
    
    def create_user(self, user_data: Dict[str, Any]) -> str:
        return self._run_async(self._doc_service.create_user(user_data))
    
    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        return self._run_async(self._doc_service.get_user_by_email(email))
    
    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        return self._run_async(self._doc_service.get_user_by_id(user_id))
    
    def update_user(self, user_id: str, update_data: Dict[str, Any]) -> bool:
        return self._run_async(self._doc_service.update_user(user_id, update_data))
    
    def update_user_password(self, email: str, new_hashed_password: str) -> bool:
        return self._run_async(self._doc_service.update_user_password(email, new_hashed_password))
    
    def update_user_preferences(self, user_id: str, preferences: Dict[str, Any]) -> bool:
        return self._run_async(self._doc_service.update_user_preferences(user_id, preferences))
    
    def get_user_preferred_model(self, user_id: str) -> str:
        return self._run_async(self._doc_service.get_user_preferred_model(user_id))
    
    def get_database_info(self) -> Dict[str, Any]:
        return self._run_async(self._doc_service.get_database_info())


# Global service instance for backward compatibility
_compatibility_service: Optional[CompatibilityService] = None


def get_document_service() -> DocumentService:
    """Get async document service instance."""
    return DocumentService()


def get_compatibility_service() -> CompatibilityService:
    """Get compatibility service for synchronous access."""
    global _compatibility_service
    if _compatibility_service is None:
        _compatibility_service = CompatibilityService()
    return _compatibility_service
