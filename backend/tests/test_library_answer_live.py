"""Unpaid live-evaluation dispatch, budget and replay guards."""

from contextlib import asynccontextmanager
from copy import deepcopy
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio

from evaluations import library_answer_live as live
from services.library_answers.context import fingerprint


@pytest_asyncio.fixture
async def prepared_plan():
    return await live.plan()


@pytest.mark.asyncio
async def test_plan_is_fixed_and_reserves_full_requests(prepared_plan):
    cases, prepared, manifest = prepared_plan
    assert len(cases) == len(prepared) == len(manifest["cases"]) == 11
    assert manifest["reserved_usd"] == "1.54"
    live.approve(manifest, "1.60", fingerprint(manifest))
    for cap in ["NaN", "Infinity", "0", "-1", "1", "2"]:
        with pytest.raises(ValueError):
            live.approve(manifest, cap, fingerprint(manifest))
    with pytest.raises(ValueError):
        live.approve(manifest, "1.60", "not-the-plan")


@pytest.mark.asyncio
async def test_endpoint_and_pricing_guards(prepared_plan, monkeypatch):
    _, _, manifest = prepared_plan
    monkeypatch.setenv("OPENAI_BASE_URL", "https://invalid.example/v1")
    with pytest.raises(ValueError):
        live.approve(manifest, "1.60", fingerprint(manifest))
    monkeypatch.delenv("OPENAI_BASE_URL")
    monkeypatch.setattr(live, "PRICE_DATE", "2020-01-01")
    with pytest.raises(ValueError):
        live.approve(manifest, "1.60", fingerprint(manifest))


@pytest.mark.asyncio
async def test_exact_request_allows_one_call_only(prepared_plan):
    _, prepared, _ = prepared_plan
    create = AsyncMock(return_value=object())
    delegate = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    delegate.with_options = lambda **kwargs: delegate
    events = []
    client = live.ExactClient(delegate, prepared[0], events.append)
    request = live.expected_request(prepared[0])
    bad = deepcopy(request); bad["messages"][0]["content"] = "changed"
    with pytest.raises(ValueError):
        await client.create(**bad)
    assert not client.sent
    await client.create(**request)
    with pytest.raises(ValueError):
        await client.create(**request)
    assert create.await_count == 1 and events[0]["event"] == "dispatch_outcome_unknown"


@pytest.mark.asyncio
async def test_failed_call_stops_and_exclusive_output_prevents_replay(prepared_plan, tmp_path):
    cases, prepared, manifest = prepared_plan
    directory = tmp_path / "run"
    key_reads = []
    async def key_loader():
        assert "all_requests_reserved" in (directory / "ledger.jsonl").read_text()
        key_reads.append(1)
        return "noncredential-stub"
    create = AsyncMock(side_effect=RuntimeError("private provider response"))
    @asynccontextmanager
    async def factory(key):
        client = SimpleNamespace(base_url=live.ENDPOINT, chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
        client.with_options = lambda **kwargs: client
        yield client
    result = await live.collect(cases, prepared, manifest, cap="1.60", approved_plan=fingerprint(manifest),
                               key_loader=key_loader, client_factory=factory, directory=directory)
    assert result["status"] == "halted" and result["paid_requests"] == 1 and len(result["results"]) == 1
    assert result["reserved_usd"] == "1.54" and create.await_count == 1
    assert "private provider response" not in json.dumps(result)
    with pytest.raises(FileExistsError):
        await live.collect(cases, prepared, manifest, cap="1.60", approved_plan=fingerprint(manifest),
                           key_loader=key_loader, client_factory=factory, directory=directory)
    assert len(key_reads) == 1
