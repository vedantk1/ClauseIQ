"""
AI Highlight Analysis Service

Provides AI-powered analysis and enhancement for PDF highlights in ClauseIQ.
This service integrates with the existing AI infrastructure to provide:
- Intelligent highlight analysis and insights
- AI-generated rewrites and summaries
- Context-aware recommendations
"""
import asyncio
import json
import logging
from typing import Optional, Dict, Any, List
from dataclasses import dataclass

# Import existing AI infrastructure
from services.ai_service import _get_models
from ai_models.models import AIModelConfig, DEFAULT_MODEL

# Import utilities (using backward-compatible imports)
try:
    # Import AI utilities with fallback for graceful degradation
    from services.ai.client_manager import get_openai_client
    from services.ai.token_utils import get_token_count, truncate_text_to_tokens
except ImportError:
    # Fallback for development environment
    def get_openai_client():
        """Fallback for missing AI client."""
        raise ImportError("AI client not available")
    
    def get_token_count(text: str, model: str = DEFAULT_MODEL) -> int:
        """Fallback token count estimation."""
        return len(text) // 4  # Rough estimation
    
    def truncate_text_to_tokens(text: str, max_tokens: int, model: str = DEFAULT_MODEL) -> str:
        """Fallback truncation."""
        return text[:max_tokens * 4]

logger = logging.getLogger(__name__)


@dataclass
class HighlightAnalysis:
    """Result of AI analysis on a highlight."""
    summary: str
    key_insights: List[str]
    risk_level: str  # "low", "medium", "high"
    legal_significance: str
    recommended_action: str


@dataclass
class HighlightRewrite:
    """Result of AI rewrite operation."""
    original_text: str
    rewritten_text: str
    improvement_summary: str
    clarity_score: int  # 1-10


class AIHighlightService:
    """Service for AI-powered highlight analysis and enhancement."""
    
    def __init__(self, model: str = None):
        """Initialize the service with specified AI model."""
        self.model = model or DEFAULT_MODEL
        logger.info(f"Initialized AI Highlight Service with model: {self.model}")
    
    async def analyze_highlight(
        self, 
        highlight_content: str, 
        highlight_comment: str = "", 
        document_context: str = "",
        contract_type: str = "general"
    ) -> HighlightAnalysis:
        """
        Analyze a highlight and provide AI-powered insights.
        
        Args:
            highlight_content: The highlighted text from the PDF
            highlight_comment: User's comment on the highlight
            document_context: Surrounding text for context
            contract_type: Type of contract for specialized analysis
            
        Returns:
            HighlightAnalysis with AI insights
        """
        try:
            client = get_openai_client()
            
            # Build analysis prompt
            prompt = self._build_analysis_prompt(
                highlight_content, 
                highlight_comment, 
                document_context, 
                contract_type
            )
            
            # Ensure prompt fits within token limits
            max_prompt_tokens = 3000  # Leave room for response
            prompt = truncate_text_to_tokens(prompt, max_prompt_tokens, self.model)
            
            logger.info(f"Analyzing highlight with {get_token_count(prompt, self.model)} tokens")
            
            response = await client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a legal AI assistant specialized in contract analysis. "
                            "Analyze highlighted text and provide structured insights. "
                            "Focus on legal significance, risks, and actionable recommendations."
                        )
                    },
                    {
                        "role": "user", 
                        "content": prompt
                    }
                ],
                max_tokens=1500,
                temperature=0.3  # Lower temperature for more consistent analysis
            )
            
            result = response.choices[0].message.content
            
            # Parse structured response
            analysis = self._parse_analysis_response(result)
            
            logger.info(f"Successfully analyzed highlight: {analysis.risk_level} risk")
            return analysis
            
        except Exception as e:
            logger.error(f"Error analyzing highlight: {e}")
            # Return fallback analysis
            return HighlightAnalysis(
                summary="Analysis temporarily unavailable",
                key_insights=["AI analysis service is currently unavailable"],
                risk_level="unknown",
                legal_significance="Unable to determine",
                recommended_action="Review manually with legal counsel"
            )
    
    async def generate_ai_rewrite(
        self, 
        highlight_content: str, 
        rewrite_goal: str = "clarity",
        target_audience: str = "legal professionals"
    ) -> HighlightRewrite:
        """
        Generate an AI-powered rewrite of highlighted text.
        
        Args:
            highlight_content: The text to rewrite
            rewrite_goal: "clarity", "simplicity", "legal_precision", "plain_english"
            target_audience: Target audience for the rewrite
            
        Returns:
            HighlightRewrite with improved text
        """
        try:
            client = get_openai_client()
            
            prompt = self._build_rewrite_prompt(highlight_content, rewrite_goal, target_audience)
            
            # Ensure prompt fits within token limits
            max_prompt_tokens = 2500  # Leave room for response
            prompt = truncate_text_to_tokens(prompt, max_prompt_tokens, self.model)
            
            logger.info(f"Generating rewrite with {get_token_count(prompt, self.model)} tokens")
            
            response = await client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are an expert legal writer. Rewrite text to improve clarity, "
                            "accuracy, and readability while preserving legal meaning. "
                            "Provide structured output with the rewrite and explanation."
                        )
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                max_tokens=1000,
                temperature=0.4  # Slightly higher for creative rewriting
            )
            
            result = response.choices[0].message.content
            
            # Parse rewrite response
            rewrite = self._parse_rewrite_response(result, highlight_content)
            
            logger.info(f"Successfully generated rewrite with clarity score: {rewrite.clarity_score}")
            return rewrite
            
        except Exception as e:
            logger.error(f"Error generating rewrite: {e}")
            # Return fallback rewrite
            return HighlightRewrite(
                original_text=highlight_content,
                rewritten_text=highlight_content,
                improvement_summary="AI rewrite service is currently unavailable",
                clarity_score=5
            )
    
    def _build_analysis_prompt(
        self, 
        content: str, 
        comment: str, 
        context: str, 
        contract_type: str
    ) -> str:
        """Build prompt for highlight analysis."""
        return f"""
Analyze this highlighted text from a {contract_type} contract:

HIGHLIGHTED TEXT:
{content}

USER COMMENT: 
{comment or "No comment provided"}

DOCUMENT CONTEXT:
{context or "No additional context"}

Please provide a structured analysis in JSON format:
{{
    "summary": "Brief summary of the highlighted text",
    "key_insights": ["insight 1", "insight 2", "insight 3"],
    "risk_level": "low|medium|high",
    "legal_significance": "Explanation of legal importance",
    "recommended_action": "Specific actionable recommendation"
}}

Focus on practical legal insights, potential risks, and actionable recommendations.
"""
    
    def _build_rewrite_prompt(
        self, 
        content: str, 
        goal: str, 
        audience: str
    ) -> str:
        """Build prompt for text rewriting."""
        return f"""
Rewrite the following text to improve {goal} for {audience}:

ORIGINAL TEXT:
{content}

REWRITE GOALS:
- Optimize for: {goal}
- Target audience: {audience}
- Preserve legal meaning and accuracy
- Improve readability and understanding

Please provide a structured response in JSON format:
{{
    "rewritten_text": "The improved version of the text",
    "improvement_summary": "Explanation of what was improved",
    "clarity_score": 8
}}

The clarity_score should be 1-10 based on how much clearer the rewrite is compared to the original.
"""
    
    def _parse_analysis_response(self, response: str) -> HighlightAnalysis:
        """Parse AI analysis response into structured data."""
        try:
            # Try to extract JSON from response
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                return HighlightAnalysis(
                    summary=data.get("summary", "No summary provided"),
                    key_insights=data.get("key_insights", []),
                    risk_level=data.get("risk_level", "unknown"),
                    legal_significance=data.get("legal_significance", "Unknown"),
                    recommended_action=data.get("recommended_action", "Review manually")
                )
        except (json.JSONDecodeError, KeyError) as e:
            logger.warning(f"Failed to parse analysis JSON: {e}")
        
        # Fallback to text-based parsing
        return HighlightAnalysis(
            summary=response[:200] + "..." if len(response) > 200 else response,
            key_insights=["Analysis completed"],
            risk_level="medium",
            legal_significance="Requires review",
            recommended_action="Review the AI analysis above"
        )
    
    def _parse_rewrite_response(self, response: str, original: str) -> HighlightRewrite:
        """Parse AI rewrite response into structured data."""
        try:
            # Try to extract JSON from response
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                return HighlightRewrite(
                    original_text=original,
                    rewritten_text=data.get("rewritten_text", original),
                    improvement_summary=data.get("improvement_summary", "Text improved"),
                    clarity_score=int(data.get("clarity_score", 7))
                )
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            logger.warning(f"Failed to parse rewrite JSON: {e}")
        
        # Fallback parsing
        return HighlightRewrite(
            original_text=original,
            rewritten_text=response[:500] if len(response) > 20 else original,
            improvement_summary="Text has been processed",
            clarity_score=6
        )


# Convenience function for quick highlight analysis
async def analyze_highlight_quick(
    highlight_content: str, 
    comment: str = "", 
    model: str = None
) -> Dict[str, Any]:
    """Quick analysis function for highlights."""
    service = AIHighlightService(model)
    analysis = await service.analyze_highlight(highlight_content, comment)
    
    return {
        "summary": analysis.summary,
        "insights": analysis.key_insights,
        "risk": analysis.risk_level,
        "significance": analysis.legal_significance,
        "action": analysis.recommended_action
    }


# Convenience function for quick rewrite
async def rewrite_highlight_quick(
    highlight_content: str, 
    goal: str = "clarity", 
    model: str = None
) -> Dict[str, Any]:
    """Quick rewrite function for highlights."""
    service = AIHighlightService(model)
    rewrite = await service.generate_ai_rewrite(highlight_content, goal)
    
    return {
        "original": rewrite.original_text,
        "rewritten": rewrite.rewritten_text,
        "summary": rewrite.improvement_summary,
        "score": rewrite.clarity_score
    }
