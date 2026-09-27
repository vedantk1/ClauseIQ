from fastapi import FastAPI, Security
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from config.environments import get_environment_config
from config.logging import FoundationalLogger, get_foundational_logger

# Startup owns logging; retrieving a module logger has no configuration side effects.
FoundationalLogger.configure(log_level="INFO", log_dir="logs")
logger = get_foundational_logger(__name__)

from routers import documents, analysis, health, reports, chat, app_config, workspace, review_workspace, library_search, library_semantic
from middleware.local_access import local_access_middleware
from middleware.rate_limiter import rate_limit_middleware
from middleware.logging import logging_middleware
from middleware.monitoring import performance_monitoring_middleware
from middleware.security import security_middleware
from middleware.api_standardization import add_api_standardization
from middleware.versioning import VersionedAPIRouter, APIVersion
from database.factory import get_database_factory
from utils.ai_debug_helper import log_startup_diagnostics, ai_debug, DebugLevel

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management."""
    # Startup
    logger.info("Starting ClauseIQ Legal AI Backend...")

    log_startup_diagnostics()

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
    except Exception as error:
        ai_debug.log_system_event(
            event_type="DATABASE_INIT",
            level=DebugLevel.CRITICAL,
            message="Database initialization failed - system cannot start",
            context={
                "operation": "database.initialize",
                "status": "error",
                "error_type": error.__class__.__name__,
            },
        )
        logger.error(
            "Application lifecycle event "
            "(operation=database_initialize, stage=startup, status=error, error_type=%s)",
            error.__class__.__name__,
        )
        raise RuntimeError("Database initialization failed") from None
    try:
        is_healthy = await asyncio.wait_for(db_factory.health_check(), timeout=10)
    except Exception as error:
        ai_debug.log_system_event(
            event_type="DATABASE_HEALTH_CHECK",
            level=DebugLevel.CRITICAL,
            message="Database health check failed during startup",
            context={
                "operation": "database.health_check",
                "status": "error",
                "error_type": error.__class__.__name__,
            },
        )
        logger.error(
            "Application lifecycle event "
            "(operation=database_health_check, stage=startup, status=error, error_type=%s)",
            error.__class__.__name__,
        )
        raise RuntimeError("Database health check failed") from None
    if not is_healthy:
        ai_debug.log_system_event(
            event_type="DATABASE_HEALTH_CHECK",
            level=DebugLevel.CRITICAL,
            message="Database health check returned unhealthy status"
        )
        logger.error(
            "Application lifecycle event "
            "(operation=database_health_check, stage=startup, status=unhealthy)"
        )
        raise RuntimeError("Database connection failed")

    ai_debug.log_system_event(
        event_type="BACKEND_STARTUP_COMPLETE",
        level=DebugLevel.INFO,
        message="ClauseIQ backend startup completed successfully - all systems operational"
    )
    logger.info("Database connection established successfully")

    # Preflight ownership across all stores before any migration or cleanup.
    from services.workspace_binding import ensure_workspace_database_binding
    await ensure_workspace_database_binding(get_environment_config(), await db_factory.get_database())
    from database.workspace_migration import initialize_workspace
    from services.workspace_service import get_workspace_service
    migration = await initialize_workspace()
    await get_workspace_service().initialize_credentials(migration["legacy_user_id"])

    # Run document cleanup on startup (fire-and-forget background task)
    try:
        from services.cleanup_service import run_startup_cleanup
        cleanup_task = asyncio.create_task(run_startup_cleanup())
        logger.info("Document cleanup task scheduled")
    except Exception as error:
        logger.warning(
            "Application lifecycle event "
            "(operation=document_cleanup, stage=startup, status=error, error_type=%s)",
            error.__class__.__name__,
        )

    try:
        yield
    finally:
        if "cleanup_task" in locals():
            cleanup_task.cancel()
            from contextlib import suppress
            with suppress(asyncio.CancelledError):
                await cleanup_task
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
    except Exception as error:
        logger.error(
            "Application lifecycle event "
            "(operation=database_close, stage=shutdown, status=error, error_type=%s)",
            error.__class__.__name__,
        )
        ai_debug.log_system_event(
            event_type="DATABASE_SHUTDOWN",
            level=DebugLevel.ERROR,
            message="Error occurred during database shutdown",
            context={
                "operation": "database.close",
                "status": "error",
                "error_type": error.__class__.__name__,
            },
        )

    # Reset OpenAI client to clean up any connections
    try:
        from services.ai.client_manager import reset_client
        reset_client()
        logger.info("AI client connections reset")
    except Exception as error:
        logger.warning(
            "Application lifecycle event "
            "(operation=ai_client_reset, stage=shutdown, status=error, error_type=%s)",
            error.__class__.__name__,
        )

    ai_debug.log_system_event(
        event_type="BACKEND_SHUTDOWN_COMPLETE",
        level=DebugLevel.INFO,
        message="ClauseIQ backend shutdown completed"
    )
    logger.info("ClauseIQ shutdown completed")

# Create FastAPI app
# Preserve the production guard on interactive API documentation.
config = get_environment_config()
_is_production = config.is_production()

app = FastAPI(
    title="ClauseIQ Legal AI Backend",
    version="1.0.0",
    description="Local, evidence-first agreement review with original PDFs, saved questions and explicit AI requests.",
    docs_url=None if _is_production else "/docs",
    redoc_url=None if _is_production else "/redoc",
    openapi_url=None if _is_production else "/openapi.json",
    lifespan=lifespan
)

# Get environment configuration (already loaded above)

# Add middleware in correct order (LIFO - Last In, First Out)
# Security middleware is inside the request-logging layer.
app.middleware("http")(security_middleware)

# API standardization middleware for consistent responses
add_api_standardization(app)

# Rate limiting
app.middleware("http")(rate_limit_middleware)

# Performance monitoring
app.middleware("http")(performance_monitoring_middleware)

# Logging wraps admitted application requests; the local boundary stays outside.
app.middleware("http")(logging_middleware)

# Outermost gate runs before logging, parsing uploads, database or AI work.
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.server.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-ClauseIQ-Local"],
)
app.middleware("http")(local_access_middleware(config.server.cors_origins))

# Include routers with versioning support
local_marker = APIKeyHeader(name="X-ClauseIQ-Local", auto_error=False,
                           description="Local browser marker: enter 1. Not an account credential.")
v1_router = VersionedAPIRouter(version=APIVersion.V1, dependencies=[Security(local_marker)])
v1_router.include_router(workspace.router)
v1_router.include_router(documents.router)
v1_router.include_router(library_search.router)
v1_router.include_router(library_semantic.router)
v1_router.include_router(review_workspace.router)
v1_router.include_router(analysis.router, prefix="/analysis")
v1_router.include_router(health.router)
v1_router.include_router(reports.router)
v1_router.include_router(chat.router, prefix="/chat")

# Non-sensitive presentation configuration, behind the same local boundary.
v1_router.include_router(app_config.router)

app.include_router(v1_router)



@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "message": "ClauseIQ Legal AI Backend",
        "version": "1.0.0",
        "environment": config.environment.value,
        "status": "operational",
        "api_versions": ["v1"],
        "docs": "/docs",
        "health": "/health",
        "features": [
            "Single-person Local Workspace",
            "Local PDF Import and Original-page Reading",
            "Evidence-linked Agreement Reviews",
            "Finding-scoped Ask",
            "Saved Questions and Personal Review Markers",
            "Retained Legacy Analysis and Document Chat"
        ]
    }

@app.get("/health")
async def health():
    """Basic health check endpoint (legacy compatibility)."""
    return {"status": "healthy", "service": "ClauseIQ Legal AI Backend"}

# End of main application setup
