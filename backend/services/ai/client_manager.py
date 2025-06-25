"""
OpenAI client management for ClauseIQ AI services.
Extracted from ai_service.py for better maintainability.
"""
from typing import Optional


# Global client instance
_openai_client: Optional = None


def get_openai_client():
    """Get the configured OpenAI client instance."""
    global _openai_client
    
    if _openai_client is None:
        _initialize_client()
    
    return _openai_client


def _initialize_client() -> None:
    """Initialize the OpenAI client with proper error handling."""
    global _openai_client
    
    try:
        from openai import AsyncOpenAI
        from config.environments import get_environment_config
        
        settings = get_environment_config()
        api_key = settings.ai.openai_api_key

        if api_key and api_key != "your_api_key_here" and api_key.startswith("sk-"):
            _openai_client = AsyncOpenAI(api_key=api_key)
            print("OpenAI client initialized successfully")
        elif api_key and api_key != "your_api_key_here":
            print("Warning: Invalid OpenAI API key format. AI-powered summaries will not be available.")
            _openai_client = None
        else:
            print("No valid OpenAI API key provided. AI-powered summaries will not be available.")
            _openai_client = None
    except ImportError:
        print("OpenAI package not available. AI-powered summaries will not be available.")
        _openai_client = None
    except Exception as e:
        print(f"Error initializing OpenAI client: {e}")
        _openai_client = None


def is_ai_available() -> bool:
    """Check if AI processing is available (OpenAI client is configured)"""
    return get_openai_client() is not None


def reset_client() -> None:
    """Reset the client (useful for testing or config changes)"""
    global _openai_client
    _openai_client = None
