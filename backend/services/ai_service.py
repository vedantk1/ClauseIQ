"""
AI processing and OpenAI integration service.
"""
import asyncio
import json
import re
from typing import Optional, List, Dict, Any
from openai import AsyncOpenAI, OpenAIError
from settings import get_settings
from models.common import Clause, RiskLevel, ClauseType, Section
from clauseiq_types.common import ContractType


# Initialize OpenAI client
settings = get_settings()
api_key = settings.openai.api_key

if api_key and api_key != "your_api_key_here" and api_key.startswith("sk-"):
    openai_client = AsyncOpenAI(api_key=api_key)
    print("OpenAI client initialized successfully")
elif api_key and api_key != "your_api_key_here":
    print("Warning: Invalid OpenAI API key format. AI-powered summaries will not be available.")
    openai_client = None
else:
    print("No valid OpenAI API key provided. AI-powered summaries will not be available.")
    openai_client = None


async def generate_summary(section_text: str, section_heading: str = "", model: str = "gpt-3.5-turbo") -> str:
    """Generate a summary for a section using OpenAI's API"""
    if not openai_client:
        return "AI summary not available - OpenAI client not configured."
    
    try:
        prompt = f"""
        Summarize the following legal document section in 2-3 sentences.
        Focus on the key obligations, rights, and important terms.
        
        Section: {section_heading}
        Text: {section_text[:2000]}  # Limit text length
        
        Summary:
        """
        
        response = await openai_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are a legal AI assistant that provides clear, concise summaries of legal document sections."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=150,
            temperature=0.3
        )
        
        return response.choices[0].message.content.strip()
        
    except OpenAIError as e:
        print(f"OpenAI API error in generate_summary: {str(e)}")
        return f"Summary generation failed: {str(e)}"
    except Exception as e:
        print(f"Unexpected error in generate_summary: {str(e)}")
        return "Summary generation failed due to an unexpected error."


async def generate_document_summary(document_text: str, filename: str = "", model: str = "gpt-3.5-turbo") -> str:
    """Generate a summary for an entire document using OpenAI's API"""
    if not openai_client:
        return "AI summary not available - OpenAI client not configured."
    
    try:
        # Truncate text if too long (approximately 8000 characters to stay under token limits)
        truncated_text = document_text[:8000]
        if len(document_text) > 8000:
            truncated_text += "\n\n[Document truncated for analysis...]"
        
        prompt = f"""
        Analyze this legal document and provide a comprehensive summary that covers:
        1. Document type and purpose
        2. Key parties involved
        3. Main obligations and rights
        4. Important terms and conditions
        5. Notable clauses or provisions
        6. Overall risk assessment
        
        Document: {filename}
        Content: {truncated_text}
        
        Please provide a structured summary in 4-6 paragraphs:
        """
        
        response = await openai_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are a legal AI assistant that provides comprehensive analysis of legal documents. Focus on identifying key terms, obligations, rights, and potential risks."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=800,
            temperature=0.3
        )
        
        return response.choices[0].message.content.strip()
        
    except OpenAIError as e:
        print(f"OpenAI API error in generate_document_summary: {str(e)}")
        return f"Document summary generation failed: {str(e)}"
    except Exception as e:
        print(f"Unexpected error in generate_document_summary: {str(e)}")
        return "Document summary generation failed due to an unexpected error."


async def analyze_clause(clause: Clause, model: str = "gpt-3.5-turbo") -> Clause:
    """Analyze a clause for risk assessment and generate recommendations."""
    if not openai_client:
        # Return clause with basic analysis if no AI available
        clause.summary = "AI analysis not available"
        clause.risk_assessment = "Cannot assess risk without AI"
        clause.recommendations = ["Review manually with legal counsel"]
        clause.key_points = ["Manual review required"]
        return clause
    
    try:
        prompt = f"""
        Analyze this legal clause and provide:
        1. A brief summary (1-2 sentences)
        2. Risk level assessment (low/medium/high) with justification
        3. 2-3 specific recommendations for improvement or consideration
        4. 2-3 key points to note
        
        Clause Type: {clause.clause_type}
        Clause Text: {clause.text[:1500]}
        
        Format your response as:
        SUMMARY: [brief summary]
        RISK: [low/medium/high] - [justification]
        RECOMMENDATIONS: [recommendation 1] | [recommendation 2] | [recommendation 3]
        KEY_POINTS: [point 1] | [point 2] | [point 3]
        """
        
        response = await openai_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are a legal AI assistant specializing in contract analysis. Assess clauses for potential risks and provide actionable recommendations."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=400,
            temperature=0.3
        )
        
        analysis = response.choices[0].message.content.strip()
        
        # Parse the structured response
        lines = analysis.split('\n')
        summary = ""
        risk_assessment = ""
        recommendations = []
        key_points = []
        
        for line in lines:
            line = line.strip()
            if line.startswith('SUMMARY:'):
                summary = line.replace('SUMMARY:', '').strip()
            elif line.startswith('RISK:'):
                risk_line = line.replace('RISK:', '').strip()
                risk_assessment = risk_line
                # Extract risk level
                if risk_line.lower().startswith('high'):
                    clause.risk_level = RiskLevel.HIGH
                elif risk_line.lower().startswith('medium'):
                    clause.risk_level = RiskLevel.MEDIUM
                else:
                    clause.risk_level = RiskLevel.LOW
            elif line.startswith('RECOMMENDATIONS:'):
                recs = line.replace('RECOMMENDATIONS:', '').strip()
                recommendations = [r.strip() for r in recs.split('|') if r.strip()]
            elif line.startswith('KEY_POINTS:'):
                points = line.replace('KEY_POINTS:', '').strip()
                key_points = [p.strip() for p in points.split('|') if p.strip()]
        
        # Update clause with analysis
        clause.summary = summary if summary else "Analysis completed"
        clause.risk_assessment = risk_assessment if risk_assessment else "Risk assessment completed"
        clause.recommendations = recommendations if recommendations else ["Review with legal counsel"]
        clause.key_points = key_points if key_points else ["Key analysis points generated"]
        
        return clause
        
    except OpenAIError as e:
        print(f"OpenAI API error in analyze_clause: {str(e)}")
        clause.summary = f"Analysis failed: {str(e)}"
        clause.risk_assessment = "Could not assess risk due to API error"
        clause.recommendations = ["Review manually with legal counsel"]
        clause.key_points = ["AI analysis unavailable"]
        return clause
    except Exception as e:
        print(f"Unexpected error in analyze_clause: {str(e)}")
        clause.summary = "Analysis failed due to unexpected error"
        clause.risk_assessment = "Could not assess risk"
        clause.recommendations = ["Review manually with legal counsel"]
        clause.key_points = ["Manual review required"]
        return clause


async def detect_contract_type(document_text: str, filename: str = "", model: str = "gpt-3.5-turbo") -> ContractType:
    """Detect contract type using LLM analysis."""
    if not openai_client:
        return ContractType.OTHER
    
    try:
        # Truncate text for analysis
        truncated_text = document_text[:3000]
        
        prompt = f"""
        Analyze this legal document and identify its type. Based on the content, language, and structure, determine which category best describes this document:

        AVAILABLE TYPES:
        - employment: Employment contracts, job offers, work agreements
        - nda: Non-disclosure agreements, confidentiality agreements
        - service_agreement: Service contracts, consulting agreements, professional services
        - lease: Rental agreements, lease contracts, property rentals
        - purchase: Purchase agreements, sales contracts, buying agreements
        - partnership: Partnership agreements, joint ventures, business partnerships
        - license: Software licenses, intellectual property licenses, usage rights
        - consulting: Consulting agreements, advisory contracts
        - contractor: Independent contractor agreements, freelance contracts
        - other: Any document that doesn't clearly fit the above categories

        Document filename: {filename}
        Document content: {truncated_text}

        Respond with ONLY the type name (e.g., "employment", "nda", "service_agreement", etc.).
        """
        
        response = await openai_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are a legal document classification expert. Analyze documents and identify their type with high accuracy."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=50,
            temperature=0.1
        )
        
        detected_type = response.choices[0].message.content.strip().lower()
        
        # Map response to enum value
        type_mapping = {
            "employment": ContractType.EMPLOYMENT,
            "nda": ContractType.NDA,
            "service_agreement": ContractType.SERVICE_AGREEMENT,
            "lease": ContractType.LEASE,
            "purchase": ContractType.PURCHASE,
            "partnership": ContractType.PARTNERSHIP,
            "license": ContractType.LICENSE,
            "consulting": ContractType.CONSULTING,
            "contractor": ContractType.CONTRACTOR,
            "other": ContractType.OTHER
        }
        
        return type_mapping.get(detected_type, ContractType.OTHER)
        
    except Exception as e:
        print(f"Error detecting contract type: {str(e)}")
        return ContractType.OTHER


async def extract_sections_with_llm(document_text: str, contract_type: ContractType, model: str = "gpt-3.5-turbo") -> List[Section]:
    """Extract document sections using LLM semantic understanding."""
    if not openai_client:
        # Fallback to basic section extraction
        return _fallback_section_extraction(document_text)
    
    try:
        # For very long documents, analyze in chunks
        max_chars = 12000
        if len(document_text) > max_chars:
            document_text = document_text[:max_chars] + "\n\n[Document truncated for analysis...]"
        
        prompt = f"""
        Analyze this {contract_type.value} document and break it into logical sections based on content meaning, not just formatting.

        For each section, provide:
        1. A descriptive heading that captures the main topic
        2. The exact text content of that section

        Guidelines:
        - Focus on semantic meaning over formatting
        - Group related content together
        - Create meaningful section names
        - Don't split closely related content

        Respond in this exact JSON format:
        {{
            "sections": [
                {{
                    "heading": "Section Title",
                    "text": "Full section content..."
                }}
            ]
        }}

        Document content:
        {document_text}
        """
        
        response = await openai_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are a legal document analysis expert. Break documents into meaningful sections based on content and legal structure."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=2000,
            temperature=0.2
        )
        
        # Parse JSON response
        content = response.choices[0].message.content.strip()
        try:
            parsed = json.loads(content)
            sections = []
            for section_data in parsed.get("sections", []):
                sections.append(Section(
                    heading=section_data.get("heading", "Untitled Section"),
                    text=section_data.get("text", "")
                ))
            return sections
        except json.JSONDecodeError as e:
            print(f"Failed to parse LLM section response: {e}")
            print(f"Response content: {content[:500]}...")
            
            # Try to extract JSON from response if it's wrapped in other text
            import re
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                json_part = json_match.group()
                try:
                    parsed = json.loads(json_part)
                    sections = []
                    for section_data in parsed.get("sections", []):
                        sections.append(Section(
                            heading=section_data.get("heading", "Untitled Section"),
                            text=section_data.get("text", "")
                        ))
                    print("✅ Successfully recovered from wrapped JSON response")
                    return sections
                except json.JSONDecodeError:
                    pass
            
            print("Falling back to basic extraction")
            return _fallback_section_extraction(document_text)
        
    except Exception as e:
        print(f"Error extracting sections with LLM: {str(e)}")
        return _fallback_section_extraction(document_text)


async def extract_clauses_with_llm(document_text: str, contract_type: ContractType, model: str = "gpt-3.5-turbo") -> List[Clause]:
    """Extract and classify clauses using LLM analysis."""
    if not openai_client:
        return []
    
    try:
        # Get contract-specific clause types
        relevant_clause_types = _get_relevant_clause_types(contract_type)
        clause_types_str = ", ".join([ct.value for ct in relevant_clause_types])
        
        # For very long documents, analyze in chunks
        max_chars = 10000
        if len(document_text) > max_chars:
            document_text = document_text[:max_chars] + "\n\n[Document truncated for analysis...]"
        
        prompt = f"""
        Analyze this {contract_type.value} document and identify all significant clauses. For each clause you find:

        1. Extract the exact text of the clause
        2. Classify it using one of these types: {clause_types_str}
        3. Create a descriptive heading
        4. Assess the risk level (low, medium, high)

        Focus on clauses that contain:
        - Legal obligations or rights
        - Terms and conditions
        - Restrictions or limitations  
        - Financial or payment terms
        - Liability or risk provisions
        - Termination or expiration conditions

        Respond in this exact JSON format:
        {{
            "clauses": [
                {{
                    "heading": "Descriptive clause title",
                    "text": "Exact clause text from document",
                    "clause_type": "clause_type_from_list",
                    "risk_level": "low|medium|high"
                }}
            ]
        }}

        Document content:
        {document_text}
        """
        
        response = await openai_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": f"You are a legal expert specializing in {contract_type.value} analysis. Extract and classify clauses with precision and attention to legal nuance."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=3000,
            temperature=0.2
        )
        
        # Parse JSON response
        content = response.choices[0].message.content.strip()
        try:
            parsed = json.loads(content)
            clauses = []
            for clause_data in parsed.get("clauses", []):
                try:
                    clause_type = ClauseType(clause_data.get("clause_type", "general"))
                except ValueError:
                    clause_type = ClauseType.GENERAL
                
                try:
                    risk_level = RiskLevel(clause_data.get("risk_level", "medium"))
                except ValueError:
                    risk_level = RiskLevel.MEDIUM
                
                clause = Clause(
                    heading=clause_data.get("heading", "Unnamed Clause"),
                    text=clause_data.get("text", ""),
                    clause_type=clause_type,
                    risk_level=risk_level
                )
                clauses.append(clause)
            
            return clauses
        except json.JSONDecodeError as e:
            print(f"Failed to parse LLM clause response: {e}")
            print(f"Response content: {content[:500]}...")
            
            # Try to extract JSON from response if it's wrapped in other text
            import re
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                json_part = json_match.group()
                try:
                    parsed = json.loads(json_part)
                    clauses = []
                    for clause_data in parsed.get("clauses", []):
                        try:
                            clause_type = ClauseType(clause_data.get("clause_type", "general"))
                        except ValueError:
                            clause_type = ClauseType.GENERAL
                        
                        try:
                            risk_level = RiskLevel(clause_data.get("risk_level", "medium"))
                        except ValueError:
                            risk_level = RiskLevel.MEDIUM
                        
                        clause = Clause(
                            heading=clause_data.get("heading", "Unnamed Clause"),
                            text=clause_data.get("text", ""),
                            clause_type=clause_type,
                            risk_level=risk_level
                        )
                        clauses.append(clause)
                    print(f"✅ Successfully recovered from wrapped JSON response with {len(clauses)} clauses")
                    return clauses
                except json.JSONDecodeError:
                    pass
            
            print("Falling back to empty clause list")
            return []
        
    except Exception as e:
        print(f"Error extracting clauses with LLM: {str(e)}")
        return []


async def generate_contract_specific_summary(document_text: str, contract_type: ContractType, filename: str = "", model: str = "gpt-3.5-turbo") -> str:
    """Generate a contract-type-specific summary using LLM."""
    if not openai_client:
        return "AI summary not available - OpenAI client not configured."
    
    try:
        # Truncate text if too long
        truncated_text = document_text[:8000]
        if len(document_text) > 8000:
            truncated_text += "\n\n[Document truncated for analysis...]"
        
        # Contract-specific prompts
        contract_prompts = {
            ContractType.EMPLOYMENT: """
            Analyze this employment contract and provide a comprehensive summary covering:
            1. Position and role details
            2. Compensation structure (salary, benefits, bonuses)
            3. Employment terms and conditions
            4. Termination clauses and notice periods
            5. Non-compete and confidentiality obligations
            6. Key employee rights and employer obligations
            7. Notable restrictions or unusual clauses
            8. Overall risk assessment for the employee
            """,
            ContractType.NDA: """
            Analyze this non-disclosure agreement and provide a comprehensive summary covering:
            1. Parties involved and their roles
            2. Definition and scope of confidential information
            3. Disclosure obligations and restrictions
            4. Duration and term of confidentiality
            5. Exceptions to confidentiality requirements
            6. Return or destruction of information clauses
            7. Consequences of breach
            8. Overall assessment of restrictions and obligations
            """,
            ContractType.SERVICE_AGREEMENT: """
            Analyze this service agreement and provide a comprehensive summary covering:
            1. Service provider and client details
            2. Scope of work and deliverables
            3. Payment terms and fee structure
            4. Timeline and performance requirements
            5. Intellectual property rights
            6. Liability and indemnification clauses
            7. Termination conditions
            8. Overall risk assessment for both parties
            """,
            ContractType.LEASE: """
            Analyze this lease agreement and provide a comprehensive summary covering:
            1. Property details and rental terms
            2. Rent amount, payment schedule, and increases
            3. Security deposit and fees
            4. Tenant and landlord responsibilities
            5. Use restrictions and occupancy rules
            6. Maintenance and repair obligations
            7. Termination and renewal terms
            8. Overall assessment of tenant rights and obligations
            """
        }
        
        # Use contract-specific prompt or generic one
        specific_prompt = contract_prompts.get(contract_type, """
        Analyze this legal document and provide a comprehensive summary covering:
        1. Document type and purpose
        2. Key parties involved and their roles
        3. Main obligations and rights of each party
        4. Important terms and conditions
        5. Financial or payment arrangements
        6. Termination or expiration conditions
        7. Notable clauses or provisions
        8. Overall risk assessment
        """)
        
        prompt = f"""
        {specific_prompt}
        
        Document: {filename}
        Content: {truncated_text}
        
        Provide a clear, structured summary in 4-6 paragraphs that a non-lawyer can understand:
        """
        
        response = await openai_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": f"You are a legal AI assistant specializing in {contract_type.value} analysis. Provide comprehensive, accurate analysis that helps non-lawyers understand complex legal documents."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=1000,
            temperature=0.3
        )
        
        return response.choices[0].message.content.strip()
        
    except Exception as e:
        print(f"Error generating contract-specific summary: {str(e)}")
        return f"Summary generation failed: {str(e)}"


def is_ai_available() -> bool:
    """Check if AI processing is available (OpenAI client is configured)"""
    return openai_client is not None


def _get_relevant_clause_types(contract_type: ContractType) -> List[ClauseType]:
    """Get relevant clause types for a specific contract type."""
    
    # Universal clauses applicable to most contracts
    universal_clauses = [
        ClauseType.CONFIDENTIALITY,
        ClauseType.INTELLECTUAL_PROPERTY,
        ClauseType.DISPUTE_RESOLUTION,
        ClauseType.LIABILITY,
        ClauseType.INDEMNIFICATION,
        ClauseType.FORCE_MAJEURE,
        ClauseType.GOVERNING_LAW,
        ClauseType.GENERAL
    ]
    
    # Contract-specific clauses
    contract_specific = {
        ContractType.EMPLOYMENT: [
            ClauseType.COMPENSATION, ClauseType.TERMINATION, ClauseType.NON_COMPETE,
            ClauseType.BENEFITS, ClauseType.WORKING_CONDITIONS, ClauseType.PROBATION
        ],
        ContractType.NDA: [
            ClauseType.DISCLOSURE_OBLIGATIONS, ClauseType.RETURN_OF_INFORMATION
        ],
        ContractType.SERVICE_AGREEMENT: [
            ClauseType.SCOPE_OF_WORK, ClauseType.DELIVERABLES, 
            ClauseType.PAYMENT_TERMS, ClauseType.SERVICE_LEVEL
        ],
        ContractType.CONSULTING: [
            ClauseType.SCOPE_OF_WORK, ClauseType.DELIVERABLES, 
            ClauseType.PAYMENT_TERMS, ClauseType.SERVICE_LEVEL
        ],
        ContractType.CONTRACTOR: [
            ClauseType.SCOPE_OF_WORK, ClauseType.DELIVERABLES, 
            ClauseType.PAYMENT_TERMS, ClauseType.TERMINATION
        ],
        ContractType.LEASE: [
            ClauseType.RENT, ClauseType.SECURITY_DEPOSIT, 
            ClauseType.MAINTENANCE, ClauseType.USE_RESTRICTIONS
        ]
    }
    
    specific_clauses = contract_specific.get(contract_type, [])
    return specific_clauses + universal_clauses


def _fallback_section_extraction(document_text: str) -> List[Section]:
    """Fallback section extraction using basic patterns."""
    if not document_text or not document_text.strip():
        return []
    
    sections = []
    
    # Simple pattern-based extraction as fallback
    section_patterns = [
        r'^(\d+\.?\s*[A-Z][^.\n]*?)(?=\n)',  # Numbered sections
        r'^([A-Z][A-Z\s]{2,}?)(?=\n)',       # ALL CAPS headings
        r'^([A-Z][^.\n]*?):(?=\s|\n)',       # Headings with colons
    ]
    
    # Try to find sections using patterns
    combined_pattern = '|'.join(f'({pattern})' for pattern in section_patterns)
    parts = re.split(combined_pattern, document_text, flags=re.MULTILINE | re.IGNORECASE)
    
    current_heading = None
    current_text = ""
    
    for part in parts:
        if part and part.strip():
            # Check if this looks like a heading
            if (len(part.strip()) < 100 and 
                (part.strip().isupper() or 
                 re.match(r'^\d+\.?\s*[A-Z]', part.strip()) or
                 part.strip().endswith(':'))):
                
                # Save previous section
                if current_heading and current_text.strip():
                    sections.append(Section(
                        heading=current_heading.strip(),
                        text=current_text.strip()
                    ))
                
                # Start new section
                current_heading = part.strip().rstrip(':')
                current_text = ""
            else:
                # Add to current section content
                current_text += part + " "
    
    # Add the last section
    if current_heading and current_text.strip():
        sections.append(Section(
            heading=current_heading.strip(),
            text=current_text.strip()
        ))
    
    # If no sections found, create a single section
    if not sections and document_text.strip():
        sections.append(Section(
            heading="Document Content",
            text=document_text.strip()
        ))
    
    return sections
