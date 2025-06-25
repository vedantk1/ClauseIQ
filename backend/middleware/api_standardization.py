"""
API response standardization middleware and utilities.
Provides consistent API response formats, error handling, and request tracking.
"""
import time
import uuid
import logging
from typing import Any, Dict, Optional, Union, TypeVar, Generic
from fastapi import Request, Response, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Define a TypeVar for generic API response
T = TypeVar('T')


class APIResponse(BaseModel, Generic[T]):
    """Standard API response format."""
    success: bool
    data: Optional[T] = None
    error: Optional[Dict[str, Any]] = None
    meta: Optional[Dict[str, Any]] = None
    correlation_id: Optional[str] = None


class ErrorResponse(BaseModel):
    """Standard error response format."""
    code: str
    message: str
    details: Optional[Dict[str, Any]] = None


class PaginationMeta(BaseModel):
    """Pagination metadata."""
    page: int
    page_size: int
    total_items: int
    total_pages: int
    has_next: bool
    has_previous: bool


def create_success_response(
    data: T,
    meta: Optional[Dict[str, Any]] = None,
    correlation_id: Optional[str] = None
) -> APIResponse[T]:
    """Create standardized success response."""
    return APIResponse[T](
        success=True,
        data=data,
        meta=meta,
        correlation_id=correlation_id
    )


def create_error_response(
    code: str,
    message: str,
    details: Optional[Dict[str, Any]] = None,
    correlation_id: Optional[str] = None
) -> APIResponse[None]:
    """Create standardized error response."""
    error = ErrorResponse(
        code=code,
        message=message,
        details=details
    )
    return APIResponse[None](
        success=False,
        error=error.model_dump(),
        correlation_id=correlation_id
    )


def create_pagination_response(
    items: list,
    page: int,
    page_size: int,
    total_items: int,
    correlation_id: Optional[str] = None
) -> APIResponse:
    """Create paginated response."""
    total_pages = (total_items + page_size - 1) // page_size
    
    pagination_meta = PaginationMeta(
        page=page,
        page_size=page_size,
        total_items=total_items,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_previous=page > 1
    )
    
    return create_success_response(
        data=items,
        meta={"pagination": pagination_meta.model_dump()},
        correlation_id=correlation_id
    )


class APIStandardizationMiddleware(BaseHTTPMiddleware):
    """
    Middleware for API request/response standardization.
    
    Features:
    - Adds correlation IDs to requests
    - Tracks request timing
    - Standardizes error responses
    - Logs API requests and responses
    """
    
    async def dispatch(self, request: Request, call_next):
        # Generate correlation ID
        correlation_id = str(uuid.uuid4())
        request.state.correlation_id = correlation_id
        
        # Add correlation ID to response headers
        start_time = time.time()
        
        # Log request
        logger.info(
            f"API Request: {request.method} {request.url.path}",
            extra={
                "correlation_id": correlation_id,
                "method": request.method,
                "path": request.url.path,
                "query_params": dict(request.query_params),
                "client_ip": request.client.host if request.client else None
            }
        )
        
        try:
            response = await call_next(request)
        except Exception as e:
            # Handle unexpected errors
            logger.error(
                f"Unhandled error in request {correlation_id}: {str(e)}",
                extra={"correlation_id": correlation_id},
                exc_info=True
            )
            
            error_response = create_error_response(
                code="INTERNAL_SERVER_ERROR",
                message="An unexpected error occurred",
                details={"type": type(e).__name__},
                correlation_id=correlation_id
            )
            
            # 🚀 FOUNDATIONAL: Ensure CORS headers in error responses
            cors_headers = {
                "X-Correlation-ID": correlation_id,
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Credentials": "true"
            }
            
            return JSONResponse(
                status_code=500,
                content=error_response.model_dump(),
                headers=cors_headers
            )
        
        # Calculate request duration
        duration = time.time() - start_time
        
        # Add correlation ID to response headers
        response.headers["X-Correlation-ID"] = correlation_id
        response.headers["X-Request-Duration"] = f"{duration:.3f}s"
        
        # Log response
        logger.info(
            f"API Response: {response.status_code} for {request.method} {request.url.path}",
            extra={
                "correlation_id": correlation_id,
                "status_code": response.status_code,
                "duration": duration,
                "method": request.method,
                "path": request.url.path
            }
        )
        
        return response


class HTTPExceptionHandler:
    """Custom HTTP exception handler for standardized error responses."""
    
    @staticmethod
    async def handler(request: Request, exc: HTTPException) -> JSONResponse:
        """Handle HTTP exceptions with standardized format."""
        correlation_id = getattr(request.state, 'correlation_id', None)
        
        # Map HTTP status codes to error codes
        error_code_map = {
            400: "BAD_REQUEST",
            401: "UNAUTHORIZED", 
            403: "FORBIDDEN",
            404: "NOT_FOUND",
            405: "METHOD_NOT_ALLOWED",
            409: "CONFLICT",
            422: "VALIDATION_ERROR",
            429: "RATE_LIMIT_EXCEEDED",
            500: "INTERNAL_SERVER_ERROR",
            502: "BAD_GATEWAY",
            503: "SERVICE_UNAVAILABLE"
        }
        
        error_code = error_code_map.get(exc.status_code, "UNKNOWN_ERROR")
        
        error_response = create_error_response(
            code=error_code,
            message=exc.detail,
            correlation_id=correlation_id
        )
        
        # 🚀 FOUNDATIONAL: Ensure CORS headers in HTTP error responses
        cors_headers = {
            "X-Correlation-ID": correlation_id,
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Credentials": "true"
        } if correlation_id else {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", 
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Credentials": "true"
        }
        
        return JSONResponse(
            status_code=exc.status_code,
            content=error_response.model_dump(),
            headers=cors_headers
        )


class ValidationExceptionHandler:
    """Handler for Pydantic validation errors."""
    
    @staticmethod
    async def handler(request: Request, exc: Exception) -> JSONResponse:
        """Handle validation exceptions."""
        from fastapi.exceptions import RequestValidationError
        
        correlation_id = getattr(request.state, 'correlation_id', None)
        
        if isinstance(exc, RequestValidationError):
            # Format validation errors
            validation_errors = []
            for error in exc.errors():
                validation_errors.append({
                    "field": ".".join(str(x) for x in error["loc"]),
                    "message": error["msg"],
                    "type": error["type"]
                })
            
            error_response = create_error_response(
                code="VALIDATION_ERROR",
                message="Request validation failed",
                details={"validation_errors": validation_errors},
                correlation_id=correlation_id
            )
            
            # 🚀 FOUNDATIONAL: Ensure CORS headers in validation error responses
            cors_headers = {
                "X-Correlation-ID": correlation_id,
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Credentials": "true"
            } if correlation_id else {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "*", 
                "Access-Control-Allow-Credentials": "true"
            }
            
            return JSONResponse(
                status_code=422,
                content=error_response.model_dump(),
                headers=cors_headers
            )
        
        # Fallback for other validation errors
        error_response = create_error_response(
            code="VALIDATION_ERROR",
            message="Validation failed",
            details={"error": str(exc)},
            correlation_id=correlation_id
        )
        
        # 🚀 FOUNDATIONAL: Ensure CORS headers in fallback validation errors
        cors_headers = {
            "X-Correlation-ID": correlation_id,
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Credentials": "true"
        } if correlation_id else {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Credentials": "true"
        }
        
        return JSONResponse(
            status_code=422,
            content=error_response.model_dump(),
            headers=cors_headers
        )


# Request-aware response helpers for router endpoints
def create_success_response_with_request(
    data: T,
    message: str = "Operation successful",
    request: Optional[Request] = None,
    meta: Optional[Dict[str, Any]] = None
) -> APIResponse[T]:
    """
    Create standardized success response with request context.
    Enterprise-grade helper for router endpoints.
    """
    correlation_id = get_correlation_id(request) if request else None
    return create_success_response(
        data=data,
        meta={
            "message": message,
            **(meta or {})
        },
        correlation_id=correlation_id
    )


def create_error_response_with_request(
    message: str,
    request: Optional[Request] = None,
    error_code: str = "BAD_REQUEST",
    details: Optional[Dict[str, Any]] = None
) -> APIResponse[None]:
    """
    Create standardized error response with request context.
    Enterprise-grade helper for router endpoints.
    
    Note: HTTP status codes should be handled by raising HTTPException.
    This function creates the error response structure.
    """
    correlation_id = get_correlation_id(request) if request else None
    return create_error_response(
        code=error_code,
        message=message,
        details=details,
        correlation_id=correlation_id
    )


def get_correlation_id(request: Request) -> Optional[str]:
    """Get correlation ID from request."""
    return getattr(request.state, 'correlation_id', None)


def add_api_standardization(app):
    """Add API standardization middleware and exception handlers to FastAPI app."""
    from fastapi.exceptions import RequestValidationError
    
    # Add middleware
    app.add_middleware(APIStandardizationMiddleware)
    
    # Add exception handlers
    app.add_exception_handler(HTTPException, HTTPExceptionHandler.handler)
    app.add_exception_handler(RequestValidationError, ValidationExceptionHandler.handler)
    
    return app
