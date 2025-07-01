#!/usr/bin/env python3
"""
Test script for highlight endpoints - Phase 1 verification
"""
import requests
import json
import sys

BASE_URL = "http://localhost:8000"

def test_highlight_endpoints():
    """Test the highlight CRUD endpoints."""
    print("🧪 Testing PDF Highlight Endpoints - Phase 1")
    print("=" * 50)
    
    # Get auth token first
    print("🔐 Getting authentication token...")
    auth_response = requests.post(
        f"{BASE_URL}/api/v1/auth/login",
        headers={"Content-Type": "application/json"},
        json={
            "email": "clauseiq@gmail.com",
            "password": "testuser123"
        }
    )
    
    if auth_response.status_code != 200:
        print(f"❌ Failed to authenticate: {auth_response.text}")
        return
    
    auth_data = auth_response.json()
    if not auth_data.get("success"):
        print(f"❌ Authentication failed: {auth_data}")
        return
    
    token = auth_data["data"]["access_token"]
    user_id = auth_data["data"]["user"]["id"]
    print(f"✅ Authentication successful! User ID: {user_id}")
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    }
    
    document_id = "89045d1d-f620-414b-a1c1-4e159c264561"  # Use existing document
    
    # Test 1: Create a highlight
    print("\n1️⃣ Testing CREATE highlight...")
    highlight_data = {
        "content": "This is test highlighted text",
        "comment": "Test comment about this clause",
        "areas": [
            {
                "height": 20,
                "left": 100,
                "page_index": 0,
                "top": 200,
                "width": 300
            }
        ]
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/v1/highlights/documents/{document_id}/highlights",
            headers=headers,
            json=highlight_data
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            if result.get("success"):
                highlight_id = result["data"]["highlight"]["id"]
                print(f"✅ Highlight created successfully! ID: {highlight_id}")
                
                # Test 2: Get highlights
                print("\n2️⃣ Testing GET highlights...")
                get_response = requests.get(
                    f"{BASE_URL}/api/v1/highlights/documents/{document_id}/highlights",
                    headers=headers
                )
                print(f"Status: {get_response.status_code}")
                get_result = get_response.json()
                if get_result.get("success"):
                    highlights = get_result["data"]["highlights"]
                    print(f"✅ Retrieved {len(highlights)} highlights")
                    for h in highlights:
                        print(f"   - {h['id']}: {h['comment']}")
                else:
                    print(f"❌ Failed to get highlights: {get_result}")
                
                # Test 3: Update highlight
                print("\n3️⃣ Testing UPDATE highlight...")
                update_data = {
                    "comment": "Updated comment with more details"
                }
                update_response = requests.put(
                    f"{BASE_URL}/api/v1/highlights/documents/{document_id}/highlights/{highlight_id}",
                    headers=headers,
                    json=update_data
                )
                print(f"Status: {update_response.status_code}")
                if update_response.status_code == 200:
                    print("✅ Highlight updated successfully!")
                else:
                    print(f"❌ Failed to update: {update_response.text}")
                
                # Test 4: Delete highlight
                print("\n4️⃣ Testing DELETE highlight...")
                delete_response = requests.delete(
                    f"{BASE_URL}/api/v1/highlights/documents/{document_id}/highlights/{highlight_id}",
                    headers=headers
                )
                print(f"Status: {delete_response.status_code}")
                if delete_response.status_code == 200:
                    print("✅ Highlight deleted successfully!")
                else:
                    print(f"❌ Failed to delete: {delete_response.text}")
                    
            else:
                print(f"❌ API returned error: {result}")
        else:
            print(f"❌ HTTP Error: {response.status_code}")
            print(f"Response: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to backend. Is it running on http://localhost:8000?")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    print("\n" + "=" * 50)
    print("🏁 Test completed!")

if __name__ == "__main__":
    test_highlight_endpoints()
