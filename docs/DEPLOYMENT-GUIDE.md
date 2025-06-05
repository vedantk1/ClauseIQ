# 🚀 Deployment Guide: Vercel + Render

This guide will help you deploy your ClauseIQ application using **Vercel** for the frontend and **Render** for the backend.

## 📋 Prerequisites

- [x] GitHub account
- [x] Vercel account (free)
- [x] Render account (free)
- [x] MongoDB Atlas account (already set up)
- [x] OpenAI API key (already have)

## 🌐 Step 1: Deploy Frontend to Vercel

### 1.1 Push to GitHub

```bash
# Make sure all changes are committed
git add .
git commit -m "Add deployment configurations"
git push origin main
```

### 1.2 Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "New Project"
3. Import your GitHub repository
4. Select the `frontend` folder as the root directory
5. Set environment variables:
   - `NEXT_PUBLIC_API_URL`: `https://your-backend-name.onrender.com` (you'll get this URL in step 2)
6. Click "Deploy"

### 1.3 Get Your Vercel URL

After deployment, you'll get a URL like: `https://your-app-name.vercel.app`

## 🔧 Step 2: Deploy Backend to Render

### 2.1 Create Web Service

1. Go to [render.com](https://render.com) and sign in
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `clauseiq-backend` (or your preferred name)
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### 2.2 Set Environment Variables

Add these environment variables in Render:

| Key                  | Value                                                    |
| -------------------- | -------------------------------------------------------- |
| `OPENAI_API_KEY`     | Your OpenAI API key                                      |
| `MONGODB_URI`        | Your MongoDB Atlas connection string                     |
| `CORS_ORIGINS`       | `https://your-app-name.vercel.app,http://localhost:3000` |
| `MONGODB_DATABASE`   | `legal_ai`                                               |
| `MONGODB_COLLECTION` | `documents`                                              |
| `MAX_FILE_SIZE_MB`   | `10`                                                     |
| `ALLOWED_FILE_TYPES` | `.pdf`                                                   |

### 2.3 Deploy

Click "Create Web Service" - Render will build and deploy your backend.

### 2.4 Get Your Render URL

After deployment, you'll get a URL like: `https://your-backend-name.onrender.com`

## 🔄 Step 3: Update Frontend with Backend URL

### 3.1 Update Vercel Environment

1. Go to your Vercel project dashboard
2. Go to Settings → Environment Variables
3. Update `NEXT_PUBLIC_API_URL` with your Render backend URL
4. Redeploy the frontend

### 3.2 Update Backend CORS

1. Go to your Render service dashboard
2. Update the `CORS_ORIGINS` environment variable to include your Vercel URL
3. Restart the service

## ✅ Step 4: Test Your Deployment

### 4.1 Test URLs

- **Frontend**: `https://your-app-name.vercel.app`
- **Backend API**: `https://your-backend-name.onrender.com`
- **API Docs**: `https://your-backend-name.onrender.com/docs`

### 4.2 Test Functionality

1. Visit your frontend URL
2. Upload a PDF contract
3. Verify the AI analysis works
4. Check that documents are saved

## 🔧 Troubleshooting

### Common Issues

**Frontend can't connect to backend:**

- Check `NEXT_PUBLIC_API_URL` environment variable
- Verify CORS settings in backend
- Check backend is running at the Render URL

**Backend won't start:**

- Check environment variables are set correctly
- Verify MongoDB connection string
- Check Render logs for errors

**File uploads fail:**

- Verify file size limits
- Check temporary file permissions
- Review backend logs

### Render Free Tier Notes

- Service spins down after 15 minutes of inactivity
- First request after spin-down takes ~30 seconds
- 750 hours/month free (more than enough for your project)

## 🎯 Final Configuration

Once deployed, your architecture will be:

```
User Browser
     ↓
Vercel Frontend (https://your-app.vercel.app)
     ↓
Render Backend (https://your-backend.onrender.com)
     ↓
MongoDB Atlas (Cloud Database)
     ↓
OpenAI API (AI Processing)
```

## 🔐 Security Checklist

- [x] Environment variables properly configured
- [x] No secrets in code
- [x] CORS properly configured
- [x] File upload validation enabled
- [x] MongoDB connection secured

---

**Your ClauseIQ application is now live and accessible from anywhere! 🎉**
