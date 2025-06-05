"""
Authentication and user-related models.
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class UserPreferencesRequest(BaseModel):
    preferred_model: str = Field(..., description="User's preferred AI model")


class UserPreferencesResponse(BaseModel):
    preferred_model: str
    available_models: List[str]


class AvailableModelsResponse(BaseModel):
    models: List[Dict[str, str]]
    default_model: str
