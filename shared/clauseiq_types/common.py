"""
Shared type definitions for ClauseIQ.
These models are shared between frontend and backend.
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum
import uuid


class ContractType(str, Enum):
    """Types of legal contracts that can be analyzed."""
    EMPLOYMENT = "employment"
    NDA = "nda"
    SERVICE_AGREEMENT = "service_agreement"
    LEASE = "lease"
    PURCHASE = "purchase"
    PARTNERSHIP = "partnership"
    LICENSE = "license"
    CONSULTING = "consulting"
    CONTRACTOR = "contractor"
    OTHER = "other"


class ClauseType(str, Enum):
    """Types of clauses found in legal documents."""
    # Employment-specific clauses
    COMPENSATION = "compensation"
    TERMINATION = "termination"
    NON_COMPETE = "non_compete"
    BENEFITS = "benefits"
    WORKING_CONDITIONS = "working_conditions"
    PROBATION = "probation"
    
    # Universal clauses (applicable to multiple contract types)
    CONFIDENTIALITY = "confidentiality"
    INTELLECTUAL_PROPERTY = "intellectual_property"
    DISPUTE_RESOLUTION = "dispute_resolution"
    LIABILITY = "liability"
    INDEMNIFICATION = "indemnification"
    FORCE_MAJEURE = "force_majeure"
    GOVERNING_LAW = "governing_law"
    
    # NDA-specific clauses
    DISCLOSURE_OBLIGATIONS = "disclosure_obligations"
    RETURN_OF_INFORMATION = "return_of_information"
    
    # Service Agreement clauses
    SCOPE_OF_WORK = "scope_of_work"
    DELIVERABLES = "deliverables"
    PAYMENT_TERMS = "payment_terms"
    SERVICE_LEVEL = "service_level"
    
    # Lease-specific clauses
    RENT = "rent"
    SECURITY_DEPOSIT = "security_deposit"
    MAINTENANCE = "maintenance"
    USE_RESTRICTIONS = "use_restrictions"
    
    # Generic/fallback
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


class Document(BaseModel):
    """Document model."""
    id: str
    filename: str
    upload_date: str
    contract_type: Optional[ContractType] = None
    text: Optional[str] = None
    ai_full_summary: Optional[str] = None
    sections: Optional[List[Section]] = None
    clauses: Optional[List[Clause]] = None
    risk_summary: Optional[RiskSummary] = None
    user_id: str


class AvailableModel(BaseModel):
    """AI model configuration."""
    id: str
    name: str
    description: str
