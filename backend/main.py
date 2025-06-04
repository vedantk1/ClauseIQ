from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, status
import pdfplumber
from fastapi.middleware.cors import CORSMiddleware
import re
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid
import os
import asyncio
from openai import AsyncOpenAI, OpenAIError
from config import (
    OPENAI_API_KEY, 
    CORS_ORIGINS, 
    MAX_FILE_SIZE_MB, 
    ALLOWED_FILE_TYPES
)
from database import get_mongo_storage
from email_service import send_password_reset_email
from auth import (
    create_access_token,
    create_refresh_token,
    verify_token,
    get_password_hash,
    verify_password,
    get_current_user,
    UserCreate,
    UserLogin,
    UserResponse,
    Token,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    create_password_reset_token,
    verify_password_reset_token,
    validate_password
)

# Constants
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

def validate_file(file: UploadFile):
    """Validate uploaded file for size, type, and security."""
    # Check file size
    if hasattr(file, 'size') and file.size and file.size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size allowed: {MAX_FILE_SIZE_MB}MB"
        )
    
    # Check file type if filename is provided
    if file.filename:
        # Check for unsafe filename patterns
        if '..' in file.filename or '/' in file.filename or '\\' in file.filename:
            raise HTTPException(
                status_code=400,
                detail="Invalid filename - path traversal characters not allowed"
            )
        
        # Check file extension
        if not any(file.filename.lower().endswith(ext) for ext in ALLOWED_FILE_TYPES):
            raise HTTPException(
                status_code=400,
                detail=f"File type not supported. Allowed types: {', '.join(ALLOWED_FILE_TYPES)}"
            )

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

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class Section(BaseModel):
    heading: str
    summary: Optional[str] = None
    text: str

# Health check endpoint
@app.get("/")
async def root():
    """Health check endpoint."""
    return {"message": "Legal AI Backend is running", "version": "1.0.0"}

# Authentication endpoints
@app.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    """Register a new user and return authentication tokens."""
    try:
        storage = get_mongo_storage()
        
        # Check if user already exists
        existing_user = storage.get_user_by_email(user_data.email)
        if existing_user:
            raise HTTPException(
                status_code=400,
                detail="User with this email already exists"
            )
        
        # Hash password
        hashed_password = get_password_hash(user_data.password)
        
        # Create user data
        user_id = str(uuid.uuid4())
        user_dict = {
            "id": user_id,
            "email": user_data.email,
            "hashed_password": hashed_password,
            "full_name": user_data.full_name
        }
        
        # Save user to database
        storage.create_user(user_dict)
        
        # Create tokens for immediate login after registration
        access_token = create_access_token(data={"sub": user_id})
        refresh_token = create_refresh_token(data={"sub": user_id})
        
        return Token(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating user: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/auth/login", response_model=Token)
async def login(user_data: UserLogin):
    """Authenticate user and return tokens."""
    try:
        storage = get_mongo_storage()
        
        # Get user by email
        user = storage.get_user_by_email(user_data.email)
        if not user:
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password"
            )
        
        # Verify password
        if not verify_password(user_data.password, user["hashed_password"]):
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password"
            )
        
        # Create tokens
        access_token = create_access_token(data={"sub": user["id"]})
        refresh_token = create_refresh_token(data={"sub": user["id"]})
        
        return Token(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error during login: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/auth/refresh", response_model=Token)
async def refresh_access_token(request: RefreshTokenRequest):
    """Refresh access token using refresh token."""
    try:
        # Verify refresh token
        payload = verify_token(request.refresh_token)
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Check if user still exists
        storage = get_mongo_storage()
        user = storage.get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        # Create new tokens
        access_token = create_access_token(data={"sub": user_id})
        new_refresh_token = create_refresh_token(data={"sub": user_id})
        
        return Token(
            access_token=access_token,
            refresh_token=new_refresh_token,
            token_type="bearer"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error refreshing token: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid token")

@app.get("/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current user information."""
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        full_name=current_user["full_name"]
    )

@app.post("/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    """Send password reset email to user."""
    try:
        storage = get_mongo_storage()
        
        # Check if user exists
        user = storage.get_user_by_email(request.email)
        if not user:
            # Don't reveal whether email exists or not for security
            return {"message": "If an account with this email exists, you will receive a password reset link."}
        
        # Create password reset token
        reset_token = create_password_reset_token(request.email)
        
        # Send password reset email
        email_sent = await send_password_reset_email(
            to_email=request.email,
            full_name=user["full_name"],
            reset_token=reset_token
        )
        
        if email_sent:
            return {"message": "If an account with this email exists, you will receive a password reset link."}
        else:
            raise HTTPException(
                status_code=500,
                detail="Failed to send password reset email. Please try again later."
            )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in forgot password: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/auth/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """Reset user password using reset token."""
    try:
        # Verify reset token
        email = verify_password_reset_token(request.token)
        if not email:
            raise HTTPException(
                status_code=400,
                detail="Invalid or expired reset token"
            )
        
        # Validate new password
        if not validate_password(request.new_password):
            raise HTTPException(
                status_code=400,
                detail="Password must be at least 8 characters long and contain letters and numbers"
            )
        
        storage = get_mongo_storage()
        
        # Check if user still exists
        user = storage.get_user_by_email(email)
        if not user:
            raise HTTPException(
                status_code=400,
                detail="User account not found"
            )
        
        # Hash new password
        new_hashed_password = get_password_hash(request.new_password)
        
        # Update user password
        password_updated = storage.update_user_password(email, new_hashed_password)
        
        if not password_updated:
            raise HTTPException(
                status_code=500,
                detail="Failed to update password"
            )
        
        return {"message": "Password reset successfully. You can now log in with your new password."}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in reset password: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/extract-text/")
async def extract_text(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
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
async def analyze_document(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
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
            "sections": section_dicts,
            "user_id": current_user["id"]
        }
        
        # Save document to our storage with user association
        storage = get_mongo_storage()
        storage.save_document_for_user(document, current_user["id"])
        
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
async def get_documents(current_user: dict = Depends(get_current_user)):
    """Retrieve all documents for the current user"""
    try:
        # Get user-specific documents from storage
        storage = get_mongo_storage()
        documents = storage.get_documents_for_user(current_user["id"])
        return {"documents": documents}
    except Exception as e:
        print(f"Error retrieving documents: {str(e)}")
        return {"documents": [], "error": str(e)}

@app.get("/documents/{document_id}")
async def get_document(document_id: str, current_user: dict = Depends(get_current_user)):
    """Retrieve a specific document by ID for the current user"""
    try:
        storage = get_mongo_storage()
        document = storage.get_document_for_user(document_id, current_user["id"])
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
async def process_document(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
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
            "sections": [], # Keeping sections for potential future use or if analyze is still used
            "user_id": current_user["id"]
        }
        
        storage = get_mongo_storage()
        storage.save_document_for_user(document_data, current_user["id"])
        
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
