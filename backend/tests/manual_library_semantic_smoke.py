"""Opt-in real MongoDB/GridFS/Qdrant check using isolated synthetic namespaces.

No application database/collection, saved key or provider is accessed. Existing
loopback services must already run. Only verified-owned temporary data is removed.
Run from backend: venv/bin/python tests/manual_library_semantic_smoke.py --run-isolated-live
"""

import argparse
import asyncio
from contextlib import ExitStack
import json
from pathlib import Path
import sys
from unittest.mock import AsyncMock, patch
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from qdrant_client import AsyncQdrantClient, models

from models.library_semantic import IndexRequest, SemanticSearchRequest
from services.ai.text_extractor import TextExtractor
from services.file_storage_service import GridFSFileStorage
from services.library_semantic.service import LibrarySemanticService
from services.library_semantic.source import DIMENSIONS, SemanticError
from services.library_semantic.vectors import LibraryVectors
from services.source_service import SourceService
from tests.manual_source_smoke import isolated_adapter, document_service


async def run():
    token = uuid4().hex
    name = f"clauseiq_semantic_smoke_{token}"
    adapter = isolated_adapter(name)
    client = AsyncQdrantClient(host="127.0.0.1", port=6333, timeout=10)
    previous_name = f"{name}_previous_small"
    vectors = LibraryVectors(client, name, cleanup_collections=(previous_name,))
    owned_database = owned_collection = owned_previous_collection = False
    report = {"passed": False, "provider_calls": 0, "checks": [], "leftovers": []}
    try:
        await adapter.connect()
        initial_databases = set(await adapter.client.list_database_names())
        initial_collections = {item.name for item in (await client.get_collections()).collections}
        assert name not in initial_databases and name not in initial_collections and previous_name not in initial_collections
        await adapter.database.smoke_owner.insert_one({"token": token, "purpose": "synthetic-semantic-storage"})
        owned_database = True
        await vectors.ensure()
        owned_collection = True
        owned_previous_collection = True
        await client.create_collection(previous_name, vectors_config=models.VectorParams(size=1536, distance=models.Distance.COSINE))
        with ExitStack() as stack:
            stack.enter_context(patch("openai.AsyncOpenAI", side_effect=AssertionError("No provider allowed")))
            stack.enter_context(patch("openai.OpenAI", side_effect=AssertionError("No provider allowed")))
            stack.enter_context(patch("database.factory.DatabaseFactory.get_database", AsyncMock(return_value=adapter)))
            storage = GridFSFileStorage()
            assert await storage.initialize()
            stack.enter_context(patch("services.file_storage_service.get_file_storage_service", return_value=storage))
            documents = document_service(adapter)
            documents.get_workspace_api_key = AsyncMock(return_value="stub-key-not-a-credential")
            sources = SourceService(documents, TextExtractor())
            content = (Path(__file__).resolve().parents[2] / "tests/fixtures/pdfs/service-terms-conflict.pdf").read_bytes()
            first = await sources.import_pdf(content, "synthetic-service-terms.pdf", "smoke-one")
            second = await sources.import_pdf(content, "synthetic-service-terms.pdf", "smoke-two")
            original_source = first["source_extraction"]
            await adapter._get_collection("user_interactions").insert_one({
                "document_id": first["id"], "workspace_id": "smoke-one", "note": "Synthetic saved note; preserve during indexing"})
            calls = []

            async def provider(texts, key):
                assert key == "stub-key-not-a-credential"
                calls.append(len(texts))
                return [[1.0] + [0.0] * (DIMENSIONS - 1) for _ in texts], len(texts)

            engine = LibrarySemanticService(documents, vectors, provider)
            old_generation = str(uuid4())
            await documents.update_document_data(first["id"], "smoke-one", {"semantic_index": {
                "version": "library-semantic-v1", "status": "ready", "generation_id": old_generation,
                "fingerprint": "0" * 64, "attempts": [old_generation]}})
            await client.upsert(previous_name, [models.PointStruct(id=str(uuid4()), vector=[1.0] * 1536,
                payload={"workspace_id": workspace, "document_id": document["id"], "generation_id": old_generation})
                for workspace, document in (("smoke-one", first), ("smoke-two", second))], wait=True)
            assert (await engine.status("smoke-one"))["documents"][0]["status"] == "stale"
            try:
                await engine.search("smoke-one", SemanticSearchRequest(query="payment", request_id=uuid4(), confirm_paid=True))
                raise AssertionError("Old embedding profile must never be queried")
            except SemanticError as error:
                assert error.code == "NO_CURRENT_INDEX"
            assert not calls and (await client.count(previous_name, exact=True)).count == 2
            documents.get_workspace_api_key.assert_not_awaited()
            report["checks"].append("small profile is stale without spending, vector mutation or key access")
            for workspace, document in (("smoke-one", first), ("smoke-two", second)):
                preview = await engine.plan(workspace, document["id"])
                assert not calls if workspace == "smoke-one" else len(calls) == 1
                request = IndexRequest(request_id=uuid4(), fingerprint=preview["fingerprint"],
                                       expected_generation=preview["expected_generation"], confirm_paid=True)
                results = await asyncio.gather(engine.index(workspace, document["id"], request), engine.index(workspace, document["id"], request))
                assert all(result["status"] == "ready" for result in results)
            assert len(calls) == 2
            assert (await client.get_collection(name)).config.params.vectors.size == DIMENSIONS == 3072
            assert (await client.count(previous_name, exact=True)).count == 1
            report["checks"].append("explicit rebuild uses large/3072 and cleans only its old small generation")
            report["checks"].append("real conditional publication and duplicate-attempt fencing")
            assert (await documents.get_pdf_file(first["id"], "smoke-one"))["content"] == content
            assert (await documents.get_document_for_workspace(first["id"], "smoke-one"))["source_extraction"] == original_source
            assert await adapter._get_collection("user_interactions").count_documents({"document_id": first["id"]}) == 1
            report["checks"].append("original PDF, source extraction and saved note preserved")
            request = SemanticSearchRequest(query="payment terms", request_id=uuid4(), confirm_paid=True, limit=5)
            result = await engine.search("smoke-one", request)
            assert result["results"] and all(hit["document_id"] == first["id"] for hit in result["results"])
            try:
                await engine.search("smoke-one", request)
                raise AssertionError("Duplicate semantic dispatch must be rejected")
            except SemanticError as error:
                assert error.code == "SEARCH_ALREADY_SUBMITTED"
            assert len(calls) == 3
            report["checks"].append("real Qdrant tuple scoping, exact source resolution and Mongo query receipt")
            await documents.update_document_data(first["id"], "smoke-one", {"source_revision_id": "synthetic-replacement-revision"})
            assert (await engine.status("smoke-one"))["documents"][0]["status"] == "stale"
            try:
                await engine.search("smoke-one", SemanticSearchRequest(query="payment", request_id=uuid4(), confirm_paid=True))
                raise AssertionError("Stale source must not dispatch")
            except SemanticError as error:
                assert error.code == "NO_CURRENT_INDEX"
            assert len(calls) == 3
            report["checks"].append("stale source excludes index before provider dispatch")

            async def isolated_vectors(_documents):
                return LibraryVectors(AsyncQdrantClient(host="127.0.0.1", port=6333, timeout=10), name,
                                      cleanup_collections=(previous_name,))
            stack.enter_context(patch("services.library_semantic.vectors.create_vectors", isolated_vectors))
            # No legacy chat vectors were created in this fixture namespace.
            stack.enter_context(patch("services.rag_service.get_rag_service", return_value=type("UnusedLegacy", (), {
                "delete_document_from_rag": AsyncMock(return_value=True)})()))
            assert await documents.delete_document_for_workspace(first["id"], "smoke-one")
            assert await documents.get_document_for_workspace(first["id"], "smoke-one") is None
            assert await documents.get_pdf_file(first["id"], "smoke-one") is None
            foreign = await documents.get_document_for_workspace(second["id"], "smoke-two")
            assert await vectors.count("smoke-two", second["id"], foreign["semantic_index"]["generation_id"]) > 0
            from services.library_semantic.vectors import scope_filter
            assert (await client.count(name, count_filter=scope_filter("smoke-one", first["id"]), exact=True)).count == 0
            report["checks"].append("normal document deletion cleans new vectors/GridFS while preserving other workspace")
            report["stub_embedding_requests"] = len(calls)
        report["passed"] = True
    finally:
        if owned_previous_collection:
            owner = await adapter.database.smoke_owner.find_one({"token": token})
            assert owner and previous_name == f"clauseiq_semantic_smoke_{token}_previous_small"
            if await client.collection_exists(previous_name):
                await client.delete_collection(previous_name)
        if owned_collection:
            owner = await adapter.database.smoke_owner.find_one({"token": token})
            assert owner and name == f"clauseiq_semantic_smoke_{token}"
            await client.delete_collection(name)
            assert {item.name for item in (await client.get_collections()).collections} == initial_collections
        if owned_database:
            owner = await adapter.database.smoke_owner.find_one({"token": token})
            assert owner and adapter.database.name == name
            await adapter.client.drop_database(name)
            assert set(await adapter.client.list_database_names()) == initial_databases
        await vectors.close()
        await adapter.disconnect()
        print(json.dumps(report, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-isolated-live", action="store_true")
    if parser.parse_args().run_isolated_live:
        asyncio.run(run())
    else:
        print("Dry run: pass --run-isolated-live to use owned temporary MongoDB/Qdrant namespaces. No provider calls.")
