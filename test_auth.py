# test_auth_flow.py
import os
import pytest
import requests

BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")

@pytest.fixture(scope="session")
def session():
    with requests.Session() as s:
        s.headers.update({"Accept": "application/json"})
        yield s

def test_login_and_profile(session):
    creds = {"email": os.environ["TEST_EMAIL"],
             "password": os.environ["TEST_PASSWORD"]}
    resp = session.post(f"{BASE_URL}/api/v1/auth/login",
                        json=creds, timeout=5)
    assert resp.ok, resp.text
    body = resp.json()
    token = body["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    prof = session.get(f"{BASE_URL}/api/v1/auth/me",
                       headers=headers, timeout=5)
    assert prof.ok, prof.text
    user_response = prof.json()
    user = user_response["data"]
    assert user["email"] == os.environ["TEST_EMAIL"]

    docs = session.get(f"{BASE_URL}/api/v1/documents/user/{user['id']}",
                       headers=headers, timeout=5)
    assert docs.ok, docs.text
    assert isinstance(docs.json(), list)