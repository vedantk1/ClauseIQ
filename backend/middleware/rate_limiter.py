"""
Rate limiting middleware for API protection.
"""
import time
from typing import Dict, Optional
from fastapi import Request, HTTPException, status
from fastapi.responses import Response
import hashlib
import json


class RateLimiter:
    """In-memory rate limiter for API protection."""
    
    def __init__(self):
        self.clients: Dict[str, Dict] = {}
        self.cleanup_interval = 3600  # Clean up old entries every hour
        self.last_cleanup = time.time()
    
    def get_client_key(self, request: Request) -> str:
        """Generate unique client identifier."""
        # Use IP + User-Agent for anonymous users
        client_ip = request.client.host if request.client else "unknown"
        user_agent = request.headers.get("user-agent", "")
        
        # If authenticated, use user ID from JWT
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            try:
                from auth import verify_token
                token = auth_header.split(" ")[1]
                payload = verify_token(token)
                if payload:
                    return f"user:{payload.get('sub', 'unknown')}"
            except:
                pass
        
        # Fallback to IP-based identification
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
    AUTH = {"limit": 30, "window": 60}  # Allow more auth requests for login flows
    UPLOAD = {"limit": 10, "window": 60}  # Limited for file uploads
    AI_ANALYSIS = {"limit": 20, "window": 60}  # Limited for expensive AI operations
    AI_DEBUG = {"limit": 300, "window": 60}  # High limit for AI debug endpoints to prevent loops


async def rate_limit_middleware(request: Request, call_next):
    """Rate limiting middleware."""
    try:
        # Get rate limit config based on path
        path = request.url.path
        
        if path.startswith("/auth/"):
            config = RateLimitConfig.AUTH
        elif path.startswith("/documents/") and request.method == "POST":
            config = RateLimitConfig.UPLOAD
        elif path.startswith("/analysis/"):
            config = RateLimitConfig.AI_ANALYSIS
        elif path.startswith("/api/v1/ai-debug/") or path.startswith("/ai-debug/"):
            config = RateLimitConfig.AI_DEBUG
        else:
            config = RateLimitConfig.DEFAULT
        
        # Check rate limit
        client_key = rate_limiter.get_client_key(request)
        allowed, info = rate_limiter.is_allowed(
            client_key, 
            config["limit"], 
            config["window"]
        )
        
        if not allowed:
            # Log rate limit exceeded to security monitor
            from middleware.security import security_monitor
            security_monitor.record_suspicious_activity(client_key, "rate_limit_exceeded")
            
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "error": "Rate limit exceeded",
                    "limit": config["limit"],
                    "window": config["window"],
                    "reset_time": info["reset_time"]
                }
            )
        
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
        # Log error but don't block requests
        print(f"Rate limit middleware error: {e}")
        return await call_next(request)
