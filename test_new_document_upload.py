#!/usr/bin/env python3
"""
Test document upload and RAG processing by uploading a new document.
"""
import requests
import json
import os
import tempfile

def test_document_upload_and_rag():
    base_url = "http://localhost:8000"
    
    # Login credentials
    auth_data = {
        'email': 'clauseiq@gmail.com',
        'password': 'testuser123'
    }
    
    try:
        print("🔐 Logging in...")
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
        
        # Use existing PDF file
        pdf_file_path = "/Users/vedan/Projects/clauseiq-project/docs/Suggestions/Interactive PDF Viewer Options.pdf"
        
        if not os.path.exists(pdf_file_path):
            print(f"❌ PDF file not found: {pdf_file_path}")
            return
        
        try:
            print(f"📄 Uploading test document...")
            headers = {'Authorization': f'Bearer {token}'}
            
            # Upload via the analyze endpoint
            with open(pdf_file_path, 'rb') as file:
                files = {'file': ('test_pdf_viewer.pdf', file, 'application/pdf')}
                
                upload_response = requests.post(
                    f'{base_url}/api/v1/analysis/analyze-document/', 
                    headers=headers,
                    files=files
                )
            
            print(f"Upload response status: {upload_response.status_code}")
            
            if upload_response.status_code == 200:
                upload_data = upload_response.json()
                
                if upload_data.get('success'):
                    doc_data = upload_data['data']
                    doc_id = doc_data.get('id')
                    
                    print(f"✅ Document uploaded successfully!")
                    print(f"   Document ID: {doc_id}")
                    print(f"   Filename: {doc_data.get('filename')}")
                    
                    # Now check if it has RAG processing flags by fetching document list
                    print(f"\\n🔍 Checking RAG processing status...")
                    docs_response = requests.get(f'{base_url}/api/v1/documents/', headers=headers)
                    
                    if docs_response.status_code == 200:
                        docs_data = docs_response.json()
                        if docs_data.get('success'):
                            documents = docs_data['data']['documents']
                            
                            # Find our uploaded document
                            our_doc = None
                            for doc in documents:
                                if doc.get('id') == doc_id:
                                    our_doc = doc
                                    break
                            
                            if our_doc:
                                print(f"✅ Found uploaded document in list:")
                                print(f"   RAG Processed: {our_doc.get('rag_processed', 'NOT SET')}")
                                print(f"   Pinecone Stored: {our_doc.get('pinecone_stored', 'NOT SET')}")
                                
                                if our_doc.get('rag_processed') == True:
                                    print(f"🎉 SUCCESS: Document was properly RAG processed!")
                                else:
                                    print(f"❌ FAILED: Document was NOT RAG processed!")
                                    
                                # Let's also check the detailed document view
                                detail_response = requests.get(f'{base_url}/api/v1/documents/{doc_id}', headers=headers)
                                if detail_response.status_code == 200:
                                    detail_data = detail_response.json()
                                    if detail_data.get('success'):
                                        doc_detail = detail_data['data']
                                        print(f"\\n📋 Detailed document info:")
                                        print(f"   RAG Processed: {doc_detail.get('rag_processed', 'NOT SET')}")
                                        print(f"   Pinecone Stored: {doc_detail.get('pinecone_stored', 'NOT SET')}")
                                        print(f"   Chunk Count: {doc_detail.get('chunk_count', 'NOT SET')}")
                                        print(f"   Embedding Model: {doc_detail.get('embedding_model', 'NOT SET')}")
                            else:
                                print(f"❌ Could not find uploaded document in list!")
                        else:
                            print(f"❌ Documents fetch unsuccessful: {docs_data}")
                    else:
                        print(f"❌ Failed to fetch documents: {docs_response.status_code} - {docs_response.text}")
                else:
                    print(f"❌ Upload unsuccessful: {upload_data}")
            else:
                print(f"❌ Upload failed: {upload_response.status_code} - {upload_response.text}")
                
        except Exception as inner_e:
            print(f"❌ Error during upload: {inner_e}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_document_upload_and_rag()
