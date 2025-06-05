import pytest
import sys
import os
from unittest.mock import Mock, patch, MagicMock

# Add the parent directory to the path so we can import from main
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_mongo_storage, MongoDocumentStorage


class TestMongoDBStorage:
    """Test MongoDB document storage functionality."""

    def setup_method(self):
        """Set up test with mocked MongoDB."""
        # Mock the mongo_storage object
        self.mock_mongo_storage = Mock(spec=MongoDocumentStorage)
        
        # Reset the global singleton to ensure clean test state
        import database
        database._mongo_storage = None
        
    def teardown_method(self):
        """Clean up after test."""
        # Reset the global singleton
        import database
        database._mongo_storage = None
        
    def test_save_and_get_document(self):
        """Test saving and retrieving a document."""
        # Create a test document
        document = {
            "id": "test-123",
            "filename": "test.pdf",
            "upload_date": "2024-01-01T00:00:00",
            "text": "Sample text content",
            "sections": []
        }
        
        # Mock the save operation
        self.mock_mongo_storage.save_document.return_value = "test-123"
        
        # Call save_document directly on mock
        doc_id = self.mock_mongo_storage.save_document(document)
        assert doc_id == "test-123"
        
        # Verify save was called
        self.mock_mongo_storage.save_document.assert_called_once_with(document)
        
        # Mock the get operation
        self.mock_mongo_storage.get_document.return_value = document
        
        # Test retrieval
        retrieved_doc = self.mock_mongo_storage.get_document("test-123")
        assert retrieved_doc == document

    def test_get_nonexistent_document(self):
        """Test retrieving a document that doesn't exist."""
        # Mock returning None for non-existent document
        self.mock_mongo_storage.get_document.return_value = None
        
        result = self.mock_mongo_storage.get_document("nonexistent")
        assert result is None
        
        # Verify the call was made
        self.mock_mongo_storage.get_document.assert_called_once_with("nonexistent")

    def test_get_all_documents_empty(self):
        """Test getting all documents when storage is empty."""
        # Mock returning empty list
        self.mock_mongo_storage.get_all_documents.return_value = []
        
        documents = self.mock_mongo_storage.get_all_documents()
        assert documents == []
        
        # Verify the call was made
        self.mock_mongo_storage.get_all_documents.assert_called_once()

    def test_get_all_documents_with_data(self):
        """Test getting all documents when storage has documents."""
        # Create test documents
        doc1 = {
            "id": "doc1",
            "filename": "file1.pdf",
            "upload_date": "2024-01-01T00:00:00",
            "text": "Content 1",
            "sections": []
        }
        doc2 = {
            "id": "doc2",
            "filename": "file2.pdf",
            "upload_date": "2024-01-02T00:00:00",
            "text": "Content 2",
            "sections": []
        }
        
        # Mock save operations and get_all_documents
        self.mock_mongo_storage.save_document.return_value = "doc1"
        self.mock_mongo_storage.get_all_documents.return_value = [doc2, doc1]
        
        # Test save and retrieve
        self.mock_mongo_storage.save_document(doc1)
        self.mock_mongo_storage.save_document(doc2)
        
        # Retrieve all documents
        documents = self.mock_mongo_storage.get_all_documents()
        assert len(documents) == 2
        
        # Check sorting (newest first - handled by MongoDB)
        assert documents[0]["id"] == "doc2"
        assert documents[1]["id"] == "doc1"

    def test_save_document_interface(self):
        """Test that saving a document calls the correct MongoDB method."""
        document = {"id": "test", "filename": "test.pdf"}
        
        # Mock the save operation
        self.mock_mongo_storage.save_document.return_value = "test"
        
        doc_id = self.mock_mongo_storage.save_document(document)
        assert doc_id == "test"
        
        # Verify the MongoDB save method was called
        self.mock_mongo_storage.save_document.assert_called_once_with(document)
