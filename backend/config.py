"""
Configuration module for the Legal AI backend.
Uses environment variables for secure configuration management.
"""
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# OpenAI Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "your_api_key_here")

# Server Configuration
HOST = os.getenv("HOST", "localhost")
PORT = int(os.getenv("PORT", "8000"))

# CORS Configuration
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001").split(",")

# File Upload Configuration
MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", "10"))
ALLOWED_FILE_TYPES = os.getenv("ALLOWED_FILE_TYPES", ".pdf").split(",")

# Storage Configuration
STORAGE_DIR = os.getenv("STORAGE_DIR", "./documents_storage")

# MongoDB Configuration
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DATABASE = os.getenv("MONGODB_DATABASE", "legal_ai")
MONGODB_COLLECTION = os.getenv("MONGODB_COLLECTION", "documents")
