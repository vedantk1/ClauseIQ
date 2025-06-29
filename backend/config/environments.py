"""
Environment-specific configuration management for ClauseIQ.
Provides configuration validation and environment-aware settings.
"""
import os
from enum import Enum
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field, validator
from pydantic_settings import BaseSettings


class Environment(str, Enum):
    """Application environment types."""
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"
    TESTING = "testing"


class DatabaseConfig(BaseModel):
    """Database configuration with validation."""
    uri: str = Field(..., description="MongoDB connection URI")
    database: str = Field(..., description="Database name")
    collection: str = Field(default="documents", description="Default collection name")
    
    # Connection pool settings
    max_pool_size: int = Field(default=20, ge=1, le=100, description="Maximum connection pool size")
    min_pool_size: int = Field(default=5, ge=0, le=50, description="Minimum connection pool size")
    max_idle_time_ms: int = Field(default=600000, ge=10000, description="Max idle time in milliseconds (10 minutes)")
    wait_queue_timeout_ms: int = Field(default=30000, ge=1000, description="Wait queue timeout in milliseconds")
    server_selection_timeout_ms: int = Field(default=30000, ge=1000, description="Server selection timeout in milliseconds")
    
    @validator('uri')
    def validate_uri(cls, v):
        if not v.startswith(('mongodb://', 'mongodb+srv://')):
            raise ValueError('MongoDB URI must start with mongodb:// or mongodb+srv://')
        return v


class ServerConfig(BaseModel):
    """Server configuration with validation."""
    host: str = Field(default="localhost", description="Server host")
    port: int = Field(default=8000, ge=1, le=65535, description="Server port")
    cors_origins: list[str] = Field(default_factory=list, description="CORS allowed origins")
    debug: bool = Field(default=False, description="Debug mode")
    
    @validator('cors_origins', pre=True)
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v or []


class SecurityConfig(BaseModel):
    """Security configuration with validation."""
    jwt_secret_key: str = Field(..., min_length=32, description="JWT secret key")
    jwt_algorithm: str = Field(default="HS256", description="JWT algorithm")
    access_token_expire_minutes: int = Field(default=30, ge=1, description="Access token expiry")
    refresh_token_expire_days: int = Field(default=7, ge=1, description="Refresh token expiry")
    password_reset_token_expire_minutes: int = Field(default=30, ge=1, description="Password reset token expiry")
    frontend_url: str = Field(default="http://localhost:3000", description="Frontend URL for email links")
    
    @validator('jwt_secret_key')
    def validate_jwt_secret(cls, v):
        if len(v) < 32:
            raise ValueError('JWT secret key must be at least 32 characters long')
        return v


class AIConfig(BaseModel):
    """AI service configuration with validation."""
    openai_api_key: str = Field(..., description="OpenAI API key")
    default_model: str = Field(default="gpt-4o", description="Default AI model")
    max_tokens: int = Field(default=4000, ge=1, description="Maximum tokens per request")
    temperature: float = Field(default=0.7, ge=0.0, le=2.0, description="AI temperature")
    
    # Conversation context settings
    conversation_history_window: int = Field(default=10, ge=1, le=50, description="Max conversation turns to consider for context")
    gate_model: str = Field(default="gpt-4o-mini", description="Model for conversation context gate")
    rewrite_model: str = Field(default="gpt-4o-mini", description="Model for query rewriting")
    
    @validator('openai_api_key')
    def validate_api_key(cls, v):
        if not v.startswith('sk-'):
            raise ValueError('OpenAI API key must start with sk-')
        return v


class SupabaseConfig(BaseModel):
    """Supabase configuration for vector search."""
    url: str = Field(..., description="Supabase project URL")
    service_key: str = Field(..., description="Supabase service role key")
    
    @validator('url')
    def validate_url(cls, v):
        if not v.startswith('https://') or not 'supabase.co' in v:
            raise ValueError('Supabase URL must be a valid supabase.co URL')
        return v


class PineconeConfig(BaseModel):
    """Pinecone configuration for vector search."""
    api_key: str = Field(..., description="Pinecone API key")
    environment: str = Field(default="us-east-1", description="Pinecone environment/region")
    
    @validator('api_key')
    def validate_api_key(cls, v):
        if not v.startswith(('pcsk_', 'pc-')):
            raise ValueError('Pinecone API key must start with pcsk_ or pc-')
        return v


class FileUploadConfig(BaseModel):
    """File upload configuration with validation."""
    max_file_size_mb: int = Field(default=10, ge=1, le=100, description="Maximum file size in MB")
    allowed_file_types: list[str] = Field(default=[".pdf"], description="Allowed file extensions")
    storage_dir: str = Field(default="./documents_storage", description="Storage directory")
    
    @validator('allowed_file_types', pre=True)
    def parse_file_types(cls, v):
        if isinstance(v, str):
            return [ext.strip() for ext in v.split(",") if ext.strip()]
        return v or [".pdf"]


class EmailConfig(BaseModel):
    """Email configuration with validation."""
    smtp_host: str = Field(default="smtp.gmail.com", description="SMTP host")
    smtp_port: int = Field(default=587, ge=1, le=65535, description="SMTP port")
    smtp_username: str = Field(default="", description="SMTP username")
    smtp_password: str = Field(default="", description="SMTP password")
    email_from: str = Field(default="noreply@clauseiq.com", description="From email address")
    email_from_name: str = Field(default="ClauseIQ", description="From name")
    
    @validator('email_from')
    def validate_email(cls, v):
        if v and '@' not in v:
            raise ValueError('Invalid email address format')
        return v


class EnvironmentConfig(BaseSettings):
    """Full application configuration with environment variable support."""
    # Environment
    environment: Environment = Field(default=Environment.DEVELOPMENT, description="Application environment")
    
    # Database - Environment variables mapped directly
    mongodb_uri: str = Field(default="mongodb://localhost:27017", description="MongoDB connection URI")
    mongodb_database: str = Field(default="legal_ai", description="MongoDB database name")
    mongodb_collection: str = Field(default="documents", description="MongoDB collection name")
    
    # Database connection pool settings
    mongodb_max_pool_size: int = Field(default=20, description="MongoDB maximum connection pool size")
    mongodb_min_pool_size: int = Field(default=5, description="MongoDB minimum connection pool size") 
    mongodb_max_idle_time_ms: int = Field(default=600000, description="MongoDB max idle time in milliseconds")
    mongodb_wait_queue_timeout_ms: int = Field(default=30000, description="MongoDB wait queue timeout in milliseconds")
    mongodb_server_selection_timeout_ms: int = Field(default=30000, description="MongoDB server selection timeout in milliseconds")
    
    # Server
    host: str = Field(default="localhost", description="Server host")
    port: int = Field(default=8000, description="Server port")
    cors_origins: str = Field(default="http://localhost:3000", description="CORS allowed origins")
    debug: bool = Field(default=False, description="Debug mode")
    
    # Security
    jwt_secret_key: str = Field(default="your-super-secret-jwt-key-change-this-in-production-make-it-long-and-random", description="JWT secret key")
    jwt_algorithm: str = Field(default="HS256", description="JWT algorithm")
    jwt_access_token_expire_minutes: int = Field(default=30, description="Access token expiry")
    jwt_refresh_token_expire_days: int = Field(default=7, description="Refresh token expiry")
    jwt_password_reset_token_expire_minutes: int = Field(default=30, description="Password reset token expiry")
    frontend_url: str = Field(default="http://localhost:3000", description="Frontend URL for email links")
    
    # AI
    openai_api_key: str = Field(default="sk-placeholder", description="OpenAI API key")
    openai_default_model: str = Field(default="gpt-4o", description="Default AI model")
    openai_max_tokens: int = Field(default=4000, description="Maximum tokens per request")
    openai_temperature: float = Field(default=0.7, description="AI temperature")
    
    # Supabase Vector Search
    supabase_url: str = Field(default="https://your-project.supabase.co", description="Supabase project URL")
    supabase_service_key: str = Field(default="your-service-key", description="Supabase service role key")
    
    # Pinecone Vector Search
    pinecone_api_key: str = Field(default="your-pinecone-api-key", description="Pinecone API key")
    pinecone_environment: str = Field(default="us-east-1", description="Pinecone environment/region")
    
    # File Upload
    max_file_size_mb: int = Field(default=10, description="Maximum file size in MB")
    allowed_file_types: str = Field(default=".pdf", description="Allowed file extensions")
    storage_dir: str = Field(default="./documents_storage", description="Storage directory")
    
    # Email
    smtp_host: str = Field(default="smtp.gmail.com", description="SMTP host")
    smtp_port: int = Field(default=587, description="SMTP port")
    smtp_username: str = Field(default="", description="SMTP username")
    smtp_password: str = Field(default="", description="SMTP password")
    email_from: str = Field(default="noreply@clauseiq.com", description="From email address")
    email_from_name: str = Field(default="ClauseIQ", description="From name")
    
    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore"
    }
    
    @property
    def database(self) -> DatabaseConfig:
        """Get database configuration."""
        return DatabaseConfig(
            uri=self.mongodb_uri,
            database=self.mongodb_database,
            collection=self.mongodb_collection,
            max_pool_size=self.mongodb_max_pool_size,
            min_pool_size=self.mongodb_min_pool_size,
            max_idle_time_ms=self.mongodb_max_idle_time_ms,
            wait_queue_timeout_ms=self.mongodb_wait_queue_timeout_ms,
            server_selection_timeout_ms=self.mongodb_server_selection_timeout_ms
        )
    
    @property
    def server(self) -> ServerConfig:
        """Get server configuration."""
        return ServerConfig(
            host=self.host,
            port=self.port,
            cors_origins=[origin.strip() for origin in self.cors_origins.split(",") if origin.strip()],
            debug=self.debug
        )
    
    @property
    def security(self) -> SecurityConfig:
        """Get security configuration."""
        return SecurityConfig(
            jwt_secret_key=self.jwt_secret_key,
            jwt_algorithm=self.jwt_algorithm,
            access_token_expire_minutes=self.jwt_access_token_expire_minutes,
            refresh_token_expire_days=self.jwt_refresh_token_expire_days,
            password_reset_token_expire_minutes=self.jwt_password_reset_token_expire_minutes,
            frontend_url=self.frontend_url
        )
    
    @property
    def ai(self) -> AIConfig:
        """Get AI configuration."""
        return AIConfig(
            openai_api_key=self.openai_api_key,
            default_model=self.openai_default_model,
            max_tokens=self.openai_max_tokens,
            temperature=self.openai_temperature
        )
    
    @property
    def supabase(self) -> SupabaseConfig:
        """Get Supabase configuration."""
        return SupabaseConfig(
            url=self.supabase_url,
            service_key=self.supabase_service_key
        )
    
    @property
    def pinecone(self) -> PineconeConfig:
        """Get Pinecone configuration."""
        return PineconeConfig(
            api_key=self.pinecone_api_key,
            environment=self.pinecone_environment
        )

    @property
    def file_upload(self) -> FileUploadConfig:
        """Get file upload configuration."""
        return FileUploadConfig(
            max_file_size_mb=self.max_file_size_mb,
            allowed_file_types=[ext.strip() for ext in self.allowed_file_types.split(",") if ext.strip()],
            storage_dir=self.storage_dir
        )
    
    @property
    def email(self) -> EmailConfig:
        """Get email configuration."""
        return EmailConfig(
            smtp_host=self.smtp_host,
            smtp_port=self.smtp_port,
            smtp_username=self.smtp_username,
            smtp_password=self.smtp_password,
            email_from=self.email_from,
            email_from_name=self.email_from_name
        )
        
    def is_development(self) -> bool:
        """Check if running in development environment."""
        return self.environment == Environment.DEVELOPMENT
    
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.environment == Environment.PRODUCTION
    
    def is_testing(self) -> bool:
        """Check if running in testing environment."""
        return self.environment == Environment.TESTING
    
    def get_environment_vars(self) -> Dict[str, Any]:
        """Get environment-specific configuration as dict."""
        return {
            "environment": self.environment.value,
            "debug": self.server.debug,
            "database_name": self.database.database,
            "cors_origins": self.server.cors_origins,
            "max_file_size": self.file_upload.max_file_size_mb
        }


def get_environment_config() -> EnvironmentConfig:
    """Get validated environment configuration."""
    return EnvironmentConfig()
