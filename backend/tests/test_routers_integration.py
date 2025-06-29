"""
Integration tests for the modernized API routers with new service layer
"""
import pytest
import json
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch, MagicMock
from backend.main import app
from clauseiq_types.common import Document, DocumentStatus

client = TestClient(app)


class TestAnalysisRouterIntegration:
    """Integration tests for the analysis router with new service layer"""
    
    @patch('backend.routers.analysis.get_database_service')
    @patch('backend.routers.analysis.get_current_user')
    async def test_upload_document_success(self, mock_get_user, mock_get_db):
        """Test successful document upload with new API response format"""
        # Mock user
        mock_user = {"id": "user-1", "email": "test@example.com"}
        mock_get_user.return_value = mock_user
        
        # Mock database service
        mock_db_service = AsyncMock()
        mock_document = Document(
            id="doc-1",
            name="test.pdf",
            file_size=1024,
            status=DocumentStatus.UPLOADED,
            user_id="user-1"
        )
        mock_db_service.create_document.return_value = mock_document
        mock_get_db.return_value = mock_db_service
        
        # Create test file
        test_file = ("test.pdf", b"test content", "application/pdf")
        
        response = client.post(
            "/api/v1/documents/upload",
            files={"file": test_file},
            headers={"Authorization": "Bearer test-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify new API response format
        assert data["success"] is True
        assert data["data"]["id"] == "doc-1"
        assert data["data"]["name"] == "test.pdf"
        assert data["data"]["status"] == "uploaded"
        assert "correlation_id" in data
        assert data["error"] is None
    
    @patch('backend.routers.analysis.get_database_service')
    @patch('backend.routers.analysis.get_current_user')
    async def test_upload_document_failure(self, mock_get_user, mock_get_db):
        """Test document upload failure with standardized error response"""
        mock_user = {"id": "user-1", "email": "test@example.com"}
        mock_get_user.return_value = mock_user
        
        # Mock database service to raise exception
        mock_db_service = AsyncMock()
        mock_db_service.create_document.side_effect = Exception("Database error")
        mock_get_db.return_value = mock_db_service
        
        test_file = ("test.pdf", b"test content", "application/pdf")
        
        response = client.post(
            "/api/v1/documents/upload",
            files={"file": test_file},
            headers={"Authorization": "Bearer test-token"}
        )
        
        assert response.status_code == 500
        data = response.json()
        
        # Verify standardized error response
        assert data["success"] is False
        assert data["data"] is None
        assert data["error"]["code"] == "UPLOAD_FAILED"
        assert "Database error" in data["error"]["message"]
        assert "correlation_id" in data
    
    @patch('backend.routers.analysis.get_database_service')
    @patch('backend.routers.analysis.get_current_user')
    async def test_get_documents_paginated(self, mock_get_user, mock_get_db):
        """Test paginated document retrieval with new response format"""
        mock_user = {"id": "user-1", "email": "test@example.com"}
        mock_get_user.return_value = mock_user
        
        # Mock database service
        mock_db_service = AsyncMock()
        mock_documents = [
            Document(
                id=f"doc-{i}",
                name=f"document{i}.pdf",
                file_size=1024 * i,
                status=DocumentStatus.ANALYZED,
                user_id="user-1"
            ) for i in range(1, 6)
        ]
        mock_db_service.get_user_documents.return_value = (mock_documents, 5)
        mock_get_db.return_value = mock_db_service
        
        response = client.get(
            "/api/v1/documents?page=1&page_size=10",
            headers={"Authorization": "Bearer test-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify paginated response format
        assert data["success"] is True
        assert len(data["data"]) == 5
        assert data["meta"]["pagination"]["page"] == 1
        assert data["meta"]["pagination"]["total_items"] == 5
        assert data["meta"]["pagination"]["has_next"] is False
        assert "correlation_id" in data
    
    @patch('backend.routers.analysis.get_database_service')
    @patch('backend.routers.analysis.get_current_user')
    async def test_analyze_document_success(self, mock_get_user, mock_get_db):
        """Test successful document analysis with async service layer"""
        mock_user = {"id": "user-1", "email": "test@example.com"}
        mock_get_user.return_value = mock_user
        
        # Mock database service
        mock_db_service = AsyncMock()
        mock_document = Document(
            id="doc-1",
            name="test.pdf",
            status=DocumentStatus.UPLOADED,
            user_id="user-1"
        )
        mock_db_service.get_document.return_value = mock_document
        
        # Mock analysis result
        mock_analysis = {
            "id": "analysis-1",
            "document_id": "doc-1",
            "clauses": [
                {"id": "clause-1", "text": "Test clause", "type": "liability"}
            ],
            "status": "completed"
        }
        mock_db_service.create_analysis.return_value = mock_analysis
        mock_get_db.return_value = mock_db_service
        
        response = client.post(
            "/api/v1/documents/doc-1/analyze",
            headers={"Authorization": "Bearer test-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify analysis response
        assert data["success"] is True
        assert data["data"]["id"] == "analysis-1"
        assert data["data"]["document_id"] == "doc-1"
        assert len(data["data"]["clauses"]) == 1
        assert "correlation_id" in data


class TestAnalyticsRouterIntegration:
    """Integration tests for the analytics router"""
    
    @patch('backend.routers.analytics.get_database_service')
    @patch('backend.routers.analytics.get_current_user')
    async def test_get_analytics_success(self, mock_get_user, mock_get_db):
        """Test analytics endpoint with new response format"""
        mock_user = {"id": "user-1", "email": "test@example.com"}
        mock_get_user.return_value = mock_user
        
        # Mock database service
        mock_db_service = AsyncMock()
        mock_analytics = {
            "total_documents": 10,
            "total_clauses": 150,
            "clause_distribution": {
                "liability": 45,
                "termination": 30,
                "payment": 25,
                "confidentiality": 50
            },
            "recent_activity": []
        }
        mock_db_service.get_user_analytics.return_value = mock_analytics
        mock_get_db.return_value = mock_db_service
        
        response = client.get(
            "/api/v1/analytics",
            headers={"Authorization": "Bearer test-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify analytics response format
        assert data["success"] is True
        assert data["data"]["total_documents"] == 10
        assert data["data"]["total_clauses"] == 150
        assert "clause_distribution" in data["data"]
        assert "correlation_id" in data
    
    @patch('backend.routers.analytics.get_database_service')
    @patch('backend.routers.analytics.get_current_user')
    async def test_get_analytics_filtered(self, mock_get_user, mock_get_db):
        """Test analytics with date range filtering"""
        mock_user = {"id": "user-1", "email": "test@example.com"}
        mock_get_user.return_value = mock_user
        
        mock_db_service = AsyncMock()
        mock_analytics = {
            "total_documents": 5,
            "total_clauses": 75,
            "clause_distribution": {"liability": 25, "payment": 50},
            "recent_activity": []
        }
        mock_db_service.get_user_analytics.return_value = mock_analytics
        mock_get_db.return_value = mock_db_service
        
        response = client.get(
            "/api/v1/analytics?start_date=2023-01-01&end_date=2023-12-31",
            headers={"Authorization": "Bearer test-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["total_documents"] == 5


class TestHealthRouterIntegration:
    """Integration tests for the health router"""
    
    @patch('backend.routers.health.get_database_service')
    async def test_health_check_success(self, mock_get_db):
        """Test health check with database connectivity"""
        mock_db_service = AsyncMock()
        mock_db_service.check_connection.return_value = True
        mock_db_service.get_migration_status.return_value = {
            "current_version": "v1.2.0",
            "pending_migrations": 0,
            "last_migration": "2023-01-01T00:00:00Z"
        }
        mock_get_db.return_value = mock_db_service
        
        response = client.get("/api/v1/health")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify health response format
        assert data["success"] is True
        assert data["data"]["status"] == "healthy"
        assert data["data"]["database"]["connected"] is True
        assert "migration_status" in data["data"]["database"]
        assert "correlation_id" in data
    
    @patch('backend.routers.health.get_database_service')
    async def test_health_check_database_failure(self, mock_get_db):
        """Test health check when database is down"""
        mock_db_service = AsyncMock()
        mock_db_service.check_connection.return_value = False
        mock_get_db.return_value = mock_db_service
        
        response = client.get("/api/v1/health")
        
        assert response.status_code == 503
        data = response.json()
        
        # Verify unhealthy response
        assert data["success"] is False
        assert data["error"]["code"] == "SERVICE_UNAVAILABLE"
        assert "database" in data["error"]["message"].lower()
    
    async def test_health_liveness(self):
        """Test simple liveness probe"""
        response = client.get("/api/v1/health/live")
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["status"] == "alive"


class TestVersionedResponseMiddleware:
    """Integration tests for versioned API responses"""
    
    @patch('backend.routers.analysis.get_current_user')
    async def test_api_version_header(self, mock_get_user):
        """Test that API version is included in response headers"""
        mock_user = {"id": "user-1", "email": "test@example.com"}
        mock_get_user.return_value = mock_user
        
        response = client.get(
            "/api/v1/documents",
            headers={"Authorization": "Bearer test-token"}
        )
        
        # Verify version headers
        assert "X-API-Version" in response.headers
        assert response.headers["X-API-Version"] == "1.0"
    
    async def test_correlation_id_tracking(self):
        """Test that correlation IDs are properly tracked"""
        response1 = client.get("/api/v1/health/live")
        response2 = client.get("/api/v1/health/live")
        
        data1 = response1.json()
        data2 = response2.json()
        
        # Each request should have a unique correlation ID
        assert "correlation_id" in data1
        assert "correlation_id" in data2
        assert data1["correlation_id"] != data2["correlation_id"]


class TestErrorHandling:
    """Integration tests for standardized error handling"""
    
    async def test_validation_error_format(self):
        """Test that validation errors follow standard format"""
        # Send invalid data to trigger validation error
        response = client.post(
            "/api/v1/documents/upload",
            data={"invalid": "data"},
            headers={"Authorization": "Bearer test-token"}
        )
        
        assert response.status_code == 422
        data = response.json()
        
        # Verify standardized error format
        assert data["success"] is False
        assert data["data"] is None
        assert data["error"]["code"] == "VALIDATION_ERROR"
        assert "correlation_id" in data
    
    async def test_not_found_error_format(self):
        """Test 404 errors follow standard format"""
        response = client.get("/api/v1/nonexistent-endpoint")
        
        assert response.status_code == 404
        data = response.json()
        
        assert data["success"] is False
        assert data["error"]["code"] == "NOT_FOUND"
        assert "correlation_id" in data
    
    @patch('backend.routers.analysis.get_current_user')
    async def test_unauthorized_error_format(self, mock_get_user):
        """Test unauthorized errors follow standard format"""
        mock_get_user.side_effect = Exception("Invalid token")
        
        response = client.get(
            "/api/v1/documents",
            headers={"Authorization": "Bearer invalid-token"}
        )
        
        assert response.status_code == 401
        data = response.json()
        
        assert data["success"] is False
        assert data["error"]["code"] == "UNAUTHORIZED"
        assert "correlation_id" in data


@pytest.fixture
def mock_database_service():
    """Fixture for mocking database service across tests"""
    with patch('backend.services.database.DatabaseService') as mock:
        yield mock


@pytest.fixture
def mock_auth_service():
    """Fixture for mocking authentication service"""
    with patch('backend.services.auth.get_current_user') as mock:
        mock.return_value = {"id": "test-user", "email": "test@example.com"}
        yield mock
