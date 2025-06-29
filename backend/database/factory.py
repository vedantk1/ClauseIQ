"""
Database factory for creating database adapters.
Provides a centralized way to create and configure database connections.
"""
import logging
from typing import Optional
from .interface import DatabaseInterface, ConnectionConfig, DatabaseBackend
from .mongodb_adapter import MongoDBAdapter
from config.environments import get_environment_config

logger = logging.getLogger(__name__)


class DatabaseFactory:
    """Factory for creating database adapters."""
    
    _instance: Optional[DatabaseInterface] = None
    
    @classmethod
    async def get_database(cls) -> DatabaseInterface:
        """
        Get database instance (singleton).
        
        Returns:
            DatabaseInterface: Database adapter instance
        """
        if cls._instance is None:
            cls._instance = await cls.create_database()
        return cls._instance
    
    @classmethod
    async def create_database(cls) -> DatabaseInterface:
        """
        Create database adapter based on configuration.
        
        Returns:
            DatabaseInterface: Database adapter instance
        """
        settings = get_environment_config()
        
        # Create connection config with enhanced pool settings
        config = ConnectionConfig(
            backend=DatabaseBackend.MONGODB,
            uri=settings.database.uri,
            database=settings.database.database,
            collection_prefix=getattr(settings.database, 'collection_prefix', ''),
            pool_size=settings.database.max_pool_size,  # Backwards compatibility
            timeout=30,
            max_pool_size=settings.database.max_pool_size,
            min_pool_size=settings.database.min_pool_size,
            max_idle_time_ms=settings.database.max_idle_time_ms,
            wait_queue_timeout_ms=settings.database.wait_queue_timeout_ms,
            server_selection_timeout_ms=settings.database.server_selection_timeout_ms
        )
        
        # Currently only MongoDB is supported
        adapter = MongoDBAdapter(config)
        await adapter.connect()
        
        logger.info(f"Database adapter created: {type(adapter).__name__}")
        return adapter
    
    @classmethod
    async def initialize(cls) -> None:
        """Initialize database connection."""
        await cls.get_database()
    
    @classmethod
    async def health_check(cls) -> bool:
        """Check database health."""
        try:
            db = await cls.get_database()
            health_result = await db.health_check()
            return health_result.get("status") == "healthy"
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return False
    
    @classmethod
    async def close(cls) -> None:
        """Close database connection."""
        if cls._instance:
            await cls._instance.disconnect()
            cls._instance = None


def get_database_factory() -> DatabaseFactory:
    """
    Get database factory instance.
    
    Returns:
        DatabaseFactory: Database factory instance
    """
    return DatabaseFactory
