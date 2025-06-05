"""
Common models and enums used across the application.
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum
import uuid


class ClauseType(str, Enum):
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
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class Section(BaseModel):
    heading: str
    summary: Optional[str] = None
    text: str


class Clause(BaseModel):
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
