#!/usr/bin/env python3
"""
Migration management CLI for ClauseIQ.
"""
import asyncio
import argparse
import sys
import logging
from typing import Optional
import os

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.migrations import get_migration_manager, MigrationManager
from database.sample_migrations import AVAILABLE_MIGRATIONS

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def register_migrations(manager: MigrationManager):
    """Register all available migrations."""
    for migration in AVAILABLE_MIGRATIONS:
        manager.register_migration(migration)
    logger.info(f"Registered {len(AVAILABLE_MIGRATIONS)} migrations")

async def status_command():
    """Show migration status."""
    try:
        manager = await get_migration_manager()
        await register_migrations(manager)
        
        status = await manager.get_migration_status()
        
        print("=" * 60)
        print("MIGRATION STATUS")
        print("=" * 60)
        print(f"Total migrations: {status['total_migrations']}")
        print(f"Applied: {status['applied_count']}")
        print(f"Pending: {status['pending_count']}")
        print(f"Failed: {status['failed_count']}")
        print()
        
        if status['applied_migrations']:
            print("APPLIED MIGRATIONS:")
            print("-" * 40)
            for migration in status['applied_migrations']:
                status_icon = "✓" if migration['success'] else "✗"
                applied_at = migration['applied_at'] or "Unknown"
                print(f"{status_icon} {migration['id']}: {migration['name']} ({applied_at})")
            print()
        
        if status['pending_migrations']:
            print("PENDING MIGRATIONS:")
            print("-" * 40)
            for migration in status['pending_migrations']:
                print(f"• {migration['id']}: {migration['name']}")
                print(f"  {migration['description']}")
            print()
        
        return True
        
    except Exception as e:
        logger.error(f"Failed to get migration status: {e}")
        return False

async def migrate_command(target: Optional[str] = None):
    """Apply migrations."""
    try:
        manager = await get_migration_manager()
        await register_migrations(manager)
        
        print("Starting migration process...")
        success = await manager.migrate_up(target)
        
        if success:
            print("✓ Migrations completed successfully")
            return True
        else:
            print("✗ Migration process failed")
            return False
            
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        return False

async def rollback_command(target: str):
    """Rollback migrations."""
    try:
        manager = await get_migration_manager()
        await register_migrations(manager)
        
        print(f"Rolling back to migration: {target}")
        
        # Confirm rollback
        response = input("Are you sure you want to rollback? This may cause data loss. (yes/no): ")
        if response.lower() != 'yes':
            print("Rollback cancelled")
            return True
        
        success = await manager.migrate_down(target)
        
        if success:
            print("✓ Rollback completed successfully")
            return True
        else:
            print("✗ Rollback failed")
            return False
            
    except Exception as e:
        logger.error(f"Rollback failed: {e}")
        return False

async def list_command():
    """List all available migrations."""
    try:
        manager = await get_migration_manager()
        await register_migrations(manager)
        
        applied = await manager.get_applied_migrations()
        applied_ids = {m.id for m in applied if m.success}
        
        print("=" * 60)
        print("AVAILABLE MIGRATIONS")
        print("=" * 60)
        
        for migration in manager.migrations:
            status = "✓ Applied" if migration.id in applied_ids else "• Pending"
            print(f"{status} {migration.id}: {migration.name}")
            print(f"   Description: {migration.description}")
            print(f"   Version: {migration.version}")
            print()
        
        return True
        
    except Exception as e:
        logger.error(f"Failed to list migrations: {e}")
        return False

async def create_command(name: str, description: str):
    """Create a new migration template."""
    try:
        # Generate migration ID based on current migrations
        manager = await get_migration_manager()
        await register_migrations(manager)
        
        existing_ids = [m.id for m in manager.migrations]
        next_number = len(existing_ids) + 1
        migration_id = f"{next_number:03d}_{name.lower().replace(' ', '_')}"
        
        # Create migration template
        template = f'''"""
{description}
"""
import logging
from datetime import datetime
from .migrations import Migration
from .interface import DatabaseInterface

logger = logging.getLogger(__name__)

class {name.replace(' ', '').replace('_', '')}Migration(Migration):
    """{description}"""
    
    def __init__(self):
        super().__init__(
            id="{migration_id}",
            name="{name}",
            description="{description}",
            version="1.0.0"
        )
    
    async def up(self, db: DatabaseInterface) -> bool:
        """Apply the migration."""
        try:
            logger.info("Applying {name} migration...")
            
            # TEMPLATE: Implement migration logic here when creating actual migrations
            # Example:
            # await db.create_document({{
            #     "collection": "example",
            #     "document": {{"setup": True}}
            # }})
            
            logger.info("{name} migration completed successfully")
            return True
            
        except Exception as e:
            logger.error(f"{name} migration failed: {{e}}")
            return False
    
    async def down(self, db: DatabaseInterface) -> bool:
        """Rollback the migration."""
        try:
            logger.info("Rolling back {name} migration...")
            
            # TEMPLATE: Implement rollback logic here when creating actual migrations
            # Example:
            # await db.delete_document({{
            #     "collection": "example",
            #     "filter": {{"setup": True}}
            # }})
            
            logger.info("{name} migration rolled back successfully")
            return True
            
        except Exception as e:
            logger.error(f"{name} migration rollback failed: {{e}}")
            return False
'''
        
        # Write to file
        filename = f"migration_{migration_id}.py"
        filepath = os.path.join(os.path.dirname(__file__), filename)
        
        with open(filepath, 'w') as f:
            f.write(template)
        
        print(f"✓ Created migration file: {filepath}")
        print(f"Migration ID: {migration_id}")
        print()
        print("Remember to:")
        print("1. Implement the up() and down() methods")
        print("2. Add the migration to AVAILABLE_MIGRATIONS in sample_migrations.py")
        
        return True
        
    except Exception as e:
        logger.error(f"Failed to create migration: {e}")
        return False

def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(description="ClauseIQ Database Migration Tool")
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Status command
    subparsers.add_parser('status', help='Show migration status')
    
    # Migrate command
    migrate_parser = subparsers.add_parser('migrate', help='Apply pending migrations')
    migrate_parser.add_argument('--target', help='Target migration to migrate to')
    
    # Rollback command
    rollback_parser = subparsers.add_parser('rollback', help='Rollback migrations')
    rollback_parser.add_argument('target', help='Target migration to rollback to')
    
    # List command
    subparsers.add_parser('list', help='List all available migrations')
    
    # Create command
    create_parser = subparsers.add_parser('create', help='Create a new migration')
    create_parser.add_argument('name', help='Migration name')
    create_parser.add_argument('description', help='Migration description')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return 1
    
    # Run the appropriate command
    try:
        if args.command == 'status':
            success = asyncio.run(status_command())
        elif args.command == 'migrate':
            success = asyncio.run(migrate_command(args.target))
        elif args.command == 'rollback':
            success = asyncio.run(rollback_command(args.target))
        elif args.command == 'list':
            success = asyncio.run(list_command())
        elif args.command == 'create':
            success = asyncio.run(create_command(args.name, args.description))
        else:
            print(f"Unknown command: {args.command}")
            return 1
        
        return 0 if success else 1
        
    except KeyboardInterrupt:
        print("\nOperation cancelled by user")
        return 1
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return 1

if __name__ == '__main__':
    sys.exit(main())
