"""
Shared type definitions for ClauseIQ.
These models are shared between frontend and backend.
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum
import uuid


class ClauseType(str, Enum):
    """Types of clauses found in legal documents."""
    COMPENSATION = "compensation"
    TERMINATION = "termination"
    NON_COMPETE = "non_compete"
    CONFIDENTIALITY = "confidentiality"
    BENEFITS = "benefits"
    WORKING_CONDITIONS = "working_conditions"
    INTELLECTUAL_PROPERTY = "intellectual_property"
    DISPUTE_RESOLUTION = "dispute_resolution"
    PROBATION = "probation"
    GENERAL = "general"


class RiskLevel(str, Enum):
    """Risk levels for clauses."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class Section(BaseModel):
    """A section of a document."""
    heading: str
    text: str
    summary: Optional[str] = None


class Clause(BaseModel):
    """A clause extracted from a document with analysis."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    heading: str
    text: str
    clause_type: ClauseType
    risk_level: RiskLevel
    summary: Optional[str] = None
    risk_assessment: Optional[str] = None
    recommendations: Optional[List[str]] = None
    key_points: Optional[List[str]] = None
    position_start: Optional[int] = None
    position_end: Optional[int] = None


class RiskSummary(BaseModel):
    """Summary of risk levels in a document."""
    high: int
    medium: int
    low: int


class User(BaseModel):
    """User model."""
    id: str
    email: str
    full_name: str
    created_at: str


class UserPreferences(BaseModel):
    """User preferences."""
    preferred_model: str


class AvailableModel(BaseModel):
    """AI model configuration."""
    id: str
    name: str
    description: str
