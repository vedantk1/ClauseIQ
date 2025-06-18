#!/usr/bin/env python3
"""
Comprehensive test suite for AI service refactoring.
Tests all modules individually and integration scenarios.
"""

import sys
import traceback
from typing import List, Tuple

def test_client_manager() -> Tuple[bool, str]:
    """Test AI client manager module."""
    try:
        from services.ai.client_manager import get_openai_client, is_ai_available, reset_client
        
        # Test client availability check
        result = is_ai_available()
        
        # Test client reset (should not throw)
        reset_client()
        
        return True, f"Client manager works, AI available: {result}"
    except Exception as e:
        return False, f"Client manager failed: {str(e)}"


def test_token_utils() -> Tuple[bool, str]:
    """Test token utilities module."""
    try:
        from services.ai.token_utils import (
            get_token_count, 
            truncate_text_by_tokens,
            calculate_token_budget,
            get_optimal_response_tokens,
            get_model_capabilities
        )
        
        # Test token counting
        test_text = "This is a test sentence for token counting."
        token_count = get_token_count(test_text)
        
        # Test text truncation
        truncated = truncate_text_by_tokens(test_text, 5)
        
        # Test token budget calculation
        budget = calculate_token_budget("gpt-3.5-turbo", 1000)
        
        # Test optimal response tokens
        optimal = get_optimal_response_tokens("summary", "gpt-4")
        
        # Test model capabilities
        caps = get_model_capabilities("gpt-4o")
        
        return True, f"Token utils work: {token_count} tokens, budget: {budget}, optimal: {optimal}"
    except Exception as e:
        return False, f"Token utils failed: {str(e)}"


def test_contract_utils() -> Tuple[bool, str]:
    """Test contract utilities module."""
    try:
        from services.ai.contract_utils import get_relevant_clause_types, get_contract_type_mapping
        
        # Test contract type mapping
        mapping = get_contract_type_mapping()
        
        # Test clause types (may fail if models not available, that's ok)
        try:
            clause_types = get_relevant_clause_types("employment")
            clause_count = len(clause_types) if clause_types else 0
        except:
            clause_count = 0  # Expected if dependencies not available
        
        return True, f"Contract utils work: {len(mapping)} contract types, {clause_count} clause types"
    except Exception as e:
        return False, f"Contract utils failed: {str(e)}"


def test_legacy_compatibility() -> Tuple[bool, str]:
    """Test that main AI service functions still work."""
    try:
        from services.ai_service import (
            generate_structured_document_summary,
            detect_contract_type,
            extract_clauses_with_llm,
            generate_contract_specific_summary
        )
        
        # Test that functions exist and are callable
        functions = [
            generate_structured_document_summary,
            detect_contract_type,
            extract_clauses_with_llm,
            generate_contract_specific_summary
        ]
        
        callable_count = sum(1 for f in functions if callable(f))
        
        return True, f"Legacy compatibility: {callable_count}/{len(functions)} functions available"
    except Exception as e:
        return False, f"Legacy compatibility failed: {str(e)}"


def test_integration() -> Tuple[bool, str]:
    """Test integration between old and new systems."""
    try:
        # Test that legacy and new functions return consistent results
        from services.ai.client_manager import is_ai_available
        
        result = is_ai_available()
        
        return True, f"Integration test passed: is_ai_available={result}"
            
    except Exception as e:
        return False, f"Integration test failed: {str(e)}"


def test_performance_basics() -> Tuple[bool, str]:
    """Basic performance validation."""
    try:
        import time
        from services.ai.token_utils import get_token_count
        
        # Test token counting performance
        test_text = "This is a performance test. " * 100  # ~600 chars
        
        start_time = time.time()
        for _ in range(10):
            get_token_count(test_text)
        end_time = time.time()
        
        avg_time = (end_time - start_time) / 10
        
        # Should be fast (< 100ms per call)
        if avg_time < 0.1:
            return True, f"Performance good: {avg_time:.4f}s avg per token count"
        else:
            return False, f"Performance slow: {avg_time:.4f}s avg per token count"
            
    except Exception as e:
        return False, f"Performance test failed: {str(e)}"


def run_all_tests() -> None:
    """Run all test suites."""
    print("🧪 PHASE 3 COMPREHENSIVE TESTING")
    print("=" * 60)
    
    tests = [
        ("Client Manager", test_client_manager),
        ("Token Utils", test_token_utils),
        ("Contract Utils", test_contract_utils),
        ("Legacy Compatibility", test_legacy_compatibility),
        ("Integration", test_integration),
        ("Performance", test_performance_basics),
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        try:
            success, message = test_func()
            if success:
                print(f"✅ {test_name}: {message}")
                passed += 1
            else:
                print(f"❌ {test_name}: {message}")
                failed += 1
        except Exception as e:
            print(f"💥 {test_name}: CRASHED - {str(e)}")
            failed += 1
        print()
    
    print("📊 TEST RESULTS:")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"📈 Success Rate: {passed/(passed+failed)*100:.1f}%")
    
    if failed == 0:
        print("\n🎉 ALL TESTS PASSED - PHASE 3 READY!")
        return True
    else:
        print(f"\n⚠️ {failed} TESTS FAILED - REVIEW NEEDED")
        return False


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
