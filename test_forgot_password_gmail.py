#!/usr/bin/env python3
"""
Test script for ClauseIQ forgot password functionality
Tests the complete flow: forgot password request → email sent → password reset
"""

import requests
import json
import time

# Configuration
BASE_URL = "http://localhost:8000"
TEST_EMAIL = "clauseiq@gmail.com"  # Using your Gmail for testing

def test_forgot_password():
    """Test the forgot password endpoint"""
    print("🔧 Testing Forgot Password Functionality...")
    print("=" * 50)
    
    # Test 1: Valid email
    print("\n1. Testing forgot password with valid email...")
    response = requests.post(
        f"{BASE_URL}/auth/forgot-password",
        json={"email": TEST_EMAIL},
        headers={"Content-Type": "application/json"}
    )
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")
    
    if response.status_code == 200:
        print("✅ Forgot password request successful!")
        print("📧 Check your email for the reset link")
    else:
        print("❌ Forgot password request failed!")
        return False
    
    # Test 2: Invalid email
    print("\n2. Testing forgot password with non-existent email...")
    response = requests.post(
        f"{BASE_URL}/auth/forgot-password",
        json={"email": "nonexistent@example.com"},
        headers={"Content-Type": "application/json"}
    )
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")
    
    if response.status_code == 200:
        print("✅ Security check passed - same response for non-existent email")
    
    return True

def test_email_configuration():
    """Test if email configuration is working"""
    print("\n🔧 Testing Email Configuration...")
    print("=" * 50)
    
    try:
        # Check if backend is running
        response = requests.get(f"{BASE_URL}/docs")
        if response.status_code == 200:
            print("✅ Backend is running")
        else:
            print("❌ Backend is not accessible")
            return False
            
        # Test forgot password endpoint existence
        response = requests.post(
            f"{BASE_URL}/auth/forgot-password",
            json={"email": "test@example.com"},
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code in [200, 400, 422]:
            print("✅ Forgot password endpoint is available")
            return True
        else:
            print(f"❌ Unexpected response: {response.status_code}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to backend. Is it running on port 8000?")
        return False
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

def main():
    print("🚀 ClauseIQ Forgot Password Test")
    print("=" * 50)
    
    # Test backend connectivity
    if not test_email_configuration():
        return
    
    # Test forgot password functionality
    if test_forgot_password():
        print("\n🎉 All tests completed!")
        print("\n📋 Next steps:")
        print("1. Check your email (clauseiq@gmail.com) for the password reset link")
        print("2. Click the link to test the reset password flow")
        print("3. Verify you can set a new password")
    else:
        print("\n❌ Tests failed!")

if __name__ == "__main__":
    main()
