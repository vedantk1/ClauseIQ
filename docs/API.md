# 🔌 ClauseIQ API Reference

**Version**: 3.0 | **Last Updated**: June 22, 2025  
**Base URL**: `http://localhost:8000` (development) | `https://legal-ai-6ppy.onrender.com` (production)

## 📋 **Quick Reference**

### **Authentication**

All protected endpoints require an `Authorization: Bearer <token>` header.

### **Content Types**

- **JSON Requests**: `Content-Type: application/json`
- **File Uploads**: `Content-Type: multipart/form-data`

### **Standard Response Format**

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully",
  "timestamp": "2025-06-22T10:30:00Z"
}
```

### **Error Response Format**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": { ... }
  },
  "timestamp": "2025-06-22T10:30:00Z"
}
```

---

## 🔐 **Authentication Endpoints**

### **POST /api/v1/auth/register**

Register a new user account.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "full_name": "John Doe"
}
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_uuid",
      "email": "user@example.com",
      "full_name": "John Doe",
      "created_at": "2025-06-22T10:30:00Z"
    },
    "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
    "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
    "token_type": "bearer"
  },
  "message": "User registered successfully"
}
```

**Errors:**

- `400`: User already exists
- `422`: Invalid email format or password too weak

---

### **POST /api/v1/auth/login**

Authenticate user and receive access tokens.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
    "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
    "token_type": "bearer",
    "expires_in": 1800
  },
  "message": "Login successful"
}
```

**Errors:**

- `401`: Invalid credentials
- `422`: Missing email or password

---

### **POST /api/v1/auth/refresh**

Refresh access token using refresh token.

**Request Body:**

```json
{
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
    "token_type": "bearer",
    "expires_in": 1800
  },
  "message": "Token refreshed successfully"
}
```

---

### **GET /api/v1/auth/me**

Get current authenticated user information.

**Headers:** `Authorization: Bearer <access_token>`

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "user_uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "preferences": {
      "preferred_ai_model": "gpt-4o",
      "theme": "dark"
    },
    "created_at": "2025-06-22T10:30:00Z",
    "last_login": "2025-06-22T15:30:00Z"
  }
}
```

---

### **POST /api/v1/auth/logout**

Invalidate current session tokens.

**Headers:** `Authorization: Bearer <access_token>`

**Response (200):**

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### **POST /api/v1/auth/forgot-password**

Request password reset email.

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Password reset email sent"
}
```

---

### **POST /api/v1/auth/reset-password**

Complete password reset with token from email.

**Request Body:**

```json
{
  "token": "reset_token_from_email",
  "new_password": "newsecurepassword123"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

**Errors:**

- `400`: Invalid or expired token
- `422`: New password doesn't meet requirements

---

## 📄 **Document Analysis Endpoints**

### **POST /api/v1/analysis/analyze-document/**

Upload and analyze a legal document.

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:** `multipart/form-data`

- `file`: PDF file (max 10MB)
- `ai_model` (optional): AI model to use (default: user's preferred model)

**Response (200):**

```json
{
  "success": true,
  "data": {
    "document": {
      "id": "doc_uuid",
      "filename": "contract.pdf",
      "contract_type": "employment",
      "upload_date": "2025-06-22T10:30:00Z",
      "file_size": 2048576,
      "processing_status": "completed",
      "ai_model_used": "gpt-4o"
    },
    "analysis": {
      "contract_type": "employment",
      "contract_type_confidence": 0.95,
      "summary": "This is an employment contract between...",
      "key_terms": [
        {
          "term": "Salary",
          "value": "$75,000 annually",
          "section": "Compensation"
        }
      ],
      "clauses": [
        {
          "type": "termination",
          "content": "Either party may terminate...",
          "risk_level": "medium",
          "explanation": "Standard termination clause with notice requirement"
        }
      ],
      "risk_assessment": {
        "overall_risk": "low",
        "risk_factors": [
          {
            "factor": "Non-compete clause",
            "risk": "medium",
            "explanation": "Broad geographic scope"
          }
        ]
      }
    }
  },
  "message": "Document analyzed successfully"
}
```

**Errors:**

- `400`: Invalid file type or size
- `413`: File too large
- `422`: Missing file or invalid parameters
- `503`: AI service unavailable

---

### **GET /api/v1/analysis/documents**

List user's documents with pagination.

**Headers:** `Authorization: Bearer <access_token>`

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 50)
- `contract_type` (optional): Filter by contract type
- `sort` (optional): Sort field (upload_date, filename)
- `order` (optional): Sort order (asc, desc)

**Response (200):**

```json
{
  "success": true,
  "data": {
    "documents": [
      {
        "id": "doc_uuid",
        "filename": "contract.pdf",
        "contract_type": "employment",
        "upload_date": "2025-06-22T10:30:00Z",
        "file_size": 2048576,
        "processing_status": "completed",
        "has_chat": true,
        "analysis_summary": "Employment contract with standard terms..."
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 5,
      "total_documents": 42,
      "has_next": true,
      "has_previous": false
    }
  }
}
```

---

### **GET /api/v1/analysis/documents/{document_id}**

Get detailed information about a specific document.

**Headers:** `Authorization: Bearer <access_token>`

**Response (200):**

```json
{
  "success": true,
  "data": {
    "document": {
      "id": "doc_uuid",
      "filename": "contract.pdf",
      "contract_type": "employment",
      "upload_date": "2025-06-22T10:30:00Z",
      "file_size": 2048576,
      "processing_status": "completed",
      "ai_model_used": "gpt-4o"
    },
    "analysis": {
      "summary": "Detailed analysis...",
      "clauses": [...],
      "risk_assessment": {...}
    },
    "notes": "User notes about this document"
  }
}
```

**Errors:**

- `404`: Document not found or not owned by user

---

### **DELETE /api/v1/analysis/documents/{document_id}**

Delete a document and all associated data.

**Headers:** `Authorization: Bearer <access_token>`

**Response (200):**

```json
{
  "success": true,
  "message": "Document deleted successfully"
}
```

**Errors:**

- `404`: Document not found or not owned by user

---

### **POST /api/v1/analysis/documents/{document_id}/notes**

Add or update notes for a document.

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:**

```json
{
  "notes": "Updated notes about this contract..."
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Notes updated successfully"
}
```

---

## 💬 **Chat Endpoints**

### **GET /api/v1/chat/{document_id}/chat/status**

Check if document is ready for chat functionality.

**Headers:** `Authorization: Bearer <access_token>`

**Response (200):**

```json
{
  "success": true,
  "data": {
    "chat_available": true,
    "processing_status": "completed",
    "chunks_processed": 15,
    "embedding_status": "ready"
  }
}
```

---

### **POST /api/v1/chat/{document_id}/chat/sessions**

Create a new chat session for a document.

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:**

```json
{
  "session_name": "Contract Review Discussion"
}
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "session_id": "session_uuid",
    "session_name": "Contract Review Discussion",
    "created_at": "2025-06-22T10:30:00Z",
    "message_count": 0
  },
  "message": "Chat session created successfully"
}
```

---

### **GET /api/v1/chat/{document_id}/chat/sessions**

List all chat sessions for a document.

**Headers:** `Authorization: Bearer <access_token>`

**Response (200):**

```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "session_id": "session_uuid",
        "session_name": "Contract Review Discussion",
        "created_at": "2025-06-22T10:30:00Z",
        "last_message_at": "2025-06-22T11:15:00Z",
        "message_count": 8
      }
    ]
  }
}
```

---

### **POST /api/v1/chat/{document_id}/chat/{session_id}/messages**

Send a message in a chat session.

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:**

```json
{
  "message": "What is the termination notice period?",
  "ai_model": "gpt-4o"
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "message_id": "msg_uuid",
    "user_message": "What is the termination notice period?",
    "ai_response": "According to the contract, the termination notice period is 30 days for both parties.",
    "sources": [
      {
        "chunk_id": "chunk_3",
        "content": "Either party may terminate this agreement with thirty (30) days written notice...",
        "relevance_score": 0.92
      }
    ],
    "timestamp": "2025-06-22T10:30:00Z",
    "tokens_used": 150
  },
  "message": "Message sent successfully"
}
```

**Errors:**

- `503`: AI service unavailable
- `400`: Document not processed for chat

---

### **GET /api/v1/chat/{document_id}/chat/{session_id}/messages**

Get chat message history for a session.

**Headers:** `Authorization: Bearer <access_token>`

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Messages per page (default: 20)

**Response (200):**

```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "message_id": "msg_uuid",
        "user_message": "What is the termination notice period?",
        "ai_response": "According to the contract...",
        "sources": [...],
        "timestamp": "2025-06-22T10:30:00Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 3,
      "total_messages": 50
    }
  }
}
```

---

### **DELETE /api/v1/chat/{document_id}/chat/{session_id}**

Delete a chat session and all its messages.

**Headers:** `Authorization: Bearer <access_token>`

**Response (200):**

```json
{
  "success": true,
  "message": "Chat session deleted successfully"
}
```

---

## ⚙️ **User Preferences Endpoints**

### **GET /api/v1/auth/preferences**

Get user preferences and settings.

**Headers:** `Authorization: Bearer <access_token>`

**Response (200):**

```json
{
  "success": true,
  "data": {
    "preferred_ai_model": "gpt-4o",
    "theme": "dark",
    "email_notifications": true,
    "auto_process_uploads": true,
    "default_contract_type": null
  }
}
```

---

### **PUT /api/v1/auth/preferences**

Update user preferences.

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:**

```json
{
  "preferred_ai_model": "gpt-4-turbo",
  "theme": "light",
  "email_notifications": false
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "preferred_ai_model": "gpt-4-turbo",
    "theme": "light",
    "email_notifications": false,
    "auto_process_uploads": true,
    "default_contract_type": null
  },
  "message": "Preferences updated successfully"
}
```

---

### **GET /api/v1/auth/available-models**

Get list of available AI models.

**Headers:** `Authorization: Bearer <access_token>`

**Response (200):**

```json
{
  "success": true,
  "data": {
    "models": [
      {
        "id": "gpt-3.5-turbo",
        "name": "GPT-3.5 Turbo",
        "description": "Fast and efficient for most tasks",
        "cost_tier": "low",
        "max_tokens": 4096
      },
      {
        "id": "gpt-4o",
        "name": "GPT-4o",
        "description": "Latest model with enhanced reasoning",
        "cost_tier": "high",
        "max_tokens": 128000
      }
    ],
    "default_model": "gpt-4o"
  }
}
```

---

## 🏥 **System Health Endpoints**

### **GET /health**

Check system health and service availability.

**Response (200):**

```json
{
  "status": "healthy",
  "timestamp": "2025-06-22T10:30:00Z",
  "services": {
    "database": "healthy",
    "ai_service": "healthy",
    "vector_storage": "healthy",
    "email_service": "healthy"
  },
  "version": "3.0.0"
}
```

---

### **GET /api/v1/system/stats**

Get system statistics (admin only).

**Headers:** `Authorization: Bearer <admin_token>`

**Response (200):**

```json
{
  "success": true,
  "data": {
    "total_users": 1250,
    "total_documents": 15680,
    "documents_processed_today": 45,
    "active_chat_sessions": 12,
    "ai_requests_today": 324,
    "system_uptime": "15 days, 3 hours"
  }
}
```

---

## 🚨 **Error Codes Reference**

| HTTP Code | Error Code            | Description              | Common Solutions            |
| --------- | --------------------- | ------------------------ | --------------------------- |
| 400       | `INVALID_REQUEST`     | Bad request format       | Check request structure     |
| 401       | `UNAUTHORIZED`        | Invalid or missing token | Re-authenticate             |
| 403       | `FORBIDDEN`           | Insufficient permissions | Check user role             |
| 404       | `NOT_FOUND`           | Resource not found       | Verify resource ID          |
| 413       | `FILE_TOO_LARGE`      | File exceeds size limit  | Reduce file size            |
| 422       | `VALIDATION_ERROR`    | Invalid input data       | Check field validation      |
| 429       | `RATE_LIMITED`        | Too many requests        | Implement backoff           |
| 500       | `INTERNAL_ERROR`      | Server error             | Check logs, contact support |
| 503       | `SERVICE_UNAVAILABLE` | External service down    | Check service status        |

---

## 📝 **Request Examples**

### **cURL Examples**

**Login:**

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

**Upload Document:**

```bash
curl -X POST http://localhost:8000/api/v1/analysis/analyze-document/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@contract.pdf" \
  -F "ai_model=gpt-4o"
```

**Send Chat Message:**

```bash
curl -X POST http://localhost:8000/api/v1/chat/doc_id/chat/session_id/messages \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"What are the key terms?","ai_model":"gpt-4o"}'
```

### **JavaScript Examples**

**Authentication:**

```javascript
const response = await fetch("/api/v1/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "user@example.com",
    password: "password123",
  }),
});
const data = await response.json();
```

**File Upload:**

```javascript
const formData = new FormData();
formData.append("file", fileInput.files[0]);
formData.append("ai_model", "gpt-4o");

const response = await fetch("/api/v1/analysis/analyze-document/", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: formData,
});
```

---

## 🔄 **Rate Limits**

| Endpoint Type   | Rate Limit   | Window   |
| --------------- | ------------ | -------- |
| Authentication  | 10 requests  | 1 minute |
| Document Upload | 5 uploads    | 1 minute |
| Chat Messages   | 30 messages  | 1 minute |
| General API     | 100 requests | 1 minute |

---

## 📱 **Response Headers**

**Standard Headers:**

- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Timestamp when rate limit resets
- `X-Process-Time`: Request processing time in seconds
- `X-Request-ID`: Unique request identifier for debugging

---

## 🔧 **SDKs and Integration**

### **Python SDK Example**

```python
import requests

class ClauseIQClient:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.headers = {'Authorization': f'Bearer {token}'}

    def upload_document(self, file_path, ai_model='gpt-4o'):
        with open(file_path, 'rb') as f:
            files = {'file': f}
            data = {'ai_model': ai_model}
            response = requests.post(
                f'{self.base_url}/api/v1/analysis/analyze-document/',
                headers=self.headers,
                files=files,
                data=data
            )
        return response.json()
```

### **TypeScript SDK Example**

```typescript
class ClauseIQAPI {
  constructor(private baseURL: string, private token: string) {}

  async uploadDocument(file: File, aiModel = "gpt-4o") {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("ai_model", aiModel);

    const response = await fetch(
      `${this.baseURL}/api/v1/analysis/analyze-document/`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${this.token}` },
        body: formData,
      }
    );

    return response.json();
  }
}
```

---

**📚 For more information, see the [main documentation](README.md) or visit the interactive API docs at `/docs` when running the backend.**

---

_Last Updated: June 22, 2025 | Version 3.0_
