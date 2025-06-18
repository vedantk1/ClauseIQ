#!/usr/bin/env python3
"""
Basic import validation script (no external dependencies).
"""

def test_basic_imports():
    """Test basic import structure."""
    print("🧪 Testing basic import structure...")
    
    try:
        # Test that our files exist and have proper structure
        import services.ai_service
        print("✅ services.ai_service imports successfully")
        
        # Check if our main functions are available
        funcs = ['detect_contract_type', 'extract_clauses_with_llm', 'is_ai_available']
        for func in funcs:
            if hasattr(services.ai_service, func):
                print(f"✅ {func} available")
            else:
                print(f"❌ {func} missing")
        
        return True
    except Exception as e:
        print(f"❌ Import failed: {e}")
        return False


def test_modular_structure():
    """Test new modular structure."""
    print("🔧 Testing modular structure...")
    
    try:
        import services.ai
        print("✅ services.ai package imports successfully")
        
        # Test individual modules
        import services.ai.client_manager
        import services.ai.token_utils  
        import services.ai.contract_utils
        print("✅ All modular components import successfully")
        
        return True
    except Exception as e:
        print(f"❌ Modular import failed: {e}")
        return False


if __name__ == "__main__":
    print("🚀 Basic AI Service Structure Validation")
    print("=" * 50)
    
    test1 = test_basic_imports()
    print()
    test2 = test_modular_structure()
    
    print(f"\n📊 Results: {sum([test1, test2])}/2 tests passed")
    
    if test1 and test2:
        print("🎉 STRUCTURE VALIDATION PASSED!")
    else:
        print("⚠️ Structure issues detected")
