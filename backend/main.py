from fastapi import FastAPI, File, UploadFile, HTTPException
import pdfplumber
from fastapi.middleware.cors import CORSMiddleware
import re
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid
import os
import json
import asyncio
from openai import AsyncOpenAI, OpenAIError
from config import (
    OPENAI_API_KEY, 
    CORS_ORIGINS, 
    STORAGE_DIR, 
    MAX_FILE_SIZE_MB, 
    ALLOWED_FILE_TYPES
)
from database import get_mongo_storage

# Initialize OpenAI client if API key is provided and valid
if OPENAI_API_KEY and OPENAI_API_KEY != "your_api_key_here" and OPENAI_API_KEY.startswith("sk-"):
    openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
    print("OpenAI client initialized successfully")
elif OPENAI_API_KEY and OPENAI_API_KEY != "your_api_key_here":
    print("Warning: Invalid OpenAI API key format. AI-powered summaries will not be available.")
    openai_client = None
else:
    print("No valid OpenAI API key provided. AI-powered summaries will not be available.")
    openai_client = None

app = FastAPI(title="Legal AI Backend", version="1.0.0")

# Initialize MongoDB connection on startup
@app.on_event("startup")
async def startup_event():
    """Initialize database connection on startup."""
    try:
        # Test MongoDB connection
        storage = get_mongo_storage()
        storage.get_documents_count()
        print("MongoDB connection established successfully")
    except Exception as e:
        print(f"Warning: MongoDB connection failed: {e}")
        print("Application will continue but document storage may not work properly")

# Helper class for document storage - MongoDB wrapper for backward compatibility
class DocumentStorage:
    """Backward-compatible wrapper for MongoDB storage."""
    
    @staticmethod
    def save_document(document_dict):
        """Save document using MongoDB storage."""
        return get_mongo_storage().save_document(document_dict)

    @staticmethod
    def get_document(doc_id):
        """Get document using MongoDB storage."""
        return get_mongo_storage().get_document(doc_id)

    @staticmethod
    def get_all_documents():
        """Get all documents using MongoDB storage."""
        return get_mongo_storage().get_all_documents()

# CORS settings with configurable origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ProcessDocumentResponse(BaseModel):
    id: str
    filename: str
    full_text: str # Or a snippet/confirmation
    summary: str

class Section(BaseModel):
    heading: str
    summary: Optional[str] = None
    text: str

# Health check endpoint
@app.get("/")
async def root():
    """Health check endpoint."""
    return {"message": "Legal AI Backend is running", "version": "1.0.0"}

# File validation constants
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024  # Convert MB to bytes

def validate_file(file: UploadFile) -> None:
    """Validate uploaded file for security and constraints."""
    # Check file size
    if hasattr(file, 'size') and file.size and file.size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size allowed: {MAX_FILE_SIZE_MB}MB"
        )
    
    # Check file type
    if file.filename:
        file_extension = os.path.splitext(file.filename)[1].lower()
        if file_extension not in ALLOWED_FILE_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"File type not supported. Allowed types: {', '.join(ALLOWED_FILE_TYPES)}"
            )
    
    # Check filename for security
    if file.filename and ('..' in file.filename or '/' in file.filename or '\\' in file.filename):
        raise HTTPException(
            status_code=400,
            detail="Invalid filename. Filename contains unsafe characters."
        )

@app.post("/extract-text/")
async def extract_text(file: UploadFile = File(...)):
    """Extract text from uploaded PDF file."""
    validate_file(file)
    
    # Create secure temporary file path
    temp_file_path = None
    try:
        # Create a secure temporary file
        temp_file_path = f"/tmp/{uuid.uuid4()}_{file.filename}"
        
        # Read file content and check size while reading
        content = await file.read()
        if len(content) > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum size allowed: {MAX_FILE_SIZE_MB}MB"
            )
        
        # Save the file temporarily
        with open(temp_file_path, "wb") as f:
            f.write(content)
        
        # Extract text using pdfplumber
        with pdfplumber.open(temp_file_path) as pdf:
            text = ""
            for page in pdf.pages:
                text += page.extract_text() or ""
        
        return {"text": text}
        
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        print(f"Error processing PDF: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while processing the file: {str(e)}"
        )
    finally:
        # Clean up temporary file
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception as e:
                print(f"Warning: Could not remove temporary file {temp_file_path}: {e}")

def extract_sections(text: str) -> List[Section]:
    """Split document into sections based on common patterns in legal documents."""
    # Simple regex pattern to identify section headers
    # This is a basic implementation and could be enhanced with NLP/ML techniques
    section_pattern = r'(?m)^(?:\d+\.|\s*[A-Z][A-Z\s]+:|[A-Z][a-z]+\s+[A-Z][a-z]+:)'
    
    # Find potential section headers
    matches = list(re.finditer(section_pattern, text))
    
    sections = []
    
    # If we found sections
    if matches:
        for i, match in enumerate(matches):
            start_pos = match.start()
            # For all but the last section, end is the start of the next section
            end_pos = matches[i+1].start() if i < len(matches) - 1 else len(text)
            
            section_text = text[start_pos:end_pos].strip()
            # The heading is the first line of the section
            heading = section_text.split('\n')[0].strip()
            # The content is everything after the heading
            content = '\n'.join(section_text.split('\n')[1:]).strip()
            
            sections.append(Section(
                heading=heading,
                text=content
            ))
    else:
        # If no sections found, treat the entire document as one section
        sections.append(Section(heading="Full Document", text=text))
    
    return sections

@app.post("/analyze/")
async def analyze_document(file: UploadFile = File(...)):
    """Extract text and split into logical sections for analysis."""
    validate_file(file)
    
    temp_file_path = None
    try:
        # Create a secure temporary file
        temp_file_path = f"/tmp/{uuid.uuid4()}_{file.filename}"
        
        # Read file content and check size while reading
        content = await file.read()
        if len(content) > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum size allowed: {MAX_FILE_SIZE_MB}MB"
            )
        
        # Save the file temporarily
        with open(temp_file_path, "wb") as f:
            f.write(content)
        
        # Extract text using pdfplumber
        with pdfplumber.open(temp_file_path) as pdf:
            text = ""
            for page in pdf.pages:
                text += page.extract_text() or ""
        
        sections = extract_sections(text)
        
        # Generate AI summaries for each section if OpenAI API is configured
        if openai_client:
            summary_tasks = []
            for section in sections:
                task = generate_summary(section.text, section.heading)
                summary_tasks.append(task)
            
            # Wait for all summaries to be generated concurrently
            summaries = await asyncio.gather(*summary_tasks)
            
            # Assign summaries to sections
            for i, summary in enumerate(summaries):
                sections[i].summary = summary
        
        # Convert sections to dictionaries for JSON serialization
        section_dicts = [section.dict() for section in sections]
        
        # Create document with current timestamp
        document = {
            "id": str(uuid.uuid4()),
            "filename": file.filename,
            "upload_date": datetime.now().isoformat(),
            "text": text,
            "sections": section_dicts
        }
        
        # Save document to our file storage
        DocumentStorage.save_document(document)
        
        return {"sections": section_dicts}
        
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        print(f"Error analyzing PDF: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while analyzing the file: {str(e)}"
        )
    finally:
        # Clean up temporary file
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception as e:
                print(f"Warning: Could not remove temporary file {temp_file_path}: {e}")

@app.get("/documents/")
async def get_documents():
    """Retrieve all documents from the storage"""
    try:
        # Get documents from file storage
        documents = DocumentStorage.get_all_documents()
        return {"documents": documents}
    except Exception as e:
        print(f"Error retrieving documents: {str(e)}")
        return {"documents": [], "error": str(e)}

@app.get("/documents/{document_id}")
async def get_document(document_id: str):
    """Retrieve a specific document by ID"""
    try:
        document = DocumentStorage.get_document(document_id)
        if document:
            return document
        return {"error": "Document not found"}
    except Exception as e:
        print(f"Error retrieving document: {str(e)}")
        return {"error": str(e)}

# Function to generate a summary for a section using AI
async def generate_summary(section_text: str, section_heading: str = "") -> str:
    """Generate a summary for a section using OpenAI's API"""
    if not openai_client:
        return "AI summary not available - API key not configured"
    
    try:
        prompt = f"""
Summarize the following legal text from a section titled '{section_heading}' in an employment contract.
Provide a concise, clear summary focusing on the main points that would be important for a non-lawyer to understand.

TEXT TO SUMMARIZE:
{section_text[:4000]}  # Limit to 4000 chars to avoid token limits

SUMMARY:
"""
        response = await openai_client.chat.completions.create(
            model="gpt-3.5-turbo",  # Can be upgraded to GPT-4 for better results
            messages=[
                {"role": "system", "content": "You are a legal assistant that provides clear, professional summaries of legal text."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.5,
            max_tokens=200
        )
        
        summary = response.choices[0].message.content.strip()
        return summary
    except OpenAIError as e:
        print(f"Error generating AI summary: {str(e)}")
        return "Error generating summary - API issue"
    except Exception as e:
        print(f"Unexpected error in summary generation: {str(e)}")
        return "Error generating summary"

async def generate_document_summary(full_text: str, filename: str = "") -> str:
    """Generate a summary for the entire document using OpenAI's API"""
    if not openai_client:
        return "AI summary not available - API key not configured"
    
    try:
        prompt = f"""
Please provide a concise summary of the following legal document: {filename}.
The summary should highlight the key clauses, obligations, and important terms for a non-lawyer to quickly understand the document's essence.
Focus on aspects like contract type, main parties, term/duration, key responsibilities, and any critical conditions or clauses.

DOCUMENT TEXT:
{full_text[:12000]} # Limiting input to manage token usage for GPT-3.5-turbo (approx 4k tokens limit for model, leaving room for prompt and response)

SUMMARY:
"""
        response = await openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a helpful legal assistant that provides clear, concise summaries of entire legal documents."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3, # Slightly lower for more factual summary
            max_tokens=500 # Increased for a potentially longer full document summary
        )
        
        summary = response.choices[0].message.content.strip()
        return summary
    except OpenAIError as e:
        print(f"Error generating document summary (OpenAI): {str(e)}")
        return f"Error generating summary via AI: {str(e)}"
    except Exception as e:
        print(f"Unexpected error in document summary generation: {str(e)}")
        return f"Unexpected error generating summary: {str(e)}"

@app.post("/process-document/", response_model=ProcessDocumentResponse)
async def process_document(file: UploadFile = File(...)):
    """
    Extracts text from an uploaded PDF, generates a summary for the entire document,
    saves it, and returns the summary.
    """
    validate_file(file)
    
    temp_file_path = None
    extracted_text = ""
    try:
        # Create a secure temporary file
        temp_file_path = f"/tmp/{uuid.uuid4()}_{file.filename}"
        
        content = await file.read()
        if len(content) > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum size allowed: {MAX_FILE_SIZE_MB}MB"
            )
        
        with open(temp_file_path, "wb") as f:
            f.write(content)
        
        with pdfplumber.open(temp_file_path) as pdf:
            for page in pdf.pages:
                extracted_text += page.extract_text() or ""
        
        if not extracted_text.strip():
            raise HTTPException(status_code=400, detail="No text could be extracted from the PDF.")

        # Generate summary for the entire document
        ai_summary = "Summary not generated." # Default
        if openai_client:
            ai_summary = await generate_document_summary(extracted_text, file.filename)
        else:
            ai_summary = "OpenAI client not configured. Summary not generated."
            
        # Create document entry
        doc_id = str(uuid.uuid4())
        document_data = {
            "id": doc_id,
            "filename": file.filename,
            "upload_date": datetime.now().isoformat(),
            "text": extracted_text, # Storing full extracted text
            "ai_full_summary": ai_summary, # New field for the overall summary
            "sections": [] # Keeping sections for potential future use or if analyze is still used
        }
        
        DocumentStorage.save_document(document_data)
        
        return ProcessDocumentResponse(
            id=doc_id,
            filename=file.filename,
            full_text=extracted_text[:500] + "..." if len(extracted_text) > 500 else extracted_text, # Return a snippet
            summary=ai_summary
        )
        
    except HTTPException:
        raise 
    except Exception as e:
        print(f"Error processing document: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while processing the document: {str(e)}"
        )
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception as e:
                print(f"Warning: Could not remove temporary file {temp_file_path}: {e}")
