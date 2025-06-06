# Database Migration System

ClauseIQ's database migration system provides a robust, version-controlled approach to managing database schema changes and data migrations.

## Overview

The migration system consists of:

- **Migration Classes**: Define individual database changes
- **Migration Manager**: Orchestrates migration execution
- **CLI Tool**: Command-line interface for migration management
- **Integration**: Seamless integration with the main application

## Architecture

```
database/
├── migrations.py          # Core migration framework
├── sample_migrations.py   # Example migrations
├── migrate.py            # CLI tool
└── __init__.py          # Package exports
```

## Key Components

### Migration Class

Base class for all database migrations:

```python
from database.migrations import Migration

class MyMigration(Migration):
    def __init__(self):
        super().__init__(
            id="001_my_migration",
            name="My Migration",
            description="Description of changes",
            version="1.0.0"
        )

    async def up(self, db: DatabaseInterface) -> bool:
        """Apply the migration."""
        # Implementation here
        return True

    async def down(self, db: DatabaseInterface) -> bool:
        """Rollback the migration."""
        # Implementation here
        return True
```

### Migration Manager

Manages the lifecycle of migrations:

```python
from database.migrations import get_migration_manager

# Get migration manager
manager = await get_migration_manager()

# Register migrations
manager.register_migration(MyMigration())

# Apply all pending migrations
await manager.migrate_up()

# Get migration status
status = await manager.get_migration_status()
```

## CLI Usage

The migration CLI provides convenient commands for managing migrations:

### Check Migration Status

```bash
python database/migrate.py status
```

### Apply All Pending Migrations

```bash
python database/migrate.py migrate
```

### Apply Migrations Up To Target

```bash
python database/migrate.py migrate --target 002_user_preferences
```

### Rollback To Target Migration

```bash
python database/migrate.py rollback 001_initial_setup
```

### List All Available Migrations

```bash
python database/migrate.py list
```

### Create New Migration

```bash
python database/migrate.py create "Add User Settings" "Add user settings table and default values"
```

## Migration Best Practices

### 1. Naming Convention

- Use sequential numbering: `001_`, `002_`, `003_`
- Use descriptive names: `initial_setup`, `user_preferences`, `add_indexes`
- Format: `{number}_{descriptive_name}`

### 2. Migration Structure

```python
class UserSettingsMigration(Migration):
    def __init__(self):
        super().__init__(
            id="003_user_settings",
            name="User Settings",
            description="Add user settings collection with default values",
            version="1.2.0"
        )

    async def up(self, db: DatabaseInterface) -> bool:
        try:
            # 1. Create new collection/indexes
            await db.create_document({
                "collection": "user_settings",
                "document": {"_setup": True}
            })

            # 2. Migrate existing data
            users = await db.find_documents({
                "collection": "users",
                "filter": {}
            })

            for user in users.get("documents", []):
                await db.create_document({
                    "collection": "user_settings",
                    "document": {
                        "user_id": user["id"],
                        "theme": "light",
                        "notifications": True
                    }
                })

            return True
        except Exception as e:
            logger.error(f"Migration failed: {e}")
            return False

    async def down(self, db: DatabaseInterface) -> bool:
        try:
            # Remove all user settings
            await db.delete_document({
                "collection": "user_settings",
                "filter": {}
            })
            return True
        except Exception as e:
            logger.error(f"Rollback failed: {e}")
            return False
```

### 3. Safe Migration Practices

**DO:**

- Always test migrations on development data first
- Make migrations idempotent (safe to run multiple times)
- Include comprehensive error handling
- Add appropriate logging
- Backup data before running migrations in production
- Use transactions when possible

**DON'T:**

- Delete data without confirmation
- Make irreversible changes without backups
- Skip testing rollback procedures
- Hardcode configuration values
- Rush production migrations

## Integration with Application

### Health Check Integration

The health endpoint includes migration status:

```python
@app.get("/health/detailed")
async def detailed_health():
    migration_manager = await get_migration_manager()
    migration_status = await migration_manager.get_migration_status()

    return {
        "status": "healthy",
        "migrations": migration_status
    }
```

### Startup Integration

Optionally auto-run migrations at startup:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    manager = await get_migration_manager()

    # Auto-run migrations (optional)
    if os.getenv("AUTO_MIGRATE") == "true":
        await manager.migrate_up()

    yield

    # Shutdown
    pass
```

## Migration Tracking

Migrations are tracked in the `_migrations` collection:

```json
{
  "_id": "...",
  "migration_id": "001_initial_setup",
  "name": "Initial Setup",
  "description": "Create initial database collections and indexes",
  "version": "1.0.0",
  "started_at": "2023-12-01T10:00:00Z",
  "applied_at": "2023-12-01T10:00:05Z",
  "success": true
}
```

## Error Handling

The migration system provides comprehensive error handling:

- **Validation Errors**: Invalid migration definitions
- **Connection Errors**: Database connectivity issues
- **Execution Errors**: Migration logic failures
- **Rollback Errors**: Rollback procedure failures

All errors are logged with appropriate context and returned in API responses.

## Sample Migrations

The system includes sample migrations demonstrating common patterns:

1. **Initial Setup** (`001_initial_setup`): Create collections and indexes
2. **User Preferences** (`002_user_preferences`): Add new collection with default data
3. **Document Analysis Enhancement** (`003_document_analysis_enhancement`): Update existing documents

## Production Deployment

### Manual Migration Process

1. Deploy new application code (without running migrations)
2. Review pending migrations: `python database/migrate.py status`
3. Create database backup
4. Run migrations: `python database/migrate.py migrate`
5. Verify migration success: `python database/migrate.py status`
6. Monitor application health

### Automated Deployment

```bash
# In deployment script
python database/migrate.py status
if [ $? -eq 0 ]; then
    python database/migrate.py migrate
    if [ $? -eq 0 ]; then
        echo "Migrations completed successfully"
    else
        echo "Migration failed - rolling back deployment"
        exit 1
    fi
fi
```

## Monitoring and Observability

Monitor migration status through:

- Application health endpoints
- Migration CLI status command
- Database collection inspection
- Application logs

The migration system integrates with the application's monitoring and logging infrastructure for comprehensive observability.
