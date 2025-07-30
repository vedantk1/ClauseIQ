"""
MongoDB adapter implementation for the database interface.
Provides MongoDB-specific implementation of database operations.
"""
import asyncio
from typing import Dict, List, Optional, Any
from datetime import datetime
import uuid
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase, AsyncIOMotorCollection
from pymongo.errors import DuplicateKeyError, ConnectionFailure, OperationFailure
import logging

from .interface import (
    DatabaseInterface, 
    ConnectionConfig, 
    DatabaseError, 
    ConnectionError, 
    ValidationError, 
    NotFoundError, 
    DuplicateError
)

logger = logging.getLogger(__name__)


class MongoDBAdapter(DatabaseInterface):
    """MongoDB implementation of database interface."""
    
    def __init__(self, config: ConnectionConfig):
        self.config = config
        self.client: Optional[AsyncIOMotorClient] = None
        self.database: Optional[AsyncIOMotorDatabase] = None
        
    async def connect(self) -> None:
        """Establish MongoDB connection with enhanced pool configuration."""
        try:
            self.client = AsyncIOMotorClient(
                self.config.uri,
                maxPoolSize=self.config.max_pool_size,
                minPoolSize=self.config.min_pool_size,
                maxIdleTimeMS=self.config.max_idle_time_ms,
                waitQueueTimeoutMS=self.config.wait_queue_timeout_ms,
                serverSelectionTimeoutMS=self.config.server_selection_timeout_ms,
                retryWrites=True,
                retryReads=True,
                heartbeatFrequencyMS=10000,  # 10 seconds heartbeat
                connectTimeoutMS=20000  # 20 seconds connection timeout
            )
            
            # Test connection
            await self.client.admin.command('ping')
            
            self.database = self.client[self.config.database]
            logger.info(f"Connected to MongoDB database: {self.config.database}")
            
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            raise ConnectionError(f"Failed to connect to MongoDB: {e}")
    
    async def disconnect(self) -> None:
        """Close MongoDB connection."""
        if self.client:
            self.client.close()
            self.client = None
            self.database = None
            logger.info("Disconnected from MongoDB")
    
    async def health_check(self) -> Dict[str, Any]:
        """Check MongoDB health status."""
        if self.database is None:
            return {"status": "disconnected", "error": "No database connection"}
        
        try:
            # Check if we can ping the database
            await self.client.admin.command('ping')
            
            # Get some basic stats
            stats = await self.database.command("dbStats")
            
            return {
                "status": "healthy",
                "database": self.config.database,
                "collections": stats.get("collections", 0),
                "dataSize": stats.get("dataSize", 0),
                "indexSize": stats.get("indexSize", 0),
                "connected": True
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "connected": False
            }
    
    def _get_collection(self, collection_name: str) -> AsyncIOMotorCollection:
        """Get collection with prefix."""
        full_name = f"{self.config.collection_prefix}{collection_name}" if self.config.collection_prefix else collection_name
        return self.database[full_name]
    
    # User operations
    async def create_user(self, user_data: Dict[str, Any]) -> str:
        """Create a new user and return user ID."""
        try:
            users_collection = self._get_collection("users")
            
            # Add timestamps
            user_data["created_at"] = datetime.utcnow().isoformat()
            user_data["updated_at"] = datetime.utcnow().isoformat()
            
            # Ensure unique email
            existing_user = await users_collection.find_one({"email": user_data["email"]})
            if existing_user:
                raise DuplicateError(f"User with email {user_data['email']} already exists")
            
            result = await users_collection.insert_one(user_data)
            return str(result.inserted_id)
            
        except DuplicateKeyError:
            raise DuplicateError(f"User with email {user_data['email']} already exists")
        except Exception as e:
            logger.error(f"Error creating user: {e}")
            raise DatabaseError(f"Failed to create user: {e}")
    
    async def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user by ID."""
        try:
            users_collection = self._get_collection("users")
            user = await users_collection.find_one({"id": user_id})
            
            if user:
                user["_id"] = str(user["_id"])  # Convert ObjectId to string
            
            return user
        except Exception as e:
            logger.error(f"Error getting user by ID: {e}")
            raise DatabaseError(f"Failed to get user: {e}")
    
    async def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Get user by email."""
        try:
            users_collection = self._get_collection("users")
            user = await users_collection.find_one({"email": email})
            
            if user:
                user["_id"] = str(user["_id"])  # Convert ObjectId to string
            
            return user
        except Exception as e:
            logger.error(f"Error getting user by email: {e}")
            raise DatabaseError(f"Failed to get user: {e}")
    
    async def update_user(self, user_id: str, update_data: Dict[str, Any]) -> bool:
        """Update user data."""
        try:
            users_collection = self._get_collection("users")
            
            # Add update timestamp
            update_data["updated_at"] = datetime.utcnow().isoformat()
            
            result = await users_collection.update_one(
                {"id": user_id},
                {"$set": update_data}
            )
            
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Error updating user: {e}")
            raise DatabaseError(f"Failed to update user: {e}")
    
    async def delete_user(self, user_id: str) -> bool:
        """Delete user."""
        try:
            users_collection = self._get_collection("users")
            result = await users_collection.delete_one({"id": user_id})
            return result.deleted_count > 0
        except Exception as e:
            logger.error(f"Error deleting user: {e}")
            raise DatabaseError(f"Failed to delete user: {e}")
    
    # Document operations
    async def save_document(self, document_data: Dict[str, Any]) -> str:
        """Save document and return document ID."""
        try:
            documents_collection = self._get_collection("documents")
            
            # Add timestamps
            document_data["created_at"] = datetime.utcnow().isoformat()
            document_data["updated_at"] = datetime.utcnow().isoformat()
            
            result = await documents_collection.insert_one(document_data)
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"Error saving document: {e}")
            raise DatabaseError(f"Failed to save document: {e}")
    
    async def get_document(self, document_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Get document by ID for specific user."""
        try:
            documents_collection = self._get_collection("documents")
            document = await documents_collection.find_one({
                "id": document_id,
                "user_id": user_id
            })
            
            if document:
                document["_id"] = str(document["_id"])
            
            return document
        except Exception as e:
            logger.error(f"Error getting document: {e}")
            raise DatabaseError(f"Failed to get document: {e}")
    
    async def list_documents(
        self, 
        user_id: str, 
        limit: int = 50, 
        offset: int = 0,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """List documents for user with pagination and filtering."""
        try:
            documents_collection = self._get_collection("documents")
            
            # Build query
            query = {"user_id": user_id}
            if filters:
                query.update(filters)
            
            # Execute query with pagination
            cursor = documents_collection.find(query).skip(offset).limit(limit)
            documents = await cursor.to_list(length=limit)
            
            # Convert ObjectIds to strings
            for doc in documents:
                doc["_id"] = str(doc["_id"])
            
            return documents
        except Exception as e:
            logger.error(f"Error listing documents: {e}")
            raise DatabaseError(f"Failed to list documents: {e}")
    
    async def update_document(self, document_id: str, user_id: str, update_data: Dict[str, Any]) -> bool:
        """Update document data."""
        try:
            documents_collection = self._get_collection("documents")
            
            # Add update timestamp
            update_data["updated_at"] = datetime.utcnow().isoformat()
            
            result = await documents_collection.update_one(
                {"id": document_id, "user_id": user_id},
                {"$set": update_data}
            )
            
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Error updating document: {e}")
            raise DatabaseError(f"Failed to update document: {e}")
    
    async def update_document_field(self, document_id: str, user_id: str, field_name: str, field_value) -> bool:
        """Update a specific field in a document."""
        try:
            documents_collection = self._get_collection("documents")
            
            result = await documents_collection.update_one(
                {"id": document_id, "user_id": user_id},
                {"$set": {
                    field_name: field_value,
                    "updated_at": datetime.utcnow().isoformat()
                }}
            )
            
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Error updating document field {field_name}: {e}")
            raise DatabaseError(f"Failed to update document field: {e}")
    
    async def delete_document(self, document_id: str, user_id: str) -> bool:
        """Delete document."""
        try:
            documents_collection = self._get_collection("documents")
            result = await documents_collection.delete_one({
                "id": document_id,
                "user_id": user_id
            })
            return result.deleted_count > 0
        except Exception as e:
            logger.error(f"Error deleting document: {e}")
            raise DatabaseError(f"Failed to delete document: {e}")

    async def create_or_get_chat_session(self, document_id: str, user_id: str, session_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Atomically create chat session if it doesn't exist, or return existing session."""
        try:
            documents_collection = self._get_collection("documents")
            
            # Use findOneAndUpdate with upsert to atomically check and create session
            result = await documents_collection.find_one_and_update(
                {
                    "id": document_id,
                    "user_id": user_id,
                    "chat_session": {"$exists": False}  # Only update if no session exists
                },
                {
                    "$set": {
                        "chat_session": session_data,
                        "updated_at": datetime.utcnow().isoformat()
                    }
                },
                return_document=True  # Return the updated document
            )
            
            if result:
                # Session was created successfully
                return {"created": True, "session": result.get("chat_session")}
            else:
                # Session already exists, get the existing one
                existing_doc = await documents_collection.find_one(
                    {"id": document_id, "user_id": user_id}
                )
                if existing_doc and "chat_session" in existing_doc:
                    return {"created": False, "session": existing_doc["chat_session"]}
                else:
                    # Document doesn't exist or other error
                    return None
                    
        except Exception as e:
            logger.error(f"Error in atomic chat session operation: {e}")
            raise DatabaseError(f"Failed to create or get chat session: {e}")
    
    async def add_chat_message_atomic(self, document_id: str, user_id: str, message: Dict[str, Any]) -> bool:
        """Atomically add a message to the chat session."""
        try:
            documents_collection = self._get_collection("documents")
            
            result = await documents_collection.update_one(
                {
                    "id": document_id,
                    "user_id": user_id,
                    "chat_session": {"$exists": True}
                },
                {
                    "$push": {"chat_session.messages": message},
                    "$set": {
                        "chat_session.updated_at": datetime.utcnow().isoformat(),
                        "updated_at": datetime.utcnow().isoformat()
                    }
                }
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            logger.error(f"Error adding chat message atomically: {e}")
            raise DatabaseError(f"Failed to add chat message: {e}")

    async def clear_chat_messages(self, document_id: str, user_id: str) -> bool:
        """Clear all messages from the chat session while keeping the session."""
        try:
            documents_collection = self._get_collection("documents")
            
            result = await documents_collection.update_one(
                {
                    "id": document_id,
                    "user_id": user_id,
                    "chat_session": {"$exists": True}
                },
                {
                    "$set": {
                        "chat_session.messages": [],
                        "chat_session.updated_at": datetime.utcnow().isoformat(),
                        "updated_at": datetime.utcnow().isoformat()
                    }
                }
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            logger.error(f"Error clearing chat messages: {e}")
            return False

    # Analytics operations
    async def get_user_analytics(self, user_id: str) -> Dict[str, Any]:
        """Get analytics data for user."""
        try:
            documents_collection = self._get_collection("documents")
            
            # Aggregate user statistics
            pipeline = [
                {"$match": {"user_id": user_id}},
                {"$group": {
                    "_id": "$user_id",
                    "total_documents": {"$sum": 1},
                    "total_clauses": {"$sum": {"$size": {"$ifNull": ["$clauses", []]}}},
                    "avg_risk_score": {"$avg": "$avg_risk_score"},
                    "last_upload": {"$max": "$created_at"}
                }}
            ]
            
            result = await documents_collection.aggregate(pipeline).to_list(1)
            
            if result:
                return result[0]
            else:
                return {
                    "total_documents": 0,
                    "total_clauses": 0,
                    "avg_risk_score": 0.0,
                    "last_upload": None
                }
        except Exception as e:
            logger.error(f"Error getting user analytics: {e}")
            raise DatabaseError(f"Failed to get user analytics: {e}")

    # User interaction operations
    async def get_user_interactions(self, document_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user interactions for a document."""
        try:
            interactions_collection = self._get_collection("user_interactions")
            interaction_doc = await interactions_collection.find_one({
                "document_id": document_id,
                "user_id": user_id
            })
            
            if interaction_doc:
                return interaction_doc.get("interactions", {})
            return None
            
        except Exception as e:
            logger.error(f"Error getting user interactions: {e}")
            raise DatabaseError(f"Failed to get user interactions: {e}")
    
    async def save_user_interactions(self, document_id: str, user_id: str, interactions: Dict[str, Any]) -> bool:
        """Save user interactions for a document."""
        try:
            interactions_collection = self._get_collection("user_interactions")
            
            # Use upsert to create or update the document
            result = await interactions_collection.update_one(
                {
                    "document_id": document_id,
                    "user_id": user_id
                },
                {
                    "$set": {
                        "interactions": interactions,
                        "updated_at": datetime.now().isoformat()
                    },
                    "$setOnInsert": {
                        "created_at": datetime.now().isoformat()
                    }
                },
                upsert=True
            )
            
            return result.acknowledged
            
        except Exception as e:
            logger.error(f"Error saving user interactions: {e}")
            raise DatabaseError(f"Failed to save user interactions: {e}")

    async def execute_query(self, query: str, params: Optional[Dict[str, Any]] = None) -> Any:
        """Execute raw MongoDB query (for advanced operations)."""
        try:
            if not self.database:
                raise ConnectionError("Database not connected")
            
            # For MongoDB, we'll interpret the query as a collection name and operation
            # This is a simplified implementation - in practice, you might want to support
            # more complex query structures
            logger.warning("execute_query called with raw query - this is a simplified implementation")
            
            # Return empty result for now - this method is primarily for compatibility
            return {"result": "Query executed", "query": query, "params": params}
            
        except Exception as e:
            logger.error(f"Error executing query: {e}")
            raise DatabaseError(f"Failed to execute query: {e}")
