"""
Database migration system for ClauseIQ.
Handles database schema changes and data migrations.
"""
import logging
import asyncio
from datetime import datetime
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from abc import ABC, abstractmethod
from .factory import get_database_factory
from .interface import DatabaseInterface

logger = logging.getLogger(__name__)

@dataclass
class MigrationInfo:
    """Information about a database migration."""
    id: str
    name: str
    description: str
    version: str
    applied_at: Optional[datetime] = None
    success: bool = False

class Migration(ABC):
    """Base class for database migrations."""
    
    def __init__(self, id: str, name: str, description: str, version: str):
        self.id = id
        self.name = name
        self.description = description
        self.version = version
    
    @abstractmethod
    async def up(self, db: DatabaseInterface) -> bool:
        """Apply the migration."""
        pass
    
    @abstractmethod
    async def down(self, db: DatabaseInterface) -> bool:
        """Rollback the migration."""
        pass
    
    def get_info(self) -> MigrationInfo:
        """Get migration information."""
        return MigrationInfo(
            id=self.id,
            name=self.name,
            description=self.description,
            version=self.version
        )

class MigrationManager:
    """Manages database migrations."""
    
    def __init__(self):
        self.migrations: List[Migration] = []
        self._db_factory = None
    
    async def initialize(self):
        """Initialize the migration manager."""
        self._db_factory = get_database_factory()
        await self._db_factory.initialize()
        
        # Ensure migrations collection exists
        await self._ensure_migrations_collection()
    
    def register_migration(self, migration: Migration):
        """Register a migration."""
        self.migrations.append(migration)
        # Sort migrations by ID to ensure correct order
        self.migrations.sort(key=lambda m: m.id)
    
    async def _ensure_migrations_collection(self):
        """Ensure the migrations tracking collection exists."""
        try:
            db = await self._db_factory.get_database()
            # Create index on migration_id for efficient lookups
            await db.create_document({
                "collection": "_migrations",
                "document": {
                    "_setup": True,
                    "created_at": datetime.utcnow().isoformat()
                }
            })
            logger.info("Migrations collection initialized")
        except Exception as e:
            logger.error(f"Failed to initialize migrations collection: {e}")
            raise
    
    async def get_applied_migrations(self) -> List[MigrationInfo]:
        """Get list of applied migrations."""
        try:
            db = await self._db_factory.get_database()
            result = await db.find_documents({
                "collection": "_migrations",
                "filter": {"migration_id": {"$exists": True}}
            })
            
            applied = []
            for doc in result.get("documents", []):
                applied.append(MigrationInfo(
                    id=doc["migration_id"],
                    name=doc.get("name", ""),
                    description=doc.get("description", ""),
                    version=doc.get("version", ""),
                    applied_at=datetime.fromisoformat(doc["applied_at"]) if doc.get("applied_at") else None,
                    success=doc.get("success", False)
                ))
            
            return sorted(applied, key=lambda m: m.id)
        except Exception as e:
            logger.error(f"Failed to get applied migrations: {e}")
            return []
    
    async def get_pending_migrations(self) -> List[Migration]:
        """Get list of pending migrations."""
        applied = await self.get_applied_migrations()
        applied_ids = {m.id for m in applied if m.success}
        
        return [m for m in self.migrations if m.id not in applied_ids]
    
    async def apply_migration(self, migration: Migration) -> bool:
        """Apply a single migration."""
        logger.info(f"Applying migration {migration.id}: {migration.name}")
        
        try:
            db = await self._db_factory.get_database()
            
            # Record migration start
            migration_doc = {
                "migration_id": migration.id,
                "name": migration.name,
                "description": migration.description,
                "version": migration.version,
                "started_at": datetime.utcnow().isoformat(),
                "success": False
            }
            
            await db.create_document({
                "collection": "_migrations",
                "document": migration_doc
            })
            
            # Apply the migration
            success = await migration.up(db)
            
            # Update migration record
            migration_doc.update({
                "applied_at": datetime.utcnow().isoformat(),
                "success": success
            })
            
            await db.update_document({
                "collection": "_migrations",
                "filter": {"migration_id": migration.id},
                "update": {"$set": migration_doc}
            })
            
            if success:
                logger.info(f"Migration {migration.id} applied successfully")
            else:
                logger.error(f"Migration {migration.id} failed to apply")
            
            return success
            
        except Exception as e:
            logger.error(f"Error applying migration {migration.id}: {e}")
            
            # Record the failure
            try:
                await db.update_document({
                    "collection": "_migrations", 
                    "filter": {"migration_id": migration.id},
                    "update": {"$set": {
                        "error": str(e),
                        "failed_at": datetime.utcnow().isoformat(),
                        "success": False
                    }}
                })
            except:
                pass  # Don't fail on failure to record failure
            
            return False
    
    async def rollback_migration(self, migration: Migration) -> bool:
        """Rollback a single migration."""
        logger.info(f"Rolling back migration {migration.id}: {migration.name}")
        
        try:
            db = await self._db_factory.get_database()
            
            # Rollback the migration
            success = await migration.down(db)
            
            if success:
                # Remove migration record
                await db.delete_document({
                    "collection": "_migrations",
                    "filter": {"migration_id": migration.id}
                })
                logger.info(f"Migration {migration.id} rolled back successfully")
            else:
                logger.error(f"Migration {migration.id} failed to rollback")
            
            return success
            
        except Exception as e:
            logger.error(f"Error rolling back migration {migration.id}: {e}")
            return False
    
    async def migrate_up(self, target_migration: Optional[str] = None) -> bool:
        """Apply all pending migrations up to target."""
        pending = await self.get_pending_migrations()
        
        if target_migration:
            # Find target migration
            target_index = -1
            for i, migration in enumerate(pending):
                if migration.id == target_migration:
                    target_index = i
                    break
            
            if target_index == -1:
                logger.error(f"Target migration {target_migration} not found")
                return False
            
            pending = pending[:target_index + 1]
        
        if not pending:
            logger.info("No pending migrations to apply")
            return True
        
        logger.info(f"Applying {len(pending)} pending migrations")
        
        for migration in pending:
            success = await self.apply_migration(migration)
            if not success:
                logger.error(f"Migration failed, stopping at {migration.id}")
                return False
        
        logger.info("All migrations applied successfully")
        return True
    
    async def migrate_down(self, target_migration: str) -> bool:
        """Rollback migrations down to target."""
        applied = await self.get_applied_migrations()
        successful_applied = [m for m in applied if m.success]
        
        # Find migrations to rollback (in reverse order)
        to_rollback = []
        for migration_info in reversed(successful_applied):
            if migration_info.id == target_migration:
                break
            
            # Find the migration object
            migration_obj = None
            for migration in self.migrations:
                if migration.id == migration_info.id:
                    migration_obj = migration
                    break
            
            if migration_obj:
                to_rollback.append(migration_obj)
        
        if not to_rollback:
            logger.info("No migrations to rollback")
            return True
        
        logger.info(f"Rolling back {len(to_rollback)} migrations")
        
        for migration in to_rollback:
            success = await self.rollback_migration(migration)
            if not success:
                logger.error(f"Rollback failed, stopping at {migration.id}")
                return False
        
        logger.info("All rollbacks completed successfully")
        return True
    
    async def get_migration_status(self) -> Dict[str, Any]:
        """Get overall migration status."""
        applied = await self.get_applied_migrations()
        pending = await self.get_pending_migrations()
        
        return {
            "total_migrations": len(self.migrations),
            "applied_count": len([m for m in applied if m.success]),
            "pending_count": len(pending),
            "failed_count": len([m for m in applied if not m.success]),
            "applied_migrations": [
                {
                    "id": m.id,
                    "name": m.name,
                    "applied_at": m.applied_at.isoformat() if m.applied_at else None,
                    "success": m.success
                }
                for m in applied
            ],
            "pending_migrations": [
                {
                    "id": m.id,
                    "name": m.name,
                    "description": m.description
                }
                for m in pending
            ]
        }

# Global migration manager instance
migration_manager = MigrationManager()

async def get_migration_manager() -> MigrationManager:
    """Get the global migration manager."""
    if migration_manager._db_factory is None:
        await migration_manager.initialize()
    return migration_manager
