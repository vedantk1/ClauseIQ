"""
Document processing utilities.
"""
import os
import pdfplumber
from typing import List, Tuple
from fastapi import UploadFile, HTTPException
from config.environments import get_environment_config
from models.common import Clause, ClauseType, RiskLevel, ContractType


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
