# ClauseIQ AI Service Migration Guide

## 🎯 Overview

The ClauseIQ AI service has been refactored from a monolithic 948-line file into a modular, maintainable structure. This guide helps developers migrate to the new structure.

## 📁 New Structure

```
services/
├── ai_service.py              # Main orchestrator (723 lines, was 948)
└── ai/
    ├── __init__.py           # Package interface
    ├── client_manager.py     # OpenAI client management
    ├── token_utils.py        # Token counting & text processing
    └── contract_utils.py     # Contract type utilities
```

## 🔄 Migration Examples

### Before (Legacy)

```python
from services.ai_service import (
    is_ai_available,
    get_token_count,
    calculate_token_budget,
    get_optimal_response_tokens
)
```

### After (Recommended)

```python
from services.ai.client_manager import is_ai_available
from services.ai.token_utils import (
    get_token_count,
    calculate_token_budget,
    get_optimal_response_tokens
)
```

## 🛡️ Backward Compatibility

All existing imports continue to work! Legacy wrapper functions are maintained for smooth transition.

## 📊 Benefits

- **24% code reduction** (948 → 723 lines)
- **Better testability** - Each module can be tested independently
- **Improved maintainability** - Clear separation of concerns
- **Enhanced scalability** - Easy to add new AI capabilities
- **Zero downtime migration** - Existing code works unchanged

## 🗂️ Module Details

### `client_manager.py`

- `get_openai_client()` - Get configured OpenAI client
- `is_ai_available()` - Check if AI processing is available
- `reset_client()` - Reset client (useful for testing)

### `token_utils.py`

- `get_token_count(text, model)` - Accurate token counting
- `truncate_text_by_tokens(text, max_tokens, model)` - Smart text truncation
- `calculate_token_budget(model, response_tokens)` - Token budget calculation
- `get_optimal_response_tokens(use_case, model)` - Optimal token allocation
- `get_model_capabilities(model)` - Model capability analysis

### `contract_utils.py`

- `get_relevant_clause_types(contract_type)` - Get clause types for contract
- `get_contract_type_mapping()` - Contract type enum mapping

## 🚀 Recommended Migration Timeline

### Phase 1: Internal Functions (Complete ✅)

Migrate internal imports within functions.

### Phase 2: New Development (Current)

Use new modular imports for all new code.

### Phase 3: Existing Code (Future)

Gradually update existing imports during regular maintenance.

### Phase 4: Legacy Removal (v2.0)

Remove legacy wrapper functions after full migration.

## 🧪 Testing

```bash
# Run comprehensive test suite
python3 test_phase3.py

# Basic structure validation
python3 simple_test.py
```

## ⚠️ Important Notes

- **Main AI functions** (`generate_structured_document_summary`, `detect_contract_type`, etc.) remain in `ai_service.py` for stability
- **API endpoints** continue to work unchanged
- **Performance improved** with lazy loading
- **Dependencies handled gracefully** - works even without OpenAI package

## 🎯 Best Practices

1. **New code:** Always use modular imports
2. **Existing code:** Migrate during regular maintenance
3. **Testing:** Test both old and new imports during transition
4. **Performance:** Modular structure has better startup performance

## 📞 Support

For questions about migration, check:

- `AI_REFACTOR_STATUS.md` - Current migration status
- `test_phase3.py` - Comprehensive test examples
- Legacy wrapper comments in `ai_service.py`
