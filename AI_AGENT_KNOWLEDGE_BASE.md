# 🤖 AI Agent Knowledge Base

**Last Updated:** June 2, 2025  
**Purpose:** Essential knowledge repository for AI coding agents working on the Legal AI project  
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

Legal AI is an employment contract analyzer that helps non-lawyers understand complex legal documents through AI-powered summaries and plain-language explanations.

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
- **Backend:** https://legal-ai-6ppy.onrender.com
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
     https://legal-ai-6ppy.onrender.com/
```

### **Environment Variables:**

**Vercel (Frontend):**

```
NEXT_PUBLIC_API_URL=https://legal-ai-6ppy.onrender.com
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

| Endpoint             | Method | Purpose               | Status     |
| -------------------- | ------ | --------------------- | ---------- |
| `/`                  | GET    | Health check          | ✅ Working |
| `/extract-text/`     | POST   | PDF text extraction   | ✅ Working |
| `/analyze/`          | POST   | Section analysis      | ✅ Working |
| `/process-document/` | POST   | Full AI processing    | ✅ Working |
| `/documents/`        | GET    | List all documents    | ✅ Working |
| `/documents/{id}`    | GET    | Get specific document | ✅ Working |

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

### **Local Development:**

```bash
# Start MongoDB (Docker)
docker-compose -f docker-compose.dev.yml up -d mongodb

# Backend
cd backend
source venv/bin/activate
uvicorn main:app --reload

# Frontend
cd frontend
npm run dev
```

### **Docker Development:**

```bash
docker-compose -f docker-compose.dev.yml up
```

---

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

---

## 📝 AGENT UPDATE LOG

### **June 2, 2025 - Initial Creation**

- Created comprehensive knowledge base for agent continuity
- Documented Render security protection discovery
- Established update protocol for major commits
- Verified all deployment URLs and configurations

### **[Next Agent Update Here]**

- Format: Date - Brief description of changes/discoveries
- Always add new findings and update existing information

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
