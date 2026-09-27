"""Deterministic operation budgets without server, database or provider calls."""
import asyncio
from unittest.mock import Mock

import pytest
from fastapi import HTTPException, Request, Response

from middleware import rate_limiter as module
from middleware.security import security_monitor


UPLOAD_PATHS = ["/documents/import", "/extract-text/"]
AI_PATHS = [
    "/analysis/analyze/",
    "/analysis/clauses/clause-1/rewrite",
    "/documents/doc-1/review-workspace/generate",
    "/documents/doc-1/review-workspace/runs/run-1/findings/finding-1/ask",
    "/chat/doc-1/message",
    "/library/semantic/documents/doc-1/index",
    "/library/semantic/search",
]
DEFAULT_OPERATIONS = [
    ("GET", "/documents/"),
    ("GET", "/documents/doc-1/review-workspace"),
    ("GET", "/analysis/documents/doc-1/clauses"),
    ("POST", "/documents/doc-1/review-workspace/fixture"),
    ("PUT", "/documents/doc-1/review-workspace"),
    ("POST", "/documents/doc-1/review-workspace/runs/run-1/interrupt"),
    ("POST", "/documents/doc-1/review-workspace/ask/turn-1/interrupt"),
    ("POST", "/documents/doc-1/extract"),
    ("POST", "/documents/doc-1/view"),
    ("POST", "/analysis/documents/doc-1/interactions/clause-1/notes"),
    ("POST", "/chat/doc-1/session"),
    ("DELETE", "/chat/doc-1/history"),
    ("GET", "/library/semantic/status"),
    ("POST", "/library/semantic/documents/doc-1/plan"),
    ("POST", "/library/semantic/documents/doc-1/remove"),
]


def request(method, path, *, client="127.0.0.1", forwarded=None):
    headers = [(b"user-agent", b"test-client")]
    if forwarded:
        headers.append((b"x-forwarded-for", forwarded.encode()))
    return Request({
        "type": "http", "method": method, "path": path, "query_string": b"",
        "scheme": "http", "server": ("localhost", 8000),
        "client": (client, 12345), "headers": headers,
    })


@pytest.fixture
def limiter(monkeypatch):
    clock = [1000.0]
    monkeypatch.setattr(module.time, "time", lambda: clock[0])
    limiter = module.RateLimiter()
    monkeypatch.setattr(module, "rate_limiter", limiter)
    monkeypatch.setattr(security_monitor, "record_suspicious_activity", Mock())
    return limiter, clock


def run_request(method, path, handler=None):
    async def success(_request):
        return Response(status_code=200)
    return asyncio.run(module.rate_limit_middleware(request(method, path), handler or success))


@pytest.mark.parametrize("prefix", ["", "/api/v1", "/api/v2"])
@pytest.mark.parametrize("path", UPLOAD_PATHS)
def test_only_local_upload_entry_points_use_upload_bucket(prefix, path):
    bucket, config = module.get_rate_limit_rule("POST", prefix + path)
    assert bucket == "upload"
    assert config == {"limit": 10, "window": 60}


@pytest.mark.parametrize("prefix", ["", "/api/v1", "/api/v2"])
@pytest.mark.parametrize("path", AI_PATHS)
def test_paid_entry_points_share_ai_bucket_not_upload(prefix, path):
    bucket, config = module.get_rate_limit_rule("POST", prefix + path)
    assert bucket == "ai"
    assert config == {"limit": 20, "window": 60}
    assert module.get_rate_limit_rule("GET", prefix + path)[0] == "default"


@pytest.mark.parametrize("method,path", DEFAULT_OPERATIONS)
def test_reads_personal_work_fixtures_and_recovery_use_default(method, path):
    assert module.get_rate_limit_rule(method, "/api/v1" + path) == (
        "default", {"limit": 60, "window": 60},
    )


@pytest.mark.parametrize("path", [
    "/api/v1suffix/documents/import", "/documents/import/extra",
    "/analysis/clauses/a/rewrite/extra", "/chat/a/message/extra",
    "/documents/a/review-workspace/generate/extra",
    "/library/semantic/search/extra", "/library/semantic/documents/a/index/extra",
])
def test_classification_matches_complete_routes_not_loose_prefixes(path):
    assert module.get_rate_limit_rule("POST", path)[0] == "default"


def test_read_traffic_does_not_spend_upload_or_ai_budget(limiter):
    for _ in range(12):
        assert run_request("GET", "/api/v1/documents/").status_code == 200
    fixture = run_request("POST", "/api/v1/documents/doc-1/review-workspace/fixture")
    assert fixture.status_code == 200
    assert fixture.headers["X-RateLimit-Limit"] == "60"
    assert fixture.headers["X-RateLimit-Remaining"] == "47"
    upload = run_request("POST", "/api/v1/documents/import")
    ai = run_request("POST", "/api/v1/documents/doc-1/review-workspace/generate")
    assert upload.status_code == ai.status_code == 200
    assert upload.headers["X-RateLimit-Remaining"] == "9"
    assert ai.headers["X-RateLimit-Remaining"] == "19"
    assert len(limiter[0].clients) == 3


@pytest.mark.parametrize("method,path,limit", [
    ("GET", "/api/v1/documents/", 60),
    ("POST", "/api/v1/documents/import", 10),
    ("POST", "/api/v1/documents/doc-1/review-workspace/generate", 20),
])
def test_fixed_bucket_limit_and_window_reset_without_repeating_handler(limiter, method, path, limit):
    calls = []

    async def handler(_request):
        calls.append(1)
        return Response(status_code=200)

    for index in range(limit):
        response = run_request(method, path, handler)
        assert response.status_code == 200
        assert response.headers["X-RateLimit-Remaining"] == str(limit - index - 1)
    denied = run_request(method, path, handler)
    assert denied.status_code == 429
    assert denied.headers["Retry-After"] == "60"
    assert len(calls) == limit
    limiter[1][0] += 60
    assert run_request(method, path, handler).status_code == 200
    assert len(calls) == limit + 1


def test_ai_bucket_is_shared_across_operations_and_resource_ids(limiter):
    for index in range(20):
        path = AI_PATHS[index % len(AI_PATHS)].replace("doc-1", f"doc-{index}").replace("clause-1", f"clause-{index}")
        assert run_request("POST", "/api/v1" + path).status_code == 200
    assert run_request("POST", "/api/v1/chat/another-document/message").status_code == 429
    assert len(limiter[0].clients) == 1
    assert next(iter(limiter[0].clients)).endswith(":ai")
    # Exhausting AI does not block an import or a recovery read.
    assert run_request("POST", "/api/v1/documents/import").status_code == 200
    assert run_request("GET", "/api/v1/documents/doc-1/review-workspace").status_code == 200


def test_upload_budget_is_shared_across_both_upload_routes(limiter):
    for index in range(10):
        assert run_request("POST", "/api/v1" + UPLOAD_PATHS[index % 2]).status_code == 200
    assert run_request("POST", "/api/v1/extract-text/").status_code == 429
    assert len(limiter[0].clients) == 1


@pytest.mark.parametrize("failure", [RuntimeError("handler failed"), HTTPException(503, "unavailable")])
def test_failed_handler_is_never_retried(limiter, failure):
    calls = []

    async def handler(_request):
        calls.append(1)
        raise failure

    with pytest.raises(type(failure)):
        run_request("POST", "/api/v1/documents/doc-1/review-workspace/generate", handler)
    assert calls == [1]
    assert next(iter(limiter[0].clients.values()))["count"] == 1


def test_client_identity_uses_direct_peer_not_forwarded_headers(limiter):
    plain = request("GET", "/api/v1/documents/")
    spoofed = request("GET", "/api/v1/documents/", forwarded="different-peer")
    other_peer = request("GET", "/api/v1/documents/", client="127.0.0.2")
    assert limiter[0].get_client_key(plain) == limiter[0].get_client_key(spoofed)
    assert limiter[0].get_client_key(plain) != limiter[0].get_client_key(other_peer)
