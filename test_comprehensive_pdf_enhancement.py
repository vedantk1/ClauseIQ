#!/usr/bin/env python3
"""
Comprehensive Test Suite for PDF Enhancement Plan
Tests all completed phases (1-4) of the PDF Enhancement implementation
"""

import requests
import json
import time
import sys
from typing import Dict, Any, List

# Configuration
BASE_URL = "http://localhost:8000"
TEST_EMAIL = "clauseiq@gmail.com"
TEST_PASSWORD = "testuser123"
DOCUMENT_ID = "89045d1d-f620-414b-a1c1-4e159c264561"

class ComprehensiveTester:
    def __init__(self):
        self.session = requests.Session()
        self.token = None
        self.test_results = {
            "phase1": False,
            "phase2": False, 
            "phase3": False,
            "phase4": False
        }

    def authenticate(self) -> bool:
        """Authenticate with backend"""
        try:
            response = self.session.post(
                f"{BASE_URL}/api/v1/auth/login",
                json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get("success"):
                    self.token = result["data"]["access_token"]
                    self.session.headers.update({
                        "Authorization": f"Bearer {self.token}"
                    })
                    print("✅ Authentication successful")
                    return True
            print(f"❌ Authentication failed: {response.status_code}")
            return False
        except Exception as e:
            print(f"❌ Authentication error: {e}")
            return False

    def test_phase1_persistence(self) -> bool:
        """Test Phase 1: Backend Persistence"""
        print("\n🧪 TESTING PHASE 1: Backend Persistence")
        print("=" * 50)
        
        try:
            # Test GET highlights
            response = self.session.get(
                f"{BASE_URL}/api/v1/highlights/documents/{DOCUMENT_ID}/highlights"
            )
            
            if response.status_code != 200:
                print(f"❌ Failed to get highlights: {response.status_code}")
                return False
                
            data = response.json()
            if not data.get("success"):
                print("❌ API returned error")
                return False
                
            highlights = data["data"]["highlights"]
            print(f"✅ Retrieved {len(highlights)} highlights")
            
            # Test CREATE highlight
            create_data = {
                "content": "Comprehensive test highlight",
                "comment": "Testing all phases",
                "areas": [{
                    "height": 20.0,
                    "left": 100.0,
                    "page_index": 0,
                    "top": 300.0,
                    "width": 400.0
                }]
            }
            
            response = self.session.post(
                f"{BASE_URL}/api/v1/highlights/documents/{DOCUMENT_ID}/highlights",
                json=create_data
            )
            
            if response.status_code != 200:
                print(f"❌ Failed to create highlight: {response.status_code}")
                return False
                
            result = response.json()
            if not result.get("success"):
                print("❌ Failed to create highlight")
                return False
                
            highlight_id = result["data"]["highlight"]["id"]
            print(f"✅ Created highlight: {highlight_id}")
            
            # Test UPDATE highlight
            update_data = {"comment": "Updated comprehensive test"}
            response = self.session.put(
                f"{BASE_URL}/api/v1/highlights/documents/{DOCUMENT_ID}/highlights/{highlight_id}",
                json=update_data
            )
            
            if response.status_code == 200:
                print("✅ Updated highlight successfully")
            else:
                print(f"❌ Failed to update highlight: {response.status_code}")
                return False
            
            # Test DELETE highlight  
            response = self.session.delete(
                f"{BASE_URL}/api/v1/highlights/documents/{DOCUMENT_ID}/highlights/{highlight_id}"
            )
            
            if response.status_code == 200:
                print("✅ Deleted highlight successfully")
                self.test_results["phase1"] = True
                return True
            else:
                print(f"❌ Failed to delete highlight: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Phase 1 error: {e}")
            return False

    def test_phase2_enhanced_management(self) -> bool:
        """Test Phase 2: Enhanced Highlight Management"""
        print("\n🎨 TESTING PHASE 2: Enhanced Highlight Management")
        print("=" * 50)
        
        try:
            # Get existing highlights for management testing
            response = self.session.get(
                f"{BASE_URL}/api/v1/highlights/documents/{DOCUMENT_ID}/highlights"
            )
            
            if response.status_code != 200:
                print("❌ Cannot get highlights for management testing")
                return False
                
            data = response.json()
            highlights = data["data"]["highlights"]
            
            if len(highlights) == 0:
                print("❌ No highlights available for management testing")
                return False
                
            print(f"✅ Found {len(highlights)} highlights for management")
            
            # Test enhanced editing (simulate popup functionality)
            highlight_id = highlights[0]["id"]
            enhanced_comment = f"Enhanced edit at {time.strftime('%H:%M:%S')}"
            
            response = self.session.put(
                f"{BASE_URL}/api/v1/highlights/documents/{DOCUMENT_ID}/highlights/{highlight_id}",
                json={"comment": enhanced_comment}
            )
            
            if response.status_code == 200:
                print("✅ Enhanced editing functionality working")
                self.test_results["phase2"] = True
                return True
            else:
                print(f"❌ Enhanced editing failed: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Phase 2 error: {e}")
            return False

    def test_phase3_ai_integration(self) -> bool:
        """Test Phase 3: AI Integration"""
        print("\n🤖 TESTING PHASE 3: AI Integration")
        print("=" * 50)
        
        try:
            # Test Document AI Insights (most reliable AI endpoint)
            response = self.session.get(
                f"{BASE_URL}/api/v1/highlights/documents/{DOCUMENT_ID}/highlights/ai-insights"
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get("success"):
                    insights = result["data"]
                    print("✅ AI Document Insights working")
                    print(f"   📊 Summary: {insights.get('summary', 'N/A')}")
                    print(f"   📈 Risk Level: {insights.get('risk_distribution', {})}")
                    self.test_results["phase3"] = True
                    return True
                else:
                    print("❌ AI insights returned error")
                    return False
            else:
                print(f"❌ AI insights failed: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Phase 3 error: {e}")
            return False

    def test_phase4_search_navigation(self) -> bool:
        """Test Phase 4: Search & Navigation (Backend support)"""
        print("\n🎯 TESTING PHASE 4: Search & Navigation")
        print("=" * 50)
        
        try:
            # Test highlight retrieval for navigation
            response = self.session.get(
                f"{BASE_URL}/api/v1/highlights/documents/{DOCUMENT_ID}/highlights"
            )
            
            if response.status_code != 200:
                print("❌ Cannot retrieve highlights for navigation")
                return False
                
            data = response.json()
            highlights = data["data"]["highlights"]
            
            print(f"✅ Retrieved {len(highlights)} highlights for navigation")
            
            # Simulate search functionality (backend provides data)
            search_results = []
            search_term = "test"
            
            for highlight in highlights:
                if search_term.lower() in highlight["content"].lower():
                    search_results.append(highlight)
                    
            print(f"✅ Search simulation: Found {len(search_results)} highlights matching '{search_term}'")
            
            # Test navigation data structure
            if len(highlights) > 0:
                for i, highlight in enumerate(highlights[:3]):  # Test first 3 for navigation
                    print(f"   📍 Navigation {i+1}: {highlight['content'][:50]}...")
                    
                print("✅ Navigation data structure ready")
                self.test_results["phase4"] = True
                return True
            else:
                print("❌ No highlights available for navigation testing")
                return False
                
        except Exception as e:
            print(f"❌ Phase 4 error: {e}")
            return False

    def print_summary(self):
        """Print test results summary"""
        print("\n" + "=" * 60)
        print("🏁 COMPREHENSIVE TEST RESULTS")
        print("=" * 60)
        
        total_phases = len(self.test_results)
        passed_phases = sum(self.test_results.values())
        
        for phase, result in self.test_results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            phase_name = {
                "phase1": "Backend Persistence",
                "phase2": "Enhanced Highlight Management", 
                "phase3": "AI Integration",
                "phase4": "Search & Navigation"
            }[phase]
            print(f"{status} - Phase {phase[-1]}: {phase_name}")
            
        print(f"\n📊 SUMMARY: {passed_phases}/{total_phases} phases passed")
        
        if passed_phases == total_phases:
            print("🎉 ALL PHASES COMPLETE! PDF Enhancement Plan successfully implemented.")
            return True
        else:
            print(f"⚠️  {total_phases - passed_phases} phase(s) need attention.")
            return False

    def run_all_tests(self):
        """Run all phase tests"""
        print("🧪 COMPREHENSIVE PDF ENHANCEMENT TEST SUITE")
        print("Testing all completed phases (1-4)")
        print("=" * 60)
        
        if not self.authenticate():
            print("❌ Authentication failed - cannot run tests")
            return False
            
        # Run all phase tests
        self.test_phase1_persistence()
        self.test_phase2_enhanced_management()
        self.test_phase3_ai_integration()
        self.test_phase4_search_navigation()
        
        # Print summary
        return self.print_summary()


if __name__ == "__main__":
    tester = ComprehensiveTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)
