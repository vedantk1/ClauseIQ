"""
Report generation routes.
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import Response
from auth import get_current_user
from database.service import get_document_service
from middleware.api_standardization import create_error_response
from middleware.versioning import versioned_response
from services.pdf_service import generate_pdf_report, create_simple_pdf_report

router = APIRouter(prefix="/reports", tags=["reports"])

@router.get("/documents/{document_id}/pdf")
@versioned_response
async def generate_document_pdf_report(
    document_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Generate a PDF report for a specific document."""
    correlation_id = getattr(request.state, 'correlation_id', None)
    
    try:
        service = get_document_service()
        
        # Get the document for the current user
        document = await service.get_document_for_user(document_id, current_user["id"])
        
        if not document:
            raise HTTPException(
                status_code=404, 
                detail="Document not found or you don't have permission to access it"
            )
        
        # Generate PDF report
        try:
            pdf_content = await generate_pdf_report(document)
        except Exception as e:
            print(f"Error generating full PDF report: {str(e)}")
            # Fallback to simple PDF if full generation fails
            filename = document.get('filename', 'Document')
            summary = document.get('ai_full_summary', '') or document.get('summary', '')
            pdf_content = create_simple_pdf_report(filename, summary)
        
        # Return PDF as response
        filename = document.get('filename', 'document').replace('.pdf', '') + '_analysis_report.pdf'
        
        return Response(
            content=pdf_content,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Type": "application/pdf"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating PDF report: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate PDF report: {str(e)}"
        )
