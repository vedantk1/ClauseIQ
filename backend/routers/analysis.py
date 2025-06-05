"""
Document analysis routes.
"""
import os
import tempfile
import uuid
import asyncio
from datetime import datetime
from fastapi import APIRouter, File, UploadFile, HTTPException, Depends
import pdfplumber
from auth import get_current_user
from database import get_mongo_storage
from services.document_service import validate_file, extract_clauses
from services.ai_service import generate_document_summary, analyze_clause, is_ai_available
from models.analysis import ClauseAnalysisResponse
from models.document import AnalyzeDocumentResponse
from models.common import RiskLevel


router = APIRouter(tags=["analysis"])


@router.post("/analyze/")
async def analyze_document(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """Analyze document and extract sections with AI summaries."""
    validate_file(file)
    
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
            raise HTTPException(status_code=400, detail="No text could be extracted from the PDF.")

        # Get user's preferred model
        storage = get_mongo_storage()
        user_model = storage.get_user_preferred_model(current_user["id"])
        
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
        storage.save_document_for_user(document_data, current_user["id"])
        
        # Return response with sections and summary
        return {
            "id": doc_id,
            "filename": file.filename,
            "sections": sections,
            "summary": ai_summary,
            "message": "Document analyzed successfully"
        }
        
    except HTTPException:
        raise 
    except Exception as e:
        print(f"Error analyzing document: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while analyzing the document: {str(e)}"
        )
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception as e:
                print(f"Warning: Could not remove temporary file {temp_file_path}: {e}")


@router.post("/analyze-clauses/", response_model=ClauseAnalysisResponse)
async def analyze_clauses_only(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """Extract and analyze clauses from a document."""
    validate_file(file)
    
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
            raise HTTPException(status_code=400, detail="No text could be extracted from the PDF.")

        # Extract clauses
        clauses = extract_clauses(extracted_text)
        
        # Get user's preferred model for AI analysis
        storage = get_mongo_storage()
        user_model = storage.get_user_preferred_model(current_user["id"])
        
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
        
        return ClauseAnalysisResponse(
            clauses=analyzed_clauses,
            total_clauses=len(analyzed_clauses),
            risk_summary=risk_summary,
            document_id=doc_id
        )
        
    except HTTPException:
        raise 
    except Exception as e:
        print(f"Error analyzing clauses: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while analyzing clauses: {str(e)}"
        )
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception as e:
                print(f"Warning: Could not remove temporary file {temp_file_path}: {e}")


@router.get("/documents/{document_id}/clauses")
async def get_document_clauses(document_id: str, current_user: dict = Depends(get_current_user)):
    """Get clauses for a specific document."""
    storage = get_mongo_storage()
    
    # Get the document
    document = storage.get_document_for_user(document_id, current_user["id"])
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Extract clauses from the document text
    clauses = extract_clauses(document.get("text", ""))
    
    # Get user's preferred model
    user_model = storage.get_user_preferred_model(current_user["id"])
    
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
    
    return {
        "clauses": analyzed_clauses,
        "total_clauses": len(analyzed_clauses),
        "risk_summary": risk_summary,
        "document_id": document_id
    }


@router.post("/analyze-document/", response_model=AnalyzeDocumentResponse)
async def analyze_document_unified(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """Unified document analysis endpoint with full document summary and clause analysis."""
    validate_file(file)
    
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
            raise HTTPException(status_code=400, detail="No text could be extracted from the PDF.")

        # Get user's preferred model
        storage = get_mongo_storage()
        user_model = storage.get_user_preferred_model(current_user["id"])
        
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
        storage.save_document_for_user(document_data, current_user["id"])
        
        return AnalyzeDocumentResponse(
            id=doc_id,
            filename=file.filename,
            full_text=extracted_text[:500] + "..." if len(extracted_text) > 500 else extracted_text,
            summary=ai_summary,
            clauses=analyzed_clauses,
            total_clauses=len(analyzed_clauses),
            risk_summary=risk_summary
        )
        
    except HTTPException:
        raise 
    except Exception as e:
        print(f"Error in unified document analysis: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while analyzing the document: {str(e)}"
        )
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception as e:
                print(f"Warning: Could not remove temporary file {temp_file_path}: {e}")
