#!/usr/bin/env python3
"""
Cleanup script to remove all legacy chat_sessions arrays from documents.
This migrates to the foundational single-session-per-document architecture.
"""

import asyncio
from database.service import get_document_service
from config.environments import get_environment_config

async def cleanup_legacy_chat_sessions():
    """Remove all legacy chat_sessions arrays and chat_session objects from documents."""
    config = get_environment_config()
    service = get_document_service()
    
    print("🧹 Starting cleanup of legacy chat sessions...")
    
    try:
        # Get all documents to see what we're working with
        all_docs = await service.get_all_documents_for_cleanup()
        print(f"📄 Found {len(all_docs)} documents to check")
        
        cleaned_count = 0
        session_count = 0
        
        for doc in all_docs:
            doc_id = str(doc["_id"])
            user_id = doc.get("user_id")
            filename = doc.get("filename", "unknown")
            
            # Count legacy sessions
            legacy_sessions = doc.get("chat_sessions", [])
            foundational_session = doc.get("chat_session")
            
            if legacy_sessions:
                session_count += len(legacy_sessions)
                print(f"  📋 {filename}: {len(legacy_sessions)} legacy sessions")
            
            if foundational_session:
                print(f"  🎯 {filename}: has foundational session")
            
            # Remove both legacy and foundational sessions - clean slate
            if legacy_sessions or foundational_session:
                await service.cleanup_document_sessions(doc_id)
                cleaned_count += 1
                print(f"  ✅ Cleaned {filename}")
        
        print(f"\n🎉 Cleanup complete!")
        print(f"   📊 Documents processed: {len(all_docs)}")
        print(f"   🧹 Documents cleaned: {cleaned_count}")
        print(f"   💬 Legacy sessions removed: {session_count}")
        print(f"\n🚀 All documents now use foundational architecture only!")
        
    except Exception as e:
        print(f"❌ Error during cleanup: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(cleanup_legacy_chat_sessions())
