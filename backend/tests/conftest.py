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
