# 🏗️ ClauseIQ - System Architecture

**Comprehensive technical architecture guide for ClauseIQ**

---

## 🎯 **System Overview**

ClauseIQ is a sophisticated AI-powered legal document analysis platform built with modern async architecture, designed for production-scale legal document processing with enterprise-grade security and performance.

### **High-Level Architecture**

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

---

## 🔧 **Backend Architecture**

### **FastAPI Application Structure**

```
backend/
├── main.py                    # Application entry point & middleware
├── auth.py                    # JWT authentication system
├── routers/                   # API route handlers
│   ├── auth.py               # Authentication endpoints
│   ├── documents.py          # Document CRUD operations
│   ├── analysis.py           # AI analysis endpoints
│   ├── chat.py               # RAG chat functionality
│   ├── analytics.py          # User analytics
│   ├── health.py             # System health checks
│   └── reports.py            # PDF report generation
├── services/                  # Business logic layer
│   ├── ai_service.py         # OpenAI integration
│   ├── rag_service.py        # RAG implementation
│   ├── chat_service.py       # Chat session management
│   ├── document_service.py   # Document processing
│   ├── pdf_service.py        # PDF handling
│   └── pinecone_vector_service.py # Vector operations
├── database/                  # Modern async database layer
│   ├── factory.py            # Database factory pattern
│   ├── interface.py          # Database abstraction
│   ├── mongodb_adapter.py    # MongoDB implementation
│   ├── service.py            # Document service
│   └── migrations.py         # Schema migrations
├── middleware/                # Application middleware
│   ├── monitoring.py         # Performance monitoring
│   ├── security.py           # Security hardening
│   ├── rate_limiter.py       # Rate limiting
│   ├── logging.py            # Request logging
│   └── api_standardization.py # Response formatting
├── models/                    # Pydantic data models
│   ├── auth.py               # User models
│   ├── document.py           # Document models
│   ├── analysis.py           # Analysis models
│   └── common.py             # Shared models
└── config/                    # Configuration management
    ├── environments.py       # Environment configs
    └── logging.py            # Logging setup
```

### **Key Architectural Patterns**

#### **1. Modern Async Database Layer**
```python
# Single async system with connection pooling
service = get_document_service()
document = await service.get_document_for_user(doc_id, user_id)
```

#### **2. Standardized API Responses**
```python
return APIResponse(
    success=True,
    data=response_data,
    message="Operation successful"
)
```

#### **3. Comprehensive Middleware Stack**
- **Security**: Request validation, rate limiting
- **Monitoring**: Performance metrics, error tracking
- **Logging**: Structured request/response logging
- **Standardization**: Consistent API response format

---

## 🎨 **Frontend Architecture**

### **Next.js 15 Application Structure**

```
frontend/src/
├── app/                       # Next.js App Router
│   ├── page.tsx              # Landing page with upload
│   ├── layout.tsx            # Root layout with providers
│   ├── review/               # Contract review workspace
│   │   ├── page.tsx          # Main review interface
│   │   └── [documentId]/     # Document-specific routes
│   ├── documents/            # Document management
│   │   └── page.tsx          # Document library
│   ├── analytics/            # User analytics dashboard
│   │   └── page.tsx          # Analytics interface
│   └── auth/                 # Authentication pages
│       ├── login/            # Login page
│       └── register/         # Registration page
├── components/                # Reusable components
│   ├── PDFViewer.tsx             # Advanced PDF viewer
│   ├── ReviewSidebar.tsx     # Canva-inspired sidebar
│   ├── DocumentChat.tsx      # Chat interface
│   ├── review/               # Review-specific components
│   │   ├── SummaryContent.tsx    # Document summary
│   │   ├── ClausesContent.tsx    # Clause analysis
│   │   └── ChatContent.tsx       # Chat interface
│   ├── documents/            # Document management components
│   │   ├── DocumentCard.tsx      # Document display
│   │   ├── DocumentsGrid.tsx     # Grid layout
│   │   └── DocumentsFilters.tsx  # Filtering UI
│   └── ui/                   # UI primitives
│       ├── Button.tsx        # Button component
│       ├── Modal.tsx         # Modal component
│       └── LoadingStates.tsx # Loading indicators
├── context/                   # React Context providers
│   ├── AuthContext.tsx       # Authentication state
│   └── AnalysisContext.tsx   # Document analysis state
├── hooks/                     # Custom React hooks
│   ├── useAuthRedirect.tsx   # Authentication handling
│   ├── useDocumentsData.tsx  # Document data fetching
│   ├── useClauseFiltering.tsx # Clause filtering
│   └── useUserInteractions.tsx # User interactions
├── lib/                       # Utilities & API client
│   ├── api.ts                # Type-safe API client
│   └── utils.ts              # Utility functions
├── services/                  # Frontend services
│   ├── documentService.ts    # Document operations
│   └── userInteraction.ts    # User interaction tracking
├── store/                     # State management
│   └── appState.tsx          # Centralized state
└── types/                     # TypeScript types
    └── documents.ts          # Document type definitions
```

### **State Management Architecture**

#### **1. Context-Based Global State**
```typescript
// Authentication context
const { user, isAuthenticated, login, logout } = useAuth();

// Document analysis context
const { currentDocument, analyzeDocument, isLoading } = useAnalysis();
```

#### **2. Custom Hooks for Features**
```typescript
// Document management
const { documents, loading, error, retryFetch } = useDocumentsData();

// Clause filtering
const { filteredClauses, searchQuery, setSearchQuery } = useClauseFiltering();
```

#### **3. Component-Level State**
```typescript
// Local UI state
const [isModalOpen, setIsModalOpen] = useState(false);
const [selectedClause, setSelectedClause] = useState<Clause | null>(null);
```

---

## 🤖 **AI System Architecture**

### **Document Processing Pipeline**

```
1. PDF Upload → Text Extraction (pdfplumber)
2. Contract Classification → OpenAI GPT analysis
3. Clause Extraction → AI identifies relevant clauses
4. Risk Assessment → Context-aware analysis
5. RAG Processing → Document chunking & vector storage
6. Chat Ready → Interactive Q&A system
```

### **RAG (Retrieval Augmented Generation) System**

#### **1. Document Chunking**
```python
# Smart chunking preserving legal document structure
chunks = chunk_document(text, chunk_size=1000, overlap=200)
```

#### **2. Vector Storage**
```python
# Pinecone integration for semantic search
embeddings = openai.embeddings.create(
    input=chunks,
    model="text-embedding-3-large"
)
vector_store.upsert(embeddings)
```

#### **3. Query Processing**
```python
# Semantic search + GPT response generation
relevant_chunks = vector_store.query(user_question)
response = openai.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": "You are a legal document expert..."},
        {"role": "user", "content": f"Context: {relevant_chunks}\n\nQuestion: {user_question}"}
    ]
)
```

### **AI Model Selection**

Users can choose from 4 OpenAI models:
- **GPT-4o**: Most advanced, highest accuracy
- **GPT-4o-mini**: Optimized for speed and efficiency  
- **GPT-4.1-mini**: Balanced performance
- **GPT-3.5-turbo**: Fast and cost-effective

---

## 🗄️ **Database Architecture**

### **MongoDB Schema Design**

#### **Users Collection**
```javascript
{
  _id: ObjectId,
  id: "uuid",
  email: "user@example.com",
  hashed_password: "bcrypt_hash",
  full_name: "John Doe",
  preferences: {
    preferred_model: "gpt-4o",
    theme: "dark"
  },
  created_at: ISODate,
  updated_at: ISODate
}
```

#### **Documents Collection**
```javascript
{
  _id: ObjectId,
  id: "uuid",
  user_id: "user_uuid",
  filename: "contract.pdf",
  contract_type: "employment",
  full_text: "extracted_text",
  summary: "ai_generated_summary",
  clauses: [
    {
      id: "clause_uuid",
      type: "termination",
      content: "clause_text",
      risk_level: "medium",
      explanation: "ai_explanation"
    }
  ],
  risk_summary: {
    high: 2,
    medium: 5,
    low: 8
  },
  rag_ready: true,
  pinecone_namespace: "doc_uuid",
  created_at: ISODate,
  updated_at: ISODate
}
```

#### **Chat Sessions Collection**
```javascript
{
  _id: ObjectId,
  session_id: "uuid",
  document_id: "doc_uuid",
  user_id: "user_uuid",
  messages: [
    {
      id: "msg_uuid",
      role: "user",
      content: "What are the termination clauses?",
      timestamp: ISODate
    },
    {
      id: "msg_uuid",
      role: "assistant",
      content: "The termination clauses include...",
      sources: ["chunk_1", "chunk_2"],
      model_used: "gpt-4o",
      timestamp: ISODate
    }
  ],
  created_at: ISODate,
  updated_at: ISODate
}
```

### **Database Connection Management**

#### **Modern Async Pattern**
```python
class DatabaseFactory:
    _instance = None
    
    @classmethod
    async def get_database(cls) -> DatabaseInterface:
        if cls._instance is None:
            cls._instance = await cls.create_database()
        return cls._instance
    
    @classmethod
    async def create_database(cls) -> DatabaseInterface:
        config = ConnectionConfig(
            backend=DatabaseBackend.MONGODB,
            uri=settings.database.uri,
            max_pool_size=20,
            min_pool_size=5
        )
        adapter = MongoDBAdapter(config)
        await adapter.connect()
        return adapter
```

---

## 🔐 **Security Architecture**

### **Authentication System**

#### **JWT Token Management**
```python
# Token creation
access_token = create_access_token(
    data={"sub": user_id},
    expires_delta=timedelta(minutes=30)
)

refresh_token = create_refresh_token(
    data={"sub": user_id},
    expires_delta=timedelta(days=7)
)
```

#### **Password Security**
```python
# bcrypt hashing
hashed_password = get_password_hash(plain_password)
is_valid = verify_password(plain_password, hashed_password)
```

### **Security Middleware Stack**

1. **Rate Limiting**: Prevents API abuse
2. **Input Validation**: Sanitizes all inputs
3. **CORS**: Configured for production domains
4. **Security Headers**: Adds security headers
5. **Request Monitoring**: Tracks suspicious activity

---

## 🚀 **Performance Architecture**

### **Backend Performance**

#### **Async Operations**
```python
# All database operations are async
async def get_document_for_user(doc_id: str, user_id: str):
    return await self.collection.find_one({
        "id": doc_id,
        "user_id": user_id
    })
```

#### **Connection Pooling**
```python
# MongoDB connection pool
config = ConnectionConfig(
    max_pool_size=20,
    min_pool_size=5,
    max_idle_time_ms=600000
)
```

### **Frontend Performance**

#### **Code Splitting**
```typescript
// Dynamic imports for large components
const PDFViewer = dynamic(() => import('./PDFViewer'), {
  loading: () => <LoadingSpinner />
});
```

#### **State Optimization**
```typescript
// Memoized selectors
const filteredDocuments = useMemo(() => 
  documents.filter(doc => doc.title.includes(searchQuery)),
  [documents, searchQuery]
);
```

---

## 📊 **Monitoring & Observability**

### **Performance Metrics**
- Request/response times
- Database query performance
- AI API response times
- Error rates and types

### **Health Checks**
- Database connectivity
- AI service availability
- System resource usage
- Migration status

### **Logging Architecture**
```python
# Structured logging
logger = get_foundational_logger(__name__)
logger.info("Document processed", extra={
    "document_id": doc_id,
    "user_id": user_id,
    "processing_time": duration
})
```

---

## 🔄 **Deployment Architecture**

### **Production Environment**
- **Frontend**: Next.js development server
- **Backend**: FastAPI with uvicorn
- **Database**: Local MongoDB
- **Vector Storage**: Pinecone (managed service)
- **AI Services**: OpenAI API

### **Development Environment**
- **Frontend**: Next.js dev server
- **Backend**: FastAPI with uvicorn
- **Database**: Local MongoDB
- **Vector Storage**: Pinecone development index

---

**This architecture supports enterprise-scale legal document processing with modern async patterns, comprehensive security, and professional-grade performance.** 