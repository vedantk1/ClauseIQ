#!/usr/bin/env python3
"""
Script to list all user accounts in the ClauseIQ MongoDB database
"""
import os
import sys
from pymongo import MongoClient
from datetime import datetime
import json

# Add the backend directory to the path so we can import config
sys.path.append('/Users/vedan/Downloads/clauseiq-project/backend')

from config import MONGODB_URI, MONGODB_DATABASE

def connect_to_mongodb():
    """Connect to MongoDB and return the database"""
    try:
        client = MongoClient(MONGODB_URI)
        # Test the connection
        client.admin.command('ismaster')
        db = client[MONGODB_DATABASE]
        print(f"✅ Connected to MongoDB database: {MONGODB_DATABASE}")
        return db
    except Exception as e:
        print(f"❌ Failed to connect to MongoDB: {e}")
        return None

def list_all_users(db):
    """List all users in the database"""
    try:
        users_collection = db["users"]
        
        # Get all users
        users = list(users_collection.find({}))
        
        if not users:
            print("\n📭 No user accounts found in the database.")
            return
        
        print(f"\n👥 Found {len(users)} user account(s):")
        print("=" * 80)
        
        for i, user in enumerate(users, 1):
            # Remove MongoDB's internal _id field for display
            user.pop('_id', None)
            
            print(f"\n🔹 User #{i}")
            print(f"   ID: {user.get('id', 'N/A')}")
            print(f"   Email: {user.get('email', 'N/A')}")
            print(f"   Full Name: {user.get('full_name', 'N/A')}")
            print(f"   Created: {user.get('created_at', 'N/A')}")
            print(f"   Updated: {user.get('updated_at', 'N/A')}")
            print(f"   Password: {'****** (hashed)' if user.get('hashed_password') else 'No password set'}")
            
            # Check if there are any additional fields
            expected_fields = {'id', 'email', 'full_name', 'created_at', 'updated_at', 'hashed_password'}
            extra_fields = set(user.keys()) - expected_fields
            if extra_fields:
                print(f"   Additional fields: {', '.join(extra_fields)}")
        
        print("\n" + "=" * 80)
        
    except Exception as e:
        print(f"❌ Error retrieving users: {e}")

def get_collection_stats(db):
    """Get statistics about the users collection"""
    try:
        users_collection = db["users"]
        
        # Get collection stats
        stats = db.command("collStats", "users")
        user_count = users_collection.count_documents({})
        
        print(f"\n📊 Collection Statistics:")
        print(f"   Collection: users")
        print(f"   Total Documents: {user_count}")
        print(f"   Storage Size: {stats.get('storageSize', 0)} bytes")
        print(f"   Index Count: {stats.get('nindexes', 0)}")
        
        # Get indexes
        indexes = list(users_collection.list_indexes())
        print(f"\n🔍 Indexes:")
        for idx in indexes:
            print(f"   - {idx.get('name', 'unnamed')}: {idx.get('key', {})}")
        
    except Exception as e:
        print(f"❌ Error getting collection stats: {e}")

def main():
    print("🔍 ClauseIQ User Account Viewer")
    print("=" * 50)
    
    # Connect to database
    db = connect_to_mongodb()
    if db is None:
        return
    
    # List all users
    list_all_users(db)
    
    # Show collection statistics
    get_collection_stats(db)
    
    print(f"\n✅ Account listing completed at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

if __name__ == "__main__":
    main()
