"""
Analysis-related models.
"""
from pydantic import BaseModel
from typing import List, Dict
from .common import Clause


class ClauseAnalysisResponse(BaseModel):
    clauses: List[Clause]
    total_clauses: int
    risk_summary: Dict[str, int]
    document_id: str
