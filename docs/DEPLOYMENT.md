# 🚀 ClauseIQ Production Deployment Guide

**Deploy ClauseIQ to production using Vercel (frontend) and Render (backend)**

## 📋 Prerequisites

Before starting deployment, ensure you have:

- [x] GitHub account with repository access
- [x] Vercel account (free tier available)
- [x] Render account (free tier available)
- [x] MongoDB Atlas cluster (free tier available)
- [x] OpenAI API key with sufficient credits
- [x] Pinecone account and API key (for chat feature)

## �️ Architecture Overview

```
GitHub Repository
       ↓
   ┌─────────┐      ┌─────────┐
   │ Vercel  │ ←──→ │ Render  │
   │Frontend │      │Backend  │
   └─────────┘      └─────────┘
                         ↓
              ┌─────────────────┐
              │ External APIs   │
              │ • MongoDB Atlas │
              │ • OpenAI API    │
              │ • Pinecone      │
              │ • Gmail SMTP    │
              └─────────────────┘
```

---

## 🎯 **Step 1: Frontend Deployment (Vercel)**

### 1.1 Prepare Repository

```bash
# Ensure all changes are committed and pushed
git add .
git commit -m "Prepare for production deployment"
git push origin main
```

### 1.2 Deploy to Vercel

1. **Sign in to Vercel**: Go to [vercel.com](https://vercel.com)
2. **Import Project**: Click "New Project" → Import your GitHub repository
3. **Configure Project**:

   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)

4. **Environment Variables** (Critical):

   ```
   NEXT_PUBLIC_API_URL=https://your-backend-name.onrender.com
   NEXT_PUBLIC_ENVIRONMENT=production
   ```

5. **Deploy**: Click "Deploy" and wait for completion

### 1.3 Post-Deployment

- **Custom Domain** (Optional): Add your custom domain in Vercel dashboard
- **URL**: Note your Vercel URL (e.g., `https://clauseiq.vercel.app`)

---

## 🔧 **Step 2: Backend Deployment (Render)**

### 2.1 Create Web Service

1. **Sign in to Render**: Go to [render.com](https://render.com)
2. **New Service**: Click "New +" → "Web Service"
3. **Connect Repository**: Link your GitHub repository

### 2.2 Service Configuration

**Basic Settings**:

- **Name**: `clauseiq-backend` (or your choice)
- **Environment**: `Python 3`
- **Region**: Choose closest to your users
- **Branch**: `main`
- **Root Directory**: `backend`

**Build & Deploy**:

- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### 2.3 Environment Variables (Critical)

Add these environment variables in Render dashboard:

**🔐 Security & Authentication**

```env
JWT_SECRET_KEY=your-very-long-random-secret-key-change-this
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7
```

**🤖 AI Services**

```env
OPENAI_API_KEY=sk-your-openai-api-key
PINECONE_API_KEY=your-pinecone-api-key
```

**🗄️ Database**

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
MONGODB_DATABASE=clauseiq
MONGODB_COLLECTION=documents
```

**📧 Email Service**

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-specific-password
EMAIL_FROM=your-email@gmail.com
EMAIL_FROM_NAME=ClauseIQ
```

**🌐 CORS & Frontend**

```env
CORS_ORIGINS=https://your-vercel-app.vercel.app,http://localhost:3000
FRONTEND_URL=https://your-vercel-app.vercel.app
```

**⚙️ Application Settings**

```env
ENVIRONMENT=production
HOST=0.0.0.0
PORT=10000
MAX_FILE_SIZE_MB=10
ALLOWED_FILE_TYPES=.pdf
PASSWORD_RESET_TOKEN_EXPIRE_MINUTES=30
```

### 2.4 Deploy Backend

1. **Deploy**: Click "Create Web Service"
2. **Monitor**: Watch build logs for any errors
3. **Note URL**: Save your Render URL (e.g., `https://clauseiq-backend.onrender.com`)

---

## 🔄 **Step 3: Cross-Service Configuration**

### 3.1 Update Frontend with Backend URL

1. **Go to Vercel Dashboard** → Your project → Settings → Environment Variables
2. **Update**: `NEXT_PUBLIC_API_URL` with your actual Render URL
3. **Redeploy**: Trigger new deployment for changes to take effect

### 3.2 Update Backend with Frontend URL

1. **Go to Render Dashboard** → Your service → Environment Variables
2. **Update**:
   - `CORS_ORIGINS` with your actual Vercel URL
   - `FRONTEND_URL` with your actual Vercel URL
3. **Deploy**: Service will automatically redeploy

---

## ✅ **Step 4: Verification & Testing**

### 4.1 Health Checks

**Backend Health**:

```bash
curl https://your-backend.onrender.com/health
# Expected: {"status": "healthy", "timestamp": "...", "services": {...}}
```

**Frontend Access**:

- Visit: `https://your-frontend.vercel.app`
- Should load without errors

### 4.2 Feature Testing

**🔐 Authentication**:

1. Register new account
2. Login with credentials
3. Test password reset flow

**📄 Document Analysis**:

1. Upload a PDF contract
2. Verify AI analysis completes
3. Check all contract types work

**💬 Chat Functionality**:

1. Upload document and wait for processing
2. Start chat session
3. Send test messages and verify responses

### 4.3 API Documentation

**Interactive Docs**: Visit `https://your-backend.onrender.com/docs`  
Should display Swagger/OpenAPI documentation with all endpoints.

---

## 🔧 **Troubleshooting**

### Common Issues

#### **Frontend Can't Connect to Backend**

```bash
# Check CORS configuration
# Verify NEXT_PUBLIC_API_URL is correct
# Ensure backend is running (check Render logs)
```

#### **Backend Build Failures**

```bash
# Check Python version (should be 3.13+)
# Verify requirements.txt is complete
# Check Render build logs for specific errors
```

#### **Environment Variable Issues**

```bash
# Verify all required variables are set
# Check for typos in variable names
# Ensure no quotes around values unless needed
```

#### **Database Connection Failures**

```bash
# Test MongoDB URI in local environment first
# Verify network access from Render to MongoDB Atlas
# Check MongoDB Atlas whitelist (should allow all IPs: 0.0.0.0/0)
```

#### **AI Service Failures**

```bash
# Verify OpenAI API key is valid and has credits
# Check Pinecone API key and index configuration
# Monitor token usage and rate limits
```

### Render-Specific Notes

**Free Tier Limitations**:

- Services spin down after 15 minutes of inactivity
- First request after spin-down takes ~30 seconds
- 750 hours/month free (sufficient for most projects)

**Performance Tips**:

- Use health checks to keep services warm
- Implement request timeout handling for spin-up delays
- Consider upgrading to paid plan for production use

---

## 🔒 **Security Best Practices**

### Environment Variables

- [ ] **Never commit** API keys or secrets to code
- [ ] **Use strong** JWT secret keys (64+ characters)
- [ ] **Rotate keys** regularly
- [ ] **Limit CORS** origins to specific domains

### Database Security

- [ ] **Whitelist IPs** in MongoDB Atlas (or use 0.0.0.0/0 for Render)
- [ ] **Use strong passwords** for database users
- [ ] **Enable authentication** on all database operations
- [ ] **Regular backups** of production data

### Application Security

- [ ] **HTTPS only** in production
- [ ] **Input validation** on all endpoints
- [ ] **Rate limiting** on authentication endpoints
- [ ] **File upload validation** (type, size limits)

---

## 📊 **Monitoring & Maintenance**

### Health Monitoring

- **Uptime Monitoring**: Use services like UptimeRobot
- **Error Tracking**: Monitor application logs
- **Performance**: Track response times
- **Resource Usage**: Monitor Render dashboard metrics

### Regular Maintenance

- **Dependency Updates**: Keep packages current
- **Security Patches**: Apply updates promptly
- **Database Cleanup**: Archive old documents
- **Log Rotation**: Manage log file sizes

### Scaling Considerations

- **Database**: MongoDB Atlas auto-scaling
- **Backend**: Render paid plans for better performance
- **Frontend**: Vercel scales automatically
- **CDN**: Consider adding for media files

---

## 🎯 **Final Checklist**

### Pre-Launch

- [ ] All services deployed and running
- [ ] Environment variables configured
- [ ] CORS and security settings verified
- [ ] All features tested end-to-end
- [ ] Error handling working correctly
- [ ] Performance acceptable under load

### Post-Launch

- [ ] Monitoring systems in place
- [ ] Backup procedures verified
- [ ] Documentation updated
- [ ] Support channels established
- [ ] User feedback collection enabled

---

## 📞 **Support & Next Steps**

### Getting Help

- **Render Support**: [render.com/docs](https://render.com/docs)
- **Vercel Support**: [vercel.com/docs](https://vercel.com/docs)
- **MongoDB Atlas**: [docs.atlas.mongodb.com](https://docs.atlas.mongodb.com)
- **OpenAI API**: [platform.openai.com/docs](https://platform.openai.com/docs)

### Production Optimization

- Consider upgrading to paid plans for better performance
- Implement CDN for static assets
- Set up comprehensive monitoring
- Plan for disaster recovery

---

**🚀 Your ClauseIQ application is now live and ready for users!**

**Live URLs Example**:

- **Frontend**: https://clauseiq.vercel.app
- **Backend**: https://legal-ai-6ppy.onrender.com
- **API Docs**: https://legal-ai-6ppy.onrender.com/docs

---

_Last Updated: June 22, 2025 | Version 3.0_
