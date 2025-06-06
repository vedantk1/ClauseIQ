"""
Database abstraction layer for ClauseIQ.
Provides a clean interface for database operations with potential for multiple backends.
"""
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any, Union
from datetime import datetime
import uuid
from dataclasses import dataclass
from enum import Enum


class DatabaseBackend(str, Enum):
    """Supported database backends."""
    MONGODB = "mongodb"
    POSTGRESQL = "postgresql"
    SQLITE = "sqlite"


@dataclass
class ConnectionConfig:
    """Database connection configuration."""
    backend: DatabaseBackend
    uri: str
    database: str
    collection_prefix: str = ""
    pool_size: int = 10
    timeout: int = 30
    retry_attempts: int = 3


class DatabaseError(Exception):
    """Base exception for database operations."""
    pass


class ConnectionError(DatabaseError):
    """Database connection error."""
    pass


class ValidationError(DatabaseError):
    """Data validation error."""
    pass


class NotFoundError(DatabaseError):
    """Resource not found error."""
    pass


class DuplicateError(DatabaseError):
    """Duplicate resource error."""
    pass


class DatabaseInterface(ABC):
    """Abstract interface for database operations."""
    
    @abstractmethod
    async def connect(self) -> None:
        """Establish database connection."""
        pass
    
    @abstractmethod
    async def disconnect(self) -> None:
        """Close database connection."""
        pass
    
    @abstractmethod
    async def health_check(self) -> Dict[str, Any]:
        """Check database health status."""
        pass
    
    # User operations
    @abstractmethod
    async def create_user(self, user_data: Dict[str, Any]) -> str:
        """Create a new user and return user ID."""
        pass
    
    @abstractmethod
    async def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user by ID."""
        pass
    
    @abstractmethod
    async def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Get user by email."""
        pass
    
    @abstractmethod
    async def update_user(self, user_id: str, update_data: Dict[str, Any]) -> bool:
        """Update user data."""
        pass
    
    @abstractmethod
    async def delete_user(self, user_id: str) -> bool:
        """Delete user."""
        pass
    
    # Document operations
    @abstractmethod
    async def save_document(self, document_data: Dict[str, Any]) -> str:
        """Save document and return document ID."""
        pass
    
    @abstractmethod
    async def get_document(self, document_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Get document by ID for specific user."""
        pass
    
    @abstractmethod
    async def list_documents(
        self, 
        user_id: str, 
        limit: int = 50, 
        offset: int = 0,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """List documents for user with pagination and filtering."""
        pass
    
    @abstractmethod
    async def update_document(self, document_id: str, user_id: str, update_data: Dict[str, Any]) -> bool:
        """Update document data."""
        pass
    
    @abstractmethod
    async def delete_document(self, document_id: str, user_id: str) -> bool:
        """Delete document."""
        pass
    
    # Analytics operations
    @abstractmethod
    async def get_user_analytics(self, user_id: str) -> Dict[str, Any]:
        """Get analytics data for user."""
        pass
    
    # Generic operations
    @abstractmethod
    async def execute_query(self, query: str, params: Optional[Dict[str, Any]] = None) -> Any:
        """Execute raw query (for advanced operations)."""
        pass


class DatabaseManager:
    """Database manager with connection pooling and error handling."""
    
    def __init__(self, config: ConnectionConfig):
        self.config = config
        self._db: Optional[DatabaseInterface] = None
        self._connection_pool = None
        
    async def get_database(self) -> DatabaseInterface:
        """Get database interface instance."""
        if self._db is None:
            await self._initialize_database()
        return self._db
    
    async def _initialize_database(self) -> None:
        """Initialize database connection based on backend type."""
        if self.config.backend == DatabaseBackend.MONGODB:
            from .mongodb_adapter import MongoDBAdapter
            self._db = MongoDBAdapter(self.config)
        elif self.config.backend == DatabaseBackend.POSTGRESQL:
            from .postgresql_adapter import PostgreSQLAdapter
            self._db = PostgreSQLAdapter(self.config)
        elif self.config.backend == DatabaseBackend.SQLITE:
            from .sqlite_adapter import SQLiteAdapter
            self._db = SQLiteAdapter(self.config)
        else:
            raise ValueError(f"Unsupported database backend: {self.config.backend}")
        
        await self._db.connect()
    
    async def close(self) -> None:
        """Close database connections."""
        if self._db:
            await self._db.disconnect()
            self._db = None


# Singleton database manager instance
_database_manager: Optional[DatabaseManager] = None


def initialize_database(config: ConnectionConfig) -> None:
    """Initialize global database manager."""
    global _database_manager
    _database_manager = DatabaseManager(config)


async def get_database() -> DatabaseInterface:
    """Get database interface instance."""
    if _database_manager is None:
        raise RuntimeError("Database not initialized. Call initialize_database() first.")
    return await _database_manager.get_database()


async def close_database() -> None:
    """Close database connections."""
    global _database_manager
    if _database_manager:
        await _database_manager.close()
        _database_manager = None
