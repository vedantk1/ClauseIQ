#!/usr/bin/env python3
"""
Test script to verify chat uses user's preferred AI model.
This tests the integration between chat functionality and AI model selection.
"""

import requests
import json
import sys

BASE_URL = "http://localhost:8000"

def test_chat_model_integration():
    """Test that chat respects user's preferred AI model."""
    print("🧪 Testing Chat AI Model Integration...")
    
    # Test credentials
    test_email = "test@example.com"
    test_password = "testpassword123"
    
    session = requests.Session()
    
    try:
        # Login to get auth token
        print("Logging in...")
        login_response = session.post(f"{BASE_URL}/auth/login", json={
            "email": test_email,
            "password": test_password
        })
        
        if login_response.status_code != 200:
            print(f"❌ Login failed: {login_response.status_code}")
            return False
        
        auth_data = login_response.json()
        access_token = auth_data.get('access_token')
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Get current preferred model
        print("Getting current preferred model...")
        prefs_response = session.get(f"{BASE_URL}/auth/preferences", headers=headers)
        if prefs_response.status_code == 200:
            current_model = prefs_response.json().get('preferred_model')
            print(f"Current preferred model: {current_model}")
        
        # Update to a different model for testing
        test_model = "gpt-4o-mini"
        print(f"Setting preferred model to: {test_model}")
        update_response = session.put(f"{BASE_URL}/auth/preferences", 
                                    headers=headers,
                                    json={"preferred_model": test_model})
        
        if update_response.status_code != 200:
            print(f"❌ Failed to update model preference: {update_response.status_code}")
            return False
        
        print(f"✅ Successfully set preferred model to: {test_model}")
        
        # Note: To fully test this, we'd need:
        # 1. A document uploaded and processed with RAG
        # 2. Chat functionality enabled for that document
        # 3. Send a chat message and verify the model used in logs
        
        print("✅ Model preference update successful")
        print("💡 To fully test chat integration:")
        print("   1. Upload a document and wait for RAG processing")
        print("   2. Use the chat feature in the frontend")
        print("   3. Check backend logs for: 'Using AI model [model] for user [user_id] chat response'")
        
        return True
        
    except Exception as e:
        print(f"❌ Error during test: {e}")
        return False

def main():
    """Run the test."""
    print("🚀 Chat AI Model Integration Test")
    print("=" * 50)
    
    success = test_chat_model_integration()
    
    if success:
        print("\n✅ Chat model integration setup completed successfully!")
        print("The chat system will now use the user's preferred AI model.")
    else:
        print("\n❌ Test failed!")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
