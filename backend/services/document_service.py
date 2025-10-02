"""
Document processing utilities.
"""
import os
import uuid
import logging
from datetime import datetime
from typing import List, Tuple, Dict, Any, Optional
from fastapi import UploadFile, HTTPException
from config.environments import get_environment_config
from models.common import Clause, ClauseType, RiskLevel, ContractType

logger = logging.getLogger(__name__)


# Get settings instance
settings = get_environment_config()
MAX_FILE_SIZE_BYTES = settings.file_upload.max_file_size_mb * 1024 * 1024


def validate_file(file: UploadFile):
    """Validate uploaded file for size, type, and security."""
    # Check file size
    if hasattr(file, 'size') and file.size and file.size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size allowed: {settings.file_upload.max_file_size_mb}MB"
        )
    
    # Check file type if filename is provided
    if file.filename:
        # Check for unsafe filename patterns
        if '..' in file.filename or '/' in file.filename or '\\' in file.filename:
            raise HTTPException(
                status_code=400,
                detail="Invalid filename - path traversal characters not allowed"
            )
        
        # Check file extension
        if not any(file.filename.lower().endswith(ext) for ext in settings.file_upload.allowed_file_types):
            raise HTTPException(
                status_code=400,
                detail=f"File type not supported. Allowed types: {', '.join(settings.file_upload.allowed_file_types)}"
            )


async def process_document_with_llm(document_text: str, filename: str = "", model: str = None) -> Tuple[ContractType, List[Clause]]:
    """
    Process a document using LLM-based analysis.
    
    Raises:
        Exception: When AI is not available or LLM processing fails
    
    Returns:
        Tuple of (contract_type, clauses)
    """
    # Get model from settings if not provided
    if model is None:
        from config.environments import get_environment_config
        config = get_environment_config()
        model = config.ai.default_model
        
    # MIGRATED: Using new modular AI services for better maintainability
    from services.ai_service import (
        detect_contract_type, 
        extract_clauses_with_llm,
    )
    from services.ai.client_manager import is_ai_available  # New modular import
    
    if not is_ai_available():
        raise Exception("AI processing is not available. Please check OpenAI API configuration.")
    
    try:
        # Step 1: Detect contract type
        print(f"Detecting contract type for document: {filename}")
        contract_type = await detect_contract_type(document_text, filename, model)
        print(f"Detected contract type: {contract_type}")
        
        # Step 2: Extract clauses using LLM
        print("Extracting clauses with LLM")
        clauses = await extract_clauses_with_llm(document_text, contract_type, model)
        print(f"Extracted {len(clauses)} clauses")
        
        return contract_type, clauses
        
    except Exception as e:
        print(f"Error in LLM document processing: {str(e)}")
        # Re-raise the exception instead of falling back to heuristics
        raise Exception(f"AI analysis failed: {str(e)}")


def is_llm_processing_available() -> bool:
    """Check if LLM-based document processing is available."""
    # MIGRATED: Using new modular AI client manager
    from services.ai.client_manager import is_ai_available
    return is_ai_available()


def calculate_risk_summary(clauses: List[Clause]) -> Dict[str, int]:
    """
    Calculate risk summary from list of clauses.
    
    Args:
        clauses: List of Clause objects
        
    Returns:
        Dictionary with counts of high, medium, and low risk clauses
    """
    return {
        "high": sum(1 for clause in clauses if clause.risk_level == RiskLevel.HIGH),
        "medium": sum(1 for clause in clauses if clause.risk_level == RiskLevel.MEDIUM),
        "low": sum(1 for clause in clauses if clause.risk_level == RiskLevel.LOW)
    }


def build_document_data(
    doc_id: str,
    filename: str,
    extracted_text: str,
    clauses: List[Clause],
    contract_type: ContractType,
    user_id: str,
    ai_structured_summary: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Build document data dictionary for storage.
    
    Args:
        doc_id: Document ID
        filename: Original filename
        extracted_text: Extracted text content
        clauses: List of analyzed clauses
        contract_type: Detected contract type
        user_id: User ID
        ai_structured_summary: Optional AI-generated summary
        
    Returns:
        Document data dictionary ready for storage
    """
    risk_summary = calculate_risk_summary(clauses)
    
    return {
        "id": doc_id,
        "filename": filename,
        "upload_date": datetime.now().isoformat(),
        "text": extracted_text,
        "ai_structured_summary": ai_structured_summary,
        "clauses": [clause.dict() for clause in clauses],
        "risk_summary": risk_summary,
        "contract_type": contract_type.value if contract_type else None,
        "user_id": user_id
    }


async def process_and_save_analyzed_document(
    doc_id: str,
    filename: str,
    extracted_text: str,
    clauses: List[Clause],
    contract_type: ContractType,
    user_id: str,
    ai_structured_summary: Optional[Dict[str, Any]],
    file_content: bytes,
    content_type: str = "application/pdf"
) -> Tuple[bool, Optional[str]]:
    """
    Process RAG, save document metadata and PDF file.
    
    This consolidates the complex save flow into a single method.
    
    Args:
        doc_id: Document ID
        filename: Original filename
        extracted_text: Extracted text content
        clauses: List of analyzed clauses
        contract_type: Detected contract type
        user_id: User ID
        ai_structured_summary: AI-generated summary
        file_content: Raw PDF file bytes
        content_type: Content type (default: application/pdf)
        
    Returns:
        Tuple of (success, error_message)
    """
    from database.service import get_document_service
    from services.rag_service import get_rag_service
    
    service = get_document_service()
    
    # Build document data
    document_data = build_document_data(
        doc_id, filename, extracted_text, clauses, 
        contract_type, user_id, ai_structured_summary
    )
    
    # Process RAG before saving document
    try:
        rag_service = get_rag_service()
        logger.info(f"Starting RAG processing for document {doc_id}")
        
        rag_data = await rag_service.process_document_for_rag(
            document_id=doc_id,
            text=extracted_text,
            filename=filename,
            user_id=user_id
        )
        
        # Update document with RAG metadata
        if rag_data:
            document_data["rag_processed"] = True
            document_data["pinecone_stored"] = rag_data.get("pinecone_stored", False)
            document_data["chunk_count"] = rag_data.get("chunk_count", 0)
            document_data["chunk_ids"] = rag_data.get("chunk_ids", [])
            document_data["embedding_model"] = rag_data.get("embedding_model")
            document_data["rag_processed_at"] = rag_data.get("processed_at")
            document_data["storage_service"] = rag_data.get("storage_service")
            logger.info(f"Document {doc_id} processed for RAG with {rag_data.get('chunk_count', 0)} chunks")
        else:
            logger.warning(f"RAG processing returned no data for document {doc_id}")
            
    except Exception as rag_error:
        # RAG processing failure should not break document analysis
        logger.warning(f"RAG processing failed for document {doc_id}: {rag_error}")
        document_data["rag_processed"] = False
    
    # Save to storage with RAG metadata included
    logger.info(f"Saving document {doc_id} to database...")
    try:
        # First save document metadata
        await service.save_document_for_user(document_data, user_id)
        logger.info(f"Document {doc_id} saved successfully to database")
        
        # Then store the PDF file (atomic operation)
        try:
            logger.info(f"Storing PDF file for document {doc_id}")
            pdf_stored = await service.store_pdf_file(
                document_id=doc_id,
                user_id=user_id,
                file_data=file_content,
                filename=filename,
                content_type=content_type
            )
            
            if pdf_stored:
                logger.info(f"PDF file stored successfully for document {doc_id}")
            else:
                logger.warning(f"Failed to store PDF file for document {doc_id}")
                # Don't fail the entire upload if PDF storage fails
                
        except Exception as pdf_error:
            logger.error(f"PDF storage failed for document {doc_id}: {pdf_error}")
            # Don't fail the entire upload if PDF storage fails
            # The document analysis was successful, PDF storage is supplementary
        
        return True, None
        
    except Exception as save_error:
        logger.error(f"Failed to save document {doc_id}: {save_error}")
        return False, f"Failed to save document: {str(save_error)}"
