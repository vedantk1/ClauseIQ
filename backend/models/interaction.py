"""
Models for user interactions (notes and flags).
"""
from pydantic import BaseModel, Field
from typing import Optional, Dict, List
from datetime import datetime
import uuid


class Note(BaseModel):
    """Individual note model."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class UserInteractionRequest(BaseModel):
    """Request model for saving user interactions."""
    note: Optional[str] = None
    is_flagged: bool = False


class NoteRequest(BaseModel):
    """Request model for adding/updating individual notes."""
    text: str


class UserInteractionResponse(BaseModel):
    """Response model for user interactions."""
    clause_id: str
    user_id: str
    notes: List[Note] = []
    is_flagged: bool = False
    created_at: str
    updated_at: str


class UserInteractionsResponse(BaseModel):
    """Response model for all user interactions on a document."""
    interactions: Dict[str, UserInteractionResponse] = {}
