"""
Highlight-related type definitions for ClauseIQ.
These models are shared between frontend and backend for PDF highlighting functionality.
"""
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import uuid


class HighlightArea(BaseModel):
    """Coordinate area for a highlight in the PDF."""
    height: float = Field(..., description="Height of the highlight area")
    left: float = Field(..., description="Left position of the highlight area")
    page_index: int = Field(..., description="Page index where the highlight is located")
    top: float = Field(..., description="Top position of the highlight area")
    width: float = Field(..., description="Width of the highlight area")


class Highlight(BaseModel):
    """A user highlight in a PDF document."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique identifier for the highlight")
    document_id: str = Field(..., description="ID of the document this highlight belongs to")
    user_id: str = Field(..., description="ID of the user who created this highlight")
    content: str = Field(..., description="The selected text content")
    comment: str = Field(..., description="User's annotation/comment on the highlighted text")
    areas: List[HighlightArea] = Field(..., description="Coordinate areas defining the highlight position")
    ai_rewrite: Optional[str] = Field(None, description="AI-generated rewrite of the content")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="When the highlight was created")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="When the highlight was last updated")

    class Config:
        # Allow serialization of datetime objects
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class CreateHighlightRequest(BaseModel):
    """Request model for creating a new highlight."""
    content: str = Field(..., description="The selected text content")
    comment: str = Field(..., description="User's annotation/comment")
    areas: List[HighlightArea] = Field(..., description="Coordinate areas for the highlight")


class UpdateHighlightRequest(BaseModel):
    """Request model for updating an existing highlight."""
    comment: Optional[str] = Field(None, description="Updated comment")
    ai_rewrite: Optional[str] = Field(None, description="AI-generated rewrite")


class HighlightResponse(BaseModel):
    """Response model for highlight operations."""
    highlight: Highlight = Field(..., description="The highlight data")
    message: str = Field(..., description="Success message")


class HighlightListResponse(BaseModel):
    """Response model for listing highlights."""
    highlights: List[Highlight] = Field(..., description="List of highlights")
    total: int = Field(..., description="Total number of highlights")
    document_id: str = Field(..., description="Document ID these highlights belong to")
