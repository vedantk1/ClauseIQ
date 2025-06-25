#!/usr/bin/env python3
"""
Test the new PDF file storage system.
"""
import asyncio
import sys
import os

# Add backend to path
sys.path.append('/Users/vedan/Downloads/clauseiq-project/backend')

from services.file_storage_service import get_file_storage_service
from database.service import get_document_service
from config.logging import get_foundational_logger

logger = get_foundational_logger("pdf_storage_test")

async def test_pdf_storage():
    """Test the PDF storage functionality."""
    try:
        print("🧪 Testing PDF Storage System...")
        
        # Test 1: Initialize file storage service
        print("\n📊 Test 1: Initialize file storage service")
        file_storage = get_file_storage_service()
        
        init_result = await file_storage.initialize()
        if init_result:
            print("✅ File storage service initialized successfully")
        else:
            print("❌ Failed to initialize file storage service")
            return
        
        # Test 2: Health check
        print("\n📊 Test 2: Health check")
        health = await file_storage.health_check()
        print(f"   Status: {health.get('status')}")
        print(f"   Max file size: {health.get('max_file_size_mb')} MB")
        print(f"   Allowed types: {health.get('allowed_content_types')}")
        
        # Test 3: Store a small test PDF
        print("\n📊 Test 3: Store test PDF file")
        test_pdf_data = b"%PDF-1.4 test content"  # Minimal PDF-like data
        test_user_id = "test-user-123"
        
        try:
            file_id = await file_storage.store_file(
                file_data=test_pdf_data,
                filename="test_document.pdf",
                content_type="application/pdf",
                user_id=test_user_id,
                metadata={"test": True}
            )
            print(f"✅ Test PDF stored with ID: {file_id}")
            
            # Test 4: Retrieve file metadata
            print("\n📊 Test 4: Retrieve file metadata")
            metadata = await file_storage.get_file_metadata(file_id, test_user_id)
            if metadata:
                print(f"✅ Metadata retrieved:")
                print(f"   Filename: {metadata.get('filename')}")
                print(f"   Size: {metadata.get('file_size')} bytes")
                print(f"   Content type: {metadata.get('content_type')}")
                print(f"   Checksum: {metadata.get('checksum')}")
            else:
                print("❌ Failed to retrieve metadata")
            
            # Test 5: Check file existence
            print("\n📊 Test 5: Check file existence")
            exists = await file_storage.file_exists(file_id, test_user_id)
            print(f"✅ File exists: {exists}")
            
            # Test 6: Test user isolation (try to access with wrong user)
            print("\n📊 Test 6: Test user isolation")
            wrong_user_metadata = await file_storage.get_file_metadata(file_id, "wrong-user")
            if wrong_user_metadata is None:
                print("✅ User isolation working - wrong user cannot access file")
            else:
                print("❌ User isolation failed - wrong user can access file")
            
            # Test 7: Delete file
            print("\n📊 Test 7: Delete test file")
            deleted = await file_storage.delete_file(file_id, test_user_id)
            if deleted:
                print("✅ Test file deleted successfully")
                
                # Verify deletion
                exists_after = await file_storage.file_exists(file_id, test_user_id)
                print(f"   File exists after deletion: {exists_after}")
            else:
                print("❌ Failed to delete test file")
            
        except ValueError as e:
            print(f"⚠️ Validation error (expected for test data): {e}")
        except Exception as e:
            print(f"❌ Error in file operations: {e}")
        
        # Test 8: Document service integration
        print("\n📊 Test 8: Document service integration")
        doc_service = get_document_service()
        
        # Create a test document
        test_doc_id = "test-doc-123"
        test_doc = {
            "id": test_doc_id,
            "filename": "integration_test.pdf",
            "text": "This is test document text",
            "user_id": test_user_id
        }
        
        try:
            # Save document
            await doc_service.save_document_for_user(test_doc, test_user_id)
            print("✅ Test document created")
            
            # Test PDF storage through document service
            real_pdf_data = b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj xref 0 4 0000000000 65535 f 0000000009 00000 n 0000000058 00000 n 0000000115 00000 n trailer<</Size 4/Root 1 0 R>>startxref 169 %%EOF"
            
            pdf_stored = await doc_service.store_pdf_file(
                document_id=test_doc_id,
                user_id=test_user_id,
                file_data=real_pdf_data,
                filename="integration_test.pdf"
            )
            
            if pdf_stored:
                print("✅ PDF stored through document service")
                
                # Test retrieval
                has_pdf = await doc_service.has_pdf_file(test_doc_id, test_user_id)
                print(f"   Document has PDF: {has_pdf}")
                
                # Test metadata and stream
                metadata, stream = await doc_service.get_pdf_file_stream(test_doc_id, test_user_id)
                if metadata and stream:
                    print("✅ PDF metadata and stream retrieved")
                    print(f"   Filename: {metadata.get('filename')}")
                    print(f"   Size: {metadata.get('file_size')} bytes")
                else:
                    print("❌ Failed to get PDF metadata and stream")
            else:
                print("❌ Failed to store PDF through document service")
            
            # Clean up test document
            await doc_service.delete_document_for_user(test_doc_id, test_user_id)
            print("✅ Test document cleaned up")
            
        except Exception as e:
            print(f"❌ Document service integration error: {e}")
            import traceback
            traceback.print_exc()
        
        print("\n✅ PDF storage system test completed!")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_pdf_storage())
