"""
AI services package for ClauseIQ.
Provides modular AI capabilities for contract analysis.
"""

# Re-export main utilities for backward compatibility
from .client_manager import get_openai_client, is_ai_available
from .token_utils import (
    get_token_count, 
    truncate_text_by_tokens, 
    calculate_token_budget,
    get_optimal_response_tokens,
    get_model_capabilities,
    print_model_comparison
)
from .contract_utils import get_relevant_clause_types, get_contract_type_mapping

__all__ = [
    'get_openai_client',
    'is_ai_available', 
    'get_token_count',
    'truncate_text_by_tokens',
    'calculate_token_budget',
    'get_optimal_response_tokens',
    'get_model_capabilities',
    'print_model_comparison',
    'get_relevant_clause_types',
    'get_contract_type_mapping'
]
