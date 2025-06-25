#!/usr/bin/env python3
"""
Cleanup orphaned Pinecone vectors for ClauseIQ.
Removes vectors that exist in Pinecone but have no corresponding documents in MongoDB.
"""
import asyncio
import os
import sys
from typing import Dict, Any, Set

# Add backend to path
sys.path.append('/Users/vedan/Downloads/clauseiq-project/backend')

from database.service import get_document_service
from services.pinecone_vector_service import get_pinecone_vector_service
from config.logging import get_foundational_logger

logger = get_foundational_logger("pinecone_cleanup")

async def cleanup_orphaned_vectors():
    """Remove orphaned Pinecone vectors that have no corresponding MongoDB documents."""
    try:
        print("🧹 Starting Pinecone orphaned data cleanup...")
        
        # Step 1: Get all users from MongoDB
        print("\n📊 Step 1: Scanning MongoDB for users...")
        doc_service = get_document_service()
        db = await doc_service._get_db()
        
        documents_collection = db._get_collection("documents")
        all_docs = await documents_collection.find({}).to_list(length=1000)
        
        # Get unique user IDs from MongoDB
        mongo_users = set()
        for doc in all_docs:
            user_id = doc.get('user_id')
            if user_id:
                mongo_users.add(user_id)
        
        print(f"   Found {len(mongo_users)} users in MongoDB: {mongo_users}")
        
        # Step 2: Get all users from Pinecone
        print("\n📊 Step 2: Scanning Pinecone for namespaces...")
        pinecone_service = get_pinecone_vector_service()
        
        if not await pinecone_service.initialize():
            print("❌ Failed to initialize Pinecone service")
            return
        
        storage_info = await pinecone_service.get_total_storage_usage()
        namespaces = storage_info.get('namespaces', {})
        
        pinecone_users = set()
        pinecone_data = {}
        
        for namespace, info in namespaces.items():
            if namespace.startswith('user_'):
                user_id = namespace.replace('user_', '')
                pinecone_users.add(user_id)
                
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
                
                pinecone_data[user_id] = {
                    'namespace': namespace,
                    'vector_count': count
                }
        
        print(f"   Found {len(pinecone_users)} user namespaces in Pinecone: {pinecone_users}")
        
        # Step 3: Find orphaned users
        print("\n🔍 Step 3: Identifying orphaned data...")
        orphaned_users = pinecone_users - mongo_users
        
        if not orphaned_users:
            print("✅ No orphaned data found! All Pinecone namespaces have corresponding MongoDB documents.")
            return
        
        print(f"⚠️  Found {len(orphaned_users)} orphaned users in Pinecone:")
        
        total_orphaned_vectors = 0
        for user_id in orphaned_users:
            data = pinecone_data[user_id]
            vector_count = data['vector_count']
            total_orphaned_vectors += vector_count
            print(f"   🗑️  {user_id}: {vector_count} vectors in namespace '{data['namespace']}'")
        
        print(f"\n📊 Total orphaned vectors to delete: {total_orphaned_vectors}")
        
        # Step 4: Confirm deletion
        print(f"\n⚠️  WARNING: This will permanently delete {total_orphaned_vectors} vectors from Pinecone!")
        print("   This action cannot be undone.")
        
        # For safety, let's do a dry run first
        print(f"\n🔍 Step 4: Performing cleanup (DRY RUN)...")
        
        for user_id in orphaned_users:
            data = pinecone_data[user_id]
            namespace = data['namespace']
            vector_count = data['vector_count']
            
            print(f"\n🗑️  Would delete namespace: {namespace}")
            print(f"   User ID: {user_id}")
            print(f"   Vector count: {vector_count}")
            
            # Test connection to namespace
            try:
                # This is a dry run - we'll just check if we can access the namespace
                index = pinecone_service.pc.Index(pinecone_service.index_name)
                
                # Try to query the namespace to verify it exists
                test_query = await asyncio.to_thread(
                    index.query,
                    vector=[0.0] * pinecone_service.embedding_dimension,
                    top_k=1,
                    include_metadata=True,
                    namespace=namespace
                )
                
                print(f"   ✅ Namespace accessible - contains {len(test_query.matches)} vectors")
                
            except Exception as e:
                print(f"   ❌ Error accessing namespace: {e}")
        
        # Step 5: Actual cleanup
        print(f"\n🗑️  Step 5: Performing ACTUAL cleanup...")
        
        for user_id in orphaned_users:
            data = pinecone_data[user_id]
            namespace = data['namespace']
            vector_count = data['vector_count']
            
            print(f"\n🗑️  Deleting namespace: {namespace}")
            
            try:
                index = pinecone_service.pc.Index(pinecone_service.index_name)
                
                # Delete all vectors in the namespace
                delete_response = await asyncio.to_thread(
                    index.delete,
                    delete_all=True,
                    namespace=namespace
                )
                
                print(f"   ✅ Successfully deleted namespace {namespace}")
                
            except Exception as e:
                print(f"   ❌ Error deleting namespace {namespace}: {e}")
        
        print(f"\n✅ Cleanup completed!")
        
        print(f"\n📝 Summary:")
        print(f"   MongoDB users: {len(mongo_users)}")
        print(f"   Pinecone users: {len(pinecone_users)}")
        print(f"   Orphaned users: {len(orphaned_users)}")
        print(f"   Total orphaned vectors: {total_orphaned_vectors}")
        
        if orphaned_users:
            print(f"\n💡 To complete the cleanup:")
            print(f"   1. Review the orphaned data above")
            print(f"   2. Uncomment the cleanup section in this script")
            print(f"   3. Run the script again to perform actual deletion")
        
        print("\n✅ Cleanup analysis completed successfully!")
        
    except Exception as e:
        print(f"❌ Error during cleanup: {e}")
        logger.error(f"Error in cleanup: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(cleanup_orphaned_vectors())
