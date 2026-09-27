"""Opt-in fixed-evidence generation evaluation; not end-to-end RAG scoring."""

import argparse
import asyncio
from datetime import date, datetime, timezone
from decimal import Decimal
import hashlib
import json
import logging
import os
from pathlib import Path
from types import SimpleNamespace

from evaluations.library_answer_cases import CASES_PATH, prepare_cases
from evaluations.library_search_cases import ROOT
from evaluations.retrieval_embeddings import write_exclusive
from services.library_answers.context import fingerprint
from services.library_answers.generation import generate, prepare

MODEL, EFFORT = "gpt-6-sol", "medium"
PRICE_DATE = "2026-09-27"
ENDPOINT = "https://api.openai.com/v1/"
OUTPUT_ROOT = ROOT / ".local-only/library-answer-evaluations"
PER_CALL_RESERVATION = Decimal("0.14")  # 32k input at cache-write ceiling $2.50/M + 6k output at $10/M.


def expected_request(prepared):
    return {"model": MODEL, "messages": prepared.messages, "max_completion_tokens": prepared.generation["max_completion_tokens"],
            "reasoning_effort": EFFORT, "store": False, "response_format": prepared.response_format}


async def plan():
    cases = await prepare_cases()
    prepared = [prepare(case["context"], case["evidence"], MODEL, EFFORT) for case in cases]
    if any(item.generation["estimated_input_tokens"] > 30_000 or item.generation["max_completion_tokens"] > 6000
           or item.timeout != 120 for item in prepared):
        raise ValueError("Configured budgets exceed the frozen evaluation allowance")
    paths = [Path(__file__), CASES_PATH, ROOT / "backend/evaluations/library_answer_cases.py",
             ROOT / "backend/models/library_answers.py", ROOT / "backend/services/ai/generation.py",
             ROOT / "backend/services/ai/token_utils.py", ROOT / "backend/services/ai/review_passages.py"]
    paths.extend(sorted((ROOT / "backend/services/library_answers").glob("*.py")))
    manifest = {"version": "library-answer-fixed-v1", "model": MODEL, "effort": EFFORT,
                "price_verified_on": PRICE_DATE, "pricing_source": "https://developers.openai.com/api/docs/models/gpt-6-sol",
                "reservation_per_call_usd": str(PER_CALL_RESERVATION),
                "reserved_usd": str(PER_CALL_RESERVATION * len(cases)),
                "cases": [{"id": case["id"], "expected_outcome": case["expected_outcome"], "criteria": case["criteria"],
                           "evidence_sha256": case["evidence_sha256"], "request_sha256": fingerprint(expected_request(item))}
                          for case, item in zip(cases, prepared)],
                "code_sha256": {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest() for path in paths}}
    return cases, prepared, manifest


def approve(manifest, cap, approved_plan):
    cap = Decimal(cap or "NaN")
    if (not cap.is_finite() or not 0 < cap <= Decimal("1.60")
            or Decimal(manifest["reserved_usd"]) > cap or approved_plan != fingerprint(manifest)):
        raise ValueError("Require the exact dry-run plan and a sufficient finite cap, at most USD1.60")
    age = (date.today() - date.fromisoformat(PRICE_DATE)).days
    if not 0 <= age <= 7 or os.environ.get("OPENAI_BASE_URL", ENDPOINT).rstrip("/") != ENDPOINT.rstrip("/"):
        raise ValueError("Recheck pricing and use the official endpoint")


class ExactClient:
    """Permit exactly one frozen request; model engine still exercises its adapter."""
    def __init__(self, delegate, prepared, record):
        self.delegate, self.expected, self.record = delegate, expected_request(prepared), record
        self.sent = False
        self.chat = SimpleNamespace(completions=self)

    def with_options(self, **options):
        if options != {"max_retries": 0, "timeout": 120}:
            raise ValueError("Evaluation retry/timeout contract changed")
        self.delegate = self.delegate.with_options(**options)
        return self

    async def create(self, **kwargs):
        if self.sent or fingerprint(kwargs) != fingerprint(self.expected):
            raise ValueError("Dispatch differs from the frozen request or was already sent")
        self.record({"event": "dispatch_outcome_unknown", "reserved_usd": str(PER_CALL_RESERVATION)})
        self.sent = True
        return await self.delegate.chat.completions.create(**kwargs)


async def collect(cases, prepared, manifest, *, cap, approved_plan, key_loader, client_factory, directory=None):
    approve(manifest, cap, approved_plan)
    directory = directory or OUTPUT_ROOT / fingerprint(manifest)
    if directory.is_symlink() or any(parent.is_symlink() for parent in directory.parents if parent != ROOT.parent):
        raise ValueError("Evaluation output must not traverse a symlink")
    directory.mkdir(mode=0o700, parents=True, exist_ok=False)
    write_exclusive(directory / "plan.json", manifest)
    report = {"status": "halted", "plan_sha256": fingerprint(manifest), "reserved_usd": manifest["reserved_usd"],
              "usage_priced_upper_usd": "0", "paid_requests": 0, "results": [], "quality_assessment": "pending source review"}
    with (directory / "ledger.jsonl").open("x", encoding="utf-8") as ledger:
        def record(event):
            ledger.write(json.dumps({"at": datetime.now(timezone.utc).isoformat(), **event}) + "\n")
            ledger.flush()
            os.fsync(ledger.fileno())
        record({"event": "all_requests_reserved", "reserved_usd": manifest["reserved_usd"]})
        try:
            key = await key_loader()
            if not key:
                raise ValueError("No saved Settings key")
            async with client_factory(key) as client:
                if str(client.base_url).rstrip("/") != ENDPOINT.rstrip("/"):
                    raise ValueError("Unexpected provider endpoint")
                for case, item in zip(cases, prepared):
                    wrapper = ExactClient(client, item, lambda event: record({"case": case["id"], **event}))
                    try:
                        result = await generate(item, wrapper)
                    finally:
                        report["paid_requests"] += int(wrapper.sent)
                    row = {"id": case["id"], "expected_outcome": case["expected_outcome"],
                           "criteria": case["criteria"], "evidence": case["evidence"], **result}
                    usage = result["generation"]["usage"]
                    if usage:
                        upper = (Decimal(usage["prompt_tokens"]) * Decimal("2.5") + Decimal(usage["completion_tokens"]) * 10) / 1_000_000
                        row["usage_priced_upper_usd"] = str(upper)
                        report["usage_priced_upper_usd"] = str(Decimal(report["usage_priced_upper_usd"]) + upper)
                    report["results"].append(row)
                    write_exclusive(directory / f"{case['id']}.json", row)
                    record({"case": case["id"], "event": result["status"], "usage": usage})
                    print(json.dumps({"case": case["id"], "status": result["status"], "outcome": result["outcome"]}), flush=True)
                    if result["status"] != "completed" or usage is None:
                        break
                else:
                    report["status"] = "completed"
        except (Exception, asyncio.CancelledError) as error:
            report["error_type"] = type(error).__name__
        finally:
            write_exclusive(directory / "report.json", report)
            record({"event": report["status"], "reservations_reclaimed_usd": "0"})
    return report


async def main(arguments):
    cases, prepared, manifest = await plan()
    if not arguments.run_paid:
        return {"dry_run": True, "credential_access": False, "plan_sha256": fingerprint(manifest), "manifest": manifest}
    logging.disable(logging.CRITICAL)
    from database.factory import DatabaseFactory
    from services.ai.client_manager import workspace_openai_client
    from services.workspace_service import get_workspace_service
    try:
        result = await collect(cases, prepared, manifest, cap=arguments.cap_usd, approved_plan=arguments.approved_plan,
                               key_loader=get_workspace_service().get_api_key, client_factory=workspace_openai_client)
        return {key: value for key, value in result.items() if key != "results"}
    finally:
        await DatabaseFactory.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-paid", action="store_true")
    parser.add_argument("--cap-usd")
    parser.add_argument("--approved-plan")
    try:
        result = asyncio.run(main(parser.parse_args()))
        print(json.dumps(result, indent=2))
        raise SystemExit(0 if result.get("dry_run") or result["status"] == "completed" else 1)
    except Exception as error:
        print(json.dumps({"status": "refused_or_failed", "error_type": type(error).__name__}))
        raise SystemExit(1)
