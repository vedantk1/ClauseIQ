#!/bin/bash

# ClauseIQ Development Setup Script
# This script helps you set up ClauseIQ for local development

set -e  # Exit on any error

echo "🚀 ClauseIQ Development Setup"
echo "=============================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if we're in the project root
if [ ! -f "package.json" ] || [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    print_error "Please run this script from the ClauseIQ project root directory"
    exit 1
fi

print_info "Setting up ClauseIQ development environment..."
echo ""

# 1. Copy environment files
echo "📄 Setting up environment files..."

# Backend environment
if [ ! -f "backend/.env" ]; then
    if [ -f "env-examples/backend.env.example" ]; then
        cp env-examples/backend.env.example backend/.env
        print_status "Created backend/.env from example"
    else
        print_warning "Backend environment example not found, creating basic .env"
        cat > backend/.env << EOF
# ClauseIQ Backend Environment Configuration
# Update these values with your actual API keys

OPENAI_API_KEY=sk-your-openai-api-key-here
PINECONE_API_KEY=your-pinecone-api-key-here
PINECONE_ENVIRONMENT=us-east-1

MONGODB_URI=mongodb://localhost:27017/
MONGODB_DATABASE=clauseiq

JWT_SECRET_KEY=your-super-secret-jwt-key-change-this-in-production

CORS_ORIGINS=http://localhost:3000
FRONTEND_URL=http://localhost:3000
EOF
    fi
else
    print_warning "backend/.env already exists, skipping"
fi

# Frontend environment
if [ ! -f "frontend/.env.local" ]; then
    if [ -f "env-examples/frontend.env.example" ]; then
        cp env-examples/frontend.env.example frontend/.env.local
        print_status "Created frontend/.env.local from example"
    else
        print_warning "Frontend environment example not found, creating basic .env.local"
        cat > frontend/.env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_ENVIRONMENT=development
NEXT_PUBLIC_MAX_FILE_SIZE_MB=10
EOF
    fi
else
    print_warning "frontend/.env.local already exists, skipping"
fi

echo ""

# 2. Check for required tools
echo "🔧 Checking required tools..."

# Check Python
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
    print_status "Python 3 found: $PYTHON_VERSION"
else
    print_error "Python 3 is required but not found. Please install Python 3.8+"
    exit 1
fi

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_status "Node.js found: $NODE_VERSION"
else
    print_error "Node.js is required but not found. Please install Node.js 18+"
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    print_status "npm found: $NPM_VERSION"
else
    print_error "npm is required but not found"
    exit 1
fi

echo ""

# 3. Set up backend
echo "🐍 Setting up backend..."

cd backend

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    print_info "Creating Python virtual environment..."
    python3 -m venv venv
    print_status "Virtual environment created"
else
    print_warning "Virtual environment already exists"
fi

# Activate virtual environment and install dependencies
print_info "Installing Python dependencies..."
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
print_status "Backend dependencies installed"

cd ..

echo ""

# 4. Set up frontend
echo "⚛️  Setting up frontend..."

cd frontend

print_info "Installing Node.js dependencies..."
npm install
print_status "Frontend dependencies installed"

cd ..

echo ""

# 5. Set up shared types
echo "🔗 Setting up shared types..."

if [ -f "scripts/setup_shared_types.sh" ]; then
    bash scripts/setup_shared_types.sh
    print_status "Shared types configured"
else
    print_warning "Shared types setup script not found, skipping"
fi

echo ""

# 6. Final instructions
echo "🎉 Setup Complete!"
echo "=================="
echo ""
print_info "Next steps:"
echo ""
echo "1. 📝 Update your API keys in backend/.env:"
echo "   - Get OpenAI API key: https://platform.openai.com/api-keys"
echo "   - Get Pinecone API key: https://app.pinecone.io/ (free tier available)"
echo "   - Set up MongoDB: https://www.mongodb.com/atlas (free tier available)"
echo ""
echo "2. 🚀 Start the development servers:"
echo ""
echo "   Backend (Terminal 1):"
echo "   cd backend && source venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
echo ""
echo "   Frontend (Terminal 2):"
echo "   cd frontend && npm run dev"
echo ""
echo "3. 🌐 Access the application:"
echo "   - Frontend: http://localhost:3000"
echo "   - Backend API: http://localhost:8000"
echo "   - API Documentation: http://localhost:8000/docs"
echo ""
print_status "Happy coding! 🚀" 