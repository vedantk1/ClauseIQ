"""
PDF report generation service for legal document analysis.
"""
import io
from datetime import datetime
from typing import Dict, Any, List, Optional
from fpdf import FPDF
from models.analysis import AnalyzeDocumentResponse
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
                    self.cell(5, 5, '•', 0, 0)
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
        
        # Add executive summary
        summary = document_data.get('summary', '') or document_data.get('ai_structured_summary', {}).get('overview', '')
        if summary:
            pdf.add_page()
            pdf.add_section('Executive Summary', summary, True)
        
        # Add structured summary sections
        structured_summary = document_data.get('ai_structured_summary', {})
        if structured_summary:
            # Key parties
            key_parties = structured_summary.get('key_parties', [])
            if key_parties:
                parties_text = '\n'.join([f"• {party}" for party in key_parties])
                pdf.add_section('Key Parties', parties_text)
            
            # Important dates
            important_dates = structured_summary.get('important_dates', [])
            if important_dates:
                dates_text = '\n'.join([f"• {date}" for date in important_dates])
                pdf.add_section('Important Dates', dates_text)
            
            # Major obligations
            major_obligations = structured_summary.get('major_obligations', [])
            if major_obligations:
                obligations_text = '\n'.join([f"• {obligation}" for obligation in major_obligations])
                pdf.add_section('Major Obligations', obligations_text)
            
            # Risk highlights
            risk_highlights = structured_summary.get('risk_highlights', [])
            if risk_highlights:
                risks_text = '\n'.join([f"• {risk}" for risk in risk_highlights])
                pdf.add_section('Risk Highlights', risks_text)
            
            # Key insights
            key_insights = structured_summary.get('key_insights', [])
            if key_insights:
                insights_text = '\n'.join([f"• {insight}" for insight in key_insights])
                pdf.add_section('Key Insights', insights_text)
        
        # Add clause analysis
        clauses = document_data.get('clauses', [])
        if clauses:
            pdf.add_clause_analysis(clauses)
        
        # Add disclaimer
        pdf.add_page()
        disclaimer = """
This report is generated by ClauseIQ's AI-powered legal document analysis system. 
While our AI provides valuable insights and analysis, this report should not be 
considered as legal advice. Please consult with qualified legal professionals 
for specific legal guidance and decision-making.

The analysis is based on automated processing and may not capture all nuances 
of legal language. Always review the original document and seek professional 
legal counsel when making important decisions.
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
