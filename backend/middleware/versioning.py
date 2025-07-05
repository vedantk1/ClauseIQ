"""
API versioning infrastructure.
Provides version-aware routing and backward compatibility support.
"""
import re
from typing import Dict, List, Optional, Callable, Any
from fastapi import FastAPI, Request, HTTPException, APIRouter
from fastapi.routing import APIRoute
from enum import Enum
import logging
from functools import wraps

logger = logging.getLogger(__name__)


def versioned_response(version: Optional[str] = None):
    """
    Decorator for versioned API responses.
    
    Args:
        version: Optional version string for the endpoint
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Add version information to response metadata
            result = await func(*args, **kwargs)
            if hasattr(result, 'headers'):
                result.headers["X-API-Version"] = version or "1.0"
            return result
        
        # Store version info on the function
        wrapper.__api_version__ = version or "1.0"
        return wrapper
    
    # Support both @versioned_response and @versioned_response("version")
    if callable(version):
        func = version
        version = "1.0"
        return decorator(func)
    
    return decorator


class APIVersion(str, Enum):
    """Supported API versions."""
    V1 = "v1"
    V2 = "v2"  # Future version


class VersionedAPIRouter(APIRouter):
    """API Router with version support."""
    
    def __init__(self, version: APIVersion, **kwargs):
        super().__init__(**kwargs)
        self.version = version
        self.version_prefix = f"/api/{version.value}"
        
        # Update prefix to include version
        if self.prefix:
            self.prefix = f"{self.version_prefix}{self.prefix}"
        else:
            self.prefix = self.version_prefix


class APIVersioning:
    """API versioning manager."""
    
    def __init__(self):
        self.routers: Dict[APIVersion, List[APIRouter]] = {}
        self.default_version = APIVersion.V1
        self.supported_versions = [APIVersion.V1]
        self.deprecation_warnings: Dict[APIVersion, str] = {}
    
    def add_router(self, version: APIVersion, router: APIRouter):
        """Add router for specific API version."""
        if version not in self.routers:
            self.routers[version] = []
        self.routers[version].append(router)
        
        if version not in self.supported_versions:
            self.supported_versions.append(version)
    
    def deprecate_version(self, version: APIVersion, message: str):
        """Mark an API version as deprecated."""
        self.deprecation_warnings[version] = message
    
    def get_version_from_request(self, request: Request) -> APIVersion:
        """Extract API version from request."""
        # Try to get version from URL path
        path = request.url.path
        version_match = re.match(r"/api/v(\d+)/", path)
        
        if version_match:
            version_num = version_match.group(1)
            version_key = f"v{version_num}"
            
            # Check if version is supported
            for version in APIVersion:
                if version.value == version_key:
                    return version
        
        # Try to get version from header
        version_header = request.headers.get("API-Version")
        if version_header:
            for version in APIVersion:
                if version.value == version_header:
                    return version
        
        # Try to get version from query parameter
        version_query = request.query_params.get("version")
        if version_query:
            for version in APIVersion:
                if version.value == version_query:
                    return version
        
        # Return default version
        return self.default_version
    
    def validate_version(self, version: APIVersion) -> bool:
        """Check if API version is supported."""
        return version in self.supported_versions
    
    def get_deprecation_warning(self, version: APIVersion) -> Optional[str]:
        """Get deprecation warning for version."""
        return self.deprecation_warnings.get(version)


class VersioningMiddleware:
    """Middleware for API versioning."""
    
    def __init__(self, versioning: APIVersioning):
        self.versioning = versioning
    
    async def __call__(self, request: Request, call_next):
        """Process request with version awareness."""
        # Extract API version
        version = self.versioning.get_version_from_request(request)
        
        # Store version in request state
        request.state.api_version = version
        
        # Check if version is supported
        if not self.versioning.validate_version(version):
            raise HTTPException(
                status_code=400,
                detail=f"API version {version.value} is not supported. "
                       f"Supported versions: {[v.value for v in self.versioning.supported_versions]}"
            )
        
        # Process request
        response = await call_next(request)
        
        # Add version headers
        response.headers["API-Version"] = version.value
        response.headers["Supported-Versions"] = ",".join([v.value for v in self.versioning.supported_versions])
        
        # Add deprecation warning if applicable
        deprecation_warning = self.versioning.get_deprecation_warning(version)
        if deprecation_warning:
            response.headers["Deprecation-Warning"] = deprecation_warning
        
        return response


def create_versioned_app() -> tuple[FastAPI, APIVersioning]:
    """Create FastAPI app with versioning support."""
    app = FastAPI(
        title="ClauseIQ API",
        description="Legal AI Document Analysis API",
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc"
    )
    
    versioning = APIVersioning()
    
    # Add versioning middleware
    middleware = VersioningMiddleware(versioning)
    app.middleware("http")(middleware)
    
    return app, versioning


def get_api_version(request: Request) -> APIVersion:
    """Get API version from request state."""
    return getattr(request.state, 'api_version', APIVersion.V1)


# Version-specific router creators
def create_v1_router(prefix: str = "", **kwargs) -> VersionedAPIRouter:
    """Create V1 API router."""
    return VersionedAPIRouter(
        version=APIVersion.V1,
        prefix=prefix,
        **kwargs
    )


def create_v2_router(prefix: str = "", **kwargs) -> VersionedAPIRouter:
    """Create V2 API router (future)."""
    return VersionedAPIRouter(
        version=APIVersion.V2,
        prefix=prefix,
        **kwargs
    )


# Decorator for version-specific endpoints
def version_specific(versions: List[APIVersion]):
    """Decorator to mark endpoints as version-specific."""
    def decorator(func: Callable) -> Callable:
        func._api_versions = versions
        return func
    return decorator


def api_version_required(version: APIVersion):
    """Decorator to require specific API version."""
    def decorator(func: Callable) -> Callable:
        async def wrapper(request: Request, *args, **kwargs):
            current_version = get_api_version(request)
            if current_version != version:
                raise HTTPException(
                    status_code=400,
                    detail=f"This endpoint requires API version {version.value}"
                )
            return await func(request, *args, **kwargs)
        return wrapper
    return decorator


class VersionedResponse:
    """Helper for creating version-aware responses."""
    
    @staticmethod
    def create_response(request: Request, data: Any, version_specific_data: Dict[APIVersion, Dict] = None):
        """Create response with version-specific data."""
        version = get_api_version(request)
        
        # Start with base data
        response_data = data.copy() if isinstance(data, dict) else data
        
        # Add version-specific data if available
        if version_specific_data and version in version_specific_data:
            if isinstance(response_data, dict):
                response_data.update(version_specific_data[version])
        
        return response_data


# Health check endpoint for API versioning
def create_version_info_router() -> APIRouter:
    """Create router for version information endpoints."""
    router = APIRouter(tags=["versioning"])
    
    @router.get("/api/versions")
    async def get_api_versions():
        """Get information about supported API versions."""
        return {
            "supported_versions": [v.value for v in APIVersion],
            "default_version": APIVersion.V1.value,
            "current_version": APIVersion.V1.value,
            "version_info": {
                "v1": {
                    "status": "stable",
                    "description": "Current stable API version"
                }
            }
        }
    
    return router
