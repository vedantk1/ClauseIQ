"""
Authentication and user management routes.
"""
import uuid
from fastapi import APIRouter, HTTPException, Depends
from database import get_mongo_storage
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


@router.post("/register", response_model=Token)
async def register(user_data: UserCreate):
    """Register a new user and return authentication tokens."""
    try:
        storage = get_mongo_storage()
        
        # Check if user already exists
        existing_user = storage.get_user_by_email(user_data.email)
        if existing_user:
            raise HTTPException(
                status_code=400,
                detail="User with this email already exists"
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
        storage.create_user(user_dict)
        
        # Create tokens for immediate login after registration
        access_token = create_access_token(data={"sub": user_id})
        refresh_token = create_refresh_token(data={"sub": user_id})
        
        return Token(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating user: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/login", response_model=Token)
async def login(user_data: UserLogin):
    """Authenticate user and return tokens."""
    try:
        storage = get_mongo_storage()
        
        # Get user by email
        user = storage.get_user_by_email(user_data.email)
        if not user:
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password"
            )
        
        # Verify password
        if not verify_password(user_data.password, user["hashed_password"]):
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password"
            )
        
        # Create tokens
        access_token = create_access_token(data={"sub": user["id"]})
        refresh_token = create_refresh_token(data={"sub": user["id"]})
        
        return Token(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error during login: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/refresh", response_model=Token)
async def refresh_access_token(request: RefreshTokenRequest):
    """Refresh access token using refresh token."""
    try:
        # Verify refresh token
        payload = verify_token(request.refresh_token)
        if not payload:
            raise HTTPException(
                status_code=401,
                detail="Invalid refresh token"
            )
        
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=401,
                detail="Invalid refresh token"
            )
        
        # Create new tokens
        access_token = create_access_token(data={"sub": user_id})
        refresh_token = create_refresh_token(data={"sub": user_id})
        
        return Token(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error refreshing token: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current user information."""
    return UserResponse(
        id=current_user["id"],
        full_name=current_user["full_name"],
        email=current_user["email"]
    )


@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    """Send password reset email to user."""
    try:
        storage = get_mongo_storage()
        
        # Check if user exists
        user = storage.get_user_by_email(request.email)
        if not user:
            # Don't reveal if email exists or not for security
            return {"message": "If the email exists, a password reset link has been sent"}
        
        # Create password reset token
        reset_token = create_password_reset_token(request.email)
        
        # Send password reset email
        await send_password_reset_email(request.email, reset_token)
        
        return {"message": "If the email exists, a password reset link has been sent"}
        
    except Exception as e:
        print(f"Error in forgot password: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """Reset user password using reset token."""
    try:
        # Verify reset token
        email = verify_password_reset_token(request.token)
        if not email:
            raise HTTPException(
                status_code=400,
                detail="Invalid or expired reset token"
            )
        
        # Validate new password
        if not validate_password(request.new_password):
            raise HTTPException(
                status_code=400,
                detail="Password does not meet requirements"
            )
        
        storage = get_mongo_storage()
        
        # Get user by email
        user = storage.get_user_by_email(email)
        if not user:
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )
        
        # Hash new password and update user
        hashed_password = get_password_hash(request.new_password)
        success = storage.update_user_password(user["id"], hashed_password)
        
        if not success:
            raise HTTPException(
                status_code=500,
                detail="Failed to update password"
            )
        
        return {"message": "Password reset successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error resetting password: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/preferences", response_model=UserPreferencesResponse)
async def get_user_preferences(current_user: dict = Depends(get_current_user)):
    """Get user's preferences including preferred AI model."""
    try:
        from database import AVAILABLE_MODELS
        storage = get_mongo_storage()
        
        # Get user's preferred model
        preferred_model = storage.get_user_preferred_model(current_user["id"])
        
        return UserPreferencesResponse(
            preferred_model=preferred_model,
            available_models=AVAILABLE_MODELS
        )
        
    except Exception as e:
        print(f"Error getting user preferences: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.put("/preferences")
async def update_user_preferences(
    preferences: UserPreferencesRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update user's preferences including preferred AI model."""
    try:
        from database import AVAILABLE_MODELS
        
        # Validate the model is available
        if preferences.preferred_model not in AVAILABLE_MODELS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid model. Available models: {AVAILABLE_MODELS}"
            )
        
        storage = get_mongo_storage()
        success = storage.update_user_preferred_model(current_user["id"], preferences.preferred_model)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update preferences")
        
        return {"message": "Preferences updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating user preferences: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.put("/profile")
async def update_user_profile(
    profile_update: UserProfileUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update user's profile information."""
    try:
        storage = get_mongo_storage()
        
        # Update user profile
        success = storage.update_user_profile(
            current_user["id"],
            {"full_name": profile_update.full_name}
        )
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update profile")
        
        return {"message": "Profile updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating user profile: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/available-models", response_model=AvailableModelsResponse)
async def get_available_models():
    """Get list of available AI models with descriptions."""
    try:
        from database import AVAILABLE_MODELS, MODEL_DESCRIPTIONS, DEFAULT_MODEL
        
        models = []
        for model in AVAILABLE_MODELS:
            models.append({
                "name": model,
                "description": MODEL_DESCRIPTIONS.get(model, "AI model for document analysis")
            })
        
        return AvailableModelsResponse(
            models=models,
            default_model=DEFAULT_MODEL
        )
        
    except Exception as e:
        print(f"Error getting available models: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
