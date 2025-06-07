# 🤖 AI Agents Guide - ClauseIQ Project

**Last Updated:** June 7, 2025  
**Purpose:** Central guide for AI coding agents working on ClauseIQ  
**Status:** Production-ready legal document analysis platform

---

## 🚀 Quick Start for New Agents

### **FIRST 5 MINUTES:**

1. **Read this file completely**
2. **Check system status**: `python3 list_users.py`
3. **Test authentication**: `python3 test_auth_system.py`
4. **Verify deployments**: Frontend & Backend URLs in documentation

### **FIRST HOUR:**

1. **Review architecture**: Read `documentation/AI_AGENT_HANDOVER_REPORT.md`
2. **Understand codebase**: Examine `shared/clauseiq_types/common.py`
3. **Test local development**: Start backend + frontend
4. **Familiarize with API**: Review `backend/routers/` structure

---

## 📋 Project Overview

### **What ClauseIQ Does:**

- **Legal document analysis platform** for employment contracts
- **AI-powered summaries** using OpenAI GPT models
- **User authentication** with JWT and password reset
- **Document management** with MongoDB storage
- **Modern web interface** with Next.js + React

### **Current Capabilities:**

- ✅ Employment contract analysis (10 clause types)
- ✅ Section-by-section summaries
- ✅ Risk assessment and recommendations
- ✅ User model selection (5 AI models available)
- ✅ Complete user authentication system
- ✅ Production deployments on Vercel + Render

### **Technology Stack:**

- **Backend**: FastAPI + Python 3.13 + MongoDB Atlas
- **Frontend**: Next.js 15 + React 19 + TypeScript + Tailwind CSS
- **AI**: OpenAI API (GPT-3.5-turbo to GPT-4O)
- **Auth**: JWT tokens + Gmail SMTP
- **Deployment**: Vercel (frontend) + Render (backend)

---

## 🗂️ Critical Files & Structure

### **🔧 Core Data Models:**

```
shared/clauseiq_types/common.py    # Shared type definitions (MOST IMPORTANT)
├── ClauseType enum                # 10 employment clause types
├── Document model                 # Main document structure
├── Clause model                   # Individual clause analysis
└── User/UserPreferences models    # Authentication & settings
```

### **🔙 Backend Key Files:**

```
backend/
├── main.py                       # FastAPI app entry point
├── auth.py                       # JWT authentication logic
├── database.py                   # MongoDB connection
├── services/ai_service.py        # OpenAI integration
├── services/document_service.py  # Document processing
└── routers/                      # API endpoints
    ├── auth.py                   # Auth endpoints (/auth/*)
    ├── analysis.py               # Document analysis (/analyze/)
    └── documents.py              # Document management (/documents/)
```

### **🎨 Frontend Key Files:**

```
frontend/src/
├── app/                          # Next.js 15 app router
│   ├── page.tsx                  # Home/upload page
│   ├── login/page.tsx            # Authentication
│   └── settings/page.tsx         # AI model selection
├── components/                   # Reusable UI components
└── context/AuthContext.tsx       # Authentication state
```

### **📚 Documentation Hub:**

```
documentation/
├── AI_AGENT_HANDOVER_REPORT.md   # Complete project overview (READ FIRST)
├── AI_AGENT_KNOWLEDGE_BASE.md    # Technical reference
├── HANDOVER_CHECKLIST.md         # Verification steps
└── PROJECT_CHANGELOG.md          # Recent changes
```

---

## 🛠️ Common Agent Tasks

### **🔍 Investigation Tasks:**

```bash
# Check system health
python3 list_users.py              # View user accounts
python3 test_auth_system.py        # Test authentication
python3 test_forgot_password_gmail.py  # Test email system

# Start development environment
cd backend && source clauseiq_env/bin/activate && uvicorn main:app --reload
cd frontend && npm run dev
```

### **🧪 Testing Tasks:**

```bash
# Backend tests
cd backend && pytest

# Verify MongoDB migration
python3 verify_migration.py

# Test specific functionality
python3 test_ai_model_selection.py
```

### **🚀 Deployment Tasks:**

- **Frontend**: Auto-deploys from GitHub to Vercel
- **Backend**: Auto-deploys from GitHub to Render
- **Database**: MongoDB Atlas (always available)

---

## 📖 Development Guidelines

### **🎯 Code Standards:**

1. **Type Safety**: Use Pydantic models from `shared/clauseiq_types/common.py`
2. **Error Handling**: Comprehensive try/catch with user-friendly messages
3. **API Design**: Follow existing patterns in `routers/` files
4. **Authentication**: Always use `get_current_user` dependency for protected routes

### **🔄 Making Changes:**

1. **Read existing code** before making changes
2. **Update type definitions** in `shared/clauseiq_types/common.py` if needed
3. **Test locally** before committing
4. **Update documentation** for significant changes
5. **Follow git workflow**: feature branches → main

### **📝 Documentation Standards:**

- **Update PROJECT_CHANGELOG.md** for all changes
- **Maintain AI_AGENT_KNOWLEDGE_BASE.md** for technical updates
- **Keep README.md current** for user-facing changes
- **Use consistent formatting** and clear explanations

---

## 🚨 Emergency Procedures

### **Production Issues:**

1. **Check deployment status**: Vercel + Render dashboards
2. **Test API health**: `curl https://legal-ai-6ppy.onrender.com/`
3. **Check database**: MongoDB Atlas connection
4. **Review logs**: Backend logs in Render dashboard

### **Authentication Problems:**

1. **Test email system**: `python3 test_forgot_password_gmail.py`
2. **Check JWT configuration**: Verify SECRET_KEY in environment
3. **Validate user accounts**: `python3 list_users.py`

### **AI Service Issues:**

1. **Check OpenAI API key**: Test API calls in `services/ai_service.py`
2. **Verify model availability**: Test different AI models
3. **Review token limits**: Check for rate limiting or quota issues

---

## 🔧 Environment & Credentials

### **Critical Environment Variables:**

```env
# Backend (.env)
OPENAI_API_KEY=sk-proj-***                    # OpenAI API access
MONGODB_URI=mongodb+srv://vedant:***@cluster0.vgw0eqn.mongodb.net/
SMTP_USERNAME=clauseiq@gmail.com              # Email service
SMTP_PASSWORD=akul omqd saut awfo             # Gmail app password
JWT_SECRET_KEY=***                            # Token signing

# Frontend (.env.local)
NEXT_PUBLIC_API_URL=https://legal-ai-6ppy.onrender.com
```

### **Production URLs:**

- **Frontend**: https://legalai-eight.vercel.app
- **Backend**: https://legal-ai-6ppy.onrender.com
- **API Docs**: https://legal-ai-6ppy.onrender.com/docs

---

## 🎯 Current Limitations & Expansion Opportunities

### **Known Limitations:**

- ✅ **Employment contracts only** (10 clause types)
- ✅ **PDF files only** (no Word/Excel support)
- ✅ **Local file storage** (no cloud storage)
- ✅ **Single email provider** (Gmail only)

### **Expansion Possibilities:**

1. **Multi-contract types** (NDAs, service agreements, leases)
2. **Enhanced file support** (Word, Excel, image OCR)
3. **Cloud storage integration** (AWS S3, Google Cloud)
4. **Advanced AI features** (clause comparison, contract generation)
5. **Enterprise features** (team management, API access)

---

## 🧠 Agent Best Practices

### **🔍 Before Making Changes:**

1. **Understand the impact**: Review existing functionality
2. **Check dependencies**: Look for shared type usage
3. **Test thoroughly**: Use existing test suite
4. **Consider users**: Maintain backward compatibility

### **💡 Problem-Solving Approach:**

1. **Start with documentation**: Check existing guides first
2. **Use test scripts**: Leverage existing testing utilities
3. **Follow patterns**: Maintain consistency with existing code
4. **Ask specific questions**: Reference specific files and line numbers

### **📊 Monitoring Success:**

- **Test coverage**: Ensure tests pass
- **Production health**: Verify deployments work
- **User experience**: Test critical user flows
- **Documentation quality**: Keep guides current

---

## 📞 Resources & References

### **Documentation Priority Order:**

1. **`AGENTS.md`** (this file) - Agent-specific guidance
2. **`documentation/AI_AGENT_HANDOVER_REPORT.md`** - Complete project overview
3. **`documentation/AI_AGENT_KNOWLEDGE_BASE.md`** - Technical reference
4. **`README.md`** - User setup and project description

### **Technical References:**

- **API Documentation**: `/docs` endpoint (when backend is running)
- **Database Schema**: See `database/init-mongo.js`
- **Type Definitions**: `shared/clauseiq_types/common.py`
- **Environment Setup**: `backend/.env` and `frontend/.env.local`

### **Testing Resources:**

- **Auth Testing**: `test_auth_system.py`
- **Email Testing**: `test_forgot_password_gmail.py`
- **User Management**: `list_users.py`
- **Migration Verification**: `verify_migration.py`

---

## ✅ Agent Checklist

### **New Agent Onboarding:**

- [ ] Read complete `AGENTS.md` file
- [ ] Review `AI_AGENT_HANDOVER_REPORT.md`
- [ ] Test local development environment
- [ ] Verify production deployments
- [ ] Understand authentication system
- [ ] Familiarize with shared type definitions
- [ ] Test critical user flows

### **Before Making Changes:**

- [ ] Understand current functionality
- [ ] Review impact on shared types
- [ ] Test changes locally
- [ ] Update relevant documentation
- [ ] Verify production deployments still work

### **After Making Changes:**

- [ ] Update `PROJECT_CHANGELOG.md`
- [ ] Test all affected functionality
- [ ] Verify documentation is current
- [ ] Confirm production deployments successful

---

**Remember: ClauseIQ is a production-ready platform serving real users. Maintain high standards for code quality, testing, and documentation. When in doubt, test thoroughly and document comprehensively.**

---

_This guide serves as the central reference for AI agents. Keep it current and comprehensive._
