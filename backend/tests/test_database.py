import pytest
import sys
import os
from unittest.mock import Mock, patch, MagicMock
from pymongo.errors import ConnectionFailure, PyMongoError

# Add the parent directory to the path so we can import from database
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database.service import DocumentService, MongoDocumentStorage


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



