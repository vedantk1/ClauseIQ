# 📚 ClauseIQ - Documentation Hub

**AI-Powered Legal Document Analysis Platform**  
**Version**: 3.0 | **Status**: Production Ready | **Last Updated**: January 2025

---

## 🎯 **What is ClauseIQ?**

ClauseIQ is a **production-ready AI-powered legal document analysis platform** that transforms complex contracts into understandable insights through advanced AI analysis and interactive chat functionality.

### **✨ Key Features**

🧠 **Smart Analysis**: Automatically detects 10+ contract types and extracts key clauses  
💬 **Document Chat**: Ask questions about your contracts in natural language  
📊 **Multi-Contract Support**: Employment, NDAs, Service Agreements, Leases, and more  
⚡ **Fast & Accurate**: Powered by OpenAI GPT models with 99%+ uptime  
🔐 **Secure**: Enterprise-grade authentication and data protection

### **🚀 Getting Started**

Follow the [Quick Start Guide](../README.md#quick-start) to run locally.

---

## 📖 **Documentation Navigation**

### **🚀 Getting Started**
- **[CURSOR_CONTEXT.md](CURSOR_CONTEXT.md)** - Essential AI context for development
- **[QUICK_START.md](QUICK_START.md)** - 5-minute setup guide
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Development guidelines

### **🏗️ Technical Documentation**
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Comprehensive system architecture
- **[API_REFERENCE.md](API_REFERENCE.md)** - Complete API endpoint documentation
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Production deployment guide

### **🎨 Design & UX**
- **[DESIGN_PHILOSOPHY.md](DESIGN_PHILOSOPHY.md)** - Legal-specific UI/UX principles

---

## 🛠️ **Quick Setup**

```bash
# 1. Clone and setup
git clone <repository-url> && cd clauseiq-project

# 2. Backend setup
cd backend && python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# 3. Frontend setup
cd ../frontend && npm install

# 4. Configure environment (.env files)
# See QUICK_START.md for details

# 5. Start services
cd backend && python main.py  # Terminal 1
cd frontend && npm run dev     # Terminal 2
```

**✅ Verify**: Backend http://localhost:8000/health | Frontend http://localhost:3000

---

## 🏗️ **Architecture Overview**

**Frontend**: Next.js 15 + React 19 + TypeScript + Tailwind CSS  
**Backend**: FastAPI + Python 3.13 + MongoDB + OpenAI API  
**AI System**: RAG with Pinecone vector storage + OpenAI embeddings  
**Authentication**: JWT-based with secure password reset  
**Database**: MongoDB (local or Atlas)

---

## 💼 **Supported Contract Types**

Employment • NDAs • Service Agreements • Leases • Purchase Agreements • Partnership • License • Consulting • Contractor • Generic

Each contract type receives specialized AI analysis with relevant clause extraction and risk assessment.

---

## 🚀 **Local Development**

**🌐 Development URLs**
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

**⚡ System Features**
- **AI Models**: GPT-4o with fallback options
- **Processing Speed**: 30-60 seconds per document
- **Chat Response**: 2-5 seconds per query
- **Vector Search**: Pinecone-powered semantic search

---

## 🤝 **For Different Audiences**

### **👨‍💻 Developers**
Start with [CURSOR_CONTEXT.md](CURSOR_CONTEXT.md) → [QUICK_START.md](QUICK_START.md) → [ARCHITECTURE.md](ARCHITECTURE.md)

### **🤖 AI Agents**
Essential: [CURSOR_CONTEXT.md](CURSOR_CONTEXT.md) - Contains all critical project context

### **🚀 DevOps**
Deploy with [DEPLOYMENT.md](DEPLOYMENT.md) → Configure with [ARCHITECTURE.md](ARCHITECTURE.md)

### **🎨 Designers**
Understand principles with [DESIGN_PHILOSOPHY.md](DESIGN_PHILOSOPHY.md)

---

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

---

**🎯 For comprehensive technical details, API references, and deployment guides, explore the focused documentation above.**
