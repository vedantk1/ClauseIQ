"""
Authentication and user management routes.
"""
import uuid
from fastapi import APIRouter, HTTPException, Depends, Request
from database.service import get_document_service
from middleware.api_standardization import APIResponse, ErrorResponse, create_error_response
from middleware.versioning import versioned_response
from email_service import send_password_reset_email
from auth import (
    create_access_token,
    create_refresh_token,
    verify_token,
    get_password_hash,
    verify_password,
    get_current_user,
    UserCreate,
    UserLogin,
    UserResponse,
    UserProfileUpdate,
    Token,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    create_password_reset_token,
    verify_password_reset_token,
    validate_password
)
from models.auth import (
    RefreshTokenRequest,
    UserPreferencesRequest,
    UserPreferencesResponse,
    AvailableModelsResponse
)


router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/register", response_model=APIResponse[Token])
async def register(user_data: UserCreate):
    """Register a new user and return authentication tokens."""
    try:
        service = get_document_service()
        
        # Check if user already exists
        existing_user = await service.get_user_by_email(user_data.email)
        if existing_user:
            return create_error_response(
                code="USER_EXISTS",
                message="User with this email already exists"
            )
        
        # Hash password
        hashed_password = get_password_hash(user_data.password)
        
        # Create user data
        user_id = str(uuid.uuid4())
        user_dict = {
            "id": user_id,
            "email": user_data.email,
            "hashed_password": hashed_password,
            "full_name": user_data.full_name
        }
        
        # Save user to database
        await service.create_user(user_dict)
        
        # Create tokens for immediate login after registration
        access_token = create_access_token(data={"sub": user_id})
        refresh_token = create_refresh_token(data={"sub": user_id})
        
        token_data = Token(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer"
        )
        
        return APIResponse(
            success=True,
            data=token_data,
            message="User registered successfully"
        )
        
    except Exception as e:
        return create_error_response(
            code="REGISTRATION_FAILED",
            message=f"Registration failed: {str(e)}"
        )


@router.post("/login", response_model=APIResponse[Token])
async def login(user_data: UserLogin, request: Request):
    """Authenticate user and return tokens."""
    from middleware.security import security_monitor
    import logging
    import time
    import uuid
    
    # Generate a unique ID for this login attempt
    login_id = str(uuid.uuid4())[:8]
    start_time = time.time()
    logger = logging.getLogger("auth")
    
    logger.info(f"[AUTH-{login_id}] 🔑 Login attempt started for email: {user_data.email}")
    client_ip = request.client.host if request.client else "unknown"
    logger.info(f"[AUTH-{login_id}] 🌐 Client IP: {client_ip}")
    
    try:
        logger.info(f"[AUTH-{login_id}] 🔄 Getting document service")
        service = get_document_service()
        
        # Get user by email
        logger.info(f"[AUTH-{login_id}] 🔍 Looking up user by email: {user_data.email}")
        user = await service.get_user_by_email(user_data.email)
        if not user:
            logger.warning(f"[AUTH-{login_id}] ❌ User not found: {user_data.email}")
            # Record failed authentication attempt
            security_monitor.record_auth_failure(client_ip, user_data.email)
            logger.info(f"[AUTH-{login_id}] ⏱️ Login failed in {time.time() - start_time:.2f}s - user not found")
            return create_error_response(
                code="INVALID_CREDENTIALS",
                message="Invalid email or password"
            )
        
        # Verify password
        logger.info(f"[AUTH-{login_id}] 🔐 Verifying password for user: {user_data.email}")
        if not verify_password(user_data.password, user["hashed_password"]):
            logger.warning(f"[AUTH-{login_id}] ❌ Password verification failed for: {user_data.email}")
            # Record failed authentication attempt
            security_monitor.record_auth_failure(client_ip, user_data.email)
            logger.info(f"[AUTH-{login_id}] ⏱️ Login failed in {time.time() - start_time:.2f}s - invalid password")
            return create_error_response(
                code="INVALID_CREDENTIALS",
                message="Invalid email or password"
            )
        
        logger.info(f"[AUTH-{login_id}] ✅ Password verified successfully")
        
        # Create tokens
        logger.info(f"[AUTH-{login_id}] 🔄 Creating access and refresh tokens")
        access_token = create_access_token(data={"sub": user["id"]})
        refresh_token = create_refresh_token(data={"sub": user["id"]})
        
        logger.info(f"[AUTH-{login_id}] 🎟️ Tokens created successfully")
        
        # Create user info object
        user_info = {k: v for k, v in user.items() if k not in ["hashed_password"]}
        
        token_data = Token(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            user=user_info  # Include user data in response
        )
        
        logger.info(f"[AUTH-{login_id}] 🎉 Login successful for {user_data.email}")
        logger.info(f"[AUTH-{login_id}] ⏱️ Login completed in {time.time() - start_time:.2f}s")
        
        return APIResponse(
            success=True,
            data=token_data,
            message="Login successful"
        )
        
    except Exception as e:
        logger.error(f"[AUTH-{login_id}] 💥 Login error: {str(e)}", exc_info=True)
        logger.info(f"[AUTH-{login_id}] ⏱️ Login failed in {time.time() - start_time:.2f}s - exception")
        return create_error_response(
            code="LOGIN_FAILED",
            message=f"Login failed: {str(e)}"
        )


@router.post("/refresh", response_model=APIResponse[Token])
async def refresh_access_token(request: RefreshTokenRequest):
    """Refresh access token using refresh token."""
    try:
        # Verify refresh token
        payload = verify_token(request.refresh_token)
        if not payload:
            return create_error_response(
                code="INVALID_REFRESH_TOKEN",
                message="Invalid refresh token"
            )
        
        user_id = payload.get("sub")
        if not user_id:
            return create_error_response(
                code="INVALID_REFRESH_TOKEN",
                message="Invalid refresh token"
            )
        
        # Create new tokens
        access_token = create_access_token(data={"sub": user_id})
        refresh_token = create_refresh_token(data={"sub": user_id})
        
        token_data = Token(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer"
        )
        
        return APIResponse(
            success=True,
            data=token_data,
            message="Token refreshed successfully"
        )
        
    except Exception as e:
        return create_error_response(
            code="TOKEN_REFRESH_FAILED",
            message=f"Token refresh failed: {str(e)}"
        )


@router.get("/me", response_model=APIResponse[UserResponse])
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current user information."""
    user_data = UserResponse(
        id=current_user["id"],
        full_name=current_user["full_name"],
        email=current_user["email"]
    )
    
    return APIResponse(
        success=True,
        data=user_data,
        message="User information retrieved successfully"
    )


@router.post("/forgot-password", response_model=APIResponse[dict])
async def forgot_password(request: ForgotPasswordRequest):
    """Send password reset email to user."""
    try:
        service = get_document_service()
        
        # Check if user exists
        user = await service.get_user_by_email(request.email)
        if not user:
            # Don't reveal if email exists or not for security
            return APIResponse(
                success=True,
                data={"message": "If the email exists, a password reset link has been sent"},
                message="Password reset email sent"
            )
        
        # Create password reset token
        reset_token = create_password_reset_token(request.email)
        
        # Send password reset email
        await send_password_reset_email(request.email, reset_token)
        
        return APIResponse(
            success=True,
            data={"message": "If the email exists, a password reset link has been sent"},
            message="Password reset email sent"
        )
        
    except Exception as e:
        return create_error_response(
            code="PASSWORD_RESET_FAILED",
            message=f"Password reset failed: {str(e)}"
        )


@router.post("/reset-password", response_model=APIResponse[dict])
async def reset_password(request: ResetPasswordRequest):
    """Reset user password using reset token."""
    try:
        # Verify reset token
        email = verify_password_reset_token(request.token)
        if not email:
            return create_error_response(
                code="INVALID_RESET_TOKEN",
                message="Invalid or expired reset token"
            )
        
        # Validate new password
        if not validate_password(request.new_password):
            return create_error_response(
                code="INVALID_PASSWORD",
                message="Password does not meet requirements"
            )
        
        service = get_document_service()
        
        # Get user by email
        user = await service.get_user_by_email(email)
        if not user:
            return create_error_response(
                code="USER_NOT_FOUND",
                message="User not found"
            )
        
        # Hash new password and update user
        hashed_password = get_password_hash(request.new_password)
        success = await service.update_user_password(user["id"], hashed_password)
        
        if not success:
            return create_error_response(
                code="PASSWORD_UPDATE_FAILED",
                message="Failed to update password"
            )
        
        return APIResponse(
            success=True,
            data={"message": "Password reset successfully"},
            message="Password reset successfully"
        )
        
    except Exception as e:
        return create_error_response(
            code="PASSWORD_RESET_FAILED",
            message=f"Password reset failed: {str(e)}"
        )


@router.get("/preferences", response_model=APIResponse[UserPreferencesResponse])
async def get_user_preferences(current_user: dict = Depends(get_current_user)):
    """Get user's preferences including preferred AI model."""
    try:
        from ai_models.models import AIModelConfig
        service = get_document_service()
        
        # Get user's preferred model
        preferred_model = await service.get_user_preferred_model(current_user["id"])
        
        preferences_data = UserPreferencesResponse(
            preferred_model=preferred_model,
            available_models=AIModelConfig.get_model_ids()
        )
        
        return APIResponse(
            success=True,
            data=preferences_data,
            message="User preferences retrieved successfully"
        )
        
    except Exception as e:
        return create_error_response(
            code="PREFERENCES_FETCH_FAILED",
            message=f"Failed to get user preferences: {str(e)}"
        )


@router.put("/preferences", response_model=APIResponse[dict])
async def update_user_preferences(
    preferences: UserPreferencesRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update user's preferences including preferred AI model."""
    try:
        from ai_models.models import AIModelConfig
        
        # Validate the model is available
        if not AIModelConfig.is_valid_model(preferences.preferred_model):
            valid_models = AIModelConfig.get_model_ids()
            return create_error_response(
                code="INVALID_MODEL",
                message=f"Invalid model. Available models: {valid_models}"
            )
        
        service = get_document_service()
        success = await service.update_user_preferences(
            current_user["id"], 
            {"preferred_model": preferences.preferred_model}
        )
        
        if not success:
            return create_error_response(
                code="PREFERENCES_UPDATE_FAILED",
                message="Failed to update preferences"
            )
        
        return APIResponse(
            success=True,
            data={"message": "Preferences updated successfully"},
            message="Preferences updated successfully"
        )
        
    except Exception as e:
        return create_error_response(
            code="PREFERENCES_UPDATE_FAILED",
            message=f"Failed to update preferences: {str(e)}"
        )


@router.put("/profile", response_model=APIResponse[dict])
async def update_user_profile(
    profile_update: UserProfileUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update user's profile information."""
    try:
        service = get_document_service()
        
        # Update user profile
        success = await service.update_user(
            current_user["id"],
            {"full_name": profile_update.full_name}
        )
        
        if not success:
            return create_error_response(
                code="PROFILE_UPDATE_FAILED",
                message="Failed to update profile"
            )
        
        return APIResponse(
            success=True,
            data={"message": "Profile updated successfully"},
            message="Profile updated successfully"
        )
        
    except Exception as e:
        return create_error_response(
            code="PROFILE_UPDATE_FAILED",
            message=f"Failed to update profile: {str(e)}"
        )


@router.get("/available-models", response_model=APIResponse[AvailableModelsResponse])
@versioned_response("1.0")
async def get_available_models():
    """Get list of available AI models with descriptions."""
    try:
        from ai_models.models import AIModelConfig
        
        models_data = AvailableModelsResponse(
            models=AIModelConfig.get_models_for_api(),
            default_model=AIModelConfig.get_default_model()
        )
        
        return APIResponse(
            success=True,
            data=models_data,
            message="Available models retrieved successfully"
        )
        
    except Exception as e:
        return create_error_response(
            code="MODELS_FETCH_FAILED",
            message=f"Failed to get available models: {str(e)}"
        )


@router.post("/logout", response_model=APIResponse[dict])
async def logout(current_user: dict = Depends(get_current_user)):
    """Logout user and invalidate token."""
    try:
        # For now, we'll just return success since we're using stateless JWT tokens
        # In a production system, you'd want to add the token to a blacklist
        # or use shorter-lived tokens with server-side session management
        
        logger = logging.getLogger("auth")
        logger.info(f"User {current_user['email']} logged out successfully")
        
        return APIResponse(
            success=True,
            data={"message": "Logged out successfully"},
            message="Logout successful"
        )
        
    except Exception as e:
        return create_error_response(
            code="LOGOUT_FAILED",
            message=f"Logout failed: {str(e)}"
        )
