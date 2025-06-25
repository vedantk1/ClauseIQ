#!/usr/bin/env python3
"""
Test PDF storage integration end-to-end.
"""
import asyncio
import uuid
from datetime import datetime
from database.service import get_document_service

async def test_pdf_integration():
    """Test PDF storage integration with document workflow."""
    try:
        service = get_document_service()
        
        # Test data
        user_id = str(uuid.uuid4())
        document_id = str(uuid.uuid4())
        test_pdf_content = b"Test PDF content for integration test"
        filename = "test_contract.pdf"
        
        print(f"Testing PDF integration with user_id: {user_id}")
        print(f"Document ID: {document_id}")
        
        # Step 1: Create a mock document first
        document_data = {
            "id": document_id,
            "filename": filename,
            "upload_date": datetime.now().isoformat(),
            "text": "Test contract text",
            "user_id": user_id,
            "clauses": [],
            "risk_summary": {"high": 0, "medium": 0, "low": 0}
        }
        
        print("1. Creating document...")
        await service.save_document_for_user(document_data, user_id)
        print("✓ Document created successfully")
        
        # Step 2: Store PDF file for the document
        print("2. Storing PDF file...")
        pdf_stored = await service.store_pdf_file(
            document_id=document_id,
            user_id=user_id,
            file_data=test_pdf_content,
            filename=filename,
            content_type="application/pdf"
        )
        
        if pdf_stored:
            print("✓ PDF file stored successfully")
        else:
            print("✗ Failed to store PDF file")
            return False
        
        # Step 3: Check if document has PDF file
        print("3. Checking if document has PDF...")
        has_pdf = await service.has_pdf_file(document_id, user_id)
        if has_pdf:
            print("✓ Document has PDF file")
        else:
            print("✗ Document does not have PDF file")
            return False
        
        # Step 4: Get PDF file stream
        print("4. Testing PDF file stream...")
        metadata, stream = await service.get_pdf_file_stream(document_id, user_id)
        
        if metadata and stream:
            print("✓ PDF file stream retrieved successfully")
            print(f"  - Filename: {metadata.get('filename')}")
            print(f"  - Content Type: {metadata.get('content_type')}")
            print(f"  - File Size: {metadata.get('file_size')} bytes")
            
            # Read from stream to verify content
            content_chunks = []
            async for chunk in stream:
                content_chunks.append(chunk)
            
            retrieved_content = b''.join(content_chunks)
            if retrieved_content == test_pdf_content:
                print("✓ PDF content matches original")
            else:
                print("✗ PDF content does not match original")
                return False
                
        else:
            print("✗ Failed to get PDF file stream")
            return False
        
        # Step 5: Clean up - delete document (should also delete PDF)
        print("5. Cleaning up...")
        deleted = await service.delete_document_for_user(document_id, user_id)
        if deleted:
            print("✓ Document and PDF file deleted successfully")
        else:
            print("✗ Failed to delete document")
        
        print("\n🎉 All PDF integration tests passed!")
        return True
        
    except Exception as e:
        print(f"❌ PDF integration test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    asyncio.run(test_pdf_integration())
