import pytest
import asyncio
import sys
import os

# Add the parent directory to the path so we can import from main
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from httpx import AsyncClient, ASGITransport
import tempfile
import shutil
from unittest.mock import patch, MagicMock

# Import the FastAPI app
from main import app

# Test client for synchronous tests
@pytest.fixture
def client():
    return TestClient(app)

# Async client for async tests
@pytest.fixture
async def async_client():
    async with AsyncClient(
        transport=ASGITransport(app=app), 
        base_url="http://testserver"
    ) as ac:
        yield ac

# Mock storage directory for tests
@pytest.fixture
def temp_storage():
    temp_dir = tempfile.mkdtemp()
    # We no longer patch STORAGE_DIR as it was removed from main.py
    yield temp_dir
    shutil.rmtree(temp_dir)

# Mock OpenAI client
@pytest.fixture
def mock_openai():
    with patch('main.openai_client') as mock_client:
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "Mock AI summary"
        mock_client.chat.completions.create.return_value = mock_response
        yield mock_client

# Sample PDF content for testing
@pytest.fixture
def sample_pdf_content():
    return b"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\nxref\n0 3\n0000000000 65535 f \ntrailer\n<<\n/Size 3\n/Root 1 0 R\n>>\nstartxref\n9\n%%EOF"

# Authentication fixtures for testing
@pytest.fixture
def test_user():
    """Create a test user for authentication tests."""
    return {
        "id": "test-user-123",
        "email": "test@example.com",
        "full_name": "Test User",
        "hashed_password": "$2b$12$mock.hashed.password"
    }

@pytest.fixture
def mock_auth(test_user):
    """Mock authentication to bypass JWT verification in tests."""
    # Override the dependency in the FastAPI app
    from main import app
    from auth import get_current_user
    
    def mock_get_current_user():
        return test_user
    
    # Override the dependency
    app.dependency_overrides[get_current_user] = mock_get_current_user
    yield mock_get_current_user
    
    # Clean up the override after the test
    if get_current_user in app.dependency_overrides:
        del app.dependency_overrides[get_current_user]

@pytest.fixture
def auth_headers():
    """Provide mock authorization headers for API requests."""
    return {"Authorization": "Bearer mock-jwt-token"}

# Mock MongoDB storage for tests
@pytest.fixture
def mock_mongo_storage():
    """Mock MongoDB storage operations for tests."""
    with patch('database.get_mongo_storage') as mock_storage, \
         patch('routers.documents.get_mongo_storage') as mock_router_storage:
        
        mock_storage_instance = MagicMock()
        
        # Configure methods for user-specific operations
        mock_storage_instance.get_documents_for_user.return_value = []
        mock_storage_instance.get_document_for_user.return_value = None
        mock_storage_instance.delete_document_for_user.return_value = True
        mock_storage_instance.delete_all_documents_for_user.return_value = 0
        mock_storage_instance.save_document_for_user.return_value = "test-doc-id"
        
        # Configure common storage methods for backward compatibility
        mock_storage_instance.save_document.return_value = True
        mock_storage_instance.get_document.return_value = None
        mock_storage_instance.get_all_documents.return_value = []
        mock_storage_instance.delete_document.return_value = True
        mock_storage_instance.get_documents_count.return_value = 0
        
        # Both patches return the same mock instance
        mock_storage.return_value = mock_storage_instance
        mock_router_storage.return_value = mock_storage_instance
        
        yield mock_storage_instance
