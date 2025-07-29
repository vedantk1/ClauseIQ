from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from contextlib import asynccontextmanager
import json
from config.environments import get_environment_config
from routers import auth, documents, analysis, analytics, health, reports, chat
from routers import ai_debug as ai_debug_router
from middleware.rate_limiter import rate_limit_middleware
from middleware.logging import logging_middleware
from middleware.monitoring import performance_monitoring_middleware
from middleware.security import security_middleware
from middleware.api_standardization import add_api_standardization
from middleware.versioning import VersionedAPIRouter, APIVersion
from database.factory import get_database_factory
from config.logging import FoundationalLogger, get_foundational_logger

# 🚀 FOUNDATIONAL LOGGING: Configure once, use everywhere!
FoundationalLogger.configure(log_level="DEBUG", log_dir="logs")
logger = get_foundational_logger(__name__)

# 🤖 AI DEBUG INTEGRATION: Enhanced logging for AI assistant troubleshooting
from utils.ai_debug_helper import log_startup_diagnostics, ai_debug, DebugLevel

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management."""
    # Startup
    logger.info("Starting ClauseIQ Legal AI Backend...")
    
    # 🤖 LOG STARTUP FOR AI DEBUGGING
    log_startup_diagnostics()
    
    # 🤖 AI DEBUG: Log startup diagnostics for AI assistant reference
    ai_debug.log_system_event(
        event_type="BACKEND_STARTUP",
        level=DebugLevel.INFO,
        message="ClauseIQ backend startup initiated"
    )
    
    db_factory = get_database_factory()
    try:
        import asyncio
        # Add a timeout for DB initialization (e.g., 10 seconds)
        await asyncio.wait_for(db_factory.initialize(), timeout=10)
        
        ai_debug.log_system_event(
            event_type="DATABASE_INIT",
            level=DebugLevel.INFO,
            message="Database initialization completed successfully"
        )
    except Exception as e:
        ai_debug.log_system_event(
            event_type="DATABASE_INIT",
            level=DebugLevel.CRITICAL,
            message="Database initialization failed - system cannot start",
            error=e
        )
        logger.error(f"Database initialization failed: {e}")
        raise RuntimeError(f"Database initialization failed: {e}")
    try:
        is_healthy = await asyncio.wait_for(db_factory.health_check(), timeout=10)
    except Exception as e:
        ai_debug.log_system_event(
            event_type="DATABASE_HEALTH_CHECK",
            level=DebugLevel.CRITICAL,
            message="Database health check failed during startup",
            error=e
        )
        logger.error(f"Database health check failed: {e}")
        raise RuntimeError(f"Database health check failed: {e}")
    if not is_healthy:
        ai_debug.log_system_event(
            event_type="DATABASE_HEALTH_CHECK",
            level=DebugLevel.CRITICAL,
            message="Database health check returned unhealthy status"
        )
        logger.error("Database health check failed during startup")
        raise RuntimeError("Database connection failed")
    
    ai_debug.log_system_event(
        event_type="BACKEND_STARTUP_COMPLETE",
        level=DebugLevel.INFO,
        message="ClauseIQ backend startup completed successfully - all systems operational"
    )
    logger.info("Database connection established successfully")
    yield
    # Shutdown
    ai_debug.log_system_event(
        event_type="BACKEND_SHUTDOWN",
        level=DebugLevel.INFO,
        message="ClauseIQ backend shutdown initiated"
    )
    logger.info("Shutting down ClauseIQ Legal AI Backend...")
    
    # Enhanced connection lifecycle management
    try:
        # Close database connections with timeout
        await asyncio.wait_for(db_factory.close(), timeout=5)
        logger.info("Database connections closed successfully")
        
        ai_debug.log_system_event(
            event_type="DATABASE_SHUTDOWN",
            level=DebugLevel.INFO,
            message="Database connections closed successfully"
        )
    except asyncio.TimeoutError:
        logger.warning("Database shutdown timed out after 5 seconds")
        ai_debug.log_system_event(
            event_type="DATABASE_SHUTDOWN",
            level=DebugLevel.WARNING,
            message="Database shutdown timed out - forced cleanup"
        )
    except Exception as e:
        logger.error(f"Error during database shutdown: {e}")
        ai_debug.log_system_event(
            event_type="DATABASE_SHUTDOWN",
            level=DebugLevel.ERROR,
            message="Error occurred during database shutdown",
            error=e
        )
    
    # Reset OpenAI client to clean up any connections
    try:
        from services.ai.client_manager import reset_client
        reset_client()
        logger.info("AI client connections reset")
    except Exception as e:
        logger.warning(f"Error resetting AI client: {e}")
    
    ai_debug.log_system_event(
        event_type="BACKEND_SHUTDOWN_COMPLETE",
        level=DebugLevel.INFO,
        message="ClauseIQ backend shutdown completed"
    )
    logger.info("ClauseIQ shutdown completed")

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

# --- MOVE CORS MIDDLEWARE TO THE TOP (FIRST) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.server.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

# Include routers with versioning support
v1_router = VersionedAPIRouter(version=APIVersion.V1)
v1_router.include_router(auth.router)
v1_router.include_router(documents.router)
v1_router.include_router(analysis.router, prefix="/analysis")
v1_router.include_router(analytics.router)
v1_router.include_router(health.router)
v1_router.include_router(reports.router)
v1_router.include_router(chat.router, prefix="/chat")

# 🤖 AI DEBUG ROUTER: Special endpoints for AI assistant troubleshooting
v1_router.include_router(ai_debug_router.router)

app.include_router(v1_router)



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
            "Chat with Documents (RAG)",
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

# End of main application setup
