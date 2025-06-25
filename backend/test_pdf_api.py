#!/usr/bin/env python3
"""
Test API endpoints for PDF functionality.
"""
import asyncio
import uuid
import tempfile
import os
from datetime import datetime
from fastapi.testclient import TestClient
from main import app
from database.service import get_document_service

# Mock auth for testing
async def mock_get_current_user():
    return {
        "id": "test-user-123",
        "email": "test@example.com"
    }

def test_api_endpoints():
    """Test PDF API endpoints."""
    try:
        # Override auth dependency for testing
        from auth import get_current_user
        app.dependency_overrides[get_current_user] = mock_get_current_user
        
        client = TestClient(app)
        
        print("Testing PDF API endpoints...")
        
        # Test 1: Upload a document (this should store the PDF)
        print("1. Testing document upload with PDF storage...")
        
        # Create a mock PDF file
        test_pdf_content = b"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\nTest PDF content"
        
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp_file:
            tmp_file.write(test_pdf_content)
            tmp_file_path = tmp_file.name
        
        try:
            with open(tmp_file_path, "rb") as f:
                files = {"file": ("test_contract.pdf", f, "application/pdf")}
                response = client.post("/api/v1/analysis/analyze/", files=files)
            
            if response.status_code == 200:
                result = response.json()
                if result.get("success"):
                    document_id = result["data"]["id"]
                    print(f"✓ Document uploaded successfully: {document_id}")
                    
                    # Test 2: Check if PDF exists (HEAD request)
                    print("2. Testing PDF existence check...")
                    head_response = client.head(f"/api/v1/documents/{document_id}/pdf")
                    if head_response.status_code == 200:
                        print("✓ PDF exists - HEAD request successful")
                    else:
                        print(f"✗ PDF existence check failed: {head_response.status_code}")
                        return False
                    
                    # Test 3: Get PDF metadata
                    print("3. Testing PDF metadata endpoint...")
                    metadata_response = client.get(f"/api/v1/documents/{document_id}/pdf/metadata")
                    if metadata_response.status_code == 200:
                        metadata_result = metadata_response.json()
                        if metadata_result.get("success"):
                            print("✓ PDF metadata retrieved successfully")
                            print(f"  - Filename: {metadata_result['data'].get('filename')}")
                            print(f"  - File size: {metadata_result['data'].get('file_size')} bytes")
                        else:
                            print("✗ PDF metadata request failed")
                            return False
                    else:
                        print(f"✗ PDF metadata endpoint failed: {metadata_response.status_code}")
                        return False
                    
                    # Test 4: Download PDF
                    print("4. Testing PDF download...")
                    download_response = client.get(f"/api/v1/documents/{document_id}/pdf")
                    if download_response.status_code == 200:
                        content_type = download_response.headers.get("content-type")
                        content_length = download_response.headers.get("content-length")
                        print(f"✓ PDF download successful")
                        print(f"  - Content Type: {content_type}")
                        print(f"  - Content Length: {content_length}")
                        
                        # Verify content
                        downloaded_content = download_response.content
                        if len(downloaded_content) > 0:
                            print("✓ PDF content downloaded successfully")
                        else:
                            print("✗ Downloaded PDF content is empty")
                            return False
                    else:
                        print(f"✗ PDF download failed: {download_response.status_code}")
                        return False
                    
                    # Test 5: Clean up - delete document
                    print("5. Cleaning up...")
                    delete_response = client.delete(f"/api/v1/documents/{document_id}")
                    if delete_response.status_code == 200:
                        print("✓ Document deleted successfully")
                    else:
                        print(f"⚠️ Document deletion returned: {delete_response.status_code}")
                    
                    print("\n🎉 All API endpoint tests passed!")
                    return True
                else:
                    print(f"✗ Document upload failed: {result}")
                    return False
            else:
                print(f"✗ Document upload failed with status: {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
        finally:
            # Clean up temp file
            if os.path.exists(tmp_file_path):
                os.remove(tmp_file_path)
        
    except Exception as e:
        print(f"❌ API endpoint test failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        # Remove dependency override
        app.dependency_overrides.clear()

if __name__ == "__main__":
    test_api_endpoints()
