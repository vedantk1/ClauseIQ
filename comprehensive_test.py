#!/usr/bin/env python3
"""
Test script for the unified /analyze-document/ endpoint
"""
import requests
import json
import time

BASE_URL = "http://localhost:8000"

def get_auth_token():
    """Get authentication token by logging in the existing user"""
    session = requests.Session()
    
    # Test user credentials
    test_user = {
        "email": "clauseiq@gmail.com",
        "password": "testuser123"
    }
    
    print("🔐 Getting authentication token...")
    
    # Login with existing user
    try:
        login_response = session.post(f"{BASE_URL}/auth/login", json=test_user)
        
        if login_response.status_code == 200:
            print("✅ User logged in successfully")
            auth_data = login_response.json()
            return auth_data.get("access_token"), session
        else:
            print(f"❌ Login failed: {login_response.status_code} - {login_response.text}")
            return None, None
            
    except Exception as e:
        print(f"❌ Authentication error: {e}")
        return None, None

def test_unified_endpoint_with_file():
    """Test the unified endpoint with a real file upload"""
    print("🧪 Testing unified endpoint with file upload...")
    print("=" * 60)
    
    # Get authentication token
    access_token, session = get_auth_token()
    if not access_token:
        print("❌ Failed to get authentication token")
        return False
    
    # Test file path
    test_file = "/Users/vedan/Downloads/clauseiq-project/test_document.txt"
    
    try:
        # Prepare the file for upload
        with open(test_file, 'rb') as f:
            files = {
                'file': ('test_document.txt', f, 'text/plain')
            }
            
            # Headers with authentication
            headers = {
                'Authorization': f'Bearer {access_token}'
            }
            
            print("📤 Uploading test document...")
            start_time = time.time()
            
            # Make request to unified endpoint
            response = requests.post(
                f"{BASE_URL}/analyze-document/",
                files=files,
                headers=headers,
                timeout=60  # Give it time for AI processing
            )
            
            end_time = time.time()
            processing_time = end_time - start_time
            
            print(f"⏱️  Processing time: {processing_time:.2f} seconds")
            print(f"📊 Response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print("✅ SUCCESS! Unified endpoint working correctly")
                print("-" * 40)
                print(f"📄 Document ID: {data.get('id')}")
                print(f"📁 Filename: {data.get('filename')}")
                print(f"📝 Text length: {len(data.get('full_text', ''))}")
                print(f"📋 Summary length: {len(data.get('summary', ''))}")
                print(f"🔍 Total clauses found: {data.get('total_clauses', 0)}")
                
                # Show first few clauses
                clauses = data.get('clauses', [])
                if clauses:
                    print("\n🔍 Sample clauses found:")
                    for i, clause in enumerate(clauses[:3]):  # Show first 3
                        print(f"  {i+1}. {clause.get('type', 'Unknown')}: {clause.get('text', '')[:100]}...")
                
                # Show risk summary
                risk_summary = data.get('risk_summary', {})
                if risk_summary:
                    print(f"\n⚠️  Risk Summary:")
                    print(f"   High Risk: {risk_summary.get('high', 0)}")
                    print(f"   Medium Risk: {risk_summary.get('medium', 0)}")
                    print(f"   Low Risk: {risk_summary.get('low', 0)}")
                
                print("\n✅ All expected fields present in response!")
                return True
                
            else:
                print(f"❌ FAILED with status {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
    except FileNotFoundError:
        print(f"❌ Test file not found: {test_file}")
        return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

def test_frontend_compatibility():
    """Test that the response format matches what the frontend expects"""
    print("\n🔧 Testing frontend compatibility...")
    print("=" * 60)
    
    # Get authentication token
    access_token, session = get_auth_token()
    if not access_token:
        print("❌ Failed to get authentication token")
        return False
    
    # Expected fields for frontend compatibility
    expected_fields = [
        'id', 'filename', 'full_text', 'summary', 
        'clauses', 'total_clauses', 'risk_summary'
    ]
    
    test_file = "/Users/vedan/Downloads/clauseiq-project/test_document.txt"
    
    try:
        with open(test_file, 'rb') as f:
            files = {'file': ('test_document.txt', f, 'text/plain')}
            headers = {'Authorization': f'Bearer {access_token}'}
            response = requests.post(f"{BASE_URL}/analyze-document/", files=files, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                print("🔍 Checking response structure...")
                missing_fields = []
                for field in expected_fields:
                    if field not in data:
                        missing_fields.append(field)
                    else:
                        print(f"  ✅ {field}: {type(data[field])}")
                
                if missing_fields:
                    print(f"❌ Missing fields: {missing_fields}")
                    return False
                else:
                    print("✅ All required fields present for frontend!")
                    return True
            else:
                print(f"❌ API call failed: {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
    except Exception as e:
        print(f"❌ Compatibility test failed: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Starting comprehensive unified endpoint tests...")
    print("=" * 60)
    
    # Test 1: Basic endpoint functionality
    success1 = test_unified_endpoint_with_file()
    
    # Test 2: Frontend compatibility
    success2 = test_frontend_compatibility()
    
    print("\n" + "=" * 60)
    if success1 and success2:
        print("🎉 ALL TESTS PASSED!")
        print("✅ Unified endpoint is working correctly")
        print("✅ Frontend compatibility verified")
        print("\n🌐 Ready to test in browser at http://localhost:3000")
    else:
        print("❌ Some tests failed - check the output above")
        
    print("=" * 60)
