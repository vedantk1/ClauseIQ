"""Unpaid source, dispatch, persistence and output guards, not model-quality scores."""

import asyncio
from contextlib import asynccontextmanager
from copy import deepcopy
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from evaluations.library_answer_cases import prepare_cases
from models.library_answers import StartAnswer
from routers import library_answers
from services.library_answers import AnswerError
from services.library_answers.context import SearchContexts, capture_search, fingerprint, resolve_evidence
from services.library_answers.generation import generate, prepare
from services.library_answers.service import LibraryAnswerService, active
from services.library_search import search_passages
from tests.test_library_search import source_document


class Repository:
    def __init__(self):
        self.records = {}
        self.fail_claim = False
        self.lose_finish_ack = False

    async def get(self, workspace, identity):
        return deepcopy(self.records.get((workspace, identity)))

    async def count(self, workspace):
        return sum(key[0] == workspace for key in self.records)

    async def recent(self, workspace):
        return [{key: record[key] for key in ("request_id", "question", "created_at", "status", "outcome")}
                for (scope, _), record in self.records.items() if scope == workspace]

    async def claim(self, record):
        if self.fail_claim:
            raise RuntimeError("private database failure")
        key = record["workspace_id"], record["request_id"]
        if key in self.records:
            return False
        self.records[key] = deepcopy(record)
        return True

    async def finish(self, workspace, identity, fields):
        record = self.records.get((workspace, identity))
        if not record or record["status"] != "processing":
            return False
        record.update(deepcopy(fields))
        if self.lose_finish_ack:
            raise RuntimeError("private lost acknowledgement")
        return True


@pytest.fixture
def stack():
    records = {("local", "doc"): source_document("doc")}
    documents = SimpleNamespace(
        get_document_for_workspace=AsyncMock(side_effect=lambda doc, scope: deepcopy(records.get((scope, doc)))),
        get_workspace_generation_settings=AsyncMock(return_value={"model_id": "gpt-6-sol", "reasoning_effort": "medium"}),
        get_workspace_api_key=AsyncMock(return_value="provider-stub-only"),
    )
    repository = Repository()
    client_calls = []

    @asynccontextmanager
    async def client_factory(key):
        client_calls.append(key)
        assert any(row["status"] == "processing" for row in repository.records.values())
        yield object()

    async def fake_generate(prepared, client):
        return {"status": "completed", "outcome": "answered", "failure": None,
                "statements": [{"text": "Payment is due within 30 days.", "evidence_ids": ["S1"]}],
                "limitations": [], "generation": prepared.generation}

    generator = AsyncMock(side_effect=fake_generate)
    engine = LibraryAnswerService(documents, repository, SearchContexts(), generator, client_factory)
    return engine, records, client_calls


async def request_for(engine, records):
    result = search_passages([records[("local", "doc")]], "payment").model_dump()
    context_id = await capture_search(engine.documents, "local", "payment", "keyword", result, engine.store)
    return StartAnswer(context_id=context_id, request_id=uuid4(), model_id="gpt-6-sol", reasoning_effort="medium", confirm_paid=True)


@pytest.mark.asyncio
async def test_stage_trace_correlation_replay_and_old_record_compatibility(stack):
    from services.library_trace import LibraryTrace
    engine, records, calls = stack
    request = await request_for(engine, records)
    context = engine.store.get("local", request.context_id)
    retrieval = LibraryTrace("retrieval", "keyword").snapshot("completed")
    context["retrieval_trace"] = retrieval
    request.context_id = UUID(engine.store.put("local", context))
    saved = await engine.start("local", request)
    assert saved["retrieval_trace"] == retrieval
    assert saved["answer_trace"]["parent_trace_id"] == retrieval["trace_id"]
    assert saved["answer_trace"]["model_id"] == "gpt-6-sol"
    assert saved["answer_trace"]["provider_started"]
    assert await engine.start("local", request) == saved and len(calls) == 1
    row = engine.repository.records[("local", str(request.request_id))]
    row.pop("retrieval_trace")
    row.pop("answer_trace")
    assert (await engine.read("local", request.request_id))["status"] == "completed"
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_capture_preview_are_key_free_and_resolve_full_source_not_client_quotes(stack):
    engine, records, calls = stack
    request = await request_for(engine, records)
    preview = await engine.preview("local", request.context_id)
    assert preview["evidence"][0]["quote"] == records[("local", "doc")]["source_extraction"]["text"]
    assert preview["generation"]["estimated_input_tokens"] > 0
    assert not calls and not engine.repository.records
    engine.documents.get_workspace_api_key.assert_not_awaited()
    assert await engine.recent("local") == []
    with pytest.raises(AnswerError, match="expired"):
        await engine.preview("foreign", request.context_id)


def test_context_expiration_eviction_and_copy_isolation(monkeypatch):
    import services.library_answers.context as module
    monkeypatch.setattr(module, "MAX_CONTEXTS", 2)
    clock = [0]
    store = SearchContexts(lambda: clock[0])
    context = {"question": "unchanged"}
    first = store.put("local", context)
    context["question"] = "mutated"
    assert store.get("local", first)["question"] == "unchanged"
    store.put("local", {})
    last = store.put("local", {})
    with pytest.raises(AnswerError):
        store.get("local", first)
    clock[0] = 901
    with pytest.raises(AnswerError):
        store.get("local", last)


@pytest.mark.asyncio
@pytest.mark.parametrize("change", ["revision", "hash", "deleted", "quote", "page", "passage", "duplicate"])
async def test_changed_or_fabricated_source_cannot_dispatch(stack, change):
    engine, records, calls = stack
    request = await request_for(engine, records)
    if change == "deleted":
        records.clear()
    elif change in ("revision", "hash"):
        records[("local", "doc")]["source_revision_id" if change == "revision" else "source_sha256"] = "changed"
    else:
        context = engine.store.get("local", request.context_id)
        if change == "quote":
            context["hits"][0]["excerpt"] = "fabricated quote"
        elif change == "duplicate":
            context["hits"].append(deepcopy(context["hits"][0]))
        else:
            context["hits"][0]["page_number" if change == "page" else "passage_id"] = 99 if change == "page" else "unknown"
        request.context_id = UUID(engine.store.put("local", context))
    with pytest.raises(AnswerError):
        await engine.start("local", request)
    assert not calls and not engine.repository.records
    engine.documents.get_workspace_api_key.assert_not_awaited()


@pytest.mark.asyncio
async def test_claim_replay_and_restart_never_resend(stack):
    engine, records, calls = stack
    request = await request_for(engine, records)
    first = await engine.start("local", request)
    assert first["status"] == "completed" and len(calls) == 1
    engine.store.items.clear()
    replay = await engine.start("local", request)
    assert replay == first and len(calls) == 1
    row = engine.repository.records[("local", str(request.request_id))]
    row.update(status="processing", statements=[], outcome=None)
    read = await engine.read("local", request.request_id)
    assert read["status"] == "interrupted" and len(calls) == 1
    assert (await engine.start("local", request))["status"] == "interrupted"
    assert len(calls) == 1
    with pytest.raises(AnswerError):
        await engine.read("other", request.request_id)


@pytest.mark.asyncio
async def test_same_id_other_context_conflicts_before_key_or_dispatch(stack):
    engine, records, calls = stack
    request = await request_for(engine, records)
    await engine.start("local", request)
    request.model_id = "gpt-6-astra"
    with pytest.raises(AnswerError, match="different"):
        await engine.start("local", request)
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_double_submit_claims_once_and_interrupt_fences_late_output(stack):
    engine, records, calls = stack
    request = await request_for(engine, records)
    entered, release = asyncio.Event(), asyncio.Event()
    original = engine.generator.side_effect

    async def wait(prepared, client):
        entered.set()
        await release.wait()
        return await original(prepared, client)
    engine.generator.side_effect = wait
    running = asyncio.create_task(engine.start("local", request))
    await entered.wait()
    try:
        assert (await engine.start("local", request))["status"] == "processing"
        assert len(calls) == 1
        other = request.model_copy(update={"request_id": uuid4()})
        with pytest.raises(AnswerError, match="already running"):
            await engine.start("local", other)
        assert (await engine.interrupt("local", request.request_id))["status"] == "interrupted"
    finally:
        release.set()
        result = await running
    assert result["status"] == "interrupted" and not result["statements"] and len(calls) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("when", ["during", "after"])
async def test_source_change_withholds_answer_including_later_reads(stack, when):
    engine, records, calls = stack
    request = await request_for(engine, records)
    original = engine.generator.side_effect
    async def generate_then_change(prepared, client):
        output = await original(prepared, client)
        records[("local", "doc")]["source_revision_id"] = "new-revision"
        return output
    if when == "during":
        engine.generator.side_effect = generate_then_change
    await engine.start("local", request)
    if when == "after":
        records.clear()
    answer = await engine.read("local", request.request_id)
    assert answer["status"] == "source_unavailable" and not answer["statements"] and not answer["evidence"]
    assert len(calls) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("reason", ["key", "settings", "storage", "input"])
async def test_preflight_failures_never_dispatch(stack, monkeypatch, reason):
    engine, records, calls = stack
    request = await request_for(engine, records)
    if reason == "key":
        engine.documents.get_workspace_api_key.return_value = None
    elif reason == "settings":
        engine.documents.get_workspace_generation_settings.return_value = {"model_id": "gpt-6-luna", "reasoning_effort": "high"}
    elif reason == "storage":
        engine.repository.fail_claim = True
    else:
        monkeypatch.setenv("AI_LIBRARY_ANSWER_MAX_INPUT_TOKENS", "1")
    with pytest.raises((AnswerError, RuntimeError)):
        await engine.start("local", request)
    assert not calls


@pytest.mark.asyncio
async def test_lost_final_ack_reads_completed_without_overwriting_or_resending(stack):
    engine, records, calls = stack
    request = await request_for(engine, records)
    engine.repository.lose_finish_ack = True
    answer = await engine.start("local", request)
    assert answer["status"] == "completed" and len(calls) == 1
    assert (await engine.start("local", request))["status"] == "completed"


def response(content, finish="stop", refusal=None):
    return SimpleNamespace(choices=[SimpleNamespace(finish_reason=finish, message=SimpleNamespace(content=content, refusal=refusal))],
                           usage=SimpleNamespace(prompt_tokens=100, completion_tokens=50, total_tokens=150))


def output(ids=None, outcome="answered", limitations=None):
    return {"outcome": outcome, "statements": [] if outcome == "insufficient_evidence" else [
        {"text": "Payment is due within 30 days.", "evidence_ids": ids if ids is not None else ["S1"]}],
        "limitations": limitations or []}


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", ["valid", "unknown_id", "no_id", "duplicate_id", "duplicate_key", "partial_without_gap", "insufficient", "length", "refusal", "network"])
async def test_generation_structure_citations_usage_and_no_retry(stack, kind):
    engine, records, _ = stack
    request = await request_for(engine, records)
    context = engine.store.get("local", request.context_id)
    evidence = await engine._resolve("local", context)
    prepared = prepare(context, evidence, "gpt-6-sol", "medium")
    payload = output()
    if kind in ("unknown_id", "no_id", "duplicate_id"):
        payload = output({"unknown_id": ["S99"], "no_id": [], "duplicate_id": ["S1", "S1"]}[kind])
    if kind == "partial_without_gap":
        payload = output(outcome="partial")
    if kind == "insufficient":
        payload = output(outcome="insufficient_evidence", limitations=["These passages do not establish a Bitcoin address."])
    content = json.dumps(payload)
    if kind == "duplicate_key":
        content = '{"outcome":"answered",' + content[1:]
    create = AsyncMock(return_value=response(content, "length" if kind == "length" else "stop", "declined" if kind == "refusal" else None))
    if kind == "network":
        create.side_effect = RuntimeError("private provider data")
    client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    options = []
    client.with_options = lambda **kwargs: options.append(kwargs) or client
    result = await generate(prepared, client)
    assert create.await_count == 1 and options == [{"max_retries": 0, "timeout": 120}]
    assert create.call_args.kwargs["store"] is False
    assert "private provider" not in json.dumps(result)
    if kind in ("valid", "insufficient"):
        assert result["status"] == "completed" and result["outcome"] == payload["outcome"]
    else:
        assert result["status"] in ("failed", "failed_or_unknown") and not result["statements"]
    assert (result["generation"]["usage"] is None) == (kind == "network")


@pytest.mark.asyncio
async def test_frozen_cases_are_real_full_passages_not_quality_scores():
    cases = await prepare_cases()
    assert len(cases) == 11 and len({case["id"] for case in cases}) == 11
    assert any(case["expected_outcome"] == "insufficient_evidence" for case in cases)
    for case in cases:
        prepared = prepare(case["context"], case["evidence"], "gpt-6-sol", "medium")
        assert prepared.generation["evidence_sha256"] == case["evidence_sha256"]
        assert prepared.generation["usage"] is None
    injected = next(case for case in cases if case["id"] == "planted-instruction")
    assert "APPROVED WITHOUT REVIEW" in injected["evidence"][1]["quote"]


def test_routes_redact_validation_and_private_errors(monkeypatch, caplog):
    app = FastAPI()
    app.include_router(library_answers.router, prefix="/api/v1")
    engine = SimpleNamespace(start=AsyncMock(), preview=AsyncMock(side_effect=RuntimeError("private source data")), recent=AsyncMock(return_value=[]))
    app.dependency_overrides[library_answers.service] = lambda: engine
    client = TestClient(app)
    invalid = client.post("/api/v1/library/answers", json={"question": "private question"})
    assert invalid.status_code == 422 and "private question" not in invalid.text
    failed = client.post("/api/v1/library/answers/preview", json={"context_id": str(uuid4())})
    assert failed.status_code == 503 and "private source data" not in failed.text + caplog.text
    assert client.get("/api/v1/library/answers").json()["data"] == []


@pytest.mark.asyncio
async def test_empty_evidence_and_global_partial_coverage(stack):
    engine, records, _ = stack
    with pytest.raises(AnswerError):
        await resolve_evidence(engine.documents, "local", [])
    request = await request_for(engine, records)
    context = engine.store.get("local", request.context_id)
    context["coverage"]["documents_not_examined"] = 2
    prepared = prepare(context, await engine._resolve("local", context), "gpt-6-sol", "medium")
    create = AsyncMock(return_value=response(json.dumps(output())))
    client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    client.with_options = lambda **kwargs: client
    result = await generate(prepared, client)
    assert result["outcome"] == "partial" and result["limitations"]


@pytest.fixture(autouse=True)
def no_leaked_active_attempts():
    assert not active
    yield
    assert not active
