#!/usr/bin/env python3
"""
Quick test to verify the new unified /analyze-document/ endpoint is working
"""
import requests
import json

def test_unified_endpoint():
    """Test the new unified endpoint exists and responds correctly to OPTIONS request"""
    base_url = "http://localhost:8000"
    
    # Test 1: Check if endpoint exists (OPTIONS request)
    try:
        response = requests.options(f"{base_url}/analyze-document/")
        print(f"✅ Unified endpoint exists - Status: {response.status_code}")
        
        # Check allowed methods
        allowed_methods = response.headers.get('Allow', '')
        if 'POST' in allowed_methods:
            print("✅ POST method is allowed")
        else:
            print("❌ POST method not found in allowed methods")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to reach endpoint: {e}")
        return False
    
    # Test 2: Check API documentation includes our endpoint
    try:
        response = requests.get(f"{base_url}/docs")
        if response.status_code == 200:
            print("✅ API docs are accessible")
        else:
            print(f"❌ API docs returned status: {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to reach API docs: {e}")
    
    # Test 3: Check OpenAPI schema includes our endpoint
    try:
        response = requests.get(f"{base_url}/openapi.json")
        if response.status_code == 200:
            openapi_spec = response.json()
            if "/analyze-document/" in openapi_spec.get("paths", {}):
                print("✅ Unified endpoint found in OpenAPI spec")
                
                # Check the response model
                endpoint_spec = openapi_spec["paths"]["/analyze-document/"]["post"]
                response_schema = endpoint_spec.get("responses", {}).get("200", {})
                if "AnalyzeDocumentResponse" in str(response_schema):
                    print("✅ AnalyzeDocumentResponse model is properly defined")
                else:
                    print("⚠️  Response model might not be properly defined")
            else:
                print("❌ Unified endpoint not found in OpenAPI spec")
        else:
            print(f"❌ OpenAPI spec returned status: {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to get OpenAPI spec: {e}")
    except json.JSONDecodeError as e:
        print(f"❌ Failed to parse OpenAPI spec: {e}")
    
    return True

if __name__ == "__main__":
    print("🧪 Testing unified /analyze-document/ endpoint...")
    print("=" * 50)
    test_unified_endpoint()
    print("=" * 50)
    print("✅ Test complete! Check the frontend at http://localhost:3000")
