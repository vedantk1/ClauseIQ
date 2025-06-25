"""
Legacy configuration module for backward compatibility.
This module provides the old configuration interface while using the new settings system.

DEPRECATED: Use settings.py directly for new code.
"""
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def _get_settings():
    """Get fresh settings instance (avoiding import-time caching)."""
    from settings import Settings
    return Settings()

# Get the new settings instance
_settings = _get_settings()

# Export individual configuration values for backward compatibility
OPENAI_API_KEY = _settings.openai.api_key

# Server Configuration
HOST = _settings.server.host
PORT = _settings.server.port
CORS_ORIGINS = _settings.server.cors_origins

# File Upload Configuration
MAX_FILE_SIZE_MB = _settings.file_upload.max_file_size_mb
ALLOWED_FILE_TYPES = _settings.file_upload.allowed_file_types
STORAGE_DIR = _settings.file_upload.storage_dir

# MongoDB Configuration
MONGODB_URI = _settings.database.uri
MONGODB_DATABASE = _settings.database.database
MONGODB_COLLECTION = _settings.database.collection

# JWT Configuration
JWT_SECRET_KEY = _settings.jwt.secret_key
JWT_ALGORITHM = _settings.jwt.algorithm
JWT_ACCESS_TOKEN_EXPIRE_MINUTES = _settings.jwt.access_token_expire_minutes
JWT_REFRESH_TOKEN_EXPIRE_DAYS = _settings.jwt.refresh_token_expire_days

# Email Configuration
SMTP_HOST = _settings.email.smtp_host
SMTP_PORT = _settings.email.smtp_port
SMTP_USERNAME = _settings.email.smtp_username
SMTP_PASSWORD = _settings.email.smtp_password
EMAIL_FROM = _settings.email.email_from
EMAIL_FROM_NAME = _settings.email.email_from_name

# Password Reset Configuration
PASSWORD_RESET_TOKEN_EXPIRE_MINUTES = _settings.security.password_reset_token_expire_minutes
FRONTEND_URL = _settings.security.frontend_url
