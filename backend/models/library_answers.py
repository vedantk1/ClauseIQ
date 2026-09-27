"""Strict local Library-answer dispatch and generated-output contracts."""

from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class AnswerModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class PreviewAnswer(AnswerModel):
    context_id: UUID


class StartAnswer(PreviewAnswer):
    request_id: UUID
    model_id: str = Field(min_length=1, max_length=100)
    reasoning_effort: str = Field(min_length=1, max_length=20)
    confirm_paid: Literal[True]


class AnswerStatement(AnswerModel):
    text: str = Field(min_length=1, max_length=2000)
    evidence_ids: list[Annotated[str, Field(min_length=1, max_length=10)]] = Field(min_length=1, max_length=8)


class GeneratedLibraryAnswer(AnswerModel):
    outcome: Literal["answered", "partial", "insufficient_evidence"]
    statements: list[AnswerStatement] = Field(max_length=12)
    limitations: list[Annotated[str, Field(min_length=1, max_length=1000)]] = Field(max_length=12)

    @model_validator(mode="after")
    def meaningful_content(self):
        if any(not item.text.strip() or len(set(item.evidence_ids)) != len(item.evidence_ids) for item in self.statements):
            raise ValueError("Statements must be nonblank with distinct references")
        if any(not item.strip() for item in self.limitations):
            raise ValueError("Limitations must be nonblank")
        if self.outcome == "insufficient_evidence":
            if self.statements or not self.limitations:
                raise ValueError("Insufficient evidence requires limitations, not unsupported statements")
        elif not self.statements:
            raise ValueError("An answer requires statements")
        if self.outcome == "partial" and not self.limitations:
            raise ValueError("Partial answers must identify missing information")
        return self
