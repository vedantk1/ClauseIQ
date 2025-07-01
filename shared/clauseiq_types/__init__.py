"""
Shared types for ClauseIQ.
"""
from .common import *
from .highlights import *

__all__ = [
    'ClauseType', 
    'RiskLevel',
    'Section',
    'Clause',
    'RiskSummary',
    'User',
    'UserPreferences',
    'AvailableModel',
    # Highlight types
    'HighlightArea',
    'Highlight',
    'CreateHighlightRequest',
    'UpdateHighlightRequest',
    'HighlightResponse',
    'HighlightListResponse'
]
