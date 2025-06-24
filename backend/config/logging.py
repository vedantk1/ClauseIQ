"""
🚀 FOUNDATIONAL LOGGING CONFIGURATION
Centralized, robust logging for the entire ClauseIQ backend.
"""
import logging
import logging.handlers
import sys
import os
from datetime import datetime
from typing import Optional


class FoundationalLogger:
    """
    🎯 FOUNDATIONAL: Single source of truth for all application logging.
    No more scattered basicConfig calls - everything goes through here!
    """
    
    _configured = False
    
    @classmethod
    def configure(cls, log_level: str = "INFO", log_dir: str = "logs"):
        """Configure logging for the entire application."""
        if cls._configured:
            return
        
        # Create logs directory
        os.makedirs(log_dir, exist_ok=True)
        
        # Root logger configuration
        root_logger = logging.getLogger()
        root_logger.setLevel(getattr(logging, log_level.upper()))
        
        # Clear any existing handlers
        root_logger.handlers.clear()
        
        # Console handler with colored output
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.INFO)
        console_formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        console_handler.setFormatter(console_formatter)
        root_logger.addHandler(console_handler)
        
        # Application log file (rotating)
        app_log_file = os.path.join(log_dir, "app.log")
        app_file_handler = logging.handlers.RotatingFileHandler(
            app_log_file,
            maxBytes=10*1024*1024,  # 10MB
            backupCount=5
        )
        app_file_handler.setLevel(logging.DEBUG)
        app_file_formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - [%(funcName)s:%(lineno)d] - %(message)s'
        )
        app_file_handler.setFormatter(app_file_formatter)
        root_logger.addHandler(app_file_handler)
        
        # Error log file (only errors and critical)
        error_log_file = os.path.join(log_dir, "error.log")
        error_file_handler = logging.handlers.RotatingFileHandler(
            error_log_file,
            maxBytes=10*1024*1024,  # 10MB
            backupCount=3
        )
        error_file_handler.setLevel(logging.ERROR)
        error_file_handler.setFormatter(app_file_formatter)
        root_logger.addHandler(error_file_handler)
        
        # Configure specific loggers
        cls._configure_auth_logger(log_dir)
        cls._configure_chat_logger(log_dir)
        cls._configure_api_logger(log_dir)
        
        cls._configured = True
        
        # Log the configuration
        logger = logging.getLogger("foundational.logging")
        logger.info("🚀 FOUNDATIONAL LOGGING: Configuration complete")
        logger.info(f"📁 Log directory: {os.path.abspath(log_dir)}")
        logger.info(f"📊 Log level: {log_level}")
        logger.info(f"📝 App logs: {app_log_file}")
        logger.info(f"🚨 Error logs: {error_log_file}")
    
    @classmethod
    def _configure_auth_logger(cls, log_dir: str):
        """Configure dedicated auth logger."""
        auth_logger = logging.getLogger("auth")
        auth_logger.setLevel(logging.DEBUG)
        
        # Auth-specific file handler
        auth_log_file = os.path.join(log_dir, "auth.log")
        auth_file_handler = logging.handlers.RotatingFileHandler(
            auth_log_file,
            maxBytes=5*1024*1024,  # 5MB
            backupCount=3
        )
        auth_file_handler.setLevel(logging.DEBUG)
        auth_formatter = logging.Formatter(
            '%(asctime)s - AUTH - %(levelname)s - [%(funcName)s:%(lineno)d] - %(message)s'
        )
        auth_file_handler.setFormatter(auth_formatter)
        auth_logger.addHandler(auth_file_handler)
        
        # Prevent propagation to avoid duplicate logs
        auth_logger.propagate = False
    
    @classmethod
    def _configure_chat_logger(cls, log_dir: str):
        """Configure dedicated chat logger."""
        chat_logger = logging.getLogger("chat")
        chat_logger.setLevel(logging.DEBUG)
        
        # Chat-specific file handler
        chat_log_file = os.path.join(log_dir, "chat.log")
        chat_file_handler = logging.handlers.RotatingFileHandler(
            chat_log_file,
            maxBytes=5*1024*1024,  # 5MB
            backupCount=3
        )
        chat_file_handler.setLevel(logging.DEBUG)
        chat_formatter = logging.Formatter(
            '%(asctime)s - CHAT - %(levelname)s - [%(funcName)s:%(lineno)d] - %(message)s'
        )
        chat_file_handler.setFormatter(chat_formatter)
        chat_logger.addHandler(chat_file_handler)
        
        # Allow propagation to also log to main app.log
        chat_logger.propagate = True
    
    @classmethod
    def _configure_api_logger(cls, log_dir: str):
        """Configure dedicated API request/response logger."""
        api_logger = logging.getLogger("clauseiq_api")
        api_logger.setLevel(logging.INFO)
        
        # API-specific file handler
        api_log_file = os.path.join(log_dir, "api.log")
        api_file_handler = logging.handlers.RotatingFileHandler(
            api_log_file,
            maxBytes=10*1024*1024,  # 10MB
            backupCount=5
        )
        api_file_handler.setLevel(logging.INFO)
        api_formatter = logging.Formatter(
            '%(asctime)s - API - %(levelname)s - %(message)s'
        )
        api_file_handler.setFormatter(api_formatter)
        api_logger.addHandler(api_file_handler)
        
        # Allow propagation
        api_logger.propagate = True

    @classmethod
    def get_logger(cls, name: str) -> logging.Logger:
        """Get a logger with proper configuration."""
        if not cls._configured:
            cls.configure()
        return logging.getLogger(name)

    @classmethod
    def log_exception(cls, logger: logging.Logger, message: str, exc: Exception):
        """Log exception with full traceback."""
        import traceback
        logger.error(f"{message}: {exc}")
        logger.error(f"Traceback: {traceback.format_exc()}")


def get_foundational_logger(name: str) -> logging.Logger:
    """
    🚀 FOUNDATIONAL: Get a properly configured logger.
    Use this instead of logging.getLogger() throughout the app.
    """
    return FoundationalLogger.get_logger(name)


def log_exception(logger: logging.Logger, message: str, exc: Exception):
    """
    🚀 FOUNDATIONAL: Log exception with full details.
    Use this for consistent exception logging.
    """
    FoundationalLogger.log_exception(logger, message, exc)
