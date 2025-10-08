# ClauseIQ - AI-Powered Legal Document Analysis

**AI-powered legal document analysis platform with interactive chat**  
**Status**: Production Ready | **Chat Feature**: ✅ Live | **Contract Types**: 10+ Supported

![ClauseIQ Demo](https://img.shields.io/badge/Status-Production%20Ready-green)
![Python](https://img.shields.io/badge/Python-3.13+-blue)
![Next.js](https://img.shields.io/badge/Next.js-15.3.3-black)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115.12-009688)
![OpenAI](https://img.shields.io/badge/OpenAI-Powered-412991)
![Node.js](https://img.shields.io/badge/Node.js-24+-green)

## What is ClauseIQ?

ClauseIQ transforms complex legal documents into clear, understandable insights through advanced AI analysis and interactive chat functionality.

### Key Features

**Smart Analysis**: Automatically detects contract types and extracts key clauses  
**Document Chat**: Ask questions about your contracts in natural language  
**Multi-Contract Support**: Handles 10+ contract types with specialized analysis  
**Fast & Accurate**: Powered by OpenAI GPT models with 99%+ uptime  
**Secure**: Enterprise-grade authentication and data protection

## Features

- **PDF Analysis**: Upload contracts and get AI-powered insights
- **Risk Assessment**: Identify problematic clauses and legal risks
- **Interactive Chat**: Ask questions about your documents
- **Analytics Dashboard**: Track document processing and insights
- **Advanced Search**: Find specific clauses and terms
- **Visual Reports**: Charts and summaries for quick understanding

## Quick Start

### One-Command Setup (Level 3 Automation)

Our advanced setup script automatically handles everything from system prerequisites to project dependencies:

```bash
# Clone the repository
git clone https://github.com/vedantk1/ClauseIQ-Legal-AI-Assitant.git
cd ClauseIQ

# Run the Level 3 automated setup script
./scripts/setup-for-development.sh
```

**What it does automatically:**

- **System Detection** - Detects your OS (macOS, Ubuntu, RHEL, Windows WSL)
- **Package Manager** - Installs/uses brew, apt, dnf, yum, or chocolatey
- **Python 3.8+** - Version check, automatic installation if needed
- **Node.js 18+** - Version check, automatic installation if needed
- **MongoDB** - Community Edition installation and service management
- **Project Setup** - Virtual environment, dependencies, environment files
- **Verification** - Connection testing and health checks

**Supports:** macOS (Intel/M1), Ubuntu/Debian, RHEL/CentOS, Windows WSL

### Manual Setup

#### Prerequisites

- Python 3.13+
- Node.js 24+
- OpenAI API key
- Local MongoDB
- Pinecone API key (for chat feature)

#### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Copy and configure environment
cp ../env-examples/backend.env.example .env
# Edit .env with your API keys
```

#### Frontend Setup

```bash
cd frontend
npm install

# Copy and configure environment
cp ../env-examples/frontend.env.example .env.local
```

#### Start Development Servers

```bash
# Backend (Terminal 1)
cd backend && source venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Frontend (Terminal 2)
cd frontend && npm run dev
```

### Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

---

## Architecture

**Frontend**: Next.js 15 + React 19 + TypeScript + Tailwind CSS  
**Backend**: FastAPI + Python 3.13 + MongoDB + OpenAI API  
**AI System**: RAG with Pinecone vector storage + OpenAI embeddings  
**Authentication**: JWT-based with secure password reset  
**Database**: Local MongoDB

---

## Documentation

**Complete Documentation**: **[docs/README.md](docs/README.md)** - Comprehensive guide for all users

### Quick Links

- **[Getting Started](docs/QUICK_START.md)** - 5-minute setup guide
- **[API Reference](docs/API_REFERENCE.md)** - Complete endpoint documentation
- **[AI Agent Guide](docs/README.md#ai-agent-guide)** - Essential knowledge for automated development
- **[Architecture](docs/README.md#architecture)** - System design and components
- **[Troubleshooting](docs/README.md#troubleshooting)** - Common issues and solutions

### For Different Audiences

- **New Users**: [Platform overview](docs/README.md#what-is-clauseiq) → [How to use](docs/README.md#using-clauseiq)
- **Developers**: [Development setup](docs/README.md#development-setup) → [Workflow](docs/README.md#development-workflow)
- **AI Agents**: [Essential guide](docs/README.md#ai-agent-guide) → [Codebase structure](docs/README.md#codebase-structure)
- **DevOps**: [Environment config](docs/README.md#environment-configuration)

---

## Supported Contract Types

Employment • NDAs • Service Agreements • Leases • Purchase Agreements • Partnership • License • Consulting • Contractor • Generic

Each contract type receives specialized AI analysis with relevant clause extraction and risk assessment.

---

## Contributing

1. **Read Documentation**: [docs/README.md](docs/README.md) and [CONTRIBUTING.md](docs/CONTRIBUTING.md)
2. **Development Setup**: Follow [development guide](docs/README.md#development-setup)
3. **Submit Changes**: Create feature branch → Add tests → Submit PR
4. **Code Standards**: TypeScript + Python type hints, comprehensive testing

---

## Project Goals

This project demonstrates:

- **AI Integration**: Advanced LLM-powered document analysis
- **Full-Stack Development**: Modern React/Next.js frontend with FastAPI backend
- **Vector Search**: RAG implementation with Pinecone vector storage
- **Production Quality**: Enterprise-level authentication, error handling, and monitoring

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**For complete documentation, setup guides, API reference, and troubleshooting, visit [docs/README.md](docs/README.md)**
