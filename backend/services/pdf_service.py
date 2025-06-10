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
        
    def add_professional_heading(self, title: str):
        """Add a professional section heading with spacing."""
        self.ln(15)  # Extra space before heading
        self.set_font('Arial', 'B', 18)
        self.set_text_color(50, 50, 150)
        self.cell(0, 12, title, 0, 1, 'L')
        self.ln(8)  # Space after heading
        
    def add_statistics_box(self, word_count: int, clause_count: int, complexity_score: str, risk_summary: dict):
        """Add a professional statistics box with metrics."""
        # Main statistics box
        box_height = 65
        self.set_fill_color(245, 248, 252)  # Light blue background
        self.rect(20, self.get_y(), 170, box_height, 'F')
        self.set_draw_color(100, 149, 237)  # Blue border
        self.rect(20, self.get_y(), 170, box_height)
        
        y_start = self.get_y() + 8
        
        # Statistics title
        self.set_xy(30, y_start)
        self.set_font('Arial', 'B', 14)
        self.set_text_color(50, 50, 150)
        self.cell(0, 8, 'DOCUMENT STATISTICS', 0, 1)
        
        # Document metrics
        self.set_font('Arial', '', 11)
        self.set_text_color(60, 60, 60)
        
        contract_type = self.document_data.get('contract_type', 'Unknown').replace('_', ' ').title()
        
        metrics = [
            f"Word Count: {word_count:,} words",
            f"Clause Count: {clause_count} clauses identified", 
            f"Document Complexity: {complexity_score} (scale 1-10)",
            f"Contract Type: {contract_type}"
        ]
        
        for i, metric in enumerate(metrics):
            self.set_xy(30, y_start + 16 + (i * 7))
            self.cell(0, 6, f"- {metric}", 0, 1)  # Use ASCII dash
        
        # Risk summary section
        self.set_xy(30, y_start + 48)
        self.set_font('Arial', 'B', 11)
        self.set_text_color(50, 50, 150)
        self.cell(0, 6, 'Risk Assessment:', 0, 1)
        
        # Risk indicators
        self.set_xy(30, y_start + 55)
        self.set_font('Arial', '', 10)
        
        high = risk_summary.get('high', 0)
        medium = risk_summary.get('medium', 0) 
        low = risk_summary.get('low', 0)
        
        # High risk
        self.set_text_color(220, 53, 69)
        self.cell(35, 5, f'High: {high}', 0, 0)
        
        # Medium risk  
        self.set_text_color(255, 193, 7)
        self.cell(35, 5, f'Medium: {medium}', 0, 0)
        
        # Low risk
        self.set_text_color(40, 167, 69)
        self.cell(35, 5, f'Low: {low}', 0, 1)
        
        self.ln(box_height + 5)
        
    def add_content_block(self, title: str, content: str):
        """Add a content block with title and formatted text."""
        # Title
        self.set_font('Arial', 'B', 13)
        self.set_text_color(50, 50, 150)
        self.cell(0, 10, title, 0, 1)
        self.ln(3)
        
        # Content with better formatting
        self.set_font('Arial', '', 11)
        self.set_text_color(70, 70, 70)
        self.add_formatted_text(content)
        self.ln(10)
        
    def add_formatted_text(self, text: str, line_height: int = 7):
        """Add formatted text with proper line spacing."""
        if not text:
            return
            
        # Clean and split text
        text = text.replace('\n', ' ').strip()
        effective_width = self.w - 40
        
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
        
        # Add lines with proper spacing
        for line in lines:
            if self.get_y() > 260:  # Near bottom of page
                self.add_page()
            self.cell(0, line_height, line, 0, 1)
            
    def add_professional_list(self, items: List[str], title: str = "", numbered: bool = True):
        """Add a professionally formatted list."""
        if not items:
            return
            
        if title:
            self.add_content_block(title, "")
            
        self.set_font('Arial', '', 11)
        self.set_text_color(70, 70, 70)
        
        for i, item in enumerate(items, 1):
            if self.get_y() > 260:
                self.add_page()
                
            clean_item = item.strip()
            if clean_item:
                prefix = f"{i}." if numbered else "-"  # Use ASCII dash instead of bullet
                
                # Format multi-line items properly
                item_lines = self.wrap_text(clean_item, self.w - 60)
                
                # First line with prefix
                self.cell(15, 7, prefix, 0, 0)
                self.cell(0, 7, item_lines[0] if item_lines else "", 0, 1)
                
                # Additional lines with indent
                for line in item_lines[1:]:
                    self.cell(15, 7, "", 0, 0)  # Indent
                    self.cell(0, 7, line, 0, 1)
                    
                self.ln(2)  # Small space between items
                
    def wrap_text(self, text: str, max_width: float) -> List[str]:
        """Wrap text to fit within specified width."""
        words = text.split(' ')
        lines = []
        current_line = ''
        
        for word in words:
            test_line = current_line + (' ' if current_line else '') + word
            if self.get_string_width(test_line) < max_width:
                current_line = test_line
            else:
                if current_line:
                    lines.append(current_line)
                current_line = word
        
        if current_line:
            lines.append(current_line)
            
        return lines if lines else [text]
        
    def add_document_insights_section(self):
        """Add document insights with metrics."""
        self.add_page()
        self.add_professional_heading('Document Insights')
        
        # Calculate metrics
        full_text = self.document_data.get('text', '') or ''
        word_count = len(full_text.split()) if full_text else 0
        clauses = self.document_data.get('clauses', [])
        clause_count = len(clauses)
        complexity_score = self.calculate_complexity_score(full_text, clauses)
        risk_summary = self.document_data.get('risk_summary', {})
        
        # Add statistics in a professional box
        self.add_statistics_box(word_count, clause_count, complexity_score, risk_summary)
        
        # Add analysis overview
        overview_text = """This document has been comprehensively analyzed using ClauseIQ's AI-powered legal analysis system. The following sections provide detailed insights into the document's structure, key provisions, and potential risk areas."""
        
        self.add_content_block("Analysis Overview", overview_text)
        
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
        """Format a list of items into a well-structured section - now handled by add_professional_list."""
        # This method is now deprecated in favor of add_professional_list
        # but kept for compatibility
        if not items:
            return "No items identified in this category."
            
        formatted_text = f"{description}:\n\n"
        
        for i, item in enumerate(items, 1):
            clean_item = item.strip()
            if clean_item:
                formatted_text += f"{i}. {clean_item}\n\n"
        
        return formatted_text.strip()
    
    def add_clause_overview_section(self, clauses: List[Dict[str, Any]]):
        """Add a clause overview section with risk breakdown."""
        self.add_page()
        self.add_professional_heading('Clause Analysis Overview')
        
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
        
        # Create overview summary
        total_clauses = len(clauses)
        overview_text = f"This analysis identified {total_clauses} clauses across various legal categories. Each clause has been categorized by type and assigned a risk level based on potential legal implications."
        self.add_content_block("Analysis Summary", overview_text)
        
        # Risk breakdown
        risk_items = [
            f"High Risk: {risk_distribution['high']} clauses ({(risk_distribution['high']/total_clauses*100):.1f}%)",
            f"Medium Risk: {risk_distribution['medium']} clauses ({(risk_distribution['medium']/total_clauses*100):.1f}%)",
            f"Low Risk: {risk_distribution['low']} clauses ({(risk_distribution['low']/total_clauses*100):.1f}%)"
        ]
        self.add_professional_list(risk_items, "Risk Distribution", numbered=False)
        
        # Clause types identified
        clause_type_items = []
        for clause_type, count in sorted(clause_types.items(), key=lambda x: x[1], reverse=True):
            formatted_type = clause_type.replace('_', ' ').title()
            percentage = (count / total_clauses * 100)
            clause_type_items.append(f"{formatted_type}: {count} clauses ({percentage:.1f}%)")
        
        self.add_professional_list(clause_type_items, "Clause Types Identified", numbered=False)
        
        # Analysis methodology
        methodology_text = "Each clause has been analyzed using ClauseIQ's AI system to determine clause type and legal category, risk level (High/Medium/Low), key legal implications, and recommendations for review. The detailed analysis for each clause follows in the next section."
        self.add_content_block("Analysis Methodology", methodology_text)
    
    def add_document_summary_section(self):
        """Add a final document summary section."""
        self.add_page()
        self.add_professional_heading('Document Analysis Summary')
        
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
        
        # Document overview
        overview_items = [
            f"Document Name: {filename}",
            f"Contract Type: {contract_type.replace('_', ' ').title()}",
            f"Total Word Count: {word_count:,} words",
            f"Analysis Date: {datetime.now().strftime('%B %d, %Y')}"
        ]
        self.add_professional_list(overview_items, "Document Overview", numbered=False)
        
        # Analysis results
        results_items = [
            f"Total Clauses Analyzed: {clause_count}",
            f"Total Risk Items Identified: {total_risks}",
            f"High Priority Risks: {risk_summary.get('high', 0)}",
            f"Medium Priority Risks: {risk_summary.get('medium', 0)}",
            f"Low Priority Risks: {risk_summary.get('low', 0)}"
        ]
        self.add_professional_list(results_items, "Analysis Results", numbered=False)
        
        # Completion status
        completion_text = "This document has been thoroughly analyzed using ClauseIQ's AI-powered legal analysis system. The analysis includes comprehensive clause identification and categorization, risk assessment for each identified clause, structured summary of key provisions, identification of important dates and obligations, and analysis of key parties and stakeholders."
        self.add_content_block("Completion Status", completion_text)
        
        # Next steps
        next_steps = [
            "Review each high-risk item identified in the analysis",
            "Consult with legal counsel on matters requiring professional judgment",
            "Verify all dates, deadlines, and obligations identified",
            "Consider the recommendations provided for each clause",
            "Keep this analysis for your records and future reference"
        ]
        self.add_professional_list(next_steps, "Recommended Next Steps")
        
        # Final note
        final_text = "This completes the comprehensive analysis of your legal document."
        self.add_content_block("", final_text)
        
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
        """Add detailed clause analysis with professional formatting."""
        if not clauses:
            return
            
        self.add_page()
        self.add_professional_heading('Detailed Clause Analysis')
        
        for i, clause in enumerate(clauses):
            if self.get_y() > 240:  # Near bottom, start new page
                self.add_page()
                
            # Clause header with improved formatting
            clause_type = clause.get('clause_type', 'Unknown')
            risk_level = clause.get('risk_level', 'unknown')
            
            # Create clause title
            clause_title = f"Clause {i+1}: {clause_type.replace('_', ' ').title()}"
            
            # Add clause header
            self.ln(8)
            self.set_font('Arial', 'B', 13)
            self.set_text_color(50, 50, 150)
            self.cell(0, 8, clause_title, 0, 1)
            
            # Risk level indicator with color coding
            self.set_font('Arial', 'B', 11)
            if risk_level == 'high':
                self.set_text_color(220, 53, 69)  # Red
                risk_text = "RISK LEVEL: HIGH"
            elif risk_level == 'medium':
                self.set_text_color(255, 193, 7)  # Amber
                risk_text = "RISK LEVEL: MEDIUM"
            else:
                self.set_text_color(40, 167, 69)  # Green
                risk_text = "RISK LEVEL: LOW"
                
            self.cell(0, 6, risk_text, 0, 1)
            self.ln(5)
            
            # Summary section
            summary = clause.get('summary', clause.get('risk_assessment', ''))
            if summary:
                self.add_content_block("Summary", summary)
            
            # Recommendations section
            recommendations = clause.get('recommendations', [])
            if recommendations:
                # Limit to first 3 recommendations and clean them
                clean_recommendations = [rec.strip() for rec in recommendations[:3] if rec.strip()]
                if clean_recommendations:
                    self.add_professional_list(clean_recommendations, "Recommendations", numbered=False)
                    
            self.ln(5)  # Space between clauses
            
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
            pdf.add_professional_heading('Executive Summary')
            pdf.add_content_block("", summary)
        
        # Add structured summary sections
        structured_summary = document_data.get('ai_structured_summary', {})
        if structured_summary:
            # Key parties
            key_parties = structured_summary.get('key_parties', [])
            if key_parties:
                pdf.add_page()
                pdf.add_professional_heading('Key Parties')
                clean_parties = [party.strip() for party in key_parties if party.strip()]
                pdf.add_professional_list(clean_parties, "Key Parties and Stakeholders Identified", numbered=False)
            
            # Important dates
            important_dates = structured_summary.get('important_dates', [])
            if important_dates:
                pdf.add_page()
                pdf.add_professional_heading('Important Dates')
                clean_dates = [date.strip() for date in important_dates if date.strip()]
                pdf.add_professional_list(clean_dates, "Critical Dates and Deadlines", numbered=False)
            
            # Major obligations
            major_obligations = structured_summary.get('major_obligations', [])
            if major_obligations:
                pdf.add_page()
                pdf.add_professional_heading('Major Obligations')
                clean_obligations = [obligation.strip() for obligation in major_obligations if obligation.strip()]
                pdf.add_professional_list(clean_obligations, "Key Obligations and Responsibilities", numbered=False)
            
            # Risk highlights
            risk_highlights = structured_summary.get('risk_highlights', [])
            if risk_highlights:
                pdf.add_page()
                pdf.add_professional_heading('Risk Highlights')
                clean_risks = [risk.strip() for risk in risk_highlights if risk.strip()]
                pdf.add_professional_list(clean_risks, "Risk Areas Requiring Attention", numbered=False)
            
            # Key insights
            key_insights = structured_summary.get('key_insights', [])
            if key_insights:
                pdf.add_page()
                pdf.add_professional_heading('Key Insights')
                clean_insights = [insight.strip() for insight in key_insights if insight.strip()]
                pdf.add_professional_list(clean_insights, "Key Legal Insights and Analysis", numbered=False)
        
        # Add clause analysis
        clauses = document_data.get('clauses', [])
        if clauses:
            pdf.add_clause_overview_section(clauses)
            pdf.add_clause_analysis(clauses)
        else:
            pdf.add_page()
            pdf.add_professional_heading('Clause Analysis')
            no_analysis_text = "No detailed clause analysis available for this document. This may be due to the document format or content structure."
            pdf.add_content_block("", no_analysis_text)
        
        # Add document summary section
        pdf.add_document_summary_section()
        
        # Add disclaimer
        pdf.add_page()
        pdf.add_professional_heading('Legal Disclaimer')
        
        disclaimer_sections = [
            {
                'title': 'NOT LEGAL ADVICE',
                'content': 'This report is generated by ClauseIQ\'s AI-powered legal document analysis system and is provided for informational purposes only. The analysis, insights, and recommendations contained in this report do NOT constitute legal advice and should not be relied upon as such.'
            },
            {
                'title': 'PROFESSIONAL CONSULTATION REQUIRED', 
                'content': 'Always consult with qualified legal professionals before making any decisions based on the analysis in this report. Legal documents often contain nuances, jurisdiction-specific provisions, and complex interdependencies that require human legal expertise to properly interpret.'
            },
            {
                'title': 'AI LIMITATIONS',
                'content': 'While ClauseIQ\'s AI system is trained on extensive legal data, it has limitations: may not capture all legal nuances or context, cannot account for jurisdiction-specific variations, may miss subtle legal implications, and cannot replace human legal judgment.'
            },
            {
                'title': 'CONFIDENTIALITY',
                'content': 'This report contains analysis of your confidential legal document. Ensure proper security measures when sharing or storing this analysis.'
            }
        ]
        
        for section in disclaimer_sections:
            pdf.add_content_block(section['title'], section['content'])
        
        # Recommended actions
        recommended_actions = [
            "Review this analysis with a qualified attorney",
            "Verify all identified dates, obligations, and risks", 
            "Consider jurisdiction-specific legal requirements",
            "Obtain professional legal advice before acting on any provisions"
        ]
        pdf.add_professional_list(recommended_actions, "RECOMMENDED ACTIONS")
        
        # Footer information
        footer_text = f"Generated by ClauseIQ AI Legal Analysis System on {datetime.now().strftime('%B %d, %Y at %I:%M %p')}. For support or questions about this analysis, please contact ClauseIQ support."
        pdf.add_content_block("", footer_text)
        
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
