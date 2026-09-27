"""Opt-in synthetic runtime smoke. Default is key-free and storage-free.

Real runtime services, real isolated Mongo/GridFS/Qdrant, real embeddings.
Never writes the person's library; no generation, retries, fallback or resume.
"""

import argparse
import asyncio
from contextlib import ExitStack
from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal
import hashlib
import json
import logging
import os
from pathlib import Path
import time
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from evaluations.library_search_cases import ROOT, FIXTURE_DIRECTORY, prepare_corpus
from evaluations.retrieval_embeddings import write_exclusive
from models.library_semantic import IndexRequest, SemanticSearchRequest
from services.library_semantic.provider import embed
from services.library_semantic.service import LibrarySemanticService
from services.library_semantic.source import (
    DIMENSIONS, MAX_TOTAL_TOKENS, MODEL, PRICE_PER_MILLION, PRICE_VERIFIED_ON,
    VERSION, cost, digest, source_plan, token_count,
)

DOCUMENTS = ("service-terms-conflict", "managed-services-25p")
CASES = ("exception-01", "exception-04", "multi-03", "none-02")
OUTPUT_ROOT = ROOT / ".local-only/semantic-runtime-v2"
ENDPOINT = "https://api.openai.com/v1/"


@dataclass
class Prepared:
    corpus: object
    documents: list
    cases: list
    inputs: list
    manifest: dict

    @property
    def identity(self):
        return digest(self.manifest)


async def prepare():
    corpus = await prepare_corpus()
    documents = [next(d for d in corpus.documents if d["id"] == identity) for identity in DOCUMENTS]
    cases = [next(c for c in corpus.dataset.cases if c.id == identity) for identity in CASES]
    inputs = [[p.text for p in source_plan(d).passages.values()] for d in documents]
    inputs.extend([[case.query] for case in cases])
    counts = [token_count(batch) for batch in inputs]
    if any(corpus.dataset.anchors[key].document_id not in DOCUMENTS for case in cases for key in case.anchors):
        raise ValueError("Selected case needs an agreement outside the fixed corpus")
    paths = sorted((ROOT / "backend/services/library_semantic").glob("*.py"))
    paths += [Path(__file__), ROOT / "backend/database/library_semantic.py",
              ROOT / "backend/database/service.py", ROOT / "backend/services/source_service.py",
              ROOT / "backend/services/ai/review_passages.py", ROOT / "backend/services/ai/text_extractor.py",
              ROOT / "backend/services/retrieval_policy.py", ROOT / "backend/services/ai/client_manager.py"]
    manifest = {"version": "semantic-runtime-smoke-v2", "index_version": VERSION,
        "model": MODEL, "dimensions": DIMENSIONS, "dataset_sha256": corpus.dataset_sha256,
        "documents": [{"id": d["id"], "sha256": d["source_sha256"],
                       "eligible_passages": len(source_plan(d).passages),
                       "excluded_headers": source_plan(d).excluded_headers} for d in documents],
        "cases": [case.model_dump() for case in cases], "limit": 5,
        "input_hashes": [digest(batch) for batch in inputs], "estimated_tokens": counts,
        "estimated_usd": cost(sum(counts)), "reserved_usd": cost(MAX_TOTAL_TOKENS * len(inputs)),
        "price_verified_on": PRICE_VERIFIED_ON, "usd_per_million_input_tokens": str(PRICE_PER_MILLION),
        "pricing_source": f"https://developers.openai.com/api/docs/models/{MODEL}",
        "code_sha256": {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest() for path in paths},
        "limits": "Two known synthetic agreements; four inspected regression questions, not a benchmark. No answers."}
    return Prepared(corpus, documents, cases, inputs, manifest)


def approve(prepared, cap_usd, approved_plan):
    cap = Decimal(cap_usd or "NaN")
    if not cap.is_finite() or cap <= 0 or prepared.identity != approved_plan:
        raise ValueError("An exact dry-run plan and finite positive cap are required")
    if Decimal(prepared.manifest["reserved_usd"]) > cap:
        raise ValueError("Full request reservations exceed the approved ceiling")
    age = (date.today() - date.fromisoformat(PRICE_VERIFIED_ON)).days
    if not 0 <= age <= 7:
        raise ValueError("Recheck official pricing before another live run")
    if os.environ.get("OPENAI_BASE_URL", ENDPOINT).rstrip("/") != ENDPOINT.rstrip("/"):
        raise ValueError("This smoke requires the official OpenAI endpoint")
    return cap


class RecordedProvider:
    """Bound actual runtime embed() calls to the approved sequence and ledger."""
    def __init__(self, prepared, record, delegate=embed):
        self.prepared, self.record, self.delegate = prepared, record, delegate
        self.outcomes = []
        self.dispatched = 0
        self.halted = False

    async def __call__(self, texts, key):
        index = self.dispatched
        if (self.halted or index >= len(self.prepared.inputs)
                or digest(texts) != self.prepared.manifest["input_hashes"][index]):
            raise ValueError("Dispatch does not match the approved sequence")
        self.record({"event": "dispatch_outcome_unknown", "request": index,
                     "reserved_usd": cost(MAX_TOTAL_TOKENS)})
        self.dispatched += 1
        started = time.perf_counter()
        try:
            vectors, usage = await self.delegate(texts, key)
            outcome = {"request": index, "provider_input_tokens": usage,
                       "usage_based_usd": cost(usage),
                       "provider_ms": round((time.perf_counter() - started) * 1000, 2)}
            self.record({"event": "response_accepted", **outcome})
            self.outcomes.append(outcome)
            return vectors, usage
        except BaseException:
            self.halted = True
            raise


def assess(prepared, case, result, runtime_documents):
    by_id = {document["id"]: (identity, document) for identity, document in runtime_documents.items()}
    hits = []
    observed = set()
    for hit in result["results"]:
        identity, document = by_id[hit["document_id"]]
        passage = source_plan(document).passages[hit["passage_id"]]
        if (hit["source_revision_id"] != document["source_revision_id"]
                or hit["page_number"] != passage.page_number or hit["excerpt"] != passage.text):
            raise ValueError("Runtime hit does not match its own source passage")
        key = (identity, hit["page_number"], hit["passage_id"])
        if key in observed:
            raise ValueError("Duplicate result consumes a retrieval slot")
        observed.add(key)
        hits.append({"document": identity, "page": hit["page_number"], "passage": hit["passage_id"],
                     "excerpt": hit["excerpt"]})
    expected = {key: prepared.corpus.dataset.anchors[key] for key in case.anchors}
    found = [key for key, anchor in expected.items()
             if (anchor.document_id, anchor.page_number, anchor.passage_id) in observed]
    return {"case": case.id, "query": case.query, "expected": list(expected), "found": found,
            "missing": sorted(set(expected) - set(found)), "hits": hits,
            "no_answer_returned_candidates": not expected and bool(hits),
            "coverage": result["coverage"], "source_validation": "passed"}


async def run_storage(prepared, provider, key_loader, record, *, query_runner=None):
    """Only temporary stores are writable; load saved key after storage preflight."""
    from qdrant_client import AsyncQdrantClient
    from services.ai.text_extractor import TextExtractor
    from services.file_storage_service import GridFSFileStorage
    from services.library_semantic.vectors import LibraryVectors
    from services.source_service import SourceService
    from tests.manual_source_smoke import isolated_adapter, document_service

    token = uuid4().hex
    name = f"clauseiq_semantic_live_{token}"
    adapter = isolated_adapter(name)
    vectors = LibraryVectors(AsyncQdrantClient(host="127.0.0.1", port=6333, timeout=10), name)
    owned_database = owned_collection = False
    try:
        await adapter.connect()
        if name in await adapter.client.list_database_names() or await vectors.exists():
            raise ValueError("Fixture namespace already exists")
        await adapter.database.smoke_owner.insert_one({"token": token, "purpose": "semantic-live-smoke"})
        owned_database = True
        record({"event": "owned_stores", "namespace": name})
        # Creation can fail after Qdrant accepts it. Ownership was proven above;
        # cleanup must also cover that partial initialization.
        owned_collection = True
        await vectors.ensure()
        key = await key_loader()
        if not key:
            raise ValueError("No saved Settings key; no paid call made")
        runtime_documents = {}
        with ExitStack() as stack:
            stack.enter_context(patch("database.factory.DatabaseFactory.get_database", AsyncMock(return_value=adapter)))
            storage = GridFSFileStorage()
            if not await storage.initialize():
                raise ValueError("Isolated original storage unavailable")
            stack.enter_context(patch("services.file_storage_service.get_file_storage_service", return_value=storage))
            documents = document_service(adapter)
            documents.get_workspace_api_key = AsyncMock(return_value=key)
            source = SourceService(documents, TextExtractor())
            for original in prepared.documents:
                content = (FIXTURE_DIRECTORY / original["filename"]).read_bytes()
                if hashlib.sha256(content).hexdigest() != original["source_sha256"]:
                    raise ValueError("Fixture bytes changed after preflight")
                document = await source.import_pdf(content, original["filename"], "synthetic-live")
                if document["source_extraction"] != original["source_extraction"]:
                    raise ValueError("Runtime extraction differs from the prepared source")
                runtime_documents[original["id"]] = document
            engine = LibrarySemanticService(documents, vectors, provider)
            for identity, document in runtime_documents.items():
                plan = await engine.plan("synthetic-live", document["id"])
                request = IndexRequest(request_id=uuid4(), fingerprint=plan["fingerprint"],
                                       expected_generation=plan["expected_generation"], confirm_paid=True)
                started = time.perf_counter()
                result = await engine.index("synthetic-live", document["id"], request)
                if result["status"] != "ready":
                    raise ValueError("Index did not become ready")
                calls_before = provider.dispatched
                replay = await engine.index("synthetic-live", document["id"], request)
                if replay["status"] != "ready" or provider.dispatched != calls_before:
                    raise ValueError("Index replay dispatched again")
                record({"event": "index_ready", "fixture": identity, "passages": result["passages"],
                        "excluded_headers": result["excluded_headers"],
                        "index_ms": round((time.perf_counter() - started) * 1000, 2)})
            if query_runner is not None:
                return await query_runner(engine, documents, runtime_documents)
            results = []
            for case in prepared.cases:
                started = time.perf_counter()
                result = await engine.search("synthetic-live", SemanticSearchRequest(
                    query=case.query, limit=5, request_id=uuid4(), confirm_paid=True))
                assessment = assess(prepared, case, result, runtime_documents)
                assessment["service_ms"] = round((time.perf_counter() - started) * 1000, 2)
                results.append(assessment)
                record({"event": "query_assessed", **assessment})
            if provider.dispatched != len(prepared.inputs):
                raise ValueError("The approved sequence was not completed")
            return results
    finally:
        leftovers = []
        if owned_database:
            owner = await adapter.database.smoke_owner.find_one({"token": token})
            if not owner or adapter.database.name != name:
                raise ValueError("Cleanup ownership is unconfirmed; stores retained")
            if owned_collection:
                try:
                    if await vectors.exists():
                        await vectors.client.delete_collection(name)
                    if await vectors.exists():
                        leftovers.append("qdrant")
                except Exception:
                    leftovers.append("qdrant")
            # Retain ownership marker if vector cleanup needs a later explicit fix.
            if not leftovers:
                try:
                    await adapter.client.drop_database(name)
                    if name in await adapter.client.list_database_names():
                        leftovers.append("mongo")
                except Exception:
                    leftovers.append("mongo")
            record({"event": "cleanup", "namespace": name, "leftovers": leftovers})
        await vectors.close()
        await adapter.disconnect()
        if leftovers:
            raise RuntimeError("Fixture cleanup incomplete; inspect the private ledger")


async def collect(prepared, cap_usd, approved_plan, *, key_loader, runner=run_storage, directory=None):
    cap = approve(prepared, cap_usd, approved_plan)
    directory = directory or OUTPUT_ROOT / prepared.identity
    directory.mkdir(mode=0o700, parents=True, exist_ok=False)
    write_exclusive(directory / "plan.json", {"plan_sha256": prepared.identity,
                    "cap_usd": str(cap), "manifest": prepared.manifest})
    with (directory / "ledger.jsonl").open("x", encoding="utf-8") as ledger:
        def record(event):
            ledger.write(json.dumps({"at": datetime.now(timezone.utc).isoformat(), **event}, allow_nan=False) + "\n")
            ledger.flush()
            os.fsync(ledger.fileno())
        record({"event": "reserved", "reserved_usd": prepared.manifest["reserved_usd"]})
        provider = RecordedProvider(prepared, record)
        try:
            results = await runner(prepared, provider, key_loader, record)
            report = {"status": "completed", "plan_sha256": prepared.identity, "results": results,
                      "requests": provider.outcomes, "paid_requests": provider.dispatched,
                      "total_usage_based_usd": str(sum(Decimal(row["usage_based_usd"]) for row in provider.outcomes)),
                      "reserved_usd": prepared.manifest["reserved_usd"], "reservations_reclaimed_usd": "0"}
        except (Exception, asyncio.CancelledError) as error:
            report = {"status": "halted", "plan_sha256": prepared.identity,
                      "error_type": type(error).__name__, "paid_requests": provider.dispatched,
                      "requests": provider.outcomes, "reserved_usd": prepared.manifest["reserved_usd"],
                      "reservations_reclaimed_usd": "0"}
        write_exclusive(directory / "report.json", report)
        record({"event": report["status"], "paid_requests": provider.dispatched})
        return report


async def main(arguments):
    prepared = await prepare()
    if not arguments.run_paid:
        return {"dry_run": True, "credential_access": False, "storage_access": False,
                "plan_sha256": prepared.identity, "manifest": prepared.manifest}
    # Normal app key retrieval, read-only. Never print or persist the key.
    logging.disable(logging.CRITICAL)
    from database.factory import DatabaseFactory
    from services.workspace_service import get_workspace_service
    try:
        return await collect(prepared, arguments.cap_usd, arguments.approved_plan,
                             key_loader=get_workspace_service().get_api_key)
    finally:
        await DatabaseFactory.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-paid", action="store_true")
    parser.add_argument("--cap-usd")
    parser.add_argument("--approved-plan")
    try:
        report = asyncio.run(main(parser.parse_args()))
        print(json.dumps(report, indent=2, allow_nan=False))
        raise SystemExit(0 if report.get("dry_run") or report["status"] == "completed" else 1)
    except Exception as error:
        print(json.dumps({"status": "refused_or_failed", "error_type": type(error).__name__}))
        raise SystemExit(1)
