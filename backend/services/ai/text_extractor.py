"""
Text extraction service for ClauseIQ documents.

Provides unified text extraction from various document formats.
"""
import asyncio
import logging
import tempfile
from typing import Optional
import pdfplumber

logger = logging.getLogger(__name__)


class TextExtractor:
    """Service for extracting text from various document formats."""
    
    async def extract_text(self, file_content: bytes, filename: str) -> str:
        """
        Extract text from document file content.
        
        Args:
            file_content: Raw file bytes
            filename: Original filename for format detection
            
        Returns:
            Extracted text content
            
        Raises:
            Exception: If text extraction fails
        """
        try:
            # Determine file type from filename
            filename_lower = filename.lower()
            
            if filename_lower.endswith('.pdf'):
                return await self._extract_pdf_text(file_content)
            else:
                raise ValueError(f"Unsupported file format: {filename}")
                
        except Exception as e:
            logger.error(f"Text extraction failed for {filename}: {e}")
            raise
    
    async def _extract_pdf_text(self, file_content: bytes) -> str:
        """Extract text from PDF file content."""
        extracted_text = ""
        
        # Create temporary file for pdfplumber
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as temp_file:
            temp_file.write(file_content)
            temp_file_path = temp_file.name
        
        try:
            # Extract text using pdfplumber
            with pdfplumber.open(temp_file_path) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        extracted_text += page_text + "\n"
            
            if not extracted_text.strip():
                raise ValueError("No text could be extracted from PDF")
                
            return extracted_text.strip()
            
        finally:
            # Clean up temporary file
            import os
            try:
                os.unlink(temp_file_path)
            except:
                pass


# Global text extractor instance
_text_extractor = None

def get_text_extractor() -> TextExtractor:
    """Get the global text extractor instance."""
    global _text_extractor
    if _text_extractor is None:
        _text_extractor = TextExtractor()
    return _text_extractor
