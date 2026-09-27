"""No paid calls: validate the live smoke's scope, budget and evidence guards."""

import asyncio
from copy import deepcopy
from datetime import date
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from evaluations import library_semantic_live as live
from services.library_semantic.source import DIMENSIONS, source_plan


@pytest.fixture(autouse=True)
def pricing_date(monkeypatch):
    class FixedDate(date):
        @classmethod
        def today(cls):
            return cls(2026, 9, 27)
    monkeypatch.setattr(live, "date", FixedDate)


@pytest.fixture(scope="module")
def prepared():
    with patch("socket.socket.connect", side_effect=AssertionError("No network")), \
         patch("openai.AsyncOpenAI", side_effect=AssertionError("No provider")):
        return asyncio.run(live.prepare())


def test_fixed_plan_uses_existing_source_reviewed_cases_and_complete_input_reservations(prepared):
    assert tuple(document["id"] for document in prepared.documents) == live.DOCUMENTS
    assert tuple(case.id for case in prepared.cases) == live.CASES
    assert len(prepared.inputs) == 6
    assert prepared.manifest["version"] == "semantic-runtime-smoke-v2"
    assert prepared.manifest["model"] == "text-embedding-3-large" and prepared.manifest["dimensions"] == 3072
    assert prepared.manifest["usd_per_million_input_tokens"] == "0.13"
    assert prepared.manifest["reserved_usd"] == "0.156"
    assert prepared.manifest["documents"][1]["excluded_headers"] == 25
    assert live.approve(prepared, "0.16", prepared.identity)


@pytest.mark.parametrize("cap", [None, "NaN", "Infinity", "0", "-1", "0.1559"])
def test_invalid_budget_never_gets_key_or_creates_artifacts(prepared, tmp_path, cap):
    key = AsyncMock(side_effect=AssertionError("Key must not be accessed"))
    directory = tmp_path / "attempt"
    with pytest.raises(ValueError):
        asyncio.run(live.collect(prepared, cap, prepared.identity, key_loader=key, directory=directory))
    assert not directory.exists()
    key.assert_not_awaited()


def test_drift_or_nonofficial_endpoint_refuses_before_paid_dispatch(prepared, monkeypatch):
    with pytest.raises(ValueError):
        live.approve(prepared, "0.16", "obsolete-plan")
    monkeypatch.setenv("OPENAI_BASE_URL", "https://example.invalid/v1")
    with pytest.raises(ValueError):
        live.approve(prepared, "0.16", prepared.identity)


def test_expired_pricing_refuses(prepared, monkeypatch):
    monkeypatch.setattr(live, "PRICE_VERIFIED_ON", "2000-01-01")
    with pytest.raises(ValueError):
        live.approve(prepared, "0.16", prepared.identity)


def test_dispatch_identity_failure_and_retry_fences(prepared):
    async def check():
        events = []
        delegate = AsyncMock(side_effect=RuntimeError("PRIVATE_PROVIDER_DETAIL"))
        provider = live.RecordedProvider(prepared, events.append, delegate)
        with pytest.raises(ValueError):
            await provider(["unapproved source"], "test-stub")
        assert not events
        with pytest.raises(RuntimeError):
            await provider(prepared.inputs[0], "test-stub")
        assert events == [{"event": "dispatch_outcome_unknown", "request": 0, "reserved_usd": "0.026"}]
        with pytest.raises(ValueError):
            await provider(prepared.inputs[1], "test-stub")
        delegate.assert_awaited_once()
    asyncio.run(check())


def test_failure_reservations_redaction_and_exclusive_output(prepared, tmp_path):
    directory = tmp_path / "attempt"
    key = AsyncMock(side_effect=RuntimeError("PRIVATE_CREDENTIAL_DETAIL"))

    async def runner(plan, provider, key_loader, record):
        assert json.loads((directory / "ledger.jsonl").read_text().splitlines()[0])["event"] == "reserved"
        await key_loader()

    report = asyncio.run(live.collect(prepared, "0.16", prepared.identity,
                                      key_loader=key, runner=runner, directory=directory))
    assert report["status"] == "halted" and report["paid_requests"] == 0
    assert report["reserved_usd"] == "0.156" and report["reservations_reclaimed_usd"] == "0"
    assert "PRIVATE_CREDENTIAL_DETAIL" not in (directory / "report.json").read_text()
    with pytest.raises(FileExistsError):
        asyncio.run(live.collect(prepared, "0.16", prepared.identity,
                                key_loader=key, runner=runner, directory=directory))
    key.assert_awaited_once()


def test_known_missing_qualification_and_unanswerable_hits_are_not_quality_passes(prepared):
    document = prepared.documents[1]
    passage = source_plan(document).passages["p25_b2_v1"]
    result = {"results": [{"document_id": document["id"], "source_revision_id": document["source_revision_id"],
        "page_number": 25, "passage_id": passage.id, "excerpt": passage.text}], "coverage": {}}
    runtime = {document["id"]: document}
    outcome = live.assess(prepared, prepared.cases[1], result, runtime)
    assert outcome["found"] == ["managed_archive_exit"]
    assert outcome["missing"] == ["managed_standard_exit"]
    assert live.assess(prepared, prepared.cases[-1], result, runtime)["no_answer_returned_candidates"]
    bad = deepcopy(result)
    bad["results"][0]["source_revision_id"] = "wrong-revision"
    with pytest.raises(ValueError):
        live.assess(prepared, prepared.cases[1], bad, runtime)


def test_default_main_never_dispatches_or_loads_credentials(prepared):
    with patch.object(live, "prepare", AsyncMock(return_value=prepared)), \
         patch.object(live, "collect", AsyncMock(side_effect=AssertionError("No paid path"))):
        result = asyncio.run(live.main(SimpleNamespace(run_paid=False)))
    assert result["dry_run"] and not result["credential_access"] and not result["storage_access"]
