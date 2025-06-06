"""
Example API endpoints using shared types.
This module demonstrates how to use shared types in FastAPI endpoints.
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional

# Import shared types
import sys
import os
from pathlib import Path

# Add the shared directory to the Python path
shared_path = Path(__file__).parent.parent.parent / "shared"
sys.path.insert(0, str(shared_path))

from clauseiq_types.common import Clause, Section, ClauseType, RiskLevel

# Import the API schema utilities
from utils.api_schema import ApiSchema, CrudRouter

router = APIRouter(prefix="/api/v1", tags=["Example"])

# Create request/response models from shared types
CreateClauseRequest = ApiSchema.create_request_model(
    Clause, "CreateClauseRequest", exclude_fields=["id"])

ClauseResponse = ApiSchema.create_response_model(Clause, "ClauseResponse")

# Example endpoints using shared types
@router.post("/clauses", response_model=ClauseResponse)
async def create_clause(clause: CreateClauseRequest):
    """Create a new clause from shared type."""
    # Generate an ID and return the clause
    created_clause = Clause(
        id="new-clause-id",
        heading=clause.heading,
        text=clause.text,
        clause_type=clause.clause_type,
        risk_level=clause.risk_level,
        summary=clause.summary,
        risk_assessment=clause.risk_assessment,
        recommendations=clause.recommendations,
        key_points=clause.key_points,
        position_start=clause.position_start,
        position_end=clause.position_end
    )
    return created_clause

@router.get("/clauses", response_model=List[ClauseResponse])
async def list_clauses(
    clause_type: Optional[ClauseType] = None,
    risk_level: Optional[RiskLevel] = None
):
    """List clauses with optional filtering by type and risk level."""
    # This is just a demonstration, in a real app we'd query a database
    clauses = [
        Clause(
            id="example-1",
            heading="Example Clause",
            text="This is an example clause.",
            clause_type=ClauseType.GENERAL,
            risk_level=RiskLevel.LOW
        )
    ]
    
    # Filter by clause_type if provided
    if clause_type:
        clauses = [c for c in clauses if c.clause_type == clause_type]
    
    # Filter by risk_level if provided
    if risk_level:
        clauses = [c for c in clauses if c.risk_level == risk_level]
    
    return clauses

# Example of using the CrudRouter with shared types
sections_router = CrudRouter(
    model=Section,
    router=router,
    prefix="/sections",
    tags=["Sections"]
)
