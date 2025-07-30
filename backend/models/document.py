"""
Document-related models.
"""
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from .common import Clause, RiskSummary


class DocumentListItem(BaseModel):
    id: str
    filename: str
    upload_date: str
    contract_type: Optional[str] = None
    rag_processed: Optional[bool] = None
    pinecone_stored: Optional[bool] = None
    chunk_count: Optional[int] = None
    embedding_model: Optional[str] = None
    last_viewed: Optional[str] = None


class DocumentListResponse(BaseModel):
    documents: List[DocumentListItem]


class DocumentDetailResponse(BaseModel):
    id: str
    filename: str
    upload_date: str
    contract_type: Optional[str] = None
    text: str
    ai_full_summary: Optional[str] = None
    ai_structured_summary: Optional[Dict[str, Any]] = None
    summary: Optional[str] = None
    clauses: Optional[List[Clause]] = None
    risk_summary: Optional[RiskSummary] = None
    user_id: str
    rag_processed: Optional[bool] = None
    pinecone_stored: Optional[bool] = None
    chunk_count: Optional[int] = None
    chunk_ids: Optional[List[str]] = None
    embedding_model: Optional[str] = None
    rag_processed_at: Optional[str] = None
    storage_service: Optional[str] = None
    last_viewed: Optional[str] = None


class AnalyzeDocumentResponse(BaseModel):
    id: str
    filename: str
    full_text: str
    summary: str
    ai_structured_summary: Optional[Dict[str, Any]] = None
    clauses: List[Clause]
    total_clauses: int
    risk_summary: RiskSummary
    contract_type: Optional[str] = None
