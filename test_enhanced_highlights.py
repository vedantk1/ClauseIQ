#!/usr/bin/env python3
"""
Test script for enhanced highlight functionality - Phase 2 verification
"""
import requests
import json
import sys

BASE_URL = "http://localhost:8000"

def test_enhanced_highlights():
    """Test the enhanced highlight functionality end-to-end."""
    print("🎨 Testing Enhanced PDF Highlight Management - Phase 2")
    print("=" * 60)
    
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
    
    # Test 1: Create multiple highlights to test management
    print("\n1️⃣ Creating multiple highlights for management testing...")
    highlights_created = []
    
    for i in range(3):
        highlight_data = {
            "content": f"Test highlighted text {i+1} for enhanced management",
            "comment": f"Original comment {i+1} - ready for editing",
            "areas": [
                {
                    "height": 20,
                    "left": 100 + (i * 50),
                    "page_index": 0,
                    "top": 200 + (i * 30),
                    "width": 300
                }
            ]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/v1/highlights/documents/{document_id}/highlights",
            headers=headers,
            json=highlight_data
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get("success"):
                highlight_id = result["data"]["highlight"]["id"]
                highlights_created.append(highlight_id)
                print(f"   ✅ Created highlight {i+1}: {highlight_id}")
            else:
                print(f"   ❌ Failed to create highlight {i+1}: {result}")
        else:
            print(f"   ❌ HTTP Error creating highlight {i+1}: {response.status_code}")
    
    if not highlights_created:
        print("❌ No highlights created, cannot test management features")
        return
    
    # Test 2: Edit highlights (simulating enhanced popup editing)
    print(f"\n2️⃣ Testing highlight editing (Enhanced Popup Simulation)...")
    for i, highlight_id in enumerate(highlights_created):
        updated_comment = f"✏️ EDITED via Enhanced Popup: Updated insight {i+1} with rich commentary"
        
        update_response = requests.put(
            f"{BASE_URL}/api/v1/highlights/documents/{document_id}/highlights/{highlight_id}",
            headers=headers,
            json={"comment": updated_comment}
        )
        
        if update_response.status_code == 200:
            print(f"   ✅ Enhanced edit successful for highlight {i+1}")
        else:
            print(f"   ❌ Failed to edit highlight {i+1}: {update_response.text}")
    
    # Test 3: Get all highlights to verify they're ready for frontend display
    print("\n3️⃣ Retrieving highlights for frontend rendering...")
    get_response = requests.get(
        f"{BASE_URL}/api/v1/highlights/documents/{document_id}/highlights",
        headers=headers
    )
    
    if get_response.status_code == 200:
        result = get_response.json()
        if result.get("success"):
            highlights = result["data"]["highlights"]
            print(f"✅ Retrieved {len(highlights)} highlights ready for enhanced management")
            
            # Display highlight data in format frontend would receive
            for i, h in enumerate(highlights):
                print(f"\n   📋 Highlight {i+1}:")
                print(f"      • ID: {h['id']}")
                print(f"      • Content: {h['content'][:50]}...")
                print(f"      • Comment: {h['comment']}")
                print(f"      • Areas: {len(h['areas'])} positioning area(s)")
                print(f"      • Created: {h['created_at']}")
                print(f"      • Updated: {h['updated_at']}")
        else:
            print(f"❌ Failed to retrieve highlights: {result}")
    else:
        print(f"❌ Failed to get highlights: {get_response.text}")
    
    # Test 4: Delete one highlight (simulating enhanced popup deletion)
    print(f"\n4️⃣ Testing highlight deletion via Enhanced Popup...")
    if highlights_created:
        delete_id = highlights_created[0]
        delete_response = requests.delete(
            f"{BASE_URL}/api/v1/highlights/documents/{document_id}/highlights/{delete_id}",
            headers=headers
        )
        
        if delete_response.status_code == 200:
            print(f"   ✅ Enhanced deletion successful for highlight: {delete_id}")
        else:
            print(f"   ❌ Failed to delete via popup: {delete_response.text}")
    
    # Test 5: Verify final state
    print(f"\n5️⃣ Final verification of enhanced highlight management...")
    final_response = requests.get(
        f"{BASE_URL}/api/v1/highlights/documents/{document_id}/highlights",
        headers=headers
    )
    
    if final_response.status_code == 200:
        result = final_response.json()
        if result.get("success"):
            final_highlights = result["data"]["highlights"]
            print(f"✅ Final state: {len(final_highlights)} highlights remain")
            print("✅ Enhanced highlight management ready for frontend integration!")
        else:
            print(f"❌ Failed final verification: {result}")
    
    print("\n" + "=" * 60)
    print("🎨 Phase 2: Enhanced Highlight Management - COMPLETE!")
    print("🚀 Ready for Phase 3: AI Integration")

if __name__ == "__main__":
    test_enhanced_highlights()
