"""
AI processing and OpenAI integration service.
"""
import asyncio
import json
import re
from typing import Optional, List, Dict, Any
from openai import AsyncOpenAI, OpenAIError
from settings import get_settings
from models.common import Clause, RiskLevel, ClauseType
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



async def generate_structured_document_summary(document_text: str, filename: str = "", model: str = "gpt-3.5-turbo") -> Dict[str, Any]:
    """Generate a structured document summary with categorized insights"""
    if not openai_client:
        return {
            "overview": "AI summary not available - OpenAI client not configured.",
            "key_parties": [],
            "important_dates": [],
            "major_obligations": [],
            "risk_highlights": [],
            "key_insights": []
        }
    
    try:
        # Truncate text if too long
        truncated_text = document_text[:8000]
        if len(document_text) > 8000:
            truncated_text += "\n\n[Document truncated for analysis...]"
        
        prompt = f"""
        Analyze this legal document and provide a structured summary in the exact JSON format below.
        Be thorough but concise in each section.
        
        Document: {filename}
        Content: {truncated_text}
        
        Respond with ONLY valid JSON in this exact format:
        {{
            "overview": "Brief 2-3 sentence overview of the document's purpose and significance",
            "key_parties": ["Party 1: Role/description", "Party 2: Role/description"],
            "important_dates": ["Date type: Specific date or timeframe", "Another date: Description"],
            "major_obligations": ["Obligation 1: Who does what", "Obligation 2: Description"],
            "risk_highlights": ["Risk 1: Description and impact", "Risk 2: Potential issue"],
            "key_insights": ["Insight 1: Important detail", "Insight 2: Notable provision"]
        }}
        """
        
        response = await openai_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are a legal AI assistant that provides structured analysis of legal documents. Always respond with valid JSON in the requested format."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=1000,
            temperature=0.2
        )
        
        content = response.choices[0].message.content.strip()
        
        # Parse JSON response
        try:
            structured_summary = json.loads(content)
            
            # Validate required fields
            required_fields = ["overview", "key_parties", "important_dates", "major_obligations", "risk_highlights", "key_insights"]
            for field in required_fields:
                if field not in structured_summary:
                    structured_summary[field] = [] if field != "overview" else "Summary not available"
                    
            return structured_summary
            
        except json.JSONDecodeError as e:
            print(f"Failed to parse structured summary JSON: {e}")
            print(f"Raw response: {content[:500]}...")
            
            # Try to extract JSON from response if it's wrapped
            import re
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                try:
                    structured_summary = json.loads(json_match.group())
                    return structured_summary
                except json.JSONDecodeError:
                    pass
            
            # Fallback to basic structure
            return {
                "overview": "Document analysis completed, but structured data could not be parsed.",
                "key_parties": ["Analysis available in clauses section"],
                "important_dates": ["Review document for specific dates"],
                "major_obligations": ["Detailed obligations listed in clauses"],
                "risk_highlights": ["Risk assessment available in risk analysis"],
                "key_insights": ["Full insights available in document text"]
            }
        
    except OpenAIError as e:
        print(f"OpenAI API error in generate_structured_document_summary: {str(e)}")
        return {
            "overview": f"Document summary generation failed: {str(e)}",
            "key_parties": [],
            "important_dates": [],
            "major_obligations": [],
            "risk_highlights": [],
            "key_insights": []
        }
    except Exception as e:
        print(f"Unexpected error in generate_structured_document_summary: {str(e)}")
        return {
            "overview": "Document summary generation failed due to an unexpected error.",
            "key_parties": [],
            "important_dates": [],
            "major_obligations": [],
            "risk_highlights": [],
            "key_insights": []
        }


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
            ContractType.CONSULTING: """
            Analyze this consulting agreement and provide a comprehensive summary covering:
            1. Consultant and client relationship details
            2. Scope of consulting services and deliverables
            3. Fee structure and payment schedules
            4. Project timeline and milestones
            5. Intellectual property ownership and usage rights
            6. Confidentiality and non-disclosure provisions
            7. Termination clauses and project completion terms
            8. Overall assessment of consultant vs client obligations
            """,
            ContractType.CONTRACTOR: """
            Analyze this contractor agreement and provide a comprehensive summary covering:
            1. Contractor and hiring party relationship
            2. Work scope, deliverables, and performance standards
            3. Payment terms, rates, and invoicing procedures
            4. Project timeline and deadline requirements
            5. Independent contractor vs employee classification terms
            6. Intellectual property and work product ownership
            7. Termination provisions and contract completion
            8. Overall risk assessment for contractor and hiring party
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
            """,
            ContractType.PURCHASE: """
            Analyze this purchase agreement and provide a comprehensive summary covering:
            1. Purchase price, payment terms, and financing arrangements
            2. Product or asset specifications and quality standards
            3. Delivery terms, shipping responsibilities, and timelines
            4. Inspection rights and acceptance procedures
            5. Title transfer and risk of loss provisions
            6. Warranty terms, guarantees, and return/refund policies
            7. Breach remedies and dispute resolution mechanisms
            8. Overall risk assessment for buyer and seller
            """,
            ContractType.PARTNERSHIP: """
            Analyze this partnership agreement and provide a comprehensive summary covering:
            1. Partnership structure, legal entity type, and business purpose
            2. Partner roles, responsibilities, and management authority
            3. Capital contributions, profit/loss distribution, and financial obligations
            4. Decision-making processes, voting rights, and governance structure
            5. Partner compensation, draws, and withdrawal procedures
            6. Partnership dissolution, exit strategies, and asset distribution
            7. Non-compete, confidentiality, and post-partnership restrictions
            8. Overall assessment of partner rights, obligations, and risks
            """,
            ContractType.LICENSE: """
            Analyze this license agreement and provide a comprehensive summary covering:
            1. Licensed intellectual property, technology, or rights granted
            2. Territory, field of use, and exclusivity provisions
            3. Royalty structure, fees, and payment obligations
            4. Term duration, renewal options, and termination triggers
            5. Usage restrictions, compliance requirements, and performance standards
            6. Licensor support, updates, and maintenance obligations
            7. Infringement handling, enforcement rights, and legal protections
            8. Overall assessment of licensor vs licensee rights and restrictions
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
        ClauseType.ASSIGNMENT_RIGHTS,
        ClauseType.AMENDMENT_PROCEDURES,
        ClauseType.NOTICES,
        ClauseType.ENTIRE_AGREEMENT,
        ClauseType.SEVERABILITY,
        ClauseType.GENERAL
    ]
    
    # Contract-specific clauses
    contract_specific = {
        ContractType.EMPLOYMENT: [
            ClauseType.COMPENSATION, ClauseType.TERMINATION, ClauseType.NON_COMPETE,
            ClauseType.BENEFITS, ClauseType.WORKING_CONDITIONS, ClauseType.PROBATION,
            ClauseType.SEVERANCE, ClauseType.OVERTIME_PAY, ClauseType.VACATION_POLICY,
            ClauseType.STOCK_OPTIONS, ClauseType.BACKGROUND_CHECK
        ],
        ContractType.NDA: [
            ClauseType.DISCLOSURE_OBLIGATIONS, ClauseType.RETURN_OF_INFORMATION,
            ClauseType.DEFINITION_OF_CONFIDENTIAL, ClauseType.EXCEPTIONS_TO_CONFIDENTIALITY,
            ClauseType.DURATION_OF_OBLIGATIONS
        ],
        ContractType.SERVICE_AGREEMENT: [
            ClauseType.SCOPE_OF_WORK, ClauseType.DELIVERABLES, 
            ClauseType.PAYMENT_TERMS, ClauseType.SERVICE_LEVEL,
            ClauseType.WARRANTIES, ClauseType.SERVICE_CREDITS,
            ClauseType.DATA_PROTECTION, ClauseType.THIRD_PARTY_SERVICES,
            ClauseType.CHANGE_MANAGEMENT, ClauseType.TERMINATION
        ],
        ContractType.CONSULTING: [
            ClauseType.SCOPE_OF_WORK, ClauseType.DELIVERABLES, 
            ClauseType.PAYMENT_TERMS, ClauseType.SERVICE_LEVEL,
            ClauseType.WARRANTIES, ClauseType.TERMINATION
        ],
        ContractType.CONTRACTOR: [
            ClauseType.SCOPE_OF_WORK, ClauseType.DELIVERABLES, 
            ClauseType.PAYMENT_TERMS, ClauseType.TERMINATION,
            ClauseType.WARRANTIES
        ],
        ContractType.LEASE: [
            ClauseType.RENT, ClauseType.SECURITY_DEPOSIT, 
            ClauseType.MAINTENANCE, ClauseType.USE_RESTRICTIONS,
            ClauseType.UTILITIES, ClauseType.PARKING, ClauseType.PET_POLICY,
            ClauseType.SUBLETTING, ClauseType.EARLY_TERMINATION,
            ClauseType.RENEWAL_OPTIONS, ClauseType.PROPERTY_INSPECTION
        ],
        ContractType.PURCHASE: [
            ClauseType.PAYMENT_TERMS, ClauseType.DELIVERY_TERMS,
            ClauseType.INSPECTION_RIGHTS, ClauseType.TITLE_TRANSFER,
            ClauseType.RISK_OF_LOSS, ClauseType.RETURNS_REFUNDS,
            ClauseType.WARRANTIES, ClauseType.TERMINATION
        ],
        ContractType.PARTNERSHIP: [
            ClauseType.PAYMENT_TERMS, ClauseType.TERMINATION,
            ClauseType.SCOPE_OF_WORK, ClauseType.LIABILITY,
            ClauseType.DISPUTE_RESOLUTION, ClauseType.ASSIGNMENT_RIGHTS
        ],
        ContractType.LICENSE: [
            ClauseType.USE_RESTRICTIONS, ClauseType.PAYMENT_TERMS,
            ClauseType.TERMINATION, ClauseType.WARRANTIES,
            ClauseType.DURATION_OF_OBLIGATIONS, ClauseType.ASSIGNMENT_RIGHTS
        ]
    }
    
    specific_clauses = contract_specific.get(contract_type, [])
    return specific_clauses + universal_clauses
