"""
Authentication service for ClauseIQ.

Handles user authentication, registration, password management, and token operations.
This service extracts business logic from auth router for better maintainability and testability.
"""
import uuid
import logging
from typing import Dict, Optional, Tuple
from auth import (
    get_password_hash, 
    verify_password, 
    create_access_token, 
    create_refresh_token,
    create_password_reset_token,
    verify_password_reset_token,
    validate_password,
    Token
)
from email_service import send_password_reset_email
from database.service import get_document_service

logger = logging.getLogger(__name__)


class AuthService:
    """Service for handling authentication operations."""
    
    def __init__(self):
        self.document_service = get_document_service()
    
    async def register_user(self, full_name: str, email: str, password: str) -> Tuple[bool, Optional[Token], Optional[str]]:
        """
        Register a new user and return authentication tokens.
        
        Args:
            full_name: User's full name
            email: User's email address
            password: Plain text password
            
        Returns:
            Tuple of (success, token_data, error_message)
        """
        try:
            # Check if user already exists
            existing_user = await self.document_service.get_user_by_email(email)
            if existing_user:
                return False, None, "User with this email already exists"
            
            # Hash password
            hashed_password = get_password_hash(password)
            
            # Create user data
            user_id = str(uuid.uuid4())
            user_dict = {
                "id": user_id,
                "email": email,
                "hashed_password": hashed_password,
                "full_name": full_name
            }
            
            # Save user to database
            await self.document_service.create_user(user_dict)
            
            # Create tokens for immediate login after registration
            access_token = create_access_token(data={"sub": user_id})
            refresh_token = create_refresh_token(data={"sub": user_id})
            
            token_data = Token(
                access_token=access_token,
                refresh_token=refresh_token,
                token_type="bearer"
            )
            
            logger.info(f"✅ User registered successfully: {email}")
            return True, token_data, None
            
        except Exception as e:
            logger.error(f"❌ Registration failed for {email}: {e}")
            return False, None, f"Registration failed: {str(e)}"
    
    async def authenticate_user(
        self, 
        email: str, 
        password: str, 
        client_ip: str = "unknown"
    ) -> Tuple[bool, Optional[Token], Optional[str]]:
        """
        Authenticate user and return tokens.
        
        Args:
            email: User's email address
            password: Plain text password
            client_ip: Client IP address for security monitoring
            
        Returns:
            Tuple of (success, token_data, error_message)
        """
        from middleware.security import security_monitor
        import time
        
        login_id = str(uuid.uuid4())[:8]
        start_time = time.time()
        
        try:
            logger.info(f"[AUTH-{login_id}] 🔑 Login attempt for: {email}")
            
            # Get user by email
            user = await self.document_service.get_user_by_email(email)
            if not user:
                logger.warning(f"[AUTH-{login_id}] ❌ User not found: {email}")
                security_monitor.record_auth_failure(client_ip, email)
                return False, None, "Invalid email or password"
            
            # Verify password
            if not verify_password(password, user["hashed_password"]):
                logger.warning(f"[AUTH-{login_id}] ❌ Password verification failed")
                security_monitor.record_auth_failure(client_ip, email)
                return False, None, "Invalid email or password"
            
            logger.info(f"[AUTH-{login_id}] ✅ Password verified successfully")
            
            # Create tokens
            access_token = create_access_token(data={"sub": user["id"]})
            refresh_token = create_refresh_token(data={"sub": user["id"]})
            
            # Create user info object (exclude password)
            user_info = {k: v for k, v in user.items() if k not in ["hashed_password"]}
            
            token_data = Token(
                access_token=access_token,
                refresh_token=refresh_token,
                token_type="bearer",
                user=user_info
            )
            
            elapsed = time.time() - start_time
            logger.info(f"[AUTH-{login_id}] 🎉 Login successful in {elapsed:.2f}s")
            return True, token_data, None
            
        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(f"[AUTH-{login_id}] 💥 Login error in {elapsed:.2f}s: {e}")
            return False, None, f"Login failed: {str(e)}"
    
    async def initiate_password_reset(self, email: str) -> Tuple[bool, Optional[str]]:
        """
        Initiate password reset process by sending reset email.
        
        Args:
            email: User's email address
            
        Returns:
            Tuple of (success, error_message)
        """
        try:
            # Check if user exists
            user = await self.document_service.get_user_by_email(email)
            if not user:
                # Don't reveal if email exists or not for security
                # Return success even if user doesn't exist
                logger.info(f"Password reset requested for non-existent email: {email}")
                return True, None
            
            # Create password reset token
            reset_token = create_password_reset_token(email)
            
            # Send password reset email
            await send_password_reset_email(email, reset_token)
            
            logger.info(f"✅ Password reset email sent to: {email}")
            return True, None
            
        except Exception as e:
            logger.error(f"❌ Password reset failed for {email}: {e}")
            return False, f"Password reset failed: {str(e)}"
    
    async def reset_password(self, token: str, new_password: str) -> Tuple[bool, Optional[str]]:
        """
        Reset user password using reset token.
        
        Args:
            token: Password reset token
            new_password: New password (plain text)
            
        Returns:
            Tuple of (success, error_message)
        """
        try:
            # Verify reset token
            email = verify_password_reset_token(token)
            if not email:
                return False, "Invalid or expired reset token"
            
            # Validate new password
            if not validate_password(new_password):
                return False, "Password does not meet requirements"
            
            # Get user by email
            user = await self.document_service.get_user_by_email(email)
            if not user:
                return False, "User not found"
            
            # Hash new password and update user
            hashed_password = get_password_hash(new_password)
            success = await self.document_service.update_user_password(user["id"], hashed_password)
            
            if not success:
                return False, "Failed to update password"
            
            logger.info(f"✅ Password reset successful for: {email}")
            return True, None
            
        except Exception as e:
            logger.error(f"❌ Password reset error: {e}")
            return False, f"Password reset failed: {str(e)}"


# Global service instance
_auth_service = None

def get_auth_service() -> AuthService:
    """Get the global auth service instance."""
    global _auth_service
    if _auth_service is None:
        _auth_service = AuthService()
    return _auth_service
