"""
Database module for MongoDB operations.
Handles connection, document storage, and retrieval operations.
"""
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime
from pymongo import MongoClient, DESCENDING
from pymongo.errors import ConnectionFailure, PyMongoError, DuplicateKeyError
from config import MONGODB_URI, MONGODB_DATABASE, MONGODB_COLLECTION

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Available AI models for user selection
AVAILABLE_MODELS = [
    "gpt-3.5-turbo",
    "gpt-4.1-mini", 
    "gpt-4.1-nano",
    "gpt-4o-mini",
    "gpt-4o"
]

DEFAULT_MODEL = "gpt-3.5-turbo"

class MongoDBConnection:
    """Singleton MongoDB connection handler."""
    _instance = None
    _client = None
    _db = None
    _collection = None
    _users_collection = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(MongoDBConnection, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        if self._client is None:
            self.connect()

    def connect(self):
        """Establish MongoDB connection."""
        try:
            self._client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
            # Test the connection
            self._client.admin.command('ismaster')
            self._db = self._client[MONGODB_DATABASE]
            self._collection = self._db[MONGODB_COLLECTION]
            
            # Create indexes for better performance
            self._collection.create_index("id", unique=True)
            self._collection.create_index([("upload_date", DESCENDING)])
            
            # Create users collection and indexes
            self._users_collection = self._db["users"]
            self._users_collection.create_index("email", unique=True)
            self._users_collection.create_index("id", unique=True)
            
            logger.info(f"Successfully connected to MongoDB: {MONGODB_DATABASE}")
        except ConnectionFailure as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error connecting to MongoDB: {e}")
            raise

    @property
    def collection(self):
        """Get the documents collection."""
        if self._collection is None:
            self.connect()
        return self._collection

    @property
    def users_collection(self):
        """Get the users collection."""
        if self._users_collection is None:
            self.connect()
        return self._users_collection

    def close(self):
        """Close MongoDB connection."""
        if self._client:
            self._client.close()
            self._client = None
            self._db = None
            self._collection = None
            logger.info("MongoDB connection closed")

class MongoDocumentStorage:
    """MongoDB-based document storage class."""
    
    def __init__(self):
        self._db = None

    @property
    def db(self):
        """Lazy initialization of MongoDB connection."""
        if self._db is None:
            self._db = MongoDBConnection()
        return self._db

    def save_document(self, document_dict: Dict[str, Any]) -> str:
        """
        Save document to MongoDB.
        
        Args:
            document_dict: Document data to save
            
        Returns:
            str: Document ID
            
        Raises:
            PyMongoError: If database operation fails
        """
        try:
            doc_id = document_dict.get('id')
            if not doc_id:
                raise ValueError("Document must have an 'id' field")
            
            # Add timestamp if not present
            if 'upload_date' not in document_dict:
                document_dict['upload_date'] = datetime.utcnow().isoformat()
            
            # Insert or update document
            result = self.db.collection.replace_one(
                {"id": doc_id},
                document_dict,
                upsert=True
            )
            
            if result.upserted_id or result.modified_count > 0:
                logger.info(f"Document {doc_id} saved successfully")
                return doc_id
            else:
                logger.warning(f"No changes made to document {doc_id}")
                return doc_id
                
        except PyMongoError as e:
            logger.error(f"Error saving document {doc_id}: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error saving document: {e}")
            raise

    def save_document_for_user(self, document_dict: Dict[str, Any], user_id: str) -> str:
        """
        Save document to MongoDB with user_id association.
        
        Args:
            document_dict: Document data to save
            user_id: ID of the user who owns this document
            
        Returns:
            str: Document ID
            
        Raises:
            PyMongoError: If database operation fails
        """
        try:
            doc_id = document_dict.get('id')
            if not doc_id:
                raise ValueError("Document must have an 'id' field")
            
            # Ensure the user_id is set in the document
            document_dict['user_id'] = user_id
            
            # Add timestamp if not present
            if 'upload_date' not in document_dict:
                document_dict['upload_date'] = datetime.utcnow().isoformat()
            
            # Insert or update document
            result = self.db.collection.replace_one(
                {"id": doc_id},
                document_dict,
                upsert=True
            )
            
            if result.upserted_id or result.modified_count > 0:
                logger.info(f"Document {doc_id} saved successfully for user {user_id}")
                return doc_id
            else:
                logger.warning(f"No changes made to document {doc_id} for user {user_id}")
                return doc_id
                
        except PyMongoError as e:
            logger.error(f"Error saving document {doc_id} for user {user_id}: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error saving document for user: {e}")
            raise

    def get_document(self, doc_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve document by ID.
        
        Args:
            doc_id: Document ID to retrieve
            
        Returns:
            Dict containing document data or None if not found
        """
        try:
            document = self.db.collection.find_one({"id": doc_id})
            if document:
                # Remove MongoDB's internal _id field
                document.pop('_id', None)
                logger.info(f"Document {doc_id} retrieved successfully")
            else:
                logger.info(f"Document {doc_id} not found")
            
            return document
            
        except PyMongoError as e:
            logger.error(f"Error retrieving document {doc_id}: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error retrieving document: {e}")
            raise

    def get_all_documents(self) -> List[Dict[str, Any]]:
        """
        Retrieve all documents, sorted by upload date (newest first).
        
        Returns:
            List of all documents
        """
        try:
            cursor = self.db.collection.find({}).sort("upload_date", DESCENDING)
            documents = []
            
            for doc in cursor:
                # Remove MongoDB's internal _id field
                doc.pop('_id', None)
                documents.append(doc)
            
            logger.info(f"Retrieved {len(documents)} documents")
            return documents
            
        except PyMongoError as e:
            logger.error(f"Error retrieving all documents: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error retrieving documents: {e}")
            raise

    def delete_document(self, doc_id: str) -> bool:
        """
        Delete document by ID.
        
        Args:
            doc_id: Document ID to delete
            
        Returns:
            bool: True if document was deleted, False if not found
        """
        try:
            result = self.db.collection.delete_one({"id": doc_id})
            
            if result.deleted_count > 0:
                logger.info(f"Document {doc_id} deleted successfully")
                return True
            else:
                logger.info(f"Document {doc_id} not found for deletion")
                return False
                
        except PyMongoError as e:
            logger.error(f"Error deleting document {doc_id}: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error deleting document: {e}")
            raise

    def get_documents_count(self) -> int:
        """
        Get total number of documents.
        
        Returns:
            int: Total document count
        """
        try:
            count = self.db.collection.count_documents({})
            logger.info(f"Total documents count: {count}")
            return count
            
        except PyMongoError as e:
            logger.error(f"Error getting document count: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error getting document count: {e}")
            raise

    # User Management Methods
    
    def create_user(self, user_data: Dict[str, Any]) -> str:
        """
        Create a new user.
        
        Args:
            user_data: User data dictionary with id, email, hashed_password, etc.
            
        Returns:
            str: User ID
            
        Raises:
            ValueError: If user already exists
            PyMongoError: If database operation fails
        """
        try:
            user_id = user_data.get('id')
            if not user_id:
                raise ValueError("User must have an 'id' field")
            
            # Add creation timestamp
            user_data['created_at'] = datetime.utcnow().isoformat()
            user_data['updated_at'] = datetime.utcnow().isoformat()
            
            # Add default model preference if not provided
            if 'preferred_model' not in user_data:
                user_data['preferred_model'] = DEFAULT_MODEL
            
            # Insert user
            result = self.db.users_collection.insert_one(user_data)
            
            if result.inserted_id:
                logger.info(f"User {user_id} created successfully with preferred model: {user_data['preferred_model']}")
                return user_id
            else:
                raise Exception("Failed to create user")
                
        except DuplicateKeyError as e:
            logger.error(f"User with email {user_data.get('email')} already exists")
            raise ValueError("User with this email already exists")
        except PyMongoError as e:
            logger.error(f"Error creating user {user_id}: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error creating user: {e}")
            raise

    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve user by email.
        
        Args:
            email: User email
            
        Returns:
            Dict containing user data or None if not found
        """
        try:
            user = self.db.users_collection.find_one({"email": email})
            if user:
                # Remove MongoDB's internal _id field
                user.pop('_id', None)
                logger.info(f"User with email {email} retrieved successfully")
            else:
                logger.info(f"User with email {email} not found")
            
            return user
            
        except PyMongoError as e:
            logger.error(f"Error retrieving user by email {email}: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error retrieving user by email: {e}")
            raise

    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve user by ID.
        
        Args:
            user_id: User ID
            
        Returns:
            Dict containing user data or None if not found
        """
        try:
            user = self.db.users_collection.find_one({"id": user_id})
            if user:
                # Remove MongoDB's internal _id field
                user.pop('_id', None)
                logger.info(f"User {user_id} retrieved successfully")
            else:
                logger.info(f"User {user_id} not found")
            
            return user
            
        except PyMongoError as e:
            logger.error(f"Error retrieving user {user_id}: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error retrieving user: {e}")
            raise

    def update_user(self, user_id: str, update_data: Dict[str, Any]) -> bool:
        """
        Update user data.
        
        Args:
            user_id: User ID
            update_data: Data to update
            
        Returns:
            bool: True if user was updated, False if not found
        """
        try:
            # Add update timestamp
            update_data['updated_at'] = datetime.utcnow().isoformat()
            
            result = self.db.users_collection.update_one(
                {"id": user_id},
                {"$set": update_data}
            )
            
            if result.modified_count > 0:
                logger.info(f"User {user_id} updated successfully")
                return True
            else:
                logger.info(f"User {user_id} not found for update")
                return False
                
        except PyMongoError as e:
            logger.error(f"Error updating user {user_id}: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error updating user: {e}")
            raise

    def update_user_password(self, email: str, new_hashed_password: str) -> bool:
        """
        Update user password by email.
        
        Args:
            email: User email
            new_hashed_password: New hashed password
            
        Returns:
            bool: True if password was updated, False if user not found
        """
        try:
            update_data = {
                'hashed_password': new_hashed_password,
                'updated_at': datetime.utcnow().isoformat()
            }
            
            result = self.db.users_collection.update_one(
                {"email": email},
                {"$set": update_data}
            )
            
            if result.modified_count > 0:
                logger.info(f"Password updated successfully for user with email {email}")
                return True
            else:
                logger.info(f"User with email {email} not found for password update")
                return False
                
        except PyMongoError as e:
            logger.error(f"Error updating password for user with email {email}: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error updating user password: {e}")
            raise

    def update_user_preferences(self, user_id: str, preferences: Dict[str, Any]) -> bool:
        """
        Update user preferences including preferred AI model.
        
        Args:
            user_id: User ID
            preferences: Dictionary containing user preferences (e.g., {'preferred_model': 'gpt-4o'})
            
        Returns:
            bool: True if preferences were updated, False if user not found
            
        Raises:
            ValueError: If preferred_model is not in AVAILABLE_MODELS
            PyMongoError: If database operation fails
        """
        try:
            # Validate preferred_model if provided
            if 'preferred_model' in preferences:
                if preferences['preferred_model'] not in AVAILABLE_MODELS:
                    raise ValueError(f"Invalid model. Must be one of: {', '.join(AVAILABLE_MODELS)}")
            
            # Add update timestamp
            preferences['updated_at'] = datetime.utcnow().isoformat()
            
            result = self.db.users_collection.update_one(
                {"id": user_id},
                {"$set": preferences}
            )
            
            if result.modified_count > 0:
                logger.info(f"Preferences updated successfully for user {user_id}: {preferences}")
                return True
            else:
                logger.info(f"User {user_id} not found for preference update")
                return False
                
        except ValueError:
            raise  # Re-raise validation errors
        except PyMongoError as e:
            logger.error(f"Error updating preferences for user {user_id}: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error updating user preferences: {e}")
            raise

    def get_user_preferred_model(self, user_id: str) -> str:
        """
        Get user's preferred AI model.
        
        Args:
            user_id: User ID
            
        Returns:
            str: User's preferred model, or DEFAULT_MODEL if not found/set
        """
        try:
            user = self.get_user_by_id(user_id)
            if user and 'preferred_model' in user:
                # Validate that the stored model is still available
                if user['preferred_model'] in AVAILABLE_MODELS:
                    return user['preferred_model']
                else:
                    logger.warning(f"User {user_id} has invalid preferred model {user['preferred_model']}, using default")
                    return DEFAULT_MODEL
            else:
                logger.info(f"No preferred model found for user {user_id}, using default")
                return DEFAULT_MODEL
                
        except Exception as e:
            logger.error(f"Error retrieving preferred model for user {user_id}: {e}")
            return DEFAULT_MODEL

    def get_documents_for_user(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Retrieve all documents for a specific user, sorted by upload date (newest first).
        
        Args:
            user_id: ID of the user whose documents to retrieve
            
        Returns:
            List of documents belonging to the user
        """
        try:
            cursor = self.db.collection.find({"user_id": user_id}).sort("upload_date", DESCENDING)
            documents = []
            
            for doc in cursor:
                # Remove MongoDB's internal _id field
                doc.pop('_id', None)
                documents.append(doc)
            
            logger.info(f"Retrieved {len(documents)} documents for user {user_id}")
            return documents
            
        except PyMongoError as e:
            logger.error(f"Error retrieving documents for user {user_id}: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error retrieving user documents: {e}")
            raise
    
    def get_document_for_user(self, doc_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve a document by ID for a specific user.
        
        Args:
            doc_id: Document ID to retrieve
            user_id: ID of the user who owns the document
            
        Returns:
            Dict containing document data or None if not found
        """
        try:
            document = self.db.collection.find_one({"id": doc_id, "user_id": user_id})
            if document:
                # Remove MongoDB's internal _id field
                document.pop('_id', None)
                logger.info(f"Document {doc_id} retrieved successfully for user {user_id}")
            else:
                logger.info(f"Document {doc_id} not found for user {user_id}")
            
            return document
            
        except PyMongoError as e:
            logger.error(f"Error retrieving document {doc_id} for user {user_id}: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error retrieving document for user: {e}")
            raise


# Global storage instance
_mongo_storage = None

def get_mongo_storage() -> MongoDocumentStorage:
    """
    Get global MongoDB storage instance (singleton pattern).
    
    Returns:
        MongoDocumentStorage: Singleton instance of MongoDB storage
    """
    global _mongo_storage
    if _mongo_storage is None:
        _mongo_storage = MongoDocumentStorage()
    return _mongo_storage

# Alias for backward compatibility - will be None until get_mongo_storage() is called
mongo_storage = None
