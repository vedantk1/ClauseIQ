"""Explicit paid actions; content validation errors never echo input."""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field
from models.library_search import LibrarySearchRequest


class IndexRequest(BaseModel):
    request_id: UUID
    fingerprint: str = Field(pattern=r"^[0-9a-f]{64}$")
    expected_generation: str | None = None
    confirm_paid: Literal[True]


class SemanticSearchRequest(LibrarySearchRequest):
    request_id: UUID
    confirm_paid: Literal[True]


class RemoveIndexRequest(BaseModel):
    expected_generation: str
