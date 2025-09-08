"""
PDF report generation service for legal document analysis using ReportLab.
"""
import io
from datetime import datetime
from typing import Dict, Any, List, Optional

from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor, Color, black, white, red, green, orange
from reportlab.lib.units import inch, mm
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, KeepTogether
from reportlab.platypus.flowables import HRFlowable
from reportlab.graphics.shapes import Drawing, Rect, String
from reportlab.graphics import renderPDF
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

from models.common import Clause


class LegalReportTemplate:
    """Professional legal report template with ReportLab."""
    
    # Brand colors
    PRIMARY_BLUE = HexColor('#3252DF')    # ClauseIQ blue
    LIGHT_BLUE = HexColor('#F5F8FC')      # Light background
    DARK_GRAY = HexColor('#2D3748')       # Dark text
    MEDIUM_GRAY = HexColor('#4A5568')     # Medium text
    LIGHT_GRAY = HexColor('#E2E8F0')      # Light borders
    SUCCESS_GREEN = HexColor('#38A169')   # Low risk
    WARNING_ORANGE = HexColor('#D69E2E')  # Medium risk
    DANGER_RED = HexColor('#E53E3E')      # High risk
    
    def __init__(self, document_data: Dict[str, Any]):
        self.document_data = document_data
        self.story = []
        self.styles = self._create_styles()
        
    def _create_styles(self):
        """Create custom paragraph styles."""
        styles = getSampleStyleSheet()
        
        # Main title style
        styles.add(ParagraphStyle(
            name='MainTitle',
            parent=styles['Title'],
            fontSize=28,
            textColor=self.PRIMARY_BLUE,
            spaceAfter=30,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold'
        ))
        
        # Section heading style
        styles.add(ParagraphStyle(
            name='SectionHeading',
            parent=styles['Heading1'],
            fontSize=18,
            textColor=self.PRIMARY_BLUE,
            spaceBefore=25,
            spaceAfter=15,
            fontName='Helvetica-Bold',
            borderWidth=0,
            borderColor=self.LIGHT_GRAY,
            borderPadding=10
        ))
        
        # Subsection heading
        styles.add(ParagraphStyle(
            name='SubHeading',
            parent=styles['Heading2'],
            fontSize=14,
            textColor=self.DARK_GRAY,
            spaceBefore=15,
            spaceAfter=10,
            fontName='Helvetica-Bold'
        ))
        
        # Professional body text
        styles.add(ParagraphStyle(
            name='ProfessionalBody',
            parent=styles['Normal'],
            fontSize=11,
            textColor=self.MEDIUM_GRAY,
            spaceBefore=6,
            spaceAfter=6,
            fontName='Helvetica',
            alignment=TA_JUSTIFY,
            leftIndent=0,
            rightIndent=0
        ))
        
        # Risk level styles
        styles.add(ParagraphStyle(
            name='HighRisk',
            parent=styles['Normal'],
            fontSize=12,
            textColor=self.DANGER_RED,
            fontName='Helvetica-Bold',
            spaceBefore=5,
            spaceAfter=5
        ))
        
        styles.add(ParagraphStyle(
            name='MediumRisk',
            parent=styles['Normal'],
            fontSize=12,
            textColor=self.WARNING_ORANGE,
            fontName='Helvetica-Bold',
            spaceBefore=5,
            spaceAfter=5
        ))
        
        styles.add(ParagraphStyle(
            name='LowRisk',
            parent=styles['Normal'],
            fontSize=12,
            textColor=self.SUCCESS_GREEN,
            fontName='Helvetica-Bold',
            spaceBefore=5,
            spaceAfter=5
        ))
        
        # List item style
        styles.add(ParagraphStyle(
            name='ListItem',
            parent=styles['Normal'],
            fontSize=11,
            textColor=self.MEDIUM_GRAY,
            spaceBefore=3,
            spaceAfter=3,
            leftIndent=20,
            bulletIndent=15,
            fontName='Helvetica'
        ))
        
        # Footer style
        styles.add(ParagraphStyle(
            name='Footer',
            parent=styles['Normal'],
            fontSize=9,
            textColor=self.MEDIUM_GRAY,
            alignment=TA_CENTER,
            fontName='Helvetica-Oblique'
        ))
        
        return styles
    
    def _create_header_footer(self, canvas, doc):
        """Create professional header and footer."""
        canvas.saveState()
        
        # Header
        canvas.setFont('Helvetica-Bold', 16)
        canvas.setFillColor(self.PRIMARY_BLUE)
        canvas.drawCentredString(letter[0] / 2, letter[1] - 50, 'ClauseIQ Legal Analysis Report')
        
        # Header line
        canvas.setStrokeColor(self.LIGHT_GRAY)
        canvas.setLineWidth(1)
        canvas.line(50, letter[1] - 65, letter[0] - 50, letter[1] - 65)
        
        # Footer
        canvas.setFont('Helvetica-Oblique', 9)
        canvas.setFillColor(self.MEDIUM_GRAY)
        footer_text = f'Generated on {datetime.now().strftime("%B %d, %Y at %I:%M %p")} | Page {doc.page}'
        canvas.drawCentredString(letter[0] / 2, 30, footer_text)
        
        # Footer line
        canvas.line(50, 45, letter[0] - 50, 45)
        
        canvas.restoreState()
    
    def add_title_page(self):
        """Create professional title page."""
        # Main title
        title = Paragraph('Legal Document Analysis', self.styles['MainTitle'])
        self.story.append(title)
        self.story.append(Spacer(1, 20))
        
        # Document filename with styling
        filename = self.document_data.get('filename', 'Document Analysis')
        filename_para = Paragraph(f'<b>{filename}</b>', self.styles['ProfessionalBody'])
        self.story.append(filename_para)
        self.story.append(Spacer(1, 30))
        
        # Generation date
        date_text = f'Generated on {datetime.now().strftime("%B %d, %Y")}'
        date_para = Paragraph(date_text, self.styles['ProfessionalBody'])
        self.story.append(date_para)
        self.story.append(Spacer(1, 40))
        
        # Risk summary table
        risk_summary = self.document_data.get('risk_summary', {})
        if risk_summary:
            self._add_risk_summary_table(risk_summary)
            
        self.story.append(PageBreak())
    
    def _add_risk_summary_table(self, risk_summary: Dict[str, int]):
        """Add professional risk summary table."""
        # Title
        title = Paragraph('Risk Assessment Summary', self.styles['SubHeading'])
        self.story.append(title)
        self.story.append(Spacer(1, 15))
        
        # Create table data
        data = [
            ['Risk Level', 'Count', 'Percentage'],
            ['High Risk', str(risk_summary.get('high', 0)), f"{self._calculate_percentage(risk_summary, 'high'):.1f}%"],
            ['Medium Risk', str(risk_summary.get('medium', 0)), f"{self._calculate_percentage(risk_summary, 'medium'):.1f}%"],
            ['Low Risk', str(risk_summary.get('low', 0)), f"{self._calculate_percentage(risk_summary, 'low'):.1f}%"]
        ]
        
        # Create table
        table = Table(data, colWidths=[2*inch, 1*inch, 1.5*inch])
        table.setStyle(TableStyle([
            # Header row
            ('BACKGROUND', (0, 0), (-1, 0), self.PRIMARY_BLUE),
            ('TEXTCOLOR', (0, 0), (-1, 0), white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            
            # Data rows
            ('BACKGROUND', (0, 1), (-1, 1), HexColor('#FFE6E6')),  # High risk row
            ('BACKGROUND', (0, 2), (-1, 2), HexColor('#FFF3E0')),  # Medium risk row  
            ('BACKGROUND', (0, 3), (-1, 3), HexColor('#E8F5E8')),  # Low risk row
            
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 11),
            ('GRID', (0, 0), (-1, -1), 1, self.LIGHT_GRAY),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, self.LIGHT_BLUE])
        ]))
        
        self.story.append(table)
        self.story.append(Spacer(1, 30))
    
    def _calculate_percentage(self, risk_summary: Dict[str, int], risk_level: str) -> float:
        """Calculate percentage for risk level."""
        total = sum(risk_summary.values())
        if total == 0:
            return 0.0
        return (risk_summary.get(risk_level, 0) / total) * 100
    
    def add_document_insights(self):
        """Add professional document insights section."""
        self.story.append(Paragraph('Document Insights', self.styles['SectionHeading']))
        
        # Calculate metrics
        full_text = self.document_data.get('text', '') or ''
        word_count = len(full_text.split()) if full_text else 0
        clauses = self.document_data.get('clauses', [])
        clause_count = len(clauses)
        complexity_score = self._calculate_complexity_score(full_text, clauses)
        
        # Statistics table
        stats_data = [
            ['Metric', 'Value'],
            ['Word Count', f'{word_count:,} words'],
            ['Clause Count', f'{clause_count} clauses'],
            ['Complexity Score', f'{complexity_score}/10'],
            ['Contract Type', self.document_data.get('contract_type', 'Unknown').replace('_', ' ').title()]
        ]
        
        stats_table = Table(stats_data, colWidths=[2.5*inch, 2.5*inch])
        stats_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), self.PRIMARY_BLUE),
            ('TEXTCOLOR', (0, 0), (-1, 0), white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 11),
            ('GRID', (0, 0), (-1, -1), 1, self.LIGHT_GRAY),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, self.LIGHT_BLUE])
        ]))
        
        self.story.append(stats_table)
        self.story.append(Spacer(1, 20))
        
        # Analysis overview
        overview_text = """This document has been comprehensively analyzed using ClauseIQ's AI-powered legal analysis system. 
        The following sections provide detailed insights into the document's structure, key provisions, and potential risk areas."""
        
        overview_para = Paragraph(overview_text, self.styles['ProfessionalBody'])
        self.story.append(overview_para)
        self.story.append(PageBreak())
    
    def _calculate_complexity_score(self, full_text: str, clauses: List[Dict[str, Any]]) -> int:
        """Calculate document complexity score (1-10 scale)."""
        if not full_text:
            return 1
            
        try:
            word_count = len(full_text.split())
            clause_count = len(clauses)
            
            score = 1  # Base score
            
            # Length complexity
            if word_count > 5000:
                score += 3
            elif word_count > 2000:
                score += 2
            elif word_count > 1000:
                score += 1
            
            # Clause density
            if word_count > 0:
                clauses_per_thousand = (clause_count * 1000) / word_count
                if clauses_per_thousand > 20:
                    score += 3
                elif clauses_per_thousand > 15:
                    score += 2
                elif clauses_per_thousand > 10:
                    score += 1
            
            # Risk complexity
            risk_summary = self.document_data.get('risk_summary', {})
            score += min(3, risk_summary.get('high', 0))
            
            return min(10, max(1, score))
            
        except Exception:
            return 1
    
    def add_executive_summary(self):
        """Add executive summary section."""
        summary = (self.document_data.get('summary', '') or 
                  self.document_data.get('ai_structured_summary', {}).get('overview', '') or 
                  self.document_data.get('ai_full_summary', ''))
        
        if summary:
            self.story.append(Paragraph('Executive Summary', self.styles['SectionHeading']))
            summary_para = Paragraph(summary, self.styles['ProfessionalBody'])
            self.story.append(summary_para)
            self.story.append(Spacer(1, 20))
    
    def add_structured_sections(self):
        """Add structured summary sections."""
        structured_summary = self.document_data.get('ai_structured_summary', {})
        if not structured_summary:
            return
        
        sections = [
            ('key_parties', 'Key Parties', 'Key parties and stakeholders identified'),
            ('important_dates', 'Important Dates', 'Critical dates and deadlines'),
            ('major_obligations', 'Major Obligations', 'Key obligations and responsibilities'),
            ('risk_highlights', 'Risk Highlights', 'Risk areas requiring attention'),
            ('key_insights', 'Key Insights', 'Key legal insights and analysis')
        ]
        
        for key, title, description in sections:
            items = structured_summary.get(key, [])
            if items:
                self.story.append(Paragraph(title, self.styles['SectionHeading']))
                self.story.append(Paragraph(description, self.styles['SubHeading']))
                
                for item in items[:10]:  # Limit to 10 items
                    if item.strip():
                        bullet_text = f"• {item.strip()}"
                        item_para = Paragraph(bullet_text, self.styles['ListItem'])
                        self.story.append(item_para)
                
                self.story.append(Spacer(1, 15))
    
    def add_clause_analysis(self):
        """Add detailed clause analysis with professional formatting."""
        clauses = self.document_data.get('clauses', [])
        if not clauses:
            self.story.append(Paragraph('Clause Analysis', self.styles['SectionHeading']))
            no_analysis = Paragraph(
                'No detailed clause analysis available for this document. This may be due to the document format or content structure.',
                self.styles['ProfessionalBody']
            )
            self.story.append(no_analysis)
            return
        
        self.story.append(Paragraph('Detailed Clause Analysis', self.styles['SectionHeading']))
        
        for i, clause in enumerate(clauses):
            # Create clause block
            clause_elements = []
            
            # Clause header
            clause_type = clause.get('clause_type', 'Unknown').replace('_', ' ').title()
            clause_title = f"Clause {i+1}: {clause_type}"
            clause_elements.append(Paragraph(clause_title, self.styles['SubHeading']))
            
            # Risk level with color coding
            risk_level = clause.get('risk_level', 'unknown')
            if risk_level == 'high':
                risk_style = self.styles['HighRisk']
                risk_text = "⚠️ RISK LEVEL: HIGH"
            elif risk_level == 'medium':
                risk_style = self.styles['MediumRisk']
                risk_text = "⚡ RISK LEVEL: MEDIUM"
            else:
                risk_style = self.styles['LowRisk']
                risk_text = "✅ RISK LEVEL: LOW"
            
            clause_elements.append(Paragraph(risk_text, risk_style))
            clause_elements.append(Spacer(1, 10))
            
            # Summary
            summary = clause.get('summary', clause.get('risk_assessment', ''))
            if summary:
                clause_elements.append(Paragraph('<b>Summary:</b>', self.styles['ProfessionalBody']))
                summary_para = Paragraph(summary, self.styles['ProfessionalBody'])
                clause_elements.append(summary_para)
                clause_elements.append(Spacer(1, 10))
            
            # Recommendations
            recommendations = clause.get('recommendations', [])
            if recommendations:
                clause_elements.append(Paragraph('<b>Recommendations:</b>', self.styles['ProfessionalBody']))
                for rec in recommendations[:3]:  # Limit to 3 recommendations
                    if rec.strip():
                        rec_text = f"• {rec.strip()}"
                        rec_para = Paragraph(rec_text, self.styles['ListItem'])
                        clause_elements.append(rec_para)
                clause_elements.append(Spacer(1, 15))
            
            # Keep clause together on same page
            clause_block = KeepTogether(clause_elements)
            self.story.append(clause_block)
        
        self.story.append(PageBreak())
    
    def add_final_sections(self):
        """Add final summary and disclaimer sections."""
        # Document summary
        self.story.append(Paragraph('Document Analysis Summary', self.styles['SectionHeading']))
        
        # Key metrics summary
        filename = self.document_data.get('filename', 'Document')
        contract_type = self.document_data.get('contract_type', 'unknown').replace('_', ' ').title()
        full_text = self.document_data.get('text', '') or ''
        clauses = self.document_data.get('clauses', [])
        risk_summary = self.document_data.get('risk_summary', {})
        
        word_count = len(full_text.split()) if full_text else 0
        clause_count = len(clauses)
        total_risks = sum(risk_summary.values()) if risk_summary else 0
        
        summary_items = [
            f"Document Name: {filename}",
            f"Contract Type: {contract_type}",
            f"Total Word Count: {word_count:,} words",
            f"Total Clauses Analyzed: {clause_count}",
            f"Total Risk Items: {total_risks}",
            f"Analysis Date: {datetime.now().strftime('%B %d, %Y')}"
        ]
        
        for item in summary_items:
            item_para = Paragraph(f"• {item}", self.styles['ListItem'])
            self.story.append(item_para)
        
        self.story.append(Spacer(1, 20))
        
        # Completion note
        completion_text = """This document has been thoroughly analyzed using ClauseIQ's AI-powered legal analysis system. 
        The analysis includes comprehensive clause identification, risk assessment, and structured insights."""
        
        completion_para = Paragraph(completion_text, self.styles['ProfessionalBody'])
        self.story.append(completion_para)
        self.story.append(PageBreak())
        
        # Legal disclaimer
        self._add_legal_disclaimer()
    
    def _add_legal_disclaimer(self):
        """Add comprehensive legal disclaimer."""
        self.story.append(Paragraph('Legal Disclaimer', self.styles['SectionHeading']))
        
        disclaimer_sections = [
            {
                'title': 'NOT LEGAL ADVICE',
                'content': '''This report is generated by ClauseIQ's AI-powered legal document analysis system and is provided 
                for informational purposes only. The analysis, insights, and recommendations contained in this report do NOT 
                constitute legal advice and should not be relied upon as such.'''
            },
            {
                'title': 'PROFESSIONAL CONSULTATION REQUIRED',
                'content': '''Always consult with qualified legal professionals before making any decisions based on the analysis 
                in this report. Legal documents often contain nuances, jurisdiction-specific provisions, and complex 
                interdependencies that require human legal expertise to properly interpret.'''
            },
            {
                'title': 'AI LIMITATIONS',
                'content': '''While ClauseIQ's AI system is trained on extensive legal data, it has limitations and may not capture 
                all legal nuances, cannot account for jurisdiction-specific variations, may miss subtle legal implications, and 
                cannot replace human legal judgment.'''
            },
            {
                'title': 'CONFIDENTIALITY',
                'content': '''This report contains analysis of your confidential legal document. Ensure proper security measures 
                when sharing or storing this analysis.'''
            }
        ]
        
        for section in disclaimer_sections:
            self.story.append(Paragraph(f"<b>{section['title']}</b>", self.styles['SubHeading']))
            content_para = Paragraph(section['content'], self.styles['ProfessionalBody'])
            self.story.append(content_para)
            self.story.append(Spacer(1, 15))
        
        # Recommended actions
        self.story.append(Paragraph('<b>RECOMMENDED ACTIONS</b>', self.styles['SubHeading']))
        actions = [
            "Review this analysis with a qualified attorney",
            "Verify all identified dates, obligations, and risks",
            "Consider jurisdiction-specific legal requirements",
            "Obtain professional legal advice before acting on any provisions"
        ]
        
        for action in actions:
            action_para = Paragraph(f"• {action}", self.styles['ListItem'])
            self.story.append(action_para)
        
        self.story.append(Spacer(1, 20))
        
        # Footer
        footer_text = f"""Generated by ClauseIQ AI Legal Analysis System on {datetime.now().strftime('%B %d, %Y at %I:%M %p')}. 
        For support or questions about this analysis, please contact ClauseIQ support."""
        
        footer_para = Paragraph(footer_text, self.styles['Footer'])
        self.story.append(footer_para)
    
    def build_pdf(self) -> bytes:
        """Build and return the PDF as bytes."""
        # Create in-memory buffer
        buffer = io.BytesIO()
        
        # Create document
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=72,
            leftMargin=72,
            topMargin=100,
            bottomMargin=100
        )
        
        # Build PDF
        doc.build(self.story, onFirstPage=self._create_header_footer, onLaterPages=self._create_header_footer)
        
        # Get PDF bytes
        buffer.seek(0)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        
        return pdf_bytes


async def generate_pdf_report(document_data: Dict[str, Any]) -> bytes:
    """
    Generate a comprehensive PDF report for legal document analysis using ReportLab.
    
    Args:
        document_data: Document analysis data including filename, summary, clauses, etc.
        
    Returns:
        bytes: PDF file content
    """
    try:
        # Create PDF template
        template = LegalReportTemplate(document_data)
        
        # Build report sections
        template.add_title_page()
        template.add_document_insights()
        template.add_executive_summary()
        template.add_structured_sections()
        template.add_clause_analysis()
        template.add_final_sections()
        
        # Generate PDF
        return template.build_pdf()
        
    except Exception as e:
        print(f"Error generating ReportLab PDF report: {str(e)}")
        raise e


def create_simple_pdf_report(filename: str, summary: str) -> bytes:
    """
    Create a simple PDF report when full analysis data is not available.
    Uses ReportLab for consistent styling.
    
    Args:
        filename: Document filename
        summary: Document summary
        
    Returns:
        bytes: PDF file content
    """
    try:
        # Create minimal document data
        document_data = {
            'filename': filename,
            'summary': summary,
            'clauses': [],
            'risk_summary': {}
        }
        
        # Create template
        template = LegalReportTemplate(document_data)
        
        # Add basic sections
        template.add_title_page()
        
        # Add summary section
        if summary:
            template.story.append(Paragraph('Document Summary', template.styles['SectionHeading']))
            summary_para = Paragraph(summary, template.styles['ProfessionalBody'])
            template.story.append(summary_para)
            template.story.append(Spacer(1, 20))
        
        # Add simple disclaimer
        template.story.append(Paragraph('Disclaimer', template.styles['SectionHeading']))
        disclaimer_text = '''This report is generated by ClauseIQ AI. Please consult legal professionals for advice.
        This is a simplified report due to limited analysis data.'''
        disclaimer_para = Paragraph(disclaimer_text, template.styles['ProfessionalBody'])
        template.story.append(disclaimer_para)
        
        return template.build_pdf()
        
    except Exception as e:
        print(f"Error generating simple ReportLab PDF report: {str(e)}")
        raise e
