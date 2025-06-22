#!/usr/bin/env python3
"""
Simple HTTP test to verify the note editing API endpoint
"""
import requests
import json
import time

# Backend URL
BASE_URL = "http://localhost:8000"

def test_note_editing_api():
    """Test the note editing API endpoint"""
    
    print("🧪 [TEST] Testing note editing API endpoint...")
    
    # Test data
    document_id = "test_doc_id"
    clause_id = "test_clause_id"
    note_id = "test_note_id"
    updated_text = "This is an updated test note"
    
    # Create test headers (in a real scenario, we'd need proper auth)
    headers = {
        "Content-Type": "application/json",
        "Authorization": "Bearer test_token"  # This would normally be a real JWT
    }
    
    # Test the update note endpoint
    update_url = f"{BASE_URL}/api/v1/analysis/documents/{document_id}/interactions/{clause_id}/notes/{note_id}"
    payload = {"text": updated_text}
    
    print(f"📡 [TEST] Making PUT request to: {update_url}")
    print(f"📋 [TEST] Payload: {payload}")
    
    try:
        response = requests.put(update_url, json=payload, headers=headers, timeout=10)
        
        print(f"📊 [TEST] Response status: {response.status_code}")
        print(f"📄 [TEST] Response headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            response_data = response.json()
            print(f"✅ [TEST] Success response: {json.dumps(response_data, indent=2)}")
            
            # Check if the response contains the updated note
            if "data" in response_data and "note" in response_data["data"]:
                note = response_data["data"]["note"]
                print(f"📝 [TEST] Returned note: {note}")
                
                if note and note.get("text") == updated_text:
                    print("🎉 [TEST] SUCCESS: API returned correct updated note!")
                else:
                    print("❌ [TEST] FAILURE: API returned incorrect note data!")
            else:
                print("❌ [TEST] FAILURE: API response missing note data!")
        
        elif response.status_code == 401:
            print("🔒 [TEST] Expected: Authentication required (401)")
            print("📄 [TEST] This is normal - the API requires proper authentication")
        
        else:
            print(f"❌ [TEST] Unexpected status code: {response.status_code}")
            print(f"📄 [TEST] Response: {response.text}")
    
    except requests.exceptions.RequestException as e:
        print(f"❌ [TEST] Request failed: {str(e)}")

if __name__ == "__main__":
    test_note_editing_api()
