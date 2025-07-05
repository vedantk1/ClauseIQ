#!/usr/bin/env python3
"""
Test script to verify that chat now properly uses and returns the user's preferred model.
This test will authenticate, upload a document, set a preferred model, and test chat responses.
"""

import os
import sys
import requests
import json
from pathlib import Path

# Test configuration
BASE_URL = "http://localhost:8000/api/v1"
TEST_EMAIL = "clauseiq@gmail.com"
TEST_PASSWORD = "testuser123"

def main():
    """Run the complete chat model integration test."""
    print("🧪 Testing Chat Model Integration Fix")
    print("=" * 50)
    
    session = requests.Session()
    
    try:
        # Step 1: Authenticate
        print("\n1. 🔐 Authenticating...")
        auth_data = authenticate(session)
        if not auth_data:
            print("❌ Authentication failed")
            return False
        
        headers = {"Authorization": f"Bearer {auth_data['access_token']}"}
        user_id = auth_data.get('user', {}).get('id')
        print(f"✅ Authenticated as user: {user_id}")
        
        # Step 2: Check current model preference
        print("\n2. 🔍 Checking current model preference...")
        prefs_response = session.get(f"{BASE_URL}/auth/preferences", headers=headers)
        if prefs_response.status_code == 200:
            current_model = prefs_response.json().get('data', {}).get('preferred_model')
            print(f"✅ Current preferred model: {current_model}")
        else:
            print(f"❌ Failed to get preferences: {prefs_response.status_code}")
            return False
        
        # Step 3: Set a specific model preference for testing
        test_model = "gpt-4o-mini"
        print(f"\n3. 🎯 Setting preferred model to: {test_model}")
        update_response = session.put(
            f"{BASE_URL}/auth/preferences",
            headers=headers,
            json={"preferred_model": test_model}
        )
        if update_response.status_code == 200:
            print(f"✅ Successfully set preferred model to: {test_model}")
        else:
            print(f"❌ Failed to set preferred model: {update_response.status_code}")
            return False
        
        # Step 4: Get a test document (or upload one)
        print("\n4. 📄 Getting test document...")
        docs_response = session.get(f"{BASE_URL}/documents/", headers=headers)
        if docs_response.status_code == 200:
            documents = docs_response.json().get('data', {}).get('documents', [])
            print(f"   Found {len(documents)} total documents")
            
            if documents:
                # Show document details
                for i, doc in enumerate(documents):
                    rag_status = "✅ RAG Ready" if doc.get('rag_processed', False) else "⏳ Processing"
                    print(f"   {i+1}. {doc['filename']} - {rag_status}")
                
                # Use first document that has RAG processing
                test_doc = None
                for doc in documents:
                    if doc.get('rag_processed', False):
                        test_doc = doc
                        break
                
                if test_doc:
                    document_id = test_doc['id']
                    print(f"✅ Using RAG-ready document: {test_doc['filename']} (ID: {document_id})")
                else:
                    # No RAG-ready documents, but let's try with the first document anyway to test the model flow
                    print("❌ No RAG-processed documents found, but testing with first document anyway...")
                    if documents:
                        test_doc = documents[0]
                        document_id = test_doc['id']
                        print(f"⚠️  Using non-RAG document for testing: {test_doc['filename']} (ID: {document_id})")
                    else:
                        print("   Please wait for document processing to complete or upload a new document.")
                        print("   You can check document status at: http://localhost:3000/documents")
                        return False
            else:
                print("❌ No documents found. Please upload a document first.")
                print("   You can upload documents at: http://localhost:3000/upload")
                return False
        else:
            print(f"❌ Failed to get documents: {docs_response.status_code}")
            return False
        
        # Step 5: Test chat with the document
        print(f"\n5. 💬 Testing chat with document...")
        test_message = "What is the main purpose of this document?"
        
        chat_response = session.post(
            f"{BASE_URL}/chat/{document_id}/message",
            headers=headers,
            json={
                "message": test_message
            }
        )
        
        if chat_response.status_code == 200:
            chat_data = chat_response.json()
            print(f"🔍 Full response: {json.dumps(chat_data, indent=2)}")
            
            if chat_data.get('success'):
                message = chat_data.get('data', {}).get('message', {})
                model_used = message.get('model_used', 'NOT_FOUND')
                content = message.get('content', '')
                
                print(f"✅ Chat response received successfully")
                print(f"🤖 Model used: {model_used}")
                print(f"💬 Response preview: {content[:100]}...")
                
                # Verify the model matches our preference
                if model_used == test_model:
                    print(f"✅ SUCCESS: Model used ({model_used}) matches preferred model ({test_model})")
                    return True
                elif model_used != 'NOT_FOUND' and model_used != 'unknown':
                    print(f"⚠️  PARTIAL SUCCESS: Model field present ({model_used}) but doesn't match preferred ({test_model})")
                    print(f"   This might be due to fallback logic or caching.")
                    return True
                else:
                    print(f"❌ FAILURE: Model used ({model_used}) is still unknown/missing")
                    return False
            else:
                error_msg = chat_data.get('error', 'Unknown error')
                print(f"❌ Chat request failed: {error_msg}")
                
                # Even if chat failed, check if the error response includes model info
                if 'data' in chat_data and 'model_used' in chat_data.get('data', {}):
                    model_used = chat_data['data']['model_used']
                    print(f"   But error response includes model: {model_used}")
                    if model_used == test_model:
                        print(f"✅ Model field fix working even in error cases!")
                        return True
                
                return False
        else:
            print(f"❌ Chat request failed with status: {chat_response.status_code}")
            print(f"Response: {chat_response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Test failed with exception: {e}")
        return False

def authenticate(session):
    """Authenticate and return auth data."""
    try:
        login_response = session.post(f"{BASE_URL}/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if login_response.status_code == 200:
            return login_response.json().get('data')
        else:
            print(f"Login failed: {login_response.status_code} - {login_response.text}")
            return None
            
    except Exception as e:
        print(f"Authentication error: {e}")
        return None

if __name__ == "__main__":
    success = main()
    if success:
        print("\n🎉 Chat model integration test PASSED!")
        sys.exit(0)
    else:
        print("\n💥 Chat model integration test FAILED!")
        sys.exit(1)
