#!/usr/bin/env python3
"""
Validation script for AI service refactoring.
Tests that all critical imports still work after the modular restructure.
"""

def test_legacy_imports():
    """Test that all legacy imports still work."""
    print("🧪 Testing legacy imports...")
    
    try:
        # Test core functions that other files depend on
        from services.ai_service import (
            detect_contract_type,
            extract_clauses_with_llm,
            generate_contract_specific_summary,
            generate_structured_document_summary,
            analyze_clause,
        )
        print("✅ All main AI functions import successfully!")
        return True
    except ImportError as e:
        print(f"❌ Legacy import failed: {e}")
        return False


def test_new_modular_imports():
    """Test that new modular structure works."""
    print("🔧 Testing new modular imports...")
    
    try:
        # Test new modular structure
        from services.ai.client_manager import is_ai_available as new_is_ai_available
        from services.ai.token_utils import get_token_count as new_get_token_count
        from services.ai.contract_utils import get_relevant_clause_types
        print("✅ All new modular imports successful!")
        return True
    except ImportError as e:
        print(f"❌ New modular import failed: {e}")
        return False


def test_function_compatibility():
    """Test that new functions work correctly."""
    print("⚖️ Testing new modular functions...")
    
    try:
        # Test that new functions work correctly
        from services.ai.client_manager import is_ai_available
        from services.ai.token_utils import get_token_count
        
        result = is_ai_available()
        print(f"✅ is_ai_available works: {result}")
        
        # Test token counting
        test_text = "This is a test"
        token_count = get_token_count(test_text)
        print(f"✅ Token counting works: '{test_text}' = {token_count} tokens")
        
        return True
            
    except Exception as e:
        print(f"❌ Function test failed: {e}")
        return False


def main():
    """Run all validation tests."""
    print("🚀 AI Service Refactoring Validation")
    print("=" * 50)
    
    tests = [
        test_legacy_imports,
        test_new_modular_imports, 
        test_function_compatibility
    ]
    
    passed = 0
    for test in tests:
        if test():
            passed += 1
        print()
    
    print(f"📊 Results: {passed}/{len(tests)} tests passed")
    
    if passed == len(tests):
        print("🎉 ALL TESTS PASSED! Refactoring is safe to proceed.")
        return True
    else:
        print("⚠️ SOME TESTS FAILED! Review before proceeding.")
        return False


if __name__ == "__main__":
    main()
