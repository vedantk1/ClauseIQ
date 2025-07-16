#!/usr/bin/env python3
"""
Check all users in ClauseIQ system (both with and without documents).
"""
import asyncio
import os
import sys
from typing import Dict, Any, Set

# Add backend to path dynamically
backend_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend')
sys.path.append(backend_path)

from database.service import get_document_service
from services.pinecone_vector_service import get_pinecone_vector_service
from config.logging import get_foundational_logger

logger = get_foundational_logger("user_check")

async def check_all_users():
    """Check all users in the system regardless of document ownership."""
    try:
        print("🔍 Checking all users in ClauseIQ system...")
        
        # Get document service
        doc_service = get_document_service()
        db = await doc_service._get_db()
        
        # Check users collection
        print("\n📊 Step 1: Checking users collection...")
        users_collection = db._get_collection("users")
        all_users = await users_collection.find({}).to_list(length=1000)
        
        print(f"👥 Found {len(all_users)} users in users collection:")
        
        user_emails = {}
        user_ids = set()
        
        for user in all_users:
            user_id = user.get('id', 'unknown')
            email = user.get('email', 'unknown')
            created = user.get('created_at', 'unknown')
            last_login = user.get('last_login_at', 'never')
            
            user_emails[user_id] = email
            user_ids.add(user_id)
            
            print(f"   🔹 {email}")
            print(f"      ID: {user_id}")
            print(f"      Created: {created}")
            print(f"      Last Login: {last_login}")
        
        # Check documents collection for users
        print(f"\n📊 Step 2: Checking document ownership...")
        documents_collection = db._get_collection("documents")
        all_docs = await documents_collection.find({}).to_list(length=1000)
        
        doc_users = set()
        doc_user_counts = {}
        
        for doc in all_docs:
            user_id = doc.get('user_id')
            if user_id:
                doc_users.add(user_id)
                doc_user_counts[user_id] = doc_user_counts.get(user_id, 0) + 1
        
        print(f"📄 Found documents owned by {len(doc_users)} users:")
        for user_id in doc_users:
            email = user_emails.get(user_id, 'unknown email')
            count = doc_user_counts.get(user_id, 0)
            print(f"   📄 {email} ({user_id}): {count} documents")
        
        # Check Pinecone for user namespaces
        print(f"\n📊 Step 3: Checking Pinecone namespaces...")
        pinecone_service = get_pinecone_vector_service()
        
        pinecone_users = set()
        pinecone_data = {}
        
        if await pinecone_service.initialize():
            storage_info = await pinecone_service.get_total_storage_usage()
            namespaces = storage_info.get('namespaces', {})
            
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
                    
                    pinecone_data[user_id] = count
            
            print(f"🗂️ Found Pinecone data for {len(pinecone_users)} users:")
            for user_id in pinecone_users:
                email = user_emails.get(user_id, 'unknown email')
                vector_count = pinecone_data.get(user_id, 0)
                print(f"   🗂️ {email} ({user_id}): {vector_count} vectors")
        
        # Summary analysis
        print(f"\n📊 Step 4: User data summary...")
        
        all_system_users = user_ids | doc_users | pinecone_users
        
        print(f"🔍 Total unique users in system: {len(all_system_users)}")
        print(f"   Users table: {len(user_ids)}")
        print(f"   Document owners: {len(doc_users)}")
        print(f"   Pinecone namespaces: {len(pinecone_users)}")
        
        # Find the admin user
        admin_email = "clauseiq@gmail.com"
        admin_user_id = None
        
        for user_id, email in user_emails.items():
            if email == admin_email:
                admin_user_id = user_id
                break
        
        print(f"\n🔍 Step 5: Admin user analysis...")
        if admin_user_id:
            print(f"✅ Found admin user: {admin_email}")
            print(f"   ID: {admin_user_id}")
            print(f"   Documents: {doc_user_counts.get(admin_user_id, 0)}")
            print(f"   Vectors: {pinecone_data.get(admin_user_id, 0)}")
        else:
            print(f"❌ Admin user {admin_email} NOT FOUND in users table!")
            print(f"   This could be a problem - we need to identify the correct admin user")
        
        # Identify users to remove
        print(f"\n🗑️ Step 6: Users to remove (keep only admin)...")
        
        users_to_remove = set()
        
        for user_id in all_system_users:
            email = user_emails.get(user_id, 'unknown')
            if email != admin_email:
                users_to_remove.add(user_id)
        
        if users_to_remove:
            print(f"⚠️  Found {len(users_to_remove)} users to remove:")
            
            total_docs_to_remove = 0
            total_vectors_to_remove = 0
            
            for user_id in users_to_remove:
                email = user_emails.get(user_id, 'unknown email')
                docs = doc_user_counts.get(user_id, 0)
                vectors = pinecone_data.get(user_id, 0)
                
                total_docs_to_remove += docs
                total_vectors_to_remove += vectors
                
                print(f"   🗑️ {email} ({user_id})")
                print(f"      Documents: {docs}")
                print(f"      Vectors: {vectors}")
            
            print(f"\n📊 Total data to remove:")
            print(f"   Users: {len(users_to_remove)}")
            print(f"   Documents: {total_docs_to_remove}")
            print(f"   Vectors: {total_vectors_to_remove}")
            
        else:
            print("✅ No users to remove - only admin user exists!")
        
        # Final recommendations
        print(f"\n💡 Recommendations:")
        if not admin_user_id:
            print("⚠️  CRITICAL: Admin user not found! Please verify the correct admin email.")
        elif users_to_remove:
            print("🧹 Run cleanup script to remove non-admin users and their data")
            print("   1. Delete user documents from MongoDB")
            print("   2. Delete user vectors from Pinecone")
            print("   3. Delete user records from users table")
        else:
            print("✅ System is clean - only admin user exists")
        
        print("\n✅ User check completed successfully!")
        
        return {
            'admin_user_id': admin_user_id,
            'users_to_remove': users_to_remove,
            'user_emails': user_emails,
            'doc_user_counts': doc_user_counts,
            'pinecone_data': pinecone_data
        }
        
    except Exception as e:
        print(f"❌ Error checking users: {e}")
        logger.error(f"Error in user check: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    asyncio.run(check_all_users())
