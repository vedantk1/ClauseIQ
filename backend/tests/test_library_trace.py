"""Stage telemetry must stay content-free and preserve old-record compatibility."""

import asyncio
import json
import logging
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from starlette.requests import Request

from middleware.request_context import request_context
from services.library_search import LibrarySearchService
from services.library_trace import LibraryTrace, safe_trace
from tests.test_library_search import source_document


@pytest.mark.parametrize("extra", [{"question": "private"}, {"error": "private"},
                                   {"model_id": "private"}, {"trace_id": "private"},
                                   {"source_index_fingerprint": "private"}])
def test_allowlist_rejects_content_in_unknown_or_known_fields(extra, caplog):
    trace = LibraryTrace("answer")
    trace.fields.update(extra)
    with caplog.at_level(logging.INFO):
        assert trace.finish("failed") is None
    assert "private" not in caplog.text


@pytest.mark.parametrize("value", [None, {}, "old", [], {"version": "obsolete"}])
def test_missing_old_or_corrupt_diagnostics_are_optional(value):
    assert safe_trace(value) is None


def test_usage_allowlist_ignores_prompt_evidence_metadata(caplog):
    trace = LibraryTrace("answer", "keyword")
    trace.generation({"model_id": "gpt-6-sol", "reasoning_effort": "medium", "prompt": "private",
                      "usage": {"prompt_tokens": 12, "completion_tokens": 3, "secret": "private"}})
    with trace.stage("generation_ms"):
        pass
    with caplog.at_level(logging.INFO):
        result = trace.finish("completed")
    assert result["prompt_tokens"] == 12 and result["completion_tokens"] == 3
    assert result["generation_ms"] >= 0 and "private" not in caplog.text
    assert json.loads(caplog.records[-1].message.removeprefix("library_stage ")) == result


@pytest.mark.asyncio
async def test_concurrent_server_request_ids_do_not_cross_or_trust_client_ids():
    async def make():
        request = Request({"type": "http", "headers": [(b"x-request-id", b"private")]})
        with request_context(request) as identity:
            await asyncio.sleep(0)
            return identity, LibraryTrace("retrieval").snapshot("completed")
    first, second = await asyncio.gather(make(), make())
    assert first[0] != second[0]
    for identity, trace in (first, second):
        assert trace["http_request_id"] == identity
    assert LibraryTrace("retrieval").snapshot("completed")["http_request_id"] is None


@pytest.mark.asyncio
async def test_keyword_success_and_failure_diagnostics_never_log_source(caplog):
    documents = SimpleNamespace(list_source_snapshots_for_search=AsyncMock(return_value=(1, [source_document("doc")])))
    # Use the actual service's repository boundary, not a pure ranking result.
    with caplog.at_level(logging.INFO):
        result = await LibrarySearchService(documents).search("local", "payment")
    assert result.trace["method"] == "keyword" and not result.trace["provider_started"]
    assert result.trace["returned_passages"] == len(result.results)
    assert "Payment is" not in caplog.text
    documents.list_source_snapshots_for_search.side_effect = RuntimeError("PRIVATE_ERROR")
    with caplog.at_level(logging.INFO), pytest.raises(RuntimeError):
        await LibrarySearchService(documents).search("local", "PRIVATE_QUERY")
    assert "PRIVATE_" not in caplog.text
    assert json.loads(caplog.records[-1].message.removeprefix("library_stage "))["status"] == "failed_or_unknown"
