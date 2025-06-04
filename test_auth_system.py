#!/usr/bin/env python3
"""
Test script for ClauseIQ authentication system
"""
import requests
import json

BASE_URL = "http://localhost:8000"

def test_auth_endpoints():
    print("🔧 Testing ClauseIQ Authentication System")
    print("=" * 50)
    
    # Test user registration
    print("\n1. Testing user registration...")
    register_data = {
        "email": "test@example.com",
        "password": "testpassword123",
        "full_name": "Test User"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/register", json=register_data)
        if response.status_code == 200:
            print("✅ Registration successful")
            tokens = response.json()
            access_token = tokens.get("access_token")
            refresh_token = tokens.get("refresh_token")
            print(f"   Access token: {access_token[:20]}...")
            print(f"   Refresh token: {refresh_token[:20]}...")
        else:
            print(f"❌ Registration failed: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Registration error: {e}")
        return False
    
    # Test getting user info
    print("\n2. Testing user info retrieval...")
    headers = {"Authorization": f"Bearer {access_token}"}
    
    try:
        response = requests.get(f"{BASE_URL}/auth/me", headers=headers)
        if response.status_code == 200:
            user_info = response.json()
            print("✅ User info retrieved successfully")
            print(f"   User: {user_info.get('full_name')} ({user_info.get('email')})")
            print(f"   ID: {user_info.get('id')}")
        else:
            print(f"❌ User info retrieval failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ User info error: {e}")
        return False
    
    # Test login
    print("\n3. Testing login...")
    login_data = {
        "email": "test@example.com",
        "password": "testpassword123"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
        if response.status_code == 200:
            print("✅ Login successful")
            tokens = response.json()
            new_access_token = tokens.get("access_token")
            print(f"   New access token: {new_access_token[:20]}...")
        else:
            print(f"❌ Login failed: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Login error: {e}")
        return False
    
    # Test protected endpoint
    print("\n4. Testing protected endpoint...")
    headers = {"Authorization": f"Bearer {new_access_token}"}
    
    try:
        response = requests.get(f"{BASE_URL}/documents/", headers=headers)
        if response.status_code in [200, 404]:  # 404 is OK if no documents exist
            print("✅ Protected endpoint accessible")
            if response.status_code == 200:
                docs = response.json()
                print(f"   Found {len(docs.get('documents', []))} documents")
            else:
                print("   No documents found (expected for new user)")
        else:
            print(f"❌ Protected endpoint failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Protected endpoint error: {e}")
        return False
    
    # Test token refresh
    print("\n5. Testing token refresh...")
    refresh_data = {"refresh_token": refresh_token}
    
    try:
        response = requests.post(f"{BASE_URL}/auth/refresh", json=refresh_data)
        if response.status_code == 200:
            print("✅ Token refresh successful")
            new_tokens = response.json()
            print(f"   Refreshed token: {new_tokens.get('access_token')[:20]}...")
        else:
            print(f"❌ Token refresh failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Token refresh error: {e}")
        return False
    
    print("\n" + "=" * 50)
    print("🎉 All authentication tests passed successfully!")
    print("\nThe authentication system is working correctly:")
    print("• User registration ✅")
    print("• User login ✅") 
    print("• Protected endpoints ✅")
    print("• Token refresh ✅")
    print("• User info retrieval ✅")
    
    return True

if __name__ == "__main__":
    test_auth_endpoints()
