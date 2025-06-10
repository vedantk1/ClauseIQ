"""
Document-related models.
"""
from pydantic import BaseModel
from typing import List, Optional, Dict
from .common import Section, Clause


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
    sections: List[Section]


class DocumentListResponse(BaseModel):
    documents: List[DocumentListItem]


class DocumentDetailResponse(BaseModel):
    id: str
    filename: str
    upload_date: str
    text: str
    ai_full_summary: Optional[str] = None
    summary: Optional[str] = None
    sections: List[Section]
    user_id: str


class AnalyzeDocumentResponse(BaseModel):
    id: str
    filename: str
    full_text: str
    summary: str
    clauses: List[Clause]
    total_clauses: int
    risk_summary: Dict[str, int]
