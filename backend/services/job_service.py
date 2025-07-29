"""
Async job service for managing long-running document analysis tasks.
"""
import asyncio
import uuid
import tempfile
import os
from datetime import datetime, timedelta
from typing import Dict, Optional, Any
import pdfplumber
from fastapi import UploadFile

from database.service import get_document_service
from services.document_service import process_document_with_llm, is_llm_processing_available
from services.ai_service import generate_structured_document_summary
from models.jobs import (
    JobStatus, JobType, AnalysisJobResponse, JobStatusResponse, 
    AnalysisJobResult, JobProgress, JobResultResponse
)


class JobService:
    """Service for managing async analysis jobs"""
    
    def __init__(self):
        self._jobs: Dict[str, Dict[str, Any]] = {}
        self._background_tasks: Dict[str, asyncio.Task] = {}
    
    async def start_analysis_job(
        self, 
        file: UploadFile, 
        user_id: Optional[str] = None,
        job_type: JobType = JobType.DOCUMENT_ANALYSIS
    ) -> AnalysisJobResponse:
        """Start a new document analysis job"""
        job_id = str(uuid.uuid4())
        created_at = datetime.utcnow()
        
        # Store job metadata
        job_data = {
            "job_id": job_id,
            "status": JobStatus.PENDING,
            "job_type": job_type,
            "user_id": user_id,
            "filename": file.filename,
            "file_size": file.size,
            "created_at": created_at,
            "updated_at": created_at,
            "progress": None,
            "error_message": None,
            "result": None
        }
        
        self._jobs[job_id] = job_data
        
        # Start background processing
        task = asyncio.create_task(self._process_analysis_job(job_id, file, user_id))
        self._background_tasks[job_id] = task
        
        # Estimate completion time (60-120 seconds based on file size)
        estimated_seconds = min(120, max(60, file.size // 50000))
        
        return AnalysisJobResponse(
            job_id=job_id,
            status=JobStatus.PENDING,
            job_type=job_type,
            created_at=created_at,
            estimated_completion_seconds=estimated_seconds
        )
    
    async def get_job_status(self, job_id: str) -> Optional[JobStatusResponse]:
        """Get current status of a job"""
        if job_id not in self._jobs:
            return None
        
        job_data = self._jobs[job_id]
        
        return JobStatusResponse(
            job_id=job_id,
            status=job_data["status"],
            job_type=job_data["job_type"],
            created_at=job_data["created_at"],
            updated_at=job_data["updated_at"],
            progress=job_data.get("progress"),
            error_message=job_data.get("error_message"),
            estimated_completion_seconds=self._calculate_remaining_time(job_data)
        )
    
    async def get_job_result(self, job_id: str) -> Optional[JobResultResponse]:
        """Get job results if completed"""
        if job_id not in self._jobs:
            return None
        
        job_data = self._jobs[job_id]
        
        return JobResultResponse(
            job_id=job_id,
            status=job_data["status"],
            result=job_data.get("result"),
            error_message=job_data.get("error_message")
        )
    
    async def cancel_job(self, job_id: str) -> bool:
        """Cancel a running job"""
        if job_id not in self._jobs:
            return False
        
        # Cancel background task
        if job_id in self._background_tasks:
            self._background_tasks[job_id].cancel()
            del self._background_tasks[job_id]
        
        # Update job status
        self._jobs[job_id]["status"] = JobStatus.CANCELLED
        self._jobs[job_id]["updated_at"] = datetime.utcnow()
        
        return True
    
    def _calculate_remaining_time(self, job_data: Dict[str, Any]) -> Optional[int]:
        """Calculate estimated remaining time for job"""
        if job_data["status"] in [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED]:
            return 0
        
        elapsed = (datetime.utcnow() - job_data["created_at"]).total_seconds()
        
        if job_data["progress"]:
            percentage = job_data["progress"]["percentage"]
            if percentage > 0:
                total_estimated = elapsed / (percentage / 100)
                remaining = max(0, total_estimated - elapsed)
                return int(remaining)
        
        # Default estimate
        return max(0, 90 - int(elapsed))
    
    def _update_progress(self, job_id: str, stage: str, percentage: int, message: str):
        """Update job progress"""
        if job_id in self._jobs:
            self._jobs[job_id]["progress"] = {
                "stage": stage,
                "percentage": percentage,
                "message": message,
                "timestamp": datetime.utcnow()
            }
            self._jobs[job_id]["updated_at"] = datetime.utcnow()
            print(f"🔄 [Job-{job_id[:8]}] {stage}: {percentage}% - {message}")
    
    async def _process_analysis_job(self, job_id: str, file: UploadFile, user_id: Optional[str]):
        """Background task to process document analysis"""
        try:
            print(f"🚀 [Job-{job_id[:8]}] Starting analysis job for {file.filename}")
            
            # Update status to processing
            self._jobs[job_id]["status"] = JobStatus.PROCESSING
            self._jobs[job_id]["updated_at"] = datetime.utcnow()
            
            # Stage 1: File validation and reading
            self._update_progress(job_id, "validation", 5, "Validating file and reading content")
            
            temp_file_path = None
            try:
                # Create temporary file
                with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
                    temp_file_path = temp_file.name
                    content = await file.read()
                    temp_file.write(content)
                
                # Stage 2: Text extraction
                self._update_progress(job_id, "extraction", 15, "Extracting text from PDF")
                
                extracted_text = ""
                with pdfplumber.open(temp_file_path) as pdf:
                    for page in pdf.pages:
                        extracted_text += page.extract_text() or ""
                
                if not extracted_text.strip():
                    raise Exception("No text could be extracted from the PDF")
                
                # Stage 3: LLM Processing check
                self._update_progress(job_id, "llm_check", 25, "Checking AI processing availability")
                
                if not is_llm_processing_available():
                    raise Exception("AI processing is not available")
                
                # Stage 4: Contract type detection
                self._update_progress(job_id, "contract_type", 35, "Detecting contract type")
                
                user_model = "gpt-4o-mini"  # Default for async jobs
                if user_id:
                    service = get_document_service()
                    user_model = await service.get_user_preferred_model(user_id)
                
                contract_type, clauses = await process_document_with_llm(
                    extracted_text, file.filename, user_model
                )
                
                # Stage 5: Clause analysis
                self._update_progress(job_id, "clauses", 65, f"Analyzing {len(clauses)} clauses")
                
                # Stage 6: Structured summary generation
                self._update_progress(job_id, "summary", 80, "Generating structured summary")
                
                ai_structured_summary = await generate_structured_document_summary(
                    extracted_text, file.filename, user_model, contract_type
                )
                
                # Stage 7: Document storage
                self._update_progress(job_id, "storage", 90, "Saving document to database")
                
                document_id = str(uuid.uuid4())
                service = get_document_service()
                
                # Calculate risk summary from clauses
                risk_summary = {
                    "high": sum(1 for clause in clauses if clause.risk_level.value == "high"),
                    "medium": sum(1 for clause in clauses if clause.risk_level.value == "medium"),
                    "low": sum(1 for clause in clauses if clause.risk_level.value == "low")
                }
                
                document_data = {
                    "id": document_id,
                    "filename": file.filename,
                    "text": extracted_text,
                    "ai_full_summary": f"Analysis of {contract_type.title()} Contract",
                    "ai_structured_summary": ai_structured_summary,
                    "contract_type": contract_type,
                    "clauses": [clause.dict() for clause in clauses],
                    "risk_summary": risk_summary,
                    "upload_date": datetime.utcnow().isoformat(),
                    "user_id": user_id,
                    "user_interactions": None
                }
                
                if user_id:
                    await service.save_document_for_user(document_data, user_id)
                else:
                    # Sample document
                    await service.store_sample_document(document_data)
                
                # Stage 8: Final completion
                self._update_progress(job_id, "completed", 100, "Analysis complete")
                
                # Create result
                result = AnalysisJobResult(
                    job_id=job_id,
                    document_id=document_id,
                    filename=file.filename,
                    summary=document_data["ai_full_summary"],
                    ai_structured_summary=ai_structured_summary,
                    clauses=clauses,
                    total_clauses=len(clauses),
                    risk_summary=document_data["risk_summary"],
                    full_text=extracted_text,
                    contract_type=contract_type,
                    completed_at=datetime.utcnow()
                )
                
                # Update job with result
                self._jobs[job_id]["status"] = JobStatus.COMPLETED
                self._jobs[job_id]["result"] = result
                self._jobs[job_id]["updated_at"] = datetime.utcnow()
                
                print(f"✅ [Job-{job_id[:8]}] Analysis completed successfully: {document_id}")
                
            finally:
                # Clean up temporary file
                if temp_file_path and os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)
        
        except Exception as e:
            error_message = str(e)
            print(f"❌ [Job-{job_id[:8]}] Analysis failed: {error_message}")
            
            self._jobs[job_id]["status"] = JobStatus.FAILED
            self._jobs[job_id]["error_message"] = error_message
            self._jobs[job_id]["updated_at"] = datetime.utcnow()
        
        finally:
            # Clean up background task
            if job_id in self._background_tasks:
                del self._background_tasks[job_id]


# Global job service instance
_job_service = None

def get_job_service() -> JobService:
    """Get the global job service instance"""
    global _job_service
    if _job_service is None:
        _job_service = JobService()
    return _job_service 