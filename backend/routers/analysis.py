"""
Document analysis routes.
"""
import uuid
import logging
from datetime import datetime
from fastapi import APIRouter, File, UploadFile, HTTPException, Depends, Request
from pydantic import BaseModel
from auth import get_current_user
from database.service import get_document_service
from middleware.api_standardization import APIResponse, create_success_response, create_error_response
from middleware.versioning import versioned_response
from services.document_service import validate_file, process_document_with_llm, is_llm_processing_available
from services.ai.text_extractor import get_text_extractor
# PHASE 3 MIGRATION: Main AI functions still from ai_service for stability
from services.ai_service import generate_structured_document_summary, generate_clause_rewrite
# RAG integration for chat functionality
from services.rag_service import get_rag_service
from models.document import AnalyzeDocumentResponse
from models.interaction import UserInteractionRequest, NoteRequest
from clauseiq_types.common import RiskLevel, Clause, RiskSummary, ContractType


logger = logging.getLogger(__name__)
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
        
        # Read file content
        content = await file.read()
        
        # Use TextExtractor service for extraction
        text_extractor = get_text_extractor()
        try:
            extracted_text = await text_extractor.extract_text(content, file.filename)
        except ValueError as e:
            return create_error_response(
                code="PDF_EXTRACTION_FAILED",
                message=str(e),
                correlation_id=correlation_id
            )
        except Exception as e:
            return create_error_response(
                code="PDF_EXTRACTION_FAILED",
                message=f"Failed to extract text: {str(e)}",
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
        
        # Generate contract-type-specific structured summary for improved UI display
        ai_structured_summary = await generate_structured_document_summary(
            extracted_text, file.filename, user_model, contract_type
        )
        
        # Calculate risk summary from clauses
        risk_summary = {
            "high": sum(1 for clause in clauses if clause.risk_level == RiskLevel.HIGH),
            "medium": sum(1 for clause in clauses if clause.risk_level == RiskLevel.MEDIUM),
            "low": sum(1 for clause in clauses if clause.risk_level == RiskLevel.LOW)
        }
        
        # Create document entry with clauses and contract type
        doc_id = str(uuid.uuid4())
        document_data = {
            "id": doc_id,
            "filename": file.filename,
            "upload_date": datetime.now().isoformat(),
            "text": extracted_text,
            "ai_structured_summary": ai_structured_summary,
            "clauses": [clause.dict() for clause in clauses],
            "risk_summary": risk_summary,
            "contract_type": contract_type.value if contract_type else None,
            "user_id": current_user["id"]
        }
        
        # Process RAG before saving document to ensure it happens before PDF cleanup
        try:
            rag_service = get_rag_service()
            logger.info(f"Starting RAG processing for document {doc_id}")
            
            rag_data = await rag_service.process_document_for_rag(
                document_id=doc_id,
                text=extracted_text,
                filename=file.filename,
                user_id=current_user["id"]
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
                logger.info(f"Document {doc_id} processed for RAG successfully with {rag_data.get('chunk_count', 0)} chunks")
            else:
                logger.warning(f"RAG processing returned no data for document {doc_id}")
                
        except Exception as rag_error:
            # RAG processing failure should not break document analysis
            logger.warning(f"RAG processing failed for document {doc_id}: {rag_error}")
            document_data["rag_processed"] = False
            # Continue without RAG for now
        
        # Save to storage with RAG metadata included
        logger.info(f"Saving document {doc_id} to database...")
        try:
            # First save document metadata
            await service.save_document_for_user(document_data, current_user["id"])
            logger.info(f"Document {doc_id} saved successfully to database")
            
            # Then store the PDF file (atomic operation)
            try:
                logger.info(f"Storing PDF file for document {doc_id}")
                pdf_stored = await service.store_pdf_file(
                    document_id=doc_id,
                    user_id=current_user["id"],
                    file_data=content,  # Use the content we read earlier
                    filename=file.filename,
                    content_type=file.content_type or "application/pdf"
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
            
        except Exception as save_error:
            logger.error(f"Failed to save document {doc_id}: {save_error}")
            raise save_error
        
        # Return response with ALL required fields for frontend
        response_data = {
            "id": doc_id,
            "filename": file.filename,
            "summary": ai_structured_summary.get("overview", "Document processed successfully") if ai_structured_summary else "Document processed successfully",
            "ai_structured_summary": ai_structured_summary,
            "clauses": clauses,
            "total_clauses": len(clauses),
            "risk_summary": risk_summary,
            "full_text": extracted_text,
            "contract_type": contract_type.value if contract_type else None,
            "message": "Document analyzed successfully"
        }
        
        return create_success_response(
            data=response_data,
            correlation_id=correlation_id
        )
        
    except Exception as e:
        print(f"Error analyzing document: {str(e)}")
        return create_error_response(
            code="DOCUMENT_ANALYSIS_FAILED",
            message=f"An error occurred while analyzing the document: {str(e)}",
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
        # MIGRATED: Keep main functions from ai_service for API stability
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


# User Interaction Endpoints for Notes and Flags
@router.get("/documents/{document_id}/interactions", response_model=APIResponse[dict])
@versioned_response
async def get_document_interactions(
    document_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Get all user interactions (notes and flags) for a document."""
    correlation_id = getattr(request.state, 'correlation_id', None)
    
    try:
        service = get_document_service()
        interactions = await service.get_user_interactions(document_id, current_user["id"])
        
        return create_success_response(
            data={"interactions": interactions or {}},
            correlation_id=correlation_id
        )
        
    except Exception as e:
        print(f"Error getting user interactions: {str(e)}")
        return create_error_response(
            code="INTERACTION_RETRIEVAL_FAILED",
            message=f"Failed to retrieve user interactions: {str(e)}",
            correlation_id=correlation_id
        )


@router.put("/documents/{document_id}/interactions/{clause_id}", response_model=APIResponse[dict])
@versioned_response
async def save_clause_interaction(
    document_id: str,
    clause_id: str,
    request: Request,
    interaction_data: UserInteractionRequest,
    current_user: dict = Depends(get_current_user)
):
    """Save or update user interaction (note and/or flag) for a specific clause."""
    correlation_id = getattr(request.state, 'correlation_id', None)
    
    try:
        service = get_document_service()
        
        # Validate interaction data
        note = interaction_data.note
        is_flagged = interaction_data.is_flagged
        
        # Save the interaction
        saved_interaction = await service.save_user_interaction(
            document_id=document_id,
            clause_id=clause_id,
            user_id=current_user["id"],
            note=note,
            is_flagged=is_flagged
        )
        
        return create_success_response(
            data={"interaction": saved_interaction},
            message="Interaction saved successfully",
            correlation_id=correlation_id
        )
        
    except Exception as e:
        print(f"Error saving user interaction: {str(e)}")
        return create_error_response(
            code="INTERACTION_SAVE_FAILED",
            message=f"Failed to save user interaction: {str(e)}",
            correlation_id=correlation_id
        )


@router.delete("/documents/{document_id}/interactions/{clause_id}", response_model=APIResponse[dict])
@versioned_response
async def delete_clause_interaction(
    document_id: str,
    clause_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Delete user interaction for a specific clause."""
    correlation_id = getattr(request.state, 'correlation_id', None)
    
    try:
        service = get_document_service()
        
        await service.delete_user_interaction(
            document_id=document_id,
            clause_id=clause_id,
            user_id=current_user["id"]
        )
        
        return create_success_response(
            data={"deleted": True},
            message="Interaction deleted successfully",
            correlation_id=correlation_id
        )
        
    except Exception as e:
        print(f"Error deleting user interaction: {str(e)}")
        return create_error_response(
            code="INTERACTION_DELETE_FAILED",
            message=f"Failed to delete user interaction: {str(e)}",
            correlation_id=correlation_id
        )


# Individual Note Management Endpoints

@router.post("/documents/{document_id}/interactions/{clause_id}/notes", response_model=APIResponse[dict])
@versioned_response
async def add_clause_note(
    document_id: str,
    clause_id: str,
    request: Request,
    note_data: NoteRequest,
    current_user: dict = Depends(get_current_user)
):
    """Add a new note to a specific clause."""
    correlation_id = getattr(request.state, 'correlation_id', None)
    
    try:
        service = get_document_service()
        
        # Add the note
        new_note = await service.add_note(
            document_id=document_id,
            clause_id=clause_id,
            user_id=current_user["id"],
            text=note_data.text
        )
        
        return create_success_response(
            data={"note": new_note},
            correlation_id=correlation_id
        )
        
    except Exception as e:
        print(f"Error adding note: {str(e)}")
        return create_error_response(
            code="NOTE_ADD_FAILED",
            message=f"Failed to add note: {str(e)}",
            correlation_id=correlation_id
        )


@router.put("/documents/{document_id}/interactions/{clause_id}/notes/{note_id}", response_model=APIResponse[dict])
@versioned_response
async def update_clause_note(
    document_id: str,
    clause_id: str,
    note_id: str,
    request: Request,
    note_data: NoteRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update an existing note."""
    correlation_id = getattr(request.state, 'correlation_id', None)
    
    try:
        service = get_document_service()
        
        # Update the note
        updated_note = await service.update_note(
            document_id=document_id,
            clause_id=clause_id,
            user_id=current_user["id"],
            note_id=note_id,
            text=note_data.text
        )
        
        return create_success_response(
            data={"note": updated_note},
            correlation_id=correlation_id
        )
        
    except ValueError as e:
        return create_error_response(
            code="NOTE_NOT_FOUND",
            message=str(e),
            correlation_id=correlation_id
        )
    except Exception as e:
        print(f"Error updating note: {str(e)}")
        return create_error_response(
            code="NOTE_UPDATE_FAILED",
            message=f"Failed to update note: {str(e)}",
            correlation_id=correlation_id
        )


@router.delete("/documents/{document_id}/interactions/{clause_id}/notes/{note_id}", response_model=APIResponse[dict])
@versioned_response
async def delete_clause_note(
    document_id: str,
    clause_id: str,
    note_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Delete a specific note."""
    correlation_id = getattr(request.state, 'correlation_id', None)
    
    try:
        service = get_document_service()
        
        success = await service.delete_note(
            document_id=document_id,
            clause_id=clause_id,
            user_id=current_user["id"],
            note_id=note_id
        )
        
        if not success:
            return create_error_response(
                code="NOTE_NOT_FOUND",
                message="Note not found",
                correlation_id=correlation_id
            )
        
        return create_success_response(
            data={"deleted": True},
            correlation_id=correlation_id
        )
        
    except Exception as e:
        print(f"Error deleting note: {str(e)}")
        return create_error_response(
            code="NOTE_DELETE_FAILED",
            message=f"Failed to delete note: {str(e)}",
            correlation_id=correlation_id
        )


class ClauseRewriteRequest(BaseModel):
    document_id: str


@router.post("/clauses/{clause_id}/rewrite", response_model=APIResponse[dict])
@versioned_response
async def generate_clause_rewrite_endpoint(
    clause_id: str,
    request: Request,
    rewrite_request: ClauseRewriteRequest,
    current_user: dict = Depends(get_current_user)
):
    """Generate a rewrite suggestion for a specific clause."""
    correlation_id = getattr(request.state, 'correlation_id', None)
    
    try:
        service = get_document_service()
        
        # Get user's preferred model
        user_model = await service.get_user_preferred_model(current_user["id"])
        
        # Fetch the document to get full text and contract type
        document = await service.get_document_for_user(rewrite_request.document_id, current_user["id"])
        if not document:
            return create_error_response(
                code="DOCUMENT_NOT_FOUND",
                message="Document not found",
                correlation_id=correlation_id
            )
        
        # Find the specific clause
        clause = None
        if document.get("clauses"):
            for c in document["clauses"]:
                if c.get("id") == clause_id:
                    clause = c
                    break
        
        if not clause:
            return create_error_response(
                code="CLAUSE_NOT_FOUND",
                message="Clause not found in document",
                correlation_id=correlation_id
            )
        
        # Check if rewrite already exists
        if clause.get("rewrite_suggestion"):
            return create_success_response(
                data={
                    "rewrite_suggestion": clause["rewrite_suggestion"],
                    "rewrite_generated_at": clause["rewrite_generated_at"],
                    "cached": True
                },
                correlation_id=correlation_id
            )
        
        # Generate rewrite using AI
        from clauseiq_types.common import Clause, ContractType
        
        # Convert dict to Clause object
        clause_obj = Clause(**clause)
        contract_type = ContractType(document.get("contract_type", "OTHER"))
        
        rewrite_suggestion = await generate_clause_rewrite(
            clause=clause_obj,
            document_text=document["text"],
            contract_type=contract_type,
            model=user_model
        )
        
        # Save rewrite to database
        updated_clause = await service.update_clause_rewrite(
            document_id=rewrite_request.document_id,
            clause_id=clause_id,
            user_id=current_user["id"],
            rewrite_suggestion=rewrite_suggestion
        )
        
        return create_success_response(
            data={
                "rewrite_suggestion": rewrite_suggestion,
                "rewrite_generated_at": updated_clause["rewrite_generated_at"],
                "cached": False
            },
            correlation_id=correlation_id
        )
        
    except Exception as e:
        print(f"Error generating clause rewrite: {str(e)}")
        return create_error_response(
            code="REWRITE_GENERATION_FAILED",
            message=f"Failed to generate clause rewrite: {str(e)}",
            correlation_id=correlation_id
        )
