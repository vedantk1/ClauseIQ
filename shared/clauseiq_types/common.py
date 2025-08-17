"""
Shared type definitions for ClauseIQ.
These models are shared between frontend and backend.
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum
import uuid
from datetime import datetime
from datetime import datetime


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
    SEVERANCE = "severance"
    OVERTIME_PAY = "overtime_pay"
    VACATION_POLICY = "vacation_policy"
    STOCK_OPTIONS = "stock_options"
    BACKGROUND_CHECK = "background_check"
    
    # Universal clauses (applicable to multiple contract types)
    CONFIDENTIALITY = "confidentiality"
    INTELLECTUAL_PROPERTY = "intellectual_property"
    DISPUTE_RESOLUTION = "dispute_resolution"
    LIABILITY = "liability"
    INDEMNIFICATION = "indemnification"
    FORCE_MAJEURE = "force_majeure"
    GOVERNING_LAW = "governing_law"
    ASSIGNMENT_RIGHTS = "assignment_rights"
    AMENDMENT_PROCEDURES = "amendment_procedures"
    NOTICES = "notices"
    ENTIRE_AGREEMENT = "entire_agreement"
    SEVERABILITY = "severability"
    
    # NDA-specific clauses
    DISCLOSURE_OBLIGATIONS = "disclosure_obligations"
    RETURN_OF_INFORMATION = "return_of_information"
    DEFINITION_OF_CONFIDENTIAL = "definition_of_confidential"
    EXCEPTIONS_TO_CONFIDENTIALITY = "exceptions_to_confidentiality"
    DURATION_OF_OBLIGATIONS = "duration_of_obligations"
    
    # Service Agreement clauses
    SCOPE_OF_WORK = "scope_of_work"
    DELIVERABLES = "deliverables"
    PAYMENT_TERMS = "payment_terms"
    SERVICE_LEVEL = "service_level"
    WARRANTIES = "warranties"
    SERVICE_CREDITS = "service_credits"
    DATA_PROTECTION = "data_protection"
    THIRD_PARTY_SERVICES = "third_party_services"
    CHANGE_MANAGEMENT = "change_management"
    
    # Lease-specific clauses
    RENT = "rent"
    SECURITY_DEPOSIT = "security_deposit"
    MAINTENANCE = "maintenance"
    USE_RESTRICTIONS = "use_restrictions"
    UTILITIES = "utilities"
    PARKING = "parking"
    PET_POLICY = "pet_policy"
    SUBLETTING = "subletting"
    EARLY_TERMINATION = "early_termination"
    RENEWAL_OPTIONS = "renewal_options"
    PROPERTY_INSPECTION = "property_inspection"
    
    # Purchase/Sales Agreement clauses
    DELIVERY_TERMS = "delivery_terms"
    INSPECTION_RIGHTS = "inspection_rights"
    TITLE_TRANSFER = "title_transfer"
    RISK_OF_LOSS = "risk_of_loss"
    RETURNS_REFUNDS = "returns_refunds"
    
    # Generic/fallback
    GENERAL = "general"


class RiskLevel(str, Enum):
    """Risk levels for clauses."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class Clause(BaseModel):
    """A clause extracted from a document with analysis."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    heading: str
    text: str
    clause_type: ClauseType
    risk_level: RiskLevel
    risk_assessment: Optional[str] = None
    recommendations: Optional[List[str]] = None
    key_points: Optional[List[str]] = None
    position_start: Optional[int] = None
    position_end: Optional[int] = None
    # First-class LLM analysis fields (required for every new clause)
    risk_reasoning: str
    key_terms: List[str]
    relationships: List[str]


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


class Note(BaseModel):
    """Individual note model."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class UserInteraction(BaseModel):
    """User interaction with a clause (notes, flags, etc.)."""
    clause_id: str
    user_id: str
    notes: List[Note] = []
    is_flagged: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class Document(BaseModel):
    """Document model."""
    id: str
    filename: str
    upload_date: str
    contract_type: Optional[ContractType] = None
    text: Optional[str] = None
    ai_full_summary: Optional[str] = None
    ai_structured_summary: Optional[Dict[str, Any]] = None
    clauses: Optional[List[Clause]] = None
    risk_summary: Optional[RiskSummary] = None
    user_id: str
    user_interactions: Optional[Dict[str, UserInteraction]] = None  # clause_id -> UserInteraction
    last_viewed: Optional[str] = None  # ISO timestamp of when document was last viewed


class AvailableModel(BaseModel):
    """AI model configuration."""
    id: str
    name: str
    description: str


class UserInteractions(BaseModel):
    """Collection of user interactions for a document."""
    document_id: str
    user_id: str
    interactions: Dict[str, UserInteraction] = {}  # clause_id -> UserInteraction
