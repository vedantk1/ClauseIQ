"""Unpaid harness guards; provider stubs establish mechanics, never quality."""

import asyncio
from contextlib import asynccontextmanager
from copy import deepcopy
from datetime import date
from decimal import Decimal
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from evaluations import library_quality_live as live
from evaluations import library_quality_retrieval as retrieval
from evaluations.retrieval_embeddings import EmbeddingInput, write_exclusive


@pytest.fixture(autouse=True)
def no_provider_and_fixed_price(monkeypatch):
    class FixedDate(date):
        @classmethod
        def today(cls):
            return cls(2026, 9, 27)
    monkeypatch.setattr(live, "date", FixedDate)
    monkeypatch.setattr("openai.AsyncOpenAI", lambda *a, **k: pytest.fail("Real provider forbidden"))
    monkeypatch.delenv("OPENAI_BASE_URL", raising=False)


@pytest.fixture
def answers():
    coverage = {"documents_in_library": 1, "documents_scanned": 1, "documents_not_examined": 0,
                "documents_searchable": 1, "documents_unsearchable": 0, "documents_partial": 0,
                "passages_examined": 1, "matched_passages": 1, "results_truncated": False,
                "scan_truncated": False}
    evidence = [{"id": "S1", "document_id": "synthetic", "source_revision_id": "synthetic-revision",
                 "filename": "synthetic.pdf", "page_number": 1, "passage_id": "p1_b1_v1",
                 "text": "Payment is due within 30 days of receipt."}]
    jobs = []
    for number in range(4):
        case = {"id": f"synthetic-{number}", "criteria": ["LABEL_ONLY_SENTINEL"],
                "expected_outcome": "insufficient_evidence", "evidence": evidence,
                "context": {"question": "What is the cryptocurrency payment address?",
                            "method": "keyword", "coverage": coverage}}
        for effort in live.EFFORTS:
            jobs.append((case, effort, live.prepare(case["context"], evidence, "gpt-6-sol", effort)))
    manifest = {"version": "library-quality-effort-v2", "model": "gpt-6-sol",
                "efforts": list(live.EFFORTS), "reserved_usd": "1.68", "price_verified_on": live.PRICE_DATE,
                "jobs": [{"case": case["id"], "effort": effort, "criteria_sha256": live.digest(case["criteria"]),
                          "expected_outcome": case["expected_outcome"], "evidence_sha256": live.digest(case["evidence"]),
                          "request_sha256": live.digest(live.expected_request(item))} for case, effort, item in jobs]}
    return jobs, manifest


@pytest.fixture
def embeddings():
    inputs = {"synthetic-a": EmbeddingInput("synthetic-a", "passage", "Synthetic source text.", 4),
              "synthetic-b": EmbeddingInput("synthetic-b", "query", "Synthetic question?", 3)}
    batches = [[key] for key in inputs]
    manifest = {"version": retrieval.VERSION, "profiles": {
        name: {"model": model, "dimensions": dimensions, "usd_per_million": str(price)}
        for name, (model, dimensions, price) in live.PROFILES.items()},
        "inputs": [{"key": key, "text_sha256": live.digest(item.text), "tokens": item.tokens}
                   for key, item in inputs.items()], "batches": batches,
        "reserved_usd": str(Decimal(len(inputs) * live.MAX_INPUT_TOKENS) * Decimal("0.13") / 1_000_000)}
    return retrieval.RetrievalPlan({}, inputs, batches, manifest)


def answer_response(*, usage=True, excessive=False):
    prompt = 33_000 if excessive else 100
    return SimpleNamespace(choices=[SimpleNamespace(finish_reason="stop", message=SimpleNamespace(
        refusal=None, content=json.dumps({"outcome": "insufficient_evidence", "statements": [],
                                         "limitations": ["No address is present in the supplied evidence."]})))],
        usage=SimpleNamespace(prompt_tokens=prompt, completion_tokens=5, total_tokens=prompt + 5) if usage else None)


def embedding_response(count=1):
    return SimpleNamespace(model="text-embedding-3-large", data=[SimpleNamespace(
        index=index, embedding=[1.0] + [0.0] * 3071) for index in range(count)],
        usage=SimpleNamespace(prompt_tokens=count * 4, total_tokens=count * 4))


def client_for(create, embedding_create=None):
    client = SimpleNamespace(base_url=live.ENDPOINT, max_retries=0,
        chat=SimpleNamespace(completions=SimpleNamespace(create=create)),
        embeddings=SimpleNamespace(create=embedding_create or AsyncMock(side_effect=AssertionError("No embeddings"))))
    client.options = []
    def options(**kwargs):
        client.options.append(kwargs)
        return client
    client.with_options = options
    @asynccontextmanager
    async def factory(key):
        assert key == "synthetic-provider-stub"
        yield client
    return client, factory


def test_exact_effort_request_has_no_labels_and_never_retries(answers):
    async def check():
        _, _, prepared = answers[0][1]
        request = live.expected_request(prepared)
        assert request["reasoning_effort"] == "high" and request["model"] == "gpt-6-sol"
        assert request["max_completion_tokens"] == 6000 and request["store"] is False
        assert "LABEL_ONLY_SENTINEL" not in json.dumps(request)
        events = []
        create = AsyncMock(return_value=answer_response())
        client, _ = client_for(create)
        wrapper = live.ExactClient(client, prepared, events.append)
        with pytest.raises(ValueError):
            wrapper.with_options(max_retries=1, timeout=120)
        with pytest.raises(ValueError):
            await wrapper.create(**{**request, "reasoning_effort": "medium"})
        assert not events and not create.await_count
        await wrapper.with_options(max_retries=0, timeout=120).create(**request)
        with pytest.raises(ValueError):
            await wrapper.create(**request)
        assert events == [{"event": "dispatch_outcome_unknown", "reserved_usd": "0.14"}]
        assert create.await_count == 1 and client.options == [{"max_retries": 0, "timeout": 120}]
    asyncio.run(check())


@pytest.mark.parametrize("cap", [None, "NaN", "Infinity", "0", "-1", "1.679", "1.71"])
def test_budget_rejected_before_key_or_artifacts(answers, tmp_path, cap):
    jobs, manifest = answers
    key = AsyncMock(side_effect=AssertionError("No key access"))
    directory = tmp_path / "rejected"
    with pytest.raises(ValueError):
        asyncio.run(live.collect(jobs, manifest, phase="answers", cap=cap, approved_plan=live.digest(manifest),
                                key_loader=key, client_factory=None, directory=directory))
    assert not directory.exists()
    key.assert_not_awaited()


@pytest.mark.parametrize("mutation", ["request", "evidence", "criteria", "effort", "phase", "digest", "date", "endpoint"])
def test_plan_drift_rejected_before_key_or_artifacts(answers, tmp_path, monkeypatch, mutation):
    jobs, manifest = answers
    approved = live.digest(manifest)
    phase = "answers"
    if mutation == "request":
        jobs[0][2].messages[1]["content"] += "changed"
    elif mutation == "evidence":
        jobs[0][2].evidence[0]["text"] = "changed"
    elif mutation == "criteria":
        jobs[0][0]["criteria"].append("changed")
    elif mutation == "effort":
        jobs[0][2].generation["reasoning_effort"] = "xhigh"
    elif mutation == "phase":
        phase = "unknown"
    elif mutation == "digest":
        approved = "obsolete"
    elif mutation == "date":
        monkeypatch.setattr(live, "PRICE_DATE", "2000-01-01")
    elif mutation == "endpoint":
        monkeypatch.setenv("OPENAI_BASE_URL", "https://example.invalid")
    key = AsyncMock(side_effect=AssertionError("No key access"))
    directory = tmp_path / "rejected"
    with pytest.raises(ValueError):
        asyncio.run(live.collect(jobs, manifest, phase=phase, cap="1.70", approved_plan=approved,
                                key_loader=key, client_factory=None, directory=directory))
    assert not directory.exists()
    key.assert_not_awaited()


@pytest.mark.parametrize("outcome", ["unknown", "missing_usage", "excessive_usage"])
def test_stops_after_first_bad_answer_retains_output_and_all_reservations(answers, tmp_path, outcome):
    jobs, manifest = answers
    create = (AsyncMock(side_effect=RuntimeError("PRIVATE_PROVIDER_DETAIL")) if outcome == "unknown"
              else AsyncMock(return_value=answer_response(usage=outcome != "missing_usage", excessive=outcome == "excessive_usage")))
    _, factory = client_for(create)
    key = AsyncMock(return_value="synthetic-provider-stub")
    directory = tmp_path / "attempt"
    report = asyncio.run(live.collect(jobs, manifest, phase="answers", cap="1.70", approved_plan=live.digest(manifest),
                                     key_loader=key, client_factory=factory, directory=directory))
    assert report["status"] == "halted" and report["paid_requests"] == create.await_count == 1
    assert report["reserved_usd"] == "1.68" and len(report["results"]) == 1
    row = json.loads((directory / "synthetic-0-medium.json").read_text())
    assert row == report["results"][0]
    if outcome == "excessive_usage":
        assert row["generation"]["usage"]["prompt_tokens"] == 33_000
    assert "PRIVATE_PROVIDER_DETAIL" not in (directory / "report.json").read_text()
    assert json.loads((directory / "ledger.jsonl").read_text().splitlines()[-1])["reservations_reclaimed_usd"] == "0"
    with pytest.raises(FileExistsError):
        asyncio.run(live.collect(jobs, manifest, phase="answers", cap="1.70", approved_plan=live.digest(manifest),
                                key_loader=key, client_factory=factory, directory=directory))
    key.assert_awaited_once()
    assert create.await_count == 1


def test_completed_stub_matrix_has_same_evidence_and_all_three_efforts(answers, tmp_path):
    jobs, manifest = answers
    create = AsyncMock(return_value=answer_response())
    _, factory = client_for(create)
    report = asyncio.run(live.collect(jobs, manifest, phase="answers", cap="1.70", approved_plan=live.digest(manifest),
        key_loader=AsyncMock(return_value="synthetic-provider-stub"), client_factory=factory, directory=tmp_path / "complete"))
    assert report["status"] == "completed" and report["paid_requests"] == 12
    assert report["quality_assessment"] == "pending source review"
    calls = [item.kwargs for item in create.await_args_list]
    for start in range(0, 12, 3):
        assert [item["reasoning_effort"] for item in calls[start:start + 3]] == list(live.EFFORTS)
        assert all(item["messages"] == calls[start]["messages"] for item in calls[start:start + 3])


@pytest.mark.parametrize("mutation", ["small_model", "small_dimensions", "nonfinite", "zero", "boolean", "index", "usage"])
def test_embedding_response_model_dimensions_order_and_usage_are_strict(mutation):
    response = embedding_response()
    if mutation == "small_model":
        response.model = "text-embedding-3-small"
    elif mutation == "small_dimensions":
        response.data[0].embedding = [1.0] * 1536
    elif mutation == "nonfinite":
        response.data[0].embedding[0] = float("nan")
    elif mutation == "zero":
        response.data[0].embedding = [0.0] * 3072
    elif mutation == "boolean":
        response.data[0].embedding[0] = True
    elif mutation == "index":
        response.data[0].index = True
    elif mutation == "usage":
        response.usage.total_tokens += 1
    with pytest.raises(ValueError):
        live.validate_embedding(response, "large", 1)
    good = embedding_response(2)
    good.data.reverse()
    values, tokens = live.validate_embedding(good, "large", 2)
    assert len(values) == 2 and len(values[0]) == 3072 and tokens == 8


def test_embedding_input_drift_refused_before_credentials(embeddings, tmp_path):
    frozen = deepcopy(embeddings.manifest)
    embeddings.inputs["synthetic-a"] = EmbeddingInput("synthetic-a", "passage", "Changed text.", 3)
    key = AsyncMock(side_effect=AssertionError("No key access"))
    with pytest.raises(ValueError):
        asyncio.run(live.collect(embeddings, frozen, phase="embeddings", cap="1.00", approved_plan=live.digest(frozen),
            key_loader=key, client_factory=None, directory=tmp_path / "rejected"))
    key.assert_not_awaited()
    assert not (tmp_path / "rejected").exists()


def test_invalid_embedding_stops_without_retry_or_scoring(embeddings, tmp_path, monkeypatch):
    response = embedding_response()
    response.data[0].embedding = [1.0] * 1536
    create = AsyncMock(return_value=response)
    _, factory = client_for(AsyncMock(), create)
    monkeypatch.setattr(live, "score", lambda *args: pytest.fail("Invalid vectors must not be scored"))
    report = asyncio.run(live.collect(embeddings, embeddings.manifest, phase="embeddings", cap="1.00",
        approved_plan=live.digest(embeddings.manifest), key_loader=AsyncMock(return_value="synthetic-provider-stub"),
        client_factory=factory, directory=tmp_path / "invalid"))
    assert report["status"] == "halted" and report["paid_requests"] == create.await_count == 1
    assert report["reserved_usd"] == embeddings.manifest["reserved_usd"]
    assert report["results"][0]["input_tokens"] == 4
    assert Decimal(report["usage_priced_upper_usd"]) > 0
    assert not (tmp_path / "invalid/vectors.json").exists()


def test_only_large_is_dispatched_and_exact_dimensions_are_requested(embeddings, tmp_path, monkeypatch):
    assert live.PROFILES == {"large": ("text-embedding-3-large", 3072, Decimal("0.13"))}
    create = AsyncMock(return_value=embedding_response())
    _, factory = client_for(AsyncMock(), create)
    monkeypatch.setattr(live, "score", lambda *args: {"scoring": "stub only"})
    report = asyncio.run(live.collect(embeddings, embeddings.manifest, phase="embeddings", cap="1.00",
        approved_plan=live.digest(embeddings.manifest), key_loader=AsyncMock(return_value="synthetic-provider-stub"),
        client_factory=factory, directory=tmp_path / "large-only"))
    assert report["status"] == "completed" and create.await_count == 2
    for call in create.await_args_list:
        assert call.kwargs["model"] == "text-embedding-3-large"
        assert call.kwargs["dimensions"] == 3072 and call.kwargs["encoding_format"] == "float"
        assert call.kwargs["input"] in [[item.text] for item in embeddings.inputs.values()]


@pytest.mark.parametrize("corruption", [None, "digest", "dimension", "missing", "unfinished", "plan"])
def test_replay_checks_complete_exact_cache_without_dispatch(embeddings, tmp_path, monkeypatch, corruption):
    vectors = {"large": {key: [1.0] + [0.0] * 3071 for key in embeddings.inputs}}
    payload = {"plan_sha256": live.digest(embeddings.manifest), "vectors": vectors}
    if corruption == "dimension":
        vectors["large"]["synthetic-a"] = [1.0] * 1536
    if corruption == "missing":
        vectors["large"].pop("synthetic-a")
    cache = {"payload": payload, "sha256": live.digest(payload)}
    if corruption == "digest":
        cache["sha256"] = "bad"
    manifest = deepcopy(embeddings.manifest)
    if corruption == "plan":
        manifest["version"] = "obsolete"
    write_exclusive(tmp_path / "plan.json", manifest)
    write_exclusive(tmp_path / "report.json", {"status": "halted" if corruption == "unfinished" else "completed"})
    write_exclusive(tmp_path / "vectors.json", cache)
    monkeypatch.setattr(live, "score", lambda prepared, cache: {"scoring": "stub only"})
    if corruption:
        with pytest.raises(ValueError):
            live.replay_embeddings(embeddings, tmp_path)
    else:
        assert live.replay_embeddings(embeddings, tmp_path)["new_provider_calls"] == 0


@pytest.mark.parametrize("phase", ["answers", "embeddings"])
def test_default_main_is_key_free(answers, embeddings, monkeypatch, phase):
    monkeypatch.setattr(live, "answer_plan", AsyncMock(return_value=answers))
    monkeypatch.setattr(live, "retrieval_plan", AsyncMock(return_value=embeddings))
    monkeypatch.setattr(live, "collect", AsyncMock(side_effect=AssertionError("No paid path")))
    result = asyncio.run(live.main(SimpleNamespace(phase=phase, replay=False, run_paid=False)))
    assert result["dry_run"] and result["credential_access"] is False


@pytest.fixture(scope="module")
def real_plans():
    # Resolves frozen PDF/label hashes and tokenizer inputs only. In particular,
    # tests must not inspect held-out retrieval scores before the approved run.
    with patch("socket.socket.connect", side_effect=AssertionError("No network")), \
         patch("openai.AsyncOpenAI", side_effect=AssertionError("No provider")), \
         patch.object(retrieval, "score", side_effect=AssertionError("No holdout scoring")):
        return asyncio.run(retrieval.plan()), asyncio.run(live.answer_plan())


def test_real_preflight_is_document_disjoint_bounded_and_large_only(real_plans):
    embeddings, (jobs, manifest) = real_plans
    fresh = embeddings.corpora["fresh_documents"]
    known_hashes = {document["source_sha256"] for name, corpus in embeddings.corpora.items()
                   if name != "fresh_documents" for document in corpus.documents}
    assert len(fresh.documents) == 3 and len(fresh.dataset.cases) == 12
    assert not known_hashes & {document["source_sha256"] for document in fresh.documents}
    assert set(embeddings.manifest["profiles"]) == {"large"}
    live.verify_prepared(embeddings, embeddings.manifest, "embeddings")
    live.approve(embeddings.manifest, "1.00", live.digest(embeddings.manifest))
    assert len(jobs) == 12 and manifest["reserved_usd"] == "1.68"
    live.verify_prepared(jobs, manifest, "answers")
    live.approve(manifest, "1.70", live.digest(manifest))
    fresh_ids = {document["id"] for document in fresh.documents}
    for _, _, prepared in jobs:
        assert {item["document_id"] for item in prepared.evidence} <= fresh_ids
        payload = json.loads(prepared.messages[1]["content"])
        assert set(payload) == {"question", "retrieval_method", "retrieval_coverage", "evidence_untrusted"}
    capacity_case = next(case for case in fresh.dataset.cases if case.id == "fresh-multi-03")
    assert len(capacity_case.anchors) == 6 > embeddings.manifest["ranking"]["k"]
