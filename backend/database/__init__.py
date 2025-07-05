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
    get_document_service
)

# Migration system
from .migrations import (
    Migration,
    MigrationManager,
    get_migration_manager
)

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
    'get_document_service',
    
    # Migration system
    'Migration',
    'MigrationManager',
    'get_migration_manager'
]
