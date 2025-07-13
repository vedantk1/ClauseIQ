# 🎯 Cursor AI Context - ClauseIQ Project

**Purpose**: Essential project context for Cursor AI assistance  
**Status**: Production Ready | **Last Updated**: January 2025  
**Version**: 3.0

---

## 🚀 **Project Overview**

ClauseIQ is a **production-ready AI-powered legal document analysis platform** that transforms complex contracts into understandable insights through advanced AI analysis and interactive chat functionality.

### **Live Deployment**
- **Frontend**: https://clauseiq.vercel.app
- **Backend**: https://legal-ai-6ppy.onrender.com
- **API Docs**: https://legal-ai-6ppy.onrender.com/docs

### **Core Technology Stack**
- **Backend**: FastAPI + Python 3.13 + MongoDB + OpenAI API + Pinecone
- **Frontend**: Next.js 15 + React 19 + TypeScript + Tailwind CSS
- **AI System**: RAG with OpenAI GPT models (GPT-4o, GPT-4o-mini, GPT-3.5-turbo)
- **Authentication**: JWT-based with secure password reset
- **Database**: MongoDB Atlas with async connection pooling

---

## 🏗️ **Architecture Quick Reference**

### **Backend Structure** (`/backend`)
```
main.py                    # FastAPI app entry point
routers/                   # API endpoints
├── auth.py               # Authentication (/auth/*)
├── documents.py          # Document CRUD (/documents/*)
├── analysis.py           # AI analysis (/analysis/*)
├── chat.py               # RAG chat (/chat/*)
├── analytics.py          # User analytics (/analytics/*)
└── health.py             # Health checks (/health/*)
services/                  # Business logic
├── ai_service.py         # OpenAI integration
├── rag_service.py        # RAG implementation
├── chat_service.py       # Chat sessions
└── document_service.py   # Document processing
database/                  # Async database layer
├── factory.py            # Database factory
├── mongodb_adapter.py    # MongoDB implementation
└── service.py            # Document service
```

### **Frontend Structure** (`/frontend/src`)
```
app/                       # Next.js App Router
├── review/               # Main contract review workspace
├── documents/            # Document management
├── analytics/            # User analytics dashboard
└── auth/                 # Authentication pages
components/                # Reusable components
├── ContinuousScrollPDFViewer.tsx  # Advanced PDF viewer
├── ReviewSidebar.tsx     # Canva-inspired sidebar
└── review/               # Review-specific components
context/                   # React Context providers
├── AuthContext.tsx       # Authentication state
└── AnalysisContext.tsx   # Document analysis state
```

---

## 🎯 **Key Features**

### **Document Analysis Pipeline**
1. **Upload** → PDF text extraction
2. **Classification** → AI determines contract type (10+ types)
3. **Clause Extraction** → AI identifies relevant clauses
4. **Risk Assessment** → Context-aware analysis
5. **RAG Processing** → Document chunking and vector storage
6. **Chat Ready** → Interactive Q&A available

### **Supported Contract Types**
Employment • NDAs • Service Agreements • Leases • Purchase Agreements • Partnership • License • Consulting • Contractor • Generic

### **AI Models Available**
- **GPT-4o**: Most advanced, highest accuracy
- **GPT-4o-mini**: Optimized for speed and efficiency
- **GPT-4.1-mini**: Balanced performance
- **GPT-3.5-turbo**: Fast and cost-effective

---

## 🔧 **Development Essentials**

### **Environment Setup**
```bash
# Backend
cd backend && python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Frontend  
cd frontend && npm install && npm run dev

# Or use convenience scripts from root:
npm run dev  # Starts both backend and frontend
npm run setup  # Sets up both environments
```

### **Key Environment Variables**
```env
# Backend (.env)
OPENAI_API_KEY=sk-your-key
MONGODB_URI=mongodb+srv://...
PINECONE_API_KEY=your-key
JWT_SECRET_KEY=your-secret

# Frontend (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### **Database Architecture**
- **Modern Async System**: Single `DocumentService` with `MongoDBAdapter`
- **User-Centric**: All operations scoped to user IDs
- **RAG Integration**: Native Pinecone vector storage support
- **Connection Pooling**: Enhanced MongoDB connection management

---

## 🚨 **Critical Development Guidelines**

### **Authentication**
- All protected endpoints require `Authorization: Bearer <token>`
- JWT tokens with refresh mechanism
- User isolation: All operations scoped to `current_user["id"]`

### **API Patterns**
```python
# Standard API response format
return APIResponse(
    success=True,
    data=response_data,
    message="Operation successful"
)

# Error handling
return create_error_response(
    code="ERROR_CODE",
    message="User-friendly error message"
)
```

### **Frontend State Management**
```typescript
// Use context for global state
const { currentDocument, analyzeDocument } = useAnalysis();

// Custom hooks for features
const { documents, loading, error } = useDocumentsData();
```

### **Database Operations**
```python
# Always use async/await
service = get_document_service()
document = await service.get_document_for_user(doc_id, user_id)
```

---

## 🎨 **UI/UX Design System**

### **Professional Legal Aesthetic**
- **Colors**: Deep blues, grays, whites with strategic color coding
- **Typography**: Sans-serif for UI, generous whitespace
- **Risk Communication**: Red (high), Yellow (medium), Green (low)
- **Layout**: Dual-pane (document + analysis), progressive disclosure

### **Key Components**
- **ReviewSidebar**: Canva-inspired collapsible sidebar
- **ContinuousScrollPDFViewer**: Advanced PDF viewer with highlighting
- **DocumentCard**: Professional document display
- **Risk Indicators**: Color-coded risk assessment

---

## 🔍 **Common Development Tasks**

### **Adding New API Endpoint**
1. Create route in appropriate `/routers/` file
2. Add business logic in `/services/`
3. Update API documentation
4. Add authentication with `Depends(get_current_user)`

### **Frontend Component Development**
1. Create component in `/components/`
2. Add to appropriate page in `/app/`
3. Use existing hooks for data fetching
4. Follow Tailwind CSS patterns

### **Database Schema Changes**
1. Update models in `/models/`
2. Add migration in `/database/migrations.py`
3. Update service methods in `/database/service.py`

---

## 🔧 **Common Setup Issues & Solutions**

### **Backend Issues**
```bash
# Missing psutil (monitoring dependency)
pip install psutil

# Python command not found
# Use python3 instead of python on macOS/Linux

# Virtual environment issues
rm -rf venv && python3 -m venv venv && source venv/bin/activate

# Dependency conflicts
pip install --upgrade pip && pip install -r requirements.txt
```

### **Frontend Issues**
```bash
# Node modules conflicts
rm -rf node_modules package-lock.json && npm install

# Port conflicts
# Frontend: 3000, Backend: 8000 (ensure both are free)
```

### **Root Dependencies**
- **Keep**: `package.json` (convenience scripts)
- **Removed**: `node_modules/`, `package-lock.json` (cleaned up)
- **Frontend**: Uses Node.js (no Python venv needed)
- **Backend**: Uses Python venv (required)

---

## 📚 **Documentation Structure**

- **CURSOR_CONTEXT.md** (this file) - Essential AI context
- **QUICK_START.md** - Development setup guide
- **API_REFERENCE.md** - Complete API documentation
- **ARCHITECTURE.md** - Detailed system architecture
- **DEPLOYMENT.md** - Production deployment guide
- **CONTRIBUTING.md** - Development guidelines

---

## 🚀 **Production Status**

- **Uptime**: 99%+ (Vercel + Render)
- **Processing Speed**: 30-60 seconds per document
- **Chat Response**: 2-5 seconds per query
- **Security**: JWT auth, rate limiting, input validation
- **Monitoring**: Performance metrics, error tracking

---

**💡 Pro Tip**: This project is production-ready with sophisticated architecture. Focus on maintaining code quality, security, and the professional legal aesthetic when making changes. 