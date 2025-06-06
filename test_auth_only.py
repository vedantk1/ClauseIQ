#!/usr/bin/env python3
"""
Test ONLY the authentication flow - login and profile retrieval.
This proves the authentication system is working correctly.
"""
import os
import pytest
import requests

BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")

@pytest.fixture(scope="session")
def session():
    with requests.Session() as s:
        s.headers.update({"Accept": "application/json"})
        yield s

def test_login_success(session):
    """Test that login works and returns valid tokens."""
    creds = {"email": os.environ["TEST_EMAIL"],
             "password": os.environ["TEST_PASSWORD"]}
    resp = session.post(f"{BASE_URL}/api/v1/auth/login",
                        json=creds, timeout=5)
    assert resp.ok, f"Login failed: {resp.text}"
    
    body = resp.json()
    assert body["success"] is True
    assert "data" in body
    assert "access_token" in body["data"]
    assert "refresh_token" in body["data"]
    assert body["data"]["token_type"] == "bearer"
    
    print(f"✅ Login successful for {creds['email']}")
    return body["data"]["access_token"]

def test_profile_retrieval(session):
    """Test that profile retrieval works with valid token."""
    # First login
    creds = {"email": os.environ["TEST_EMAIL"],
             "password": os.environ["TEST_PASSWORD"]}
    login_resp = session.post(f"{BASE_URL}/api/v1/auth/login",
                              json=creds, timeout=5)
    assert login_resp.ok
    token = login_resp.json()["data"]["access_token"]
    
    # Then get profile
    headers = {"Authorization": f"Bearer {token}"}
    prof = session.get(f"{BASE_URL}/api/v1/auth/me",
                       headers=headers, timeout=5)
    assert prof.ok, f"Profile retrieval failed: {prof.text}"
    
    user_response = prof.json()
    assert user_response["success"] is True
    assert "data" in user_response
    
    user = user_response["data"]
    assert user["email"] == os.environ["TEST_EMAIL"]
    assert "id" in user
    assert "full_name" in user
    
    print(f"✅ Profile retrieved for {user['email']} (ID: {user['id']})")

def test_multiple_login_attempts(session):
    """Test that multiple login attempts work (no 'only once after restart' issue)."""
    creds = {"email": os.environ["TEST_EMAIL"],
             "password": os.environ["TEST_PASSWORD"]}
    
    for i in range(3):
        resp = session.post(f"{BASE_URL}/api/v1/auth/login",
                            json=creds, timeout=5)
        assert resp.ok, f"Login attempt {i+1} failed: {resp.text}"
        
        # Also test profile retrieval for each login
        token = resp.json()["data"]["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        prof = session.get(f"{BASE_URL}/api/v1/auth/me",
                           headers=headers, timeout=5)
        assert prof.ok, f"Profile retrieval {i+1} failed: {prof.text}"
        
        print(f"✅ Login attempt {i+1} successful")
    
    print("✅ Multiple login attempts all successful - no 'only once' issue!")

def test_invalid_credentials(session):
    """Test that invalid credentials are properly rejected."""
    creds = {"email": os.environ["TEST_EMAIL"],
             "password": "wrongpassword"}
    resp = session.post(f"{BASE_URL}/api/v1/auth/login",
                        json=creds, timeout=5)
    assert not resp.ok
    assert resp.status_code == 422 or resp.status_code == 401
    print("✅ Invalid credentials properly rejected")

if __name__ == "__main__":
    print("Testing ClauseIQ Authentication System...")
    print("=" * 50)
