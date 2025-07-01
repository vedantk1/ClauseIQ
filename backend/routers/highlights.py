"""
Document highlights routes.
"""
import logging
from typing import List
from fastapi import APIRouter, HTTPException, Depends, Request
from auth import get_current_user
from middleware.api_standardization import APIResponse, create_success_response, create_error_response
from middleware.versioning import versioned_response
from services.highlight_service import get_highlight_service
from services.ai_highlight_service import AIHighlightService, analyze_highlight_quick, rewrite_highlight_quick
from clauseiq_types.highlights import (
    Highlight,
    CreateHighlightRequest,
    UpdateHighlightRequest,
    HighlightResponse,
    HighlightListResponse
)


logger = logging.getLogger(__name__)
router = APIRouter(tags=["highlights"])


@router.get("/documents/{document_id}/highlights", response_model=APIResponse[HighlightListResponse])
@versioned_response
async def get_document_highlights(
    request: Request,
    document_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all highlights for a specific document."""
    try:
        highlight_service = get_highlight_service()
        highlights = await highlight_service.get_highlights(document_id, current_user["id"])
        
        response_data = HighlightListResponse(
            highlights=highlights,
            total=len(highlights),
            document_id=document_id
        )
        
        return create_success_response(
            data=response_data
        )
        
    except Exception as e:
        logger.error(f"Failed to get highlights for document {document_id}: {e}")
        return create_error_response(
            code="HIGHLIGHTS_FETCH_ERROR",
            message="Failed to retrieve highlights"
        )


@router.post("/documents/{document_id}/highlights", response_model=APIResponse[HighlightResponse])
@versioned_response
async def create_document_highlight(
    request: Request,
    document_id: str,
    highlight_request: CreateHighlightRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new highlight for a document."""
    try:
        highlight_service = get_highlight_service()
        highlight = await highlight_service.create_highlight(
            document_id=document_id,
            user_id=current_user["id"],
            request=highlight_request
        )
        
        response_data = HighlightResponse(
            highlight=highlight,
            message="Highlight created successfully"
        )
        
        return create_success_response(data=response_data)
        
    except ValueError as e:
        logger.warning(f"Invalid request for creating highlight: {e}")
        return create_error_response(
            code="INVALID_REQUEST",
            message="Invalid request",
            details={"error": str(e)}
        )
    except Exception as e:
        logger.error(f"Failed to create highlight for document {document_id}: {e}")
        return create_error_response(
            code="HIGHLIGHT_CREATE_ERROR",
            message="Failed to create highlight",
            details={"error": str(e)}
        )


@router.put("/documents/{document_id}/highlights/{highlight_id}", response_model=APIResponse[HighlightResponse])
@versioned_response
async def update_document_highlight(
    request: Request,
    document_id: str,
    highlight_id: str,
    highlight_request: UpdateHighlightRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update an existing highlight."""
    try:
        highlight_service = get_highlight_service()
        highlight = await highlight_service.update_highlight(
            document_id=document_id,
            user_id=current_user["id"],
            highlight_id=highlight_id,
            request=highlight_request
        )
        
        if not highlight:
            return create_error_response(
                code="HIGHLIGHT_NOT_FOUND",
                message="Highlight not found",
                details={"highlight_id": highlight_id, "document_id": document_id}
            )
        
        response_data = HighlightResponse(
            highlight=highlight,
            message="Highlight updated successfully"
        )
        
        return create_success_response(data=response_data)
        
    except Exception as e:
        logger.error(f"Failed to update highlight {highlight_id}: {e}")
        return create_error_response(
            code="HIGHLIGHT_UPDATE_ERROR",
            message="Failed to update highlight",
            details={"error": str(e)}
        )


@router.delete("/documents/{document_id}/highlights/{highlight_id}", response_model=APIResponse[dict])
@versioned_response
async def delete_document_highlight(
    request: Request,
    document_id: str,
    highlight_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a highlight."""
    try:
        highlight_service = get_highlight_service()
        success = await highlight_service.delete_highlight(
            document_id=document_id,
            user_id=current_user["id"],
            highlight_id=highlight_id
        )
        
        if not success:
            return create_error_response(
                code="HIGHLIGHT_NOT_FOUND",
                message="Highlight not found",
                details={"highlight_id": highlight_id, "document_id": document_id}
            )
        
        return create_success_response(
            data={"deleted": True, "highlight_id": highlight_id}
        )
        
    except Exception as e:
        logger.error(f"Failed to delete highlight {highlight_id}: {e}")
        return create_error_response(
            code="HIGHLIGHT_DELETE_ERROR",
            message="Failed to delete highlight",
            details={"error": str(e)}
        )


# 🤖 AI-POWERED HIGHLIGHT ANALYSIS ENDPOINTS

@router.post("/documents/{document_id}/highlights/{highlight_id}/analyze")
@versioned_response
async def analyze_highlight_with_ai(
    request: Request,
    document_id: str,
    highlight_id: str,
    model: str = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Analyze a highlight using AI to provide insights, risk assessment, and recommendations.
    
    🤖 **AI Integration Phase 3**
    - Provides intelligent analysis of highlighted text
    - Assesses legal significance and risks
    - Offers actionable recommendations
    """
    try:
        logger.info(f"🤖 AI analysis requested for highlight {highlight_id}")
        
        # Get the highlight
        highlight_service = get_highlight_service()
        highlight = await highlight_service.get_highlight_by_id(
            user_id=current_user["id"],
            document_id=document_id,
            highlight_id=highlight_id
        )
        
        if not highlight:
            return create_error_response(
                code="HIGHLIGHT_NOT_FOUND",
                message="Highlight not found",
                details={"highlight_id": highlight_id, "document_id": document_id}
            )
        
        # Perform AI analysis
        ai_service = AIHighlightService(model)
        analysis = await ai_service.analyze_highlight(
            highlight_content=highlight.content,
            highlight_comment=highlight.comment,
            contract_type="general"  # Could be enhanced to detect contract type
        )
        
        logger.info(f"✅ AI analysis completed: {analysis.risk_level} risk level")
        
        return create_success_response(
            data={
                "highlight_id": highlight_id,
                "analysis": {
                    "summary": analysis.summary,
                    "key_insights": analysis.key_insights,
                    "risk_level": analysis.risk_level,
                    "legal_significance": analysis.legal_significance,
                    "recommended_action": analysis.recommended_action
                },
                "model_used": model or "default"
            }
        )
        
    except Exception as e:
        logger.error(f"❌ Failed to analyze highlight {highlight_id}: {e}")
        return create_error_response(
            code="AI_ANALYSIS_ERROR",
            message="Failed to analyze highlight with AI",
            details={"error": str(e)}
        )


@router.post("/documents/{document_id}/highlights/{highlight_id}/rewrite")
@versioned_response
async def generate_ai_rewrite(
    request: Request,
    document_id: str,
    highlight_id: str,
    rewrite_goal: str = "clarity",
    model: str = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate an AI-powered rewrite of highlighted text.
    
    🤖 **AI Integration Phase 3**
    - Improves clarity and readability
    - Preserves legal meaning
    - Provides improvement explanations
    
    Args:
        rewrite_goal: "clarity", "simplicity", "legal_precision", "plain_english"
    """
    try:
        logger.info(f"🤖 AI rewrite requested for highlight {highlight_id} with goal: {rewrite_goal}")
        
        # Get the highlight
        highlight_service = get_highlight_service()
        highlight = await highlight_service.get_highlight_by_id(
            user_id=current_user["id"],
            document_id=document_id,
            highlight_id=highlight_id
        )
        
        if not highlight:
            return create_error_response(
                code="HIGHLIGHT_NOT_FOUND",
                message="Highlight not found",
                details={"highlight_id": highlight_id, "document_id": document_id}
            )
        
        # Generate AI rewrite
        ai_service = AIHighlightService(model)
        rewrite = await ai_service.generate_ai_rewrite(
            highlight_content=highlight.content,
            rewrite_goal=rewrite_goal,
            target_audience="legal professionals"
        )
        
        # Update highlight with AI rewrite
        await highlight_service.update_highlight(
            user_id=current_user["id"],
            document_id=document_id,
            highlight_id=highlight_id,
            data={"ai_rewrite": rewrite.rewritten_text}
        )
        
        logger.info(f"✅ AI rewrite completed with clarity score: {rewrite.clarity_score}")
        
        return create_success_response(
            data={
                "highlight_id": highlight_id,
                "rewrite": {
                    "original_text": rewrite.original_text,
                    "rewritten_text": rewrite.rewritten_text,
                    "improvement_summary": rewrite.improvement_summary,
                    "clarity_score": rewrite.clarity_score
                },
                "model_used": model or "default",
                "rewrite_goal": rewrite_goal
            }
        )
        
    except Exception as e:
        logger.error(f"❌ Failed to generate rewrite for highlight {highlight_id}: {e}")
        return create_error_response(
            code="AI_REWRITE_ERROR", 
            message="Failed to generate AI rewrite",
            details={"error": str(e)}
        )


@router.get("/documents/{document_id}/highlights/ai-insights")
@versioned_response
async def get_document_ai_insights(
    request: Request,
    document_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get AI-powered insights for all highlights in a document.
    
    🤖 **AI Integration Phase 3**
    - Aggregates insights across all highlights
    - Provides document-level risk assessment
    - Suggests areas needing attention
    """
    try:
        logger.info(f"🤖 AI insights requested for document {document_id}")
        
        # Get all highlights for the document
        highlight_service = get_highlight_service()
        highlights = await highlight_service.get_highlights(
            document_id=document_id,
            user_id=current_user["id"]
        )
        
        if not highlights:
            return create_success_response(
                data={
                    "document_id": document_id,
                    "total_highlights": 0,
                    "insights": {
                        "summary": "No highlights found for analysis",
                        "risk_distribution": {"low": 0, "medium": 0, "high": 0},
                        "recommendations": []
                    }
                }
            )
        
        # Analyze key highlights with AI
        ai_service = AIHighlightService()
        risk_counts = {"low": 0, "medium": 0, "high": 0}
        all_recommendations = []
        
        # Analyze up to 5 most significant highlights to avoid token limits
        for highlight in highlights[:5]:
            try:
                analysis = await ai_service.analyze_highlight(
                    highlight_content=highlight.content,
                    highlight_comment=highlight.comment
                )
                risk_counts[analysis.risk_level] += 1
                if analysis.recommended_action not in all_recommendations:
                    all_recommendations.append(analysis.recommended_action)
            except Exception as e:
                logger.warning(f"Failed to analyze highlight {highlight.id}: {e}")
                risk_counts["medium"] += 1
        
        # Generate document-level insights
        total_analyzed = sum(risk_counts.values())
        high_risk_percentage = (risk_counts["high"] / total_analyzed * 100) if total_analyzed > 0 else 0
        
        document_summary = (
            f"Analyzed {total_analyzed} of {len(highlights)} highlights. "
            f"{high_risk_percentage:.1f}% identified as high-risk areas requiring attention."
        )
        
        logger.info(f"✅ Document AI insights completed: {total_analyzed} highlights analyzed")
        
        return create_success_response(
            data={
                "document_id": document_id,
                "total_highlights": len(highlights),
                "analyzed_highlights": total_analyzed,
                "insights": {
                    "summary": document_summary,
                    "risk_distribution": risk_counts,
                    "recommendations": all_recommendations[:3],  # Top 3 recommendations
                    "high_risk_percentage": high_risk_percentage
                }
            }
        )
        
    except Exception as e:
        logger.error(f"❌ Failed to generate document AI insights: {e}")
        return create_error_response(
            code="AI_INSIGHTS_ERROR",
            message="Failed to generate AI insights for document",
            details={"error": str(e)}
        )
