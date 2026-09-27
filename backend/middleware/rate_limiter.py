"""
Rate limiting middleware for API protection.
"""
import time
from typing import Dict
from fastapi import Request, HTTPException
import hashlib
import logging
import re


logger = logging.getLogger(__name__)


class RateLimiter:
    """In-memory rate limiter for API protection."""

    def __init__(self):
        self.clients: Dict[str, Dict] = {}
        self.cleanup_interval = 3600  # Clean up old entries every hour
        self.last_cleanup = time.time()

    def get_client_key(self, request: Request) -> str:
        """Generate unique client identifier."""
        # Use the direct peer: this local installation has no trusted proxy.
        client_ip = get_real_client_ip(request)
        user_agent = request.headers.get("user-agent", "")

        # Local connection identification, without account state.
        identifier = f"{client_ip}:{hashlib.md5(user_agent.encode()).hexdigest()[:8]}"
        return f"ip:{identifier}"

    def is_allowed(self, key: str, limit: int, window: int) -> tuple[bool, Dict]:
        """Check if request is allowed under rate limit."""
        now = time.time()

        # Cleanup old entries periodically
        if now - self.last_cleanup > self.cleanup_interval:
            self._cleanup_old_entries(now)
            self.last_cleanup = now

        if key not in self.clients:
            self.clients[key] = {
                "count": 1,
                "window_start": now,
                "first_request": now
            }
            return True, {"remaining": limit - 1, "reset_time": now + window}

        client_data = self.clients[key]

        # Reset window if expired
        if now - client_data["window_start"] >= window:
            client_data["count"] = 1
            client_data["window_start"] = now
            return True, {"remaining": limit - 1, "reset_time": now + window}

        # Check if within limit
        if client_data["count"] < limit:
            client_data["count"] += 1
            remaining = limit - client_data["count"]
            reset_time = client_data["window_start"] + window
            return True, {"remaining": remaining, "reset_time": reset_time}

        # Rate limit exceeded
        reset_time = client_data["window_start"] + window
        return False, {"remaining": 0, "reset_time": reset_time}

    def _cleanup_old_entries(self, now: float):
        """Remove old entries to prevent memory bloat."""
        expired_keys = []
        for key, data in self.clients.items():
            if now - data.get("first_request", 0) > 86400:  # Remove entries older than 24h
                expired_keys.append(key)

        for key in expired_keys:
            del self.clients[key]


# Global rate limiter instance
rate_limiter = RateLimiter()


class RateLimitConfig:
    """Rate limit configuration for different endpoints."""

    # Default limits (requests per minute)
    DEFAULT = {"limit": 60, "window": 60}
    UPLOAD = {"limit": 10, "window": 60}  # Limited for file uploads
    AI_ANALYSIS = {"limit": 20, "window": 60}  # Limited for expensive AI operations


def _normalize_path(path: str) -> str:
    """Strip /api/v1 (or /api/vN) prefix so rate-limit rules match both versioned and unversioned paths (FND-006)."""
    return re.sub(r"^/api/v\d+(?=/|$)", "", path).rstrip("/")


def get_rate_limit_rule(method: str, path: str) -> tuple[str, Dict[str, int]]:
    """Choose a fixed operation bucket, never one per document or request ID."""
    path = _normalize_path(path)
    if method == "POST":
        if path in {"/documents/import", "/extract-text"}:
            return "upload", RateLimitConfig.UPLOAD
        # Legacy analyze accepts an upload, but also invokes paid AI, so it
        # shares the same AI budget as the other paid entry points.
        if path == "/analysis/analyze" or any(re.fullmatch(pattern, path) for pattern in (
            r"/analysis/clauses/[^/]+/rewrite",
            r"/documents/[^/]+/review-workspace/generate",
            r"/documents/[^/]+/review-workspace/runs/[^/]+/findings/[^/]+/ask",
            r"/chat/[^/]+/message",
            r"/library/semantic/documents/[^/]+/index",
            r"/library/semantic/search",
            r"/library/answers",
        )):
            return "ai", RateLimitConfig.AI_ANALYSIS
    return "default", RateLimitConfig.DEFAULT


def get_real_client_ip(request: Request) -> str:
    """Use the direct peer; local installations have no trusted proxy."""
    return request.client.host if request.client else "unknown"


async def rate_limit_middleware(request: Request, call_next):
    """Rate limiting middleware."""
    try:
        bucket, config = get_rate_limit_rule(request.method, request.url.path)

        # Check rate limit
        client_key = rate_limiter.get_client_key(request)
        allowed, info = rate_limiter.is_allowed(
            f"{client_key}:{bucket}",
            config["limit"],
            config["window"]
        )

        if not allowed:
            # Log rate limit exceeded to security monitor
            from middleware.security import security_monitor
            security_monitor.record_suspicious_activity(client_key, "rate_limit_exceeded")

            from fastapi.responses import JSONResponse
            from middleware.api_standardization import create_error_response
            return JSONResponse(status_code=429, content=create_error_response(
                code="RATE_LIMIT_EXCEEDED", message="Rate limit exceeded",
            ).model_dump(), headers={"Retry-After": str(max(1, int(info["reset_time"] - time.time())))})

        # Process request
        response = await call_next(request)

        # Add rate limit headers
        response.headers["X-RateLimit-Limit"] = str(config["limit"])
        response.headers["X-RateLimit-Remaining"] = str(info["remaining"])
        response.headers["X-RateLimit-Reset"] = str(int(info["reset_time"]))

        return response

    except HTTPException:
        raise
    except Exception as e:
        # Never repeat a handler after an error: it may already have spent AI
        # credits or changed stored data before raising.
        logger.error("Rate limit middleware failed: %s", type(e).__name__)
        raise
