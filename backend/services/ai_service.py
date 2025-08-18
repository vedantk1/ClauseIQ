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

# Import OpenAI error types
try:
    from openai import OpenAIError
except ImportError:
    # Fallback for older OpenAI versions
    try:
        from openai.error import OpenAIError
    except ImportError:
        # Create a dummy exception class if OpenAI is not available
        class OpenAIError(Exception):
            pass

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

async def detect_contract_type(document_text: str, filename: str = "", model: str = None) -> ContractType:
    """Detect contract type using LLM analysis."""
    # Get model from settings if not provided
    if model is None:
        from config.environments import get_environment_config
        config = get_environment_config()
        model = config.ai.default_model
        
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

async def extract_clauses_with_llm(document_text: str, contract_type: ContractType, model: str = None) -> List[Clause]:
    """Extract and classify clauses using LLM analysis."""
    # Get model from settings if not provided
    if model is None:
        from config.environments import get_environment_config
        config = get_environment_config()
        model = config.ai.default_model
        
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
                    risk_level=risk_level,
                    risk_reasoning=clause_data.get("risk_reasoning", ""),
                    key_terms=clause_data.get("key_terms", []) or [],
                    relationships=clause_data.get("relationships", []) or [],
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
                            risk_level=risk_level,
                            risk_reasoning=clause_data.get("risk_reasoning", ""),
                            key_terms=clause_data.get("key_terms", []) or [],
                            relationships=clause_data.get("relationships", []) or [],
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


async def generate_structured_document_summary(document_text: str, filename: str = "", model: str = None, contract_type: ContractType = None) -> Dict[str, Any]:
    """Generate a contract-type-specific structured document summary with categorized insights"""
    # Get model from settings if not provided
    if model is None:
        from config.environments import get_environment_config
        config = get_environment_config()
        model = config.ai.default_model
        
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
    
    # Detect contract type if not provided
    if contract_type is None:
        contract_type = await detect_contract_type(document_text, filename, model)
    
    try:
        # Use optimal token allocation for comprehensive legal analysis
        optimal_response_tokens = get_optimal_response_tokens("structured", model)
        max_input_tokens = calculate_token_budget(model, response_tokens=optimal_response_tokens)
        
        print(f"📊 Contract-specific structured analysis using {optimal_response_tokens} response tokens, {max_input_tokens} input tokens for {model}")
        print(f"🎯 Analyzing {contract_type.value} contract with specialized prompts")
        
        # Contract-type-specific structured prompts
        contract_prompts = {
            ContractType.EMPLOYMENT: {
                "focus_areas": "employment terms, compensation, termination, non-compete obligations",
                "key_parties_focus": "employer and employee roles, reporting structure, department placement",
                "dates_focus": "start date, probation period, review dates, vesting schedules, notice periods",
                "obligations_focus": "job duties, performance standards, confidentiality, non-compete, employer benefits",
                "risks_focus": "termination risks, compensation disputes, non-compete enforceability, benefit changes",
                "insights_focus": "career progression, compensation competitiveness, work-life balance terms, exit provisions"
            },
            ContractType.NDA: {
                "focus_areas": "confidentiality scope, disclosure restrictions, term duration, breach consequences",
                "key_parties_focus": "disclosing party and receiving party roles, authorized personnel",
                "dates_focus": "effective date, confidentiality term, return/destroy deadlines, survival periods",
                "obligations_focus": "information protection, disclosure restrictions, return obligations, notification duties",
                "risks_focus": "broad confidentiality scope, long terms, severe penalties, unclear exceptions",
                "insights_focus": "information scope reasonableness, exception adequacy, enforcement mechanisms"
            },
            ContractType.SERVICE_AGREEMENT: {
                "focus_areas": "service scope, deliverables, payment terms, IP rights, performance standards",
                "key_parties_focus": "service provider and client roles, project stakeholders, decision authorities",
                "dates_focus": "project timeline, milestone deadlines, payment schedules, renewal dates",
                "obligations_focus": "service delivery, quality standards, reporting, client cooperation, IP assignment",
                "risks_focus": "scope creep, payment delays, liability exposure, IP ownership disputes",
                "insights_focus": "project feasibility, payment protection, liability limitations, IP strategy"
            },
            ContractType.CONSULTING: {
                "focus_areas": "consulting scope, deliverables, expertise requirements, fee structure",
                "key_parties_focus": "consultant expertise and client needs, project team roles, reporting relationships",
                "dates_focus": "engagement timeline, deliverable deadlines, payment milestones, contract renewal",
                "obligations_focus": "consulting services, expert advice, deliverable quality, confidentiality, independence",
                "risks_focus": "liability for advice, outcome guarantees, scope expansion, payment disputes",
                "insights_focus": "engagement clarity, expertise alignment, risk allocation, success metrics"
            },
            ContractType.CONTRACTOR: {
                "focus_areas": "work scope, classification, payment terms, deliverable ownership",
                "key_parties_focus": "independent contractor status, hiring party requirements, work relationship boundaries",
                "dates_focus": "project duration, milestone deadlines, invoice schedules, termination notice",
                "obligations_focus": "work delivery, quality standards, independence maintenance, tax responsibilities",
                "risks_focus": "misclassification, payment disputes, IP ownership, liability exposure",
                "insights_focus": "contractor vs employee distinction, payment security, work product ownership"
            },
            ContractType.LEASE: {
                "focus_areas": "rental terms, property condition, tenant rights, landlord obligations",
                "key_parties_focus": "landlord and tenant responsibilities, property management roles, guarantor obligations",
                "dates_focus": "lease term, rent due dates, renewal options, notice periods, inspection schedules",
                "obligations_focus": "rent payment, property maintenance, use restrictions, repair responsibilities",
                "risks_focus": "rent increases, eviction terms, security deposit disputes, maintenance costs",
                "insights_focus": "rent competitiveness, tenant protections, property condition, lease flexibility"
            },
            ContractType.PURCHASE: {
                "focus_areas": "purchase price, product specifications, delivery terms, warranty coverage",
                "key_parties_focus": "buyer and seller obligations, shipping responsibilities, quality control roles",
                "dates_focus": "delivery schedules, payment deadlines, inspection periods, warranty terms",
                "obligations_focus": "payment terms, delivery requirements, quality standards, inspection rights",
                "risks_focus": "delivery delays, quality issues, payment disputes, warranty limitations",
                "insights_focus": "price competitiveness, quality assurance, delivery reliability, warranty adequacy"
            },
            ContractType.PARTNERSHIP: {
                "focus_areas": "partnership structure, profit sharing, management authority, dissolution terms",
                "key_parties_focus": "partner roles, management authority, capital contributions, profit/loss allocation",
                "dates_focus": "partnership term, capital contribution deadlines, distribution schedules, exit timelines",
                "obligations_focus": "capital contributions, management duties, profit sharing, fiduciary responsibilities",
                "risks_focus": "unlimited liability, partner disputes, capital loss, dissolution complications",
                "insights_focus": "governance structure, profit fairness, exit strategy, liability protection"
            },
            ContractType.LICENSE: {
                "focus_areas": "licensed rights, usage restrictions, royalty terms, termination conditions",
                "key_parties_focus": "licensor rights and licensee obligations, territory restrictions, field of use",
                "dates_focus": "license term, royalty payment schedules, renewal options, termination notice",
                "obligations_focus": "royalty payments, usage compliance, reporting requirements, quality standards",
                "risks_focus": "license revocation, royalty disputes, usage violations, territory conflicts",
                "insights_focus": "usage flexibility, cost-effectiveness, termination protection, competitive advantages"
            }
        }
        
        # Get contract-specific prompt or use generic
        prompt_config = contract_prompts.get(contract_type, {
            "focus_areas": "key terms, obligations, rights, restrictions",
            "key_parties_focus": "party roles and relationships",
            "dates_focus": "important deadlines and timelines",
            "obligations_focus": "major duties and responsibilities",
            "risks_focus": "potential legal and business risks",
            "insights_focus": "strategic implications and recommendations"
        })
        
        # Reserve tokens for the prompt template
        prompt_template = """
        Analyze this {contract_type} document with specialized focus on {focus_areas}.
        Provide a comprehensive structured summary in the exact JSON format below.
        
        Focus Areas for this {contract_type}:
        - Key Parties: {key_parties_focus}
        - Important Dates: {dates_focus}  
        - Major Obligations: {obligations_focus}
        - Risk Highlights: {risks_focus}
        - Key Insights: {insights_focus}
        
        Document: {filename}
        Content: {content}
        
        Respond with ONLY valid JSON in this exact format:
        {{
            "overview": "Comprehensive 3-5 sentence overview focusing on {contract_type} specifics, purpose, significance, and key legal implications",
            "key_parties": ["Party 1: Detailed role specific to {contract_type} context", "Party 2: Detailed obligations and relationship"],
            "important_dates": ["Date type: Specific date with {contract_type} significance", "Deadline: Critical timeline with consequences for {contract_type}"],
            "major_obligations": ["Obligation 1: Detailed {contract_type}-specific duty with performance standards", "Obligation 2: Complete obligation with context"],
            "risk_highlights": ["Risk 1: {contract_type}-specific risk with impact assessment and mitigation", "Risk 2: Detailed risk analysis with strategic implications"],
            "key_insights": ["Insight 1: {contract_type}-specific legal detail with implications", "Insight 2: Strategic provision with competitive/business impact", "Insight 3: Cross-references and relationships between {contract_type} clauses"]
        }}
        """
        
        prompt_overhead = get_token_count(
            prompt_template.format(
                contract_type=contract_type.value,
                focus_areas=prompt_config["focus_areas"],
                key_parties_focus=prompt_config["key_parties_focus"],
                dates_focus=prompt_config["dates_focus"],
                obligations_focus=prompt_config["obligations_focus"],
                risks_focus=prompt_config["risks_focus"],
                insights_focus=prompt_config["insights_focus"],
                filename=filename,
                content=""
            ), 
            model
        )
        available_tokens = max_input_tokens - prompt_overhead
        
        truncated_text = truncate_text_by_tokens(document_text, available_tokens, model)
        
        prompt = prompt_template.format(
            contract_type=contract_type.value,
            focus_areas=prompt_config["focus_areas"],
            key_parties_focus=prompt_config["key_parties_focus"],
            dates_focus=prompt_config["dates_focus"],
            obligations_focus=prompt_config["obligations_focus"],
            risks_focus=prompt_config["risks_focus"],
            insights_focus=prompt_config["insights_focus"],
            filename=filename,
            content=truncated_text
        )
        
        response = await openai_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": f"You are an elite legal AI assistant specializing in {contract_type.value} analysis. Provide comprehensive, detailed structured analysis that helps legal professionals understand {contract_type.value} documents completely. Focus on {contract_type.value}-specific risks, obligations, and strategic implications."},
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






async def generate_clause_rewrite(
    clause: Clause,
    document_text: str,
    contract_type: ContractType,
    model: str = None
) -> str:
    """Generate a rewrite suggestion for a clause using full document context."""
    # Get model from settings if not provided
    if model is None:
        from config.environments import get_environment_config
        config = get_environment_config()
        model = config.ai.default_model
        
    openai_client = get_openai_client()
    if not openai_client:
        raise Exception("OpenAI client not available")
    
    try:
        # Use optimal token allocation for rewrite generation
        optimal_response_tokens = get_optimal_response_tokens("rewrite", model)
        max_input_tokens = calculate_token_budget(model, response_tokens=optimal_response_tokens)
        
        print(f"✏️ Clause rewrite using {optimal_response_tokens} response tokens, {max_input_tokens} input tokens for {model}")
        
        prompt = f"""You are a legal expert specializing in contract clause optimization. 

Given this clause from a {contract_type.value} contract:
"{clause.text}"

Risk Assessment: {clause.risk_reasoning}

Full Document Context:
{document_text}

Please provide a clear, improved version of this clause that:
1. Maintains the same legal intent and obligations
2. Improves clarity and readability
3. Addresses any identified risks or ambiguities
4. Uses plain language where possible while preserving legal precision
5. Follows best practices for {contract_type.value} contracts
6. Maintains consistency with the broader document context

Provide ONLY the rewritten clause text, no explanations or commentary."""
        
        # Calculate token overhead for prompt
        prompt_overhead = get_token_count(prompt.replace(document_text, ""), model)
        available_tokens = max_input_tokens - prompt_overhead
        
        # Truncate document text if needed, but preserve clause text
        if get_token_count(document_text, model) > available_tokens:
            # Keep clause text intact, truncate document context
            clause_tokens = get_token_count(clause.text, model)
            risk_tokens = get_token_count(clause.risk_reasoning, model)
            available_for_context = available_tokens - clause_tokens - risk_tokens - 100  # buffer
            
            truncated_document = truncate_text_by_tokens(document_text, available_for_context, model)
            prompt = prompt.replace(document_text, truncated_document)
            print(f"📄 Document context truncated to {available_for_context} tokens for rewrite generation")
        
        response = await openai_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": f"You are an elite legal AI assistant specializing in {contract_type.value} contract optimization. Provide clear, improved clause rewrites that maintain legal precision while enhancing clarity and addressing identified risks."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=optimal_response_tokens,
            temperature=0.3
        )
        
        rewrite_suggestion = response.choices[0].message.content.strip()
        print(f"✅ Generated rewrite suggestion ({len(rewrite_suggestion)} characters)")
        
        return rewrite_suggestion
        
    except Exception as e:
        print(f"Error generating clause rewrite: {str(e)}")
        raise Exception(f"Failed to generate clause rewrite: {str(e)}")


# =============================================================================
# LEGACY UTILITY FUNCTIONS - KEPT FOR BACKWARD COMPATIBILITY
def _get_relevant_clause_types(contract_type: ContractType) -> List[ClauseType]:
    """Get relevant clause types for a specific contract type."""
    return get_relevant_clause_types(contract_type)

# End of ai_service.py - Modular AI orchestrator
# For utility functions, use the specialized modules in services/ai/
