"""Source-only Library retrieval, scoped projection and truthful coverage."""

import hashlib
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from database.interface import ConnectionConfig, DatabaseBackend, DatabaseError
from database.library_search import search_source_projection
from database.mongodb_adapter import MongoDBAdapter
from models.library_search import LibrarySearchRequest
from routers import library_search
from services import library_search as search_service
from services.library_search import LibrarySearchService, search_passages


def source_document(document_id="first", *, filename=None, pages=None, partial=False):
    """A small exact extraction without PDF/provider dependencies."""
    pages = pages or ["1. Payment is due within 30 days of receipt."]
    digest = hashlib.sha256(f"synthetic-{document_id}".encode()).hexdigest()
    records = []
    for number, text in enumerate(pages, start=1):
        if text:
            records.append(
                {
                    "page_number": number,
                    "text": text,
                    "status": "extracted",
                    "spans": [
                        {
                            "id": f"src-{document_id}-{number}",
                            "start": 0,
                            "end": len(text),
                            "text": text,
                        }
                    ],
                    "warnings": [],
                }
            )
        else:
            records.append(
                {
                    "page_number": number,
                    "text": "",
                    "status": "empty",
                    "spans": [],
                    "warnings": ["no_extractable_text"],
                }
            )
    status = "partial" if partial else "complete"
    return {
        "id": document_id,
        "filename": filename or f"{document_id}.pdf",
        "source_revision_id": f"revision-{document_id}",
        "source_sha256": digest,
        "source_status": "stored",
        "has_pdf_file": True,
        "extraction_status": status,
        "source_extraction": {
            "content_sha256": digest,
            "extraction_version": "test:lines-v1",
            "status": status,
            "page_count": len(pages),
            "pages": records,
            "warnings": ["no_extractable_text"] if partial else [],
            "text": "\n".join(page for page in pages if page).strip(),
        },
    }


def test_search_returns_exact_passage_identity_and_partial_source_notice():
    first = source_document(
        "fees",
        pages=["Payment within 30 days.", "Schedule A says payment within 7 days."],
    )
    second = source_document(
        "archive", pages=["Archive access lasts 120 days.", ""], partial=True
    )
    result = search_passages([first, second], "archive days")
    assert [
        (hit.document_id, hit.source_revision_id, hit.page_number, hit.passage_id)
        for hit in result.results
    ] == [
        ("archive", "revision-archive", 1, "p1_b1_v1"),
        ("fees", "revision-fees", 1, "p1_b1_v1"),
        ("fees", "revision-fees", 2, "p2_b1_v1"),
    ]
    assert result.results[0].excerpt == "Archive access lasts 120 days."
    assert result.results[0].excerpt_partial is False
    assert result.results[0].source_incomplete is True
    assert result.coverage.documents_searchable == 2
    assert result.coverage.documents_partial == 1
    assert result.coverage.passages_examined == 3
    assert result.coverage.scan_truncated is False


def test_long_excerpt_is_verbatim_contiguous_and_discloses_clipping():
    text = (
        "Preamble "
        + "ordinary text " * 60
        + "ARCHIVE exit window "
        + "other text " * 70
    )
    document = source_document("long", pages=[text])
    result = search_passages([document], "archive")
    hit = result.results[0]
    assert len(hit.excerpt) <= search_service.MAX_EXCERPT_CHARACTERS
    assert hit.excerpt_partial is True
    assert hit.excerpt in text and "ARCHIVE" in hit.excerpt
    assert not hit.excerpt.startswith("…") and not hit.excerpt.endswith("…")


@pytest.mark.parametrize(
    "change",
    [
        lambda item: item.update(source_sha256="0" * 64),
        lambda item: item.update(source_revision_id=None),
        lambda item: item.update(source_status="storing"),
        lambda item: item.update(has_pdf_file=False),
        lambda item: item["source_extraction"]["pages"][0]["spans"][0].update(
            text="invented"
        ),
        lambda item: item["source_extraction"].update(text="not the pages"),
        lambda item: item.update(extraction_status="partial"),
    ],
)
def test_stale_or_corrupt_sources_are_excluded_not_returned(change):
    document = source_document("corrupt")
    change(document)
    result = search_passages([document], "payment")
    assert result.results == []
    assert result.coverage.documents_unsearchable == 1
    assert result.coverage.documents_searchable == 0
    assert result.coverage.scan_truncated is False


def test_unavailable_source_and_legacy_record_are_reported_without_fabricated_hits():
    image_only = source_document("image", pages=[""], partial=True)
    image_only["extraction_status"] = "unavailable"
    image_only["source_extraction"]["status"] = "unavailable"
    legacy = {"id": "legacy", "filename": "legacy.pdf"}
    result = search_passages([legacy, image_only], "payment")
    assert result.coverage.documents_in_library == 2
    assert result.coverage.documents_scanned == 2
    assert result.coverage.documents_unsearchable == 2
    assert result.coverage.passages_examined == 0
    assert result.results == []


def test_document_and_passage_caps_are_disclosed(monkeypatch):
    documents = [
        source_document(str(index), pages=["Special obligation applies."])
        for index in range(4)
    ]
    monkeypatch.setattr(search_service, "MAX_SCAN_DOCUMENTS", 2)
    result = search_passages(documents, "special", documents_in_library=4)
    assert result.coverage.documents_in_library == 4
    assert result.coverage.documents_scanned == 2
    assert result.coverage.documents_not_examined == 2
    assert result.coverage.scan_truncated is True
    monkeypatch.setattr(search_service, "MAX_SCAN_DOCUMENTS", 100)
    monkeypatch.setattr(search_service, "MAX_SCAN_PASSAGES", 1)
    result = search_passages(documents, "special")
    assert result.coverage.documents_scanned == 1
    assert result.coverage.documents_not_examined == 3
    assert result.coverage.passages_examined == 1
    assert result.coverage.scan_truncated is True
    assert result.coverage.matched_passages == 1
    assert result.coverage.results_truncated is False


def test_result_limit_is_distinct_from_scan_limit():
    documents = [
        source_document(str(index), pages=["Special obligation applies."])
        for index in range(3)
    ]
    result = search_passages(documents, "special", limit=1)
    assert len(result.results) == 1
    assert result.coverage.matched_passages == 3
    assert result.coverage.results_truncated is True
    assert result.coverage.scan_truncated is False


def test_punctuation_only_passage_has_no_tokens_and_does_not_divide_by_zero():
    result = search_passages([source_document("marks", pages=["?! — …"])], "payment")
    assert result.results == []
    assert result.coverage.documents_searchable == 1
    assert result.coverage.passages_examined == 1


@pytest.mark.parametrize("query", [" ", "???", "x" * 201])
def test_invalid_queries_fail_before_search(query):
    with pytest.raises((ValidationError, ValueError)):
        request = LibrarySearchRequest(query=query)
        search_passages([], request.query)


@pytest.mark.asyncio
async def test_scoped_source_projection_does_not_load_review_or_credentials():
    source = source_document()
    cursor = SimpleNamespace(to_list=AsyncMock(return_value=[source]))
    cursor.sort = Mock(return_value=cursor)
    cursor.limit = Mock(return_value=cursor)
    collection = SimpleNamespace(
        count_documents=AsyncMock(return_value=1),
        find=Mock(return_value=cursor),
        find_one=AsyncMock(side_effect=AssertionError("N+1 read")),
    )
    adapter = MongoDBAdapter(
        ConnectionConfig(DatabaseBackend.MONGODB, "unused", "test")
    )
    adapter._get_collection = Mock(return_value=collection)
    total, records = await adapter.list_source_snapshots_for_search("local", 100)
    assert (total, records) == (1, [source])
    collection.count_documents.assert_awaited_once_with({"workspace_id": "local"})
    collection.find.assert_called_once_with(
        {"workspace_id": "local"}, search_source_projection()
    )
    cursor.sort.assert_called_once_with([("upload_date", -1), ("id", 1)])
    cursor.limit.assert_called_once_with(100)
    cursor.to_list.assert_awaited_once_with(length=100)
    collection.find_one.assert_not_awaited()
    projection = str(search_source_projection())
    assert not any(
        field in projection
        for field in (
            "review_workspace",
            "api_key",
            "credentials",
            "chat",
            "pdf_file_id",
        )
    )


@pytest.mark.asyncio
async def test_search_service_uses_only_scoped_source_read_and_no_provider_calls():
    db = SimpleNamespace(
        list_source_snapshots_for_search=AsyncMock(
            return_value=(1, [source_document()])
        ),
        get_workspace_api_key=AsyncMock(side_effect=AssertionError("Credential read")),
        get_documents_for_workspace=AsyncMock(
            side_effect=AssertionError("Full document read")
        ),
    )
    result = await LibrarySearchService(db).search("local", "payment")
    assert result.results[0].document_id == "first"
    db.list_source_snapshots_for_search.assert_awaited_once_with(
        "local", search_service.MAX_SCAN_DOCUMENTS
    )
    db.get_workspace_api_key.assert_not_awaited()
    db.get_documents_for_workspace.assert_not_awaited()


def test_route_is_local_api_read_and_never_reflects_query_on_failure(
    monkeypatch, caplog
):
    app = FastAPI()
    app.include_router(library_search.router, prefix="/api/v1")
    fake = SimpleNamespace(
        get_document_for_workspace=AsyncMock(return_value=source_document()),
        list_source_snapshots_for_search=AsyncMock(
            return_value=(1, [source_document()])
        )
    )
    monkeypatch.setattr(library_search, "get_document_service", lambda: fake)
    client = TestClient(app)
    response = client.post("/api/v1/library/search", json={"query": "payment"})
    assert response.status_code == 200
    assert response.json()["data"]["results"][0]["page_number"] == 1
    fake.list_source_snapshots_for_search.assert_awaited_once_with(
        "local", search_service.MAX_SCAN_DOCUMENTS
    )
    invalid = client.post(
        "/api/v1/library/search", json={"query": "? private clause" * 30}
    )
    assert invalid.status_code == 422
    assert "private clause" not in invalid.text

    fake.list_source_snapshots_for_search.side_effect = DatabaseError(
        "private contract and key"
    )
    failed = client.post("/api/v1/library/search", json={"query": "secret phrase"})
    assert failed.status_code == 503
    assert failed.json()["error"]["code"] == "LIBRARY_SEARCH_UNAVAILABLE"
    assert "secret phrase" not in caplog.text
    assert "private contract" not in caplog.text
    assert "secret phrase" not in failed.text


def test_registered_search_route_keeps_the_local_request_boundary(monkeypatch):
    from main import app

    fake = SimpleNamespace(
        list_source_snapshots_for_search=AsyncMock(return_value=(0, []))
    )
    monkeypatch.setattr(library_search, "get_document_service", lambda: fake)
    client = TestClient(app, base_url="http://localhost:8000")
    path = "/api/v1/library/search"
    assert client.post(path, json={"query": "payment"}).status_code == 403
    assert fake.list_source_snapshots_for_search.await_count == 0
    allowed = client.post(path, json={"query": "payment"}, headers={"X-ClauseIQ-Local": "1"})
    assert allowed.status_code == 200
    assert allowed.json()["data"]["coverage"]["documents_in_library"] == 0
    fake.list_source_snapshots_for_search.assert_awaited_once_with("local", search_service.MAX_SCAN_DOCUMENTS)
