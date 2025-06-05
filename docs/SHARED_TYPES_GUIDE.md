# ClauseIQ Shared Types Developer Guide

This guide explains how to effectively work with the shared type system between frontend and backend.

## Quick Start

### 1. Installation

First, install the shared types package in both environments:

```bash
# Run the setup script
./scripts/setup_shared_types.sh
```

Or manually:

```bash
# For frontend
cd frontend
npm install ../shared

# For backend
cd backend
pip install -e ../shared
```

### 2. Importing Types

#### In Frontend (TypeScript)

```typescript
// Import specific types
import { Clause, ClauseType, RiskLevel } from "@clauseiq/shared-types/common";

// Import validation utilities
import {
  validateClause,
  clauseSchema,
} from "@clauseiq/shared-types/validation";
```

#### In Backend (Python)

```python
# Import shared types
from shared.types.common import Clause, ClauseType, RiskLevel

# For API schema utilities
from utils.api_schema import ApiSchema, CrudRouter
```

## Working with Shared Types

### Adding a New Type

1. **Define in Python First**:

   Add to `/shared/types/common.py`:

   ```python
   class NewType(BaseModel):
       id: str
       name: str
       value: int
   ```

2. **Add to TypeScript**:

   Add to `/shared/types/common.ts`:

   ```typescript
   export interface NewType {
     id: string;
     name: string;
     value: number;
   }
   ```

3. **Add Validation Schema** (optional):

   Add to `/shared/types/validation.ts`:

   ```typescript
   export const newTypeSchema = z.object({
     id: z.string(),
     name: z.string(),
     value: z.number(),
   });

   export const validateNewType = (data: unknown): NewType =>
     newTypeSchema.parse(data);
   ```

4. **Verify Synchronization**:

   ```bash
   python scripts/sync_types.py
   ```

### Creating API Endpoints with Shared Types

#### Backend (FastAPI)

```python
from fastapi import APIRouter
from shared.types.common import NewType
from utils.api_schema import ApiSchema

router = APIRouter()

# Create request/response models
CreateNewTypeRequest = ApiSchema.create_request_model(
    NewType, "CreateNewTypeRequest", exclude_fields=["id"])

NewTypeResponse = ApiSchema.create_response_model(
    NewType, "NewTypeResponse")

@router.post("/new-types", response_model=NewTypeResponse)
async def create_new_type(item: CreateNewTypeRequest):
    # Create a new instance
    new_item = NewType(
        id="generated-id",
        name=item.name,
        value=item.value
    )
    return new_item
```

#### Frontend (React)

```typescript
import { useState } from "react";
import { NewType } from "@clauseiq/shared-types/common";
import { validateNewType } from "@clauseiq/shared-types/validation";

export function NewTypeForm() {
  const [name, setName] = useState("");
  const [value, setValue] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch("/api/new-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, value }),
      });

      const data = await response.json();

      // Validate response against shared type
      const validatedData = validateNewType(data);
      console.log("Created:", validatedData);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  return <form onSubmit={handleSubmit}>{/* Form fields */}</form>;
}
```

## Advanced Usage

### Using Generated API Schemas

For complex APIs, use the `CrudRouter`:

```python
from fastapi import APIRouter
from shared.types.common import Section
from utils.api_schema import CrudRouter

router = APIRouter()

# Create a CRUD router for Sections
sections_router = CrudRouter(
    model=Section,
    router=router,
    prefix="/sections",
    tags=["Sections"]
)
```

This automatically creates:

- `POST /sections`
- `GET /sections`
- `GET /sections/{section_id}`
- `PUT /sections/{section_id}`
- `DELETE /sections/{section_id}`

### Type-Safe API Responses in Frontend

```typescript
import { validateSections } from "@clauseiq/shared-types/validation";

// Fetch with validation
async function fetchSections() {
  const response = await fetch("/api/sections");
  const data = await response.json();

  try {
    // This will throw if data doesn't match expected type
    const validSections = validateSections(data.items);
    return validSections;
  } catch (error) {
    console.error("API returned invalid data:", error);
    throw error;
  }
}
```

## Troubleshooting

### Type Mismatch Errors

If you get type errors:

1. Ensure TypeScript and Python types are synchronized
2. Run `python scripts/sync_types.py` to check for discrepancies
3. Update both versions to match
4. Re-install the packages with `./scripts/setup_shared_types.sh`

### Import Errors

If you get import errors in Python:

```
ModuleNotFoundError: No module named 'shared'
```

Ensure the shared directory is in the Python path:

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "shared"))
```

## Best Practices

1. **Single Source of Truth**: Always update both TypeScript and Python definitions when changing a type
2. **Validation**: Use validation utilities for API responses to ensure type safety
3. **Schema Generation**: Use schema utilities to generate request/response models
4. **Keep in Sync**: Run the sync script regularly to verify type consistency
