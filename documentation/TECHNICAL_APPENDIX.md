# 🔧 ClauseIQ Technical Appendix

**Supplement to**: AI Agent Handover Report  
**Date**: June 4, 2025

---

## 📋 Quick Start Commands

### Development Environment Setup:

```bash
# Clone and setup
git clone <repository-url>
cd clauseiq-project

# Backend setup
cd backend
python3 -m venv clauseiq_env
source clauseiq_env/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend setup (new terminal)
cd frontend
npm install
npm run dev
```

### Testing Commands:

```bash
# List all user accounts
python3 list_users.py

# Test authentication system
python3 test_auth_system.py

# Test forgot password email
python3 test_forgot_password_gmail.py

# Run backend tests
cd backend && pytest

# Run frontend tests
cd frontend && npm test
```

---

## 🔑 Critical Code Snippets

### 1. Authentication Context (Frontend)

```typescript
// frontend/src/context/AuthContext.tsx
const login = async (email: string, password: string) => {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const { access_token, refresh_token } = await response.json();
  setTokens(access_token, refresh_token);

  // Get user info and update context
  const userResponse = await apiCall("/auth/me");
  const userData = await userResponse.json();
  setUser(userData);
};
```

### 2. Database User Operations (Backend)

```python
# backend/database.py
class MongoDocumentStorage:
    def create_user(self, user_data: Dict[str, Any]) -> str:
        user_data['created_at'] = datetime.utcnow().isoformat()
        user_data['updated_at'] = datetime.utcnow().isoformat()
        result = self.db.users_collection.insert_one(user_data)
        return user_data['id']

    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        user = self.db.users_collection.find_one({"email": email})
        if user:
            user.pop('_id', None)  # Remove MongoDB internal field
        return user
```

### 3. Email Service (Backend)

```python
# backend/email_service.py
async def send_password_reset_email(self, to_email: str, full_name: str, reset_token: str) -> bool:
    reset_url = f"{self.frontend_url}/reset-password?token={reset_token}"

    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif;">
        <h2>Password Reset Request - ClauseIQ</h2>
        <p>Hello {full_name},</p>
        <p>Click the button below to reset your password:</p>
        <a href="{reset_url}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            Reset Password
        </a>
        <p><strong>This link expires in 30 minutes.</strong></p>
    </body>
    </html>
    """

    return await self.send_email(to_email, "Reset Your ClauseIQ Password", html_content)
```

### 4. API Authentication Middleware (Backend)

```python
# backend/auth.py
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    token = credentials.credentials
    payload = verify_token(token)

    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

    user_id = payload.get("sub")
    storage = get_mongo_storage()
    user = storage.get_user_by_id(user_id)

    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    return user
```

---

## 🗄️ Database Queries & Operations

### User Management Queries:

```python
# Get all users
users = db.users.find({})

# Find user by email
user = db.users.find_one({"email": "user@example.com"})

# Update user password
db.users.update_one(
    {"email": "user@example.com"},
    {"$set": {"hashed_password": "new_hash", "updated_at": datetime.now().isoformat()}}
)

# Delete user
db.users.delete_one({"email": "user@example.com"})
```

### Document Management Queries:

```python
# Get user's documents
documents = db.documents.find({"user_id": "user_uuid"}).sort("upload_date", -1)

# Get document by ID for specific user
document = db.documents.find_one({"id": "doc_id", "user_id": "user_id"})

# Update document processing status
db.documents.update_one(
    {"id": "doc_id"},
    {"$set": {"processing_status": "completed", "ai_summary": "summary"}}
)
```

---

## 🌐 API Request Examples

### Authentication Requests:

```bash
# Register new user
curl -X POST "http://localhost:8000/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword123",
    "full_name": "John Doe"
  }'

# Login user
curl -X POST "http://localhost:8000/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword123"
  }'

# Get user info (with token)
curl -X GET "http://localhost:8000/auth/me" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Password Reset Requests:

```bash
# Request password reset
curl -X POST "http://localhost:8000/auth/forgot-password" \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'

# Reset password with token
curl -X POST "http://localhost:8000/auth/reset-password" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "RESET_TOKEN_FROM_EMAIL",
    "new_password": "newpassword123"
  }'
```

### Document Operations:

```bash
# Upload and analyze document
curl -X POST "http://localhost:8000/analyze/" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "file=@document.pdf"

# Get user's documents
curl -X GET "http://localhost:8000/documents/" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 🔧 Environment Configuration Examples

### Backend Environment (`.env`):

```env
# OpenAI Configuration
OPENAI_API_KEY=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

# MongoDB Configuration
MONGODB_URI=mongodb+srv://vedant:Vedant_98k@cluster0.vgw0eqn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
MONGODB_DATABASE=legal_ai
MONGODB_COLLECTION=documents

# Server Configuration
HOST=0.0.0.0
PORT=8000
CORS_ORIGINS=http://localhost:3001,http://localhost:3000

# JWT Configuration
JWT_SECRET_KEY=your-super-secret-jwt-key-change-this-in-production-make-it-long-and-random
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# Email Configuration (Gmail SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=clauseiq@gmail.com
SMTP_PASSWORD=akul omqd saut awfo
EMAIL_FROM=clauseiq@gmail.com
EMAIL_FROM_NAME=ClauseIQ
FRONTEND_URL=http://localhost:3000

# Password Reset Configuration
PASSWORD_RESET_TOKEN_EXPIRE_MINUTES=30

# File Upload Configuration
MAX_FILE_SIZE_MB=10
ALLOWED_FILE_TYPES=.pdf
STORAGE_DIR=./documents_storage
```

### Frontend Environment (`.env.local`):

```env
# Backend API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000

# For production:
# NEXT_PUBLIC_API_URL=https://clauseiq-6ppy.onrender.com

# File Upload Configuration
NEXT_PUBLIC_MAX_FILE_SIZE_MB=10
```

### Production Environment Variables (Render):

```env
OPENAI_API_KEY=sk-proj-***
MONGODB_URI=mongodb+srv://vedant:***@cluster0.vgw0eqn.mongodb.net/
SMTP_USERNAME=clauseiq@gmail.com
SMTP_PASSWORD=akul omqd saut awfo
CORS_ORIGINS=https://your-vercel-app.vercel.app,http://localhost:3000
FRONTEND_URL=https://your-vercel-app.vercel.app
```

---

## 📦 Package Dependencies

### Backend Requirements (`requirements.txt`):

```txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
python-multipart==0.0.6
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-dotenv==1.0.0
pymongo==4.6.0
openai==1.3.7
pypdf2==3.0.1
pdfplumber==0.10.3
requests==2.31.0
aiosmtplib==3.0.1
jinja2==3.1.4
email-validator==2.1.0
pytest==7.4.3
pytest-asyncio==0.21.1
httpx==0.25.2
```

### Frontend Dependencies (`package.json`):

```json
{
  "dependencies": {
    "next": "14.0.3",
    "react": "^18",
    "react-dom": "^18",
    "typescript": "^5",
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "tailwindcss": "^3.3.0",
    "autoprefixer": "^10.0.1",
    "postcss": "^8",
    "lucide-react": "^0.294.0",
    "react-hot-toast": "^2.4.1"
  },
  "devDependencies": {
    "eslint": "^8",
    "eslint-config-next": "14.0.3",
    "@testing-library/react": "^13.4.0",
    "@testing-library/jest-dom": "^5.16.5",
    "jest": "^29.7.0",
    "jest-environment-jsdom": "^29.7.0"
  }
}
```

---

## 🔍 Debugging & Troubleshooting

### Common Error Scenarios:

#### 1. MongoDB Connection Issues:

```python
# Test MongoDB connection
from pymongo import MongoClient
try:
    client = MongoClient("your_mongodb_uri")
    client.admin.command('ismaster')
    print("✅ MongoDB connected")
except Exception as e:
    print(f"❌ MongoDB error: {e}")
```

#### 2. Email Service Issues:

```python
# Test SMTP connection
import aiosmtplib
import asyncio

async def test_smtp():
    try:
        smtp = aiosmtplib.SMTP(hostname="smtp.gmail.com", port=587)
        await smtp.connect()
        await smtp.starttls()
        await smtp.login("clauseiq@gmail.com", "akul omqd saut awfo")
        print("✅ SMTP connected")
        await smtp.quit()
    except Exception as e:
        print(f"❌ SMTP error: {e}")

asyncio.run(test_smtp())
```

#### 3. JWT Token Issues:

```python
# Verify JWT token
from jose import jwt
from config import JWT_SECRET_KEY, JWT_ALGORITHM

def verify_token_debug(token: str):
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        print(f"✅ Token valid: {payload}")
        return payload
    except Exception as e:
        print(f"❌ Token error: {e}")
        return None
```

#### 4. CORS Issues:

```python
# Check CORS configuration in main.py
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Useful Debugging Commands:

```bash
# Check backend logs
uvicorn main:app --reload --log-level debug

# Test API endpoints
curl -v http://localhost:8000/

# Check frontend build
npm run build

# Test database connection
python3 -c "from database import get_mongo_storage; storage = get_mongo_storage(); print('Connected:', storage.db.name)"

# List environment variables
printenv | grep -E "(MONGODB|SMTP|JWT|OPENAI)"
```

---

## 🚀 Deployment Scripts

### Backend Deployment (Render):

```yaml
# render.yaml
services:
  - type: web
    name: clauseiq-backend
    env: python
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: PYTHON_VERSION
        value: 3.11.0
      - key: MONGODB_URI
        fromDatabase:
          name: mongodb-connection
          property: connectionString
```

### Frontend Deployment (Vercel):

```json
# vercel.json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "env": {
    "NEXT_PUBLIC_API_URL": "https://clauseiq-6ppy.onrender.com"
  }
}
```

---

## 📊 Performance Monitoring

### Key Metrics to Monitor:

1. **API Response Times**: Authentication, document processing
2. **Database Performance**: Query execution times
3. **Email Delivery**: Success rates, bounce rates
4. **Error Rates**: 4xx, 5xx response codes
5. **User Activity**: Registration, login, document uploads

### Monitoring Code Examples:

```python
# Add request timing middleware
import time
from fastapi import Request

@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response
```

---

## 🔒 Security Checklist

### Implemented Security Measures:

- ✅ Password hashing with bcrypt
- ✅ JWT token authentication
- ✅ CORS configuration
- ✅ Input validation
- ✅ SQL injection prevention (using MongoDB)
- ✅ Email verification for password reset
- ✅ Token expiration

### Additional Security Recommendations:

- [ ] Rate limiting on API endpoints
- [ ] Request size limits
- [ ] IP-based blocking
- [ ] Audit logging
- [ ] Two-factor authentication
- [ ] File upload scanning

---

## 📚 Reference Links

### Documentation:

- **FastAPI**: https://fastapi.tiangolo.com/
- **Next.js**: https://nextjs.org/docs
- **MongoDB**: https://docs.mongodb.com/
- **JWT**: https://jwt.io/
- **Tailwind CSS**: https://tailwindcss.com/docs

### External Services:

- **MongoDB Atlas**: https://cloud.mongodb.com/
- **Vercel**: https://vercel.com/docs
- **Render**: https://render.com/docs
- **OpenAI API**: https://platform.openai.com/docs

---

_This technical appendix provides hands-on implementation details for immediate development productivity._
