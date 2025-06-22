"""
Document Processing Pipeline for ClauseIQ

A clean, event-driven architecture for handling document upload, text extraction,
RAG processing, and status management.

DESIGN PRINCIPLES:
- Single Responsibility: Each service handles one concern
- Event-Driven: Clear pipeline stages with status tracking
- Async-First: Proper async/await throughout
- Error Resilience: Graceful failure handling at each stage
- Testable: Each stage can be tested independently
"""
import asyncio
import logging
from datetime import datetime
from enum import Enum
from typing import Dict, Any, Optional, List, Callable
from dataclasses import dataclass

logger = logging.getLogger(__name__)


class DocumentStatus(str, Enum):
    """Document processing status states."""
    UPLOADED = "uploaded"                    # File uploaded, not processed
    EXTRACTING_TEXT = "extracting_text"     # Text extraction in progress
    TEXT_EXTRACTED = "text_extracted"       # Text extraction complete
    PROCESSING_RAG = "processing_rag"       # RAG processing in progress
    RAG_PROCESSED = "rag_processed"         # RAG processing complete, ready for chat
    FAILED = "failed"                       # Processing failed
    READY = "ready"                         # Fully processed and ready


@dataclass
class DocumentProcessingResult:
    """Result of document processing operation."""
    success: bool
    status: DocumentStatus
    message: str
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


@dataclass
class ProcessingContext:
    """Context passed through the processing pipeline."""
    document_id: str
    user_id: str
    filename: str
    file_content: Optional[bytes] = None
    extracted_text: Optional[str] = None
    rag_data: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None


class DocumentProcessor:
    """
    Main document processing pipeline.
    
    Orchestrates the entire document processing workflow from upload to RAG.
    """
    
    def __init__(self):
        self._text_extractor = None
        self._rag_service = None
        self._document_service = None
        
    async def _get_services(self):
        """Lazy initialization of services."""
        if self._text_extractor is None:
            from services.ai.text_extractor import get_text_extractor
            self._text_extractor = get_text_extractor()
            
        if self._rag_service is None:
            from services.rag_service import get_rag_service
            self._rag_service = get_rag_service()
            
        if self._document_service is None:
            from database.service import get_document_service
            self._document_service = get_document_service()
    
    async def process_document(
        self, 
        document_id: str, 
        user_id: str, 
        filename: str,
        file_content: bytes,
        skip_rag: bool = False
    ) -> DocumentProcessingResult:
        """
        Process document through the complete pipeline.
        
        Args:
            document_id: Document ID
            user_id: User ID
            filename: Original filename
            file_content: Raw file bytes
            skip_rag: Skip RAG processing (for testing)
            
        Returns:
            DocumentProcessingResult with final status
        """
        context = ProcessingContext(
            document_id=document_id,
            user_id=user_id,
            filename=filename,
            file_content=file_content
        )
        
        try:
            await self._get_services()
            
            # Step 1: Update status to extracting
            await self._update_document_status(context, DocumentStatus.EXTRACTING_TEXT)
            
            # Step 2: Extract text
            result = await self._extract_text(context)
            if not result.success:
                await self._update_document_status(context, DocumentStatus.FAILED, result.error)
                return result
                
            # Step 3: Update status to text extracted
            await self._update_document_status(context, DocumentStatus.TEXT_EXTRACTED)
            
            if skip_rag:
                await self._update_document_status(context, DocumentStatus.READY)
                return DocumentProcessingResult(
                    success=True,
                    status=DocumentStatus.READY,
                    message="Document processed successfully (RAG skipped)",
                    data={"text_length": len(context.extracted_text)}
                )
            
            # Step 4: Process RAG
            await self._update_document_status(context, DocumentStatus.PROCESSING_RAG)
            
            result = await self._process_rag(context)
            if not result.success:
                await self._update_document_status(context, DocumentStatus.FAILED, result.error)
                return result
                
            # Step 5: Mark as fully processed
            await self._update_document_status(context, DocumentStatus.RAG_PROCESSED)
            await self._finalize_processing(context)
            
            return DocumentProcessingResult(
                success=True,
                status=DocumentStatus.READY,
                message="Document processed successfully",
                data={
                    "text_length": len(context.extracted_text),
                    "rag_chunks": context.rag_data.get("chunk_count", 0) if context.rag_data else 0
                }
            )
            
        except Exception as e:
            logger.error(f"Document processing failed for {document_id}: {e}")
            await self._update_document_status(context, DocumentStatus.FAILED, str(e))
            return DocumentProcessingResult(
                success=False,
                status=DocumentStatus.FAILED,
                message="Document processing failed",
                error=str(e)
            )
    
    async def _extract_text(self, context: ProcessingContext) -> DocumentProcessingResult:
        """Extract text from document."""
        try:
            if not context.file_content:
                return DocumentProcessingResult(
                    success=False,
                    status=DocumentStatus.FAILED,
                    message="No file content provided",
                    error="Missing file content"
                )
            
            # Extract text using the text extractor service
            context.extracted_text = await self._text_extractor.extract_text(
                context.file_content, 
                context.filename
            )
            
            if not context.extracted_text or len(context.extracted_text.strip()) < 50:
                return DocumentProcessingResult(
                    success=False,
                    status=DocumentStatus.FAILED,
                    message="Text extraction failed or document too short",
                    error="Insufficient text content"
                )
            
            # Save extracted text to document
            await self._document_service.update_document(context.document_id, {
                "extracted_text": context.extracted_text,
                "text_extracted_at": datetime.utcnow().isoformat(),
                "text_length": len(context.extracted_text)
            })
            
            return DocumentProcessingResult(
                success=True,
                status=DocumentStatus.TEXT_EXTRACTED,
                message="Text extracted successfully",
                data={"text_length": len(context.extracted_text)}
            )
            
        except Exception as e:
            logger.error(f"Text extraction failed for {context.document_id}: {e}")
            return DocumentProcessingResult(
                success=False,
                status=DocumentStatus.FAILED,
                message="Text extraction failed",
                error=str(e)
            )
    
    async def _process_rag(self, context: ProcessingContext) -> DocumentProcessingResult:
        """Process document for RAG."""
        try:
            # Check if RAG service is available
            if not await self._rag_service.is_available():
                return DocumentProcessingResult(
                    success=False,
                    status=DocumentStatus.FAILED,
                    message="RAG service not available",
                    error="Vector service unavailable"
                )
            
            # Process document for RAG
            context.rag_data = await self._rag_service.process_document_for_rag(
                document_id=context.document_id,
                text=context.extracted_text,
                filename=context.filename,
                user_id=context.user_id
            )
            
            return DocumentProcessingResult(
                success=True,
                status=DocumentStatus.RAG_PROCESSED,
                message="RAG processing completed",
                data=context.rag_data
            )
            
        except Exception as e:
            logger.error(f"RAG processing failed for {context.document_id}: {e}")
            return DocumentProcessingResult(
                success=False,
                status=DocumentStatus.FAILED,
                message="RAG processing failed",
                error=str(e)
            )
    
    async def _update_document_status(
        self, 
        context: ProcessingContext, 
        status: DocumentStatus,
        error_message: Optional[str] = None
    ):
        """Update document processing status."""
        try:
            update_data = {
                "processing_status": status.value,
                "updated_at": datetime.utcnow().isoformat()
            }
            
            if error_message:
                update_data["processing_error"] = error_message
                update_data["failed_at"] = datetime.utcnow().isoformat()
            
            await self._document_service.update_document(context.document_id, update_data)
            logger.info(f"Document {context.document_id} status updated to {status.value}")
            
        except Exception as e:
            logger.error(f"Failed to update document status for {context.document_id}: {e}")
    
    async def _finalize_processing(self, context: ProcessingContext):
        """Finalize document processing with all metadata."""
        try:
            update_data = {
                "processing_status": DocumentStatus.READY.value,
                "rag_processed": True,
                "ready_for_chat": True,
                "processed_at": datetime.utcnow().isoformat()
            }
            
            # Add RAG metadata if available
            if context.rag_data:
                update_data.update({
                    "rag_chunk_count": context.rag_data.get("chunk_count", 0),
                    "rag_embedding_model": context.rag_data.get("embedding_model"),
                    "rag_vector_store": context.rag_data.get("vector_store", "pinecone"),
                    "rag_processed_at": datetime.utcnow().isoformat()
                })
            
            await self._document_service.update_document(context.document_id, update_data)
            logger.info(f"Document {context.document_id} processing finalized")
            
        except Exception as e:
            logger.error(f"Failed to finalize document processing for {context.document_id}: {e}")
    
    async def get_processing_status(self, document_id: str, user_id: str) -> Dict[str, Any]:
        """Get current processing status of a document."""
        try:
            await self._get_services()
            document = await self._document_service.get_document_for_user(document_id, user_id)
            
            if not document:
                return {
                    "status": "not_found",
                    "message": "Document not found"
                }
            
            status = document.get("processing_status", DocumentStatus.UPLOADED.value)
            
            return {
                "status": status,
                "rag_processed": document.get("rag_processed", False),
                "ready_for_chat": document.get("ready_for_chat", False),
                "text_length": document.get("text_length", 0),
                "chunk_count": document.get("rag_chunk_count", 0),
                "processed_at": document.get("processed_at"),
                "error": document.get("processing_error")
            }
            
        except Exception as e:
            logger.error(f"Failed to get processing status for {document_id}: {e}")
            return {
                "status": "error",
                "message": "Failed to get status",
                "error": str(e)
            }


# Global processor instance
_document_processor = None

def get_document_processor() -> DocumentProcessor:
    """Get the global document processor instance."""
    global _document_processor
    if _document_processor is None:
        _document_processor = DocumentProcessor()
    return _document_processor
