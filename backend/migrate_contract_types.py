#!/usr/bin/env python3
"""
Migration script to add contract_type field to existing documents in MongoDB.

This script adds the contract_type field to all existing documents that don't have it,
setting them to 'other' as a default value. This ensures backward compatibility while
preparing the database for the new LLM-based contract type detection system.
"""

import asyncio
import logging
from typing import Dict, Any
from database.service import get_document_service
from clauseiq_types.common import ContractType

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def migrate_contract_types():
    """Add contract_type field to existing documents that don't have it."""
    logger.info("Starting contract type migration...")
    
    try:
        service = get_document_service()
        
        # Get database info to verify connection
        db_info = await service.get_database_info()
        logger.info(f"Connected to database: {db_info}")
        
        # We need to access the MongoDB adapter directly for this migration
        # since we need to update documents across all users
        db = await service._get_db()
        documents_collection = db._get_collection("documents")
        
        # Find all documents that don't have a contract_type field
        documents_without_contract_type = await documents_collection.find({
            "contract_type": {"$exists": False}
        }).to_list(length=None)
        
        if not documents_without_contract_type:
            logger.info("No documents found without contract_type field. Migration not needed.")
            return
        
        logger.info(f"Found {len(documents_without_contract_type)} documents without contract_type field")
        
        # Update each document to add contract_type field
        updated_count = 0
        failed_count = 0
        
        for doc in documents_without_contract_type:
            try:
                # Set default contract type to 'other' for existing documents
                result = await documents_collection.update_one(
                    {"_id": doc["_id"]},
                    {"$set": {"contract_type": ContractType.OTHER.value}}
                )
                
                if result.modified_count > 0:
                    updated_count += 1
                    logger.debug(f"Updated document {doc.get('id', 'unknown')} with contract_type")
                else:
                    logger.warning(f"Document {doc.get('id', 'unknown')} was not updated")
                    
            except Exception as e:
                failed_count += 1
                logger.error(f"Failed to update document {doc.get('id', 'unknown')}: {e}")
        
        logger.info(f"Migration completed:")
        logger.info(f"  - Documents updated: {updated_count}")
        logger.info(f"  - Documents failed: {failed_count}")
        logger.info(f"  - Total processed: {len(documents_without_contract_type)}")
        
        if failed_count > 0:
            logger.warning(f"{failed_count} documents failed to update. Check logs for details.")
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        raise


async def verify_migration():
    """Verify that all documents now have the contract_type field."""
    logger.info("Verifying migration results...")
    
    try:
        service = get_document_service()
        db = await service._get_db()
        documents_collection = db._get_collection("documents")
        
        # Count total documents
        total_docs = await documents_collection.count_documents({})
        
        # Count documents with contract_type field
        docs_with_contract_type = await documents_collection.count_documents({
            "contract_type": {"$exists": True}
        })
        
        # Count documents by contract type
        contract_type_counts = {}
        for contract_type in ContractType:
            count = await documents_collection.count_documents({
                "contract_type": contract_type.value
            })
            if count > 0:
                contract_type_counts[contract_type.value] = count
        
        logger.info(f"Verification results:")
        logger.info(f"  - Total documents: {total_docs}")
        logger.info(f"  - Documents with contract_type: {docs_with_contract_type}")
        logger.info(f"  - Documents without contract_type: {total_docs - docs_with_contract_type}")
        
        if contract_type_counts:
            logger.info(f"  - Contract type distribution:")
            for contract_type, count in contract_type_counts.items():
                logger.info(f"    * {contract_type}: {count}")
        
        if total_docs == docs_with_contract_type:
            logger.info("✅ Migration successful: All documents have contract_type field")
        else:
            logger.warning(f"⚠️  Migration incomplete: {total_docs - docs_with_contract_type} documents still missing contract_type field")
            
    except Exception as e:
        logger.error(f"Verification failed: {e}")
        raise


async def main():
    """Main migration function."""
    logger.info("=== ClauseIQ Contract Type Migration ===")
    
    try:
        # Run migration
        await migrate_contract_types()
        
        # Verify results
        await verify_migration()
        
        logger.info("=== Migration Complete ===")
        
    except Exception as e:
        logger.error(f"Migration process failed: {e}")
        return 1
    
    return 0


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)
