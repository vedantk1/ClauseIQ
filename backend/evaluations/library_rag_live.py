"""Opt-in end-to-end RAG regression: real top-k, sources, storage and generation.

Default is a key-free plan. No retry, rewritten query, evidence substitution,
model switch or paid grader. Reuses verified-owned temporary storage cleanup.
"""

import argparse
import asyncio
from contextlib import asynccontextmanager
from datetime import date, datetime, timezone
from decimal import Decimal
import hashlib
import json
import logging
import os
from pathlib import Path
from unittest.mock import AsyncMock
from uuid import uuid4

from evaluations.library_answer_cases import prepare_cases
from evaluations.library_answer_live import EFFORT, ENDPOINT, ExactClient, MODEL, PER_CALL_RESERVATION, expected_request
from evaluations.library_search_cases import ROOT
from evaluations.library_semantic_live import RecordedProvider, prepare as prepare_retrieval, run_storage
from evaluations.retrieval_embeddings import write_exclusive
from models.library_answers import StartAnswer
from models.library_semantic import SemanticSearchRequest
from services.ai.client_manager import workspace_openai_client
from services.library_answers.context import SearchContexts, capture_search, fingerprint, resolve_evidence
from services.library_answers.generation import prepare
from services.library_answers.service import LibraryAnswerService
from services.library_search import LibrarySearchService
from services.library_semantic.provider import embed

PRICE_DATE = "2026-09-27"
OUTPUT_ROOT = ROOT / ".local-only/library-rag-evaluations"
WORKSPACE = "synthetic-live"
METHODS = ("keyword", "semantic")
CRITERIA = ("payment-both", "archive-both", "correction-both", "unsupported-payment")


def check_bounds(prepared):
    if (prepared.generation["estimated_input_tokens"] > 30_000
            or prepared.generation["max_completion_tokens"] > 6000 or prepared.timeout != 120):
        raise ValueError("Configured answer budget exceeds the frozen reservation")


async def plan():
    retrieval = await prepare_retrieval()
    answers = {case["id"]: case for case in await prepare_cases()}
    # Exercise the normal tokenizer/prompt/schema before credential access.
    # Actual top-k bundles are resolved and frozen again before each dispatch.
    criteria = []
    for identity in CRITERIA:
        case = answers[identity]
        check_bounds(prepare(case["context"], case["evidence"], MODEL, EFFORT))
        criteria.append({key: case[key] for key in ("id", "query_case", "criteria", "expected_outcome")})
    paths = [Path(__file__), ROOT / "backend/evaluations/library_answer_cases.py",
             ROOT / "backend/evaluations/library_answer_live.py", ROOT / "backend/services/library_trace.py",
             ROOT / "backend/services/library_search.py", ROOT / "backend/models/library_answers.py",
             ROOT / "backend/fixtures/library_answer_evaluations/cases.json",
             ROOT / "backend/database/library_answers.py", ROOT / "backend/services/ai/token_utils.py"]
    paths.extend(sorted((ROOT / "backend/services/library_answers").glob("*.py")))
    manifest = {"version": "library-rag-runtime-v1", "retrieval": retrieval.manifest,
        "model": MODEL, "effort": EFFORT, "methods": METHODS, "limit": 5, "criteria": criteria,
        "price_verified_on": PRICE_DATE, "pricing_source": "https://developers.openai.com/api/docs/pricing",
        "answer_reservation_usd": str(PER_CALL_RESERVATION),
        "reserved_usd": str(PER_CALL_RESERVATION * 8 + Decimal(retrieval.manifest["reserved_usd"])),
        "code_sha256": {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest() for path in paths},
        "assessment": "Inspected synthetic regression cases, not holdout or legal accuracy. Own-citation source review required."}
    return retrieval, manifest


def approve(manifest, cap, approved_plan):
    cap = Decimal(cap or "NaN")
    if (not cap.is_finite() or not 0 < cap <= Decimal("1.20")
            or Decimal(manifest["reserved_usd"]) > cap or approved_plan != fingerprint(manifest)):
        raise ValueError("Require exact plan and sufficient finite cap, at most USD1.20")
    if not 0 <= (date.today() - date.fromisoformat(PRICE_DATE)).days <= 7:
        raise ValueError("Recheck official pricing")
    if os.environ.get("OPENAI_BASE_URL", ENDPOINT).rstrip("/") != ENDPOINT.rstrip("/"):
        raise ValueError("Official provider endpoint required")


async def assess_retrieval(prepared, case, result, documents, runtime_documents):
    if not result["results"]:
        evidence = []
    else:
        evidence, _ = await resolve_evidence(documents, WORKSPACE, result["results"])
    identities = {document["id"]: identity for identity, document in runtime_documents.items()}
    observed = {(identities[e["document_id"]], e["page_number"], e["passage_id"]) for e in evidence}
    found = [name for name in case.anchors if (
        prepared.corpus.dataset.anchors[name].document_id,
        prepared.corpus.dataset.anchors[name].page_number,
        prepared.corpus.dataset.anchors[name].passage_id) in observed]
    return {"expected": list(case.anchors), "found": found, "missing": sorted(set(case.anchors) - set(found)),
            "evidence": evidence, "source_validation": "passed", "coverage": result["coverage"],
            "trace": result["trace"]}


async def run_queries(prepared, semantic, documents, runtime_documents, client_factory, record, report, directory):
    # Override only this temporary workspace's settings; never change the installation.
    documents.get_workspace_generation_settings = AsyncMock(return_value={"model_id": MODEL, "reasoning_effort": EFFORT})
    store = SearchContexts()
    for case in prepared.cases:
        for method in METHODS:
            identity = f"{case.id}-{method}"
            if method == "keyword":
                result = (await LibrarySearchService(documents).search(WORKSPACE, case.query, limit=5)).model_dump(mode="json")
            else:
                result = await semantic.search(WORKSPACE, SemanticSearchRequest(
                    query=case.query, limit=5, request_id=uuid4(), confirm_paid=True))
            assessment = await assess_retrieval(prepared, case, result, documents, runtime_documents)
            row = {"id": identity, "question": case.query, "method": method, "retrieval": assessment}
            # Persist retrieval failures/omissions BEFORE generation, not only successful answers.
            write_exclusive(directory / f"{identity}-retrieval.json", row)
            record({"event": "retrieval_assessed", "case": identity, "found": assessment["found"],
                    "missing": assessment["missing"], "trace": assessment["trace"]})
            context_id = await capture_search(documents, WORKSPACE, case.query, method, result, store)
            if context_id is None:
                row.update(status="empty_evidence_no_dispatch")
            else:
                item = prepare(store.get(WORKSPACE, context_id), assessment["evidence"], MODEL, EFFORT)
                check_bounds(item)
                request_hash = fingerprint(expected_request(item))
                record({"event": "answer_request_frozen", "case": identity, "request_sha256": request_hash})

                @asynccontextmanager
                async def exact_factory(key):
                    async with client_factory(key) as client:
                        if str(client.base_url).rstrip("/") != ENDPOINT.rstrip("/"):
                            raise ValueError("Unexpected generation endpoint")
                        wrapper = ExactClient(client, item, lambda event: record({"case": identity, **event}))
                        try:
                            yield wrapper
                        finally:
                            report["answer_requests"] += int(wrapper.sent)

                engine = LibraryAnswerService(documents, store=store, client_factory=exact_factory)
                preview = await engine.preview(WORKSPACE, context_id)
                if preview["evidence"] != assessment["evidence"]:
                    raise ValueError("Preview changed actual retrieval evidence")
                request = StartAnswer(context_id=context_id, request_id=uuid4(), model_id=MODEL,
                                      reasoning_effort=EFFORT, confirm_paid=True)
                answer = await engine.start(WORKSPACE, request)
                row.update(status=answer["status"], request_sha256=request_hash, answer=answer)
                usage = answer["generation"]["usage"]
                if usage:
                    upper = (Decimal(usage["prompt_tokens"]) * Decimal("2.5") + Decimal(usage["completion_tokens"]) * 10) / 1_000_000
                    row["usage_priced_upper_usd"] = str(upper)
                    report["answer_usage_priced_upper_usd"] = str(Decimal(report["answer_usage_priced_upper_usd"]) + upper)
                before = report["answer_requests"]
                restarted = LibraryAnswerService(documents, store=SearchContexts(), client_factory=exact_factory)
                replay = await restarted.start(WORKSPACE, request)
                if replay != answer or report["answer_requests"] != before:
                    raise ValueError("Saved attempt replay changed or dispatched again")
                if answer["status"] == "completed" and (
                        answer["retrieval_trace"] != assessment["trace"]
                        or not answer["answer_trace"]
                        or answer["answer_trace"]["parent_trace_id"] != assessment["trace"]["trace_id"]):
                    raise ValueError("Saved stage correlation is missing")
            report["results"].append(row)
            write_exclusive(directory / f"{identity}.json", row)
            record({"event": row["status"], "case": identity})
            print(json.dumps({"case": identity, "status": row["status"],
                              "outcome": row.get("answer", {}).get("outcome")}), flush=True)
            if context_id and (row["status"] != "completed" or not row["answer"]["generation"]["usage"]):
                raise ValueError("Stop after unsuccessful or unknown provider outcome")


async def collect(prepared, manifest, *, cap, approved_plan, key_loader, client_factory=workspace_openai_client,
                  embedding_provider=embed, directory=None):
    approve(manifest, cap, approved_plan)
    directory = directory or OUTPUT_ROOT / fingerprint(manifest)
    if directory.is_symlink() or any(parent.is_symlink() for parent in directory.parents if parent != ROOT.parent):
        raise ValueError("Evaluation output must not traverse symlinks")
    directory.mkdir(mode=0o700, parents=True, exist_ok=False)
    write_exclusive(directory / "plan.json", manifest)
    report = {"status": "halted", "plan_sha256": fingerprint(manifest), "reserved_usd": manifest["reserved_usd"],
              "answer_requests": 0, "answer_usage_priced_upper_usd": "0", "results": [],
              "quality_assessment": "pending source review", "cleanup": "not_started"}
    with (directory / "ledger.jsonl").open("x", encoding="utf-8") as ledger:
        def record(event):
            ledger.write(json.dumps({"at": datetime.now(timezone.utc).isoformat(), **event}, allow_nan=False) + "\n")
            ledger.flush()
            os.fsync(ledger.fileno())
            if event["event"] == "owned_stores":
                report["cleanup"] = "pending"
            elif event["event"] == "cleanup":
                report["cleanup"] = "completed" if not event["leftovers"] else "incomplete"
        record({"event": "all_requests_reserved", "reserved_usd": manifest["reserved_usd"]})
        provider = RecordedProvider(prepared, record, embedding_provider)
        async def queries(semantic, documents, runtime_documents):
            await run_queries(prepared, semantic, documents, runtime_documents, client_factory, record, report, directory)
        try:
            await run_storage(prepared, provider, key_loader, record, query_runner=queries)
            if provider.dispatched != len(prepared.inputs) or len(report["results"]) != 8:
                raise ValueError("Approved sequence incomplete")
            report["status"] = "completed"
        except (Exception, asyncio.CancelledError) as error:
            report["error_type"] = type(error).__name__
        finally:
            report.update(embedding_requests=provider.dispatched, embedding_usage=provider.outcomes,
                          embedding_usage_based_usd=str(sum(Decimal(row["usage_based_usd"]) for row in provider.outcomes)),
                          reservations_reclaimed_usd="0")
            write_exclusive(directory / "report.json", report)
            record({"event": report["status"], "cleanup": report["cleanup"]})
    return report


async def main(arguments):
    prepared, manifest = await plan()
    if not arguments.run_paid:
        return {"dry_run": True, "credential_access": False, "storage_access": False,
                "plan_sha256": fingerprint(manifest), "manifest": manifest}
    logging.disable(logging.CRITICAL)
    from database.factory import DatabaseFactory
    from services.workspace_service import get_workspace_service
    try:
        return await collect(prepared, manifest, cap=arguments.cap_usd, approved_plan=arguments.approved_plan,
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
        print(json.dumps({k: v for k, v in report.items() if k not in ("results", "manifest")}, indent=2))
        raise SystemExit(0 if report.get("dry_run") or report["status"] == "completed" else 1)
    except Exception as error:
        print(json.dumps({"status": "refused_or_failed", "error_type": type(error).__name__}))
        raise SystemExit(1)
