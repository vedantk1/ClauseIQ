"""
Centralized settings configuration for ClauseIQ.
Uses Pydantic Settings for validation and environment variable management.
"""
from functools import lru_cache
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field, field_validator
from pydantic_settings import BaseSettings
import os


class Settings(BaseSettings):
    """Main application settings."""
    
    # OpenAI Configuration
    openai_api_key: str = Field(..., alias="OPENAI_API_KEY")
    
    # Server Configuration
    host: str = Field("localhost", alias="HOST")
    port: int = Field(8000, alias="PORT")
    cors_origins: str = Field(
        default="http://localhost:3000,http://localhost:3001",
        alias="CORS_ORIGINS"
    )
    
    # File Upload Configuration
    max_file_size_mb: int = Field(10, alias="MAX_FILE_SIZE_MB")
    allowed_file_types: str = Field(default=".pdf", alias="ALLOWED_FILE_TYPES")
    storage_dir: str = Field("./documents_storage", alias="STORAGE_DIR")
    
    # MongoDB Configuration
    mongodb_uri: str = Field("mongodb://localhost:27017", alias="MONGODB_URI")
    mongodb_database: str = Field("legal_ai", alias="MONGODB_DATABASE")
    mongodb_collection: str = Field("documents", alias="MONGODB_COLLECTION")
    
    # JWT Configuration
    jwt_secret_key: str = Field("your-secret-key-change-this-in-production", alias="JWT_SECRET_KEY")
    jwt_algorithm: str = Field("HS256", alias="JWT_ALGORITHM")
    jwt_access_token_expire_minutes: int = Field(30, alias="JWT_ACCESS_TOKEN_EXPIRE_MINUTES")
    jwt_refresh_token_expire_days: int = Field(7, alias="JWT_REFRESH_TOKEN_EXPIRE_DAYS")
    
    # Email Configuration
    smtp_host: str = Field("smtp.gmail.com", alias="SMTP_HOST")
    smtp_port: int = Field(587, alias="SMTP_PORT")
    smtp_username: str = Field("", alias="SMTP_USERNAME")
    smtp_password: str = Field("", alias="SMTP_PASSWORD")
    email_from: EmailStr = Field("noreply@legalai.com", alias="EMAIL_FROM")
    email_from_name: str = Field("Legal AI", alias="EMAIL_FROM_NAME")
    
    # Security Configuration
    password_reset_token_expire_minutes: int = Field(30, alias="PASSWORD_RESET_TOKEN_EXPIRE_MINUTES")
    frontend_url: str = Field("http://localhost:3000", alias="FRONTEND_URL")
    
    # Environment and debug
    environment: str = Field("development", alias="ENVIRONMENT")
    debug: bool = Field(False, alias="DEBUG")
    
    @field_validator("cors_origins", mode="after")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v
    
    @field_validator("allowed_file_types", mode="after") 
    @classmethod
    def parse_file_types(cls, v):
        if isinstance(v, str):
            return [ext.strip() for ext in v.split(",")]
        return v
    
    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
    }
    
    # Property accessors for organized access
    @property
    def openai(self):
        """OpenAI configuration."""
        return type('OpenAI', (), {
            'api_key': self.openai_api_key
        })()
    
    @property
    def database(self):
        """Database configuration."""
        return type('Database', (), {
            'uri': self.mongodb_uri,
            'database': self.mongodb_database,
            'collection': self.mongodb_collection
        })()
    
    @property
    def server(self):
        """Server configuration."""
        cors_list = self.cors_origins if isinstance(self.cors_origins, list) else [origin.strip() for origin in self.cors_origins.split(",")]
        return type('Server', (), {
            'host': self.host,
            'port': self.port,
            'cors_origins': cors_list
        })()
    
    @property
    def file_upload(self):
        """File upload configuration."""
        file_types_list = self.allowed_file_types if isinstance(self.allowed_file_types, list) else [ext.strip() for ext in self.allowed_file_types.split(",")]
        return type('FileUpload', (), {
            'max_file_size_mb': self.max_file_size_mb,
            'allowed_file_types': file_types_list,
            'storage_dir': self.storage_dir
        })()
    
    @property
    def jwt(self):
        """JWT configuration."""
        return type('JWT', (), {
            'secret_key': self.jwt_secret_key,
            'algorithm': self.jwt_algorithm,
            'access_token_expire_minutes': self.jwt_access_token_expire_minutes,
            'refresh_token_expire_days': self.jwt_refresh_token_expire_days
        })()
    
    @property
    def email(self):
        """Email configuration."""
        return type('Email', (), {
            'smtp_host': self.smtp_host,
            'smtp_port': self.smtp_port,
            'smtp_username': self.smtp_username,
            'smtp_password': self.smtp_password,
            'email_from': self.email_from,
            'email_from_name': self.email_from_name
        })()
    
    @property
    def security(self):
        """Security configuration."""
        return type('Security', (), {
            'password_reset_token_expire_minutes': self.password_reset_token_expire_minutes,
            'frontend_url': self.frontend_url
        })()


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Export common settings for backward compatibility
def get_legacy_config():
    """Get configuration in the old format for backward compatibility."""
    settings = get_settings()
    return {
        # OpenAI
        "OPENAI_API_KEY": settings.openai.api_key,
        
        # Server
        "HOST": settings.server.host,
        "PORT": settings.server.port,
        "CORS_ORIGINS": settings.server.cors_origins,
        
        # File Upload
        "MAX_FILE_SIZE_MB": settings.file_upload.max_file_size_mb,
        "ALLOWED_FILE_TYPES": settings.file_upload.allowed_file_types,
        "STORAGE_DIR": settings.file_upload.storage_dir,
        
        # Database
        "MONGODB_URI": settings.database.uri,
        "MONGODB_DATABASE": settings.database.database,
        "MONGODB_COLLECTION": settings.database.collection,
        
        # JWT
        "JWT_SECRET_KEY": settings.jwt.secret_key,
        "JWT_ALGORITHM": settings.jwt.algorithm,
        "JWT_ACCESS_TOKEN_EXPIRE_MINUTES": settings.jwt.access_token_expire_minutes,
        "JWT_REFRESH_TOKEN_EXPIRE_DAYS": settings.jwt.refresh_token_expire_days,
        
        # Email
        "SMTP_HOST": settings.email.smtp_host,
        "SMTP_PORT": settings.email.smtp_port,
        "SMTP_USERNAME": settings.email.smtp_username,
        "SMTP_PASSWORD": settings.email.smtp_password,
        "EMAIL_FROM": settings.email.email_from,
        "EMAIL_FROM_NAME": settings.email.email_from_name,
        
        # Security
        "PASSWORD_RESET_TOKEN_EXPIRE_MINUTES": settings.security.password_reset_token_expire_minutes,
        "FRONTEND_URL": settings.security.frontend_url,
    }
