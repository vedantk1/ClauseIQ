from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from config.environments import get_environment_config
from routers import auth, documents, analysis, analytics, health
from middleware.rate_limiter import rate_limit_middleware
from middleware.logging import logging_middleware
from middleware.monitoring import performance_monitoring_middleware
from middleware.security import security_middleware
from middleware.api_standardization import add_api_standardization
from middleware.versioning import VersionedAPIRouter, APIVersion
from database.factory import get_database_factory
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configure special auth logger with file output
auth_logger = logging.getLogger("auth")
auth_logger.setLevel(logging.DEBUG)

# Console handler with special formatting for auth logs
auth_console_handler = logging.StreamHandler()
auth_console_handler.setLevel(logging.DEBUG)
auth_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
auth_console_handler.setFormatter(auth_formatter)
auth_logger.addHandler(auth_console_handler)

# Also log to file
try:
    auth_file_handler = logging.FileHandler('auth.log')
    auth_file_handler.setLevel(logging.DEBUG)
    auth_file_handler.setFormatter(auth_formatter)
    auth_logger.addHandler(auth_file_handler)
    logger.info("Auth logging to file enabled")
except Exception as e:
    logger.warning(f"Could not set up auth file logging: {str(e)}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management."""
    # Startup
    logger.info("Starting ClauseIQ Legal AI Backend...")
    
    # Initialize database connection
    db_factory = get_database_factory()
    await db_factory.initialize()
    
    # Health check
    is_healthy = await db_factory.health_check()
    if not is_healthy:
        logger.error("Database health check failed during startup")
        raise RuntimeError("Database connection failed")
    
    logger.info("Database connection established successfully")
    
    yield
    
    # Shutdown
    logger.info("Shutting down ClauseIQ Legal AI Backend...")
    await db_factory.close()
    logger.info("Database connections closed")

# Create FastAPI app
app = FastAPI(
    title="ClauseIQ Legal AI Backend", 
    version="1.0.0",
    description="Advanced legal document analysis with AI-powered clause detection and risk assessment",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Get environment configuration
config = get_environment_config()

# Add middleware in correct order (LIFO - Last In, First Out)
# Security middleware first (outermost layer)
app.middleware("http")(security_middleware)

# API standardization middleware for consistent responses
add_api_standardization(app)

# Rate limiting
app.middleware("http")(rate_limit_middleware)

# Performance monitoring
app.middleware("http")(performance_monitoring_middleware)

# Logging (innermost layer for complete request context)
app.middleware("http")(logging_middleware)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.server.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers with versioning support
v1_router = VersionedAPIRouter(version=APIVersion.V1)
v1_router.include_router(auth.router)
v1_router.include_router(documents.router)
v1_router.include_router(analysis.router)
v1_router.include_router(analytics.router)
v1_router.include_router(health.router)

app.include_router(v1_router)

# Also include routers without versioning for backward compatibility
app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(analysis.router)
app.include_router(analytics.router)
app.include_router(health.router)

@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "message": "ClaudeIQ Legal AI Backend",
        "version": "1.0.0",
        "environment": config.environment.value,
        "status": "operational",
        "api_versions": ["v1"],
        "docs": "/docs",
        "health": "/health",
        "features": [
            "Document Upload & Analysis",
            "AI-Powered Clause Detection", 
            "Risk Assessment",
            "User Authentication",
            "Performance Monitoring",
            "Security Hardening"
        ]
    }

@app.get("/health")
async def health():
    """Basic health check endpoint (legacy compatibility)."""
    return {"status": "healthy", "service": "ClauseIQ Legal AI Backend"}

@app.get("/health/detailed")
async def detailed_health():
    """Detailed health check including database status."""
    try:
        from database.migrations import get_migration_manager
        
        db_factory = get_database_factory()
        db_healthy = await db_factory.health_check()
        
        # Get migration status
        migration_status = None
        try:
            migration_manager = await get_migration_manager()
            migration_status = await migration_manager.get_migration_status()
        except Exception as e:
            logger.warning(f"Could not get migration status: {e}")
        
        return {
            "status": "healthy" if db_healthy else "unhealthy",
            "version": "1.0.0",
            "database": {
                "status": "connected" if db_healthy else "disconnected",
                "info": db_factory.get_connection_info()
            },
            "migrations": migration_status,
            "timestamp": db_factory.get_connection_info().get("last_health_check")
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "version": "1.0.0",
            "database": {"status": "error", "error": str(e)},
            "migrations": None,
            "error": str(e)
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
