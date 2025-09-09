# Gemini Code Assistant Report: ClauseIQ Project

**Repository**: https://github.com/vedantk1/ClauseIQ  
**Version**: 1.0.0  
**Status**: Production Ready  
**Last Updated**: September 2025

## Project Overview

**ClauseIQ** is an AI-powered legal document analysis platform designed to transform complex legal texts into actionable insights. It features a web-based frontend for user interaction and a robust Python backend for processing and analysis. The system leverages a Retrieval-Augmented Generation (RAG) architecture with OpenAI models and a Pinecone vector database to provide advanced analytical capabilities, including natural language chat about document contents.

The project is structured as a monorepo, containing both the frontend and backend applications, along with shared type definitions.

## Key Technologies

| Category     | Technology/Library | Version/Details                           |
| ------------ | ------------------ | ----------------------------------------- |
| **Frontend** | Next.js            | 15.3.3 (with Turbopack)                   |
|              | React              | 19.1.0                                    |
|              | TypeScript         | 5.x                                       |
|              | Tailwind CSS       | 3.4.17                                    |
|              | Jest               | 29.7.0 (for testing)                      |
| **Backend**  | Python             | 3.13+                                     |
|              | FastAPI            | 0.115.12                                  |
|              | MongoDB            | via `pymongo` 4.10.1 & `motor` 3.7.1      |
|              | Uvicorn            | 0.34.3 (ASGI server)                      |
|              | Pytest             | 8.4.0 (for testing)                       |
| **AI & ML**  | OpenAI API         | `openai` 1.90.0                           |
|              | Pinecone           | `pinecone-client` 6.0.0 (vector database) |
|              | LangChain          | `langchain` 0.3.16 (RAG orchestration)    |
| **Database** | MongoDB            | Primary data store                        |
|              | Pinecone           | Vector storage for semantic search        |
| **DevOps**   | Vercel/Render      | Serverless deployment                     |
|              | Vercel             | Frontend deployment                       |
|              | Render             | Backend deployment                        |

## API Endpoint Summary

| Category              | Endpoint                             | Method | Description                        |
| --------------------- | ------------------------------------ | ------ | ---------------------------------- |
| **Authentication**    | `/api/v1/auth/register`              | POST   | Register a new user.               |
|                       | `/api/v1/auth/login`                 | POST   | Authenticate a user.               |
|                       | `/api/v1/auth/refresh`               | POST   | Refresh an access token.           |
|                       | `/api/v1/auth/me`                    | GET    | Get current user information.      |
| **Document Analysis** | `/api/v1/analysis/analyze/`          | POST   | Upload and analyze a document.     |
|                       | `/api/v1/documents/`                 | GET    | List a user's documents.           |
|                       | `/api/v1/documents/{document_id}`    | GET    | Get detailed document information. |
|                       | `/api/v1/documents/{document_id}`    | DELETE | Delete a document.                 |
| **Chat**              | `/api/v1/chat/{document_id}/session` | POST   | Create a new chat session.         |
|                       | `/api/v1/chat/{document_id}/message` | POST   | Send a message in a chat session.  |
|                       | `/api/v1/chat/{document_id}/history` | GET    | Get chat message history.          |
|                       | `/api/v1/chat/{document_id}/status`  | GET    | Get chat session status.           |
|                       | `/api/v1/chat/{document_id}/history` | DELETE | Clear chat history.                |
| **User Preferences**  | `/api/v1/auth/preferences`           | GET    | Get user preferences.              |
|                       | `/api/v1/auth/preferences`           | PUT    | Update user preferences.           |
|                       | `/api/v1/auth/available-models`      | GET    | Get available AI models.           |

## RAG and Chat System

The platform features a sophisticated **Retrieval-Augmented Generation (RAG)** system that allows users to have interactive conversations with their legal documents. This system is powered by the following components:

- **Smart Chunking**: Documents are intelligently segmented into meaningful chunks, preserving the legal structure and context.
- **Vector Embeddings**: OpenAI's `text-embedding-3-large` model is used to create high-dimensional vector representations of the document chunks.
- **Vector Storage**: The vector embeddings are stored and indexed in a **Pinecone** vector database for efficient similarity searches.
- **Intelligent Retrieval**: When a user asks a question, the system retrieves the most relevant document chunks from Pinecone.
- **Contextual Answers**: The retrieved chunks are then passed to an OpenAI language model (e.g., GPT-4o) to generate a coherent and contextually accurate answer, with citations to the source document.

## AI Model Selection

Users can customize their experience by selecting from a range of OpenAI models for document analysis and chat. The available models include:

- **GPT-4.1 Mini & Nano**: Balanced and lightweight models for general use.
- **GPT-4o & GPT-4o Mini**: Advanced models with superior accuracy and speed.

This feature allows users to balance cost, speed, and accuracy based on their specific needs.

## Project Structure

The repository is a monorepo with the following key directories:

- `backend/`: Contains the FastAPI application, including API endpoints, services, AI models, and database logic.
- `frontend/`: Contains the Next.js application, including pages, components, and static assets.
- `shared/`: Contains shared TypeScript type definitions used by both the frontend and backend to ensure type safety across the stack.
- `docs/`: Project documentation.
- `scripts/`: Utility and automation scripts.

## Core Commands

The main commands are defined in the root `package.json` file:

- **`npm run dev`**: Starts the development servers for both the frontend and backend concurrently.
- **`npm run build`**: Builds both applications for production.
- **`npm run test`**: Runs the test suites for both frontend (`jest`) and backend (`pytest`).
- **`npm run lint`**: Lints the code in both applications.
- **`npm run type-check`**: Performs static type checking on both codebases.
- **`npm run setup`**: Installs dependencies for both the frontend and backend.

## Development Workflow

1.  **Setup**: Run `npm run setup` to install all required dependencies.
2.  **Development**: Use `npm run dev` to start the local development environment.
3.  **Testing**: Run `npm run test` to execute unit and integration tests.
4.  **Linting & Formatting**: Use `npm run lint` and `npm run lint:fix` to maintain code quality.
5.  **Committing**: Follow conventional commit standards.

## Architectural Notes

- **Monorepo Strategy**: The use of a monorepo simplifies dependency management and cross-stack development, particularly with the `shared/` directory for type definitions.
- **Separation of Concerns**: The backend is well-structured, with clear separation between API routes (`routers`), business logic (`services`), and database interactions (`database`).
- **Type Safety**: TypeScript on the frontend and Python type hints on the backend, combined with the `shared/` types, provide end-to-end type safety.

## Deployment Details

- **Frontend**: Development server at http://localhost:3000
- **Backend**: Development server at http://localhost:8000

## Project History and Evolution

- **Initial Development**: The project started with a focus on basic document analysis and a simple file-based storage system.
- **MongoDB**: Uses MongoDB as the primary database for scalable and robust data storage.
- **RAG and Chat Implementation**: The core functionality was extended with a sophisticated RAG system and interactive chat, transforming the platform into an intelligent legal assistant.
- **Pinecone Integration**: The RAG system uses Pinecone for high-performance vector storage, enabling the use of powerful embedding models.

## Security Overview

- **Authentication**: Secure JWT-based authentication with access and refresh tokens.
- **Data Protection**: User data is isolated, and users can only access their own documents.
- **API Security**: Input validation, CORS, and other security measures are implemented in the FastAPI backend.

This report provides a comprehensive overview of the ClauseIQ project. For more detailed information, refer to the project's `README.md` and the documentation in the `docs/` directory.
