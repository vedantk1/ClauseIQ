#!/usr/bin/env python3
"""
Test script to authenticate and list documents to understand RAG processing status.
"""
import requests
import json
import sys
import os

# Add backend to path for imports
backend_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend')
sys.path.append(backend_path)

# API base URL
BASE_URL = "http://localhost:8000/api/v1"

def authenticate(email, password):
    """Authenticate and get access token."""
    login_data = {
        "email": email,
        "password": password
    }
    
    print(f"🔑 Authenticating as {email}...")
    response = requests.post(f"{BASE_URL}/login", json=login_data)
    
    if response.status_code == 200:
        data = response.json()
        if 'data' in data and 'access_token' in data['data']:
            token = data['data']['access_token']
            print("✅ Authentication successful!")
            return token
        else:
            print(f"❌ Unexpected response format: {data}")
            return None
    else:
        print(f"❌ Authentication failed: {response.status_code}")
        print(f"Response: {response.text}")
        return None

def list_documents(token):
    """List all documents for the authenticated user."""
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    print("📄 Fetching documents...")
    response = requests.get(f"{BASE_URL}/documents/", headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        if 'data' in data and 'documents' in data['data']:
            documents = data['data']['documents']
            print(f"✅ Found {len(documents)} documents")
            
            for i, doc in enumerate(documents, 1):
                print(f"\n📋 Document {i}:")
                print(f"  ID: {doc.get('id', 'N/A')}")
                print(f"  Filename: {doc.get('filename', 'N/A')}")
                print(f"  Upload Date: {doc.get('upload_date', 'N/A')}")
                print(f"  RAG Processed: {doc.get('rag_processed', 'Not set')}")
                print(f"  Pinecone Stored: {doc.get('pinecone_stored', 'Not set')}")
                print(f"  Content Length: {len(doc.get('content', ''))}")
                
                # Look for any other processing flags
                processing_fields = [k for k in doc.keys() if 'process' in k.lower() or 'rag' in k.lower() or 'pinecone' in k.lower()]
                if processing_fields:
                    print(f"  Processing Fields: {processing_fields}")
                    for field in processing_fields:
                        print(f"    {field}: {doc.get(field)}")
            
            return documents
        else:
            print(f"❌ Unexpected response format: {data}")
            return None
    else:
        print(f"❌ Failed to fetch documents: {response.status_code}")
        print(f"Response: {response.text}")
        return None

def check_document_detail(token, document_id):
    """Get detailed information about a specific document."""
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    print(f"🔍 Fetching details for document {document_id}...")
    response = requests.get(f"{BASE_URL}/documents/{document_id}", headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        if 'data' in data:
            doc = data['data']
            print(f"✅ Document details:")
            print(json.dumps(doc, indent=2, default=str))
            return doc
        else:
            print(f"❌ Unexpected response format: {data}")
            return None
    else:
        print(f"❌ Failed to fetch document details: {response.status_code}")
        print(f"Response: {response.text}")
        return None

def main():
    email = "clauseiq@gmail.com"
    password = "testuser123"
    
    # Authenticate
    token = authenticate(email, password)
    if not token:
        print("❌ Could not authenticate")
        return
    
    # List documents
    documents = list_documents(token)
    if not documents:
        print("❌ Could not fetch documents")
        return
    
    # Check details of first document if available
    if documents:
        first_doc_id = documents[0].get('id')
        if first_doc_id:
            check_document_detail(token, first_doc_id)

if __name__ == "__main__":
    main()
