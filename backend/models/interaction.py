"""
Models for user interactions (notes and flags).
"""
from pydantic import BaseModel
from typing import Optional, Dict


class UserInteractionRequest(BaseModel):
    """Request model for saving user interactions."""
    note: Optional[str] = None
    is_flagged: bool = False


class UserInteractionResponse(BaseModel):
    """Response model for user interactions."""
    clause_id: str
    user_id: str
    note: Optional[str] = None
    is_flagged: bool = False
    created_at: str
    updated_at: str


class UserInteractionsResponse(BaseModel):
    """Response model for all user interactions on a document."""
    interactions: Dict[str, UserInteractionResponse] = {}
