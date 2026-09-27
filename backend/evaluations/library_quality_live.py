"""Opt-in embedding / Sol-effort comparison; default is key-free preparation.

Frozen inputs, exclusive ledgers, full reservations, no retries and no product writes.
"""

import argparse
import asyncio
from datetime import date, datetime, timezone
from decimal import Decimal
import json
import logging
import os
from types import SimpleNamespace
import time

from evaluations.library_quality_retrieval import (
    MAX_INPUT_TOKENS, PRICE_DATE, PROFILES, code_fingerprints, plan as retrieval_plan, score,
)
from evaluations.library_search_cases import ROOT
from evaluations.retrieval_comparison import digest, normalize_vector
from evaluations.retrieval_embeddings import write_exclusive
from services.library_answers.generation import generate, prepare

ENDPOINT = "https://api.openai.com/v1/"
OUTPUT_ROOT = ROOT / ".local-only/library-quality-v2"
EFFORTS = ("medium", "high", "xhigh")
PER_ANSWER_USD = Decimal("0.14")


def expected_request(prepared):
    return {"model": prepared.generation["model_id"], "messages": prepared.messages,
            "max_completion_tokens": prepared.generation["max_completion_tokens"],
            "reasoning_effort": prepared.generation["reasoning_effort"], "store": False,
            "response_format": prepared.response_format}


async def answer_plan():
    from evaluations.library_quality_cases import prepare_answer_cases
    cases = await prepare_answer_cases()
    if len(cases) != 4:
        raise ValueError("The frozen comparison requires four answer cases")
    jobs = []
    for case in cases:
        for effort in EFFORTS:
            prepared = prepare(case["context"], case["evidence"], "gpt-6-sol", effort)
            if (prepared.generation["estimated_input_tokens"] > 30_000
                    or prepared.generation["max_completion_tokens"] != 6000 or prepared.timeout != 120):
                raise ValueError("Frozen input/output/timeout allowance changed")
            jobs.append((case, effort, prepared))
    paths = [ROOT / "backend" / path for path in (
        "evaluations/library_quality_live.py", "evaluations/library_quality_cases.py",
        "models/library_answers.py", "services/ai/generation.py", "services/ai/token_utils.py")]
    paths.extend(sorted((ROOT / "backend/services/library_answers").glob("*.py")))
    manifest = {"version": "library-quality-effort-v2", "price_verified_on": PRICE_DATE,
                "model": "gpt-6-sol", "efforts": list(EFFORTS), "reserved_usd": str(len(jobs) * PER_ANSWER_USD),
                "pricing": {"input_ceiling_usd_per_million": "2.50", "output_usd_per_million": "10",
                            "source": "https://developers.openai.com/api/docs/pricing"},
                "jobs": [{"case": case["id"], "effort": effort, "criteria_sha256": digest(case["criteria"]),
                          "expected_outcome": case["expected_outcome"], "evidence_sha256": digest(case["evidence"]),
                          "request_sha256": digest(expected_request(prepared))} for case, effort, prepared in jobs],
                "code_sha256": code_fingerprints(paths),
                "scope": "One output per configuration/case; fixed evidence, not end-to-end or stability measurement"}
    return jobs, manifest


def approve(manifest, cap, approved_plan):
    ceiling = Decimal("1.00") if "profiles" in manifest else Decimal("1.70")
    cap = Decimal(cap or "NaN")
    if (not cap.is_finite() or not 0 < cap <= ceiling
            or Decimal(manifest["reserved_usd"]) > cap or digest(manifest) != approved_plan):
        raise ValueError("Require exact key-free plan and sufficient bounded cap")
    if (not 0 <= (date.today() - date.fromisoformat(PRICE_DATE)).days <= 7
            or os.environ.get("OPENAI_BASE_URL", ENDPOINT).rstrip("/") != ENDPOINT.rstrip("/")):
        raise ValueError("Recheck pricing and use the official endpoint")


def verify_prepared(prepared, manifest, phase):
    """Bind the approved manifest to the objects actually sent, before key access."""
    if phase == "embeddings":
        expected_profiles = {name: {"model": p[0], "dimensions": p[1], "usd_per_million": str(p[2])}
                             for name, p in PROFILES.items()}
        expected_inputs = [{"key": key, "text_sha256": digest(item.text), "tokens": item.tokens}
                           for key, item in prepared.inputs.items()]
        keys = [key for batch in prepared.batches for key in batch]
        reserved = Decimal(len(prepared.inputs) * MAX_INPUT_TOKENS) * sum(p[2] for p in PROFILES.values()) / 1_000_000
        if (prepared.manifest != manifest or manifest.get("version") != "library-quality-retrieval-v2"
                or manifest.get("profiles") != expected_profiles or manifest.get("inputs") != expected_inputs
                or manifest.get("batches") != prepared.batches or not prepared.inputs
                or len(keys) != len(set(keys)) or set(keys) != set(prepared.inputs)
                or any(not 1 <= len(batch) <= 64 for batch in prepared.batches)
                or any(not item.text.strip() or not 1 <= item.tokens <= MAX_INPUT_TOKENS for item in prepared.inputs.values())
                or any(sum(prepared.inputs[key].tokens for key in batch) > 200_000 for batch in prepared.batches)
                or Decimal(manifest["reserved_usd"]) != reserved):
            raise ValueError("Prepared embedding inputs differ from the frozen plan")
    elif phase == "answers":
        rows = [{"case": case["id"], "effort": effort, "criteria_sha256": digest(case["criteria"]),
                 "expected_outcome": case["expected_outcome"], "evidence_sha256": digest(case["evidence"]),
                 "request_sha256": digest(expected_request(item))} for case, effort, item in prepared]
        by_case = {}
        for case, effort, item in prepared:
            by_case.setdefault(case["id"], []).append(effort)
            if (item.generation["model_id"] != "gpt-6-sol" or item.generation["reasoning_effort"] != effort
                    or item.generation["max_completion_tokens"] != 6000 or item.timeout != 120
                    or not 0 < item.generation["estimated_input_tokens"] <= 30_000
                    or digest(item.evidence) != digest(case["evidence"])):
                raise ValueError("Prepared answer differs from the approved effort/evidence/budget")
        if (manifest.get("version") != "library-quality-effort-v2" or manifest.get("jobs") != rows
                or len(by_case) != 4 or any(efforts != list(EFFORTS) for efforts in by_case.values())
                or Decimal(manifest["reserved_usd"]) != len(prepared) * PER_ANSWER_USD):
            raise ValueError("Prepared answer jobs differ from the frozen plan")
    else:
        raise ValueError("Unknown phase")


class ExactClient:
    def __init__(self, client, prepared, record):
        self.client, self.expected, self.record = client, expected_request(prepared), record
        self.sent = False
        self.chat = SimpleNamespace(completions=self)

    def with_options(self, **options):
        if options != {"max_retries": 0, "timeout": 120}:
            raise ValueError("Retry/timeout policy changed")
        self.client = self.client.with_options(**options)
        return self

    async def create(self, **kwargs):
        if self.sent or digest(kwargs) != digest(self.expected):
            raise ValueError("Duplicate or changed request")
        self.record({"event": "dispatch_outcome_unknown", "reserved_usd": str(PER_ANSWER_USD)})
        self.sent = True
        return await self.client.chat.completions.create(**kwargs)


def validate_embedding(response, profile, count):
    model, dimensions, _ = PROFILES[profile]
    if response.model != model or len(response.data) != count:
        raise ValueError("Wrong embedding model or count")
    indexed = {}
    for item in response.data:
        if type(item.index) is not int or not 0 <= item.index < count or item.index in indexed:
            raise ValueError("Invalid or duplicate embedding index")
        normalize_vector(item.embedding, dimensions)
        indexed[item.index] = item.embedding
    tokens = response.usage.prompt_tokens
    if (type(tokens) is not int or not 0 < tokens <= count * MAX_INPUT_TOKENS
            or type(response.usage.total_tokens) is not int or response.usage.total_tokens != tokens):
        raise ValueError("Unknown or excessive usage")
    return [indexed[index] for index in range(count)], tokens


async def embedding_jobs(prepared, client, record, report, directory):
    vectors = {}
    for profile, (model, dimensions, price) in PROFILES.items():
        vectors[profile] = {}
        for number, keys in enumerate(prepared.batches):
            record({"event": "dispatch_outcome_unknown", "profile": profile, "batch": number,
                    "reserved_usd": str(Decimal(len(keys) * MAX_INPUT_TOKENS) * price / 1_000_000)})
            report["paid_requests"] += 1
            started = time.monotonic()
            response = await client.embeddings.create(model=model, dimensions=dimensions, encoding_format="float",
                                                     input=[prepared.inputs[key].text for key in keys])
            usage = getattr(response, "usage", None)
            tokens = getattr(usage, "prompt_tokens", None)
            total = getattr(usage, "total_tokens", None)
            valid_usage = (type(tokens) is int and type(total) is int and total == tokens
                           and 0 < tokens <= len(keys) * MAX_INPUT_TOKENS)
            cost = Decimal(tokens) * price / 1_000_000 if valid_usage else None
            row = {"profile": profile, "batch": number,
                   "status": "received_unvalidated", "input_tokens": tokens if valid_usage else None,
                   "duration_ms": int((time.monotonic() - started) * 1000),
                   "usage_priced_upper_usd": str(cost) if cost is not None else None}
            report["results"].append(row)
            if cost is not None:
                report["usage_priced_upper_usd"] = str(Decimal(report["usage_priced_upper_usd"]) + cost)
            record({"event": "response_received", **row})
            values, _ = validate_embedding(response, profile, len(keys))
            vectors[profile].update(zip(keys, values))
            row["status"] = "completed"
            record({"event": "response_accepted", **row})
            print(json.dumps({"profile": profile, "batch": number, "status": "completed"}), flush=True)
    payload = {"plan_sha256": digest(prepared.manifest), "vectors": vectors}
    write_exclusive(directory / "vectors.json", {"sha256": digest(payload), "payload": payload})
    report["retrieval"] = score(prepared, vectors)


async def answer_jobs(jobs, client, record, report, directory):
    for case, effort, prepared in jobs:
        job = f"{case['id']}-{effort}"
        wrapper = ExactClient(client, prepared, lambda event: record({"job": job, **event}))
        try:
            result = await generate(prepared, wrapper)
        finally:
            report["paid_requests"] += int(wrapper.sent)
        row = {"id": case["id"], "effort": effort, "expected_outcome": case["expected_outcome"],
               "criteria": case["criteria"], "evidence": case["evidence"], **result}
        usage = result["generation"]["usage"]
        excessive_usage = False
        if usage:
            excessive_usage = usage["prompt_tokens"] > 32_000 or usage["completion_tokens"] > 6000
            cost = (Decimal(usage["prompt_tokens"]) * Decimal("2.5") + Decimal(usage["completion_tokens"]) * 10) / 1_000_000
            row["usage_priced_upper_usd"] = str(cost)
            report["usage_priced_upper_usd"] = str(Decimal(report["usage_priced_upper_usd"]) + cost)
        report["results"].append(row)
        write_exclusive(directory / f"{job}.json", row)
        record({"job": job, "event": result["status"], "usage": usage})
        print(json.dumps({"job": job, "status": result["status"], "outcome": result["outcome"]}), flush=True)
        if excessive_usage:
            raise ValueError("Reported usage exceeded its reservation; retained outcome before stopping")
        if result["status"] != "completed" or usage is None:
            raise ValueError("Stop after failed/unknown outcome or missing usage")


async def collect(prepared, manifest, *, phase, cap, approved_plan, key_loader, client_factory, directory=None):
    approve(manifest, cap, approved_plan)
    verify_prepared(prepared, manifest, phase)
    directory = directory or OUTPUT_ROOT / phase / digest(manifest)
    if directory.is_symlink() or any(parent.is_symlink() for parent in directory.parents):
        raise ValueError("Output must not traverse symlinks")
    directory.mkdir(parents=True, mode=0o700, exist_ok=False)
    write_exclusive(directory / "plan.json", manifest)
    report = {"status": "halted", "plan_sha256": digest(manifest), "reserved_usd": manifest["reserved_usd"],
              "paid_requests": 0, "usage_priced_upper_usd": "0", "results": [],
              "quality_assessment": "pending source review"}
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
                if str(client.base_url).rstrip("/") != ENDPOINT.rstrip("/") or client.max_retries != 0:
                    raise ValueError("Wrong endpoint or retry policy")
                if phase == "embeddings":
                    await embedding_jobs(prepared, client, record, report, directory)
                elif phase == "answers":
                    await answer_jobs(prepared, client, record, report, directory)
                else:
                    raise ValueError("Unknown phase")
            report["status"] = "completed"
        except (Exception, asyncio.CancelledError) as error:
            report["error_type"] = type(error).__name__
        finally:
            write_exclusive(directory / "report.json", report)
            record({"event": report["status"], "reservations_reclaimed_usd": "0"})
    return report


def replay_embeddings(prepared, directory):
    if json.loads((directory / "plan.json").read_text()) != prepared.manifest:
        raise ValueError("Frozen inputs or code changed; no automatic recollection")
    report = json.loads((directory / "report.json").read_text())
    cache = json.loads((directory / "vectors.json").read_text())
    payload = cache["payload"]
    if (report["status"] != "completed" or payload["plan_sha256"] != digest(prepared.manifest)
            or cache["sha256"] != digest(payload) or set(payload["vectors"]) != set(PROFILES)):
        raise ValueError("Incomplete or corrupt cache")
    for name, (_, dimensions, _) in PROFILES.items():
        if set(payload["vectors"][name]) != set(prepared.inputs):
            raise ValueError("Missing cached input")
        for vector in payload["vectors"][name].values():
            normalize_vector(vector, dimensions)
    return {"new_provider_calls": 0, "retrieval": score(prepared, payload["vectors"])}


async def main(args):
    if args.phase == "embeddings":
        prepared = await retrieval_plan()
        manifest = prepared.manifest
    else:
        prepared, manifest = await answer_plan()
    if args.replay:
        if args.phase != "embeddings":
            raise ValueError("Answer records are read-only artifacts, not a rerun command")
        return replay_embeddings(prepared, OUTPUT_ROOT / "embeddings" / digest(manifest))
    if not args.run_paid:
        return {"dry_run": True, "credential_access": False, "plan_sha256": digest(manifest), "manifest": manifest}
    logging.disable(logging.CRITICAL)
    from contextlib import asynccontextmanager
    from openai import AsyncOpenAI
    from database.factory import DatabaseFactory
    from services.workspace_service import get_workspace_service

    @asynccontextmanager
    async def factory(key):
        async with AsyncOpenAI(api_key=key, base_url=ENDPOINT, timeout=120, max_retries=0) as client:
            yield client
    try:
        result = await collect(prepared, manifest, phase=args.phase, cap=args.cap_usd, approved_plan=args.approved_plan,
                               key_loader=get_workspace_service().get_api_key, client_factory=factory)
        return {key: value for key, value in result.items() if key not in {"results", "retrieval"}}
    finally:
        await DatabaseFactory.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", choices=("embeddings", "answers"))
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--run-paid", action="store_true")
    mode.add_argument("--replay", action="store_true")
    parser.add_argument("--cap-usd")
    parser.add_argument("--approved-plan")
    try:
        result = asyncio.run(main(parser.parse_args()))
        print(json.dumps(result, indent=2))
        raise SystemExit(0 if result.get("dry_run") or result.get("new_provider_calls") == 0 or result.get("status") == "completed" else 1)
    except Exception as error:
        print(json.dumps({"status": "refused_or_failed", "error_type": type(error).__name__}))
        raise SystemExit(1)
