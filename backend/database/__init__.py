"""
Database package exports.
Provides access to database interfaces, adapters, and services.
"""

# Core interfaces and exceptions
from .interface import (
    DatabaseInterface,
    ConnectionConfig,
    DatabaseError,
    ConnectionError,
    ValidationError,
    NotFoundError,
    DuplicateError
)

# Database adapters
from .mongodb_adapter import MongoDBAdapter

# Factory and services
from .factory import DatabaseFactory, get_database_factory
from .service import (
    DocumentService,
    CompatibilityService,
    get_document_service,
    get_compatibility_service
)

# Migration system
from .migrations import (
    Migration,
    MigrationManager,
    get_migration_manager
)

# Backward compatibility - redirect to new service
def get_mongo_storage():
    """
    Get MongoDB storage instance for backward compatibility.
    
    Returns:
        CompatibilityService: Service that provides the same interface as MongoDocumentStorage
    """
    return get_compatibility_service()

# Export legacy function name
mongo_storage = None  # Will be initialized when get_mongo_storage() is called

__all__ = [
    # Interfaces and exceptions
    'DatabaseInterface',
    'ConnectionConfig', 
    'DatabaseError',
    'ConnectionError',
    'ValidationError',
    'NotFoundError',
    'DuplicateError',
    
    # Adapters
    'MongoDBAdapter',
    
    # Factory and services
    'DatabaseFactory',
    'get_database_factory',
    'DocumentService',
    'CompatibilityService',
    'get_document_service',
    'get_compatibility_service',
    
    # Migration system
    'Migration',
    'MigrationManager',
    'get_migration_manager',
    
    # Backward compatibility
    'get_mongo_storage',
    'mongo_storage'
]
