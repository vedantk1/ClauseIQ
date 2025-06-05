import pytest
from unittest.mock import patch, MagicMock
import os
import tempfile
from config import (
    OPENAI_API_KEY,
    CORS_ORIGINS, 
    STORAGE_DIR,
    MAX_FILE_SIZE_MB,
    ALLOWED_FILE_TYPES
)
from settings import get_settings


class TestLegacyConfig:
    """Test legacy configuration for backward compatibility."""
    
    def test_config_defaults(self):
        """Test default configuration values."""
        assert MAX_FILE_SIZE_MB == 10
        assert ALLOWED_FILE_TYPES == [".pdf"]
        assert isinstance(CORS_ORIGINS, list)


class TestNewSettings:
    """Test new Pydantic settings system."""
    
    def test_settings_loading(self):
        """Test that settings load correctly."""
        settings = get_settings()
        assert settings.file_upload.max_file_size_mb == 10
        assert settings.file_upload.allowed_file_types == [".pdf"]
        assert isinstance(settings.server.cors_origins, list)
    
    @patch.dict(os.environ, {"OPENAI_API_KEY": "sk-test123"})
    def test_openai_key_from_env(self):
        """Test OpenAI API key loading from environment."""
        # Clear cache and reload
        get_settings.cache_clear()
        settings = get_settings()
        assert settings.openai.api_key == "sk-test123"
    
    @patch.dict(os.environ, {"CORS_ORIGINS": "http://localhost:3000,https://example.com"})
    def test_cors_origins_from_env(self):
        """Test CORS origins loading from environment."""
        get_settings.cache_clear()
        settings = get_settings()
        expected_origins = ["http://localhost:3000", "https://example.com"]
        assert settings.server.cors_origins == expected_origins


class TestConfig:
    """Test configuration loading and validation."""
    
    def test_config_defaults(self):
        """Test default configuration values."""
        assert MAX_FILE_SIZE_MB == 10
        assert ALLOWED_FILE_TYPES == [".pdf"]
        assert isinstance(CORS_ORIGINS, list)
    
    @patch.dict(os.environ, {"OPENAI_API_KEY": "sk-test123"})
    def test_openai_key_from_env(self):
        """Test OpenAI API key loading from environment."""
        # Reload config to pick up environment variable
        import importlib
        import config
        importlib.reload(config)
        
        assert config.OPENAI_API_KEY == "sk-test123"
    
    @patch.dict(os.environ, {"CORS_ORIGINS": "http://localhost:3000,https://example.com"})
    def test_cors_origins_from_env(self):
        """Test CORS origins loading from environment."""
        import importlib
        import config
        importlib.reload(config)
        
        expected_origins = ["http://localhost:3000", "https://example.com"]
        assert config.CORS_ORIGINS == expected_origins
    
    @patch.dict(os.environ, {"STORAGE_DIR": "/tmp/test_storage"})
    def test_storage_dir_from_env(self):
        """Test storage directory loading from environment."""
        import importlib
        import config
        importlib.reload(config)
        
        assert config.STORAGE_DIR == "/tmp/test_storage"
    
    @patch.dict(os.environ, {"MAX_FILE_SIZE_MB": "20"})
    def test_max_file_size_from_env(self):
        """Test max file size loading from environment."""
        import importlib
        import config
        importlib.reload(config)
        
        assert config.MAX_FILE_SIZE_MB == 20
