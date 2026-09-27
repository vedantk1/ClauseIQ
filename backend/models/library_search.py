"""Bounded, source-backed Library search contracts."""

from pydantic import BaseModel, Field, field_validator


class LibrarySearchRequest(BaseModel):
    query: str = Field(min_length=2, max_length=200)
    limit: int = Field(default=20, ge=1, le=30)

    @field_validator("query")
    @classmethod
    def meaningful_query(cls, value: str) -> str:
        query = value.strip()
        if len(query) < 2 or not any(character.isalnum() for character in query):
            raise ValueError(
                "Enter at least two characters including a letter or number"
            )
        return query


class LibrarySearchHit(BaseModel):
    document_id: str
    filename: str
    source_revision_id: str
    page_number: int = Field(ge=1)
    passage_id: str
    excerpt: str
    excerpt_partial: bool
    source_incomplete: bool


class LibrarySearchCoverage(BaseModel):
    documents_in_library: int = Field(ge=0)
    documents_scanned: int = Field(ge=0)
    documents_not_examined: int = Field(ge=0)
    documents_searchable: int = Field(ge=0)
    documents_unsearchable: int = Field(ge=0)
    documents_partial: int = Field(ge=0)
    passages_examined: int = Field(ge=0)
    matched_passages: int = Field(ge=0)
    results_truncated: bool
    scan_truncated: bool


class LibrarySearchResponse(BaseModel):
    results: list[LibrarySearchHit]
    coverage: LibrarySearchCoverage
    answer_context_id: str | None = None
    trace: dict | None = None
