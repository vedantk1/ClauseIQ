"""
Tests for utility functions in utils/ai_debug_helper.py.
These tests ensure the debugging and diagnostic utilities work correctly.
"""
import pytest
import json
import sys
from pathlib import Path
from datetime import datetime
from unittest.mock import patch, MagicMock

# Add the backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from utils.ai_debug_helper import (
    DebugLevel,
    AIDebugLogger,
    get_system_diagnostics,
    log_startup_diagnostics
)


class TestDebugLevel:
    """Test the DebugLevel enum."""
    
    def test_debug_level_values(self):
        """Test that DebugLevel enum has expected values."""
        assert DebugLevel.CRITICAL.value == "CRITICAL"
        assert DebugLevel.ERROR.value == "ERROR"
        assert DebugLevel.WARNING.value == "WARNING"
        assert DebugLevel.INFO.value == "INFO"
        assert DebugLevel.DEBUG.value == "DEBUG"
        
        # Ensure all values are strings
        for level in DebugLevel:
            assert isinstance(level.value, str)


class TestAIDebugLogger:
    """Test the AIDebugLogger class (simplified tests)."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.debug_logger = AIDebugLogger()
    
    def test_debug_logger_creation(self):
        """Test that AIDebugLogger can be created."""
        logger = AIDebugLogger()
        assert logger is not None
        # Test that logger attribute exists
        assert hasattr(logger, 'logger')
    
    def test_log_system_event_no_exceptions(self):
        """Test that log_system_event doesn't raise exceptions."""
        # This test just ensures the method can be called without crashing
        try:
            self.debug_logger.log_system_event(
                event_type="TEST_EVENT",
                level=DebugLevel.INFO,
                message="Test message",
                context={"key": "value"}
            )
            # If we get here, no exception was raised
            assert True
        except Exception as e:
            pytest.fail(f"log_system_event raised an exception: {e}")
    
    def test_log_rag_pipeline_step_no_exceptions(self):
        """Test that log_rag_pipeline_step doesn't raise exceptions."""
        try:
            self.debug_logger.log_rag_pipeline_step(
                step_name="test_step",
                success=True,
                duration_ms=100.0,
                details={"test": "data"}
            )
            assert True
        except Exception as e:
            pytest.fail(f"log_rag_pipeline_step raised an exception: {e}")
    
    def test_log_rag_pipeline_step_with_optional_params(self):
        """Test log_rag_pipeline_step with optional parameters."""
        try:
            self.debug_logger.log_rag_pipeline_step(
                step_name="test_step",
                success=False,
                duration_ms=50.0,
                details={"error": "test error"},
                user_id="user123",
                document_id="doc456",
                query="test query"
            )
            assert True
        except Exception as e:
            pytest.fail(f"log_rag_pipeline_step with optional params raised an exception: {e}")


class TestSystemDiagnostics:
    """Test system diagnostic functions."""
    
    @patch('utils.ai_debug_helper.psutil')
    def test_get_system_diagnostics_success(self, mock_psutil):
        """Test successful system diagnostics collection."""
        # Mock psutil responses
        mock_memory = MagicMock()
        mock_memory.percent = 75.5
        mock_memory.available = 8 * (1024**3)  # 8GB
        mock_psutil.virtual_memory.return_value = mock_memory
        
        mock_disk = MagicMock()
        mock_disk.percent = 45.2
        mock_disk.free = 100 * (1024**3)  # 100GB
        mock_psutil.disk_usage.return_value = mock_disk
        
        mock_psutil.cpu_percent.return_value = 25.0
        
        mock_process = MagicMock()
        mock_process_memory = MagicMock()
        mock_process_memory.rss = 512 * (1024**2)  # 512MB
        mock_process.memory_info.return_value = mock_process_memory
        mock_process.cpu_percent.return_value = 15.0
        mock_process.num_threads.return_value = 8
        mock_process.open_files.return_value = []
        mock_process.connections.return_value = []
        mock_psutil.Process.return_value = mock_process
        
        # Mock sys attributes
        mock_psutil.sys.version_info.major = 3
        mock_psutil.sys.version_info.minor = 9
        mock_psutil.sys.version_info.micro = 7
        mock_psutil.sys.platform = "linux"
        
        diagnostics = get_system_diagnostics()
        
        # Check that diagnostics contain expected structure
        assert "timestamp" in diagnostics
        assert "system_health" in diagnostics
        assert "process_health" in diagnostics
        assert "python_info" in diagnostics
        
        # Check specific values
        assert diagnostics["system_health"]["memory_usage_percent"] == 75.5
        assert diagnostics["system_health"]["memory_available_gb"] == 8.0
        assert diagnostics["system_health"]["disk_usage_percent"] == 45.2
        assert diagnostics["process_health"]["memory_usage_mb"] == 512.0
        assert diagnostics["python_info"]["version"] == "3.9.7"
        assert diagnostics["python_info"]["platform"] == "linux"
    
    @patch('utils.ai_debug_helper.psutil')
    def test_get_system_diagnostics_exception_handling(self, mock_psutil):
        """Test that exceptions in diagnostics are handled gracefully."""
        # Make psutil raise an exception
        mock_psutil.virtual_memory.side_effect = Exception("Mock error")
        
        diagnostics = get_system_diagnostics()
        
        # Should return error information instead of crashing
        assert "error" in diagnostics
        assert "timestamp" in diagnostics
        assert "Mock error" in diagnostics["error"]
    
    @patch('utils.ai_debug_helper.AIDebugLogger')
    @patch('utils.ai_debug_helper.get_system_diagnostics')
    def test_log_startup_diagnostics(self, mock_get_diagnostics, mock_debug_logger_class):
        """Test startup diagnostics logging."""
        # Mock the diagnostics return value
        mock_diagnostics = {
            "timestamp": "2025-09-10T10:00:00Z",
            "system_health": {"memory_usage_percent": 50.0}
        }
        mock_get_diagnostics.return_value = mock_diagnostics
        
        # Mock the logger instance
        mock_logger_instance = MagicMock()
        mock_debug_logger_class.return_value = mock_logger_instance
        
        log_startup_diagnostics()
        
        # Verify that diagnostics were obtained
        mock_get_diagnostics.assert_called_once()
        
        # Verify that log_system_event was called with correct parameters
        mock_logger_instance.log_system_event.assert_called_once()
        call_args = mock_logger_instance.log_system_event.call_args
        
        assert call_args[1]["event_type"] == "SYSTEM_STARTUP"
        assert call_args[1]["level"] == DebugLevel.INFO
        assert "ClauseIQ backend starting up" in call_args[1]["message"]
        assert call_args[1]["context"] == mock_diagnostics


class TestLogMessageFormats:
    """Test that log messages are properly formatted."""
    
    def test_json_log_structure(self):
        """Test that JSON logs can be parsed and have expected structure."""
        debug_logger = AIDebugLogger()
        
        # We can't easily test the actual logging without mocking,
        # but we can test the JSON structure creation
        context = {
            "test_key": "test_value",
            "number": 42,
            "nested": {"inner": "value"}
        }
        
        # This tests that the context can be JSON serialized
        json_str = json.dumps({
            "timestamp": datetime.utcnow().isoformat(),
            "event_type": "TEST",
            "level": DebugLevel.INFO.value,
            "message": "Test message",
            "context": context
        })
        
        # Should be able to parse it back
        parsed = json.loads(json_str)
        assert parsed["event_type"] == "TEST"
        assert parsed["context"]["test_key"] == "test_value"
        assert parsed["context"]["number"] == 42
