"""Deterministic storage and migration tests; no services or paid AI calls."""
import sys
from copy import deepcopy
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from bson import ObjectId

sys.path.insert(0, str(Path(__file__).parent.parent))

from database.interface import ConnectionConfig, DatabaseBackend, DatabaseError
from database.mongodb_adapter import MongoDBAdapter
from database.service import DocumentService
from database.workspace_migration import MIGRATION_ID, WorkspaceMigrationError, initialize_workspace


def nested_value(record, key):
    for part in key.split("."):
        record = record.get(part) if isinstance(record, dict) else None
    return record


def matches(record, query):
    for key, value in query.items():
        if key == "$and":
            match = all(matches(record, item) for item in value)
        elif key == "$or":
            match = any(matches(record, item) for item in value)
        elif isinstance(value, dict) and "$lt" in value:
            actual = nested_value(record, key)
            match = actual is not None and actual < value["$lt"]
        else:
            actual = nested_value(record, key)
            match = value in actual if isinstance(actual, list) and not isinstance(value, list) else actual == value
        if not match:
            return False
    return True


def set_value(record, key, value):
    parts = key.split(".")
    for part in parts[:-1]:
        record = record.setdefault(part, {})
    record[parts[-1]] = deepcopy(value)


class Cursor:
    def __init__(self, records):
        self.records = deepcopy(records)

    def __aiter__(self):
        self.iterator = iter(self.records)
        return self

    async def __anext__(self):
        try:
            return next(self.iterator)
        except StopIteration:
            raise StopAsyncIteration

    def skip(self, count):
        self.records = self.records[count:]
        return self

    def limit(self, count):
        if count:
            self.records = self.records[:count]
        return self

    async def to_list(self, length):
        return self.records[:length]


class Collection:
    def __init__(self, records=None):
        self.records = deepcopy(records or [])
        self.writes = []

    def find(self, query, projection=None):
        return Cursor([record for record in self.records if matches(record, query)])

    async def find_one(self, query, projection=None):
        return next((deepcopy(record) for record in self.records if matches(record, query)), None)

    async def update_one(self, query, update, upsert=False):
        self.writes.append((deepcopy(query), deepcopy(update)))
        record = next((record for record in self.records if matches(record, query)), None)
        if record is None and upsert:
            record = {**query, "_id": f"generated-{len(self.records)}"}
            self.records.append(record)
            for key, value in update.get("$setOnInsert", {}).items():
                set_value(record, key, value)
        if record is not None:
            for key, value in update.get("$set", {}).items():
                set_value(record, key, value)
        return SimpleNamespace(acknowledged=True, modified_count=int(record is not None))

    async def delete_many(self, query):
        self.writes.append((deepcopy(query), "delete"))
        deleted = [record for record in self.records if matches(record, query)]
        self.records = [record for record in self.records if not matches(record, query)]
        return SimpleNamespace(deleted_count=len(deleted))

    async def update_many(self, query, update):
        self.writes.append((deepcopy(query), deepcopy(update)))
        selected = [record for record in self.records if matches(record, query)]
        for record in selected:
            for key, value in update.get("$set", {}).items():
                set_value(record, key, value)
            for key in update.get("$unset", {}):
                record.pop(key, None)
        return SimpleNamespace(matched_count=len(selected), modified_count=len(selected))

    async def delete_one(self, query):
        return await self.delete_many(query)


class Database:
    def __init__(self, **collections):
        self.collections = {name: Collection(records) for name, records in collections.items()}
        self.database = self

    def __getitem__(self, name):
        return self._get_collection(name)

    def _get_collection(self, name):
        return self.collections.setdefault(name, Collection())

    @property
    def write_count(self):
        return sum(len(collection.writes) for collection in self.collections.values())


class VectorClient:
    def __init__(self, points=None):
        self.points = deepcopy(points or [])
        self.writes = []

    async def get_collections(self):
        return SimpleNamespace(collections=[SimpleNamespace(name="clauseiq-vectors")])

    async def scroll(self, **kwargs):
        return [SimpleNamespace(**point) for point in deepcopy(self.points)], None

    async def get_collection(self, collection_name):
        return SimpleNamespace(points_count=len(self.points))

    async def set_payload(self, *, points, payload, **kwargs):
        self.writes.append((deepcopy(points), deepcopy(payload)))
        for point in self.points:
            if point["id"] in points:
                point["payload"].update(payload)

    async def create_payload_index(self, **kwargs):
        self.writes.append(kwargs)


@pytest.fixture
def legacy():
    db = Database(**{
        "users": [{"_id": "account-record", "id": "owner-a", "opaque_credential": "keep-ciphertext"}],
        "documents": [{
            "_id": "document-record", "id": "document-a", "user_id": "owner-a", "pdf_file_id": "file-a",
            "clauses": [{"id": "clause-a"}],
            "chat_session": {"user_id": "owner-a", "messages": [{"content": "kept"}]},
        }],
        "user_interactions": [{
            "_id": "interaction-record", "document_id": "document-a", "user_id": "owner-a",
            "interactions": {"clause-a": {"user_id": "owner-a", "notes": [{"id": "note-a", "text": "kept"}]}},
        }],
        "pdf_files.files": [{"_id": "file-a", "metadata": {"user_id": "owner-a", "document_id": "document-a"}}],
        "system_config": [{"_id": "retention-record", "key": "document_auto_delete", "enabled": True, "days": 30}],
    })
    vectors = VectorClient([{"id": "point-a", "payload": {"user_id": "owner-a", "document_id": "document-a"}}])
    return db, vectors


@pytest.mark.asyncio
async def test_migration_preserves_relationships_and_disables_old_retention(legacy):
    db, vectors = legacy
    original_account = deepcopy(db["users"].records)
    result = await initialize_workspace(db, vectors)
    assert result == {"workspace_id": "local", "legacy_user_id": "owner-a", "migrated": True}
    document = db["documents"].records[0]
    assert document["id"] == "document-a" and document["user_id"] == "owner-a"
    assert document["pdf_file_id"] == "file-a" and document["clauses"] == [{"id": "clause-a"}]
    assert document["workspace_id"] == document["chat_session"]["workspace_id"] == "local"
    assert document["chat_session"]["messages"] == [{"content": "kept"}]
    interaction = db["user_interactions"].records[0]
    assert interaction["workspace_id"] == interaction["interactions"]["clause-a"]["workspace_id"] == "local"
    assert interaction["interactions"]["clause-a"]["notes"][0]["id"] == "note-a"
    assert db["pdf_files.files"].records[0]["metadata"]["workspace_id"] == "local"
    assert vectors.points[0]["payload"] == {"user_id": "owner-a", "document_id": "document-a", "workspace_id": "local"}
    assert db["users"].records == original_account
    retention = db["system_config"].records[0]
    assert retention["enabled"] is False and retention["days"] == 0
    marker = await db["workspace_migrations"].find_one({"id": MIGRATION_ID})
    assert marker["previous_retention"]["enabled"] is True


@pytest.mark.asyncio
async def test_migration_is_idempotent_and_keeps_new_opt_in_retention(legacy):
    db, vectors = legacy
    await initialize_workspace(db, vectors)
    db["system_config"].records[0].update(enabled=True, days=60)
    original_writes = (db.write_count, len(vectors.writes))
    result = await initialize_workspace(db, vectors)
    assert result["migrated"] is False
    assert (db.write_count, len(vectors.writes)) == original_writes
    assert db["system_config"].records[0]["days"] == 60


@pytest.mark.asyncio
@pytest.mark.parametrize("location", ["users", "documents", "interactions", "files", "vectors", "chat"])
async def test_multiple_legacy_owners_refused_before_any_write(legacy, location):
    db, vectors = legacy
    if location == "users":
        db["users"].records.append({"id": "owner-b"})
    elif location == "documents":
        db["documents"].records[0]["user_id"] = "owner-b"
    elif location == "interactions":
        db["user_interactions"].records[0]["interactions"]["clause-a"]["user_id"] = "owner-b"
    elif location == "files":
        db["pdf_files.files"].records[0]["metadata"]["user_id"] = "owner-b"
    elif location == "chat":
        db["documents"].records[0]["chat_session"]["user_id"] = "owner-b"
    else:
        vectors.points[0]["payload"]["user_id"] = "owner-b"
    with pytest.raises(WorkspaceMigrationError, match="multiple legacy"):
        await initialize_workspace(db, vectors)
    assert db.write_count == 0 and vectors.writes == []


@pytest.mark.asyncio
@pytest.mark.parametrize("location", ["documents", "interactions", "files", "vectors"])
async def test_unowned_data_refused_before_any_write(legacy, location):
    db, vectors = legacy
    target = {
        "documents": db["documents"].records[0],
        "interactions": db["user_interactions"].records[0],
        "files": db["pdf_files.files"].records[0]["metadata"],
        "vectors": vectors.points[0]["payload"],
    }[location]
    target.pop("user_id")
    with pytest.raises(WorkspaceMigrationError, match="unowned legacy"):
        await initialize_workspace(db, vectors)
    assert db.write_count == 0 and vectors.writes == []


@pytest.mark.asyncio
async def test_qdrant_outage_fails_preflight_without_mongo_changes(legacy):
    db, vectors = legacy
    vectors.get_collections = AsyncMock(side_effect=ConnectionError("private connection detail"))
    with pytest.raises(WorkspaceMigrationError, match="Check MongoDB and Qdrant") as error:
        await initialize_workspace(db, vectors)
    assert "private connection detail" not in str(error.value)
    assert db.write_count == 0


@pytest.mark.asyncio
async def test_partial_migration_retries_without_data_loss(legacy):
    db, vectors = legacy
    original = vectors.set_payload
    vectors.set_payload = AsyncMock(side_effect=RuntimeError("interruption"))
    with pytest.raises(WorkspaceMigrationError):
        await initialize_workspace(db, vectors)
    assert db["workspace_migrations"].records[0]["status"] == "pending"
    vectors.set_payload = original
    assert (await initialize_workspace(db, vectors))["migrated"] is True
    assert db["documents"].records[0]["user_id"] == "owner-a"
    assert db["workspace_migrations"].records[0]["previous_retention"]["days"] == 30


@pytest.mark.asyncio
async def test_fresh_workspace_needs_no_synthetic_account():
    db = Database()
    result = await initialize_workspace(db, VectorClient())
    assert result["legacy_user_id"] is None
    assert db["users"].records == []
    assert db["system_config"].records[0]["enabled"] is False


def adapter_for(db):
    adapter = MongoDBAdapter(ConnectionConfig(DatabaseBackend.MONGODB, "unused", "test"))
    adapter.database = db
    return adapter


@pytest.mark.asyncio
async def test_document_listing_filters_cannot_override_workspace():
    db = Database(documents=[{"_id": "a", "id": "a", "workspace_id": "elsewhere"}])
    assert await adapter_for(db).list_documents("local", filters={"workspace_id": "elsewhere"}) == []


@pytest.mark.asyncio
async def test_default_listing_does_not_hide_documents_after_fifty():
    db = Database(documents=[{"_id": str(i), "id": str(i), "workspace_id": "local"} for i in range(65)])
    assert len(await adapter_for(db).list_documents("local")) == 65


@pytest.mark.asyncio
async def test_changed_vector_collection_cannot_strand_legacy_vectors(legacy, monkeypatch):
    db, vectors = legacy
    monkeypatch.setattr("database.workspace_migration.get_environment_config", lambda: SimpleNamespace(
        qdrant=SimpleNamespace(collection_name="custom-collection")
    ))
    with pytest.raises(WorkspaceMigrationError, match="legacy collection"):
        await initialize_workspace(db, vectors)
    assert db.write_count == 0 and vectors.writes == []


@pytest.mark.asyncio
async def test_vector_deletion_filters_by_document_and_workspace():
    from services.qdrant_vector_service import QdrantVectorService
    service = QdrantVectorService()
    service.initialize = AsyncMock(return_value=True)
    service.async_client = SimpleNamespace(delete=AsyncMock())
    assert (await service.delete_document_chunks("document-a", "local"))["success"] is True
    request = service.async_client.delete.call_args.kwargs
    assert request["wait"] is True
    assert {condition.key: condition.match.value for condition in request["points_selector"].must} == {
        "document_id": "document-a", "workspace_id": "local",
    }


@pytest.mark.asyncio
async def test_file_metadata_cannot_override_workspace():
    from services.file_storage_service import GridFSFileStorage
    storage = GridFSFileStorage()
    storage._initialized = True
    storage._gridfs = SimpleNamespace(upload_from_stream=AsyncMock(return_value="file-a"))
    await storage.store_file(b"%PDF-test", "sample.pdf", "application/pdf", "local", {"workspace_id": "elsewhere"})
    assert storage._gridfs.upload_from_stream.call_args.kwargs["metadata"]["workspace_id"] == "local"


@pytest.mark.asyncio
async def test_document_delete_removes_only_matching_workspace_interactions():
    db = Database(
        documents=[{"_id": "a", "id": "document", "workspace_id": "local"}],
        user_interactions=[
            {"_id": "a", "document_id": "document", "workspace_id": "local"},
            {"_id": "b", "document_id": "document", "workspace_id": "elsewhere"},
        ],
    )
    assert await adapter_for(db).delete_document("document", "local") is True
    assert db["user_interactions"].records == [{"_id": "b", "document_id": "document", "workspace_id": "elsewhere"}]


@pytest.mark.asyncio
async def test_unknown_document_cannot_trigger_deletion():
    service = DocumentService()
    service._db = SimpleNamespace(get_document=AsyncMock(return_value=None))
    assert await service.delete_document_for_workspace("missing", "local") is False


@pytest.mark.asyncio
async def test_retention_is_disabled_by_default():
    service = DocumentService()
    service.get_system_config = AsyncMock(return_value=None)
    assert (await service.get_auto_delete_config())["enabled"] is False
    assert (await service.cleanup_expired_documents())["skipped"] is True


def scoped_deletion_library(monkeypatch):
    from services.file_storage_service import GridFSFileStorage
    file_ids = [ObjectId() for _ in range(4)]
    db = Database(**{
        "documents": [
            {"_id": "a", "id": "a", "workspace_id": "local", "pdf_file_id": str(file_ids[0]),
             "chat_session": {"messages": [{"content": "review"}]}, "clauses": [{"id": "clause-a"}]},
            {"_id": "b", "id": "b", "workspace_id": "local", "pdf_file_id": str(file_ids[2])},
            {"_id": "foreign", "id": "a", "workspace_id": "elsewhere", "pdf_file_id": str(file_ids[3])},
        ],
        "user_interactions": [
            {"_id": "a", "document_id": "a", "workspace_id": "local", "interactions": {"clause-a": {"notes": ["note"]}}},
            {"_id": "b", "document_id": "b", "workspace_id": "local"},
            {"_id": "foreign", "document_id": "a", "workspace_id": "elsewhere"},
        ],
        "pdf_files.files": [
            {"_id": file_ids[0], "metadata": {"document_id": "a", "workspace_id": "local"}},
            {"_id": file_ids[1], "metadata": {"document_id": "a", "workspace_id": "local"}},
            {"_id": file_ids[2], "metadata": {"document_id": "b", "workspace_id": "local"}},
            {"_id": file_ids[3], "metadata": {"document_id": "a", "workspace_id": "elsewhere"}},
        ],
        "pdf_files.chunks": [{"_id": i, "files_id": file_id, "data": b"synthetic"} for i, file_id in enumerate(file_ids)],
        "library_answers": [
            {"_id": "answer-a", "workspace_id": "local", "document_ids": ["a", "b"], "question": "Synthetic question",
             "context": {"hits": ["synthetic"]}, "evidence": ["synthetic"], "statements": ["synthetic"], "status": "completed"},
            {"_id": "answer-b", "workspace_id": "local", "document_ids": ["b"], "question": "Preserve other question"},
            {"_id": "answer-foreign", "workspace_id": "elsewhere", "document_ids": ["a"], "question": "Preserve foreign question"},
        ],
    })
    vectors = [
        {"id": "a-0", "document_id": "a", "workspace_id": "local", "user_id": "legacy-owner"},
        {"id": "a-1", "document_id": "a", "workspace_id": "local"},
        {"id": "b-0", "document_id": "b", "workspace_id": "local"},
        {"id": "foreign", "document_id": "a", "workspace_id": "elsewhere"},
    ]

    async def delete_file(file_id):
        await db["pdf_files.files"].delete_one({"_id": file_id})
        await db["pdf_files.chunks"].delete_many({"files_id": file_id})

    async def delete_vectors(document_id, workspace_id):
        vectors[:] = [point for point in vectors if not (
            point["document_id"] == document_id and point["workspace_id"] == workspace_id
        )]
        return True

    storage = GridFSFileStorage()
    storage._initialized = True
    storage._db = db
    storage._gridfs = SimpleNamespace(delete=AsyncMock(side_effect=delete_file))
    rag = SimpleNamespace(delete_document_from_rag=AsyncMock(side_effect=delete_vectors))
    monkeypatch.setattr("services.file_storage_service.get_file_storage_service", lambda: storage)
    monkeypatch.setattr("services.rag_service.get_rag_service", lambda: rag)
    service = DocumentService()
    service._db = adapter_for(db)
    return service, db, storage, rag, vectors, file_ids


@pytest.mark.asyncio
async def test_delete_removes_chat_notes_every_pdf_and_chunks_only_for_target(monkeypatch):
    service, db, storage, rag, vectors, file_ids = scoped_deletion_library(monkeypatch)
    assert await service.delete_document_for_workspace("a", "local") is True
    assert {record["_id"] for record in db["documents"].records} == {"b", "foreign"}
    assert {record["_id"] for record in db["user_interactions"].records} == {"b", "foreign"}
    assert {record["_id"] for record in db["pdf_files.files"].records} == set(file_ids[2:])
    assert {record["files_id"] for record in db["pdf_files.chunks"].records} == set(file_ids[2:])
    assert {point["id"] for point in vectors} == {"b-0", "foreign"}
    answers = {row["_id"]: row for row in db["library_answers"].records}
    removed = answers["answer-a"]
    assert removed["status"] == "source_unavailable" and not removed["evidence"] and not removed["statements"]
    assert "question" not in removed and "context" not in removed
    assert answers["answer-b"]["question"] == "Preserve other question"
    assert answers["answer-foreign"]["question"] == "Preserve foreign question"


@pytest.mark.asyncio
async def test_corrupt_pdf_pointer_cannot_delete_another_document(monkeypatch):
    service, db, storage, rag, vectors, file_ids = scoped_deletion_library(monkeypatch)
    db["documents"].records[0]["pdf_file_id"] = str(file_ids[2])
    assert await service.delete_document_for_workspace("a", "local") is False
    storage._gridfs.delete.assert_not_awaited()
    rag.delete_document_from_rag.assert_not_awaited()
    assert len(db["documents"].records) == 3


@pytest.mark.asyncio
async def test_partial_vector_failure_keeps_document_and_retries_safely(monkeypatch):
    service, db, storage, rag, vectors, file_ids = scoped_deletion_library(monkeypatch)
    real_delete = rag.delete_document_from_rag.side_effect
    rag.delete_document_from_rag.side_effect = None
    rag.delete_document_from_rag.return_value = False
    assert await service.delete_document_for_workspace("a", "local") is False
    assert await db["documents"].find_one({"id": "a", "workspace_id": "local"}) is not None
    assert await db["user_interactions"].find_one({"document_id": "a", "workspace_id": "local"}) is not None
    rag.delete_document_from_rag.side_effect = real_delete
    assert await service.delete_document_for_workspace("a", "local") is True


@pytest.mark.asyncio
async def test_file_failure_keeps_mongo_and_vectors_for_retry(monkeypatch):
    service, db, storage, rag, vectors, file_ids = scoped_deletion_library(monkeypatch)
    storage._gridfs.delete.side_effect = RuntimeError("synthetic failure")
    assert await service.delete_document_for_workspace("a", "local") is False
    rag.delete_document_from_rag.assert_not_awaited()
    assert len(db["documents"].records) == 3


@pytest.mark.asyncio
async def test_bulk_delete_has_no_thousand_document_ceiling():
    db = Database(documents=[{"_id": str(i), "id": str(i), "workspace_id": "local"} for i in range(1105)])
    service = DocumentService()
    service._db = adapter_for(db)

    async def delete_one(document_id, workspace_id):
        return bool((await db["documents"].delete_one({"id": document_id, "workspace_id": workspace_id})).deleted_count)

    service.delete_document_for_workspace = AsyncMock(side_effect=delete_one)
    assert await service.delete_all_documents_for_workspace("local") == 1105
    assert db["documents"].records == []


@pytest.mark.asyncio
async def test_bulk_delete_partial_failure_does_not_report_all_deleted():
    service = DocumentService()
    service._db = SimpleNamespace(list_documents=AsyncMock(return_value=[{"id": "a"}, {"id": "b"}]))
    service.delete_document_for_workspace = AsyncMock(side_effect=[True, False])
    with pytest.raises(DatabaseError, match="cleanup is incomplete"):
        await service.delete_all_documents_for_workspace("local")
    assert service._db.list_documents.await_count == 1


@pytest.mark.asyncio
async def test_retention_uses_created_date_with_upload_fallback_and_workspace_scope():
    db = Database(documents=[
        {"_id": "old", "id": "old", "workspace_id": "local", "created_at": "2000-01-01", "upload_date": "2000-01-01"},
        {"_id": "fallback", "id": "fallback", "workspace_id": "local", "upload_date": "2000-01-01"},
        {"_id": "recent", "id": "recent", "workspace_id": "local", "created_at": "2999-01-01", "upload_date": "2000-01-01"},
        {"_id": "foreign", "id": "foreign", "workspace_id": "elsewhere", "created_at": "2000-01-01"},
    ])
    service = DocumentService()
    service._db = adapter_for(db)
    assert {record["id"] for record in await service.get_expired_documents(30)} == {"old", "fallback"}


@pytest.mark.asyncio
async def test_retention_calls_complete_scoped_cleanup_and_reports_failures(monkeypatch):
    service, db, storage, rag, vectors, file_ids = scoped_deletion_library(monkeypatch)
    service.get_auto_delete_config = AsyncMock(return_value={"enabled": True, "days": 30})
    service.get_expired_documents = AsyncMock(return_value=[
        {"id": "a", "workspace_id": "local"}, {"id": "a", "workspace_id": "elsewhere"},
    ])
    result = await service.cleanup_expired_documents()
    assert result["deleted_count"] == 1 and result["failed_count"] == 1
    assert {record["_id"] for record in db["documents"].records} == {"b", "foreign"}


@pytest.mark.asyncio
@pytest.mark.parametrize("shape", ["array", "dictionary"])
async def test_migration_preserves_legacy_chat_container_shape(legacy, shape):
    db, vectors = legacy
    session = {"user_id": "owner-a", "messages": [{"id": "message", "content": "kept"}]}
    db["documents"].records[0]["chat_sessions"] = [session] if shape == "array" else {"session-a": session}
    await initialize_workspace(db, vectors)
    context = db["documents"].records[0]["chat_sessions"]
    migrated_session = context[0] if shape == "array" else context["session-a"]
    if shape == "dictionary":
        assert list(context) == ["session-a"]
    assert migrated_session["workspace_id"] == "local"
    assert migrated_session["messages"] == session["messages"]


@pytest.mark.asyncio
async def test_migration_preserves_clause_map_and_nested_note_identity(legacy):
    db, vectors = legacy
    interaction = db["user_interactions"].records[0]["interactions"]["clause-a"]
    interaction["notes"][0]["user_id"] = "owner-a"
    await initialize_workspace(db, vectors)
    context = db["user_interactions"].records[0]["interactions"]
    assert list(context) == ["clause-a"]
    assert context["clause-a"]["notes"][0] == {
        "id": "note-a", "text": "kept", "user_id": "owner-a", "workspace_id": "local",
    }


@pytest.mark.asyncio
@pytest.mark.parametrize("shape", [[], {"clause-a": "not-an-interaction"}])
async def test_malformed_interaction_container_refused_before_writes(legacy, shape):
    db, vectors = legacy
    db["user_interactions"].records[0]["interactions"] = shape
    with pytest.raises(WorkspaceMigrationError, match="malformed legacy document interactions"):
        await initialize_workspace(db, vectors)
    assert db.write_count == 0 and not vectors.writes


@pytest.mark.asyncio
async def test_migration_infers_missing_pdf_document_metadata_from_unique_pointer(legacy):
    db, vectors = legacy
    db["pdf_files.files"].records[0]["metadata"].pop("document_id")
    await initialize_workspace(db, vectors)
    assert db["pdf_files.files"].records[0]["metadata"]["document_id"] == "document-a"


@pytest.mark.asyncio
async def test_migration_refuses_conflicting_pdf_pointer_before_writes(legacy):
    db, vectors = legacy
    db["pdf_files.files"].records[0]["metadata"]["document_id"] = "different-document"
    with pytest.raises(WorkspaceMigrationError, match="PDF pointer conflicts"):
        await initialize_workspace(db, vectors)
    assert db.write_count == 0 and not vectors.writes


@pytest.mark.asyncio
async def test_vector_search_keeps_document_scope_and_hides_preserved_legacy_owner():
    from services.qdrant_vector_service import QdrantVectorService
    service = QdrantVectorService()
    service.initialize = AsyncMock(return_value=True)
    service._generate_embedding = AsyncMock(return_value=[0.1])
    payload = {"user_id": "legacy-owner", "workspace_id": "local", "document_id": "a", "text": "text", "chunk_index": 2}
    service.async_client = SimpleNamespace(query_points=AsyncMock(return_value=SimpleNamespace(
        points=[SimpleNamespace(payload=payload, score=0.8)]
    )))
    chunks = await service.search_similar_chunks("question", "local", "a")
    assert "user_id" not in chunks[0]["metadata"]
    assert payload["user_id"] == "legacy-owner"
    query = service.async_client.query_points.call_args.kwargs
    assert {condition.key: condition.match.value for condition in query["query_filter"].must} == {
        "document_id": "a", "workspace_id": "local",
    }


@pytest.mark.asyncio
async def test_cleanup_database_failure_is_not_reported_as_empty_library():
    service = DocumentService()
    service.get_auto_delete_config = AsyncMock(return_value={"enabled": True, "days": 30})
    service._get_db = AsyncMock(side_effect=RuntimeError("synthetic private connection detail"))
    result = await service.cleanup_expired_documents()
    assert result["errors"] == ["Document cleanup failed"]


@pytest.mark.asyncio
async def test_startup_cleanup_uses_current_opt_in_configuration(monkeypatch):
    from services import cleanup_service
    service = DocumentService()
    service.get_system_config = AsyncMock(return_value={"enabled": False, "days": 0})
    service.get_expired_documents = AsyncMock(side_effect=AssertionError("Must not scan while disabled"))
    coordinator = cleanup_service.DocumentCleanupService()
    monkeypatch.setattr("database.service.get_document_service", lambda: service)
    monkeypatch.setattr(cleanup_service, "get_cleanup_service", lambda: coordinator)
    monkeypatch.setattr(cleanup_service.asyncio, "sleep", AsyncMock())
    await cleanup_service.run_startup_cleanup()
    assert coordinator.get_status()["last_result"]["skipped"] is True
    service.get_expired_documents.assert_not_awaited()
