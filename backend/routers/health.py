"""
Enhanced health check and monitoring endpoints.
"""
from fastapi import APIRouter, Depends, Request
from middleware.monitoring import HealthChecker, performance_metrics
from middleware.security import security_monitor
from middleware.api_standardization import APIResponse, create_success_response, create_error_response
from middleware.versioning import versioned_response
from auth import get_current_user
from typing import Dict, Any
import time


router = APIRouter(prefix="/health", tags=["health"])


@router.get("/", response_model=APIResponse[dict])
async def basic_health(request: Request):
    """Basic health check endpoint."""
    correlation_id = getattr(request.state, 'correlation_id', None)
    return create_success_response(
        data={"status": "healthy", "service": "ClauseIQ Legal AI Backend"},
        correlation_id=correlation_id
    )


@router.get("/detailed", response_model=APIResponse[dict])
@versioned_response
async def detailed_health(request: Request):
    """Detailed health check with all service dependencies."""
    correlation_id = getattr(request.state, 'correlation_id', None)
    health_data = HealthChecker.get_comprehensive_health()
    return create_success_response(
        data=health_data,
        correlation_id=correlation_id
    )


@router.get("/metrics", response_model=APIResponse[dict])
@versioned_response
async def performance_metrics_endpoint(
    request: Request,
    current_user: Dict = Depends(get_current_user)
):
    """Get performance metrics (authenticated endpoint)."""
    correlation_id = getattr(request.state, 'correlation_id', None)
    metrics_data = performance_metrics.get_summary()
    return create_success_response(
        data=metrics_data,
        correlation_id=correlation_id
    )


@router.get("/metrics/endpoints", response_model=APIResponse[dict])
@versioned_response
async def endpoint_metrics(
    request: Request,
    current_user: Dict = Depends(get_current_user)
):
    """Get per-endpoint performance statistics."""
    correlation_id = getattr(request.state, 'correlation_id', None)
    endpoint_stats = performance_metrics.get_endpoint_stats()
    return create_success_response(
        data=endpoint_stats,
        correlation_id=correlation_id
    )


@router.get("/security", response_model=APIResponse[dict])
@versioned_response
async def security_status(
    request: Request,
    current_user: Dict = Depends(get_current_user)
):
    """Get security monitoring status."""
    correlation_id = getattr(request.state, 'correlation_id', None)
    security_data = {
        "blocked_ips_count": len(security_monitor.blocked_ips),
        "suspicious_ips_count": len(security_monitor.suspicious_ips),
        "failed_auth_attempts_count": len(security_monitor.failed_auth_attempts),
        "last_cleanup": security_monitor.last_cleanup,
        "timestamp": time.time()
    }
    return create_success_response(
        data=security_data,
        correlation_id=correlation_id
    )


@router.get("/ready", response_model=APIResponse[dict])
async def readiness_check(request: Request):
    """Kubernetes-style readiness check."""
    correlation_id = getattr(request.state, 'correlation_id', None)
    health = HealthChecker.get_comprehensive_health()
    
    # Service is ready if database is healthy
    if health["checks"]["database"]["status"] == "healthy":
        return create_success_response(
            data={"status": "ready"},
            correlation_id=correlation_id
        )
    else:
        return create_error_response(
            code="SERVICE_NOT_READY",
            message="Service not ready - database unhealthy",
            details={"health_check": health},
            correlation_id=correlation_id
        )


@router.get("/live", response_model=APIResponse[dict])
async def liveness_check(request: Request):
    """Kubernetes-style liveness check."""
    correlation_id = getattr(request.state, 'correlation_id', None)
    # Simple check - if we can respond, we're alive
    return create_success_response(
        data={"status": "alive", "timestamp": time.time()},
        correlation_id=correlation_id
    )
