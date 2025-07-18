# 🚀 ClauseIQ - Quick Start Guide

**Get up and running with ClauseIQ in 5 minutes**

---

## 📋 **Prerequisites**

- Python 3.13+
- Node.js 18+
- OpenAI API Key
- MongoDB (local installation)
- Pinecone API Key (for chat feature)

---

## ⚡ **5-Minute Setup**

### **1. Clone & Navigate**
```bash
git clone <repository-url>
cd clauseiq-project
```

### **1.5. Install MongoDB (Required)**
```bash
# macOS (using Homebrew)
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb/brew/mongodb-community

# Ubuntu/Debian
sudo apt-get install mongodb
sudo systemctl start mongodb

# Windows
# Download from: https://www.mongodb.com/try/download/community
# Install and start MongoDB service
```

### **2. Backend Setup**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
# venv\Scripts\activate    # Windows
pip install -r requirements.txt
```

### **3. Frontend Setup**
```bash
cd ../frontend
npm install
```

### **4. Environment Configuration**

**Backend** (`backend/.env`):
```env
# AI Services
OPENAI_API_KEY=sk-your-openai-api-key
PINECONE_API_KEY=your-pinecone-api-key

# Database (Local MongoDB)
MONGODB_URI=mongodb://localhost:27017/
MONGODB_DATABASE=clauseiq

# Authentication
JWT_SECRET_KEY=your-long-random-secret-key-change-this-in-production

# Server
CORS_ORIGINS=http://localhost:3000

# Email (optional for password reset)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

**Frontend** (`frontend/.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_ENVIRONMENT=development
```

### **5. Start Services**

**Terminal 1 - Backend:**
```bash
cd backend && source venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 - Frontend:**
```bash
cd frontend && npm run dev
```

---

## ✅ **Verification**

- **Backend Health**: http://localhost:8000/health
- **Frontend**: http://localhost:3000
- **API Docs**: http://localhost:8000/docs

**Test the system:**
1. Open http://localhost:3000
2. Register a new account
3. Upload a PDF contract
4. Verify analysis and chat functionality

---

## 🛠️ **Development Commands**

### **Backend**
```bash
# Run with auto-reload
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Run tests
pytest

# Check health
curl http://localhost:8000/health
```

### **Frontend**
```bash
# Development server
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

---

## 🚀 **Convenience Scripts (Root Level)**

For easier development, use these root-level commands:

```bash
# Start both backend and frontend simultaneously
npm run dev

# Setup both environments from scratch
npm run setup

# Build frontend for production
npm run build

# Run all tests
npm run test

# Individual services
npm run dev:backend    # Backend only
npm run dev:frontend   # Frontend only
```

---

## 🔧 **Common Issues & Solutions**

### **Backend Issues**

**MongoDB Connection Error:**
```bash
# Check your MONGODB_URI in .env
# Ensure IP whitelist includes your IP in MongoDB Atlas
```

**OpenAI API Error:**
```bash
# Verify OPENAI_API_KEY in .env
# Check API key has sufficient credits
```

**Port Already in Use:**
```bash
# Kill process on port 8000
lsof -ti:8000 | xargs kill -9
```

### **Frontend Issues**

**API Connection Error:**
```bash
# Verify NEXT_PUBLIC_API_URL in .env.local
# Ensure backend is running on correct port
```

**Build Errors:**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

---

## 📚 **Next Steps**

- **Development**: Read [ARCHITECTURE.md](ARCHITECTURE.md) for system design
- **API Usage**: Check [API_REFERENCE.md](API_REFERENCE.md) for endpoints
- **Deployment**: See [DEPLOYMENT.md](DEPLOYMENT.md) for production setup
- **Contributing**: Review [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines

---

## 🆘 **Need Help?**

1. **Check Logs**: Backend logs in `backend/logs/`
2. **API Documentation**: http://localhost:8000/docs
3. **Health Check**: http://localhost:8000/health/detailed
4. **Frontend Console**: Browser developer tools

---

**🎉 You're ready to develop with ClauseIQ!** 