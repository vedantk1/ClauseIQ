"""
Enhanced health check and monitoring endpoints.
"""
from fastapi import APIRouter, Depends
from middleware.monitoring import HealthChecker, performance_metrics
from middleware.security import security_monitor
from auth import get_current_user
from typing import Dict, Any
import time


router = APIRouter(prefix="/health", tags=["health"])


@router.get("/")
async def basic_health():
    """Basic health check endpoint."""
    return {"status": "healthy", "service": "ClauseIQ Legal AI Backend"}


@router.get("/detailed")
async def detailed_health():
    """Detailed health check with all service dependencies."""
    return HealthChecker.get_comprehensive_health()


@router.get("/metrics")
async def performance_metrics_endpoint(current_user: Dict = Depends(get_current_user)):
    """Get performance metrics (authenticated endpoint)."""
    return performance_metrics.get_summary()


@router.get("/metrics/endpoints")
async def endpoint_metrics(current_user: Dict = Depends(get_current_user)):
    """Get per-endpoint performance statistics."""
    return performance_metrics.get_endpoint_stats()


@router.get("/security")
async def security_status(current_user: Dict = Depends(get_current_user)):
    """Get security monitoring status."""
    return {
        "blocked_ips_count": len(security_monitor.blocked_ips),
        "suspicious_ips_count": len(security_monitor.suspicious_ips),
        "failed_auth_attempts_count": len(security_monitor.failed_auth_attempts),
        "last_cleanup": security_monitor.last_cleanup,
        "timestamp": time.time()
    }


@router.get("/ready")
async def readiness_check():
    """Kubernetes-style readiness check."""
    health = HealthChecker.get_comprehensive_health()
    
    # Service is ready if database is healthy
    if health["checks"]["database"]["status"] == "healthy":
        return {"status": "ready"}
    else:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="Service not ready")


@router.get("/live")
async def liveness_check():
    """Kubernetes-style liveness check."""
    # Simple check - if we can respond, we're alive
    return {"status": "alive", "timestamp": time.time()}
