# 🤖 AI Agent Knowledge Base

**Last Updated:** June 3, 2025  
**Purpose:** Essential knowledge repository for AI coding agents working on the ClauseIQ project  
**Instructions:** READ THIS FILE FIRST when starting any agent session. UPDATE before every major commit.

---

## 📋 CRITICAL AGENT INSTRUCTIONS

### 🔄 **Agent Workflow:**

1. **ALWAYS READ** this file first before making any changes
2. **UPDATE** this file when you discover important insights
3. **MAINTAIN** this file before every major commit
4. **TIMESTAMP** your updates with date and brief description

### 🚨 **Key Agent Guidelines:**

- **DO NOT** make assumptions - gather context first
- **DO NOT** repeat code in edits - use `// ...existing code...` comments
- **DO** test deployments and configurations before claiming they work
- **DO** document any deployment/configuration discoveries here

---

## 🏗️ PROJECT OVERVIEW

### **What This App Does:**

ClauseIQ is an employment contract analyzer that helps non-lawyers understand complex legal documents through AI-powered summaries and plain-language explanations.

### **Core Workflow:**

1. User uploads PDF employment contract
2. Backend extracts text using `pdfplumber`
3. OpenAI GPT-3.5-turbo generates intelligent summaries
4. Results stored in MongoDB for future retrieval
5. Frontend displays analysis with section breakdowns

### **Architecture:**

- **Frontend:** Next.js 15 + React 19 + TypeScript + Tailwind CSS
- **Backend:** FastAPI + Python 3.13 + MongoDB + OpenAI API
- **Deployment:** Vercel (frontend) + Render (backend)
- **Database:** MongoDB Atlas (migrated from JSON files)

---

## 🚀 DEPLOYMENT STATUS & CONFIGURATION

### **Current Deployment:**

- **Frontend:** https://legalai-by79fe7l0-vedant-khandelwals-projects-4795dd43.vercel.app
- **Backend:** https://clauseiq-6ppy.onrender.com
- **Status:** ✅ BOTH SERVICES RUNNING

### **🔒 CRITICAL DEPLOYMENT DISCOVERY (June 2, 2025):**

**Render Security Protection:** Render blocks direct API calls that don't include proper browser headers. The backend will return 502/503 errors for:

- Direct curl requests without User-Agent
- Requests without proper referer headers
- Bot-like traffic patterns

**Solution:** When testing backend, always include browser-like headers:

```bash
curl -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
     -H "Referer: https://legalai-by79fe7l0-vedant-khandelwals-projects-4795dd43.vercel.app/" \
     https://clauseiq-6ppy.onrender.com/
```

### **Environment Variables:**

**Vercel (Frontend):**

```
NEXT_PUBLIC_API_URL=https://clauseiq-6ppy.onrender.com
NEXT_PUBLIC_MAX_FILE_SIZE_MB=10
```

**Render (Backend):**

```
MONGODB_URI=mongodb+srv://... (Atlas connection)
OPENAI_API_KEY=sk-proj-... (GPT-3.5-turbo access)
CORS_ORIGINS=https://legalai-by79fe7l0-vedant-khandelwals-projects-4795dd43.vercel.app
```

---

## 🗃️ DATABASE & STORAGE

### **MongoDB Migration Status:**

- ✅ **COMPLETED:** Successfully migrated from JSON file storage to MongoDB
- **Database:** `legal_ai` on MongoDB Atlas
- **Collection:** `documents`
- **Schema:** Document validation with indexes on `id`, `upload_date`, `filename`, `processing_status`
- **Test Status:** All 42 tests passing

### **Document Storage Structure:**

```json
{
  "id": "unique-document-id",
  "filename": "contract.pdf",
  "upload_date": "2025-06-02T...",
  "extracted_text": "full document text",
  "sections": [{ "heading": "...", "text": "...", "summary": "..." }],
  "ai_summary": "AI-generated summary",
  "processing_status": "completed"
}
```

---

## 🔌 API ENDPOINTS

| Endpoint             | Method | Purpose               | Status     | Auth Required |
| -------------------- | ------ | --------------------- | ---------- | ------------- |
| `/`                  | GET    | Health check          | ✅ Working | No            |
| `/auth/register`     | POST   | Register new user     | ✅ Working | No            |
| `/auth/login`        | POST   | User login            | ✅ Working | No            |
| `/auth/refresh`      | POST   | Refresh JWT token     | ✅ Working | No            |
| `/auth/me`           | GET    | Get current user info | ✅ Working | Yes           |
| `/extract-text/`     | POST   | PDF text extraction   | ✅ Working | Yes           |
| `/analyze/`          | POST   | Section analysis      | ✅ Working | Yes           |
| `/process-document/` | POST   | Full AI processing    | ✅ Working | Yes           |
| `/documents/`        | GET    | List all documents    | ✅ Working | Yes           |
| `/documents/{id}`    | GET    | Get specific document | ✅ Working | Yes           |

### **Authentication Endpoints:**

The backend uses JSON Web Token (JWT) authentication with access and refresh tokens.

#### 1. **Register User - `/auth/register`**

- **Request Body:** `UserCreate` model
  ```json
  {
    "full_name": "User Name",
    "email": "user@example.com",
    "password": "securepassword123"
  }
  ```
- **Response:** `Token` model with access and refresh tokens
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1...",
    "refresh_token": "eyJhbGciOiJIUzI1...",
    "token_type": "bearer"
  }
  ```

#### 2. **Login User - `/auth/login`**

- **Request Body:** `UserLogin` model
  ```json
  {
    "email": "user@example.com",
    "password": "securepassword123"
  }
  ```
- **Response:** `Token` model with access and refresh tokens

#### 3. **Refresh Token - `/auth/refresh`**

- **Request Body:** `RefreshTokenRequest` model
  ```json
  {
    "refresh_token": "eyJhbGciOiJIUzI1..."
  }
  ```
- **Response:** `Token` model with new access and refresh tokens

#### 4. **Get User Info - `/auth/me`**

- **Headers:** `Authorization: Bearer <access_token>`
- **Response:** `UserResponse` model
  ```json
  {
    "id": "user-uuid",
    "full_name": "User Name",
    "email": "user@example.com"
  }
  ```

---

## 🧪 TESTING

### **Test Coverage:**

- **Backend:** 42 tests passing (pytest)
- **Frontend:** Jest + React Testing Library
- **Database:** Comprehensive MongoDB mocking
- **API:** Full endpoint testing

### **Running Tests:**

```bash
# Backend tests
cd backend && python -m pytest tests/ -v

# Frontend tests
cd frontend && npm test
```

---

## 🔧 DEVELOPMENT SETUP

### **🔧 DEVELOPMENT SETUP**

**CRITICAL: Always use `python3` instead of `python` in this project.**

### **Local Development:**

```bash
# Start MongoDB (Docker)
docker-compose -f docker-compose.dev.yml up -d mongodb

# Backend - IMPORTANT: Use python3, not python
cd backend
source legal_ai_env/bin/activate  # Use legal_ai_env (NOT venv)
python3 -m uvicorn main:app --reload

# Frontend
cd frontend
npm run dev
```

### **Virtual Environment:**

- **ONLY** use `backend/legal_ai_env/` (other virtual environments have been removed)
- **Always** activate before running: `source backend/legal_ai_env/bin/activate`
- **Python version:** 3.13 (confirmed in virtual environment)

### **Docker Development:**

```bash
docker-compose -f docker-compose.dev.yml up
```

---

## 🔒 AUTHENTICATION SYSTEM

### **Auth Architecture:**

- **JWT-based:** Uses access and refresh tokens
- **Access Token Expiry:** 15 minutes
- **Refresh Token Expiry:** 7 days
- **Storage:** User credentials stored in MongoDB with bcrypt password hashing

### **Frontend Auth Integration:**

The frontend uses a React Context (`AuthContext.tsx`) to manage authentication state:

```javascript
// Main auth hooks
const { user, isAuthenticated, login, logout, register } = useAuth();
```

**Token Storage:** Tokens are stored in browser localStorage for persistence across sessions.

**Auto-refresh:** API calls automatically handle token refreshing when access tokens expire.

**Protected Routes:** Routes requiring authentication automatically redirect to login.

```javascript
// Example of a protected component
const ProtectedComponent = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" />;

  return <YourComponent />;
};
```

## ⚠️ KNOWN ISSUES & SOLUTIONS

### **Issue 1: Render Service Hibernation**

- **Problem:** Render free tier hibernates services after 15 minutes
- **Symptom:** 503 errors on first request after inactivity
- **Solution:** Wait 30-60 seconds for service to wake up

### **Issue 2: CORS Configuration**

- **Problem:** Frontend can't connect to backend
- **Solution:** Ensure `CORS_ORIGINS` in backend includes exact Vercel URL

### **Issue 3: File Upload Limits**

- **Problem:** Large PDF uploads fail
- **Solution:** Max 10MB enforced on both frontend and backend

### **Issue 4: JWT Token Refresh**

- **Problem:** Users occasionally logged out due to failed token refresh
- **Symptom:** User session ends unexpectedly
- **Solution:** Fixed in June 3, 2025 update by implementing proper `RefreshTokenRequest` model

---

## 📝 AGENT UPDATE LOG

### **June 3, 2025 - Major Project Cleanup & Authentication Fixes**

- **REMOVED REDUNDANCIES:**

  - Deleted duplicate virtual environment (`backend/venv/`) - kept `legal_ai_env` only
  - Removed obsolete JSON storage files (`backend/documents_storage/`) - MongoDB migration complete
  - Deleted unused `EnhancedTestUpload` component and its test file
  - Cleaned up unused imports in `main.py` (HTTPBearer, json, STORAGE_DIR)
  - Removed redundant DocumentStorage wrapper class

- **FIXED AUTHENTICATION ISSUES:**

  - Registration endpoint now returns tokens (Token model) instead of just user data
  - Added missing `RefreshTokenRequest` model for proper refresh endpoint
  - Added missing `validate_file` function that was being called but not defined
  - Fixed incomplete authentication flow between frontend and backend

- **ESTABLISHED PYTHON3 STANDARD:**
  - Documented requirement to use `python3` instead of `python` throughout project
  - Updated development setup instructions with correct virtual environment path
  - All tests and functionality confirmed working with Python 3.13

### **June 2, 2025 - Initial Creation**

- Created comprehensive knowledge base for agent continuity
- Documented Render security protection discovery
- Established update protocol for major commits
- Verified all deployment URLs and configurations

---

## 🚨 BEFORE MAJOR COMMITS - AGENT CHECKLIST

- [ ] Update this knowledge base with any new discoveries
- [ ] Verify deployment URLs are still correct
- [ ] Test critical API endpoints if backend changes were made
- [ ] Update test status if new tests were added
- [ ] Document any new configuration requirements
- [ ] Add timestamp to update log section

---

**Remember:** This file is the bridge between agent sessions. Keep it updated and comprehensive!
