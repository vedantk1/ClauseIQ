"""
Document-related models.
"""
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from .common import Clause, RiskSummary


class ProcessDocumentResponse(BaseModel):
    id: str
    filename: str
    full_text: str
    summary: str


class DocumentListItem(BaseModel):
    id: str
    filename: str
    upload_date: str
    contract_type: Optional[str] = None


class DocumentListResponse(BaseModel):
    documents: List[DocumentListItem]


class DocumentDetailResponse(BaseModel):
    id: str
    filename: str
    upload_date: str
    text: str
    ai_full_summary: Optional[str] = None
    ai_structured_summary: Optional[Dict[str, Any]] = None
    summary: Optional[str] = None
    clauses: Optional[List[Clause]] = None
    risk_summary: Optional[RiskSummary] = None
    user_id: str


class AnalyzeDocumentResponse(BaseModel):
    id: str
    filename: str
    full_text: str
    summary: str
    ai_structured_summary: Optional[Dict[str, Any]] = None
    clauses: List[Clause]
    total_clauses: int
    risk_summary: RiskSummary
