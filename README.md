# ClauseIQ - AI-Powered Legal Document Analysis

**AI-powered legal document analysis platform with interactive chat**  
**Status**: Production Ready | **Chat Feature**: ✅ Live | **Contract Types**: 10+ Supported

![ClauseIQ Demo](https://img.shields.io/badge/Status-Production%20Ready-green)
![Python](https://img.shields.io/badge/Python-3.13-blue)
![Next.js](https://img.shields.io/badge/Next.js-15.3.3-black)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115.12-009688)
![OpenAI](https://img.shields.io/badge/OpenAI-Powered-412991)

## 🎯 **What is ClauseIQ?**

ClauseIQ transforms complex legal documents into clear, understandable insights through advanced AI analysis and interactive chat functionality.

### **✨ Key Features**

🧠 **Smart Analysis**: Automatically detects contract types and extracts key clauses  
💬 **Document Chat**: Ask questions about your contracts in natural language  
📊 **Multi-Contract Support**: Handles 10+ contract types with specialized analysis  
⚡ **Fast & Accurate**: Powered by OpenAI GPT models with 99%+ uptime  
🔐 **Secure**: Enterprise-grade authentication and data protection

### **🚀 Live Demo**

- **Try it now**: [clauseiq.vercel.app](https://clauseiq.vercel.app)
- **API Documentation**: [legal-ai-6ppy.onrender.com/docs](https://legal-ai-6ppy.onrender.com/docs)

---

## ⚡ **Quick Start**

```bash
# 1. Clone and setup
git clone <repository-url> && cd clauseiq-project

# 2. Backend setup
cd backend && python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# 3. Frontend setup
cd ../frontend && npm install

# 4. Configure environment
cp backend/.env.example backend/.env  # Add your API keys
cp frontend/.env.example frontend/.env.local

# 5. Start services
cd backend && source venv/bin/activate && python main.py  # Terminal 1
cd frontend && npm run dev  # Terminal 2
```

**✅ Verify**: Backend http://localhost:8000/health | Frontend http://localhost:3000

**Prerequisites**: Python 3.13+, Node.js 18+, OpenAI API Key, MongoDB Atlas, Pinecone API Key

---

## 🏗️ **Architecture**

**Frontend**: Next.js 15 + React 19 + TypeScript + Tailwind CSS  
**Backend**: FastAPI + Python 3.13 + MongoDB + OpenAI API  
**AI System**: RAG with Pinecone vector storage + OpenAI embeddings  
**Authentication**: JWT-based with secure password reset  
**Deployment**: Vercel (frontend) + Render (backend) + MongoDB Atlas

---

## 📚 **Documentation**

**📖 Complete Documentation**: **[docs/README.md](docs/README.md)** - Comprehensive guide for all users

### **Quick Links**

- **[🚀 Getting Started](docs/README.md#quick-start)** - 5-minute setup guide
- **[🔌 API Reference](docs/API.md)** - Complete endpoint documentation
- **[🤖 AI Agent Guide](docs/README.md#ai-agent-guide)** - Essential knowledge for automated development
- **[🏗️ Architecture](docs/README.md#architecture)** - System design and components
- **[🚨 Troubleshooting](docs/README.md#troubleshooting)** - Common issues and solutions
- **[🚀 Deployment](docs/DEPLOYMENT.md)** - Production deployment guide

### **For Different Audiences**

- **New Users**: [Platform overview](docs/README.md#what-is-clauseiq) → [How to use](docs/README.md#using-clauseiq)
- **Developers**: [Development setup](docs/README.md#development-setup) → [Workflow](docs/README.md#development-workflow)
- **AI Agents**: [Essential guide](docs/README.md#ai-agent-guide) → [Codebase structure](docs/README.md#codebase-structure)
- **DevOps**: [Deployment guide](docs/DEPLOYMENT.md) → [Environment config](docs/README.md#environment-configuration)

---

## 💼 **Supported Contract Types**

Employment • NDAs • Service Agreements • Leases • Purchase Agreements • Partnership • License • Consulting • Contractor • Generic

Each contract type receives specialized AI analysis with relevant clause extraction and risk assessment.

---

## 🤝 **Contributing**

1. **Read Documentation**: [docs/README.md](docs/README.md) and [CONTRIBUTING.md](docs/CONTRIBUTING.md)
2. **Development Setup**: Follow [development guide](docs/README.md#development-setup)
3. **Submit Changes**: Create feature branch → Add tests → Submit PR
4. **Code Standards**: TypeScript + Python type hints, comprehensive testing

---

## 📊 **Production Status**

**🌐 Live Deployment**

- **Frontend**: https://clauseiq.vercel.app
- **Backend**: https://legal-ai-6ppy.onrender.com
- **API Docs**: https://legal-ai-6ppy.onrender.com/docs

**⚡ System Health**

- **Uptime**: 99%+ (Vercel + Render)
- **AI Models**: 5 available (GPT-3.5 to GPT-4o)
- **Processing Speed**: 30-60 seconds per document
- **Chat Response**: 2-5 seconds per query

---

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**🔗 For complete documentation, setup guides, API reference, and troubleshooting, visit [docs/README.md](docs/README.md)**
