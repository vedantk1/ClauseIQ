#!/usr/bin/env python3
"""
Update Existing Documents Contract Types Script

This script retroactively detects and updates contract types for existing documents
in the database using the LLM-based contract type detection system.

This addresses the issue where all existing documents were migrated with 
contract_type: "other" but should have their actual contract types detected.
"""

import asyncio
import sys
import os
from pathlib import Path
import logging
from typing import List, Dict, Any

# Add backend directory to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('contract_type_update.log')
    ]
)
logger = logging.getLogger(__name__)

async def update_contract_types():
    """Update contract types for all existing documents with contract_type 'other'."""
    try:
        # Import after path setup
        from database.service import DocumentService
        # MIGRATED: Using new modular AI services
        from services.ai_service import detect_contract_type  # Keep main function from main service
        from services.ai.client_manager import is_ai_available  # Use new modular import
        from models.common import ContractType
        
        # Check if AI is available
        if not is_ai_available():
            logger.error("❌ AI service is not available. Please check OpenAI API configuration.")
            return False
        
        logger.info("🚀 Starting contract type update for existing documents...")
        
        # Initialize document service
        doc_service = DocumentService()
        
        # Get all documents from all users (we'll need to find a way to get all documents)
        # Since we don't have a direct method, we'll use the compatibility service
        from database.service import CompatibilityService
        compat_service = CompatibilityService()
        
        # Access the MongoDB collection directly for this migration
        db = await doc_service._get_db()
        
        # Find all documents with contract_type "other"
        logger.info("🔍 Finding documents with contract_type 'other'...")
        
        # Get the documents collection and find documents with "other" contract type
        documents_collection = db._get_collection("documents")
        cursor = documents_collection.find({"contract_type": "other"})
        documents = await cursor.to_list(length=None)  # Get all matching documents
        total_documents = len(documents)
        
        if total_documents == 0:
            logger.info("✅ No documents found with contract_type 'other'. All documents appear to be already classified.")
            return True
        
        logger.info(f"📊 Found {total_documents} documents to update")
        
        updated_count = 0
        failed_count = 0
        
        for i, doc in enumerate(documents, 1):
            doc_id = doc.get("id")
            filename = doc.get("filename", "Unknown")
            text_content = doc.get("text", "")
            
            logger.info(f"🔄 Processing document {i}/{total_documents}: {filename}")
            
            if not text_content:
                logger.warning(f"⚠️  Skipping document {filename} - no text content")
                failed_count += 1
                continue
            
            try:
                # Detect contract type using LLM
                detected_type = await detect_contract_type(text_content, filename)
                
                logger.info(f"✅ Detected contract type for {filename}: {detected_type.value}")
                
                # Update the document in the database using MongoDB collection directly
                await documents_collection.update_one(
                    {"id": doc_id},
                    {"$set": {"contract_type": detected_type.value}}
                )
                
                updated_count += 1
                logger.info(f"✅ Updated {filename} -> {detected_type.value}")
                
                # Add a small delay to avoid overwhelming the API
                await asyncio.sleep(0.5)
                
            except Exception as e:
                logger.error(f"❌ Failed to update document {filename}: {str(e)}")
                failed_count += 1
                continue
        
        # Summary
        logger.info("=" * 60)
        logger.info("📊 CONTRACT TYPE UPDATE SUMMARY")
        logger.info("=" * 60)
        logger.info(f"✅ Total documents processed: {total_documents}")
        logger.info(f"✅ Successfully updated: {updated_count}")
        logger.info(f"❌ Failed updates: {failed_count}")
        logger.info(f"🎯 Success rate: {(updated_count/total_documents*100):.1f}%")
        
        if updated_count == total_documents:
            logger.info("🎉 All documents successfully updated!")
            return True
        elif updated_count > 0:
            logger.info("⚠️  Some documents were updated, but some failed. Check logs for details.")
            return True
        else:
            logger.error("❌ No documents were successfully updated.")
            return False
            
    except Exception as e:
        logger.error(f"❌ Script failed with error: {str(e)}")
        return False

async def verify_updates():
    """Verify that contract types were updated correctly."""
    try:
        logger.info("🔍 Verifying contract type updates...")
        
        from database.service import DocumentService
        doc_service = DocumentService()
        db = await doc_service._get_db()
        
        # Count documents by contract type using MongoDB collection directly
        documents_collection = db._get_collection("documents")
        cursor = documents_collection.find({})
        documents = await cursor.to_list(length=None)
        type_counts = {}
        
        for doc in documents:
            contract_type = doc.get("contract_type", "unknown")
            type_counts[contract_type] = type_counts.get(contract_type, 0) + 1
        
        logger.info("📊 Contract type distribution:")
        for contract_type, count in sorted(type_counts.items()):
            logger.info(f"   {contract_type}: {count} documents")
        
        # Check if there are still documents with "other" type
        other_count = type_counts.get("other", 0)
        if other_count == 0:
            logger.info("✅ No documents remain with 'other' contract type!")
        else:
            logger.warning(f"⚠️  {other_count} documents still have 'other' contract type")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Verification failed: {str(e)}")
        return False

async def main():
    """Main function to run the contract type update."""
    logger.info("🚀 ClauseIQ Contract Type Update Script")
    logger.info("=" * 60)
    
    # Check if user wants to proceed
    response = input("This will update contract types for all existing documents with 'other' type. Continue? (yes/no): ")
    if response.lower() != 'yes':
        logger.info("Operation cancelled by user")
        return
    
    # Run the update
    success = await update_contract_types()
    
    if success:
        # Verify the updates
        await verify_updates()
        logger.info("✅ Contract type update completed successfully!")
    else:
        logger.error("❌ Contract type update failed!")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
