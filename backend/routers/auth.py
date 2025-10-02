"""
Authentication and user management routes.
"""
import uuid
import logging
from fastapi import APIRouter, HTTPException, Depends, Request
from database.service import get_document_service
from services.auth_service import get_auth_service
from middleware.api_standardization import APIResponse, ErrorResponse, create_error_response
from middleware.versioning import versioned_response
from auth import (
    create_access_token,
    create_refresh_token,
    verify_token,
    get_current_user,
    UserCreate,
    UserLogin,
    UserResponse,
    UserProfileUpdate,
    Token,
    ForgotPasswordRequest,
    ResetPasswordRequest
)
from models.auth import (
    RefreshTokenRequest,
    UserPreferencesRequest,
    UserPreferencesResponse,
    AvailableModelsResponse
)

logger = logging.getLogger(__name__)


router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/register", response_model=APIResponse[Token])
async def register(user_data: UserCreate):
    """Register a new user and return authentication tokens."""
    auth_service = get_auth_service()
    
    success, token_data, error = await auth_service.register_user(
        full_name=user_data.full_name,
        email=user_data.email,
        password=user_data.password
    )
    
    if not success:
        return create_error_response(
            code="REGISTRATION_FAILED",
            message=error or "Registration failed"
        )
    
    return APIResponse(
        success=True,
        data=token_data,
        message="User registered successfully"
    )


@router.post("/login", response_model=APIResponse[Token])
async def login(user_data: UserLogin, request: Request):
    """Authenticate user and return tokens."""
    auth_service = get_auth_service()
    client_ip = request.client.host if request.client else "unknown"
    
    success, token_data, error = await auth_service.authenticate_user(
        email=user_data.email,
        password=user_data.password,
        client_ip=client_ip
    )
    
    if not success:
        return create_error_response(
            code="INVALID_CREDENTIALS",
            message=error or "Invalid email or password"
        )
    
    return APIResponse(
        success=True,
        data=token_data,
        message="Login successful"
    )


@router.post("/refresh", response_model=APIResponse[Token])
async def refresh_access_token(request: RefreshTokenRequest):
    """Refresh access token using refresh token."""
    try:
        # Step 1: Verify the provided refresh token
        payload = verify_token(request.refresh_token)
        if not payload:
            # If verification fails, return an error response
            return create_error_response(
                code="INVALID_REFRESH_TOKEN",
                message="Invalid refresh token"
            )
        
        # Step 2: Extract user ID from the token payload
        user_id = payload.get("sub")
        if not user_id:
            # If user ID is missing, return an error response
            return create_error_response(
                code="INVALID_REFRESH_TOKEN",
                message="Invalid refresh token"
            )
        
        # Step 3: Create new access and refresh tokens for the user
        access_token = create_access_token(data={"sub": user_id})
        refresh_token = create_refresh_token(data={"sub": user_id})
        
        # Step 4: Prepare the token data for the response
        token_data = Token(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer"
        )
        
        # Step 5: Return a successful API response with the new tokens
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
    auth_service = get_auth_service()
    
    success, error = await auth_service.initiate_password_reset(request.email)
    
    # Always return success for security (don't reveal if email exists)
    return APIResponse(
        success=True,
        data={"message": "If the email exists, a password reset link has been sent"},
        message="Password reset email sent"
    )


@router.post("/reset-password", response_model=APIResponse[dict])
async def reset_password(request: ResetPasswordRequest):
    """Reset user password using reset token."""
    auth_service = get_auth_service()
    
    success, error = await auth_service.reset_password(request.token, request.new_password)
    
    if not success:
        return create_error_response(
            code="PASSWORD_RESET_FAILED",
            message=error or "Password reset failed"
        )
    
    return APIResponse(
        success=True,
        data={"message": "Password reset successfully"},
        message="Password reset successfully"
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
