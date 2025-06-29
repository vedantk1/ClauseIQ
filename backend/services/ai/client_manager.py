"""
OpenAI client management for ClauseIQ AI services.
Extracted from ai_service.py for better maintainability.
Includes rate limiting to prevent API quota exhaustion.
"""
import asyncio
import logging
from typing import Optional, Dict, Any
from contextlib import asynccontextmanager

# Global client instance and rate limiting
_openai_client: Optional = None
_openai_semaphore: Optional[asyncio.Semaphore] = None
_embedding_semaphore: Optional[asyncio.Semaphore] = None

logger = logging.getLogger(__name__)


def get_openai_client():
    """Get the configured OpenAI client instance."""
    global _openai_client
    
    if _openai_client is None:
        _initialize_client()
    
    return _openai_client


def _initialize_client() -> None:
    """Initialize the OpenAI client with proper error handling and rate limiting."""
    global _openai_client, _openai_semaphore, _embedding_semaphore
    
    try:
        from openai import AsyncOpenAI
        from config.environments import get_environment_config
        
        settings = get_environment_config()
        api_key = settings.ai.openai_api_key

        if api_key and api_key != "your_api_key_here" and api_key.startswith("sk-"):
            _openai_client = AsyncOpenAI(api_key=api_key)
            
            # Initialize rate limiting semaphores
            # Limit concurrent OpenAI API calls to prevent rate limiting
            _openai_semaphore = asyncio.Semaphore(10)  # Max 10 concurrent general API calls
            _embedding_semaphore = asyncio.Semaphore(20)  # Max 20 concurrent embedding calls (they're lighter)
            
            logger.info("OpenAI client initialized successfully with rate limiting")
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
    global _openai_client, _openai_semaphore, _embedding_semaphore
    _openai_client = None
    _openai_semaphore = None
    _embedding_semaphore = None


@asynccontextmanager
async def rate_limited_openai_call():
    """Context manager for rate-limited OpenAI API calls."""
    if _openai_semaphore is None:
        # Fallback if semaphore not initialized
        yield get_openai_client()
        return
    
    async with _openai_semaphore:
        logger.debug("Acquired OpenAI API semaphore")
        try:
            yield get_openai_client()
        finally:
            logger.debug("Released OpenAI API semaphore")


@asynccontextmanager
async def rate_limited_embedding_call():
    """Context manager for rate-limited OpenAI embedding API calls."""
    if _embedding_semaphore is None:
        # Fallback if semaphore not initialized
        yield get_openai_client()
        return
    
    async with _embedding_semaphore:
        logger.debug("Acquired OpenAI embedding semaphore")
        try:
            yield get_openai_client()
        finally:
            logger.debug("Released OpenAI embedding semaphore")


async def safe_openai_call(call_func, *args, **kwargs):
    """
    Safe wrapper for OpenAI API calls with rate limiting and error handling.
    
    Args:
        call_func: The OpenAI API function to call
        *args, **kwargs: Arguments to pass to the API function
    
    Returns:
        API response or None if error occurred
    """
    try:
        async with rate_limited_openai_call() as client:
            if client is None:
                logger.error("OpenAI client not available")
                return None
            
            result = await call_func(client, *args, **kwargs)
            logger.debug(f"OpenAI API call successful: {call_func.__name__}")
            return result
            
    except Exception as e:
        logger.error(f"OpenAI API call failed ({call_func.__name__}): {e}")
        return None


async def safe_embedding_call(call_func, *args, **kwargs):
    """
    Safe wrapper for OpenAI embedding API calls with rate limiting and error handling.
    
    Args:
        call_func: The OpenAI embedding API function to call
        *args, **kwargs: Arguments to pass to the API function
    
    Returns:
        API response or None if error occurred
    """
    try:
        async with rate_limited_embedding_call() as client:
            if client is None:
                logger.error("OpenAI client not available")
                return None
            
            result = await call_func(client, *args, **kwargs)
            logger.debug(f"OpenAI embedding API call successful: {call_func.__name__}")
            return result
            
    except Exception as e:
        logger.error(f"OpenAI embedding API call failed ({call_func.__name__}): {e}")
        return None
