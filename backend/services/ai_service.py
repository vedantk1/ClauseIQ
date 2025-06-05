"""
AI processing and OpenAI integration service.
"""
import asyncio
from typing import Optional
from openai import AsyncOpenAI, OpenAIError
from settings import get_settings
from models.common import Clause, RiskLevel, ClauseType


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


def is_ai_available() -> bool:
    """Check if AI services are available."""
    return openai_client is not None
