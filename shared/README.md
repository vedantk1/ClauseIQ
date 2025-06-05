# ClauseIQ Shared Types

This package contains shared type definitions used by both the frontend and backend of the ClauseIQ application. This ensures consistency between the TypeScript interfaces used in the frontend and the Python Pydantic models used in the backend.

## Structure

- `types/common.ts` - TypeScript type definitions
- `types/common.py` - Python Pydantic models that correspond to the TypeScript types
- `types/__init__.py` - Python package exports

## Usage

### In Frontend (TypeScript/React)

Import the types directly from the shared package:

```typescript
import {
  Section,
  Clause,
  ClauseType,
  RiskLevel,
} from "@clauseiq/shared-types/common";
```

### In Backend (Python)

Import the models from the shared package:

```python
from shared.types.common import (
    ClauseType,
    RiskLevel,
    Section,
    Clause,
    RiskSummary
)
```

## Type Synchronization

The shared types are defined both in TypeScript and Python to enable type checking in both languages. The structure should remain identical between the two implementations.

To verify that types remain in sync, run:

```bash
python scripts/sync_types.py
```

## Generating TypeScript from Python

To generate TypeScript interfaces from Python Pydantic models:

```bash
python scripts/generate_ts_types.py shared/types/common.py shared/types/generated.ts
```

## Setup

To set up the shared types in both frontend and backend environments:

```bash
./scripts/setup_shared_types.sh
```

This will:

1. Install the shared types package in the frontend
2. Install the shared types package in the backend's virtual environment (if it exists)

## Benefits

- **Single Source of Truth**: Define types once, use everywhere
- **Type Safety**: Catch type mismatches at compile time
- **Developer Experience**: Autocomplete and intellisense for shared types
- **API Consistency**: Ensures frontend and backend share the same data model

## Adding New Types

When adding new types:

1. Add the type to `types/common.py` (Python version)
2. Add the corresponding type to `types/common.ts` (TypeScript version)
3. Run the sync script to verify they match
4. Use the setup script to update installations in frontend and backend

## Integration with Schema Validation

These shared types can be used for API request/response validation with:

- **Frontend**: Zod or other TypeScript validation libraries
- **Backend**: Pydantic model validation in FastAPI endpoints
