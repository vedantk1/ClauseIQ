"""
Database module for MongoDB operations.
Handles connection, document storage, and retrieval operations.
"""
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime
from pymongo import MongoClient, DESCENDING
from pymongo.errors import ConnectionFailure, PyMongoError
from config import MONGODB_URI, MONGODB_DATABASE, MONGODB_COLLECTION

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MongoDBConnection:
    """Singleton MongoDB connection handler."""
    _instance = None
    _client = None
    _db = None
    _collection = None

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

# Global instance - connection will be established on first use
mongo_storage = None

def get_mongo_storage():
    """Get or create the global MongoDB storage instance."""
    global mongo_storage
    if mongo_storage is None:
        mongo_storage = MongoDocumentStorage()
    return mongo_storage
