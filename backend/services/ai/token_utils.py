"""Local token estimates and configurable task budgets.

Model capacity comes from the model registry. Task budgets are deliberately
separate: choosing a larger-context model must not silently increase spending.
Completion budgets include both visible output and reasoning tokens. Tokenizer
counts describe plain text, not the complete provider-side chat serialization.
"""

import os
import re
from typing import Any, Dict, Optional

from dotenv import dotenv_values

from ai_models.models import AIModelConfig, DEFAULT_MODEL


TASK_COMPLETION_BUDGETS = {
    "classification": 1024,
    "query_gate": 1024,
    "query_rewrite": 2048,
    "chat": 4000,
    "summary": 4000,
    "extraction": 16000,
    "analysis": 10000,
    "structured": 6000,
    "rewrite": 6000,
    "review": 16000,
    "library_answer": 6000,
}
DEFAULT_MAX_INPUT_TOKENS = 100_000
DEFAULT_SAFETY_MARGIN = 2048


def _positive_env_integer(name: str, default: int) -> int:
    """Read process env before cwd .env, matching the application config source."""
    raw = os.getenv(name)
    if raw is None:
        raw = dotenv_values(".env").get(name)
    if raw is None:
        return default
    try:
        value = int(raw)
    except ValueError as error:
        raise ValueError(f"{name} must be a positive integer") from error
    if value <= 0:
        raise ValueError(f"{name} must be a positive integer")
    return value


def _get_encoding(model: str):
    """Use a native tokenizer mapping, or the registered encoding as an estimate.

    Registration is checked first, so an unknown model never inherits another
    model's limits or tokenizer. Missing tokenizer dependencies/vocabulary fail
    visibly instead of falling back to an unreliable character-count heuristic.
    """
    configuration = AIModelConfig.get_model_by_id(model)
    import tiktoken

    try:
        encoding_name = tiktoken.model.encoding_name_for_model(model)
    except KeyError:
        encoding_name = configuration.tokenizer_encoding
    return tiktoken.get_encoding(encoding_name)


def get_token_count(text: str, model: str = DEFAULT_MODEL) -> int:
    """Estimate plain-text tokens; provider message overhead is not included."""
    encoding = _get_encoding(model)
    # Uploaded contracts may contain strings that resemble special tokens.
    # They are ordinary document content, not tokenizer control instructions.
    return len(encoding.encode(text, disallowed_special=()))


def truncate_text_by_tokens(
    text: str,
    max_tokens: int,
    model: str = DEFAULT_MODEL,
    preserve_sentences: bool = True,
) -> str:
    """Return a text prefix within the local token estimate, without new text."""
    AIModelConfig.get_model_by_id(model)
    if max_tokens <= 0 or not text:
        return ""

    encoding = _get_encoding(model)
    tokens = encoding.encode(text, disallowed_special=())
    if len(tokens) <= max_tokens:
        return text

    # A token cut can split a UTF-8 character. Drop the incomplete character
    # rather than introduce a replacement character with a different token cost.
    truncated = encoding.decode(tokens[:max_tokens], errors="ignore")
    if preserve_sentences:
        boundaries = list(re.finditer(r"[.!?][\"')\]]*(?:\s+|$)", truncated))
        if boundaries:
            truncated = truncated[:boundaries[-1].end()].rstrip()

    # Retokenization can change merges at the cut; never append punctuation or
    # claim a bound without checking the exact returned string.
    while truncated and len(encoding.encode(truncated, disallowed_special=())) > max_tokens:
        truncated = truncated[:-1]
    return truncated


def calculate_token_budget(
    model: str = DEFAULT_MODEL,
    response_tokens: int = 1000,
    safety_margin: Optional[int] = None,
) -> int:
    """Input budget bounded by capacity and the configured development cost cap.

    ``AI_MAX_INPUT_TOKENS`` limits the entire estimated input; callers still
    subtract their system prompts and other message content from this budget.
    The safety margin covers estimation/message overhead, not output tokens.
    """
    configuration = AIModelConfig.get_model_by_id(model)
    if response_tokens < 0:
        raise ValueError("response_tokens must not be negative")
    if safety_margin is None:
        safety_margin = DEFAULT_SAFETY_MARGIN
    if safety_margin < 0:
        raise ValueError("safety_margin must not be negative")
    input_cap = _positive_env_integer("AI_MAX_INPUT_TOKENS", DEFAULT_MAX_INPUT_TOKENS)
    available = configuration.context_window - response_tokens - safety_margin
    return max(0, min(input_cap, available))


def get_optimal_response_tokens(use_case: str, model: str = DEFAULT_MODEL) -> int:
    """Get a task completion budget, including reasoning, clamped to capacity."""
    configuration = AIModelConfig.get_model_by_id(model)
    if use_case not in TASK_COMPLETION_BUDGETS:
        raise ValueError(f"Unknown AI task budget: {use_case}")
    budget = _positive_env_integer(
        f"AI_{use_case.upper()}_MAX_COMPLETION_TOKENS",
        TASK_COMPLETION_BUDGETS[use_case],
    )
    return min(budget, configuration.max_output_tokens)


def get_model_capabilities(model: str = DEFAULT_MODEL) -> Dict[str, Any]:
    """Report model limits and task budgets without document-quality guarantees."""
    configuration = AIModelConfig.get_model_by_id(model)
    capabilities = {}
    for use_case in TASK_COMPLETION_BUDGETS:
        response_tokens = get_optimal_response_tokens(use_case, model)
        capabilities[use_case] = {
            "response_tokens": response_tokens,
            "input_tokens": calculate_token_budget(model, response_tokens),
        }
    return {
        "model": model,
        "total_context": configuration.context_window,
        "max_output_tokens": configuration.max_output_tokens,
        "tokenizer_encoding": configuration.tokenizer_encoding,
        "token_counts_are_estimates": True,
        "capabilities": capabilities,
    }


def print_model_comparison():
    """Print registry capacities and configured budgets for local diagnostics."""
    for configuration in AIModelConfig.get_available_models():
        capabilities = get_model_capabilities(configuration.id)
        extraction = capabilities["capabilities"]["extraction"]
        print(
            f"{configuration.id}: context={capabilities['total_context']:,}; "
            f"extraction input budget={extraction['input_tokens']:,}; "
            f"completion budget={extraction['response_tokens']:,} "
            "(including reasoning)"
        )
