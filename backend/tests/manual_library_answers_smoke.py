"""Opt-in isolated Mongo/GridFS answer lifecycle, with actual providers forbidden."""

import argparse
import asyncio
from contextlib import ExitStack, asynccontextmanager
import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from database.library_answers import AnswerRepository
from models.library_answers import StartAnswer
from services.ai.text_extractor import TextExtractor
from services.file_storage_service import GridFSFileStorage
from services.library_answers.context import SearchContexts, capture_search
from services.library_answers.service import LibraryAnswerService
from services.library_search import LibrarySearchService
from services.source_service import SourceService
from tests.manual_source_smoke import document_service, isolated_adapter


async def run():
    token = uuid4().hex
    name = f"clauseiq_answers_smoke_{token}"
    adapter = isolated_adapter(name)
    owned = False
    report = {"passed": False, "provider_calls": 0, "stub_calls": 0, "checks": [], "leftovers": []}
    try:
        await adapter.connect()
        initial = set(await adapter.client.list_database_names())
        assert name not in initial
        await adapter.database.smoke_owner.insert_one({"token": token, "purpose": "synthetic-library-answers"})
        owned = True
        with ExitStack() as stack:
            stack.enter_context(patch("openai.AsyncOpenAI", side_effect=AssertionError("No provider allowed")))
            stack.enter_context(patch("openai.OpenAI", side_effect=AssertionError("No provider allowed")))
            stack.enter_context(patch("database.factory.DatabaseFactory.get_database", AsyncMock(return_value=adapter)))
            storage = GridFSFileStorage()
            assert await storage.initialize()
            stack.enter_context(patch("services.file_storage_service.get_file_storage_service", return_value=storage))
            documents = document_service(adapter)
            documents.get_workspace_api_key = AsyncMock(return_value="noncredential-stub")
            documents.get_workspace_generation_settings = AsyncMock(return_value={"model_id": "gpt-6-sol", "reasoning_effort": "medium"})
            content = (Path(__file__).resolve().parents[2] / "tests/fixtures/pdfs/service-terms-conflict.pdf").read_bytes()
            source = await SourceService(documents, TextExtractor()).import_pdf(content, "synthetic-terms.pdf", "answer-smoke")
            result = await LibrarySearchService(documents).search("answer-smoke", "30 days 7 days invoice")
            store = SearchContexts()
            context_id = await capture_search(documents, "answer-smoke", "30 days 7 days invoice", "keyword", result.model_dump(), store)
            assert context_id

            @asynccontextmanager
            async def client_factory(key):
                assert key == "noncredential-stub"
                async def create(**kwargs):
                    assert kwargs["store"] is False
                    assert await (await AnswerRepository(documents).collection()).count_documents({"status": "processing"}) == 1
                    report["stub_calls"] += 1
                    return SimpleNamespace(choices=[SimpleNamespace(finish_reason="stop", message=SimpleNamespace(
                        refusal=None, content=json.dumps({"outcome": "partial", "statements": [
                            {"text": "Synthetic lifecycle response; not a quality assessment.", "evidence_ids": ["S1"]}],
                            "limitations": ["This output is a deterministic provider stub."]})))],
                        usage=SimpleNamespace(prompt_tokens=100, completion_tokens=50, total_tokens=150))
                client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
                client.with_options = lambda **kwargs: client
                yield client

            engine = LibraryAnswerService(documents, store=store, client_factory=client_factory)
            preview = await engine.preview("answer-smoke", context_id)
            documents.get_workspace_api_key.assert_not_awaited()
            request = StartAnswer(context_id=context_id, request_id=uuid4(), model_id="gpt-6-sol", reasoning_effort="medium", confirm_paid=True)
            results = await asyncio.gather(engine.start("answer-smoke", request), engine.start("answer-smoke", request))
            assert any(row["status"] == "completed" for row in results) and report["stub_calls"] == 1
            report["checks"].append("durable claim before dispatch and concurrent duplicate fence")
            restarted = LibraryAnswerService(documents, store=SearchContexts(), client_factory=client_factory)
            saved = await restarted.start("answer-smoke", request)
            assert saved["status"] == "completed" and saved["evidence"] == preview["evidence"]
            assert saved["generation"]["usage"]["total_tokens"] == 150 and report["stub_calls"] == 1
            assert saved["retrieval_trace"] == result.trace
            assert saved["answer_trace"]["parent_trace_id"] == result.trace["trace_id"]
            assert saved["answer_trace"]["prompt_tokens"] == 100
            assert saved["answer_trace"]["completion_tokens"] == 50
            report["checks"].append("content-free retrieval/answer correlation persisted across restart")
            assert len(await restarted.recent("answer-smoke")) == 1
            assert await restarted.recent("other-workspace") == []
            assert (await documents.get_pdf_file(source["id"], "answer-smoke"))["content"] == content
            report["checks"].append("restart readback, exact evidence, usage, workspace scope and original bytes")

            second = request.model_copy(update={"request_id": uuid4()})
            await engine.start("answer-smoke", second)
            collection = await engine.repository.collection()
            await collection.update_one({"request_id": str(second.request_id)}, {"$set": {"status": "processing", "statements": []}})
            assert (await restarted.read("answer-smoke", second.request_id))["status"] == "interrupted"
            assert (await restarted.interrupt("answer-smoke", second.request_id))["status"] == "interrupted"
            assert not await engine.repository.finish("answer-smoke", str(second.request_id), {"status": "completed"})
            report["checks"].append("interrupted persisted attempt and late-result fence")

            # No semantic or legacy vectors were created by this smoke.
            stack.enter_context(patch("services.rag_service.get_rag_service", return_value=SimpleNamespace(delete_document_from_rag=AsyncMock(return_value=True))))
            assert await documents.delete_document_for_workspace(source["id"], "answer-smoke")
            tombstone = await restarted.start("answer-smoke", request)
            assert tombstone["status"] == "source_unavailable" and not tombstone["evidence"] and not tombstone["statements"]
            row = await engine.repository.get("answer-smoke", str(request.request_id))
            assert "question" not in row and "context" not in row
            assert report["stub_calls"] == 2
            assert await documents.get_pdf_file(source["id"], "answer-smoke") is None
            report["checks"].append("normal document deletion removes answer content while retaining no-resend receipts")
        report["passed"] = True
    finally:
        if owned:
            try:
                owner = await adapter.database.smoke_owner.find_one({"token": token, "purpose": "synthetic-library-answers"})
                assert owner and adapter.database.name == f"clauseiq_answers_smoke_{token}"
                await adapter.client.drop_database(name)
                assert name not in set(await adapter.client.list_database_names())
            except Exception:
                report["leftovers"].append(name)
                report["passed"] = False
                raise
            finally:
                await adapter.disconnect()
                print(json.dumps(report, indent=2))
        else:
            await adapter.disconnect()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-isolated-live", action="store_true")
    if parser.parse_args().run_isolated_live:
        asyncio.run(run())
    else:
        print("Dry run: --run-isolated-live permits verified-owned temporary Mongo/GridFS data. No paid calls.")
