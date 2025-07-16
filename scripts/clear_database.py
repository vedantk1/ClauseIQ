#!/usr/bin/env python3
"""
🧹 FOUNDATIONAL ARCHITECTURE DATABASE CLEANER
Clear all existing documents and chat data for clean foundational deployment!
"""
import asyncio
import sys
import os

# Add backend to path dynamically
backend_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend')
sys.path.append(backend_path)

from database.factory import DatabaseFactory
from services.pinecone_vector_service import get_pinecone_vector_service

async def clear_all_data():
    """Clear all documents, chat sessions, and vector data for fresh start!"""
    
    print("🧹 FOUNDATIONAL ARCHITECTURE: CLEARING ALL DATA")
    print("=" * 60)
    
    try:
        # Get database connection
        db = await DatabaseFactory.get_database()
        print("✅ Connected to MongoDB")
        
        # Clear all documents
        print("\n🗑️  Clearing all documents...")
        documents_collection = db._get_collection("documents")
        result = await documents_collection.delete_many({})
        print(f"✅ Deleted {result.deleted_count} documents")
        
        # Clear all chat sessions 
        print("\n🗑️  Clearing all chat sessions...")
        chat_collection = db._get_collection("chat_sessions")
        chat_result = await chat_collection.delete_many({})
        print(f"✅ Deleted {chat_result.deleted_count} chat sessions")
        
        # Clear vector database
        print("\n🗑️  Clearing vector database...")
        vector_service = get_pinecone_vector_service()
        if await vector_service.is_available():
            # Get all vector IDs and delete them
            try:
                # This will clear all vectors in the index
                await vector_service.delete_all_vectors()
                print("✅ Cleared all vectors from Pinecone")
            except Exception as e:
                print(f"⚠️  Vector clearing: {e}")
        else:
            print("⚠️  Vector service not available")
        
        print("\n🚀 DATABASE CLEARED! READY FOR FOUNDATIONAL ARCHITECTURE!")
        print("✨ Upload new documents to test the one-session-per-document system!")
        
    except Exception as e:
        print(f"💥 Error clearing database: {e}")
        return False
    
    return True

if __name__ == "__main__":
    success = asyncio.run(clear_all_data())
    if success:
        print("\n🎯 MISSION ACCOMPLISHED: Database cleared for foundational deployment!")
    else:
        print("\n❌ MISSION FAILED: Error clearing database")
        sys.exit(1)
