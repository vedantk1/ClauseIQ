#!/usr/bin/env python3
"""
Simple test to identify the conversational RAG issue.
"""

def test_gate_logic():
    """Test if our gate prompt logic is sound."""
    
    print("🔍 TESTING GATE PROMPT LOGIC")
    print("=" * 50)
    
    # Test queries that should trigger context
    should_need_context = [
        "tell me about that in detail",
        "is that enforceable?", 
        "what does it mean?",
        "how does this work?",
        "tell me more",
        "explain further",
        "as we discussed",
        "you mentioned earlier"
    ]
    
    # Test queries that should NOT trigger context  
    should_not_need_context = [
        "what are the payment terms?",
        "summarize the document",
        "who are the parties?",
        "what is the effective date?",
        "this contract looks good"  # "this" referring to document itself
    ]
    
    print("❓ QUERIES THAT SHOULD NEED CONTEXT:")
    for query in should_need_context:
        has_pronouns = any(pronoun in query.lower() for pronoun in ["that", "it", "this", "those"])
        has_references = any(ref in query.lower() for ref in ["tell me more", "explain further", "as we discussed", "mentioned"])
        
        should_trigger = has_pronouns or has_references
        print(f"   '{query}' → Should trigger: {should_trigger}")
        
        if not should_trigger:
            print(f"      ❌ Our logic would miss this!")
    
    print(f"\n✅ QUERIES THAT SHOULD NOT NEED CONTEXT:")
    for query in should_not_need_context:
        has_pronouns = any(pronoun in query.lower() for pronoun in ["that", "it", "those"]) 
        # "this" is tricky - "this contract" is standalone, but "this" alone needs context
        has_this_reference = "this" in query.lower() and not any(word in query.lower() for word in ["contract", "document", "agreement"])
        has_references = any(ref in query.lower() for ref in ["tell me more", "explain further", "as we discussed", "mentioned"])
        
        should_trigger = has_pronouns or has_this_reference or has_references
        print(f"   '{query}' → Should trigger: {should_trigger}")
        
        if should_trigger:
            print(f"      ❌ Our logic would incorrectly trigger!")

def analyze_problem_query():
    """Analyze the specific failing query."""
    
    print(f"\n🎯 ANALYZING THE PROBLEM")
    print("=" * 50)
    
    problem_query = "tell me about that in detail"
    
    print(f"Query: '{problem_query}'")
    print(f"Contains 'that': {'that' in problem_query.lower()}")
    print(f"Contains 'tell me more' pattern: {'tell me' in problem_query.lower()}")
    print(f"Should DEFINITELY need context: TRUE")
    
    print(f"\nPossible issues:")
    print(f"1. Gate prompt not working properly")
    print(f"2. Query rewrite not resolving 'that' correctly")
    print(f"3. Vector search not finding chunks for rewritten query")
    print(f"4. Empty chunks passed to final LLM")

def propose_fixes():
    """Propose fixes for the issues."""
    
    print(f"\n🔧 PROPOSED FIXES")
    print("=" * 50)
    
    print(f"1. IMPROVE GATE PROMPT:")
    print(f"   - More explicit about pronouns")
    print(f"   - Add specific examples")
    print(f"   - Test with edge cases")
    
    print(f"\n2. IMPROVE REWRITE PROMPT:")
    print(f"   - Better context extraction")
    print(f"   - More specific instructions")
    print(f"   - Focus on main document topics")
    
    print(f"\n3. ADD BETTER LOGGING:")
    print(f"   - Log each step of the pipeline")
    print(f"   - Show what queries are being passed")
    print(f"   - Track chunk retrieval")
    
    print(f"\n4. ADD FALLBACK LOGIC:")
    print(f"   - If no chunks found, try broader search")
    print(f"   - Graceful degradation")

if __name__ == "__main__":
    test_gate_logic()
    analyze_problem_query() 
    propose_fixes()
