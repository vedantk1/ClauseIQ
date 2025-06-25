#!/usr/bin/env python3
"""
Check MongoDB document data for ClauseIQ and compare with Pinecone.
"""
import asyncio
import os
import sys
from typing import Dict, Any

# Add backend to path
sys.path.append('/Users/vedan/Downloads/clauseiq-project/backend')

from database.service import get_document_service
from services.pinecone_vector_service import get_pinecone_vector_service
from config.logging import get_foundational_logger

logger = get_foundational_logger("mongodb_check")

async def check_mongodb_documents():
    """Check what documents are stored in MongoDB."""
    try:
        print("🔍 Checking MongoDB document storage...")
        
        # Get document service
        doc_service = get_document_service()
        
        # First, let's get the MongoDB adapter directly to check all documents
        db = await doc_service._get_db()
        
        # Get all documents from MongoDB (this is a bit of a hack since we need user_id normally)
        documents_collection = db._get_collection("documents")
        all_docs = await documents_collection.find({}).to_list(length=1000)
        
        print(f"📄 Found {len(all_docs)} documents in MongoDB")
        
        if not all_docs:
            print("   No documents found in MongoDB")
            return
        
        # Group by user
        users = {}
        for doc in all_docs:
            user_id = doc.get('user_id', 'unknown')
            if user_id not in users:
                users[user_id] = []
            users[user_id].append(doc)
        
        print(f"\n👥 Users in MongoDB: {len(users)}")
        
        # Show details for each user
        for user_id, user_docs in users.items():
            print(f"\n🔹 User: {user_id}")
            print(f"   Documents: {len(user_docs)}")
            
            for doc in user_docs:
                doc_id = doc.get('id', 'unknown')
                title = doc.get('title', 'Untitled')
                created = doc.get('created_at', 'unknown')
                rag_processed = doc.get('rag_processed', False)
                
                print(f"   📄 {title}")
                print(f"      ID: {doc_id}")
                print(f"      Created: {created}")
                print(f"      RAG Processed: {rag_processed}")
                
                # Check if doc has clauses
                clauses = doc.get('clauses', [])
                if clauses:
                    print(f"      Clauses: {len(clauses)}")
                
                # Check file info
                if 'file_info' in doc:
                    file_info = doc['file_info']
                    print(f"      File: {file_info.get('filename', 'unknown')}")
                    print(f"      Size: {file_info.get('size', 0)} bytes")
        
        # Now check Pinecone for comparison
        print(f"\n🔍 Comparing with Pinecone data...")
        
        pinecone_service = get_pinecone_vector_service()
        if await pinecone_service.initialize():
            storage_info = await pinecone_service.get_total_storage_usage()
            namespaces = storage_info.get('namespaces', {})
            
            print(f"📊 Pinecone namespaces: {len(namespaces)}")
            
            for namespace, info in namespaces.items():
                if namespace.startswith('user_'):
                    user_id_from_namespace = namespace.replace('user_', '')
                    
                    # Get vector count
                    try:
                        if hasattr(info, 'vector_count'):
                            count = int(info.vector_count)
                        elif isinstance(info, dict):
                            count = info.get('vector_count', 0)
                        else:
                            count = int(info) if info else 0
                    except:
                        count = 0
                    
                    print(f"   🔹 {user_id_from_namespace}: {count} vectors")
                    
                    # Check if this user exists in MongoDB
                    if user_id_from_namespace in users:
                        mongo_docs = len(users[user_id_from_namespace])
                        print(f"      ✅ Has {mongo_docs} documents in MongoDB")
                    else:
                        print(f"      ⚠️  No documents found in MongoDB for this user")
        
        # Check for orphaned data
        print(f"\n🔍 Checking for data consistency...")
        
        # MongoDB users vs Pinecone namespaces
        mongo_users = set(users.keys())
        pinecone_users = set()
        
        if namespaces:
            for namespace in namespaces.keys():
                if namespace.startswith('user_'):
                    pinecone_users.add(namespace.replace('user_', ''))
        
        orphaned_mongo = mongo_users - pinecone_users
        orphaned_pinecone = pinecone_users - mongo_users
        
        if orphaned_mongo:
            print(f"⚠️  Users with MongoDB docs but no Pinecone data: {orphaned_mongo}")
        
        if orphaned_pinecone:
            print(f"⚠️  Users with Pinecone data but no MongoDB docs: {orphaned_pinecone}")
        
        if not orphaned_mongo and not orphaned_pinecone:
            print("✅ Data consistency looks good - all users have both MongoDB and Pinecone data")
        
        print("\n✅ MongoDB check completed successfully!")
        
    except Exception as e:
        print(f"❌ Error checking MongoDB documents: {e}")
        logger.error(f"Error in MongoDB check: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(check_mongodb_documents())
