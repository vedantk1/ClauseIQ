# ClauseIQ Backend Testing

This directory contains unit tests for the ClauseIQ backend application.

## Test Coverage

The test suite covers the following core components:

### 🏗️ Configuration Tests (`test_config.py`)

- **DatabaseConfig**: MongoDB connection validation, pool size constraints
- **ServerConfig**: Port validation, CORS origins parsing
- **SecurityConfig**: JWT secret validation, token expiry settings
- **AIConfig**: OpenAI API key validation, temperature ranges
- **PineconeConfig**: API key format validation
- **FileUploadConfig**: File type parsing, size limits
- **EmailConfig**: Email address validation

### 📊 Data Model Tests (`test_models.py`)

- **Clause Model**: Pydantic validation, UUID generation, field requirements
- **Enum Validation**: ContractType, ClauseType, RiskLevel value checks
- **User Models**: User and UserPreferences validation
- **RiskSummary**: Numerical data validation

### 🔧 Utility Tests (`test_utils.py`)

- **DebugLevel Enum**: Log level value validation
- **AIDebugLogger**: Logging functionality, exception handling
- **System Diagnostics**: Health check functions, error handling

## Running Tests

### Quick Run

```bash
# From the backend directory
python -m pytest tests/ -v
```

### Using the Test Runner Script

```bash
# From the backend directory
./run_tests.sh
```

### Specific Test Files

```bash
# Test only configuration
python -m pytest tests/test_config.py -v

# Test only models
python -m pytest tests/test_models.py -v

# Test only utilities
python -m pytest tests/test_utils.py -v
```

## Test Statistics

- **Total Tests**: 49
- **Configuration Tests**: 26
- **Model Tests**: 14
- **Utility Tests**: 9
- **Success Rate**: 100% ✅

## Test Categories

Tests are marked with categories for organization:

- `unit`: Individual function/class tests
- `integration`: Multi-component tests
- `slow`: Long-running tests
- `external`: Tests requiring external services

## Dependencies

The test suite uses:

- **pytest**: Testing framework
- **pytest-asyncio**: Async test support
- **unittest.mock**: Mocking capabilities

## Design Philosophy

These tests focus on:

1. **Data Validation**: Ensuring Pydantic models catch invalid inputs
2. **Configuration Safety**: Validating environment variable parsing
3. **Error Handling**: Testing graceful failure scenarios
4. **Core Business Logic**: Testing critical application components

## Adding New Tests

When adding new tests:

1. Place them in the appropriate test file (`test_config.py`, `test_models.py`, etc.)
2. Follow the naming convention: `test_descriptive_name`
3. Use descriptive test class names: `TestComponentName`
4. Include docstrings explaining what each test validates
5. Test both valid and invalid inputs where applicable

## Configuration

Test configuration is managed in `pytest.ini`:

- Verbose output enabled
- Colored output for better readability
- Short traceback format for cleaner error messages
- Test discovery patterns configured

## Coverage Areas

✅ **Implemented**:

- Pydantic model validation
- Configuration parsing and validation
- Utility function error handling
- Enum value verification
- Basic logging functionality

🚧 **Future Enhancements**:

- API endpoint testing with FastAPI TestClient
- Database integration tests with test containers
- Service layer testing with mocked external dependencies
- End-to-end workflow tests
