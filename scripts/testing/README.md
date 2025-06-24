# Testing Scripts

This directory contains utility scripts for testing and debugging the ClauseIQ application.

## Scripts

### `test_frontend_cors.js`

- **Purpose**: Test CORS functionality and authentication flow
- **Usage**: `node test_frontend_cors.js`
- **Description**: Simulates frontend API calls to test CORS configuration and auth token handling

### `test_frontend_login.js`

- **Purpose**: Test frontend login form functionality
- **Usage**: Load in browser console or as browser script
- **Description**: Automated testing of login form elements and submission

### `test_real_gate_api.py`

- **Purpose**: Test RAG service and gate decision logic with real API calls
- **Usage**: `python test_real_gate_api.py`
- **Description**: Tests OpenAI API integration and RAG gate decision prompts

## When to Use

These scripts are helpful for:

- Debugging CORS issues during development
- Testing authentication flow changes
- Validating RAG/AI functionality
- Troubleshooting API connectivity
- Regression testing after infrastructure changes

## Note

These scripts were created during the DocumentChat refactoring and CORS debugging process. They contain working examples of how to properly test the authentication and chat systems.
