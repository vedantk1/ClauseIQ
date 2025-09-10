"""
Tests for configuration models in config/environments.py.
These tests ensure environment variable parsing and validation work correctly.
"""
import pytest
import sys
from pathlib import Path
from pydantic import ValidationError

# Add the backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from config.environments import (
    DatabaseConfig, 
    ServerConfig, 
    SecurityConfig, 
    AIConfig, 
    PineconeConfig, 
    FileUploadConfig, 
    EmailConfig,
    Environment
)


class TestDatabaseConfig:
    """Test DatabaseConfig validation."""
    
    def test_database_config_valid_data(self):
        """Test DatabaseConfig creation with valid data."""
        config_data = {
            "uri": "mongodb://localhost:27017/",
            "database": "test_db"
        }
        
        config = DatabaseConfig(**config_data)
        
        assert config.uri == "mongodb://localhost:27017/"
        assert config.database == "test_db"
        assert config.collection == "documents"  # default value
        assert config.max_pool_size == 20  # default value
    
    def test_database_config_mongodb_srv_uri(self):
        """Test that mongodb+srv:// URIs are accepted."""
        config_data = {
            "uri": "mongodb+srv://user:pass@cluster.mongodb.net/",
            "database": "prod_db"
        }
        
        config = DatabaseConfig(**config_data)
        assert config.uri.startswith("mongodb+srv://")
    
    def test_database_config_invalid_uri(self):
        """Test that invalid MongoDB URIs are rejected."""
        invalid_data = {
            "uri": "mysql://localhost:3306/",  # Wrong protocol
            "database": "test_db"
        }
        
        with pytest.raises(ValidationError) as exc_info:
            DatabaseConfig(**invalid_data)
        
        error_str = str(exc_info.value)
        assert "MongoDB URI must start with mongodb://" in error_str
    
    def test_database_config_pool_size_validation(self):
        """Test that pool sizes are validated within reasonable ranges."""
        # Test maximum pool size validation
        invalid_data = {
            "uri": "mongodb://localhost:27017/",
            "database": "test_db",
            "max_pool_size": 150  # Too high
        }
        
        with pytest.raises(ValidationError):
            DatabaseConfig(**invalid_data)
        
        # Test minimum pool size validation - min should not exceed max
        invalid_data["max_pool_size"] = 50
        invalid_data["min_pool_size"] = 60  # Min > Max
        
        # This should raise a ValidationError because min > max
        with pytest.raises(ValidationError):
            DatabaseConfig(**invalid_data)


class TestServerConfig:
    """Test ServerConfig validation."""
    
    def test_server_config_defaults(self):
        """Test ServerConfig with default values."""
        config = ServerConfig()
        
        assert config.host == "localhost"
        assert config.port == 8000
        assert config.cors_origins == []
        assert config.debug is False
    
    def test_server_config_custom_values(self):
        """Test ServerConfig with custom values."""
        config_data = {
            "host": "0.0.0.0",
            "port": 3001,
            "cors_origins": ["http://localhost:3000", "https://example.com"],
            "debug": True
        }
        
        config = ServerConfig(**config_data)
        
        assert config.host == "0.0.0.0"
        assert config.port == 3001
        assert len(config.cors_origins) == 2
        assert config.debug is True
    
    def test_server_config_cors_origins_string_parsing(self):
        """Test that CORS origins can be parsed from comma-separated string."""
        config_data = {
            "cors_origins": "http://localhost:3000, https://example.com, https://app.com"
        }
        
        config = ServerConfig(**config_data)
        
        assert len(config.cors_origins) == 3
        assert "http://localhost:3000" in config.cors_origins
        assert "https://example.com" in config.cors_origins
        assert "https://app.com" in config.cors_origins
    
    def test_server_config_invalid_port(self):
        """Test that invalid port numbers are rejected."""
        invalid_data = {
            "port": 70000  # Port too high
        }
        
        with pytest.raises(ValidationError):
            ServerConfig(**invalid_data)
        
        invalid_data["port"] = 0  # Port too low
        
        with pytest.raises(ValidationError):
            ServerConfig(**invalid_data)


class TestSecurityConfig:
    """Test SecurityConfig validation."""
    
    def test_security_config_valid_data(self):
        """Test SecurityConfig with valid JWT secret."""
        config_data = {
            "jwt_secret_key": "this_is_a_very_long_secret_key_that_meets_minimum_length_requirement_123"
        }
        
        config = SecurityConfig(**config_data)
        
        assert len(config.jwt_secret_key) >= 32
        assert config.jwt_algorithm == "HS256"  # default
        assert config.access_token_expire_minutes == 30  # default
    
    def test_security_config_short_jwt_secret(self):
        """Test that short JWT secrets are rejected."""
        invalid_data = {
            "jwt_secret_key": "short_key"  # Too short
        }
        
        with pytest.raises(ValidationError) as exc_info:
            SecurityConfig(**invalid_data)
        
        error_str = str(exc_info.value)
        assert "at least 32 characters" in error_str
    
    def test_security_config_token_expiry_validation(self):
        """Test token expiry validation."""
        config_data = {
            "jwt_secret_key": "this_is_a_very_long_secret_key_that_meets_minimum_length_requirement_123",
            "access_token_expire_minutes": 60,
            "refresh_token_expire_days": 14
        }
        
        config = SecurityConfig(**config_data)
        
        assert config.access_token_expire_minutes == 60
        assert config.refresh_token_expire_days == 14
    
    def test_security_config_invalid_token_expiry(self):
        """Test that invalid token expiry values are rejected."""
        invalid_data = {
            "jwt_secret_key": "this_is_a_very_long_secret_key_that_meets_minimum_length_requirement_123",
            "access_token_expire_minutes": 0  # Too low
        }
        
        with pytest.raises(ValidationError):
            SecurityConfig(**invalid_data)


class TestAIConfig:
    """Test AIConfig validation."""
    
    def test_ai_config_valid_data(self):
        """Test AIConfig with valid OpenAI API key."""
        config_data = {
            "openai_api_key": "sk-1234567890abcdef1234567890abcdef1234567890abcdef"
        }
        
        config = AIConfig(**config_data)
        
        assert config.openai_api_key.startswith("sk-")
        assert config.default_model == "gpt-4o"  # default
        assert config.max_tokens == 4000  # default
        assert config.temperature == 0.7  # default
    
    def test_ai_config_invalid_api_key(self):
        """Test that invalid OpenAI API keys are rejected."""
        invalid_data = {
            "openai_api_key": "invalid-key-format"
        }
        
        with pytest.raises(ValidationError) as exc_info:
            AIConfig(**invalid_data)
        
        error_str = str(exc_info.value)
        assert "must start with sk-" in error_str
    
    def test_ai_config_temperature_validation(self):
        """Test temperature range validation."""
        # Valid temperature
        config_data = {
            "openai_api_key": "sk-test123",
            "temperature": 1.0
        }
        config = AIConfig(**config_data)
        assert config.temperature == 1.0
        
        # Invalid temperature (too high)
        invalid_data = {
            "openai_api_key": "sk-test123",
            "temperature": 3.0  # Too high
        }
        
        with pytest.raises(ValidationError):
            AIConfig(**invalid_data)
    
    def test_ai_config_conversation_settings(self):
        """Test conversation context settings."""
        config_data = {
            "openai_api_key": "sk-test123",
            "conversation_history_window": 20,
            "gate_model": "gpt-3.5-turbo",
            "rewrite_model": "gpt-3.5-turbo"
        }
        
        config = AIConfig(**config_data)
        
        assert config.conversation_history_window == 20
        assert config.gate_model == "gpt-3.5-turbo"
        assert config.rewrite_model == "gpt-3.5-turbo"


class TestPineconeConfig:
    """Test PineconeConfig validation."""
    
    def test_pinecone_config_valid_pcsk_key(self):
        """Test PineconeConfig with valid pcsk_ API key."""
        config_data = {
            "api_key": "pcsk_1234567890abcdef"
        }
        
        config = PineconeConfig(**config_data)
        
        assert config.api_key.startswith("pcsk_")
        assert config.environment == "us-east-1"  # default
    
    def test_pinecone_config_valid_pc_key(self):
        """Test PineconeConfig with valid pc- API key."""
        config_data = {
            "api_key": "pc-1234567890abcdef"
        }
        
        config = PineconeConfig(**config_data)
        assert config.api_key.startswith("pc-")
    
    def test_pinecone_config_invalid_api_key(self):
        """Test that invalid Pinecone API keys are rejected."""
        invalid_data = {
            "api_key": "invalid-pinecone-key"
        }
        
        with pytest.raises(ValidationError) as exc_info:
            PineconeConfig(**invalid_data)
        
        error_str = str(exc_info.value)
        assert "must start with pcsk_ or pc-" in error_str


class TestFileUploadConfig:
    """Test FileUploadConfig validation."""
    
    def test_file_upload_config_defaults(self):
        """Test FileUploadConfig with default values."""
        config = FileUploadConfig()
        
        assert config.max_file_size_mb == 10
        assert config.allowed_file_types == [".pdf"]
        assert config.storage_dir == "./documents_storage"
    
    def test_file_upload_config_custom_values(self):
        """Test FileUploadConfig with custom values."""
        config_data = {
            "max_file_size_mb": 25,
            "allowed_file_types": [".pdf", ".docx", ".txt"],
            "storage_dir": "/var/uploads"
        }
        
        config = FileUploadConfig(**config_data)
        
        assert config.max_file_size_mb == 25
        assert len(config.allowed_file_types) == 3
        assert ".docx" in config.allowed_file_types
    
    def test_file_upload_config_file_types_string_parsing(self):
        """Test that file types can be parsed from comma-separated string."""
        config_data = {
            "allowed_file_types": ".pdf, .docx, .txt"
        }
        
        config = FileUploadConfig(**config_data)
        
        assert len(config.allowed_file_types) == 3
        assert ".pdf" in config.allowed_file_types
        assert ".docx" in config.allowed_file_types
        assert ".txt" in config.allowed_file_types


class TestEmailConfig:
    """Test EmailConfig validation."""
    
    def test_email_config_defaults(self):
        """Test EmailConfig with default values."""
        config = EmailConfig()
        
        assert config.smtp_host == "smtp.gmail.com"
        assert config.smtp_port == 587
        assert config.email_from == "noreply@clauseiq.com"
        assert config.email_from_name == "ClauseIQ"
    
    def test_email_config_valid_email(self):
        """Test EmailConfig with valid email address."""
        config_data = {
            "email_from": "support@mycompany.com"
        }
        
        config = EmailConfig(**config_data)
        assert config.email_from == "support@mycompany.com"
    
    def test_email_config_invalid_email(self):
        """Test that invalid email addresses are rejected."""
        invalid_data = {
            "email_from": "invalid-email-address"  # No @ symbol
        }
        
        with pytest.raises(ValidationError) as exc_info:
            EmailConfig(**invalid_data)
        
        error_str = str(exc_info.value)
        assert "Invalid email address format" in error_str


class TestEnvironmentEnum:
    """Test the Environment enum."""
    
    def test_environment_values(self):
        """Test that Environment enum has expected values."""
        assert Environment.DEVELOPMENT == "development"
        assert Environment.STAGING == "staging" 
        assert Environment.PRODUCTION == "production"
        assert Environment.TESTING == "testing"
        
        # Ensure all values are strings
        for env in Environment:
            assert isinstance(env.value, str)
