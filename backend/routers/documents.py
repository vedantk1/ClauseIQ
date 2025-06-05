"""
Document management routes.
"""
import os
import tempfile
import uuid
from datetime import datetime
from fastapi import APIRouter, File, UploadFile, HTTPException, Depends
import pdfplumber
from auth import get_current_user
from database import get_mongo_storage
from services.document_service import validate_file, extract_sections
from models.document import (
    ProcessDocumentResponse,
    DocumentListResponse,
    DocumentDetailResponse
)


router = APIRouter(tags=["documents"])


@router.post("/extract-text/")
async def extract_text(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """Extract text from uploaded PDF file."""
    validate_file(file)
    
    # Create a temporary file to save the uploaded content
    temp_file_path = None
    
    try:
        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
            temp_file_path = temp_file.name
            
            # Read and write file content
            content = await file.read()
            temp_file.write(content)
        
        # Extract text from PDF
        extracted_text = ""
        with pdfplumber.open(temp_file_path) as pdf:
            for page in pdf.pages:
                extracted_text += page.extract_text() or ""
        
        if not extracted_text.strip():
            raise HTTPException(status_code=400, detail="No text could be extracted from the PDF.")
        
        return {"text": extracted_text, "filename": file.filename}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error extracting text: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while extracting text: {str(e)}"
        )
    finally:
        # Clean up temporary file
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception as e:
                print(f"Warning: Could not remove temporary file {temp_file_path}: {e}")


@router.get("/documents/", response_model=DocumentListResponse)
async def list_documents(current_user: dict = Depends(get_current_user)):
    """Get list of documents for the current user."""
    storage = get_mongo_storage()
    user_docs = storage.get_documents_for_user(current_user["id"])
    return {"documents": user_docs}


@router.get("/documents/{document_id}", response_model=DocumentDetailResponse)
async def retrieve_document(document_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific document by ID."""
    storage = get_mongo_storage()
    document = storage.get_document_for_user(document_id, current_user["id"])
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@router.delete("/documents/{document_id}")
async def delete_document(document_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a specific document."""
    storage = get_mongo_storage()
    
    # First check if the document exists and belongs to the user
    document = storage.get_document_for_user(document_id, current_user["id"])
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Delete the document
    success = storage.delete_document_for_user(document_id, current_user["id"])
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete document")
    
    return {"message": "Document deleted successfully"}


@router.delete("/documents")
async def delete_all_documents(current_user: dict = Depends(get_current_user)):
    """Delete all documents for the current user."""
    storage = get_mongo_storage()
    
    success = storage.delete_all_documents_for_user(current_user["id"])
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete documents")
    
    return {"message": "All documents deleted successfully"}


@router.post("/process-document/", response_model=ProcessDocumentResponse)
async def process_document(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """Process and store a document with sections."""
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

        # Extract sections from the document
        sections = extract_sections(extracted_text)
        
        # Generate summary using AI service
        from services.ai_service import generate_document_summary, is_ai_available
        storage = get_mongo_storage()
        user_model = storage.get_user_preferred_model(current_user["id"])
        
        ai_summary = "Summary not generated."
        if is_ai_available():
            ai_summary = await generate_document_summary(extracted_text, file.filename, user_model)
        else:
            ai_summary = "OpenAI client not configured. Summary not generated."
        
        # Create document entry
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
        
        return ProcessDocumentResponse(
            id=doc_id,
            filename=file.filename,
            full_text=extracted_text[:500] + "..." if len(extracted_text) > 500 else extracted_text,
            summary=ai_summary
        )
        
    except HTTPException:
        raise 
    except Exception as e:
        print(f"Error processing document: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while processing the document: {str(e)}"
        )
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception as e:
                print(f"Warning: Could not remove temporary file {temp_file_path}: {e}")
