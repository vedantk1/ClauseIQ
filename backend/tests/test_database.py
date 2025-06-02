import pytest
import sys
import os
from unittest.mock import Mock, patch, MagicMock
from pymongo.errors import ConnectionFailure, PyMongoError

# Add the parent directory to the path so we can import from database
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import MongoDBConnection, MongoDocumentStorage


class TestMongoDBConnection:
    """Test MongoDB connection functionality."""

    def setup_method(self):
        """Set up test with fresh connection instance."""
        # Reset the singleton instance for each test
        MongoDBConnection._instance = None
        MongoDBConnection._client = None
        MongoDBConnection._db = None
        MongoDBConnection._collection = None

    @patch('database.MongoClient')
    def test_connection_success(self, mock_client):
        """Test successful MongoDB connection."""
        # Mock successful connection
        mock_client_instance = Mock()
        mock_client.return_value = mock_client_instance
        mock_client_instance.admin.command.return_value = {'ok': 1}
        
        mock_db = Mock()
        mock_collection = Mock()
        # Mock the __getitem__ method for database access
        mock_client_instance.__getitem__ = Mock(return_value=mock_db)
        mock_db.__getitem__ = Mock(return_value=mock_collection)
        
        # Create connection
        conn = MongoDBConnection()
        
        # Verify connection was established
        mock_client.assert_called_once()
        mock_client_instance.admin.command.assert_called_once_with('ismaster')
        
        # Verify indexes were created
        mock_collection.create_index.assert_called()

    @patch('database.MongoClient')
    def test_connection_failure(self, mock_client):
        """Test MongoDB connection failure."""
        # Mock connection failure
        mock_client.side_effect = ConnectionFailure("Connection failed")
        
        # Verify that ConnectionFailure is raised
        with pytest.raises(ConnectionFailure):
            MongoDBConnection()

    @patch('database.MongoClient')
    def test_singleton_pattern(self, mock_client):
        """Test that MongoDBConnection follows singleton pattern."""
        # Mock successful connection
        mock_client_instance = Mock()
        mock_client.return_value = mock_client_instance
        mock_client_instance.admin.command.return_value = {'ok': 1}
        
        mock_db = Mock()
        mock_collection = Mock()
        # Mock the __getitem__ method for database access
        mock_client_instance.__getitem__ = Mock(return_value=mock_db)
        mock_db.__getitem__ = Mock(return_value=mock_collection)
        
        # Create two instances
        conn1 = MongoDBConnection()
        conn2 = MongoDBConnection()
        
        # Verify they are the same instance
        assert conn1 is conn2
        
        # Verify MongoClient was only called once
        assert mock_client.call_count == 1


class TestMongoDocumentStorage:
    """Test MongoDB document storage functionality."""

    def setup_method(self):
        """Set up test with mocked MongoDB connection."""
        self.mock_db = Mock()
        self.mock_collection = Mock()
        self.mock_db.collection = self.mock_collection
        
        # Create storage instance and mock the database using patch
        self.storage = MongoDocumentStorage()
        # Set the private attribute directly for testing
        self.storage._db = self.mock_db

    def test_save_document_success(self):
        """Test successful document save."""
        document = {
            "id": "test-123",
            "filename": "test.pdf",
            "text": "Sample content"
        }
        
        # Mock successful save
        mock_result = Mock()
        mock_result.upserted_id = "new_id"
        mock_result.modified_count = 0
        self.mock_collection.replace_one.return_value = mock_result
        
        # Save document
        doc_id = self.storage.save_document(document)
        
        # Verify save was called correctly
        assert doc_id == "test-123"
        self.mock_collection.replace_one.assert_called_once()
        
        # Verify the call arguments
        call_args = self.mock_collection.replace_one.call_args
        assert call_args[0][0] == {"id": "test-123"}  # Filter
        assert call_args[0][1]["id"] == "test-123"     # Document
        assert call_args[1]["upsert"] is True          # Options

    def test_save_document_missing_id(self):
        """Test saving document without ID raises error."""
        document = {"filename": "test.pdf", "text": "Sample content"}
        
        with pytest.raises(ValueError, match="Document must have an 'id' field"):
            self.storage.save_document(document)

    def test_save_document_database_error(self):
        """Test handling of database errors during save."""
        document = {"id": "test-123", "filename": "test.pdf"}
        
        # Mock database error
        self.mock_collection.replace_one.side_effect = PyMongoError("Database error")
        
        with pytest.raises(PyMongoError):
            self.storage.save_document(document)

    def test_get_document_success(self):
        """Test successful document retrieval."""
        doc_data = {
            "_id": "mongo_id",
            "id": "test-123",
            "filename": "test.pdf",
            "text": "Sample content"
        }
        
        # Mock successful retrieval
        self.mock_collection.find_one.return_value = doc_data
        
        # Get document
        result = self.storage.get_document("test-123")
        
        # Verify result
        assert result["id"] == "test-123"
        assert "_id" not in result  # MongoDB _id should be removed
        self.mock_collection.find_one.assert_called_once_with({"id": "test-123"})

    def test_get_document_not_found(self):
        """Test retrieving non-existent document."""
        # Mock document not found
        self.mock_collection.find_one.return_value = None
        
        # Get document
        result = self.storage.get_document("nonexistent")
        
        # Verify result
        assert result is None
        self.mock_collection.find_one.assert_called_once_with({"id": "nonexistent"})

    def test_get_all_documents_success(self):
        """Test retrieving all documents."""
        doc1 = {"_id": "id1", "id": "doc1", "upload_date": "2024-01-01"}
        doc2 = {"_id": "id2", "id": "doc2", "upload_date": "2024-01-02"}
        
        # Mock cursor
        mock_cursor = Mock()
        mock_cursor.__iter__ = Mock(return_value=iter([doc1, doc2]))
        mock_cursor.sort.return_value = mock_cursor
        self.mock_collection.find.return_value = mock_cursor
        
        # Get all documents
        result = self.storage.get_all_documents()
        
        # Verify result
        assert len(result) == 2
        assert all("_id" not in doc for doc in result)  # MongoDB _id should be removed
        self.mock_collection.find.assert_called_once_with({})

    def test_delete_document_success(self):
        """Test successful document deletion."""
        # Mock successful deletion
        mock_result = Mock()
        mock_result.deleted_count = 1
        self.mock_collection.delete_one.return_value = mock_result
        
        # Delete document
        result = self.storage.delete_document("test-123")
        
        # Verify result
        assert result is True
        self.mock_collection.delete_one.assert_called_once_with({"id": "test-123"})

    def test_delete_document_not_found(self):
        """Test deleting non-existent document."""
        # Mock document not found
        mock_result = Mock()
        mock_result.deleted_count = 0
        self.mock_collection.delete_one.return_value = mock_result
        
        # Delete document
        result = self.storage.delete_document("nonexistent")
        
        # Verify result
        assert result is False
        self.mock_collection.delete_one.assert_called_once_with({"id": "nonexistent"})

    def test_get_documents_count_success(self):
        """Test getting document count."""
        # Mock count
        self.mock_collection.count_documents.return_value = 5
        
        # Get count
        result = self.storage.get_documents_count()
        
        # Verify result
        assert result == 5
        self.mock_collection.count_documents.assert_called_once_with({})
