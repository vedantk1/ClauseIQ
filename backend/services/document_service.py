"""
Document processing utilities.
"""
import os
import re
import pdfplumber
from typing import List, Tuple
from fastapi import UploadFile, HTTPException
from settings import get_settings
from models.common import Section, Clause, ClauseType, RiskLevel, ContractType


# Get settings instance
settings = get_settings()
MAX_FILE_SIZE_BYTES = settings.file_upload.max_file_size_mb * 1024 * 1024


def validate_file(file: UploadFile):
    """Validate uploaded file for size, type, and security."""
    # Check file size
    if hasattr(file, 'size') and file.size and file.size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size allowed: {settings.file_upload.max_file_size_mb}MB"
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
        if not any(file.filename.lower().endswith(ext) for ext in settings.file_upload.allowed_file_types):
            raise HTTPException(
                status_code=400,
                detail=f"File type not supported. Allowed types: {', '.join(settings.file_upload.allowed_file_types)}"
            )


def extract_sections(text: str) -> List[Section]:
    """Split document into sections based on common patterns in legal documents."""
    if not text or not text.strip():
        return []
    
    sections = []
    
    # Common section patterns in legal documents
    section_patterns = [
        r'^(\d+\.?\s*[A-Z][^.\n]*?)(?=\n)',  # Numbered sections like "1. Introduction"
        r'^([A-Z][A-Z\s]{2,}?)(?=\n)',       # ALL CAPS headings
        r'^([A-Z][^.\n]*?):(?=\s|\n)',       # Headings with colons
        r'^(Article\s+[IVXLC]+[^.\n]*?)(?=\n)',  # Article headings
        r'^(Section\s+\d+[^.\n]*?)(?=\n)',   # Section headings
    ]
    
    # Try to find sections using patterns
    combined_pattern = '|'.join(f'({pattern})' for pattern in section_patterns)
    
    # Split text by potential section headers
    parts = re.split(combined_pattern, text, flags=re.MULTILINE | re.IGNORECASE)
    
    current_heading = None
    current_text = ""
    
    for part in parts:
        if part and part.strip():
            # Check if this looks like a heading (short, title-case, etc.)
            if (len(part.strip()) < 100 and 
                (part.strip().isupper() or 
                 re.match(r'^\d+\.?\s*[A-Z]', part.strip()) or
                 part.strip().endswith(':') or
                 'article' in part.lower() or
                 'section' in part.lower())):
                
                # Save previous section if we have one
                if current_heading and current_text.strip():
                    sections.append(Section(
                        heading=current_heading.strip(),
                        text=current_text.strip()
                    ))
                
                # Start new section
                current_heading = part.strip().rstrip(':')
                current_text = ""
            else:
                # This is content, add to current section
                current_text += part + " "
    
    # Add the last section
    if current_heading and current_text.strip():
        sections.append(Section(
            heading=current_heading.strip(),
            text=current_text.strip()
        ))
    
    # If no clear sections found, create a single section with the entire text
    if not sections and text.strip():
        sections.append(Section(
            heading="Document Content",
            text=text.strip()
        ))
    
    return sections


def extract_clauses(text: str) -> List[Clause]:
    """Extract and categorize clauses from legal document text."""
    if not text or not text.strip():
        return []
    
    clauses = []
    
    # Define clause patterns and their types
    clause_patterns = {
        ClauseType.COMPENSATION: [
            r'(salary|wage|compensation|payment|remuneration)[^.]*?[\.\n]',
            r'(pay|paid|paying)[^.]*?[\.\n]',
            r'(\$\d+|USD|dollars)[^.]*?[\.\n]'
        ],
        ClauseType.TERMINATION: [
            r'(termination|terminate|end|ending|expir)[^.]*?[\.\n]',
            r'(notice|30 days|two weeks)[^.]*?(termination|end)[^.]*?[\.\n]',
            r'(employment.*end|end.*employment)[^.]*?[\.\n]'
        ],
        ClauseType.NON_COMPETE: [
            r'(non-compete|noncompete|restraint.*trade)[^.]*?[\.\n]',
            r'(compete|competition|competing)[^.]*?(prohibited|restrict|prevent)[^.]*?[\.\n]',
            r'(not.*engage|shall not.*work)[^.]*?[\.\n]'
        ],
        ClauseType.CONFIDENTIALITY: [
            r'(confidential|confidentiality|proprietary)[^.]*?[\.\n]',
            r'(non-disclosure|nondisclosure|NDA)[^.]*?[\.\n]',
            r'(trade secret|confidential information)[^.]*?[\.\n]'
        ],
        ClauseType.BENEFITS: [
            r'(benefits|health insurance|medical|dental|401k|retirement)[^.]*?[\.\n]',
            r'(vacation|PTO|sick leave|holiday)[^.]*?[\.\n]',
            r'(insurance|coverage)[^.]*?[\.\n]'
        ],
        ClauseType.WORKING_CONDITIONS: [
            r'(work schedule|hours|overtime|remote)[^.]*?[\.\n]',
            r'(workplace|office|location)[^.]*?[\.\n]',
            r'(duties|responsibilities|job description)[^.]*?[\.\n]'
        ],
        ClauseType.INTELLECTUAL_PROPERTY: [
            r'(intellectual property|IP|copyright|patent|trademark)[^.]*?[\.\n]',
            r'(invention|work.*hire|proprietary.*right)[^.]*?[\.\n]',
            r'(assign.*right|transfer.*ownership)[^.]*?[\.\n]'
        ],
        ClauseType.DISPUTE_RESOLUTION: [
            r'(arbitration|mediation|dispute resolution)[^.]*?[\.\n]',
            r'(court|jurisdiction|governing law)[^.]*?[\.\n]',
            r'(legal.*proceeding|lawsuit)[^.]*?[\.\n]'
        ],
        ClauseType.PROBATION: [
            r'(probation|probationary period|trial period)[^.]*?[\.\n]',
            r'(90 days|six months|evaluation)[^.]*?[\.\n]'
        ]
    }
    
    # Track which parts of text have been categorized
    text_lower = text.lower()
    processed_positions = set()
    
    for clause_type, patterns in clause_patterns.items():
        for pattern in patterns:
            matches = re.finditer(pattern, text_lower, re.IGNORECASE | re.DOTALL)
            
            for match in matches:
                start, end = match.span()
                
                # Check if this text has already been processed
                if any(pos in processed_positions for pos in range(start, end)):
                    continue
                
                # Mark this range as processed
                for pos in range(start, end):
                    processed_positions.add(pos)
                
                # Extract the actual matched text from original (preserving case)
                matched_text = text[start:end].strip()
                
                if len(matched_text) > 20:  # Only include substantial clauses
                    # Determine risk level based on clause type and content
                    risk_level = _determine_risk_level(clause_type, matched_text)
                    
                    # Generate a descriptive heading
                    heading = _generate_clause_heading(clause_type, matched_text)
                    
                    clause = Clause(
                        heading=heading,
                        text=matched_text,
                        clause_type=clause_type,
                        risk_level=risk_level,
                        position_start=start,
                        position_end=end
                    )
                    
                    clauses.append(clause)
    
    # If no specific clauses found, create general clauses from sentences
    if not clauses:
        sentences = re.split(r'[.!?]+', text)
        for i, sentence in enumerate(sentences[:10]):  # Limit to first 10 sentences
            if len(sentence.strip()) > 50:  # Only substantial sentences
                clause = Clause(
                    heading=f"General Provision {i+1}",
                    text=sentence.strip(),
                    clause_type=ClauseType.GENERAL,
                    risk_level=RiskLevel.LOW
                )
                clauses.append(clause)
    
    return clauses


def _determine_risk_level(clause_type: ClauseType, text: str) -> RiskLevel:
    """Determine risk level based on clause type and content."""
    text_lower = text.lower()
    
    # High-risk indicators
    high_risk_keywords = [
        'immediate termination', 'without notice', 'at will', 'liquidated damages',
        'non-compete', 'restraint of trade', 'exclusive', 'perpetual', 'irrevocable',
        'unlimited liability', 'personal guarantee', 'indemnify'
    ]
    
    # Medium-risk indicators
    medium_risk_keywords = [
        'confidential', 'proprietary', 'terminate', 'breach', 'default',
        'penalty', 'restriction', 'limitation', 'bind', 'obligation'
    ]
    
    # Check for high-risk keywords
    if any(keyword in text_lower for keyword in high_risk_keywords):
        return RiskLevel.HIGH
    
    # Check for medium-risk keywords
    if any(keyword in text_lower for keyword in medium_risk_keywords):
        return RiskLevel.MEDIUM
    
    # Clause type based risk assessment
    if clause_type in [ClauseType.NON_COMPETE, ClauseType.TERMINATION]:
        return RiskLevel.HIGH
    elif clause_type in [ClauseType.CONFIDENTIALITY, ClauseType.INTELLECTUAL_PROPERTY]:
        return RiskLevel.MEDIUM
    
    return RiskLevel.LOW


def _generate_clause_heading(clause_type: ClauseType, text: str) -> str:
    """Generate a descriptive heading for a clause."""
    # Map clause types to readable headings
    type_headings = {
        ClauseType.COMPENSATION: "Compensation and Payment",
        ClauseType.TERMINATION: "Termination Clause",
        ClauseType.NON_COMPETE: "Non-Compete Agreement",
        ClauseType.CONFIDENTIALITY: "Confidentiality Agreement",
        ClauseType.BENEFITS: "Benefits and Perks",
        ClauseType.WORKING_CONDITIONS: "Working Conditions",
        ClauseType.INTELLECTUAL_PROPERTY: "Intellectual Property Rights",
        ClauseType.DISPUTE_RESOLUTION: "Dispute Resolution",
        ClauseType.PROBATION: "Probationary Period",
        ClauseType.GENERAL: "General Provision"
    }
    
    base_heading = type_headings.get(clause_type, "Legal Provision")
    
    # Try to make heading more specific based on content
    text_lower = text.lower()
    
    if clause_type == ClauseType.COMPENSATION:
        if 'salary' in text_lower:
            return "Salary Information"
        elif 'bonus' in text_lower:
            return "Bonus Structure"
        elif 'overtime' in text_lower:
            return "Overtime Pay"
    
    elif clause_type == ClauseType.TERMINATION:
        if 'notice' in text_lower:
            return "Termination Notice"
        elif 'cause' in text_lower:
            return "Termination for Cause"
        elif 'at will' in text_lower:
            return "At-Will Employment"
    
    return base_heading


async def process_document_with_llm(document_text: str, filename: str = "", model: str = "gpt-3.5-turbo") -> Tuple[ContractType, List[Section], List[Clause]]:
    """
    Process a document using LLM-based analysis instead of heuristic patterns.
    
    Returns:
        Tuple of (contract_type, sections, clauses)
    """
    from services.ai_service import (
        detect_contract_type, 
        extract_sections_with_llm, 
        extract_clauses_with_llm,
        is_ai_available
    )
    
    if not is_ai_available():
        # Fallback to heuristic methods if AI is not available
        print("AI not available, falling back to heuristic analysis")
        return ContractType.OTHER, extract_sections(document_text), extract_clauses(document_text)
    
    try:
        # Step 1: Detect contract type
        print(f"Detecting contract type for document: {filename}")
        contract_type = await detect_contract_type(document_text, filename, model)
        print(f"Detected contract type: {contract_type}")
        
        # Step 2: Extract sections using LLM
        print("Extracting sections with LLM")
        sections = await extract_sections_with_llm(document_text, contract_type, model)
        print(f"Extracted {len(sections)} sections")
        
        # Step 3: Extract clauses using LLM
        print("Extracting clauses with LLM")
        clauses = await extract_clauses_with_llm(document_text, contract_type, model)
        print(f"Extracted {len(clauses)} clauses")
        
        return contract_type, sections, clauses
        
    except Exception as e:
        print(f"Error in LLM document processing: {str(e)}")
        # Fallback to heuristic methods on error
        return ContractType.OTHER, extract_sections(document_text), extract_clauses(document_text)


def is_llm_processing_available() -> bool:
    """Check if LLM-based document processing is available."""
    from services.ai_service import is_ai_available
    return is_ai_available()
