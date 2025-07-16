# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClauseIQ is a full-stack AI-powered legal document analysis platform with a Next.js frontend, FastAPI backend, and shared type system. The application uses MongoDB for data storage, Pinecone for vector embeddings, and OpenAI for AI features.

## Development Commands

**Start Development Environment:**
```bash
npm run dev                 # Start both frontend and backend
npm run dev:frontend        # Start Next.js dev server only
npm run dev:backend         # Start FastAPI server only
```

**Code Quality:**
```bash
npm run lint               # Lint both frontend and backend
npm run type-check         # TypeScript validation
npm run security:audit     # Security vulnerability scan
```

**Testing:**
```bash
npm run test               # Run all tests
npm run test:integration   # Integration tests
npm run test:performance   # Performance tests
npm run test:accessibility # Accessibility tests
```

**Build & Deploy:**
```bash
npm run build             # Build for production
```

## Architecture Overview

### Frontend (Next.js 15 + React 19)
- **Location**: `/frontend/`
- **Entry**: `src/app/` (App Router)
- **Components**: `src/components/` - Modular component library
- **State Management**: Context API with Auth and Analysis providers
- **PDF Handling**: React-PDF-Viewer with custom document viewer
- **Styling**: Tailwind CSS with custom design system

### Backend (FastAPI + Python 3.13)
- **Location**: `/backend/`
- **Entry**: `main.py`
- **Architecture**: Layered (routers → services → models → database)
- **Database**: MongoDB with Motor async driver
- **AI Integration**: OpenAI GPT models with Pinecone vector storage
- **Authentication**: JWT-based with secure middleware

### Shared Types
- **Location**: `/shared/clauseiq_types/`
- **Purpose**: Common TypeScript/Python type definitions
- **Usage**: Imported by both frontend and backend for consistency

## Key Architectural Patterns

### Backend Layering
```
routers/     # API endpoints and request handling
services/    # Business logic and AI processing
models/      # Data models and validation schemas
database/    # MongoDB abstraction and operations
middleware/  # Rate limiting, logging, security
```

### Frontend Organization
```
app/         # Next.js App Router pages
components/  # Reusable UI components
context/     # React Context providers (Auth, Analysis)
hooks/       # Custom React hooks
lib/         # API clients and utilities
types/       # TypeScript definitions
```

### AI Features Implementation
- **Document Analysis**: Contract type detection and clause extraction
- **RAG Chat**: Vector similarity search with Pinecone + OpenAI
- **Multi-model Support**: Configurable AI models (GPT-4.1 to GPT-4o)

## Development Workflow

### Making Changes
1. **Frontend**: Changes trigger hot reload via Next.js dev server
2. **Backend**: FastAPI auto-reloads on file changes
3. **Shared Types**: Rebuild required when modifying shared types
4. **Database**: Uses MongoDB Atlas connection string from environment

### Environment Setup
- **Backend**: Requires `.env` with OpenAI, MongoDB, Pinecone credentials
- **Frontend**: Uses `.env.local` for API endpoints

### Testing Strategy
- **Frontend**: Jest + React Testing Library + Jest-axe for accessibility
- **Backend**: pytest with async support for FastAPI testing
- **Integration**: Full stack testing with local services

## Important Implementation Details

### Authentication Flow
- JWT tokens managed in backend middleware
- Protected routes use auth context in frontend
- User preferences stored in MongoDB with AI model selection

### PDF Processing
- Backend uses pdfplumber and pypdfium2 for text extraction
- Frontend uses React-PDF-Viewer for display
- Vector embeddings stored in Pinecone for chat functionality

### Error Handling
- Backend uses custom exception handlers with standardized responses
- Frontend has global error boundaries and toast notifications
- Comprehensive logging and monitoring middleware

### Performance Considerations
- Async/await patterns throughout backend
- React optimizations with proper context usage
- Vector search optimization with Pinecone indexes
- Rate limiting on API endpoints

## Production Deployment

- **Frontend**: Deployed on Vercel
- **Backend**: Deployed on Render
- **Database**: MongoDB Atlas
- **Vector Storage**: Pinecone cloud

## Key Dependencies

### Frontend
- Next.js 15.3.3, React 19, TypeScript 5
- Tailwind CSS, React-PDF-Viewer, Zod validation

### Backend  
- FastAPI 0.115.12, Pydantic 2.11.5, Motor 3.7.1
- OpenAI 1.90.0, LangChain 0.3.16, Pinecone 7.2.0