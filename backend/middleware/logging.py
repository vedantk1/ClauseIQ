"""
Comprehensive logging middleware for request/response tracking and error monitoring.
"""
import time
import uuid
import json
import traceback
from datetime import datetime
from typing import Dict, Any, Optional
from fastapi import Request, Response, HTTPException
from fastapi.responses import JSONResponse
import logging
import sys


# Configure structured logging
class StructuredLogger:
    """Structured logger for API requests and errors."""
    
    def __init__(self):
        self.logger = logging.getLogger("clauseiq_api")
        if not self.logger.handlers:
            handler = logging.StreamHandler(sys.stdout)
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            self.logger.addHandler(handler)
            self.logger.setLevel(logging.INFO)
    
    def log_request(self, request_id: str, request: Request, user_id: Optional[str] = None):
        """Log incoming request details."""
        log_data = {
            "event": "request_start",
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "query_params": dict(request.query_params),
            "user_agent": request.headers.get("user-agent"),
            "client_ip": request.client.host if request.client else None,
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat()
        }
        self.logger.info(json.dumps(log_data))
    
    def log_response(self, request_id: str, status_code: int, duration: float, response_size: int = 0):
        """Log response details."""
        log_data = {
            "event": "request_complete",
            "request_id": request_id,
            "status_code": status_code,
            "duration_ms": round(duration * 1000, 2),
            "response_size_bytes": response_size,
            "timestamp": datetime.utcnow().isoformat()
        }
        self.logger.info(json.dumps(log_data))
    
    def log_error(self, request_id: str, error: Exception, request: Request, user_id: Optional[str] = None):
        """Log error details."""
        log_data = {
            "event": "request_error",
            "request_id": request_id,
            "error_type": type(error).__name__,
            "error_message": str(error),
            "path": request.url.path,
            "method": request.method,
            "user_id": user_id,
            "traceback": traceback.format_exc(),
            "timestamp": datetime.utcnow().isoformat()
        }
        self.logger.error(json.dumps(log_data))


# Global logger instance
structured_logger = StructuredLogger()


async def logging_middleware(request: Request, call_next):
    """Comprehensive logging middleware."""
    request_id = str(uuid.uuid4())
    start_time = time.time()
    
    # Extract user ID from JWT if available
    user_id = None
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        try:
            from auth import verify_token
            token = auth_header.split(" ")[1]
            payload = verify_token(token)
            if payload:
                user_id = payload.get("sub")
        except:
            pass
    
    # Log request start
    structured_logger.log_request(request_id, request, user_id)
    
    # Add request ID to request state
    request.state.request_id = request_id
    request.state.user_id = user_id
    request.state.start_time = start_time
    
    try:
        # Process request
        response = await call_next(request)
        
        # Calculate duration
        duration = time.time() - start_time
        
        # Get response size (estimate)
        response_size = 0
        if hasattr(response, 'body'):
            response_size = len(response.body)
        
        # Log successful response
        structured_logger.log_response(request_id, response.status_code, duration, response_size)
        
        # Add request ID to response headers
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Response-Time"] = f"{duration * 1000:.2f}ms"
        
        return response
        
    except HTTPException as http_error:
        # Log HTTP exception but preserve status code
        structured_logger.log_error(request_id, http_error, request, user_id)
        
        # Calculate duration for error case
        duration = time.time() - start_time
        structured_logger.log_response(request_id, http_error.status_code, duration)
        
        # Re-raise HTTPException to preserve status code
        raise http_error
        
    except Exception as error:
        # Log unexpected error
        structured_logger.log_error(request_id, error, request, user_id)
        
        # Calculate duration for error case
        duration = time.time() - start_time
        
        # Return structured error response
        error_response = {
            "error": "Internal server error",
            "request_id": request_id,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        structured_logger.log_response(request_id, 500, duration)
        
        return JSONResponse(
            status_code=500,
            content=error_response,
            headers={
                "X-Request-ID": request_id,
                "X-Response-Time": f"{duration * 1000:.2f}ms"
            }
        )


class SecurityLogger:
    """Security-focused logging for suspicious activities."""
    
    def __init__(self):
        self.logger = logging.getLogger("clauseiq_security")
        if not self.logger.handlers:
            handler = logging.StreamHandler(sys.stdout)
            formatter = logging.Formatter(
                '%(asctime)s - SECURITY - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            self.logger.addHandler(handler)
            self.logger.setLevel(logging.WARNING)
    
    def log_suspicious_activity(self, event_type: str, details: Dict[str, Any]):
        """Log security-related events."""
        log_data = {
            "event": "security_alert",
            "type": event_type,
            "details": details,
            "timestamp": datetime.utcnow().isoformat()
        }
        self.logger.warning(json.dumps(log_data))
    
    def log_auth_failure(self, client_ip: str, attempted_email: str):
        """Log authentication failures."""
        self.log_suspicious_activity("auth_failure", {
            "client_ip": client_ip,
            "attempted_email": attempted_email
        })
    
    def log_rate_limit_hit(self, client_ip: str, endpoint: str, limit_type: str):
        """Log rate limit violations."""
        self.log_suspicious_activity("rate_limit_exceeded", {
            "client_ip": client_ip,
            "endpoint": endpoint,
            "limit_type": limit_type
        })
    
    def log_blocked_ip(self, client_ip: str, reason: str):
        """Log IP blocking events."""
        self.log_suspicious_activity("ip_blocked", {
            "client_ip": client_ip,
            "reason": reason
        })


# Global security logger instance
security_logger = SecurityLogger()

# Export the main middleware function
__all__ = ['logging_middleware', 'security_logger', 'structured_logger']
