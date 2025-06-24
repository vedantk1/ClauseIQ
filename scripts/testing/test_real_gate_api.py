#!/usr/bin/env python3
"""
Real API test for conversational RAG gate decision.
Tests the actual OpenAI API calls to debug the gate prompt.
"""
import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.rag_service import RAGService

async def test_real_gate_decisions():
    """Test gate decisions with real OpenAI API calls."""
    
    print("🧪 REAL API GATE TESTING")
    print("=" * 50)
    
    rag_service = RAGService()
    
    # Test cases
    test_queries = [
        {
            "query": "What are the payment terms in this contract?",
            "expected": False,
            "reason": "Should be standalone (this contract = self-contained)"
        },
        {
            "query": "Is that enforceable?", 
            "expected": True,
            "reason": "Contains pronoun 'that' referring to previous topic"
        },
        {
            "query": "Tell me about that in detail",
            "expected": True, 
            "reason": "Contains 'that' + follow-up request"
        },
        {
            "query": "How does this compare to industry standards?",
            "expected": True,
            "reason": "'this' without specific noun needs context"
        },
        {
            "query": "What intellectual property rights are covered?",
            "expected": False,
            "reason": "Standalone question about specific topic"
        }
    ]
    
    print(f"Testing {len(test_queries)} queries with real OpenAI API...")
    print()
    
    for i, test in enumerate(test_queries, 1):
        query = test["query"]
        expected = test["expected"] 
        reason = test["reason"]
        
        print(f"📝 Test {i}: '{query}'")
        print(f"   Expected: {'NEEDS CONTEXT' if expected else 'STANDALONE'}")
        print(f"   Reason: {reason}")
        
        try:
            result = await rag_service._needs_conversation_context(query)
            status = "✅" if result == expected else "❌"
            print(f"   Result: {'NEEDS CONTEXT' if result else 'STANDALONE'} {status}")
            
            if result != expected:
                print(f"   🚨 MISMATCH! Expected {expected}, got {result}")
            
        except Exception as e:
            print(f"   ❌ ERROR: {e}")
        
        print()
    
    print("🎯 Testing the specific failing case from screenshot...")
    
    # Test the exact case from the screenshot
    conversation_history = [
        {
            "role": "user",
            "content": "summarize the document",
            "timestamp": "2024-06-23T16:36:07Z"
        },
        {
            "role": "assistant", 
            "content": "The document is an Employment Agreement between Orion Tech Solutions Ltd and Jane Elizabeth Carter...",
            "timestamp": "2024-06-23T16:36:10Z"
        }
    ]
    
    problematic_query = "tell me about that in detail"
    
    print(f"Query: '{problematic_query}'")
    
    try:
        # Test gate
        needs_context = await rag_service._needs_conversation_context(problematic_query)
        print(f"Gate decision: {'NEEDS CONTEXT' if needs_context else 'STANDALONE'}")
        
        if needs_context:
            # Test rewrite
            rewritten = await rag_service._rewrite_query_with_context(problematic_query, conversation_history)
            print(f"Rewritten query: '{rewritten}'")
            
            if "employment" in rewritten.lower() or "agreement" in rewritten.lower():
                print("✅ Rewrite successfully resolved 'that' to Employment Agreement!")
            else:
                print("❌ Rewrite failed to resolve 'that' properly")
        else:
            print("❌ Gate failed to detect pronoun reference!")
            
    except Exception as e:
        print(f"❌ Error testing real case: {e}")

if __name__ == "__main__":
    asyncio.run(test_real_gate_decisions())
