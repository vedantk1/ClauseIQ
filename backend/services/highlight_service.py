"""
Highlight management service for PDF documents.
"""
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime
from bson import ObjectId

from database.factory import get_database_factory
from clauseiq_types.highlights import (
    Highlight,
    HighlightArea,
    CreateHighlightRequest,
    UpdateHighlightRequest
)


logger = logging.getLogger(__name__)


class HighlightService:
    """Service for managing PDF highlights."""
    
    def __init__(self):
        self._db = None
    
    async def _get_db(self):
        """Get database instance."""
        if self._db is None:
            factory = get_database_factory()
            self._db = await factory.get_database()
        return self._db
    
    async def _get_highlights_collection(self):
        """Get highlights collection."""
        db = await self._get_db()
        return db._get_collection("highlights")
    
    async def create_highlight(
        self, 
        document_id: str, 
        user_id: str, 
        request: CreateHighlightRequest
    ) -> Highlight:
        """Create a new highlight for a document."""
        try:
            # Create highlight object
            highlight = Highlight(
                document_id=document_id,
                user_id=user_id,
                content=request.content,
                comment=request.comment,
                areas=request.areas,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            
            # Convert to dict for MongoDB storage
            highlight_dict = highlight.dict()
            highlight_dict["_id"] = ObjectId()
            highlight_dict["id"] = str(highlight_dict["_id"])
            
            # Store in highlights collection
            collection = await self._get_highlights_collection()
            result = await collection.insert_one(highlight_dict)
            
            if not result.inserted_id:
                raise RuntimeError("Failed to insert highlight")
            
            logger.info(f"Created highlight {highlight.id} for document {document_id}")
            return highlight
            
        except Exception as e:
            logger.error(f"Failed to create highlight: {e}")
            raise
    
    async def get_highlights(self, document_id: str, user_id: str) -> List[Highlight]:
        """Get all highlights for a document."""
        try:
            collection = await self._get_highlights_collection()
            
            # Find highlights for this document and user
            cursor = collection.find({
                "document_id": document_id,
                "user_id": user_id
            })
            
            highlights = []
            async for highlight_dict in cursor:
                # Convert MongoDB ObjectId to string
                highlight_dict["id"] = str(highlight_dict["_id"])
                
                # Ensure proper datetime handling
                if isinstance(highlight_dict.get("created_at"), str):
                    highlight_dict["created_at"] = datetime.fromisoformat(highlight_dict["created_at"].replace("Z", "+00:00"))
                if isinstance(highlight_dict.get("updated_at"), str):
                    highlight_dict["updated_at"] = datetime.fromisoformat(highlight_dict["updated_at"].replace("Z", "+00:00"))
                
                highlight = Highlight(**highlight_dict)
                highlights.append(highlight)
            
            logger.info(f"Retrieved {len(highlights)} highlights for document {document_id}")
            return highlights
            
        except Exception as e:
            logger.error(f"Failed to get highlights for document {document_id}: {e}")
            raise
    
    async def get_highlight_by_id(
        self, 
        user_id: str, 
        document_id: str, 
        highlight_id: str
    ) -> Optional[Highlight]:
        """Get a specific highlight by ID."""
        try:
            collection = await self._get_highlights_collection()
            
            doc = await collection.find_one({
                "id": highlight_id,
                "user_id": user_id,
                "document_id": document_id
            })
            
            if not doc:
                logger.warning(f"Highlight {highlight_id} not found for user {user_id}")
                return None
            
            # Convert MongoDB document to Highlight object
            highlight = Highlight(
                id=doc["id"],
                documentId=doc["document_id"],
                userId=doc["user_id"],
                content=doc["content"],
                comment=doc["comment"],
                areas=[
                    HighlightArea(
                        height=area["height"],
                        left=area["left"],
                        pageIndex=area["page_index"],
                        top=area["top"],
                        width=area["width"]
                    ) for area in doc["areas"]
                ],
                aiRewrite=doc.get("ai_rewrite"),
                createdAt=doc["created_at"],
                updatedAt=doc["updated_at"]
            )
            
            logger.info(f"Retrieved highlight {highlight_id}")
            return highlight
            
        except Exception as e:
            logger.error(f"Failed to get highlight {highlight_id}: {e}")
            raise

    async def update_highlight(
        self, 
        document_id: str, 
        user_id: str, 
        highlight_id: str, 
        request: UpdateHighlightRequest
    ) -> Optional[Highlight]:
        """Update an existing highlight."""
        try:
            collection = await self._get_highlights_collection()
            
            # Prepare update data
            update_data = {
                "updated_at": datetime.utcnow()
            }
            
            if request.comment is not None:
                update_data["comment"] = request.comment
            if request.ai_rewrite is not None:
                update_data["ai_rewrite"] = request.ai_rewrite
            
            # Update the highlight
            result = await collection.update_one(
                {
                    "_id": ObjectId(highlight_id),
                    "document_id": document_id,
                    "user_id": user_id
                },
                {"$set": update_data}
            )
            
            if result.matched_count == 0:
                logger.warning(f"Highlight {highlight_id} not found")
                return None
            
            # Fetch and return updated highlight
            updated_doc = await collection.find_one({
                "_id": ObjectId(highlight_id),
                "document_id": document_id,
                "user_id": user_id
            })
            
            if updated_doc:
                updated_doc["id"] = str(updated_doc["_id"])
                highlight = Highlight(**updated_doc)
                logger.info(f"Updated highlight {highlight_id}")
                return highlight
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to update highlight {highlight_id}: {e}")
            raise
    
    async def delete_highlight(
        self, 
        document_id: str, 
        user_id: str, 
        highlight_id: str
    ) -> bool:
        """Delete a highlight."""
        try:
            collection = await self._get_highlights_collection()
            
            # Delete the highlight
            result = await collection.delete_one({
                "_id": ObjectId(highlight_id),
                "document_id": document_id,
                "user_id": user_id
            })
            
            if result.deleted_count == 0:
                logger.warning(f"Highlight {highlight_id} not found for deletion")
                return False
            
            logger.info(f"Deleted highlight {highlight_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete highlight {highlight_id}: {e}")
            raise


# Singleton instance
_highlight_service = None

def get_highlight_service() -> HighlightService:
    """Get the highlight service singleton."""
    global _highlight_service
    if _highlight_service is None:
        _highlight_service = HighlightService()
    return _highlight_service
