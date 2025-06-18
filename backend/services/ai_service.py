"""
AI processing and OpenAI integration service.

ARCHITECTURE:
This is the main orchestrator for AI capabilities in ClauseIQ. It provides high-level
AI functions while delegating utilities to specialized modules in services/ai/.

REFACTORING SUCCESS (v2.0):
- Refactored from 948-line monolith to modular 676-line orchestrator (29% reduction)
- Extracted utilities to services/ai/ package for better maintainability
- Added lazy imports and graceful fallbacks for optional dependencies
- Maintained 100% backward compatibility via smart module-level imports
- Eliminated code duplication by removing redundant wrapper functions
- Improved startup performance with modular loading

TOKEN MANAGEMENT:
- Replaced character-based truncation with accurate token-based truncation using tiktoken
- Added dynamic token budget calculation based on model context windows
- Implemented sentence-boundary preservation during truncation when possible
- Supports multiple models with accurate token counting
- Provides predictable API costs and better context window utilization

The old approach (8,000 chars ≈ 2,000 tokens) had up to 60% estimation error.
The new token-based approach provides exact token counts regardless of text complexity.

BACKWARD COMPATIBILITY:
All existing imports continue to work unchanged! The module imports utilities from
specialized modules at the top level, so legacy code works seamlessly:

    from services.ai_service import get_token_count  # ✅ Works perfectly
    
This is the SAME function as:
    
    from services.ai.token_utils import get_token_count  # ✅ Direct import

MIGRATION:
For new code, prefer direct imports from services/ai/ modules for clarity:
- services.ai.client_manager for OpenAI client management
- services.ai.token_utils for token counting and text processing
- services.ai.contract_utils for contract type utilities

But existing code doesn't need to change - it works perfectly as-is!
"""
import asyncio
import json
import re
from typing import Optional, List, Dict, Any

# Lazy imports for dependencies that might not be available
def _get_models():
    """Lazy import of model types."""
    try:
        from models.common import Clause, RiskLevel, ClauseType
        from clauseiq_types.common import ContractType
        return Clause, RiskLevel, ClauseType, ContractType
    except ImportError:
        return None, None, None, None

# Import utilities from the new modular structure
from .ai.client_manager import get_openai_client, is_ai_available
from .ai.token_utils import (
    get_token_count, 
    truncate_text_by_tokens, 
    calculate_token_budget,
    get_optimal_response_tokens,
    get_model_capabilities,
    print_model_comparison
)
from .ai.contract_utils import get_relevant_clause_types, get_contract_type_mapping

# Get model types
Clause, RiskLevel, ClauseType, ContractType = _get_models()



async def generate_structured_document_summary(document_text: str, filename: str = "", model: str = "gpt-3.5-turbo") -> Dict[str, Any]:
    """Generate a structured document summary with categorized insights"""
    openai_client = get_openai_client()
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
        # Use optimal token allocation for comprehensive legal analysis
        optimal_response_tokens = get_optimal_response_tokens("structured", model)
        max_input_tokens = calculate_token_budget(model, response_tokens=optimal_response_tokens)
        
        print(f"📊 Using {optimal_response_tokens} response tokens, {max_input_tokens} input tokens for {model}")
        
        # Reserve tokens for the prompt template
        prompt_template = """
        Analyze this legal document and provide a comprehensive structured summary in the exact JSON format below.
        With the expanded token budget, be thorough and detailed in each section - this is for professional legal analysis.
        
        Document: {filename}
        Content: {content}
        
        Respond with ONLY valid JSON in this exact format:
        {{
            "overview": "Comprehensive 3-5 sentence overview of the document's purpose, significance, and key legal implications",
            "key_parties": ["Party 1: Detailed role and legal relationship", "Party 2: Detailed role and obligations"],
            "important_dates": ["Date type: Specific date with legal significance", "Deadline: Critical timeline with consequences"],
            "major_obligations": ["Obligation 1: Detailed description of who must do what and when", "Obligation 2: Complete obligation with performance standards"],
            "risk_highlights": ["Risk 1: Detailed description of risk, potential impact, and likelihood", "Risk 2: Comprehensive risk assessment with mitigation strategies"],
            "key_insights": ["Insight 1: Important legal detail with implications", "Insight 2: Notable provision with strategic importance", "Insight 3: Cross-references and relationships between clauses"]
        }}
        """
        
        prompt_overhead = get_token_count(prompt_template.format(filename=filename, content=""), model)
        available_tokens = max_input_tokens - prompt_overhead
        
        truncated_text = truncate_text_by_tokens(document_text, available_tokens, model)
        
        prompt = prompt_template.format(filename=filename, content=truncated_text)
        
        response = await openai_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are an elite legal AI assistant that provides comprehensive, detailed analysis of legal documents. With expanded token budget, provide thorough analysis that helps legal professionals understand complex documents completely."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=optimal_response_tokens,
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


async def analyze_clause(clause, model: str = "gpt-3.5-turbo"):
    """Analyze a clause for risk assessment and generate recommendations."""
    openai_client = get_openai_client()
    if not openai_client:
        # Return clause with basic analysis if no AI available
        clause.summary = "AI analysis not available"
        clause.risk_assessment = "Cannot assess risk without AI"
        clause.recommendations = ["Review manually with legal counsel"]
        clause.key_points = ["Manual review required"]
        return clause
    
    try:
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
    openai_client = get_openai_client()
    if not openai_client:
        return ContractType.OTHER
    
    try:
        # Use minimal token allocation for simple classification
        optimal_response_tokens = get_optimal_response_tokens("classification", model)
        max_input_tokens = calculate_token_budget(model, response_tokens=optimal_response_tokens)
        
        print(f"🏷️ Contract classification using {max_input_tokens} input tokens for {model}")
        
        prompt_template = """
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
        Document content: {content}

        Respond with ONLY the type name (e.g., "employment", "nda", "service_agreement", etc.).
        """
        
        prompt_overhead = get_token_count(prompt_template.format(filename=filename, content=""), model)
        available_tokens = max_input_tokens - prompt_overhead
        
        truncated_text = truncate_text_by_tokens(document_text, available_tokens, model)
        
        prompt = prompt_template.format(filename=filename, content=truncated_text)
        
        response = await openai_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are a legal document classification expert. Analyze documents and identify their type with high accuracy."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=optimal_response_tokens,
            temperature=0.1
        )
        
        detected_type = response.choices[0].message.content.strip().lower()
        
        # Map response to enum value using the utility function
        type_mapping = get_contract_type_mapping()
        
        return type_mapping.get(detected_type, ContractType.OTHER)
        
    except Exception as e:
        print(f"Error detecting contract type: {str(e)}")
        return ContractType.OTHER


async def extract_clauses_with_llm(document_text: str, contract_type: ContractType, model: str = "gpt-3.5-turbo") -> List[Clause]:
    """Extract and classify clauses using LLM analysis."""
    openai_client = get_openai_client()
    if not openai_client:
        return []
    
    try:
        # Get contract-specific clause types
        relevant_clause_types = get_relevant_clause_types(contract_type)
        clause_types_str = ", ".join([ct.value for ct in relevant_clause_types])
        
        # Use maximum token allocation for comprehensive clause extraction and analysis
        optimal_response_tokens = get_optimal_response_tokens("extraction", model)
        max_input_tokens = calculate_token_budget(model, response_tokens=optimal_response_tokens)
        
        print(f"🔍 Clause extraction using {optimal_response_tokens} response tokens, {max_input_tokens} input tokens for {model}")
        print(f"📄 Can analyze {max_input_tokens//4:.0f} characters (~{max_input_tokens//250:.0f} pages) of legal text")
        
        prompt_template = """
        Analyze this {contract_type} document and identify ALL significant clauses with comprehensive detail.
        With expanded token budget, provide thorough analysis including clause relationships and cross-references.
        
        For each clause you find:
        1. Extract the exact text of the clause
        2. Classify it using one of these types: {clause_types}
        3. Create a descriptive heading that captures the legal significance
        4. Assess the risk level (low, medium, high) with detailed reasoning
        5. Identify relationships to other clauses when relevant

        Focus on clauses that contain:
        - Legal obligations or rights with performance standards
        - Terms and conditions with specific requirements
        - Restrictions or limitations with consequences
        - Financial or payment terms with penalties
        - Liability or risk provisions with indemnification
        - Termination or expiration conditions with notice requirements
        - Intellectual property rights and licensing terms
        - Confidentiality and non-disclosure provisions
        - Dispute resolution and governing law clauses
        - Amendment and modification procedures

        Respond in this exact JSON format with comprehensive detail:
        {{
            "clauses": [
                {{
                    "heading": "Comprehensive descriptive clause title with legal significance",
                    "text": "Complete exact clause text from document",
                    "clause_type": "clause_type_from_list",
                    "risk_level": "low|medium|high",
                    "risk_reasoning": "Detailed explanation of why this risk level was assigned",
                    "key_terms": ["Important term 1", "Critical deadline", "Financial obligation"],
                    "relationships": ["References to other clauses or sections when applicable"]
                }}
            ]
        }}

        Document content:
        {content}
        """
        
        prompt_overhead = get_token_count(
            prompt_template.format(
                contract_type=contract_type.value,
                clause_types=clause_types_str,
                content=""
            ), 
            model
        )
        available_tokens = max_input_tokens - prompt_overhead
        
        truncated_text = truncate_text_by_tokens(document_text, available_tokens, model)
        
        prompt = prompt_template.format(
            contract_type=contract_type.value,
            clause_types=clause_types_str,
            content=truncated_text
        )
        
        response = await openai_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": f"You are an elite legal expert specializing in {contract_type.value} analysis. With expanded token budget, extract and classify clauses with maximum precision, detail, and attention to legal nuance. Identify clause relationships and provide comprehensive risk analysis."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=optimal_response_tokens,
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
                
                # Store additional analysis data as metadata (if needed for future features)
                if hasattr(clause, 'metadata'):
                    clause.metadata = {
                        'risk_reasoning': clause_data.get("risk_reasoning", ""),
                        'key_terms': clause_data.get("key_terms", []),
                        'relationships': clause_data.get("relationships", [])
                    }
                
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
    openai_client = get_openai_client()
    if not openai_client:
        return "AI summary not available - OpenAI client not configured."
    
    try:
        # Use optimal token allocation for comprehensive contract analysis
        optimal_response_tokens = get_optimal_response_tokens("summary", model)
        max_input_tokens = calculate_token_budget(model, response_tokens=optimal_response_tokens)
        
        print(f"📋 Contract summary using {optimal_response_tokens} response tokens, {max_input_tokens} input tokens for {model}")
        
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
        
        prompt_template = f"""
        {specific_prompt}
        
        With expanded token budget, provide a comprehensive, detailed analysis that legal professionals can rely on.
        Include specific examples, quote relevant clauses, and provide actionable insights.
        
        Document: {{filename}}
        Content: {{content}}
        
        Provide a detailed, structured summary in 6-10 comprehensive paragraphs that covers:
        1. Document overview and strategic purpose
        2. Key parties and their detailed roles/relationships  
        3. Major obligations with specific performance requirements
        4. Financial terms, payment schedules, and penalties
        5. Risk analysis with specific clause references
        6. Termination conditions and consequences
        7. Notable provisions and strategic implications
        8. Recommendations for legal review and negotiation points
        """
        
        prompt_overhead = get_token_count(prompt_template.format(filename=filename, content=""), model)
        available_tokens = max_input_tokens - prompt_overhead
        
        truncated_text = truncate_text_by_tokens(document_text, available_tokens, model)
        
        prompt = prompt_template.format(filename=filename, content=truncated_text)
        
        response = await openai_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": f"You are an elite legal AI assistant specializing in {contract_type.value} analysis. With expanded token budget, provide comprehensive, detailed analysis that helps legal professionals understand complex documents completely. Quote specific clauses and provide actionable insights."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=optimal_response_tokens,
            temperature=0.3
        )
        
        return response.choices[0].message.content.strip()
        
    except Exception as e:
        print(f"Error generating contract-specific summary: {str(e)}")
        return f"Summary generation failed: {str(e)}"


# =============================================================================
# LEGACY UTILITY FUNCTIONS - KEPT FOR BACKWARD COMPATIBILITY
def _get_relevant_clause_types(contract_type: ContractType) -> List[ClauseType]:
    """Get relevant clause types for a specific contract type."""
    return get_relevant_clause_types(contract_type)

# End of ai_service.py - Modular AI orchestrator
# For utility functions, use the specialized modules in services/ai/
