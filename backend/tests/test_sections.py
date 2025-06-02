import pytest
import sys
import os

# Add the parent directory to the path so we can import from main
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import extract_sections, Section


class TestSectionExtraction:
    """Test document section extraction functionality."""

    def test_extract_sections_with_headers(self):
        """Test extracting sections from text with clear headers."""
        text = """1. EMPLOYMENT TERMS
This section covers the basic terms of employment.

2. COMPENSATION
Details about salary and benefits.

3. TERMINATION
Conditions for ending employment."""
        
        sections = extract_sections(text)
        
        assert len(sections) == 3
        assert sections[0].heading == "1. EMPLOYMENT TERMS"
        assert "basic terms of employment" in sections[0].text
        assert sections[1].heading == "2. COMPENSATION"
        assert "salary and benefits" in sections[1].text
        assert sections[2].heading == "3. TERMINATION"
        assert "ending employment" in sections[2].text

    def test_extract_sections_with_colon_headers(self):
        """Test extracting sections with colon-style headers."""
        text = """Employment Terms:
Basic information about the job.

Compensation Package:
Salary and benefit details.

Termination Clause:
How employment can be ended."""
        
        sections = extract_sections(text)
        
        assert len(sections) >= 1  # Should find at least one section
        # Check that headers with colons are recognized
        headings = [section.heading for section in sections]
        assert any("Employment Terms:" in heading for heading in headings)

    def test_extract_sections_no_headers(self):
        """Test extracting sections from text without clear headers."""
        text = """This is a simple document without any clear section headers.
It should be treated as a single section with all the content."""
        
        sections = extract_sections(text)
        
        assert len(sections) == 1
        assert sections[0].heading == "Full Document"
        assert text in sections[0].text

    def test_extract_sections_empty_text(self):
        """Test extracting sections from empty text."""
        text = ""
        
        sections = extract_sections(text)
        
        assert len(sections) == 1
        assert sections[0].heading == "Full Document"
        assert sections[0].text == ""

    def test_extract_sections_whitespace_handling(self):
        """Test that sections handle whitespace correctly."""
        text = """1. FIRST SECTION   
   
   Content with extra whitespace.
   
   
2. SECOND SECTION   
   
   More content here.   """
        
        sections = extract_sections(text)
        
        assert len(sections) == 2
        # Check that whitespace is stripped appropriately
        assert sections[0].heading.strip() == "1. FIRST SECTION"
        assert "Content with extra whitespace." in sections[0].text
        assert sections[1].heading.strip() == "2. SECOND SECTION"

    def test_section_model_validation(self):
        """Test that Section model works correctly."""
        section = Section(
            heading="Test Section",
            text="Test content",
            summary="Test summary"
        )
        
        assert section.heading == "Test Section"
        assert section.text == "Test content"
        assert section.summary == "Test summary"

    def test_section_model_optional_summary(self):
        """Test that Section model works without summary."""
        section = Section(
            heading="Test Section",
            text="Test content"
        )
        
        assert section.heading == "Test Section"
        assert section.text == "Test content"
        assert section.summary is None

    def test_extract_sections_complex_document(self):
        """Test extracting sections from a more complex legal document."""
        text = """EMPLOYMENT AGREEMENT

1. PARTIES TO THE AGREEMENT
This agreement is between Company XYZ and Employee ABC.

2. POSITION AND DUTIES
Employee will serve as Software Engineer with the following responsibilities:
- Develop software applications
- Maintain existing systems
- Collaborate with team members

3. COMPENSATION AND BENEFITS
3.1 Base Salary: $100,000 per year
3.2 Health Insurance: Company provides full coverage
3.3 Vacation: 20 days per year

4. TERMINATION
Either party may terminate this agreement with 30 days notice."""
        
        sections = extract_sections(text)
        
        # Should find the numbered sections
        assert len(sections) >= 4
        
        # Check that we capture multi-line content properly
        position_section = next((s for s in sections if "POSITION" in s.heading), None)
        assert position_section is not None
        assert "Software Engineer" in position_section.text
        assert "Develop software applications" in position_section.text
