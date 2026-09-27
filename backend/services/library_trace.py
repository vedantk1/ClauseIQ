"""Content-free Library stage diagnostics; no external telemetry destination."""

from contextlib import contextmanager
import json
import logging
import time
from typing import Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field

from middleware.request_context import current_request_id
from models.library_search import LibrarySearchCoverage

logger = logging.getLogger(__name__)
VERSION = "library-stage-trace-v1"


class TraceRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")
    version: Literal["library-stage-trace-v1"] = VERSION
    trace_id: UUID
    http_request_id: UUID | None = None
    parent_trace_id: UUID | None = None
    operation: Literal["retrieval", "answer"]
    pipeline_version: Literal["library-keyword-v1", "library-semantic-v1", "library-answer-v1"] | None = None
    passage_version: Literal["source-passages-v1"] = "source-passages-v1"
    method: Literal["keyword", "semantic"] | None = None
    status: Literal["processing", "completed", "failed", "failed_or_unknown", "interrupted", "source_unavailable"]
    answer_outcome: Literal["answered", "partial", "insufficient_evidence"] | None = None
    duration_ms: int = Field(ge=0)
    embedding_ms: int | None = Field(default=None, ge=0)
    vector_search_ms: int | None = Field(default=None, ge=0)
    generation_ms: int | None = Field(default=None, ge=0)
    provider_started: bool = False
    replayed: bool = False
    returned_passages: int | None = Field(default=None, ge=0)
    coverage: LibrarySearchCoverage | None = None
    source_index_fingerprint: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")
    model_id: Literal["gpt-6-luna", "gpt-6-sol", "gpt-6-astra", "text-embedding-3-small"] | None = None
    reasoning_effort: Literal["none", "minimal", "low", "medium", "high", "xhigh", "max", "ultra"] | None = None
    embedding_tokens: int | None = Field(default=None, ge=0)
    prompt_tokens: int | None = Field(default=None, ge=0)
    completion_tokens: int | None = Field(default=None, ge=0)


def safe_trace(value):
    """A corrupted/old diagnostic must not disable source reading or generation."""
    try:
        return TraceRecord.model_validate(value).model_dump(mode="json")
    except (ValueError, TypeError):
        return None


class LibraryTrace:
    def __init__(self, operation, method=None):
        self.started = time.perf_counter()
        self.fields = {"trace_id": str(uuid4()), "http_request_id": current_request_id(),
                       "operation": operation, "method": method,
                       "pipeline_version": {"keyword": "library-keyword-v1", "semantic": "library-semantic-v1"}.get(method)}

    @contextmanager
    def stage(self, name):
        if name not in ("embedding_ms", "vector_search_ms", "generation_ms"):
            raise ValueError("Unknown diagnostic stage")
        started = time.perf_counter()
        try:
            yield
        finally:
            self.fields[name] = max(0, int((time.perf_counter() - started) * 1000))

    def generation(self, metadata):
        self.fields.update(model_id=metadata.get("model_id"), reasoning_effort=metadata.get("reasoning_effort"))
        self.fields["pipeline_version"] = metadata.get("prompt_version")
        usage = metadata.get("usage") or {}
        self.fields.update(prompt_tokens=usage.get("prompt_tokens"), completion_tokens=usage.get("completion_tokens"))

    def snapshot(self, status):
        return safe_trace({**self.fields, "status": status,
                           "duration_ms": max(0, int((time.perf_counter() - self.started) * 1000))})

    def finish(self, status):
        result = self.snapshot(status)
        if result is not None:
            # Only the strict allowlist reaches logs; no raw error/metadata text.
            logger.info("library_stage %s", json.dumps(result, separators=(",", ":")))
        return result
