#!/usr/bin/env python3
"""
Migration script to transfer documents from JSON files to MongoDB.
This script reads existing JSON files in the documents_storage directory
and inserts them into the MongoDB collection.
"""

import os
import json
import sys
from pathlib import Path

# Add the backend directory to the path so we can import our modules
backend_dir = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from database import get_mongo_storage
from settings import get_settings

def migrate_json_to_mongodb():
    """Migrate all JSON files from local storage to MongoDB."""
    
    settings = get_settings()
    storage_dir = settings.file_upload.storage_dir
    
    if not os.path.exists(storage_dir):
        print(f"Storage directory {storage_dir} does not exist. No migration needed.")
        return
    
    json_files = [f for f in os.listdir(storage_dir) if f.endswith('.json')]
    
    if not json_files:
        print(f"No JSON files found in {storage_dir}. No migration needed.")
        return
    
    print(f"Found {len(json_files)} JSON files to migrate...")
    
    # Get MongoDB storage instance
    mongo_storage = get_mongo_storage()
    
    migrated_count = 0
    error_count = 0
    
    for filename in json_files:
        filepath = os.path.join(storage_dir, filename)
        try:
            # Read the JSON file
            with open(filepath, 'r') as f:
                document = json.load(f)
            
            # Ensure the document has required fields
            if 'id' not in document:
                print(f"Warning: Document {filename} missing 'id' field. Skipping.")
                error_count += 1
                continue
            
            # Save to MongoDB
            doc_id = mongo_storage.save_document(document)
            print(f"✓ Migrated document {doc_id} from {filename}")
            migrated_count += 1
            
        except json.JSONDecodeError as e:
            print(f"✗ Error reading JSON file {filename}: {e}")
            error_count += 1
        except Exception as e:
            print(f"✗ Error migrating {filename}: {e}")
            error_count += 1
    
    print(f"\nMigration completed!")
    print(f"Successfully migrated: {migrated_count} documents")
    print(f"Errors: {error_count} documents")
    
    if migrated_count > 0:
        print(f"\nYou can now safely remove the JSON files from {storage_dir}")
        print("To backup existing files: mkdir backup && mv *.json backup/")

def verify_migration():
    """Verify that all documents were migrated correctly."""
    print("\nVerifying migration...")
    
    settings = get_settings()
    storage_dir = settings.file_upload.storage_dir
    
    try:
        # Get all documents from MongoDB
        all_docs = mongo_storage.get_all_documents()
        print(f"Total documents in MongoDB: {len(all_docs)}")
        
        # Count JSON files
        if os.path.exists(storage_dir):
            json_count = len([f for f in os.listdir(storage_dir) if f.endswith('.json')])
            print(f"JSON files remaining: {json_count}")
            
            if json_count > 0 and len(all_docs) >= json_count:
                print("✓ Migration appears successful. Consider backing up and removing JSON files.")
            elif json_count > 0:
                print("⚠ Some documents may not have been migrated. Please check the logs above.")
        
        # Show a few sample documents
        if all_docs:
            print(f"\nSample document IDs in MongoDB:")
            for i, doc in enumerate(all_docs[:3]):
                print(f"  - {doc.get('id', 'No ID')} ({doc.get('filename', 'No filename')})")
                if i >= 2:
                    break
                    
    except Exception as e:
        print(f"Error during verification: {e}")

if __name__ == "__main__":
    print("Legal AI - JSON to MongoDB Migration Script")
    print("=" * 50)
    
    try:
        # Test MongoDB connection
        mongo_storage = get_mongo_storage()
        count = mongo_storage.get_documents_count()
        print(f"✓ MongoDB connection successful. Current document count: {count}")
        
        # Perform migration
        migrate_json_to_mongodb()
        
        # Verify migration
        verify_migration()
        
    except Exception as e:
        print(f"✗ Migration failed: {e}")
        print("Please ensure MongoDB is running and accessible.")
        sys.exit(1)
