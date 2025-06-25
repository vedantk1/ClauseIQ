"""
Performance monitoring middleware for tracking API metrics and health.
"""
import time
import psutil
import asyncio
from typing import Dict, List, Optional
from fastapi import Request
from datetime import datetime, timedelta
from collections import defaultdict, deque
import json


class PerformanceMetrics:
    """In-memory performance metrics collector."""
    
    def __init__(self, max_history: int = 1000):
        self.max_history = max_history
        self.request_times: deque = deque(maxlen=max_history)
        self.endpoint_metrics: Dict[str, deque] = defaultdict(lambda: deque(maxlen=100))
        self.error_counts: Dict[int, int] = defaultdict(int)
        self.active_requests = 0
        self.total_requests = 0
        self.start_time = time.time()
        
        # System metrics
        self.cpu_usage_history: deque = deque(maxlen=60)  # Last 60 readings
        self.memory_usage_history: deque = deque(maxlen=60)
        self.monitoring_task = None
        
    def start_monitoring(self):
        """Start background system monitoring if not already started."""
        if self.monitoring_task is None:
            try:
                loop = asyncio.get_running_loop()
                self.monitoring_task = loop.create_task(self._monitor_system_metrics())
            except RuntimeError:
                # No event loop running, monitoring will start when middleware is used
                pass
    
    async def _monitor_system_metrics(self):
        """Background task to collect system metrics."""
        while True:
            try:
                # Collect CPU and memory usage
                cpu_percent = psutil.cpu_percent(interval=1)
                memory = psutil.virtual_memory()
                
                self.cpu_usage_history.append({
                    "timestamp": time.time(),
                    "value": cpu_percent
                })
                
                self.memory_usage_history.append({
                    "timestamp": time.time(),
                    "value": memory.percent,
                    "used_mb": memory.used / (1024 * 1024),
                    "available_mb": memory.available / (1024 * 1024)
                })
                
                await asyncio.sleep(60)  # Collect every minute
            except Exception as e:
                print(f"System metrics collection error: {e}")
                await asyncio.sleep(60)
    
    def record_request(self, path: str, method: str, duration: float, status_code: int):
        """Record request metrics."""
        self.total_requests += 1
        
        request_data = {
            "timestamp": time.time(),
            "path": path,
            "method": method,
            "duration": duration,
            "status_code": status_code
        }
        
        self.request_times.append(request_data)
        
        # Store endpoint-specific metrics
        endpoint_key = f"{method} {path}"
        self.endpoint_metrics[endpoint_key].append({
            "timestamp": time.time(),
            "duration": duration,
            "status_code": status_code
        })
        
        # Count errors
        if status_code >= 400:
            self.error_counts[status_code] += 1
    
    def get_summary(self) -> Dict:
        """Get performance summary."""
        now = time.time()
        uptime = now - self.start_time
        
        # Calculate averages
        recent_requests = [r for r in self.request_times if now - r["timestamp"] < 300]  # Last 5 minutes
        avg_response_time = 0
        if recent_requests:
            avg_response_time = sum(r["duration"] for r in recent_requests) / len(recent_requests)
        
        # Calculate request rate
        requests_last_minute = [r for r in self.request_times if now - r["timestamp"] < 60]
        request_rate = len(requests_last_minute)
        
        # Error rate
        recent_errors = [r for r in recent_requests if r["status_code"] >= 400]
        error_rate = (len(recent_errors) / len(recent_requests) * 100) if recent_requests else 0
        
        # System metrics
        current_cpu = self.cpu_usage_history[-1]["value"] if self.cpu_usage_history else 0
        current_memory = self.memory_usage_history[-1] if self.memory_usage_history else {}
        
        return {
            "uptime_seconds": uptime,
            "total_requests": self.total_requests,
            "active_requests": self.active_requests,
            "requests_per_minute": request_rate,
            "average_response_time_ms": round(avg_response_time * 1000, 2),
            "error_rate_percentage": round(error_rate, 2),
            "error_counts": dict(self.error_counts),
            "system": {
                "cpu_usage_percent": current_cpu,
                "memory_usage_percent": current_memory.get("value", 0),
                "memory_used_mb": round(current_memory.get("used_mb", 0), 1),
                "memory_available_mb": round(current_memory.get("available_mb", 0), 1)
            },
            "timestamp": datetime.utcnow().isoformat()
        }
    
    def get_endpoint_stats(self) -> Dict:
        """Get per-endpoint performance statistics."""
        stats = {}
        
        for endpoint, metrics in self.endpoint_metrics.items():
            if not metrics:
                continue
            
            durations = [m["duration"] for m in metrics]
            status_codes = [m["status_code"] for m in metrics]
            
            # Calculate percentiles
            sorted_durations = sorted(durations)
            count = len(sorted_durations)
            
            if count > 0:
                p50 = sorted_durations[int(count * 0.5)]
                p95 = sorted_durations[int(count * 0.95)]
                p99 = sorted_durations[int(count * 0.99)]
                
                error_count = sum(1 for sc in status_codes if sc >= 400)
                error_rate = (error_count / count * 100) if count > 0 else 0
                
                stats[endpoint] = {
                    "total_requests": count,
                    "avg_duration_ms": round(sum(durations) / count * 1000, 2),
                    "p50_duration_ms": round(p50 * 1000, 2),
                    "p95_duration_ms": round(p95 * 1000, 2),
                    "p99_duration_ms": round(p99 * 1000, 2),
                    "error_rate_percentage": round(error_rate, 2),
                    "error_count": error_count
                }
        
        return stats


# Global metrics instance
performance_metrics = PerformanceMetrics()


async def performance_monitoring_middleware(request: Request, call_next):
    """Performance monitoring middleware."""
    start_time = time.time()
    
    # Start monitoring on first request if not already started
    performance_metrics.start_monitoring()
    
    # Increment active requests counter
    performance_metrics.active_requests += 1
    
    try:
        # Process request
        response = await call_next(request)
        
        # Calculate duration
        duration = time.time() - start_time
        
        # Record metrics
        performance_metrics.record_request(
            path=request.url.path,
            method=request.method,
            duration=duration,
            status_code=response.status_code
        )
        
        # 🚀 INTEGRATION: Log to debug dashboard for real-time monitoring
        try:
            from debug_dashboard import debug_dashboard
            await debug_dashboard.log_api_request(
                request=request,
                response_time=duration,
                status_code=response.status_code,
                error=None
            )
        except Exception:
            pass  # Don't break main flow if debug logging fails
        
        # Add performance headers
        response.headers["X-Process-Time"] = f"{duration * 1000:.2f}ms"
        
        return response
        
    except Exception as error:
        # Record error metrics
        duration = time.time() - start_time
        performance_metrics.record_request(
            path=request.url.path,
            method=request.method,
            duration=duration,
            status_code=500
        )
        
        # 🚀 INTEGRATION: Log errors to debug dashboard
        try:
            from debug_dashboard import debug_dashboard
            await debug_dashboard.log_api_request(
                request=request,
                response_time=duration,
                status_code=500,
                error=str(error)
            )
        except Exception:
            pass  # Don't break main flow if debug logging fails
        
        raise
        
    finally:
        # Decrement active requests counter
        performance_metrics.active_requests -= 1


class HealthChecker:
    """Health check utilities for monitoring service status."""
    
    @staticmethod
    def check_database_health() -> Dict:
        """Check database connectivity and performance."""
        try:
            from database import get_mongo_storage
            storage = get_mongo_storage()
            
            start_time = time.time()
            # Simple connectivity test
            storage.get_database_info()
            duration = time.time() - start_time
            
            return {
                "status": "healthy",
                "response_time_ms": round(duration * 1000, 2),
                "type": "mongodb"
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "type": "mongodb"
            }
    
    @staticmethod
    def check_openai_health() -> Dict:
        """Check OpenAI API connectivity."""
        try:
            from settings import get_settings
            settings = get_settings()
            api_key = settings.openai.api_key
            if not api_key or api_key == "your-openai-api-key":
                return {
                    "status": "unhealthy",
                    "error": "OpenAI API key not configured",
                    "type": "openai"
                }
            
            return {
                "status": "healthy",
                "type": "openai",
                "note": "API key configured (connectivity not tested to avoid costs)"
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "type": "openai"
            }
    
    @staticmethod
    def check_email_health() -> Dict:
        """Check email service configuration."""
        try:
            from settings import get_settings
            settings = get_settings()
            
            if not all([settings.email.smtp_host, settings.email.smtp_port, settings.email.smtp_username, settings.email.smtp_password]):
                return {
                    "status": "unhealthy",
                    "error": "Email configuration incomplete",
                    "type": "email"
                }
            
            return {
                "status": "healthy",
                "type": "email",
                "smtp_host": settings.email.smtp_host,
                "smtp_port": settings.email.smtp_port
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "type": "email"
            }
    
    @classmethod
    def get_comprehensive_health(cls) -> Dict:
        """Get comprehensive health check results."""
        health_checks = {
            "database": cls.check_database_health(),
            "openai": cls.check_openai_health(),
            "email": cls.check_email_health()
        }
        
        # Overall status
        all_healthy = all(check["status"] == "healthy" for check in health_checks.values())
        overall_status = "healthy" if all_healthy else "degraded"
        
        return {
            "status": overall_status,
            "timestamp": datetime.utcnow().isoformat(),
            "checks": health_checks,
            "performance": performance_metrics.get_summary()
        }
