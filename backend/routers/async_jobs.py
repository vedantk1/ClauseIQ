"""
Async job routes for long-running document analysis tasks.
"""
from fastapi import APIRouter, File, UploadFile, HTTPException, Depends, Request
from typing import Optional

from auth import get_current_user
from services.job_service import get_job_service
from services.document_service import validate_file
from middleware.api_standardization import APIResponse, create_success_response, create_error_response
from middleware.versioning import versioned_response
from models.jobs import (
    JobType, AnalysisJobResponse, JobStatusResponse, JobResultResponse
)

router = APIRouter(tags=["async-jobs"])


@router.post("/jobs/analysis/start", response_model=APIResponse[AnalysisJobResponse])
@versioned_response
async def start_analysis_job(
    request: Request,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Start a new document analysis job"""
    correlation_id = getattr(request.state, 'correlation_id', None)
    
    try:
        validate_file(file)
        job_service = get_job_service()
        
        # Start the analysis job
        job_response = await job_service.start_analysis_job(
            file=file,
            user_id=current_user["id"],
            job_type=JobType.DOCUMENT_ANALYSIS
        )
        
        return create_success_response(
            data=job_response,
            message=f"Analysis job started for {file.filename}",
            correlation_id=correlation_id
        )
        
    except Exception as e:
        return create_error_response(
            code="JOB_START_FAILED",
            message=f"Failed to start analysis job: {str(e)}",
            correlation_id=correlation_id
        )


@router.post("/jobs/analysis/start-sample", response_model=APIResponse[AnalysisJobResponse])
@versioned_response
async def start_sample_analysis_job(
    request: Request,
    file: UploadFile = File(...)
):
    """Start a new sample document analysis job (no authentication required)"""
    correlation_id = getattr(request.state, 'correlation_id', None)
    
    try:
        validate_file(file)
        
        # Only allow sample-contract.pdf
        if file.filename != "sample-contract.pdf":
            return create_error_response(
                code="INVALID_SAMPLE_FILE",
                message="Only sample-contract.pdf is allowed for unauthenticated analysis",
                correlation_id=correlation_id
            )
        
        job_service = get_job_service()
        
        # Start the sample analysis job
        job_response = await job_service.start_analysis_job(
            file=file,
            user_id=None,  # No user for sample
            job_type=JobType.SAMPLE_ANALYSIS
        )
        
        return create_success_response(
            data=job_response,
            message=f"Sample analysis job started for {file.filename}",
            correlation_id=correlation_id
        )
        
    except Exception as e:
        return create_error_response(
            code="SAMPLE_JOB_START_FAILED",
            message=f"Failed to start sample analysis job: {str(e)}",
            correlation_id=correlation_id
        )


@router.get("/jobs/{job_id}/status", response_model=APIResponse[JobStatusResponse])
@versioned_response
async def get_job_status(
    request: Request,
    job_id: str,
    current_user: Optional[dict] = Depends(get_current_user)
):
    """Get the status of an analysis job"""
    correlation_id = getattr(request.state, 'correlation_id', None)
    
    try:
        job_service = get_job_service()
        status_response = await job_service.get_job_status(job_id)
        
        if not status_response:
            return create_error_response(
                code="JOB_NOT_FOUND",
                message=f"Job {job_id} not found",
                correlation_id=correlation_id
            )
        
        return create_success_response(
            data=status_response,
            message="Job status retrieved successfully",
            correlation_id=correlation_id
        )
        
    except Exception as e:
        return create_error_response(
            code="JOB_STATUS_FAILED",
            message=f"Failed to get job status: {str(e)}",
            correlation_id=correlation_id
        )


@router.get("/jobs/{job_id}/status-public")
@versioned_response
async def get_job_status_public(
    request: Request,
    job_id: str
):
    """Get the status of a job without authentication (for sample jobs)"""
    correlation_id = getattr(request.state, 'correlation_id', None)
    
    try:
        job_service = get_job_service()
        status_response = await job_service.get_job_status(job_id)
        
        if not status_response:
            return create_error_response(
                code="JOB_NOT_FOUND",
                message=f"Job {job_id} not found",
                correlation_id=correlation_id
            )
        
        # Only allow access to sample jobs for unauthenticated requests
        if status_response.job_type != JobType.SAMPLE_ANALYSIS:
            return create_error_response(
                code="JOB_ACCESS_DENIED",
                message="This endpoint only supports sample analysis jobs",
                correlation_id=correlation_id
            )
        
        return create_success_response(
            data=status_response,
            message="Job status retrieved successfully",
            correlation_id=correlation_id
        )
        
    except Exception as e:
        return create_error_response(
            code="JOB_STATUS_FAILED",
            message=f"Failed to get job status: {str(e)}",
            correlation_id=correlation_id
        )


@router.get("/jobs/{job_id}/result", response_model=APIResponse[JobResultResponse])
@versioned_response
async def get_job_result(
    request: Request,
    job_id: str,
    current_user: Optional[dict] = Depends(get_current_user)
):
    """Get the results of a completed analysis job"""
    correlation_id = getattr(request.state, 'correlation_id', None)
    
    try:
        job_service = get_job_service()
        result_response = await job_service.get_job_result(job_id)
        
        if not result_response:
            return create_error_response(
                code="JOB_NOT_FOUND",
                message=f"Job {job_id} not found",
                correlation_id=correlation_id
            )
        
        return create_success_response(
            data=result_response,
            message="Job result retrieved successfully",
            correlation_id=correlation_id
        )
        
    except Exception as e:
        return create_error_response(
            code="JOB_RESULT_FAILED",
            message=f"Failed to get job result: {str(e)}",
            correlation_id=correlation_id
        )


@router.get("/jobs/{job_id}/result-public")
@versioned_response
async def get_job_result_public(
    request: Request,
    job_id: str
):
    """Get the results of a sample job without authentication"""
    correlation_id = getattr(request.state, 'correlation_id', None)
    
    try:
        job_service = get_job_service()
        result_response = await job_service.get_job_result(job_id)
        
        if not result_response:
            return create_error_response(
                code="JOB_NOT_FOUND",
                message=f"Job {job_id} not found",
                correlation_id=correlation_id
            )
        
        # Check if this is a sample job by looking at the job status first
        status_response = await job_service.get_job_status(job_id)
        if not status_response or status_response.job_type != JobType.SAMPLE_ANALYSIS:
            return create_error_response(
                code="JOB_ACCESS_DENIED",
                message="This endpoint only supports sample analysis jobs",
                correlation_id=correlation_id
            )
        
        return create_success_response(
            data=result_response,
            message="Job result retrieved successfully",
            correlation_id=correlation_id
        )
        
    except Exception as e:
        return create_error_response(
            code="JOB_RESULT_FAILED",
            message=f"Failed to get job result: {str(e)}",
            correlation_id=correlation_id
        )


@router.delete("/jobs/{job_id}", response_model=APIResponse[dict])
@versioned_response
async def cancel_job(
    request: Request,
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Cancel a running analysis job"""
    correlation_id = getattr(request.state, 'correlation_id', None)
    
    try:
        job_service = get_job_service()
        cancelled = await job_service.cancel_job(job_id)
        
        if not cancelled:
            return create_error_response(
                code="JOB_NOT_FOUND",
                message=f"Job {job_id} not found or cannot be cancelled",
                correlation_id=correlation_id
            )
        
        return create_success_response(
            data={"cancelled": True},
            message="Job cancelled successfully",
            correlation_id=correlation_id
        )
        
    except Exception as e:
        return create_error_response(
            code="JOB_CANCEL_FAILED",
            message=f"Failed to cancel job: {str(e)}",
            correlation_id=correlation_id
        ) 