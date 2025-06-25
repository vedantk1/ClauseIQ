import pytest
from unittest.mock import patch, MagicMock
import os
import tempfile
from config.environments import get_environment_config


class TestEnvironmentConfig:
    """Test environment-based configuration system."""
    
    def test_environment_config_loading(self):
        """Test that environment config loads correctly."""
        config = get_environment_config()
        assert config.file_upload.max_file_size_mb == 10
        assert config.file_upload.allowed_file_types == [".pdf"]
        assert isinstance(config.server.cors_origins, list)
    
    @patch.dict(os.environ, {"OPENAI_API_KEY": "sk-test123"})
    def test_openai_key_from_env(self):
        """Test OpenAI API key loading from environment."""
        config = get_environment_config()
        assert config.ai.openai_api_key == "sk-test123"
    
    @patch.dict(os.environ, {"CORS_ORIGINS": "http://localhost:3000,https://example.com"})
    def test_cors_origins_from_env(self):
        """Test CORS origins loading from environment."""
        config = get_environment_config()
        expected_origins = ["http://localhost:3000", "https://example.com"]
        assert config.server.cors_origins == expected_origins
    
    @patch.dict(os.environ, {"FRONTEND_URL": "https://app.clauseiq.com"})
    def test_frontend_url_from_env(self):
        """Test frontend URL loading from environment."""
        config = get_environment_config()
        assert config.security.frontend_url == "https://app.clauseiq.com"
    
    def test_config_properties(self):
        """Test that all config properties are accessible."""
        config = get_environment_config()
        
        # Test all config sections exist
        assert hasattr(config, 'server')
        assert hasattr(config, 'ai')
        assert hasattr(config, 'security')
        assert hasattr(config, 'email')
        assert hasattr(config, 'file_upload')
        
        # Test that core values are reasonable
        assert config.ai.max_tokens > 0
        assert config.ai.temperature >= 0.0
        assert config.security.access_token_expire_minutes > 0
