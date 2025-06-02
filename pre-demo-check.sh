#!/bin/bash

# Pre-Demo Checklist Script
echo "🎓 Legal AI Demo - Pre-Presentation Checklist"
echo "=============================================="
echo ""

# Check if we're in the right directory
if [ ! -f "start-demo.sh" ]; then
    echo "❌ Error: Please run this from the legal-ai-project directory"
    exit 1
fi

echo "📋 Checking demo requirements..."
echo ""

# Check Python and dependencies
echo "🐍 Checking Python environment..."
if command -v python &> /dev/null; then
    echo "✅ Python found: $(python --version)"
else
    echo "❌ Python not found"
fi

# Check Node.js and npm
echo "📦 Checking Node.js environment..."
if command -v node &> /dev/null; then
    echo "✅ Node.js found: $(node --version)"
else
    echo "❌ Node.js not found"
fi

if command -v npm &> /dev/null; then
    echo "✅ npm found: $(npm --version)"
else
    echo "❌ npm not found"
fi

# Check if backend dependencies are installed
echo "🔧 Checking backend dependencies..."
if [ -f "backend/requirements.txt" ] && [ -d "backend" ]; then
    cd backend
    if pip list | grep -q "fastapi"; then
        echo "✅ Backend dependencies appear to be installed"
    else
        echo "⚠️  Backend dependencies may not be installed"
        echo "   Run: cd backend && pip install -r requirements.txt"
    fi
    cd ..
else
    echo "❌ Backend directory or requirements.txt not found"
fi

# Check if frontend dependencies are installed
echo "🎨 Checking frontend dependencies..."
if [ -f "frontend/package.json" ] && [ -d "frontend/node_modules" ]; then
    echo "✅ Frontend dependencies appear to be installed"
elif [ -f "frontend/package.json" ]; then
    echo "⚠️  Frontend dependencies may not be installed"
    echo "   Run: cd frontend && npm install"
else
    echo "❌ Frontend directory or package.json not found"
fi

# Check environment files
echo "⚙️  Checking environment configuration..."
if [ -f "backend/.env" ]; then
    echo "✅ Backend .env file found"
else
    echo "❌ Backend .env file missing"
fi

if [ -f "frontend/.env.local" ]; then
    echo "✅ Frontend .env.local file found"
else
    echo "❌ Frontend .env.local file missing"
fi

# Check network connectivity
echo "🌐 Checking network configuration..."
LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n1)
if [ -n "$LOCAL_IP" ]; then
    echo "✅ Local IP address detected: $LOCAL_IP"
    echo "   Your demo will be available at: http://$LOCAL_IP:3000"
else
    echo "⚠️  Could not detect local IP address"
fi

echo ""
echo "🎯 Demo Preparation Tips:"
echo "   1. Make sure you and your supervisor are on the same WiFi network"
echo "   2. Have a sample PDF contract ready to upload"
echo "   3. Test the upload and analysis process beforehand"
echo "   4. Prepare to explain the AI analysis results"
echo "   5. Be ready to show the code architecture if asked"
echo ""
echo "🚀 Ready to start demo? Run: ./start-demo.sh"
echo "📚 Need help? Check: demo-instructions.md"
