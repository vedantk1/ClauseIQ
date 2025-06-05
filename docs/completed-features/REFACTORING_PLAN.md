# Main.py Refactoring Plan

## Current State

- **File Size**: 1,463 lines
- **Endpoints**: 23 API endpoints
- **Functions**: 52 total functions
- **Models**: 18 Pydantic models
- **Status**: Violates Single Responsibility Principle, difficult to maintain

## Recommended Module Structure

### 1. `main.py` (New - ~50 lines)

**Purpose**: Application entry point and configuration

```python
# Core FastAPI app initialization
# CORS middleware setup
# Module imports and route inclusion
# Startup events
```

### 2. `routers/auth.py` (~300 lines)

**Purpose**: Authentication and user management

- User registration/login
- Token management (access/refresh)
- Password reset functionality
- User preferences and profiles
- Model: Move auth-related models here

### 3. `routers/documents.py` (~400 lines)

**Purpose**: Document processing and management

- Document upload and storage
- Text extraction from PDFs
- Document retrieval and deletion
- Document listing
- Models: Document-related Pydantic models

### 4. `routers/analysis.py` (~350 lines)

**Purpose**: AI-powered document analysis

- Clause extraction and analysis
- Risk assessment
- AI summary generation
- Clause categorization
- Models: Clause, RiskLevel, ClauseType enums

### 5. `routers/analytics.py` (~100 lines)

**Purpose**: Analytics and reporting

- Dashboard statistics
- User activity tracking
- Risk summaries
- Models: Analytics-related models

### 6. `services/ai_service.py` (~200 lines)

**Purpose**: AI processing and OpenAI integration

- Summary generation functions
- Clause analysis with AI
- Model selection logic
- OpenAI client management

### 7. `services/document_service.py` (~150 lines)

**Purpose**: Document processing utilities

- PDF text extraction
- File validation
- Document parsing
- Section/clause extraction logic

### 8. `models/` (Directory)

**Purpose**: Centralized data models

- `models/auth.py` - User, Token, Preferences models
- `models/document.py` - Document, Section, Clause models
- `models/analytics.py` - Analytics data models
- `models/common.py` - Shared enums and base models

## Benefits of Refactoring

### 1. **Maintainability**

- Easier to locate and modify specific functionality
- Reduced cognitive load when working on features
- Clear separation of concerns

### 2. **Testability**

- Individual modules can be tested in isolation
- Easier to mock dependencies
- More focused unit tests

### 3. **Scalability**

- New features can be added to appropriate modules
- Easier to add new routes without cluttering main.py
- Better code organization for team development

### 4. **Code Quality**

- Follows Single Responsibility Principle
- Improves code readability
- Reduces merge conflicts in team development

### 5. **Performance**

- Faster imports (only load what's needed)
- Better code splitting
- Easier to identify performance bottlenecks

## Implementation Strategy

### Phase 1: Setup Module Structure

1. Create `routers/` and `services/` directories
2. Create `models/` directory with organized model files
3. Set up proper imports and dependencies

### Phase 2: Extract Routes

1. Move authentication routes to `routers/auth.py`
2. Move document routes to `routers/documents.py`
3. Move analysis routes to `routers/analysis.py`
4. Move analytics routes to `routers/analytics.py`

### Phase 3: Extract Services

1. Move AI functions to `services/ai_service.py`
2. Move document processing to `services/document_service.py`
3. Update imports across all modules

### Phase 4: Organize Models

1. Move models to appropriate files in `models/`
2. Update imports across all modules
3. Ensure proper model organization

### Phase 5: Update Main.py

1. Simplify main.py to just app initialization
2. Include all routers using `app.include_router()`
3. Keep only essential startup configuration

## Existing Good Practices to Maintain

The project already demonstrates good practices:

- ✅ Separate `auth.py`, `database.py`, `config.py` modules
- ✅ Comprehensive test suite
- ✅ Environment configuration management
- ✅ Email service separation
- ✅ Proper dependency injection with FastAPI

## Priority: HIGH

This refactoring should be prioritized because:

1. **Code Maintainability**: Current 1,463-line file is unwieldy
2. **Team Development**: Multiple developers working on same file causes conflicts
3. **Feature Development**: Adding new features becomes increasingly difficult
4. **Bug Fixing**: Locating and fixing issues takes longer
5. **Code Review**: Large files are harder to review effectively

## Estimated Effort

- **Time**: 1-2 days for experienced developer
- **Risk**: Low (well-established patterns)
- **Testing**: Existing test suite should continue to pass
- **Deployment**: No functional changes, only organizational
