"""
Async job models for long-running document analysis tasks.
"""
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum
from .common import Clause


class JobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class JobType(str, Enum):
    DOCUMENT_ANALYSIS = "document_analysis"
    SAMPLE_ANALYSIS = "sample_analysis"


class AnalysisJobRequest(BaseModel):
    """Request model for starting document analysis job"""
    filename: str
    file_size: int
    job_type: JobType = JobType.DOCUMENT_ANALYSIS


class AnalysisJobResponse(BaseModel):
    """Response model for created analysis job"""
    job_id: str
    status: JobStatus
    job_type: JobType
    created_at: datetime
    estimated_completion_seconds: Optional[int] = None


class JobProgress(BaseModel):
    """Progress information for a running job"""
    stage: str
    percentage: int
    message: str
    timestamp: datetime


class JobStatusResponse(BaseModel):
    """Response model for job status check"""
    job_id: str
    status: JobStatus
    job_type: JobType
    created_at: datetime
    updated_at: datetime
    progress: Optional[JobProgress] = None
    error_message: Optional[str] = None
    estimated_completion_seconds: Optional[int] = None


class AnalysisJobResult(BaseModel):
    """Complete analysis results when job is finished"""
    job_id: str
    document_id: str
    filename: str
    summary: str
    ai_structured_summary: Optional[Dict[str, Any]] = None
    clauses: List[Clause]
    total_clauses: int
    risk_summary: Dict[str, Any]
    full_text: str
    contract_type: str
    completed_at: datetime


class JobResultResponse(BaseModel):
    """Response model for job results"""
    job_id: str
    status: JobStatus
    result: Optional[AnalysisJobResult] = None
    error_message: Optional[str] = None 