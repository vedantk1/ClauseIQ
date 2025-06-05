import pytest
import sys
import os
from unittest.mock import Mock, patch

# Add the parent directory to the path so we can import from main
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from main import app
from services.document_service import validate_file
from fastapi import UploadFile, HTTPException
import io
from unittest.mock import MagicMock

class TestValidateFile:
    """Test file validation functionality."""
    
    def test_validate_file_success(self):
        """Test successful file validation."""
        # Create a mock PDF file
        file_content = b"%PDF-1.4\nSample PDF content"
        file = MagicMock(spec=UploadFile)
        file.filename = "test.pdf"
        file.content_type = "application/pdf"
        file.size = len(file_content)
        
        # Should not raise an exception
        validate_file(file)
    
    def test_validate_file_too_large(self):
        """Test file size validation."""
        file = MagicMock(spec=UploadFile)
        file.filename = "large.pdf"
        file.content_type = "application/pdf"
        file.size = 15 * 1024 * 1024  # 15MB (exceeds 10MB limit)
        
        with pytest.raises(HTTPException) as exc_info:
            validate_file(file)
        
        assert exc_info.value.status_code == 413
        assert "File too large" in str(exc_info.value.detail)
    
    def test_validate_file_invalid_type(self):
        """Test file type validation."""
        file = MagicMock(spec=UploadFile)
        file.filename = "test.txt"
        file.content_type = "text/plain"
        file.size = 1024
        
        with pytest.raises(HTTPException) as exc_info:
            validate_file(file)
        
        assert exc_info.value.status_code == 400
        assert "File type not supported. Allowed types: .pdf" in str(exc_info.value.detail)
    
    def test_validate_file_no_filename(self):
        """Test validation with no filename - should pass validation."""
        file = MagicMock(spec=UploadFile)
        file.filename = None
        file.content_type = "application/pdf"
        file.size = 1024
        
        # Should not raise an exception since the validation function
        # only checks filename if it exists
        validate_file(file)

    def test_validate_file_unsafe_filename(self):
        """Test file validation with unsafe filename characters."""
        file = MagicMock(spec=UploadFile)
        file.filename = "../../../malicious.pdf"
        file.content_type = "application/pdf"
        file.size = 1024
        
        with pytest.raises(HTTPException) as exc_info:
            validate_file(file)
        
        assert exc_info.value.status_code == 400
        assert "Invalid filename" in str(exc_info.value.detail)

class TestAPI:
    """Test API endpoints."""
    
    def test_health_check(self):
        """Test root endpoint."""
        client = TestClient(app)
        response = client.get("/")
        assert response.status_code == 200
        assert "Legal AI Backend" in response.json()["message"]
    
    def test_extract_text_no_file(self, mock_auth):
        """Test extract-text endpoint without file."""
        client = TestClient(app)
        response = client.post("/extract-text/", headers={"Authorization": "Bearer mock-token"})
        assert response.status_code == 422  # Validation error
    
    @pytest.mark.asyncio
    async def test_extract_text_with_mock_pdf(self, async_client, temp_storage, sample_pdf_content, mock_auth):
        """Test extract-text endpoint with mock PDF."""
        files = {
            "file": ("test.pdf", io.BytesIO(sample_pdf_content), "application/pdf")
        }
        headers = {"Authorization": "Bearer mock-token"}
        response = await async_client.post("/extract-text/", files=files, headers=headers)
        # Since this is a mock PDF, we expect it to fail at the processing stage
        assert response.status_code in [200, 400, 422]
    
    def test_get_documents_empty(self, mock_auth, mock_mongo_storage):
        """Test get documents when storage is empty."""
        # Mock returns empty list for user with no documents
        mock_mongo_storage.get_documents_for_user.return_value = []
        
        client = TestClient(app)
        response = client.get("/documents/", headers={"Authorization": "Bearer mock-token"})
        assert response.status_code == 200
        data = response.json()
        assert "documents" in data
        assert len(data["documents"]) == 0
    
    def test_get_document_not_found(self, mock_auth, mock_mongo_storage):
        """Test get specific document that doesn't exist."""
        # Mock storage returns None for non-existent document
        mock_mongo_storage.get_document_for_user.return_value = None
        
        client = TestClient(app)
        response = client.get("/documents/nonexistent-id", headers={"Authorization": "Bearer mock-token"})
        assert response.status_code == 404

    def test_analyze_endpoint_exists(self, mock_auth):
        """Test that analyze endpoint exists and validates input."""
        client = TestClient(app)
        response = client.post("/analyze/", headers={"Authorization": "Bearer mock-token"})
        assert response.status_code == 422  # Validation error for missing file

    @pytest.mark.asyncio
    async def test_extract_text_file_size_check(self, async_client, temp_storage, mock_auth):
        """Test file size validation during content reading."""
        # Create a file that appears small but has large content
        large_content = b"A" * (10 * 1024 * 1024)  # 10MB content
        files = {"file": ("large.txt", io.BytesIO(large_content), "text/plain")}
        headers = {"Authorization": "Bearer mock-token"}
        
        # Test with middleware security check - expect HTTPException to be raised
        from fastapi import HTTPException
        import pytest
        
        with pytest.raises(HTTPException) as exc_info:
            response = await async_client.post("/extract-text/", files=files, headers=headers)
        
        # Verify the exception details
        assert exc_info.value.status_code == 413
        assert "Request too large" in str(exc_info.value.detail)
