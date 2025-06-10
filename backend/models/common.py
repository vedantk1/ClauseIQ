"""
Common models and enums used across the application.
This file now re-exports the shared types from the shared/types package.
"""
from typing import List, Optional, Dict, Any
import uuid
import sys
import os
from pathlib import Path

# Add the shared directory to the Python path
shared_path = Path(__file__).parent.parent.parent / "shared"
sys.path.insert(0, str(shared_path))

# Import shared types
from clauseiq_types.common import (
    ClauseType,
    RiskLevel,
    ContractType,
    Section as SharedSection,
    Clause as SharedClause,
    RiskSummary,
    User as SharedUser,
    UserPreferences,
    AvailableModel,
)

# Re-export the shared types
__all__ = [
    "ClauseType",
    "RiskLevel", 
    "ContractType",
    "Section", 
    "Clause", 
    "RiskSummary",
    "User",
    "UserPreferences",
    "AvailableModel",
]

# Add any extensions or customizations needed for backend-specific functionality
from pydantic import BaseModel, Field

# We subclass the shared models to add any backend-specific functionality
class Section(SharedSection):
    """Extends the shared Section model for backend-specific functionality."""
    pass

class Clause(SharedClause):
    """Extends the shared Clause model for backend-specific functionality."""
    # Override the id field to use UUID generation if not provided
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
