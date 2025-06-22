# 📚 ClauseIQ - Complete Documentation

**AI-Powered Legal Document Analysis Platform**  
**Version**: 3.0 | **Last Updated**: June 22, 2025  
**Status**: Production Ready | **Chat Feature**: ✅ Live

---

## 🎯 **Quick Navigation**

### **👥 For New Users**

- **[What is ClauseIQ?](#what-is-clauseiq)** - Platform overview and capabilities
- **[Getting Started](#quick-start)** - 5-minute setup guide
- **[Using the Platform](#using-clauseiq)** - How to analyze documents and use chat

### **👨‍💻 For Developers**

- **[Development Setup](#development-setup)** - Local environment configuration
- **[Architecture](#architecture)** - System design and components
- **[API Reference](API.md)** - Complete endpoint documentation
- **[Development Workflow](#development-workflow)** - Testing, deployment, and best practices

### **🤖 For AI Agents**

- **[AI Agent Guide](#ai-agent-guide)** - Essential knowledge for automated development
- **[Codebase Structure](#codebase-structure)** - File organization and key components
- **[Common Tasks](#common-development-tasks)** - Frequent development patterns

### **🚀 For DevOps**

- **[Deployment Guide](DEPLOYMENT.md)** - Production deployment instructions
- **[Environment Configuration](#environment-configuration)** - Required variables and setup
- **[Monitoring & Troubleshooting](#troubleshooting)** - Common issues and solutions

---

## 🔍 **What is ClauseIQ?**

ClauseIQ is an intelligent legal document analysis platform that helps users understand complex contracts through AI-powered analysis and interactive document chat.

### **Core Capabilities**

🧠 **AI-Powered Analysis**

- Automatically detects 10+ contract types (Employment, NDAs, Service Agreements, Leases, etc.)
- Intelligent clause extraction using OpenAI GPT models
- Context-aware legal risk assessment
- Choose from 5 AI models (GPT-3.5-turbo to GPT-4o)

💬 **Document Chat (RAG System)**

- Ask natural language questions about uploaded documents
- AI responses with source attribution to specific document sections
- Smart chunking that respects legal document structure
- Persistent chat history and multi-session support

📊 **Multi-Contract Support**

- Employment Contracts
- Non-Disclosure Agreements (NDAs)
- Service Agreements
- Lease Agreements
- Purchase Agreements
- Partnership Agreements
- License Agreements
- Consulting Agreements
- Contractor Agreements
- Generic/Other contracts

🔐 **Enterprise Features**

- Secure user authentication with JWT
- Password reset functionality
- User preferences and AI model selection
- Document management and organization

---

## 🚀 **Quick Start**

### **Prerequisites**

- Python 3.13+
- Node.js 18+
- OpenAI API Key
- MongoDB Atlas account (or local MongoDB)
- Pinecone API Key (for chat feature)

### **5-Minute Setup**

```bash
# 1. Clone repository
git clone <repository-url>
cd clauseiq-project

# 2. Backend setup
cd backend
python -m venv venv
source venv/bin/activate  # macOS/Linux
# venv\Scripts\activate    # Windows
pip install -r requirements.txt

# 3. Frontend setup
cd ../frontend
npm install

# 4. Environment configuration
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
# Edit both .env files with your API keys (see Environment Configuration section)

# 5. Start services
# Terminal 1: Backend
cd backend && source venv/bin/activate && python main.py

# Terminal 2: Frontend
cd frontend && npm run dev
```

### **Verification**

- Backend health: http://localhost:8000/health
- Frontend: http://localhost:3000
- Test by uploading a PDF and using the chat feature

---

## 📖 **Using ClauseIQ**

### **Document Upload & Analysis**

1. **Upload Document**: Drag and drop or select a PDF contract
2. **AI Processing**: The system automatically:
   - Detects contract type using AI classification
   - Extracts relevant clauses based on contract context
   - Performs risk assessment
   - Generates comprehensive summary
3. **Review Results**: View analysis with contract-specific insights
4. **Chat with Document**: Ask questions about specific clauses or terms

### **Document Chat System**

The chat feature uses RAG (Retrieval Augmented Generation) to provide accurate, source-attributed answers:

- **Smart Chunking**: Documents are intelligently split while preserving legal structure
- **Vector Search**: High-accuracy retrieval using OpenAI embeddings
- **Contextual Responses**: AI answers reference specific document sections
- **Multiple Sessions**: Create different chat sessions for focused discussions

### **AI Model Selection**

Users can choose from 5 OpenAI models based on their needs:

- **GPT-3.5-turbo**: Fast, cost-effective for basic analysis
- **GPT-4-turbo**: Balanced performance and accuracy
- **GPT-4o**: Latest model with enhanced reasoning
- **GPT-4o-mini**: Optimized for speed
- **GPT-4**: Maximum accuracy for complex contracts

---

## 🏗️ **Architecture**

### **System Overview**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   AI Services   │
│   (Next.js)     │◄──►│   (FastAPI)     │◄──►│   (OpenAI)      │
│ - React 19 UI   │    │ - PDF Process   │    │ - GPT Models    │
│ - Document Chat │    │ - Auth System   │    │ - Embeddings    │
│ - User Auth     │    │ - API Routes    │    │ - RAG System    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       ▼                       │
         │              ┌─────────────────┐             │
         │              │    Database     │             │
         └──────────────┤    (MongoDB)    │◄────────────┘
                        │ - Documents     │
                        │ - Users         │
                        │ - Chat History  │
                        │ - Preferences   │
                        └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │ Vector Storage  │
                        │   (Pinecone)    │
                        │ - Doc Chunks    │
                        │ - Embeddings    │
                        └─────────────────┘
```

### **Technology Stack**

**Frontend**

- Next.js 15 with App Router
- React 19 with TypeScript
- Tailwind CSS for styling
- Context API for state management

**Backend**

- FastAPI with Python 3.13
- MongoDB Atlas for data storage
- OpenAI API for AI processing
- Pinecone for vector storage
- JWT authentication with bcrypt

**AI Pipeline**

1. **Document Upload** → PDF text extraction
2. **Contract Classification** → OpenAI determines contract type
3. **Clause Extraction** → AI identifies relevant clauses
4. **Risk Assessment** → Context-aware analysis
5. **RAG Processing** → Document chunking and vector storage
6. **Chat Ready** → Interactive Q&A available

---

## � **Development Setup**

### **Local Development Environment**

```bash
# Start both services
npm run dev:all  # If package.json script exists

# Or start individually:
# Terminal 1: Backend
cd backend && source venv/bin/activate && python main.py

# Terminal 2: Frontend
cd frontend && npm run dev
```

### **Environment Configuration**

Create and configure these environment files:

**Backend (`backend/.env`)**

```env
# AI Services
OPENAI_API_KEY=sk-your-openai-api-key
PINECONE_API_KEY=your-pinecone-api-key

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
MONGODB_DATABASE=clauseiq
MONGODB_COLLECTION=documents

# Authentication
JWT_SECRET_KEY=your-long-random-secret-key
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# Email Service (Gmail SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-specific-password
EMAIL_FROM=your-email@gmail.com
EMAIL_FROM_NAME=ClauseIQ

# Server Configuration
HOST=0.0.0.0
PORT=8000
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# File Upload
MAX_FILE_SIZE_MB=10
ALLOWED_FILE_TYPES=.pdf
```

**Frontend (`frontend/.env.local`)**

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_ENVIRONMENT=development
```

### **Testing**

````bash
# Backend tests
cd backend
pytest                    # Run all tests
pytest tests/test_auth.py # Run specific test file
pytest -v                 # Verbose output

# Frontend tests
cd frontend
npm test                  # Run Jest tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Run with coverage report
---

## 🤖 **AI Agent Guide**

### **Essential Knowledge for Automated Development**

#### **Project Status (June 2025)**
- ✅ **Production Ready**: Full-featured legal document analysis platform
- ✅ **Chat Feature**: Complete RAG implementation with Pinecone vector storage
- ✅ **Multi-Contract Support**: 10+ contract types with AI classification
- ✅ **User Authentication**: JWT-based with password reset functionality
- ✅ **Deployment**: Live on Vercel (frontend) + Render (backend)

#### **Key Technologies & Versions**
- **Backend**: FastAPI, Python 3.13, MongoDB, OpenAI API, Pinecone
- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **AI**: OpenAI GPT models (3.5-turbo to 4o), text-embedding-3-large, RAG system
- **Database**: MongoDB Atlas for documents, Pinecone for vectors
- **Authentication**: JWT with bcrypt password hashing

#### **Development Priorities**
1. **Maintain chat functionality** - Core feature, handle with care
2. **Preserve user authentication** - Security critical
3. **Keep AI integration stable** - Revenue-dependent feature
4. **Document processing pipeline** - Must remain reliable
5. **Error handling** - Graceful degradation when AI unavailable

#### **Code Quality Standards**
- **Type Safety**: Use TypeScript/Python type hints everywhere
- **Error Handling**: Always handle AI API failures gracefully
- **Testing**: Test auth, document processing, and chat features
- **Documentation**: Update this file for major changes
- **Security**: Never log API keys, validate all inputs

### **Common AI Agent Patterns**

**AI Service Calls**
```python
# Always check availability and handle failures
try:
    if not self.ai_service.is_available():
        return {"error": "AI service temporarily unavailable"}

    result = await self.ai_service.process_document(text)
    return result
except Exception as e:
    logger.error(f"AI processing failed: {e}")
    return {"error": "Analysis failed, please try again"}
````

**Database Operations**

```python
# Use MongoDB adapter, handle connection issues
try:
    document = await self.db.get_document(doc_id, user_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document
except Exception as e:
    logger.error(f"Database error: {e}")
    raise HTTPException(status_code=500, detail="Database error")
```

**Authentication Checks**

```python
# Verify tokens, handle expired sessions
@router.get("/protected-endpoint")
async def protected_endpoint(current_user: dict = Depends(get_current_user)):
    # current_user is automatically validated
    return {"user_id": current_user["id"]}
```

---

## 📁 **Codebase Structure**

### **Backend (`/backend`)**

```
├── main.py                    # FastAPI application entry point
├── settings.py                # Configuration and environment variables
├── auth.py                    # Authentication middleware and utilities
├── database/                  # Database layer and adapters
│   ├── factory.py            # Database factory pattern
│   ├── interface.py          # Abstract database interface
│   ├── mongodb_adapter.py    # MongoDB implementation
│   └── service.py            # Database service layer
├── routers/                   # API route handlers
│   ├── auth.py               # Authentication endpoints
│   ├── analysis.py           # Document analysis endpoints
│   └── chat.py               # Chat and RAG endpoints
├── services/                  # Business logic services
│   ├── ai_service.py         # OpenAI integration and AI processing
│   ├── chat_service.py       # Chat session management
│   ├── rag_service.py        # RAG implementation and vector operations
│   ├── pinecone_vector_service.py # Pinecone vector storage
│   └── pdf_service.py        # PDF processing and text extraction
├── models/                    # Data models and schemas
│   ├── auth.py               # User and authentication models
│   ├── document.py           # Document and analysis models
│   └── common.py             # Shared models and enums
├── middleware/                # Request/response middleware
│   ├── api_standardization.py # Standardized API responses
│   └── versioning.py         # API versioning support
└── tests/                     # Test suites
    ├── test_auth.py          # Authentication tests
    ├── test_analysis.py      # Document analysis tests
    └── test_chat.py          # Chat functionality tests
```

### **Frontend (`/frontend/src`)**

```
├── app/                       # Next.js app router pages
│   ├── page.tsx              # Home page with document upload
│   ├── review/page.tsx       # Document review and analysis
│   ├── documents/page.tsx    # Document management
│   ├── chat/[id]/page.tsx    # Document chat interface
│   ├── settings/page.tsx     # User preferences and AI model selection
│   └── layout.tsx            # Root layout with navigation
├── components/                # Reusable React components
│   ├── DocumentChat.tsx      # Chat interface component
│   ├── AuthForm.tsx          # Login/register forms
│   ├── DocumentUpload.tsx    # File upload component
│   └── review/               # Document review components
├── hooks/                     # Custom React hooks
│   ├── useAuthRedirect.tsx   # Authentication routing
│   ├── useDocumentChat.ts    # Chat functionality
│   └── useUserInteractions.ts # User interaction tracking
├── lib/                       # Utility libraries
│   ├── api.ts                # API client with authentication
│   └── utils.ts              # General utilities
├── services/                  # Frontend service layer
│   └── userInteraction.ts    # User interaction service
└── store/                     # State management
    └── appState.tsx          # Global application state
```

### **Shared Types (`/shared`)**

```
├── clauseiq_types/           # Shared TypeScript/Python types
│   ├── common.py            # Python type definitions
│   ├── common.ts            # TypeScript type definitions
│   ├── auth.py/.ts          # Authentication types
│   └── document.py/.ts      # Document and analysis types
└── package.json             # Shared package configuration
```

---

## 🔧 **Development Workflow**

### **Feature Development**

```bash
# 1. Create feature branch
git checkout -b feature/new-feature-name

# 2. Make changes with tests
# Edit code, add tests, update documentation

# 3. Test locally
cd backend && pytest
cd frontend && npm test

# 4. Commit and push
git add .
git commit -m "Add new feature: description"
git push origin feature/new-feature-name

# 5. Create pull request
# Submit PR with clear description and test results
```

### **Testing Strategy**

**Backend Testing**

- Unit tests for services and utilities
- Integration tests for API endpoints
- Authentication and authorization tests
- Database operation tests
- AI service integration tests

**Frontend Testing**

- Component unit tests with Jest and React Testing Library
- User interaction tests
- API integration tests
- Authentication flow tests

**End-to-End Testing**

- Document upload and analysis workflow
- Chat functionality tests
- User registration and login
- Error handling and edge cases

### **Code Review Guidelines**

**Before Submitting PR**

- [ ] All tests pass locally
- [ ] Code follows project conventions
- [ ] Documentation updated if needed
- [ ] No hardcoded secrets or API keys
- [ ] Error handling implemented
- [ ] Type safety maintained

**Review Checklist**

- [ ] Code quality and maintainability
- [ ] Security considerations
- [ ] Performance implications
- [ ] Test coverage adequate
- [ ] Documentation completeness

---

## 🎯 **Common Development Tasks**

### **Adding a New Contract Type**

1. **Update Shared Types**

```python
# shared/clauseiq_types/common.py
class ContractType(str, Enum):
    # ...existing types...
    NEW_TYPE = "new_type"
```

2. **Update AI Service**

```python
# backend/services/ai_service.py
def _get_relevant_clause_types(self, contract_type: ContractType) -> List[ClauseType]:
    mappings = {
        # ...existing mappings...
        ContractType.NEW_TYPE: [ClauseType.CLAUSE1, ClauseType.CLAUSE2],
    }
```

3. **Update Frontend Types**

```typescript
// shared/clauseiq_types/common.ts
export enum ContractType {
  // ...existing types...
  NEW_TYPE = "new_type",
}
```

4. **Add Tests**

```python
# backend/tests/test_analysis.py
def test_new_contract_type_analysis():
    # Test contract type detection and analysis
```

### **Modifying AI Prompts**

1. **Edit Prompts in AI Service**

```python
# backend/services/ai_service.py
async def detect_contract_type(self, text: str) -> ContractType:
    prompt = f"""
    Analyze this legal document and determine its contract type.
    Updated instructions for better accuracy...

    Document text: {text[:2000]}
    """
```

2. **Test with Various Document Types**
3. **Update Token Limits if Necessary**
4. **Document Changes in Commit Message**

### **Adding New API Endpoints**

1. **Create Route Handler**

```python
# backend/routers/new_feature.py
@router.post("/new-endpoint")
async def new_endpoint(
    request: NewRequest,
    current_user: dict = Depends(get_current_user)
):
    # Implementation
    return {"result": "success"}
```

2. **Add Request/Response Models**

```python
# backend/models/new_feature.py
class NewRequest(BaseModel):
    field1: str
    field2: Optional[int] = None

class NewResponse(BaseModel):
    result: str
    data: Optional[dict] = None
```

3. **Implement Business Logic**

```python
# backend/services/new_service.py
class NewService:
    async def process_request(self, request: NewRequest) -> NewResponse:
        # Business logic implementation
```

4. **Add to Main Router**

```python
# backend/main.py
from routers import new_feature
app.include_router(new_feature.router, prefix="/api/v1", tags=["new-feature"])
```

5. **Write Tests**

```python
# backend/tests/test_new_feature.py
async def test_new_endpoint():
    # Test implementation
```

6. **Update API Documentation** (this file)

### **Database Schema Changes**

1. **Update Models**

```python
# backend/models/document.py
class Document(BaseModel):
    # ...existing fields...
    new_field: Optional[str] = None
```

2. **Create Migration Script** (if needed)

```python
# backend/migrations/add_new_field.py
async def migrate_add_new_field():
    # Migration logic
```

3. **Test with Existing Data**
4. **Update Database Service Methods**
5. **Verify Backward Compatibility**

---

## 🚨 **Troubleshooting**

### **Common Issues & Solutions**

#### **Backend Won't Start**

**Symptoms**: Import errors, connection failures, port conflicts

**Solutions**:

```bash
# Check Python version
python --version  # Should be 3.13+

# Verify virtual environment
which python  # Should point to venv/bin/python

# Reinstall dependencies
pip install -r requirements.txt

# Check environment variables
python -c "from settings import get_settings; print('API Key:', get_settings().openai.api_key[:10])"

# Check port availability
lsof -i :8000  # Check if port 8000 is in use
```

#### **Chat Feature Not Working**

**Symptoms**: Chat endpoints return errors, documents not processed for chat

**Solutions**:

```bash
# Check Pinecone connection
python -c "from services.pinecone_vector_service import get_pinecone_vector_service; print('Available:', get_pinecone_vector_service().is_available())"

# Verify document is processed for chat
curl http://localhost:8000/api/v1/chat/{doc_id}/chat/status

# Check OpenAI embeddings
python -c "import openai; print('Embeddings test:', openai.embeddings.create(input='test', model='text-embedding-3-large'))"
```

#### **Authentication Issues**

**Symptoms**: Login failures, token errors, password reset not working

**Solutions**:

```bash
# Check JWT configuration
python -c "from settings import get_settings; print('JWT Secret length:', len(get_settings().jwt_secret_key))"

# Test authentication endpoint
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# Check email service
python -c "from services.email_service import EmailService; print('SMTP configured:', EmailService().smtp_username is not None)"
```

#### **Database Connection Issues**

**Symptoms**: MongoDB connection errors, document save failures

**Solutions**:

```bash
# Test MongoDB connection
python -c "from database.factory import DatabaseFactory; db = DatabaseFactory.get_database(); print('Connected:', db.name)"

# Check database collections
python -c "from database.mongodb_adapter import MongoDBAdapter; adapter = MongoDBAdapter(); print('Collections:', adapter.list_collections())"

# Verify Atlas connection
mongosh "your-mongodb-uri" --eval "db.adminCommand('ping')"
```

#### **AI Service Failures**

**Symptoms**: Analysis failures, timeout errors, quota exceeded

**Solutions**:

```bash
# Check OpenAI API status
curl https://status.openai.com/api/v2/status.json

# Test API key
python -c "import openai; print('Models:', [m.id for m in openai.models.list().data[:3]])"

# Check usage limits
python -c "from services.ai_service import AIService; service = AIService(); print('Available:', service.is_available())"
```

### **Error Codes Reference**

| Code | Description           | Common Causes                         | Solutions                                |
| ---- | --------------------- | ------------------------------------- | ---------------------------------------- |
| 401  | Unauthorized          | Invalid/expired JWT token             | Re-authenticate, check token format      |
| 422  | Validation Error      | Invalid request body                  | Check API documentation, validate inputs |
| 429  | Rate Limited          | Too many AI API requests              | Implement backoff, check quota           |
| 500  | Internal Server Error | AI service failure, DB connection     | Check logs, verify service availability  |
| 503  | Service Unavailable   | OpenAI API down, Pinecone unavailable | Check external service status            |

### **Performance Optimization**

#### **AI API Usage**

- **Monitor Token Usage**: Track OpenAI token consumption to control costs
- **Implement Caching**: Cache AI responses for repeated queries
- **Optimize Prompts**: Use concise prompts to reduce token usage
- **Batch Operations**: Group multiple requests when possible

#### **Database Performance**

- **Indexing**: Ensure proper indexes on frequently queried fields
- **Connection Pooling**: Use MongoDB connection pooling
- **Query Optimization**: Optimize database queries for performance
- **Data Archival**: Archive old documents to maintain performance

#### **Vector Storage**

- **Pinecone Optimization**: Monitor Pinecone usage and storage limits
- **Embedding Efficiency**: Batch embedding operations when possible
- **Index Management**: Optimize Pinecone index configuration
- **Search Performance**: Tune similarity search parameters

---

## 🔒 **Security**

### **Authentication & Authorization**

- JWT tokens with configurable expiration (30 min access, 7 day refresh)
- Secure password hashing using bcrypt
- Rate limiting on authentication endpoints
- Password reset with secure token generation (30 min expiration)

### **API Security**

- Input validation on all endpoints using Pydantic models
- CORS configuration for production environments
- File upload validation and size limits (10MB max, PDF only)
- Request/response middleware for standardization

### **Data Protection**

- Environment variables for all sensitive configuration
- No API keys or credentials in code or logs
- Secure database connections with authentication
- User data isolation (users can only access their own documents)

### **Security Checklist**

**Development**

- [ ] No hardcoded secrets in code
- [ ] Environment variables properly configured
- [ ] Input validation implemented
- [ ] Error messages don't expose internal details
- [ ] Authentication required for protected endpoints

**Production**

- [ ] HTTPS enabled for all communication
- [ ] Strong JWT secret key configured
- [ ] Database connections encrypted
- [ ] File uploads validated and sandboxed
- [ ] Regular security updates applied

---

## � **Production Deployment**

### **Live URLs**

- **Frontend**: https://clauseiq.vercel.app
- **Backend**: https://legal-ai-6ppy.onrender.com
- **API Documentation**: https://legal-ai-6ppy.onrender.com/docs

### **Deployment Stack**

- **Frontend**: Vercel with automatic deployments from GitHub
- **Backend**: Render with automatic deployments from GitHub
- **Database**: MongoDB Atlas (production cluster)
- **Vector Storage**: Pinecone (production index)
- **AI Services**: OpenAI API (production keys)

### **Environment Promotion**

```bash
# Development -> Staging
git push origin develop

# Staging -> Production
git push origin main
```

### **Monitoring & Health Checks**

- Backend health endpoint: `/health`
- Database connection monitoring
- AI service availability checks
- Error rate and performance monitoring
- User activity and system usage tracking

For detailed deployment instructions, see **[DEPLOYMENT.md](DEPLOYMENT.md)**.

---

## 📞 **Support & Contributing**

### **Getting Help**

1. **Check Documentation**: Review this file and linked documents
2. **Search Issues**: Look for existing GitHub issues
3. **Review Logs**: Check backend logs for error details
4. **Test Locally**: Reproduce issues in development environment
5. **Create Issue**: Submit detailed bug report or feature request

### **Contributing**

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for detailed guidelines on:

- Code style and standards
- Pull request process
- Testing requirements
- Development workflow

### **Changelog**

See **[PROJECT_CHANGELOG.md](PROJECT_CHANGELOG.md)** for complete project history and recent changes.

---

## � **System Stats & Metrics**

**Current Capabilities (June 2025)**

- ✅ 10+ Contract Types Supported
- ✅ 5 AI Models Available
- ✅ RAG Chat System Operational
- ✅ Multi-User Authentication
- ✅ Production Deployment Active

**Performance Metrics**

- Document Analysis: ~30-60 seconds for standard contracts
- Chat Response Time: ~2-5 seconds per query
- System Uptime: 99%+ (Vercel + Render)
- Supported File Size: Up to 10MB PDFs

**Architecture Scale**

- Backend: Python 3.13, FastAPI, MongoDB Atlas
- Frontend: Next.js 15, React 19, TypeScript
- AI: OpenAI GPT models with Pinecone vector storage
- Authentication: JWT-based with bcrypt security

---

**📚 This documentation serves as the single source of truth for ClauseIQ. Keep it updated with every major change.**

---

_Last Updated: June 22, 2025 | Version 3.0_
