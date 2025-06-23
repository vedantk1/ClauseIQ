#!/usr/bin/env python3
"""
Debug script to trace the conversational RAG pipeline step by step.
This will help us identify where the pronoun resolution is failing.
"""
import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.rag_service import RAGService
import openai

async def debug_conversation_flow():
    """Debug the exact conversation flow that's failing."""
    
    print("🔍 DEBUGGING CONVERSATIONAL RAG PIPELINE")
    print("=" * 60)
    
    # Simulate the exact conversation from the screenshot
    conversation_history = [
        {
            "role": "user",
            "content": "summarize the document",
            "timestamp": "2024-06-23T16:36:07Z"
        },
        {
            "role": "assistant", 
            "content": "The document is an Employment Agreement between Orion Tech Solutions Ltd and Jane Elizabeth Carter, outlining terms and conditions of employment. It covers aspects such as commencement and term of employment, position and duties, place of work, probationary period, hours of work, remuneration, annual bonus, holidays, sickness absence, pension, confidentiality, intellectual property, data protection, restrictive covenants, termination, disciplinary and grievance procedures, notice, governing law and jurisdiction, entire agreement, severability, variation, and counterparts. The agreement is governed by the laws of England and Wales, and both parties agree to the exclusive jurisdiction of the courts of England and Wales.",
            "sources": ["chunk_1", "chunk_2", "chunk_3", "chunk_4", "chunk_5"],
            "timestamp": "2024-06-23T16:36:10Z"
        }
    ]
    
    problematic_query = "tell me about that in detail"
    
    print(f"📝 CONVERSATION HISTORY:")
    for i, msg in enumerate(conversation_history):
        print(f"   {i+1}. {msg['role'].upper()}: {msg['content'][:100]}...")
    
    print(f"\n❓ PROBLEMATIC QUERY: '{problematic_query}'")
    print(f"   Expected: Should refer to the Employment Agreement")
    
    # Initialize RAG service
    rag_service = RAGService()
    
    print(f"\n🚪 STEP 1: Gate Decision")
    print("-" * 30)
    
    try:
        needs_context = await rag_service._needs_conversation_context(problematic_query)
        print(f"   Gate result: {needs_context}")
        print(f"   Expected: True (contains pronoun 'that')")
        
        if not needs_context:
            print("   ❌ GATE FAILURE: Should detect 'that' as needing context!")
            print("   🔧 Let's test the gate prompt directly...")
            
            # Test gate prompt directly
            from utils.openai_client import _get_openai_client
            client = _get_openai_client()
            
            gate_prompt = """Analyze if this user question requires previous conversation context to be understood correctly.

Return only "YES" if the question contains:
- Pronouns referring to previous topics ("that", "it", "those", "this")
- References to earlier discussion ("as we discussed", "you mentioned", "from before")
- Comparative language needing context ("compare that to", "how does this differ")
- Follow-up requests ("tell me more", "explain further", "give details")

Return only "NO" if the question is standalone and can be answered independently.

Question: "tell me about that in detail"

Response (YES or NO only):"""

            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": gate_prompt}],
                max_tokens=10,
                temperature=0.0
            )
            
            direct_result = response.choices[0].message.content.strip().upper()
            print(f"   🧪 Direct gate test: {direct_result}")
            
    except Exception as e:
        print(f"   ❌ Gate error: {e}")
        return
    
    print(f"\n✏️  STEP 2: Query Rewriting")
    print("-" * 30)
    
    if needs_context:
        try:
            rewritten = await rag_service._rewrite_query_with_context(problematic_query, conversation_history)
            print(f"   Original: '{problematic_query}'")
            print(f"   Rewritten: '{rewritten}'")
            print(f"   Expected: Should mention 'Employment Agreement' or similar")
            
            if "employment" not in rewritten.lower() and "agreement" not in rewritten.lower():
                print("   ❌ REWRITE FAILURE: Doesn't properly resolve 'that' to Employment Agreement!")
        except Exception as e:
            print(f"   ❌ Rewrite error: {e}")
            return
    else:
        rewritten = problematic_query
        print(f"   Skipped (gate said no context needed)")
    
    print(f"\n🔍 STEP 3: Vector Search")
    print("-" * 30)
    
    # Mock document and user for testing
    document_id = "test_doc_123"
    user_id = "test_user_456"
    
    try:
        # This will fail because we don't have actual Pinecone setup, but let's see the query processing
        result = await rag_service.retrieve_relevant_chunks(
            problematic_query, document_id, user_id, conversation_history
        )
        
        print(f"   Enhanced query: '{result['enhanced_query']}'")
        print(f"   Chunks found: {len(result['chunks'])}")
        
        if len(result['chunks']) == 0:
            print("   ❌ NO CHUNKS FOUND: Vector search failed!")
        
    except Exception as e:
        print(f"   ⚠️  Vector search error (expected): {e}")
        print(f"   📊 Enhanced query would be: '{rewritten if needs_context else problematic_query}'")
    
    print(f"\n🎯 DIAGNOSIS")
    print("=" * 30)
    print(f"   The issue is likely in:")
    print(f"   1. Gate not detecting 'that' properly")
    print(f"   2. Rewrite not resolving to 'Employment Agreement'") 
    print(f"   3. Vector search not finding relevant chunks")
    print(f"   4. Or combination of above")

if __name__ == "__main__":
    asyncio.run(debug_conversation_flow())
