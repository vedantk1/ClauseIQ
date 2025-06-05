from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from settings import get_settings
from routers import auth, documents, analysis, analytics, health
from middleware.rate_limiter import rate_limit_middleware
from middleware.logging import logging_middleware
from middleware.monitoring import performance_monitoring_middleware
from middleware.security import security_middleware

# Create FastAPI app
app = FastAPI(
    title="ClauseIQ Legal AI Backend", 
    version="1.0.0",
    description="Advanced legal document analysis with AI-powered clause detection and risk assessment",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Get settings instance
settings = get_settings()

# Add middleware in correct order (LIFO - Last In, First Out)
# Security middleware first (outermost layer)
app.middleware("http")(security_middleware)

# Rate limiting
app.middleware("http")(rate_limit_middleware)

# Performance monitoring
app.middleware("http")(performance_monitoring_middleware)

# Logging (innermost layer for complete request context)
app.middleware("http")(logging_middleware)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.server.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(analysis.router)
app.include_router(analytics.router)
app.include_router(health.router)

@app.get("/")
async def root():
    """Root endpoint with enhanced information."""
    return {
        "message": "ClauseIQ Legal AI Backend is running",
        "version": "1.0.0",
        "status": "healthy",
        "features": [
            "Document Upload & Analysis",
            "AI-Powered Clause Detection", 
            "Risk Assessment",
            "User Authentication",
            "Performance Monitoring",
            "Security Hardening"
        ],
        "endpoints": {
            "docs": "/docs",
            "health": "/health/detailed",
            "metrics": "/health/metrics"
        }
    }


@app.get("/health")
async def health():
    """Basic health check endpoint (legacy compatibility)."""
    return {"status": "healthy", "service": "ClauseIQ Legal AI Backend"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
