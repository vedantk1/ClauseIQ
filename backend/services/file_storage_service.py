"""
File Storage Service for ClauseIQ - GridFS Implementation.

Handles PDF file storage using MongoDB GridFS with user isolation and security.
Designed for bulletproof integration with existing ClauseIQ architecture.
"""
import asyncio
import logging
from typing import Dict, Any, Optional, AsyncGenerator
from datetime import datetime
from abc import ABC, abstractmethod
import hashlib
from io import BytesIO

import motor.motor_asyncio
import motor.core
from motor.motor_asyncio import AsyncIOMotorGridFSBucket
from gridfs.errors import NoFile
from bson import ObjectId

from config.logging import get_foundational_logger

logger = get_foundational_logger("file_storage")


class FileStorageInterface(ABC):
    """Abstract interface for file storage operations."""
    
    @abstractmethod
    async def store_file(self, file_data: bytes, filename: str, content_type: str, 
                        user_id: str, metadata: Optional[Dict[str, Any]] = None) -> str:
        """Store file and return file ID."""
        pass
    
    @abstractmethod
    async def get_file(self, file_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Get file metadata and content stream."""
        pass
    
    @abstractmethod
    async def get_file_stream(self, file_id: str, user_id: str) -> Optional[AsyncGenerator[bytes, None]]:
        """Get file content as async stream."""
        pass
    
    @abstractmethod
    async def delete_file(self, file_id: str, user_id: str) -> bool:
        """Delete file."""
        pass
    
    @abstractmethod
    async def file_exists(self, file_id: str, user_id: str) -> bool:
        """Check if file exists."""
        pass
    
    @abstractmethod
    async def get_file_metadata(self, file_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Get file metadata without content."""
        pass


class GridFSFileStorage(FileStorageInterface):
    """GridFS implementation of file storage."""
    
    # Configuration
    MAX_FILE_SIZE = 16 * 1024 * 1024  # 16MB
    ALLOWED_CONTENT_TYPES = {
        'application/pdf',
        'application/x-pdf'
    }
    
    def __init__(self):
        self._db: Optional[motor.motor_asyncio.AsyncIOMotorDatabase] = None
        self._gridfs: Optional[AsyncIOMotorGridFSBucket] = None
        self._initialized = False
    
    async def initialize(self) -> bool:
        """Initialize GridFS connection."""
        if self._initialized:
            return True
        
        try:
            # Get database connection from existing factory
            from database.factory import DatabaseFactory
            db_adapter = await DatabaseFactory.get_database()
            
            # Access the motor database directly from the adapter
            self._db = db_adapter.database
            
            # Create Motor GridFS Bucket instance for async operations
            self._gridfs = AsyncIOMotorGridFSBucket(self._db, bucket_name="pdf_files")
            
            self._initialized = True
            logger.info("🚀 GridFS file storage initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize GridFS: {e}")
            return False
    
    async def _ensure_initialized(self):
        """Ensure GridFS is initialized."""
        if not self._initialized:
            if not await self.initialize():
                raise RuntimeError("GridFS file storage not available")
    
    def _validate_file(self, file_data: bytes, content_type: str) -> None:
        """Validate file before storage."""
        # Check file size
        if len(file_data) > self.MAX_FILE_SIZE:
            raise ValueError(f"File size {len(file_data)} exceeds maximum {self.MAX_FILE_SIZE} bytes")
        
        # Check content type
        if content_type not in self.ALLOWED_CONTENT_TYPES:
            raise ValueError(f"Content type {content_type} not allowed. Allowed: {self.ALLOWED_CONTENT_TYPES}")
        
        # Check if file is not empty
        if len(file_data) == 0:
            raise ValueError("File is empty")
    
    def _calculate_checksum(self, file_data: bytes) -> str:
        """Calculate file checksum for integrity verification."""
        return hashlib.sha256(file_data).hexdigest()
    
    async def store_file(self, file_data: bytes, filename: str, content_type: str, 
                        user_id: str, metadata: Optional[Dict[str, Any]] = None) -> str:
        """Store file in GridFS and return file ID."""
        await self._ensure_initialized()
        
        try:
            # Validate file
            self._validate_file(file_data, content_type)
            
            # Calculate checksum
            checksum = self._calculate_checksum(file_data)
            
            # Prepare metadata
            file_metadata = {
                'user_id': user_id,
                'original_filename': filename,
                'content_type': content_type,
                'file_size': len(file_data),
                'checksum': checksum,
                'uploaded_at': datetime.utcnow(),
                'storage_service': 'gridfs',
                'version': '1.0'
            }
            
            # Add additional metadata if provided
            if metadata:
                file_metadata.update(metadata)
            
            # Store file in GridFS using Motor's async GridFS bucket API
            file_stream = BytesIO(file_data)
            file_id = await self._gridfs.upload_from_stream(
                filename,
                file_stream,
                metadata=file_metadata
            )
            
            file_id_str = str(file_id)
            logger.info(f"📁 Stored file {filename} for user {user_id}: {file_id_str}")
            
            return file_id_str
            
        except Exception as e:
            logger.error(f"❌ Failed to store file {filename} for user {user_id}: {e}")
            raise
    
    async def get_file(self, file_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Get file metadata and content."""
        await self._ensure_initialized()
        
        try:
            # Convert string ID to ObjectId
            object_id = ObjectId(file_id)
            
            # Get file stream from GridFS using Motor's async GridFS bucket API
            grid_out = await self._gridfs.open_download_stream(object_id)
            
            # Verify user ownership
            if grid_out.metadata.get('user_id') != user_id:
                logger.warning(f"⚠️ User {user_id} attempted to access file {file_id} owned by {grid_out.metadata.get('user_id')}")
                return None
            
            # Read file content
            content = await grid_out.read()
            
            return {
                'file_id': file_id,
                'filename': grid_out.filename,
                'content_type': grid_out.metadata.get('content_type'),
                'file_size': len(content),
                'content': content,
                'metadata': grid_out.metadata,
                'upload_date': grid_out.upload_date
            }
            
        except NoFile:
            logger.info(f"📁 File {file_id} not found")
            return None
        except Exception as e:
            logger.error(f"❌ Failed to get file {file_id} for user {user_id}: {e}")
            return None
    
    async def get_file_stream(self, file_id: str, user_id: str) -> Optional[AsyncGenerator[bytes, None]]:
        """Get file content as async stream for efficient downloading."""
        await self._ensure_initialized()
        
        try:
            # Convert string ID to ObjectId
            object_id = ObjectId(file_id)
            
            # Get file stream from GridFS
            grid_out = await self._gridfs.open_download_stream(object_id)
            
            # Verify user ownership
            if grid_out.metadata.get('user_id') != user_id:
                logger.warning(f"⚠️ User {user_id} attempted to stream file {file_id} owned by {grid_out.metadata.get('user_id')}")
                return None
            
            # Create async generator for streaming
            async def stream_generator():
                chunk_size = 64 * 1024  # 64KB chunks
                while True:
                    chunk = await grid_out.read(chunk_size)
                    if not chunk:
                        break
                    yield chunk
            
            return stream_generator()
            
        except NoFile:
            logger.info(f"📁 File {file_id} not found for streaming")
            return None
        except Exception as e:
            logger.error(f"❌ Failed to stream file {file_id} for user {user_id}: {e}")
            return None
    
    async def delete_file(self, file_id: str, user_id: str) -> bool:
        """Delete file from GridFS."""
        await self._ensure_initialized()
        
        try:
            # Convert string ID to ObjectId
            object_id = ObjectId(file_id)
            
            # First, verify user ownership by getting file metadata
            try:
                grid_out = await self._gridfs.open_download_stream(object_id)
                if grid_out.metadata.get('user_id') != user_id:
                    logger.warning(f"⚠️ User {user_id} attempted to delete file {file_id} owned by {grid_out.metadata.get('user_id')}")
                    return False
            except NoFile:
                logger.info(f"📁 File {file_id} not found for deletion")
                return False
            
            # Delete the file using GridFS bucket API
            await self._gridfs.delete(object_id)
            
            logger.info(f"🗑️ Deleted file {file_id} for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to delete file {file_id} for user {user_id}: {e}")
            return False
    
    async def file_exists(self, file_id: str, user_id: str) -> bool:
        """Check if file exists and user has access."""
        await self._ensure_initialized()
        
        try:
            # Convert string ID to ObjectId
            object_id = ObjectId(file_id)
            
            # Check if file exists using GridFS bucket find method
            cursor = self._gridfs.find({"_id": object_id})
            files = await cursor.to_list(length=1)
            
            if not files:
                return False
            
            # Verify user ownership - files are documents from fs.files collection
            file_doc = files[0]
            # The metadata is in the metadata field of the document
            file_metadata = file_doc.get('metadata', {})
            return file_metadata.get('user_id') == user_id
            
        except Exception as e:
            logger.error(f"❌ Failed to check file existence {file_id} for user {user_id}: {e}")
            return False
    
    async def get_file_metadata(self, file_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Get file metadata without content."""
        await self._ensure_initialized()
        
        try:
            # Convert string ID to ObjectId
            object_id = ObjectId(file_id)
            
            # Get file stream from GridFS
            grid_out = await self._gridfs.open_download_stream(object_id)
            
            # Verify user ownership
            if grid_out.metadata.get('user_id') != user_id:
                logger.warning(f"⚠️ User {user_id} attempted to access metadata for file {file_id} owned by {grid_out.metadata.get('user_id')}")
                return None
            
            return {
                'file_id': file_id,
                'filename': grid_out.filename,
                'content_type': grid_out.metadata.get('content_type'),
                'file_size': grid_out.length,
                'upload_date': grid_out.upload_date,
                'metadata': grid_out.metadata,
                'checksum': grid_out.metadata.get('checksum')
            }
            
        except NoFile:
            logger.info(f"📁 File {file_id} not found")
            return None
        except Exception as e:
            logger.error(f"❌ Failed to get metadata for file {file_id} for user {user_id}: {e}")
            return None
    
    async def health_check(self) -> Dict[str, Any]:
        """Check GridFS health."""
        try:
            await self._ensure_initialized()
            
            # Test basic GridFS operation
            test_data = b"health_check"
            test_stream = BytesIO(test_data)
            test_id = await self._gridfs.upload_from_stream(
                "health_check.txt",
                test_stream,
                metadata={'user_id': 'health_check', 'test': True}
            )
            
            # Clean up test file
            await self._gridfs.delete(test_id)
            
            return {
                'status': 'healthy',
                'service': 'gridfs_file_storage',
                'initialized': self._initialized,
                'max_file_size_mb': self.MAX_FILE_SIZE / (1024 * 1024),
                'allowed_content_types': list(self.ALLOWED_CONTENT_TYPES)
            }
            
        except Exception as e:
            return {
                'status': 'unhealthy',
                'service': 'gridfs_file_storage',
                'error': str(e)
            }


# Global service instance
_file_storage_service: Optional[GridFSFileStorage] = None


def get_file_storage_service() -> GridFSFileStorage:
    """Get global file storage service instance."""
    global _file_storage_service
    if _file_storage_service is None:
        _file_storage_service = GridFSFileStorage()
    return _file_storage_service
