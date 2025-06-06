"""
Sample migrations for ClauseIQ database.
"""
import logging
from datetime import datetime
from .migrations import Migration
from .interface import DatabaseInterface

logger = logging.getLogger(__name__)

class InitialSetupMigration(Migration):
    """Initial database setup migration."""
    
    def __init__(self):
        super().__init__(
            id="001_initial_setup",
            name="Initial Setup", 
            description="Create initial database collections and indexes",
            version="1.0.0"
        )
    
    async def up(self, db: DatabaseInterface) -> bool:
        """Create initial collections and indexes."""
        try:
            # Create users collection indexes
            logger.info("Creating users collection indexes...")
            await db.create_document({
                "collection": "users",
                "document": {
                    "_index_setup": True,
                    "email_index": "unique",
                    "created_at": datetime.utcnow().isoformat()
                }
            })
            
            # Create documents collection indexes
            logger.info("Creating documents collection indexes...")
            await db.create_document({
                "collection": "documents", 
                "document": {
                    "_index_setup": True,
                    "user_id_index": "standard",
                    "created_at_index": "standard",
                    "created_at": datetime.utcnow().isoformat()
                }
            })
            
            # Create analysis collection indexes
            logger.info("Creating analysis collection indexes...")
            await db.create_document({
                "collection": "analysis",
                "document": {
                    "_index_setup": True,
                    "document_id_index": "standard",
                    "user_id_index": "standard", 
                    "created_at": datetime.utcnow().isoformat()
                }
            })
            
            logger.info("Initial setup migration completed successfully")
            return True
            
        except Exception as e:
            logger.error(f"Initial setup migration failed: {e}")
            return False
    
    async def down(self, db: DatabaseInterface) -> bool:
        """Remove initial setup (not recommended for production)."""
        try:
            # Note: In production, you might not want to drop entire collections
            logger.warning("Rolling back initial setup - removing index documents")
            
            await db.delete_document({
                "collection": "users",
                "filter": {"_index_setup": True}
            })
            
            await db.delete_document({
                "collection": "documents",
                "filter": {"_index_setup": True}
            })
            
            await db.delete_document({
                "collection": "analysis", 
                "filter": {"_index_setup": True}
            })
            
            return True
            
        except Exception as e:
            logger.error(f"Initial setup rollback failed: {e}")
            return False

class UserPreferencesMigration(Migration):
    """Add user preferences support."""
    
    def __init__(self):
        super().__init__(
            id="002_user_preferences",
            name="User Preferences",
            description="Add user preferences collection and default preferences",
            version="1.0.1"
        )
    
    async def up(self, db: DatabaseInterface) -> bool:
        """Add user preferences support."""
        try:
            # Create user_preferences collection
            logger.info("Creating user preferences collection...")
            await db.create_document({
                "collection": "user_preferences",
                "document": {
                    "_collection_setup": True,
                    "user_id_index": "unique",
                    "created_at": datetime.utcnow().isoformat()
                }
            })
            
            # Find all existing users and add default preferences
            users_result = await db.find_documents({
                "collection": "users",
                "filter": {}
            })
            
            default_preferences = {
                "preferred_model": "gpt-4",
                "theme": "light",
                "notifications_enabled": True,
                "auto_save_enabled": True
            }
            
            for user in users_result.get("documents", []):
                user_id = user.get("id")
                if user_id:
                    preference_doc = {
                        "user_id": user_id,
                        "preferences": default_preferences,
                        "created_at": datetime.utcnow().isoformat(),
                        "updated_at": datetime.utcnow().isoformat()
                    }
                    
                    await db.create_document({
                        "collection": "user_preferences",
                        "document": preference_doc
                    })
            
            logger.info(f"User preferences migration completed for {len(users_result.get('documents', []))} users")
            return True
            
        except Exception as e:
            logger.error(f"User preferences migration failed: {e}")
            return False
    
    async def down(self, db: DatabaseInterface) -> bool:
        """Remove user preferences."""
        try:
            # Remove all user preferences
            await db.delete_document({
                "collection": "user_preferences",
                "filter": {}
            })
            
            logger.info("User preferences migration rolled back")
            return True
            
        except Exception as e:
            logger.error(f"User preferences rollback failed: {e}")
            return False

class DocumentAnalysisEnhancementMigration(Migration):
    """Enhance document analysis with new fields."""
    
    def __init__(self):
        super().__init__(
            id="003_document_analysis_enhancement",
            name="Document Analysis Enhancement",
            description="Add new fields to document analysis for better tracking",
            version="1.1.0"
        )
    
    async def up(self, db: DatabaseInterface) -> bool:
        """Add new analysis fields."""
        try:
            # Find all existing analysis documents and update them
            analysis_result = await db.find_documents({
                "collection": "analysis", 
                "filter": {}
            })
            
            for analysis in analysis_result.get("documents", []):
                # Add new fields if they don't exist
                updates = {}
                
                if "processing_time_ms" not in analysis:
                    updates["processing_time_ms"] = 0
                
                if "model_version" not in analysis:
                    updates["model_version"] = "1.0.0"
                
                if "confidence_score" not in analysis:
                    updates["confidence_score"] = 0.8
                
                if "analysis_version" not in analysis:
                    updates["analysis_version"] = "1.1.0"
                
                if updates:
                    await db.update_document({
                        "collection": "analysis",
                        "filter": {"_id": analysis.get("_id")},
                        "update": {"$set": updates}
                    })
            
            logger.info(f"Enhanced {len(analysis_result.get('documents', []))} analysis documents")
            return True
            
        except Exception as e:
            logger.error(f"Document analysis enhancement migration failed: {e}")
            return False
    
    async def down(self, db: DatabaseInterface) -> bool:
        """Remove enhancement fields."""
        try:
            # Remove the new fields from all analysis documents
            await db.update_document({
                "collection": "analysis",
                "filter": {},
                "update": {
                    "$unset": {
                        "processing_time_ms": "",
                        "model_version": "",
                        "confidence_score": "",
                        "analysis_version": ""
                    }
                }
            })
            
            logger.info("Document analysis enhancement rolled back")
            return True
            
        except Exception as e:
            logger.error(f"Document analysis enhancement rollback failed: {e}")
            return False

# List of all available migrations
AVAILABLE_MIGRATIONS = [
    InitialSetupMigration(),
    UserPreferencesMigration(),
    DocumentAnalysisEnhancementMigration()
]
