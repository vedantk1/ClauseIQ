#!/usr/bin/env python3
"""
Test to check document RAG processing status using proper API endpoints.
"""
import requests
import json
import sys
import os

# Add the backend directory to Python path
backend_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend')
sys.path.append(backend_path)

def test_document_status():
    base_url = "http://localhost:8000"
    
    # Login credentials
    auth_data = {
        'email': 'clauseiq@gmail.com',
        'password': 'testuser123'
    }
    
    try:
        print("🔐 Logging in...")
        # Login to get token (using /api/v1/auth/login based on OpenAPI spec)
        response = requests.post(f'{base_url}/api/v1/auth/login', json=auth_data)
        
        if response.status_code != 200:
            print(f"❌ Login failed: {response.status_code} - {response.text}")
            return
            
        token_data = response.json()
        if not token_data.get('success'):
            print(f"❌ Login unsuccessful: {token_data}")
            return
            
        token = token_data['data']['access_token']
        print(f"✅ Got auth token: {token[:50]}...")
        
        # Get documents list
        print("\n📄 Fetching documents...")
        headers = {'Authorization': f'Bearer {token}'}
        docs_response = requests.get(f'{base_url}/api/v1/documents/', headers=headers)
        
        if docs_response.status_code != 200:
            print(f"❌ Failed to get documents: {docs_response.status_code} - {docs_response.text}")
            return
            
        docs_data = docs_response.json()
        if not docs_data.get('success'):
            print(f"❌ Documents fetch unsuccessful: {docs_data}")
            return
            
        documents = docs_data['data']['documents']
        print(f"✅ Found {len(documents)} documents")
        
        # Check each document's RAG status
        print("\n🔍 Document RAG Processing Status:")
        print("=" * 80)
        
        for i, doc in enumerate(documents[:10], 1):  # Show first 10
            print(f"\n{i}. {doc.get('filename', 'Unknown filename')}")
            print(f"   📄 ID: {doc.get('id', 'No ID')}")
            print(f"   📅 Upload Date: {doc.get('upload_date', 'No date')}")
            
            # Check RAG processing status
            rag_processed = doc.get('rag_processed', 'Not set')
            if rag_processed == True:
                print(f"   ✅ RAG Processed: {rag_processed}")
            elif rag_processed == False:
                print(f"   ❌ RAG Processed: {rag_processed}")
            else:
                print(f"   ⚠️  RAG Processed: {rag_processed} (field missing or unexpected value)")
            
            # Check Pinecone storage status
            pinecone_stored = doc.get('pinecone_stored', 'Not set')
            if pinecone_stored == True:
                print(f"   ✅ Pinecone Stored: {pinecone_stored}")
            elif pinecone_stored == False:
                print(f"   ❌ Pinecone Stored: {pinecone_stored}")
            else:
                print(f"   ⚠️  Pinecone Stored: {pinecone_stored} (field missing or unexpected value)")
            
            # Show other relevant fields
            if 'content_preview' in doc:
                preview = doc['content_preview'][:100] + "..." if len(doc['content_preview']) > 100 else doc['content_preview']
                print(f"   📝 Content Preview: {preview}")
            
            if 'file_size' in doc:
                print(f"   📊 File Size: {doc['file_size']} bytes")
        
        # Summary
        rag_processed_count = sum(1 for doc in documents if doc.get('rag_processed') == True)
        pinecone_stored_count = sum(1 for doc in documents if doc.get('pinecone_stored') == True)
        
        print(f"\n📊 SUMMARY:")
        print(f"   Total Documents: {len(documents)}")
        print(f"   RAG Processed: {rag_processed_count}/{len(documents)}")
        print(f"   Pinecone Stored: {pinecone_stored_count}/{len(documents)}")
        
        if rag_processed_count < len(documents):
            print(f"\n⚠️  WARNING: {len(documents) - rag_processed_count} documents are NOT RAG processed!")
            print("   This means users can't chat with these documents effectively.")
        
        if pinecone_stored_count < len(documents):
            print(f"\n⚠️  WARNING: {len(documents) - pinecone_stored_count} documents are NOT stored in Pinecone!")
            print("   This means RAG retrieval won't work for these documents.")
        
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to backend server. Is it running on localhost:8000?")
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_document_status()
