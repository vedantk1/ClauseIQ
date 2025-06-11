"""
Document analysis routes.
"""
import os
import tempfile
import uuid
from datetime import datetime
from fastapi import APIRouter, File, UploadFile, HTTPException, Depends, Request
import pdfplumber
from auth import get_current_user
from database.service import get_document_service
from middleware.api_standardization import APIResponse, create_success_response, create_error_response
from middleware.versioning import versioned_response, deprecated_endpoint
from services.document_service import validate_file, process_document_with_llm, is_llm_processing_available
from services.ai_service import generate_contract_specific_summary, generate_structured_document_summary
from models.analysis import ClauseAnalysisResponse
from models.document import AnalyzeDocumentResponse
from clauseiq_types.common import RiskLevel, Clause, RiskSummary, ContractType


router = APIRouter(tags=["analysis"])


@router.post("/analyze/", response_model=APIResponse[dict])
@versioned_response
async def analyze_document(
    request: Request,
    file: UploadFile = File(...), 
    current_user: dict = Depends(get_current_user)
):
    """Analyze document and extract clauses with AI summaries."""
    correlation_id = getattr(request.state, 'correlation_id', None)
    
    try:
        validate_file(file)
        service = get_document_service()
        
        temp_file_path = None
        
        try:
            # Create temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
                temp_file_path = temp_file.name
                content = await file.read()
                temp_file.write(content)
            
            # Extract text from PDF
            extracted_text = ""
            with pdfplumber.open(temp_file_path) as pdf:
                for page in pdf.pages:
                    extracted_text += page.extract_text() or ""
            
            if not extracted_text.strip():
                return create_error_response(
                    code="PDF_EXTRACTION_FAILED",
                    message="No text could be extracted from the PDF",
                    correlation_id=correlation_id
                )

            # Get user's preferred model
            user_model = await service.get_user_preferred_model(current_user["id"])
            
            # Check if LLM processing is available
            if not is_llm_processing_available():
                return create_error_response(
                    code="LLM_NOT_AVAILABLE",
                    message="AI processing is not available. Please check OpenAI API configuration.",
                    correlation_id=correlation_id
                )
            
            print("Using LLM-based document processing")
            contract_type, clauses = await process_document_with_llm(
                extracted_text, file.filename, user_model
            )
            
            # Generate contract-specific document summary
            ai_summary = await generate_contract_specific_summary(
                extracted_text, contract_type, file.filename, user_model
            )
            
            # Generate structured summary for improved UI display
            ai_structured_summary = await generate_structured_document_summary(
                extracted_text, file.filename, user_model
            )
            
            # Create document entry with clauses and contract type
            doc_id = str(uuid.uuid4())
            document_data = {
                "id": doc_id,
                "filename": file.filename,
                "upload_date": datetime.now().isoformat(),
                "text": extracted_text,
                "ai_full_summary": ai_summary,
                "ai_structured_summary": ai_structured_summary,
                "clauses": [clause.dict() for clause in clauses],
                "contract_type": contract_type.value if contract_type else None,
                "user_id": current_user["id"]
            }
            
            # Save to storage
            await service.save_document_for_user(document_data, current_user["id"])
            
            # Return response with clauses and summary
            response_data = {
                "id": doc_id,
                "filename": file.filename,
                "clauses": clauses,
                "summary": ai_summary,
                "message": "Document analyzed successfully"
            }
            
            return create_success_response(
                data=response_data,
                correlation_id=correlation_id
            )
            
        finally:
            if temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.remove(temp_file_path)
                except Exception as e:
                    print(f"Warning: Could not remove temporary file {temp_file_path}: {e}")
        
    except Exception as e:
        print(f"Error analyzing document: {str(e)}")
        return create_error_response(
            code="DOCUMENT_ANALYSIS_FAILED",
            message=f"An error occurred while analyzing the document: {str(e)}",
            correlation_id=correlation_id
        )


@router.post("/analyze-clauses/", response_model=APIResponse[ClauseAnalysisResponse])
@versioned_response
async def analyze_clauses_only(
    request: Request,
    file: UploadFile = File(...), 
    current_user: dict = Depends(get_current_user)
):
    """Extract and analyze clauses from a document."""
    correlation_id = getattr(request.state, 'correlation_id', None)
    
    try:
        validate_file(file)
        service = get_document_service()
        
        temp_file_path = None
        
        try:
            # Create temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
                temp_file_path = temp_file.name
                content = await file.read()
                temp_file.write(content)
            
            # Extract text from PDF
            extracted_text = ""
            with pdfplumber.open(temp_file_path) as pdf:
                for page in pdf.pages:
                    extracted_text += page.extract_text() or ""
            
            if not extracted_text.strip():
                return create_error_response(
                    code="PDF_EXTRACTION_FAILED",
                    message="No text could be extracted from the PDF",
                    correlation_id=correlation_id
                )

            # Get user's preferred model for AI analysis
            user_model = await service.get_user_preferred_model(current_user["id"])
            
            # Check if LLM processing is available
            if not is_llm_processing_available():
                return create_error_response(
                    code="LLM_NOT_AVAILABLE",
                    message="AI processing is not available. Please check OpenAI API configuration.",
                    correlation_id=correlation_id
                )
            
            print("Using LLM-based clause extraction")
            # First detect contract type to get relevant clause types
            from services.ai_service import detect_contract_type, extract_clauses_with_llm
            contract_type = await detect_contract_type(extracted_text, file.filename, user_model)
            analyzed_clauses = await extract_clauses_with_llm(extracted_text, contract_type, user_model)
            
            # Calculate risk summary
            risk_summary = {
                "high": sum(1 for clause in analyzed_clauses if clause.risk_level == RiskLevel.HIGH),
                "medium": sum(1 for clause in analyzed_clauses if clause.risk_level == RiskLevel.MEDIUM),
                "low": sum(1 for clause in analyzed_clauses if clause.risk_level == RiskLevel.LOW)
            }
            
            # Generate a document ID for this analysis
            doc_id = str(uuid.uuid4())
            
            response_data = ClauseAnalysisResponse(
                clauses=analyzed_clauses,
                total_clauses=len(analyzed_clauses),
                risk_summary=risk_summary,
                document_id=doc_id
            )
            
            return create_success_response(
                data=response_data,
                correlation_id=correlation_id
            )
            
        finally:
            if temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.remove(temp_file_path)
                except Exception as e:
                    print(f"Warning: Could not remove temporary file {temp_file_path}: {e}")
        
    except Exception as e:
        print(f"Error analyzing clauses: {str(e)}")
        return create_error_response(
            code="CLAUSE_ANALYSIS_FAILED",
            message=f"An error occurred while analyzing clauses: {str(e)}",
            correlation_id=correlation_id
        )


@router.get("/documents/{document_id}/clauses", response_model=APIResponse[dict])
@versioned_response
async def get_document_clauses(
    document_id: str, 
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Get clauses for a specific document."""
    correlation_id = getattr(request.state, 'correlation_id', None)
    
    try:
        service = get_document_service()
        
        # Get the document
        document = await service.get_document_for_user(document_id, current_user["id"])
        if not document:
            return create_error_response(
                code="DOCUMENT_NOT_FOUND",
                message="Document not found",
                correlation_id=correlation_id
            )
        
        # Get user's preferred model
        user_model = await service.get_user_preferred_model(current_user["id"])
        
        # Check if LLM processing is available
        if not is_llm_processing_available():
            return create_error_response(
                code="LLM_NOT_AVAILABLE",
                message="AI processing is not available. Please check OpenAI API configuration.",
                correlation_id=correlation_id
            )
        
        # Use LLM-based clause extraction
        from services.ai_service import extract_clauses_with_llm, detect_contract_type
        
        # Detect contract type first (or use saved one if available)
        contract_type = document.get("contract_type")
        if not contract_type:
            contract_type = await detect_contract_type(document.get("text", ""), document.get("filename", ""), user_model)
        else:
            # Convert string back to ContractType enum
            from clauseiq_types.common import ContractType
            contract_type = ContractType(contract_type)
        
        analyzed_clauses = await extract_clauses_with_llm(document.get("text", ""), contract_type, user_model)
        
        # Calculate risk summary
        risk_summary = {
            "high": sum(1 for clause in analyzed_clauses if clause.risk_level == RiskLevel.HIGH),
            "medium": sum(1 for clause in analyzed_clauses if clause.risk_level == RiskLevel.MEDIUM),
            "low": sum(1 for clause in analyzed_clauses if clause.risk_level == RiskLevel.LOW)
        }
        
        response_data = {
            "clauses": analyzed_clauses,
            "total_clauses": len(analyzed_clauses),
            "risk_summary": risk_summary,
            "document_id": document_id
        }
        
        return create_success_response(
            data=response_data,
            correlation_id=correlation_id
        )
        
    except Exception as e:
        print(f"Error getting document clauses: {str(e)}")
        return create_error_response(
            code="CLAUSE_RETRIEVAL_FAILED",
            message=f"An error occurred while retrieving clauses: {str(e)}",
            correlation_id=correlation_id
        )


@router.post("/analyze-document/", response_model=APIResponse[AnalyzeDocumentResponse])
@versioned_response
async def analyze_document_unified(
    request: Request,
    file: UploadFile = File(...), 
    current_user: dict = Depends(get_current_user)
):
    """Unified document analysis endpoint with full document summary and clause analysis."""
    correlation_id = getattr(request.state, 'correlation_id', None)
    
    try:
        validate_file(file)
        service = get_document_service()
        
        temp_file_path = None
        
        try:
            # Create temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
                temp_file_path = temp_file.name
                content = await file.read()
                temp_file.write(content)
            
            # Extract text from PDF
            extracted_text = ""
            with pdfplumber.open(temp_file_path) as pdf:
                for page in pdf.pages:
                    extracted_text += page.extract_text() or ""
            
            if not extracted_text.strip():
                return create_error_response(
                    code="PDF_EXTRACTION_FAILED",
                    message="No text could be extracted from the PDF",
                    correlation_id=correlation_id
                )

            # Get user's preferred model
            user_model = await service.get_user_preferred_model(current_user["id"])
            
            # Check if LLM processing is available
            if not is_llm_processing_available():
                return create_error_response(
                    code="LLM_NOT_AVAILABLE",
                    message="AI processing is not available. Please check OpenAI API configuration.",
                    correlation_id=correlation_id
                )
            
            print("Using LLM-based document processing")
            # Process document with full LLM pipeline
            contract_type, analyzed_clauses = await process_document_with_llm(
                extracted_text, file.filename, user_model
            )
            
            # Generate contract-specific summary
            ai_summary = await generate_contract_specific_summary(
                extracted_text, contract_type, file.filename, user_model
            )
            
            # Generate structured summary for improved UI display
            ai_structured_summary = await generate_structured_document_summary(
                extracted_text, file.filename, user_model
            )
            
            # Calculate risk summary
            risk_summary = {
                "high": sum(1 for clause in analyzed_clauses if clause.risk_level == RiskLevel.HIGH),
                "medium": sum(1 for clause in analyzed_clauses if clause.risk_level == RiskLevel.MEDIUM),
                "low": sum(1 for clause in analyzed_clauses if clause.risk_level == RiskLevel.LOW)
            }
            
            # Create unified document entry with clauses
            doc_id = str(uuid.uuid4())
            document_data = {
                "id": doc_id,
                "filename": file.filename,
                "upload_date": datetime.now().isoformat(),
                "text": extracted_text,
                "ai_full_summary": ai_summary,
                "ai_structured_summary": ai_structured_summary,
                "clauses": [clause.dict() for clause in analyzed_clauses],
                "risk_summary": risk_summary,
                "contract_type": contract_type.value if contract_type else None,
                "user_id": current_user["id"]
            }
            
            # Save unified document to storage in one operation
            await service.save_document_for_user(document_data, current_user["id"])
            
            response_data = AnalyzeDocumentResponse(
                id=doc_id,
                filename=file.filename,
                full_text=extracted_text[:500] + "..." if len(extracted_text) > 500 else extracted_text,
                summary=ai_summary,
                ai_structured_summary=ai_structured_summary,
                clauses=analyzed_clauses,
                total_clauses=len(analyzed_clauses),
                risk_summary=risk_summary
            )
            
            return create_success_response(
                data=response_data,
                correlation_id=correlation_id
            )
            
        finally:
            if temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.remove(temp_file_path)
                except Exception as e:
                    print(f"Warning: Could not remove temporary file {temp_file_path}: {e}")
        
    except Exception as e:
        print(f"Error in unified document analysis: {str(e)}")
        return create_error_response(
            code="UNIFIED_ANALYSIS_FAILED",
            message=f"An error occurred while analyzing the document: {str(e)}",
            correlation_id=correlation_id
        )
