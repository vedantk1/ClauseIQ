"""Unpaid lifecycle/ranking-boundary checks; fake vectors are not quality scores."""

import asyncio
from copy import deepcopy
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from qdrant_client import AsyncQdrantClient

from models.library_semantic import IndexRequest, SemanticSearchRequest
from routers import library_semantic
from services.library_semantic.lifecycle import active_attempts, document_lock
from services.library_semantic.service import LibrarySemanticService
from services.library_semantic.source import DIMENSIONS, MODEL, VERSION, SemanticError, digest, source_plan
from services.library_semantic.vectors import LibraryVectors, collection_names
from tests.test_library_search import source_document


class Documents:
    def __init__(self):
        self.records = {("local", "agreement"): source_document("agreement")}
        self.key_reads = 0
        self.raise_after_ready = False

    async def get_document_for_workspace(self, document, workspace):
        return deepcopy(self.records.get((workspace, document)))

    async def get_workspace_api_key(self, workspace):
        self.key_reads += 1
        return "test-only-provider-stub"

    async def update_document_if(self, document, workspace, expected, updates):
        record = self.records.get((workspace, document))
        if record is None or any(record.get(key) != value for key, value in expected.items()):
            return False
        record.update(deepcopy(updates))
        if self.raise_after_ready and updates["semantic_index"]["status"] == "ready":
            raise RuntimeError("lost acknowledgement")
        return True


class Repository:
    def __init__(self, documents):
        self.documents, self.receipts = documents, {}

    async def list(self, workspace):
        records = [deepcopy(record) for (scope, _), record in self.documents.records.items() if scope == workspace]
        return len(records), records[:100]

    async def claim_query(self, workspace, request_id, query_hash):
        key = (workspace, request_id)
        if key in self.receipts:
            return False, self.receipts[key]
        self.receipts[key] = {"status": "processing", "query_hash": query_hash}
        return True, self.receipts[key]

    async def finish_query(self, workspace, request_id, status, usage=None):
        self.receipts[(workspace, request_id)].update(status=status, input_tokens=usage)


class Vectors:
    def __init__(self):
        self.points = {}
        self.ensure = AsyncMock()
        self.fail_put = False
        self.fail_remove = False
        self.corrupt_hit = False

    async def count(self, workspace, document, generation):
        return len(self.points.get((workspace, document, generation), []))

    async def put(self, workspace, document, generation, plan, vectors):
        self.points[(workspace, document, generation)] = [SimpleNamespace(payload={
            "workspace_id": workspace, "document_id": document, "generation_id": generation,
            "passage_id": p.id, "page_number": p.page_number, "source_revision_id": p.source_revision_id,
            "text_sha256": digest(p.text), "fingerprint": plan.fingerprint,
        }) for p in plan.passages.values()]
        if self.fail_put:
            raise RuntimeError("uncertain vector acknowledgement")

    async def remove(self, workspace, document, generation=None):
        if self.fail_remove:
            raise RuntimeError("cleanup unavailable")
        for key in list(self.points):
            if key[:2] == (workspace, document) and (generation is None or key[2] == generation):
                del self.points[key]

    async def search(self, workspace, generations, vector, limit):
        hits = [deepcopy(point) for (scope, document, generation), points in self.points.items()
                if scope == workspace and generations.get(document) == generation for point in points][:limit]
        if self.corrupt_hit and hits:
            hits[0].payload["text_sha256"] = "wrong"
        return hits


@pytest.fixture
def stack():
    documents, vectors = Documents(), Vectors()
    repository = Repository(documents)

    async def provider(texts, key):
        assert key == "test-only-provider-stub"
        # Durable claim must exist before even the stub provider is entered.
        assert (any(record.get("semantic_index", {}).get("status") == "processing" for record in documents.records.values())
                or any(row["status"] == "processing" for row in repository.receipts.values()))
        return [[1.0] + [0.0] * (DIMENSIONS - 1) for _ in texts], len(texts)

    provider_mock = AsyncMock(side_effect=provider)
    return LibrarySemanticService(documents, vectors, provider_mock, repository), documents, vectors, provider_mock


async def index_request(engine, request_id=None):
    plan = await engine.plan("local", "agreement")
    return IndexRequest(request_id=request_id or uuid4(), fingerprint=plan["fingerprint"],
                        expected_generation=plan["expected_generation"], confirm_paid=True)


def query_request():
    return SemanticSearchRequest(query="When is payment due?", request_id=uuid4(), confirm_paid=True, limit=5)


@pytest.mark.asyncio
async def test_status_and_preview_are_key_free_no_index_write_or_provider(stack):
    engine, documents, vectors, provider = stack
    before = deepcopy(documents.records)
    assert (await engine.status("local"))["indexed_documents"] == 0
    preview = await engine.plan("local", "agreement")
    assert preview["input_tokens"] > 0 and preview["maximum_usd"] == "0.026"
    assert preview["model"] == "text-embedding-3-large" and preview["dimensions"] == 3072
    assert documents.records == before and not vectors.points
    assert documents.key_reads == 0 and provider.await_count == 0


@pytest.mark.asyncio
async def test_index_replay_remove_and_replay_never_resend(stack):
    engine, documents, vectors, provider = stack
    request = await index_request(engine)
    assert (await engine.index("local", "agreement", request))["status"] == "ready"
    assert (await engine.index("local", "agreement", request))["status"] == "ready"
    assert provider.await_count == 1
    await engine.remove("local", "agreement", str(request.request_id))
    assert not vectors.points
    assert (await engine.index("local", "agreement", request))["status"] == "not_indexed"
    assert provider.await_count == 1
    assert documents.records[("local", "agreement")]["source_extraction"]["text"] == "1. Payment is due within 30 days of receipt."


@pytest.mark.asyncio
async def test_concurrent_duplicate_index_dispatches_once(stack):
    engine, _, _, provider = stack
    request = await index_request(engine)
    results = await asyncio.gather(engine.index("local", "agreement", request), engine.index("local", "agreement", request))
    assert all(result["status"] == "ready" for result in results)
    assert provider.await_count == 1


@pytest.mark.asyncio
async def test_old_plan_or_generation_fails_before_paid_work(stack):
    engine, documents, _, provider = stack
    request = await index_request(engine)
    documents.records[("local", "agreement")]["source_revision_id"] = "replacement"
    with pytest.raises(SemanticError, match="SOURCE_CHANGED"):
        await engine.index("local", "agreement", request)
    assert provider.await_count == 0


@pytest.mark.asyncio
async def test_stale_missing_and_restarted_processing_are_explicit(stack):
    engine, documents, vectors, provider = stack
    request = await index_request(engine)
    await engine.index("local", "agreement", request)
    vectors.points.clear()
    assert (await engine.status("local"))["documents"][0]["status"] == "missing_vectors"
    documents.records[("local", "agreement")]["source_revision_id"] = "changed"
    assert (await engine.status("local"))["documents"][0]["status"] == "stale"
    documents.records[("local", "agreement")]["semantic_index"]["status"] = "processing"
    assert (await engine.status("local"))["documents"][0]["status"] == "interrupted"
    assert provider.await_count == 1


@pytest.mark.asyncio
async def test_provider_failure_is_durable_safe_and_not_retried(stack):
    engine, documents, vectors, provider = stack
    request = await index_request(engine)
    provider.side_effect = RuntimeError("secret provider content must never leave the service")
    with pytest.raises(SemanticError, match="INDEX_FAILED"):
        await engine.index("local", "agreement", request)
    assert documents.records[("local", "agreement")]["semantic_index"]["status"] == "failed"
    assert "secret" not in str(documents.records)
    assert (await engine.index("local", "agreement", request))["status"] == "failed"
    assert provider.await_count == 1 and not vectors.points and not active_attempts


@pytest.mark.asyncio
async def test_source_change_after_embedding_rejects_publication(stack):
    engine, documents, vectors, provider = stack
    request = await index_request(engine)

    async def changed(texts, key):
        documents.records[("local", "agreement")]["source_revision_id"] = "new-source"
        return [[1.0] * DIMENSIONS], 1
    provider.side_effect = changed
    with pytest.raises(SemanticError, match="SOURCE_CHANGED"):
        await engine.index("local", "agreement", request)
    assert not vectors.points


@pytest.mark.asyncio
async def test_uncertain_vector_write_is_not_published_and_is_cleaned(stack):
    engine, documents, vectors, _ = stack
    vectors.fail_put = True
    with pytest.raises(SemanticError):
        await engine.index("local", "agreement", await index_request(engine))
    assert not vectors.points and documents.records[("local", "agreement")]["semantic_index"]["status"] == "failed"


@pytest.mark.asyncio
async def test_uncertain_ready_acknowledgement_preserves_attached_vectors(stack):
    engine, documents, vectors, provider = stack
    documents.raise_after_ready = True
    result = await engine.index("local", "agreement", await index_request(engine))
    assert result["status"] == "ready" and vectors.points and provider.await_count == 1


@pytest.mark.asyncio
async def test_cleanup_failure_is_not_removal_success(stack):
    engine, documents, vectors, _ = stack
    request = await index_request(engine)
    await engine.index("local", "agreement", request)
    vectors.fail_remove = True
    with pytest.raises(RuntimeError):
        await engine.remove("local", "agreement", str(request.request_id))
    assert vectors.points and documents.records[("local", "agreement")]["semantic_index"]["status"] == "ready"


@pytest.mark.asyncio
async def test_deletion_lock_waits_for_index_and_removes_its_late_write(stack):
    engine, documents, vectors, provider = stack
    entered, release, deleted = asyncio.Event(), asyncio.Event(), asyncio.Event()
    original = provider.side_effect
    async def delayed(texts, key):
        entered.set()
        await release.wait()
        return await original(texts, key)
    provider.side_effect = delayed
    task = asyncio.create_task(engine.index("local", "agreement", await index_request(engine)))
    await entered.wait()
    async def deletion():
        async with document_lock("local", "agreement"):
            document = await engine.document("local", "agreement")
            await engine.remove_locked("local", document)
            del documents.records[("local", "agreement")]
            deleted.set()
    cleanup = asyncio.create_task(deletion())
    await asyncio.sleep(0)
    assert not deleted.is_set()
    release.set()
    await asyncio.gather(task, cleanup)
    assert deleted.is_set() and not vectors.points


@pytest.mark.asyncio
async def test_semantic_search_exact_source_and_duplicate_paid_receipt(stack):
    engine, _, _, provider = stack
    await engine.index("local", "agreement", await index_request(engine))
    request = query_request()
    result = await engine.search("local", request)
    assert result["results"][0]["source_revision_id"] == "revision-agreement"
    assert result["results"][0]["excerpt"] == "1. Payment is due within 30 days of receipt."
    assert result["semantic"]["abstention_threshold"] is None
    with pytest.raises(SemanticError, match="SEARCH_ALREADY_SUBMITTED"):
        await engine.search("local", request)
    assert provider.await_count == 2


@pytest.mark.asyncio
async def test_unindexed_or_wrong_workspace_never_dispatches_query(stack):
    engine, _, _, provider = stack
    for workspace in ("local", "another"):
        with pytest.raises(SemanticError, match="NO_CURRENT_INDEX"):
            await engine.search(workspace, query_request())
    assert provider.await_count == 0


@pytest.mark.asyncio
async def test_bad_source_hit_withholds_results_and_marks_receipt(stack):
    engine, _, vectors, _ = stack
    await engine.index("local", "agreement", await index_request(engine))
    vectors.corrupt_hit = True
    request = query_request()
    with pytest.raises(SemanticError, match="INVALID_SEARCH_HIT"):
        await engine.search("local", request)
    assert engine.repository.receipts[("local", str(request.request_id))]["status"] == "failed_or_unknown"


@pytest.mark.asyncio
async def test_source_changed_during_query_withholds_old_passages(stack):
    engine, documents, _, provider = stack
    await engine.index("local", "agreement", await index_request(engine))
    async def change_source(texts, key):
        documents.records[("local", "agreement")]["source_revision_id"] = "new"
        return [[1.0] * DIMENSIONS], 1
    provider.side_effect = change_source
    with pytest.raises(SemanticError, match="INDEX_CHANGED"):
        await engine.search("local", query_request())


@pytest.mark.asyncio
async def test_qdrant_adapter_exact_tuple_scope_and_namespace_deletion():
    client = AsyncQdrantClient(location=":memory:")
    vectors = LibraryVectors(client, "synthetic-library-test")
    try:
        await vectors.ensure()
        document = source_document("agreement")
        plan = source_plan(document)
        for workspace, doc, generation in [("one", "agreement", "same"), ("two", "agreement", "same"), ("one", "other", "same")]:
            await vectors.put(workspace, doc, generation, plan, [[1.0] + [0.0] * (DIMENSIONS - 1)])
        hits = await vectors.search("one", {"agreement": "same"}, [1.0] + [0.0] * (DIMENSIONS - 1), 10)
        assert len(hits) == 1 and hits[0].payload["document_id"] == "agreement"
        assert "text" not in hits[0].payload and "filename" not in hits[0].payload
        await vectors.remove("one", "agreement")
        assert await vectors.count("one", "agreement", "same") == 0
        assert await vectors.count("two", "agreement", "same") == 1
        assert await vectors.count("one", "other", "same") == 1
    finally:
        await vectors.close()


def test_router_redacts_invalid_body_and_errors():
    app = FastAPI()
    app.include_router(library_semantic.router)
    engine = SimpleNamespace(search=AsyncMock(side_effect=RuntimeError("private query/provider details")))
    app.dependency_overrides[library_semantic.service] = lambda: engine
    app.dependency_overrides[library_semantic.get_workspace_id] = lambda: "local"
    with TestClient(app) as client:
        response = client.post("/library/semantic/search", json={"query": "private query", "confirm_paid": False})
        assert response.status_code == 422 and "private query" not in response.text
        engine.search.assert_not_awaited()
        response = client.post("/library/semantic/search", json={"query": "private query", "confirm_paid": True, "request_id": str(uuid4())})
        assert response.status_code == 503 and "private query/provider" not in response.text


@pytest.mark.asyncio
async def test_embedding_provider_uses_exact_model_no_sdk_retry_and_validates_usage():
    from contextlib import asynccontextmanager
    from services.library_semantic.provider import embed
    create = AsyncMock(return_value=SimpleNamespace(model=MODEL,
        data=[SimpleNamespace(index=0, embedding=[1.0] + [0.0] * (DIMENSIONS - 1))],
        usage=SimpleNamespace(prompt_tokens=2, total_tokens=2)))
    options = []
    class Client:
        def with_options(self, **kwargs):
            options.append(kwargs)
            return SimpleNamespace(embeddings=SimpleNamespace(create=create))
    @asynccontextmanager
    async def factory(key):
        assert key == "stub"
        yield Client()
    with patch("services.library_semantic.provider.workspace_openai_client", factory):
        vectors, usage = await embed(["synthetic terms"], "stub")
    assert len(vectors[0]) == DIMENSIONS and usage == 2
    assert options == [{"max_retries": 0, "timeout": 45}]
    assert create.await_args.kwargs["model"] == "text-embedding-3-large"
    assert create.await_args.kwargs["dimensions"] == 3072
    assert create.await_count == 1


@pytest.mark.asyncio
async def test_small_profile_is_stale_without_reading_key_reindexing_or_touching_vectors(stack):
    engine, documents, vectors, provider = stack
    document = documents.records[("local", "agreement")]
    with patch("services.library_semantic.source.MODEL", "text-embedding-3-small"), \
         patch("services.library_semantic.source.DIMENSIONS", 1536), \
         patch("services.library_semantic.source.VERSION", "library-semantic-v1"):
        old_plan = source_plan(document)
    old_generation = str(uuid4())
    document["semantic_index"] = {"version": "library-semantic-v1", "status": "ready",
        "generation_id": old_generation, "fingerprint": old_plan.fingerprint, "attempts": [old_generation]}
    vectors.points[("local", "agreement", old_generation)] = ["preserved old vector"]
    before = deepcopy(documents.records)
    assert (await engine.status("local"))["documents"][0]["status"] == "stale"
    preview = await engine.plan("local", "agreement")
    assert preview["fingerprint"] != old_plan.fingerprint and preview["expected_generation"] == old_generation
    with pytest.raises(SemanticError, match="NO_CURRENT_INDEX"):
        await engine.search("local", query_request())
    old_request = IndexRequest(request_id=uuid4(), fingerprint=old_plan.fingerprint,
                               expected_generation=old_generation, confirm_paid=True)
    with pytest.raises(SemanticError, match="SOURCE_CHANGED"):
        await engine.index("local", "agreement", old_request)
    assert documents.records == before and vectors.points
    assert documents.key_reads == 0 and provider.await_count == 0
    # Only a new, confirmed preview may replace the derived index.
    assert (await engine.index("local", "agreement", await index_request(engine)))["status"] == "ready"
    current = document["semantic_index"]
    assert current["model"] == MODEL and current["dimensions"] == DIMENSIONS and current["version"] == VERSION
    assert old_generation in current["attempts"] and provider.await_count == 1
    assert ("local", "agreement", old_generation) not in vectors.points
    assert document["source_extraction"] == before[("local", "agreement")]["source_extraction"]


@pytest.mark.asyncio
async def test_versioned_spaces_never_mix_and_explicit_cleanup_preserves_other_documents():
    from qdrant_client import models
    client = AsyncQdrantClient(location=":memory:")
    current, previous = collection_names("synthetic", "database", "prefix")
    assert current != previous[0] and "library-v2" in current and "library-v1" in previous[0]
    assert collection_names("synthetic", "other-database", "prefix")[0] != current
    vectors = LibraryVectors(client, current, cleanup_collections=previous)
    try:
        await client.create_collection(previous[0], vectors_config=models.VectorParams(size=1536, distance=models.Distance.COSINE))
        for point_id, document in enumerate(("agreement", "other"), 1):
            await client.upsert(previous[0], [models.PointStruct(id=point_id, vector=[1.0] * 1536,
                payload={"workspace_id": "local", "document_id": document, "generation_id": "old"})], wait=True)
        await vectors.ensure()
        assert (await client.count(previous[0], exact=True)).count == 2
        assert (await client.get_collection(current)).config.params.vectors.size == 3072
        with pytest.raises(SemanticError, match="INVALID_EMBEDDING"):
            await vectors.search("local", {"agreement": "old"}, [1.0] * 1536, 5)
        assert await vectors.search("local", {"agreement": "old"}, [1.0] * 3072, 5) == []
        await vectors.remove("local", "agreement")
        assert (await client.count(previous[0], exact=True)).count == 1
        assert await client.collection_exists(previous[0])
    finally:
        await vectors.close()


@pytest.mark.asyncio
async def test_incompatible_new_collection_is_refused_before_embedding(stack):
    from qdrant_client import models
    engine, documents, _, provider = stack
    client = AsyncQdrantClient(location=":memory:")
    vectors = LibraryVectors(client, "synthetic-incompatible")
    engine.vectors = vectors
    try:
        await client.create_collection(vectors.collection, vectors_config=models.VectorParams(size=1536, distance=models.Distance.COSINE))
        with pytest.raises(SemanticError, match="INDEX_INCOMPATIBLE"):
            await engine.index("local", "agreement", await index_request(engine))
        assert documents.key_reads == 0 and provider.await_count == 0
    finally:
        await vectors.close()
