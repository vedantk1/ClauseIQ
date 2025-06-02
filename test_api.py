#!/usr/bin/env python3
"""Test script for the Legal AI API endpoints"""

import requests
import json

BASE_URL = "http://localhost:8000"

def test_health_check():
    """Test the root health check endpoint"""
    try:
        response = requests.get(f"{BASE_URL}/")
        print(f"Health Check - Status: {response.status_code}")
        if response.status_code == 200:
            print(f"Response: {response.json()}")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Health check failed: {e}")

def test_documents_endpoint():
    """Test retrieving all documents"""
    try:
        response = requests.get(f"{BASE_URL}/documents/")
        print(f"\nDocuments List - Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Total documents: {len(data.get('documents', []))}")
            for i, doc in enumerate(data.get('documents', [])[:2]):  # Show first 2
                print(f"Document {i+1}: {doc.get('filename')} (ID: {doc.get('id')[:8]}...)")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Documents test failed: {e}")

def test_process_document_without_file():
    """Test process-document endpoint without file (should fail gracefully)"""
    try:
        response = requests.post(f"{BASE_URL}/process-document/")
        print(f"\nProcess Document (no file) - Status: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Process document test failed: {e}")

if __name__ == "__main__":
    print("Testing Legal AI API endpoints...")
    print("=" * 50)
    
    test_health_check()
    test_documents_endpoint()
    test_process_document_without_file()
    
    print("\n" + "=" * 50)
    print("API testing completed!")
    print("\nTo test file upload:")
    print("1. Open http://localhost:8000/docs in your browser")
    print("2. Use the /process-document/ endpoint")
    print("3. Upload a PDF file to test AI summarization")
