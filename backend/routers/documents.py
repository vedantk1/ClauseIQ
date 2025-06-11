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
from database.service import get_document_service
from middleware.api_standardization import APIResponse, ErrorResponse
from middleware.versioning import versioned_response
from services.document_service import validate_file
from models.document import (
    ProcessDocumentResponse,
    DocumentListResponse,
    DocumentDetailResponse
)


router = APIRouter(tags=["documents"])


@router.post("/extract-text/", response_model=APIResponse[dict])
@versioned_response("1.0")
async def extract_text(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """Extract text from uploaded PDF file."""
    try:
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
                return ErrorResponse(
                    error="NO_TEXT_EXTRACTED",
                    message="No text could be extracted from the PDF",
                    status_code=400
                )
            
            return APIResponse(
                success=True,
                data={"text": extracted_text, "filename": file.filename},
                message="Text extracted successfully"
            )
            
        except Exception as e:
            return ErrorResponse(
                error="TEXT_EXTRACTION_FAILED",
                message=f"An error occurred while extracting text: {str(e)}",
                status_code=500
            )
        finally:
            # Clean up temporary file
            if temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.remove(temp_file_path)
                except Exception as e:
                    print(f"Warning: Could not remove temporary file {temp_file_path}: {e}")
    
    except Exception as e:
        return ErrorResponse(
            error="INVALID_FILE",
            message=f"File validation failed: {str(e)}",
            status_code=400
        )


@router.get("/documents/", response_model=APIResponse[DocumentListResponse])
@versioned_response("1.0")
async def list_documents(current_user: dict = Depends(get_current_user)):
    """Get list of documents for the current user."""
    try:
        service = get_document_service()
        user_docs = await service.get_documents_for_user(current_user["id"])
        
        response_data = DocumentListResponse(documents=user_docs)
        return APIResponse(
            success=True,
            data=response_data,
            message="Documents retrieved successfully"
        )
    except Exception as e:
        return ErrorResponse(
            error="DOCUMENTS_FETCH_FAILED",
            message=f"Failed to retrieve documents: {str(e)}",
            status_code=500
        )


@router.get("/documents/{document_id}", response_model=APIResponse[DocumentDetailResponse])
@versioned_response("1.0") 
async def retrieve_document(document_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific document by ID."""
    try:
        service = get_document_service()
        document = await service.get_document_for_user(document_id, current_user["id"])
        
        if not document:
            return ErrorResponse(
                error="DOCUMENT_NOT_FOUND",
                message="Document not found",
                status_code=404
            )
        
        response_data = DocumentDetailResponse(**document)
        return APIResponse(
            success=True,
            data=response_data,
            message="Document retrieved successfully"
        )
    except Exception as e:
        return ErrorResponse(
            error="DOCUMENT_FETCH_FAILED",
            message=f"Failed to retrieve document: {str(e)}",
            status_code=500
        )


@router.delete("/documents/{document_id}", response_model=APIResponse[dict])
@versioned_response("1.0")
async def delete_document(document_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a specific document."""
    try:
        service = get_document_service()
        
        # First check if the document exists and belongs to the user
        document = await service.get_document_for_user(document_id, current_user["id"])
        if not document:
            return ErrorResponse(
                error="DOCUMENT_NOT_FOUND",
                message="Document not found",
                status_code=404
            )
        
        # Delete the document
        success = await service.delete_document_for_user(document_id, current_user["id"])
        if not success:
            return ErrorResponse(
                error="DELETE_FAILED",
                message="Failed to delete document",
                status_code=500
            )
        
        return APIResponse(
            success=True,
            data={"message": "Document deleted successfully"},
            message="Document deleted successfully"
        )
    except Exception as e:
        return ErrorResponse(
            error="DELETE_FAILED",
            message=f"Failed to delete document: {str(e)}",
            status_code=500
        )


@router.delete("/documents", response_model=APIResponse[dict])
@versioned_response("1.0")
async def delete_all_documents(current_user: dict = Depends(get_current_user)):
    """Delete all documents for the current user."""
    try:
        service = get_document_service()
        
        success = await service.delete_all_documents_for_user(current_user["id"])
        if not success:
            return ErrorResponse(
                error="DELETE_ALL_FAILED",
                message="Failed to delete documents",
                status_code=500
            )
        
        return APIResponse(
            success=True,
            data={"message": "All documents deleted successfully"},
            message="All documents deleted successfully"
        )
    except Exception as e:
        return ErrorResponse(
            error="DELETE_ALL_FAILED",
            message=f"Failed to delete documents: {str(e)}",
            status_code=500
        )


@router.post("/process-document/", response_model=ProcessDocumentResponse)
async def process_document(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """Process and store a document."""
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
