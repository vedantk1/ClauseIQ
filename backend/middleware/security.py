"""
Security middleware for additional protection and hardening.
"""
import time
import hashlib
import secrets
from typing import Dict, Set, Optional
from fastapi import Request, HTTPException, status
from fastapi.responses import Response
import re
import json


class SecurityHeaders:
    """Security headers configuration."""
    
    @staticmethod
    def get_security_headers(is_development: bool = False) -> Dict[str, str]:
        """Get recommended security headers with environment-aware CSP."""
        
        # Development CSP allows external resources needed for Swagger UI
        if is_development:
            csp_policy = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
                "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; "
                "img-src 'self' data: https://fastapi.tiangolo.com; "
                "font-src 'self' https://fonts.gstatic.com; "
                "frame-ancestors 'none';"
            )
        else:
            # Production CSP is more restrictive
            csp_policy = "default-src 'self'; frame-ancestors 'none';"
        
        return {
            # Prevent clickjacking
            "X-Frame-Options": "DENY",
            
            # XSS protection
            "X-XSS-Protection": "1; mode=block",
            
            # Content type sniffing protection
            "X-Content-Type-Options": "nosniff",
            
            # Referrer policy
            "Referrer-Policy": "strict-origin-when-cross-origin",
            
            # Content Security Policy (environment-aware)
            "Content-Security-Policy": csp_policy,
            
            # HSTS (if using HTTPS)
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
            
            # Remove server information
            "Server": "ClauseIQ-API"
        }


class InputValidator:
    """Input validation and sanitization."""
    
    # Common attack patterns
    SQL_INJECTION_PATTERNS = [
        r"(\s*(union|select|insert|update|delete|drop|create|alter|exec|execute)\s+)",
        r"(\s*(or|and)\s+\d+\s*=\s*\d+)",
        r"(\s*;\s*(drop|delete|update|insert)\s+)",
        r"(\'\s*(or|and)\s+\d+\s*=\s*\d+)",
    ]
    
    XSS_PATTERNS = [
        r"<script[^>]*>.*?</script>",
        r"javascript:",
        r"vbscript:",
        r"onload\s*=",
        r"onerror\s*=",
        r"onclick\s*=",
    ]
    
    PATH_TRAVERSAL_PATTERNS = [
        r"\.\./",
        r"\.\.\\",
        r"%2e%2e%2f",
        r"%2e%2e/",
        r"..%2f",
        r"%2e%2e%5c",
    ]
    
    @classmethod
    def check_for_sql_injection(cls, text: str) -> bool:
        """Check for SQL injection patterns."""
        text_lower = text.lower()
        for pattern in cls.SQL_INJECTION_PATTERNS:
            if re.search(pattern, text_lower, re.IGNORECASE):
                return True
        return False
    
    @classmethod
    def check_for_xss(cls, text: str) -> bool:
        """Check for XSS patterns."""
        text_lower = text.lower()
        for pattern in cls.XSS_PATTERNS:
            if re.search(pattern, text_lower, re.IGNORECASE):
                return True
        return False
    
    @classmethod
    def check_for_path_traversal(cls, text: str) -> bool:
        """Check for path traversal patterns."""
        for pattern in cls.PATH_TRAVERSAL_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE):
                return True
        return False
    
    @classmethod
    def validate_input(cls, text: str) -> Dict[str, bool]:
        """Comprehensive input validation."""
        return {
            "sql_injection": cls.check_for_sql_injection(text),
            "xss": cls.check_for_xss(text),
            "path_traversal": cls.check_for_path_traversal(text),
        }


class SecurityMonitor:
    """Monitor and track security-related events."""
    
    def __init__(self):
        self.suspicious_ips: Dict[str, Dict] = {}
        self.blocked_ips: Set[str] = set()
        self.failed_auth_attempts: Dict[str, int] = {}
        self.cleanup_interval = 3600  # Clean up every hour
        self.last_cleanup = time.time()
    
    def record_suspicious_activity(self, ip: str, activity_type: str):
        """Record suspicious activity from an IP."""
        now = time.time()
        
        if ip not in self.suspicious_ips:
            self.suspicious_ips[ip] = {
                "first_seen": now,
                "last_seen": now,
                "activity_count": 0,
                "activities": []
            }
        
        self.suspicious_ips[ip]["last_seen"] = now
        self.suspicious_ips[ip]["activity_count"] += 1
        self.suspicious_ips[ip]["activities"].append({
            "type": activity_type,
            "timestamp": now
        })
        
        # Auto-block if too many suspicious activities
        if self.suspicious_ips[ip]["activity_count"] >= 10:
            self.blocked_ips.add(ip)
            from middleware.logging import security_logger
            security_logger.log_suspicious_activity("ip_auto_blocked", {
                "ip": ip,
                "activity_count": self.suspicious_ips[ip]["activity_count"],
                "reason": "excessive_suspicious_activities"
            })
    
    def record_auth_failure(self, ip: str, email: str):
        """Record authentication failure."""
        key = f"{ip}:{email}"
        self.failed_auth_attempts[key] = self.failed_auth_attempts.get(key, 0) + 1
        
        # Block after 5 failed attempts
        if self.failed_auth_attempts[key] >= 5:
            self.blocked_ips.add(ip)
            from middleware.logging import security_logger
            security_logger.log_auth_failure(email, ip, "too_many_failures")
    
    def is_ip_blocked(self, ip: str) -> bool:
        """Check if IP is blocked."""
        return ip in self.blocked_ips
    
    def cleanup_old_data(self):
        """Clean up old monitoring data."""
        now = time.time()
        
        # Remove old suspicious IP data (older than 24 hours)
        expired_ips = []
        for ip, data in self.suspicious_ips.items():
            if now - data["last_seen"] > 86400:
                expired_ips.append(ip)
        
        for ip in expired_ips:
            del self.suspicious_ips[ip]
            self.blocked_ips.discard(ip)
        
        # Clean up old auth failure records
        expired_attempts = []
        for key, count in self.failed_auth_attempts.items():
            # Remove after 1 hour of no activity
            if now - time.time() > 3600:  # This is simplified - in production, track timestamps
                expired_attempts.append(key)
        
        for key in expired_attempts:
            del self.failed_auth_attempts[key]


# Global security monitor
security_monitor = SecurityMonitor()


async def security_middleware(request: Request, call_next):
    """Comprehensive security middleware."""
    client_ip = request.client.host if request.client else "unknown"
    
    try:
        # Check if IP is blocked
        if security_monitor.is_ip_blocked(client_ip):
            from middleware.logging import security_logger
            security_logger.log_suspicious_activity("blocked_ip_attempt", {
                "ip": client_ip,
                "path": request.url.path,
                "method": request.method
            })
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Validate request size
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > 10 * 1024 * 1024:  # 10MB limit
            security_monitor.record_suspicious_activity(client_ip, "large_request")
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Request too large"
            )
        
        # Check for suspicious patterns in URL
        url_path = str(request.url.path)
        validation_results = InputValidator.validate_input(url_path)
        
        if any(validation_results.values()):
            security_monitor.record_suspicious_activity(client_ip, "malicious_input")
            from middleware.logging import security_logger
            security_logger.log_suspicious_activity("malicious_input_detected", {
                "ip": client_ip,
                "path": url_path,
                "validation_results": validation_results
            })
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid request"
            )
        
        # Check for suspicious headers
        user_agent = request.headers.get("user-agent", "")
        if not user_agent or len(user_agent) < 10:
            security_monitor.record_suspicious_activity(client_ip, "suspicious_user_agent")
        
        # Process request
        response = await call_next(request)
        
        # Add security headers with environment awareness
        from config.environments import get_environment_config
        config = get_environment_config()
        is_development = config.is_development()
        
        security_headers = SecurityHeaders.get_security_headers(is_development=is_development)
        for header, value in security_headers.items():
            response.headers[header] = value
        
        # Periodic cleanup
        if time.time() - security_monitor.last_cleanup > security_monitor.cleanup_interval:
            security_monitor.cleanup_old_data()
            security_monitor.last_cleanup = time.time()
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        # Log security middleware errors
        from middleware.logging import security_logger
        security_logger.log_suspicious_activity("security_middleware_error", {
            "ip": client_ip,
            "error": str(e),
            "path": request.url.path
        })
        raise


class CSRFProtection:
    """CSRF protection for state-changing operations."""
    
    def __init__(self):
        self.tokens: Dict[str, float] = {}
        self.token_lifetime = 3600  # 1 hour
    
    def generate_token(self, user_id: str) -> str:
        """Generate CSRF token for user."""
        token = secrets.token_urlsafe(32)
        self.tokens[token] = time.time()
        return token
    
    def validate_token(self, token: str) -> bool:
        """Validate CSRF token."""
        if token not in self.tokens:
            return False
        
        # Check if token is expired
        if time.time() - self.tokens[token] > self.token_lifetime:
            del self.tokens[token]
            return False
        
        return True
    
    def cleanup_expired_tokens(self):
        """Remove expired tokens."""
        now = time.time()
        expired_tokens = [
            token for token, timestamp in self.tokens.items()
            if now - timestamp > self.token_lifetime
        ]
        
        for token in expired_tokens:
            del self.tokens[token]


# Global CSRF protection instance
csrf_protection = CSRFProtection()
