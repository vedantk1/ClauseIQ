"""
PDF report generation service for legal document analysis.
"""
import io
from datetime import datetime
from typing import Dict, Any, List, Optional
from fpdf import FPDF
from models.common import Clause


class LegalReportPDF(FPDF):
    """Custom PDF class for legal document reports."""
    
    def __init__(self, document_data: Dict[str, Any]):
        super().__init__()
        self.document_data = document_data
        
    def header(self):
        """Add header to each page."""
        self.set_font('Arial', 'B', 16)
        self.set_text_color(50, 50, 150)  # Purple color
        self.cell(0, 10, 'ClauseIQ Legal Analysis Report', 0, 1, 'C')
        self.ln(5)
        
    def footer(self):
        """Add footer to each page."""
        self.set_y(-15)
        self.set_font('Arial', 'I', 8)
        self.set_text_color(128, 128, 128)
        self.cell(0, 10, f'Generated on {datetime.now().strftime("%B %d, %Y at %I:%M %p")} | Page {self.page_no()}', 0, 0, 'C')
        
    def add_title_page(self):
        """Add document title page."""
        self.add_page()
        self.ln(30)
        
        # Document title
        self.set_font('Arial', 'B', 24)
        self.set_text_color(50, 50, 150)
        filename = self.document_data.get('filename', 'Document Analysis')
        self.cell(0, 15, 'Legal Document Analysis', 0, 1, 'C')
        self.ln(5)
        
        # Document filename
        self.set_font('Arial', '', 16)
        self.set_text_color(100, 100, 100)
        self.cell(0, 10, filename, 0, 1, 'C')
        self.ln(10)
        
        # Generation date
        self.set_font('Arial', '', 12)
        self.cell(0, 10, f'Generated on {datetime.now().strftime("%B %d, %Y")}', 0, 1, 'C')
        self.ln(20)
        
        # Risk summary box
        risk_summary = self.document_data.get('risk_summary', {})
        if risk_summary:
            self.add_risk_summary_box(risk_summary)
            
    def add_risk_summary_box(self, risk_summary: Dict[str, int]):
        """Add a risk summary box."""
        # Box background
        self.set_fill_color(248, 249, 250)
        self.rect(30, self.get_y(), 150, 40, 'F')
        
        # Box border
        self.set_draw_color(200, 200, 200)
        self.rect(30, self.get_y(), 150, 40)
        
        # Content
        y_start = self.get_y() + 8
        self.set_xy(40, y_start)
        self.set_font('Arial', 'B', 14)
        self.set_text_color(50, 50, 50)
        self.cell(0, 8, 'Risk Assessment Summary', 0, 1)
        
        self.set_font('Arial', '', 12)
        high = risk_summary.get('high', 0)
        medium = risk_summary.get('medium', 0)
        low = risk_summary.get('low', 0)
        
        self.set_xy(40, y_start + 12)
        self.set_text_color(220, 53, 69)  # Red
        self.cell(40, 6, f'High Risk: {high}', 0, 0)
        
        self.set_text_color(255, 193, 7)  # Amber
        self.cell(40, 6, f'Medium Risk: {medium}', 0, 0)
        
        self.set_text_color(40, 167, 69)  # Green
        self.cell(40, 6, f'Low Risk: {low}', 0, 1)
        
        self.ln(35)
        
    def add_document_insights_section(self):
        """Add document insights with metrics."""
        self.add_page()
        self.add_section('Document Insights', '', True)
        
        # Calculate metrics
        full_text = self.document_data.get('text', '') or ''
        word_count = len(full_text.split()) if full_text else 0
        clauses = self.document_data.get('clauses', [])
        clause_count = len(clauses)
        
        # Calculate complexity score
        complexity_score = self.calculate_complexity_score(full_text, clauses)
        
        # Get risk summary
        risk_summary = self.document_data.get('risk_summary', {})
        
        # Create metrics content
        metrics_content = f"""
Document Metrics and Analysis Overview:

DOCUMENT STATISTICS:
- Word Count: {word_count:,} words
- Clause Count: {clause_count} clauses identified
- Document Complexity: {complexity_score} (on a scale of 1-10)
- Contract Type: {self.document_data.get('contract_type', 'Unknown').replace('_', ' ').title()}

RISK ASSESSMENT SUMMARY:
- High Risk Items: {risk_summary.get('high', 0)} clauses
- Medium Risk Items: {risk_summary.get('medium', 0)} clauses  
- Low Risk Items: {risk_summary.get('low', 0)} clauses
- Total Risk Items: {sum(risk_summary.values()) if risk_summary else 0} clauses analyzed

ANALYSIS OVERVIEW:
This document has been comprehensively analyzed using ClauseIQ's AI-powered legal analysis system. The following sections provide detailed insights into the document's structure, key provisions, and potential risk areas.
        """.strip()
        
        self.add_section('', metrics_content)
        
    def calculate_complexity_score(self, full_text: str, clauses: List[Dict[str, Any]]) -> str:
        """Calculate document complexity score (1-10 scale)."""
        if not full_text:
            return "N/A"
            
        try:
            word_count = len(full_text.split())
            clause_count = len(clauses)
            
            # Base score from word count
            score = 0
            if word_count > 0:
                # Length complexity (0-3 points)
                if word_count > 5000:
                    score += 3
                elif word_count > 2000:
                    score += 2
                elif word_count > 1000:
                    score += 1
                
                # Clause density (0-3 points)
                if word_count > 0:
                    clauses_per_thousand_words = (clause_count * 1000) / word_count
                    if clauses_per_thousand_words > 20:
                        score += 3
                    elif clauses_per_thousand_words > 15:
                        score += 2
                    elif clauses_per_thousand_words > 10:
                        score += 1
            
            # Risk complexity (0-4 points)
            risk_summary = self.document_data.get('risk_summary', {})
            score += (risk_summary.get('high', 0) * 1.5)
            score += (risk_summary.get('medium', 0) * 0.5)
            
            # Cap at 10
            score = min(10, max(1, int(score)))
            return str(score)
            
        except Exception:
            return "N/A"
    
    def format_list_section(self, items: List[str], description: str) -> str:
        """Format a list of items into a well-structured section."""
        if not items:
            return "No items identified in this category."
            
        formatted_text = f"{description}:\n\n"
        
        for i, item in enumerate(items, 1):
            # Clean up the item text
            clean_item = item.strip()
            if clean_item:
                formatted_text += f"{i}. {clean_item}\n\n"
        
        return formatted_text.strip()
    
    def add_clause_overview_section(self, clauses: List[Dict[str, Any]]):
        """Add a clause overview section with risk breakdown."""
        self.add_page()
        self.add_section('Clause Analysis Overview', '', True)
        
        # Analyze clause distribution by type and risk
        clause_types = {}
        risk_distribution = {'high': 0, 'medium': 0, 'low': 0}
        
        for clause in clauses:
            clause_type = clause.get('clause_type', 'unknown')
            risk_level = clause.get('risk_level', 'unknown')
            
            # Count clause types
            clause_types[clause_type] = clause_types.get(clause_type, 0) + 1
            
            # Count risk levels
            if risk_level in risk_distribution:
                risk_distribution[risk_level] += 1
        
        # Create overview content
        total_clauses = len(clauses)
        overview_content = f"""
CLAUSE ANALYSIS SUMMARY:

Total Clauses Identified: {total_clauses}

RISK BREAKDOWN:
- High Risk: {risk_distribution['high']} clauses ({(risk_distribution['high']/total_clauses*100):.1f}%)
- Medium Risk: {risk_distribution['medium']} clauses ({(risk_distribution['medium']/total_clauses*100):.1f}%)  
- Low Risk: {risk_distribution['low']} clauses ({(risk_distribution['low']/total_clauses*100):.1f}%)

CLAUSE TYPES IDENTIFIED:"""
        
        # Add clause type distribution
        for clause_type, count in sorted(clause_types.items(), key=lambda x: x[1], reverse=True):
            formatted_type = clause_type.replace('_', ' ').title()
            percentage = (count / total_clauses * 100)
            overview_content += f"\n- {formatted_type}: {count} clauses ({percentage:.1f}%)"
        
        overview_content += f"""

ANALYSIS METHODOLOGY:
Each clause has been analyzed using ClauseIQ's AI system to determine:
- Clause type and legal category
- Risk level (High/Medium/Low)
- Key legal implications
- Recommendations for review

The detailed analysis for each clause follows in the next section.
        """
        
        self.add_section('', overview_content.strip())
    
    def add_document_summary_section(self):
        """Add a final document summary section."""
        self.add_page()
        self.add_section('Document Analysis Summary', '', True)
        
        # Get document data
        filename = self.document_data.get('filename', 'Document')
        contract_type = self.document_data.get('contract_type', 'unknown')
        full_text = self.document_data.get('text', '') or ''
        clauses = self.document_data.get('clauses', [])
        risk_summary = self.document_data.get('risk_summary', {})
        
        # Calculate key metrics
        word_count = len(full_text.split()) if full_text else 0
        clause_count = len(clauses)
        total_risks = sum(risk_summary.values()) if risk_summary else 0
        
        # Create summary content
        summary_content = f"""
COMPREHENSIVE ANALYSIS SUMMARY

DOCUMENT OVERVIEW:
- Document Name: {filename}
- Contract Type: {contract_type.replace('_', ' ').title()}
- Total Word Count: {word_count:,} words
- Analysis Date: {datetime.now().strftime("%B %d, %Y")}

ANALYSIS RESULTS:
- Total Clauses Analyzed: {clause_count}
- Total Risk Items Identified: {total_risks}
- High Priority Risks: {risk_summary.get('high', 0)}
- Medium Priority Risks: {risk_summary.get('medium', 0)}
- Low Priority Risks: {risk_summary.get('low', 0)}

COMPLETION STATUS:
This document has been thoroughly analyzed using ClauseIQ's AI-powered legal analysis system. The analysis includes:
- Comprehensive clause identification and categorization
- Risk assessment for each identified clause
- Structured summary of key provisions
- Identification of important dates and obligations
- Analysis of key parties and stakeholders

NEXT STEPS:
1. Review each high-risk item identified in the analysis
2. Consult with legal counsel on matters requiring professional judgment
3. Verify all dates, deadlines, and obligations identified
4. Consider the recommendations provided for each clause
5. Keep this analysis for your records and future reference

This completes the comprehensive analysis of your legal document.
        """.strip()
        
        self.add_section('', summary_content)
        
    def add_section(self, title: str, content: str, is_heading: bool = False):
        """Add a section with title and content."""
        if is_heading:
            self.set_font('Arial', 'B', 16)
            self.set_text_color(50, 50, 150)
            self.ln(5)
        else:
            self.set_font('Arial', 'B', 14)
            self.set_text_color(50, 50, 50)
            
        self.cell(0, 10, title, 0, 1)
        self.ln(2)
        
        # Content
        self.set_font('Arial', '', 11)
        self.set_text_color(70, 70, 70)
        
        # Split content into lines that fit the page width
        content = content.replace('\n', ' ').strip()
        if content:
            # Calculate width (page width minus margins)
            effective_width = self.w - 40
            
            # Split text to fit width
            words = content.split(' ')
            lines = []
            current_line = ''
            
            for word in words:
                test_line = current_line + (' ' if current_line else '') + word
                if self.get_string_width(test_line) < effective_width:
                    current_line = test_line
                else:
                    if current_line:
                        lines.append(current_line)
                    current_line = word
            
            if current_line:
                lines.append(current_line)
            
            # Add lines to PDF
            for line in lines:
                if self.get_y() > 250:  # Near bottom of page
                    self.add_page()
                self.cell(0, 6, line, 0, 1)
                
        self.ln(5)
        
    def add_clause_analysis(self, clauses: List[Dict[str, Any]]):
        """Add detailed clause analysis."""
        if not clauses:
            return
            
        self.add_page()
        self.add_section('Detailed Clause Analysis', '', True)
        
        for i, clause in enumerate(clauses):
            if self.get_y() > 240:  # Near bottom, start new page
                self.add_page()
                
            # Clause header
            clause_type = clause.get('clause_type', 'Unknown')
            risk_level = clause.get('risk_level', 'unknown')
            
            self.set_font('Arial', 'B', 12)
            self.set_text_color(50, 50, 150)
            self.cell(0, 8, f'Clause {i+1}: {clause_type.replace("_", " ").title()}', 0, 1)
            
            # Risk level indicator
            self.set_font('Arial', 'B', 10)
            if risk_level == 'high':
                self.set_text_color(220, 53, 69)
            elif risk_level == 'medium':
                self.set_text_color(255, 193, 7)
            else:
                self.set_text_color(40, 167, 69)
                
            self.cell(0, 6, f'Risk Level: {risk_level.upper()}', 0, 1)
            self.ln(2)
            
            # Summary
            summary = clause.get('summary', clause.get('risk_assessment', ''))
            if summary:
                self.set_font('Arial', 'B', 11)
                self.set_text_color(50, 50, 50)
                self.cell(0, 6, 'Summary:', 0, 1)
                
                self.set_font('Arial', '', 10)
                self.set_text_color(70, 70, 70)
                self.add_wrapped_text(summary)
                self.ln(3)
            
            # Recommendations
            recommendations = clause.get('recommendations', [])
            if recommendations:
                self.set_font('Arial', 'B', 11)
                self.set_text_color(50, 50, 50)
                self.cell(0, 6, 'Recommendations:', 0, 1)
                
                self.set_font('Arial', '', 10)
                self.set_text_color(70, 70, 70)
                for rec in recommendations[:3]:  # Limit to first 3
                    self.cell(5, 5, '-', 0, 0)
                    self.add_wrapped_text(rec, indent=10)
                    
            self.ln(8)
            
    def add_wrapped_text(self, text: str, indent: int = 0):
        """Add text with proper wrapping."""
        if not text:
            return
            
        # Clean text
        text = text.replace('\n', ' ').strip()
        effective_width = self.w - 40 - indent
        
        # Split text to fit width
        words = text.split(' ')
        lines = []
        current_line = ''
        
        for word in words:
            test_line = current_line + (' ' if current_line else '') + word
            if self.get_string_width(test_line) < effective_width:
                current_line = test_line
            else:
                if current_line:
                    lines.append(current_line)
                current_line = word
        
        if current_line:
            lines.append(current_line)
        
        # Add lines to PDF
        for line in lines:
            if self.get_y() > 270:  # Near bottom of page
                self.add_page()
            if indent > 0:
                self.set_x(self.get_x() + indent)
            self.cell(0, 5, line, 0, 1)


async def generate_pdf_report(document_data: Dict[str, Any]) -> bytes:
    """
    Generate a comprehensive PDF report for legal document analysis.
    
    Args:
        document_data: Document analysis data including filename, summary, clauses, etc.
        
    Returns:
        bytes: PDF file content
    """
    try:
        # Create PDF instance
        pdf = LegalReportPDF(document_data)
        
        # Add title page
        pdf.add_title_page()
        
        # Add document insights section
        pdf.add_document_insights_section()
        
        # Add executive summary
        summary = document_data.get('summary', '') or document_data.get('ai_structured_summary', {}).get('overview', '') or document_data.get('ai_full_summary', '')
        if summary:
            pdf.add_page()
            pdf.add_section('Executive Summary', summary, True)
        
        # Add structured summary sections
        structured_summary = document_data.get('ai_structured_summary', {})
        if structured_summary:
            # Key parties
            key_parties = structured_summary.get('key_parties', [])
            if key_parties:
                parties_text = pdf.format_list_section(key_parties, "Key Parties and Stakeholders")
                pdf.add_section('Key Parties', parties_text)
            
            # Important dates
            important_dates = structured_summary.get('important_dates', [])
            if important_dates:
                dates_text = pdf.format_list_section(important_dates, "Critical Dates and Deadlines")
                pdf.add_section('Important Dates', dates_text)
            
            # Major obligations
            major_obligations = structured_summary.get('major_obligations', [])
            if major_obligations:
                obligations_text = pdf.format_list_section(major_obligations, "Key Obligations and Responsibilities")
                pdf.add_section('Major Obligations', obligations_text)
            
            # Risk highlights
            risk_highlights = structured_summary.get('risk_highlights', [])
            if risk_highlights:
                risks_text = pdf.format_list_section(risk_highlights, "Risk Areas Requiring Attention")
                pdf.add_section('Risk Highlights', risks_text)
            
            # Key insights
            key_insights = structured_summary.get('key_insights', [])
            if key_insights:
                insights_text = pdf.format_list_section(key_insights, "Key Legal Insights and Analysis")
                pdf.add_section('Key Insights', insights_text)
        
        # Add clause analysis
        clauses = document_data.get('clauses', [])
        if clauses:
            pdf.add_clause_overview_section(clauses)
            pdf.add_clause_analysis(clauses)
        else:
            pdf.add_page()
            pdf.add_section('Clause Analysis', 'No detailed clause analysis available for this document. This may be due to the document format or content structure.', True)
        
        # Add document summary section
        pdf.add_document_summary_section()
        
        # Add disclaimer
        pdf.add_page()
        disclaimer = """
LEGAL DISCLAIMER AND IMPORTANT NOTICE

NOT LEGAL ADVICE:
This report is generated by ClauseIQ's AI-powered legal document analysis system and is provided for informational purposes only. The analysis, insights, and recommendations contained in this report do NOT constitute legal advice and should not be relied upon as such.

PROFESSIONAL CONSULTATION REQUIRED:
Always consult with qualified legal professionals before making any decisions based on the analysis in this report. Legal documents often contain nuances, jurisdiction-specific provisions, and complex interdependencies that require human legal expertise to properly interpret.

AI LIMITATIONS:
While ClauseIQ's AI system is trained on extensive legal data, it has limitations:
- May not capture all legal nuances or context
- Cannot account for jurisdiction-specific variations
- May miss subtle legal implications
- Cannot replace human legal judgment

RECOMMENDED ACTIONS:
1. Review this analysis with a qualified attorney
2. Verify all identified dates, obligations, and risks
3. Consider jurisdiction-specific legal requirements
4. Obtain professional legal advice before acting on any provisions

CONFIDENTIALITY:
This report contains analysis of your confidential legal document. Ensure proper security measures when sharing or storing this analysis.

Generated by ClauseIQ AI Legal Analysis System
Report Generation Date: """ + datetime.now().strftime("%B %d, %Y at %I:%M %p") + """

For support or questions about this analysis, please contact ClauseIQ support.
        """.strip()
        pdf.add_section('Legal Disclaimer', disclaimer, True)
        
        # Generate PDF content
        pdf_content = pdf.output(dest='S').encode('latin-1')
        return pdf_content
        
    except Exception as e:
        print(f"Error generating PDF report: {str(e)}")
        raise e


def create_simple_pdf_report(filename: str, summary: str) -> bytes:
    """
    Create a simple PDF report when full analysis data is not available.
    
    Args:
        filename: Document filename
        summary: Document summary
        
    Returns:
        bytes: PDF file content
    """
    try:
        pdf = FPDF()
        pdf.add_page()
        
        # Header
        pdf.set_font('Arial', 'B', 16)
        pdf.cell(0, 10, 'ClauseIQ Analysis Report', 0, 1, 'C')
        pdf.ln(10)
        
        # Document name
        pdf.set_font('Arial', 'B', 14)
        pdf.cell(0, 10, f'Document: {filename}', 0, 1)
        pdf.ln(5)
        
        # Summary
        pdf.set_font('Arial', 'B', 12)
        pdf.cell(0, 10, 'Summary:', 0, 1)
        pdf.set_font('Arial', '', 11)
        
        # Add summary text with wrapping
        if summary:
            lines = summary.split('\n')
            for line in lines:
                pdf.cell(0, 6, line[:80], 0, 1)  # Simple line wrapping
        else:
            pdf.cell(0, 6, 'No summary available.', 0, 1)
        
        # Disclaimer
        pdf.ln(10)
        pdf.set_font('Arial', 'I', 10)
        disclaimer = 'This report is generated by ClauseIQ AI. Please consult legal professionals for advice.'
        pdf.cell(0, 6, disclaimer, 0, 1)
        
        return pdf.output(dest='S').encode('latin-1')
        
    except Exception as e:
        print(f"Error generating simple PDF report: {str(e)}")
        raise e
