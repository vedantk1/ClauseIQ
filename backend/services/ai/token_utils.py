"""
AI utility functions for token management and text processing.
Extracted from ai_service.py for better maintainability.
"""
from typing import Dict, Any


def _map_model_for_tokenization(model: str) -> str:
    """
    Map custom model names to tiktoken-compatible model names.
    
    Args:
        model: The model name to map
        
    Returns:
        A tiktoken-compatible model name
    """
    model_mapping = {
        "gpt-4.1-nano": "gpt-4",
        "gpt-4.1-mini": "gpt-4", 
        "gpt-4o-mini": "gpt-4",
        "gpt-4o": "gpt-4",
        # Add more mappings as needed
    }
    return model_mapping.get(model, model)


def get_token_count(text: str, model: str = "gpt-4o") -> int:
    """
    Get accurate token count for text using tiktoken.
    
    Args:
        text: Input text to count tokens for
        model: Model name to get appropriate encoding
        
    Returns:
        Exact token count for the text and model
    """
    try:
        import tiktoken
        # Map custom model names to tiktoken-compatible names
        mapped_model = _map_model_for_tokenization(model)
        encoding = tiktoken.encoding_for_model(mapped_model)
        return len(encoding.encode(text))
    except (ImportError, KeyError, ValueError) as e:
        # Fallback to cl100k_base for unknown models or any other error
        try:
            import tiktoken
            encoding = tiktoken.get_encoding("cl100k_base")
            return len(encoding.encode(text))
        except ImportError:
            # Ultimate fallback: rough estimation
            return len(text) // 4


def truncate_text_by_tokens(text: str, max_tokens: int, model: str = "gpt-4o", preserve_sentences: bool = True) -> str:
    """
    Truncate text to stay within token limit while preserving sentence boundaries when possible.
    
    Args:
        text: Input text to truncate
        max_tokens: Maximum allowed tokens
        model: Model to use for tokenization
        preserve_sentences: Whether to try to preserve sentence boundaries
        
    Returns:
        Truncated text that fits within token limit
    """
    if not text:
        return ""
    
    current_tokens = get_token_count(text, model)
    
    if current_tokens <= max_tokens:
        return text
    
    if not preserve_sentences:
        # Simple character-based truncation with binary search
        try:
            import tiktoken
            # Map custom model names to tiktoken-compatible names
            mapped_model = _map_model_for_tokenization(model)
            encoding = tiktoken.encoding_for_model(mapped_model)
            tokens = encoding.encode(text)
            truncated_tokens = tokens[:max_tokens]
            return encoding.decode(truncated_tokens)
        except (ImportError, KeyError, ValueError):
            # Fallback to character estimation
            chars_per_token = 4
            max_chars = max_tokens * chars_per_token
            return text[:max_chars]
    
    # Try to preserve sentence boundaries
    sentences = text.split('. ')
    result = ""
    
    for sentence in sentences:
        candidate = result + sentence + ". " if result else sentence + ". "
        if get_token_count(candidate, model) <= max_tokens:
            result = candidate
        else:
            break
    
    # If we couldn't fit even one sentence, fall back to character truncation
    if not result and sentences:
        try:
            import tiktoken
            # Map custom model names to tiktoken-compatible names
            mapped_model = _map_model_for_tokenization(model)
            encoding = tiktoken.encoding_for_model(mapped_model)
            tokens = encoding.encode(sentences[0])
            truncated_tokens = tokens[:max_tokens]
            result = encoding.decode(truncated_tokens)
        except (ImportError, KeyError, ValueError):
            chars_per_token = 4
            max_chars = max_tokens * chars_per_token
            result = sentences[0][:max_chars]
    
    return result.strip()


def calculate_token_budget(model: str = "gpt-4o", response_tokens: int = 1000, safety_margin: int = None) -> int:
    """
    Calculate maximum input tokens based on model context window and required response tokens.
    
    Args:
        model: Model name to get context window for
        response_tokens: Tokens reserved for model response
        safety_margin: Additional safety buffer (defaults to 10% of context)
        
    Returns:
        Maximum input tokens available
    """
    # Model context windows
    context_windows = {
        "gpt-4": 8192,
        "gpt-4.1-nano": 8192,  # ADDED
        "gpt-4.1-mini": 8192,  # ADDED
        "gpt-4-32k": 32768,
        "gpt-4-turbo": 128000,
        "gpt-4o": 128000,
        "gpt-4o-mini": 128000,
        "text-davinci-003": 4097,
        "text-curie-001": 2049,
    }
    
    max_context = context_windows.get(model, 8192)  # Default to GPT-4 context
    
    if safety_margin is None:
        safety_margin = max(int(max_context * 0.1), 100)  # 10% safety margin, minimum 100 tokens
    
    available_tokens = max_context - response_tokens - safety_margin
    
    return max(available_tokens, 100)  # Ensure minimum 100 tokens


def get_optimal_response_tokens(use_case: str, model: str = "gpt-4o") -> int:
    """
    Get optimal response token allocation for different use cases.
    Maximizes output quality for billion-dollar legal analysis.
    
    Args:
        use_case: Type of analysis (summary, extraction, classification, etc.)
        model: Model being used
    
    Returns:
        Optimal response token count (respects model limits)
    """
    # Base allocations by use case
    base_allocations = {
        "classification": 50,      # Simple classification tasks
        "summary": 2000,          # Comprehensive document summaries  
        "extraction": 8000,       # Detailed clause extraction with relationships (RESTORED)
        "analysis": 5000,         # Deep legal analysis and risk assessment (RESTORED)
        "structured": 3000,       # Structured JSON responses (RESTORED)
    }
    
    base_tokens = base_allocations.get(use_case, 1000)
    
    # Model context windows and MAX COMPLETION TOKENS
    model_limits = {
        "gpt-4": {"context": 8192, "max_completion": 4096}, 
        "gpt-4.1-nano": {"context": 8192, "max_completion": 4096},  # ADDED
        "gpt-4.1-mini": {"context": 8192, "max_completion": 4096},  # ADDED
        "gpt-4-32k": {"context": 32768, "max_completion": 4096},
        "gpt-4-turbo": {"context": 128000, "max_completion": 4096},
        "gpt-4o": {"context": 128000, "max_completion": 16384},
        "gpt-4o-mini": {"context": 128000, "max_completion": 16384},
    }
    
    model_info = model_limits.get(model, {"context": 8192, "max_completion": 4096})
    model_context = model_info["context"]
    max_completion = model_info["max_completion"]
    
    # Scale up response tokens for high-capacity models
    if model_context >= 128000:  # Modern high-capacity
        multiplier = 2.0  # Can afford much richer responses
    elif model_context >= 32000:  # Mid-capacity
        multiplier = 1.5
    else:  # Legacy models
        multiplier = 1.0
    
    optimal_tokens = int(base_tokens * multiplier)
    
    # ENFORCE MODEL COMPLETION LIMITS
    return min(optimal_tokens, max_completion)


def get_model_capabilities(model: str = "gpt-4o") -> Dict[str, Any]:
    """
    Get detailed capabilities for a given model to show users what ClauseIQ can do.
    """
    capabilities = {}
    
    # Calculate capabilities for each use case
    use_cases = ["classification", "summary", "extraction", "analysis", "structured"]
    
    for use_case in use_cases:
        response_tokens = get_optimal_response_tokens(use_case, model)
        input_tokens = calculate_token_budget(model, response_tokens=response_tokens)
        
        # Estimate document capacity
        chars_capacity = input_tokens * 4  # Conservative estimate
        pages_capacity = chars_capacity / 2000  # ~2000 chars per page
        
        capabilities[use_case] = {
            "response_tokens": response_tokens,
            "input_tokens": input_tokens,
            "estimated_pages": round(pages_capacity, 1),
            "estimated_characters": chars_capacity
        }
    
    return {
        "model": model,
        "total_context": calculate_token_budget(model, 0, 0) + 1000,  # Approximate total
        "capabilities": capabilities,
        "competitive_advantage": f"Can analyze {capabilities['extraction']['estimated_pages']:.0f}+ page contracts in full detail"
    }


def print_model_comparison():
    """Print a comparison of model capabilities for strategic planning"""
    models = ["gpt-4", "gpt-4o", "gpt-4o-mini"]
    
    print("\n🚀 ClauseIQ Model Capabilities Analysis")
    print("=" * 80)
    
    for model in models:
        caps = get_model_capabilities(model)
        extraction_caps = caps["capabilities"]["extraction"]
        
        print(f"\n📊 {model.upper()}:")
        print(f"   Contract Analysis: Up to {extraction_caps['estimated_pages']:.0f} pages")
        print(f"   Detailed Extraction: {extraction_caps['response_tokens']:,} response tokens")
        print(f"   Input Capacity: {extraction_caps['input_tokens']:,} tokens")
        print(f"   {caps['competitive_advantage']}")
    
    print("\n💡 Strategic Advantage:")
    best_model = get_model_capabilities("gpt-4o")
    best_pages = best_model["capabilities"]["extraction"]["estimated_pages"]
    print(f"   - Analyze entire {best_pages:.0f}+ page contracts without truncation")
    print(f"   - Comprehensive clause relationship analysis")
    print(f"   - Professional-grade legal insights")
    print(f"   - Competitive differentiation: 'Full document analysis, not snippets'")
