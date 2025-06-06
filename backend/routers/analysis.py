"""
Document analysis routes.
"""
import os
import tempfile
import uuid
import asyncio
from datetime import datetime
from fastapi import APIRouter, File, UploadFile, HTTPException, Depends, Request
import pdfplumber
from auth import get_current_user
from database.service import get_document_service
from middleware.api_standardization import APIResponse, create_success_response, create_error_response
from middleware.versioning import versioned_response, deprecated_endpoint
from services.document_service import validate_file, extract_clauses
from services.ai_service import generate_document_summary, analyze_clause, is_ai_available
from models.analysis import ClauseAnalysisResponse
from models.document import AnalyzeDocumentResponse
from clauseiq_types.common import RiskLevel, Clause, RiskSummary


router = APIRouter(tags=["analysis"])


@router.post("/analyze/", response_model=APIResponse[dict])
@versioned_response
async def analyze_document(
    request: Request,
    file: UploadFile = File(...), 
    current_user: dict = Depends(get_current_user)
):
    """Analyze document and extract sections with AI summaries."""
    correlation_id = getattr(request.state, 'correlation_id', None)
    
    try:
        validate_file(file)
        service = await get_document_service()
        
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
            
            # Extract sections
            from services.document_service import extract_sections
            sections = extract_sections(extracted_text)
            
            # Generate AI summaries for sections if available
            if is_ai_available():
                from services.ai_service import generate_summary
                for section in sections:
                    section.summary = await generate_summary(section.text, section.heading, user_model)
            
            # Generate document-level summary
            ai_summary = "Summary not generated."
            if is_ai_available():
                ai_summary = await generate_document_summary(extracted_text, file.filename, user_model)
            else:
                ai_summary = "OpenAI client not configured. Summary not generated."
            
            # Create document entry with sections
            doc_id = str(uuid.uuid4())
            document_data = {
                "id": doc_id,
                "filename": file.filename,
                "upload_date": datetime.now().isoformat(),
                "text": extracted_text,
                "ai_full_summary": ai_summary,
                "sections": [section.dict() for section in sections],
                "user_id": current_user["id"]
            }
            
            # Save to storage
            await service.save_document_for_user(document_data, current_user["id"])
            
            # Return response with sections and summary
            response_data = {
                "id": doc_id,
                "filename": file.filename,
                "sections": sections,
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
        service = await get_document_service()
        
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

            # Extract clauses
            clauses = extract_clauses(extracted_text)
            
            # Get user's preferred model for AI analysis
            user_model = await service.get_user_preferred_model(current_user["id"])
            
            # Analyze clauses with AI if available
            if is_ai_available():
                # Analyze clauses concurrently for better performance
                analysis_tasks = [analyze_clause(clause, user_model) for clause in clauses]
                analyzed_clauses = await asyncio.gather(*analysis_tasks)
            else:
                analyzed_clauses = clauses
            
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
        service = await get_document_service()
        
        # Get the document
        document = await service.get_document_for_user(document_id, current_user["id"])
        if not document:
            return create_error_response(
                code="DOCUMENT_NOT_FOUND",
                message="Document not found",
                correlation_id=correlation_id
            )
        
        # Extract clauses from the document text
        clauses = extract_clauses(document.get("text", ""))
        
        # Get user's preferred model
        user_model = await service.get_user_preferred_model(current_user["id"])
        
        # Analyze clauses if AI is available
        if is_ai_available() and clauses:
            analysis_tasks = [analyze_clause(clause, user_model) for clause in clauses]
            analyzed_clauses = await asyncio.gather(*analysis_tasks)
        else:
            analyzed_clauses = clauses
        
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
        service = await get_document_service()
        
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
            
            # Generate document-level summary
            ai_summary = "Summary not generated."
            if is_ai_available():
                ai_summary = await generate_document_summary(extracted_text, file.filename, user_model)
            else:
                ai_summary = "OpenAI client not configured. Summary not generated."
            
            # Extract and analyze clauses
            clauses = extract_clauses(extracted_text)
            
            # Analyze clauses with AI if OpenAI API is configured
            if is_ai_available():
                # Analyze clauses concurrently for better performance
                analysis_tasks = [analyze_clause(clause, user_model) for clause in clauses]
                analyzed_clauses = await asyncio.gather(*analysis_tasks)
            else:
                analyzed_clauses = clauses
            
            # Calculate risk summary
            risk_summary = {
                "high": sum(1 for clause in analyzed_clauses if clause.risk_level == RiskLevel.HIGH),
                "medium": sum(1 for clause in analyzed_clauses if clause.risk_level == RiskLevel.MEDIUM),
                "low": sum(1 for clause in analyzed_clauses if clause.risk_level == RiskLevel.LOW)
            }
            
            # Create unified document entry with both summary and clauses
            doc_id = str(uuid.uuid4())
            document_data = {
                "id": doc_id,
                "filename": file.filename,
                "upload_date": datetime.now().isoformat(),
                "text": extracted_text,
                "ai_full_summary": ai_summary,
                "sections": [],  # Keeping for compatibility
                "clauses": [clause.dict() for clause in analyzed_clauses],
                "risk_summary": risk_summary,
                "user_id": current_user["id"]
            }
            
            # Save unified document to storage in one operation
            await service.save_document_for_user(document_data, current_user["id"])
            
            response_data = AnalyzeDocumentResponse(
                id=doc_id,
                filename=file.filename,
                full_text=extracted_text[:500] + "..." if len(extracted_text) > 500 else extracted_text,
                summary=ai_summary,
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
