"""Key-free safety gates. Stubbed rehearsal is mechanics, never quality evidence."""

import asyncio
from datetime import date
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from evaluations import library_rag_live as live
from services.library_answers.context import fingerprint


@pytest.fixture(autouse=True)
def pricing_date(monkeypatch):
    class FixedDate(date):
        @classmethod
        def today(cls):
            return cls(2026, 9, 27)
    monkeypatch.setattr(live, "date", FixedDate)


@pytest.fixture(scope="module")
def planned():
    with patch("socket.socket.connect", side_effect=AssertionError("No network")), \
         patch("openai.AsyncOpenAI", side_effect=AssertionError("No provider")):
        return asyncio.run(live.plan())


def test_preflight_freezes_known_cases_and_full_maximum(planned):
    prepared, manifest = planned
    assert len(prepared.cases) == 4 and len(prepared.inputs) == 6
    assert manifest["reserved_usd"] == "1.144"
    assert manifest["methods"] == ("keyword", "semantic")
    assert manifest["model"] == "gpt-6-sol" and manifest["effort"] == "medium"
    assert [row["query_case"] for row in manifest["criteria"]] == [case.id for case in prepared.cases]
    live.approve(manifest, "1.20", fingerprint(manifest))


@pytest.mark.parametrize("cap", [None, "NaN", "Infinity", "0", "-1", "1.143", "1.21"])
def test_invalid_budget_before_credentials_or_artifacts(planned, tmp_path, cap):
    prepared, manifest = planned
    key = AsyncMock(side_effect=AssertionError("No credential access"))
    directory = tmp_path / "attempt"
    with pytest.raises(ValueError):
        asyncio.run(live.collect(prepared, manifest, cap=cap, approved_plan=fingerprint(manifest), key_loader=key, directory=directory))
    assert not directory.exists()
    key.assert_not_awaited()


def test_plan_price_endpoint_drift_refuses(planned, monkeypatch):
    _, manifest = planned
    with pytest.raises(ValueError):
        live.approve(manifest, "1.20", "obsolete")
    monkeypatch.setenv("OPENAI_BASE_URL", "https://example.invalid")
    with pytest.raises(ValueError):
        live.approve(manifest, "1.20", fingerprint(manifest))
    monkeypatch.delenv("OPENAI_BASE_URL")
    monkeypatch.setattr(live, "PRICE_DATE", "2000-01-01")
    with pytest.raises(ValueError):
        live.approve(manifest, "1.20", fingerprint(manifest))


def test_default_never_touches_storage_or_key(planned):
    with patch.object(live, "plan", AsyncMock(return_value=planned)), \
         patch.object(live, "collect", AsyncMock(side_effect=AssertionError("No dispatch"))):
        result = asyncio.run(live.main(SimpleNamespace(run_paid=False)))
    assert result["dry_run"] and not result["credential_access"] and not result["storage_access"]


def test_failed_preflight_keeps_reservation_and_redacts_error(planned, monkeypatch, tmp_path):
    prepared, manifest = planned
    directory = tmp_path / "attempt"
    async def storage(*args, **kwargs):
        events = (directory / "ledger.jsonl").read_text().splitlines()
        assert json.loads(events[0])["event"] == "all_requests_reserved"
        raise RuntimeError("PRIVATE_CREDENTIAL_DETAIL")
    monkeypatch.setattr(live, "run_storage", storage)
    report = asyncio.run(live.collect(prepared, manifest, cap="1.20", approved_plan=fingerprint(manifest),
                                     key_loader=AsyncMock(), directory=directory))
    assert report["status"] == "halted" and report["reserved_usd"] == "1.144"
    assert report["reservations_reclaimed_usd"] == "0" and report["answer_requests"] == 0
    assert report["embedding_requests"] == 0
    assert "PRIVATE_" not in (directory / "report.json").read_text()
    with pytest.raises(FileExistsError):
        asyncio.run(live.collect(prepared, manifest, cap="1.20", approved_plan=fingerprint(manifest),
                                key_loader=AsyncMock(), directory=directory))
