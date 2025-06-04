#!/usr/bin/env python3
"""
Migration script to add preferred_model field to existing users.
This script adds the default AI model preference to all existing users who don't have it.
"""

import sys
import os
from datetime import datetime

# Add the backend directory to Python path
backend_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend')
sys.path.append(backend_path)

# Change to backend directory for imports
os.chdir(backend_path)

from database import get_mongo_storage, DEFAULT_MODEL, AVAILABLE_MODELS

def migrate_user_preferences():
    """Add preferred_model field to existing users."""
    try:
        storage = get_mongo_storage()
        
        # Get all users from the database
        users_collection = storage.db.users_collection
        
        # Find users without preferred_model field
        users_without_model = users_collection.find({"preferred_model": {"$exists": False}})
        users_list = list(users_without_model)
        
        if not users_list:
            print("✅ All users already have preferred_model field")
            return
        
        print(f"🔄 Found {len(users_list)} users without preferred_model field")
        
        # Update users with default model
        update_data = {
            'preferred_model': DEFAULT_MODEL,
            'updated_at': datetime.utcnow().isoformat()
        }
        
        result = users_collection.update_many(
            {"preferred_model": {"$exists": False}},
            {"$set": update_data}
        )
        
        print(f"✅ Successfully updated {result.modified_count} users with default model: {DEFAULT_MODEL}")
        
        # Verify the migration
        total_users = users_collection.count_documents({})
        users_with_model = users_collection.count_documents({"preferred_model": {"$exists": True}})
        
        print(f"📊 Migration Summary:")
        print(f"   - Total users: {total_users}")
        print(f"   - Users with preferred_model: {users_with_model}")
        print(f"   - Available models: {', '.join(AVAILABLE_MODELS)}")
        
        if total_users == users_with_model:
            print("✅ Migration completed successfully!")
        else:
            print("❌ Migration incomplete - some users still missing preferred_model field")
            
    except Exception as e:
        print(f"❌ Error during migration: {e}")
        raise

def list_current_user_models():
    """List all users and their current preferred models."""
    try:
        storage = get_mongo_storage()
        users_collection = storage.db.users_collection
        
        users = users_collection.find({}, {"email": 1, "full_name": 1, "preferred_model": 1, "_id": 0})
        
        print("\n📋 Current User Model Preferences:")
        print("-" * 60)
        
        for user in users:
            model = user.get('preferred_model', 'NOT SET')
            print(f"  {user['email']} ({user['full_name']}) → {model}")
        
        print("-" * 60)
        
    except Exception as e:
        print(f"❌ Error listing users: {e}")

def main():
    """Main migration function."""
    print("🚀 ClauseIQ User Preferences Migration")
    print("=" * 50)
    
    try:
        # Show current state
        list_current_user_models()
        
        # Run migration
        migrate_user_preferences()
        
        # Show final state
        list_current_user_models()
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
