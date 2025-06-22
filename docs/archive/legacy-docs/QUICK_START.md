# 🚀 ClauseIQ Quick Start Guide

**Last Updated**: June 22, 2025  
**Status**: Production Ready with Full Chat Feature

---

## 📋 **For New Developers**

### **IMMEDIATE SETUP (5 minutes)**

1. **Clone & Install**:

   ```bash
   git clone <repo-url>
   cd clauseiq-project
   # Backend setup
   cd backend && python -m venv venv && source venv/bin/activate
   pip install -r requirements.txt
   # Frontend setup
   cd ../frontend && npm install
   ```

2. **Environment Configuration**:

   ```bash
   # Backend: Copy .env.example to .env and configure:
   cp backend/.env.example backend/.env
   # Add: OPENAI_API_KEY, MONGODB_URI, PINECONE_API_KEY

   # Frontend: Copy .env.example to .env.local
   cp frontend/.env.example frontend/.env.local
   ```

3. **Start Services**:

   ```bash
   # Terminal 1: Backend
   cd backend && source venv/bin/activate && python main.py

   # Terminal 2: Frontend
   cd frontend && npm run dev
   ```

### **VERIFICATION (2 minutes)**

- Backend: http://localhost:8000/health
- Frontend: http://localhost:3000
- Upload a document and test chat feature

---

## 🏗️ **Architecture Overview**

### **Core Components**

- **Backend**: FastAPI + MongoDB + OpenAI + Pinecone
- **Frontend**: Next.js + React + TypeScript
- **AI Features**: Document analysis + RAG chat system
- **Storage**: MongoDB (documents) + Pinecone (vectors)

### **Key Features**

- ✅ Document upload & analysis
- ✅ AI-powered contract type detection
- ✅ Interactive document chat (RAG)
- ✅ Multi-user authentication
- ✅ Risk assessment & analytics

---

## 🤖 **For AI Agents**

### **First Actions**

1. Read [AGENTS.md](./AGENTS.md) for detailed AI agent guidelines
2. Check system status: All services operational
3. Review [TECHNICAL_APPENDIX.md](./TECHNICAL_APPENDIX.md) for architecture
4. Test chat system: Upload doc → Verify chat works

### **Key Files to Know**

- `/backend/services/chat_service.py` - Chat functionality
- `/backend/services/rag_service.py` - RAG implementation
- `/frontend/src/components/DocumentChat.tsx` - Chat UI
- `/backend/routers/chat.py` - Chat API endpoints

---

## 📖 **Additional Documentation**

- **[README.md](../README.md)** - Complete project overview
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Development guidelines
- **[DEPLOYMENT-GUIDE.md](./DEPLOYMENT-GUIDE.md)** - Production deployment
- **[PROJECT_CHANGELOG.md](./PROJECT_CHANGELOG.md)** - Change history

---

**🎯 GOAL**: Get developers productive in under 10 minutes!
