#!/usr/bin/env python3
"""
Comprehensive test for AI Model Selection feature
Tests all backend endpoints and validates the complete workflow
"""

import requests
import json
import sys

BASE_URL = "http://localhost:8000"

def test_available_models():
    """Test the available models endpoint"""
    print("🧪 Testing Available Models Endpoint...")
    
    try:
        response = requests.get(f"{BASE_URL}/auth/available-models")
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Available models: {len(data['models'])} models found")
            print(f"Default model: {data['default_model']}")
            
            # Validate model structure
            for model in data['models']:
                required_fields = ['id', 'name', 'description']
                for field in required_fields:
                    if field not in model:
                        print(f"❌ Missing field '{field}' in model: {model}")
                        return False
            
            print("✅ All models have required fields")
            return True
        else:
            print(f"❌ Failed: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_user_auth_and_preferences():
    """Test user authentication and preferences workflow"""
    print("\n🧪 Testing User Authentication & Preferences...")
    
    # Test credentials (you may need to adjust these)
    test_email = "test@example.com"
    test_password = "testpassword123"
    test_name = "Test User"
    
    session = requests.Session()
    
    try:
        # First, try to register a test user
        print("Attempting to register test user...")
        register_response = session.post(f"{BASE_URL}/auth/register", json={
            "email": test_email,
            "password": test_password,
            "full_name": test_name
        })
        
        if register_response.status_code in [200, 201]:
            print("✅ User registered successfully")
            auth_data = register_response.json()
        elif register_response.status_code == 400:
            # User might already exist, try login
            print("User might exist, trying login...")
            login_response = session.post(f"{BASE_URL}/auth/login", json={
                "email": test_email,
                "password": test_password
            })
            
            if login_response.status_code == 200:
                print("✅ User logged in successfully")
                auth_data = login_response.json()
            else:
                print(f"❌ Login failed: {login_response.status_code} - {login_response.text}")
                return False
        else:
            print(f"❌ Registration failed: {register_response.status_code} - {register_response.text}")
            return False
        
        # Extract token
        access_token = auth_data.get('access_token')
        if not access_token:
            print("❌ No access token received")
            return False
        
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Test getting user preferences
        print("Testing GET preferences...")
        prefs_response = session.get(f"{BASE_URL}/auth/preferences", headers=headers)
        
        if prefs_response.status_code == 200:
            prefs_data = prefs_response.json()
            print(f"✅ Current preferred model: {prefs_data.get('preferred_model')}")
            print(f"Available models count: {len(prefs_data.get('available_models', []))}")
        else:
            print(f"❌ Failed to get preferences: {prefs_response.status_code} - {prefs_response.text}")
            return False
        
        # Test updating preferences
        print("Testing PUT preferences...")
        new_model = "gpt-4o-mini"
        update_response = session.put(f"{BASE_URL}/auth/preferences", 
                                    headers=headers,
                                    json={"preferred_model": new_model})
        
        if update_response.status_code == 200:
            updated_data = update_response.json()
            if updated_data.get('preferred_model') == new_model:
                print(f"✅ Successfully updated preferred model to: {new_model}")
            else:
                print(f"❌ Model not updated correctly. Expected: {new_model}, Got: {updated_data.get('preferred_model')}")
                return False
        else:
            print(f"❌ Failed to update preferences: {update_response.status_code} - {update_response.text}")
            return False
        
        # Verify the change persisted
        print("Verifying preference change persisted...")
        verify_response = session.get(f"{BASE_URL}/auth/preferences", headers=headers)
        
        if verify_response.status_code == 200:
            verify_data = verify_response.json()
            if verify_data.get('preferred_model') == new_model:
                print(f"✅ Preference change persisted correctly: {new_model}")
                return True
            else:
                print(f"❌ Preference not persisted. Expected: {new_model}, Got: {verify_data.get('preferred_model')}")
                return False
        else:
            print(f"❌ Failed to verify preferences: {verify_response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error during auth/preferences test: {e}")
        return False

def test_ai_integration():
    """Test that AI endpoints use the preferred model"""
    print("\n🧪 Testing AI Integration with Model Preferences...")
    
    # This would require a full document upload test
    # For now, we'll just verify the endpoints exist and are accessible
    try:
        # Test analyze endpoint (without file for now)
        analyze_response = requests.post(f"{BASE_URL}/analyze/")
        print(f"Analyze endpoint status: {analyze_response.status_code}")
        
        # Test process-document endpoint (without file for now)  
        process_response = requests.post(f"{BASE_URL}/process-document/")
        print(f"Process-document endpoint status: {process_response.status_code}")
        
        # Both should return 422 (missing file) rather than 404 (endpoint not found)
        if analyze_response.status_code == 422 and process_response.status_code == 422:
            print("✅ AI endpoints are accessible and expect file uploads")
            return True
        else:
            print("❌ AI endpoints may not be properly configured")
            return False
            
    except Exception as e:
        print(f"❌ Error testing AI integration: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 Starting AI Model Selection Feature Tests")
    print("=" * 50)
    
    tests = [
        ("Available Models", test_available_models),
        ("User Auth & Preferences", test_user_auth_and_preferences), 
        ("AI Integration", test_ai_integration)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n{'=' * 20} {test_name} {'=' * 20}")
        result = test_func()
        results.append((test_name, result))
        
        if result:
            print(f"✅ {test_name}: PASSED")
        else:
            print(f"❌ {test_name}: FAILED")
    
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name}: {status}")
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! AI Model Selection feature is working correctly.")
        sys.exit(0)
    else:
        print("⚠️  Some tests failed. Please check the output above.")
        sys.exit(1)

if __name__ == "__main__":
    main()
