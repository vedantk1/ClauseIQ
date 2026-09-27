"""Bounded structured generation. One provider attempt, no retries or fallback."""

import asyncio
from dataclasses import dataclass
import json
import time

from models.library_answers import GeneratedLibraryAnswer
from services.ai.generation import AIRequestError, create_chat_completion, generation_metadata
from services.ai.review_generation import _unique_keys, _usage
from services.ai.review_passages import PASSAGE_VERSION
from services.ai.token_utils import _positive_env_integer, calculate_token_budget, get_token_count
from . import AnswerError
from .context import fingerprint
from .prompt import PROMPT_VERSION, SCHEMA_VERSION, SYSTEM_PROMPT


@dataclass(frozen=True)
class PreparedAnswer:
    messages: list
    response_format: dict
    generation: dict
    evidence: list
    coverage: dict
    timeout: int


def prepare(context, evidence, model_id, effort):
    metadata = generation_metadata(model_id, "library_answer", effort)
    payload = {"question": context["question"], "retrieval_method": context["method"],
               "retrieval_coverage": context["coverage"], "evidence_untrusted": evidence}
    messages = [{"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": json.dumps(payload, ensure_ascii=False, separators=(",", ":"))}]
    response_format = {"type": "json_schema", "json_schema": {
        "name": "library_answer", "strict": True, "schema": GeneratedLibraryAnswer.model_json_schema()}}
    try:
        estimated = sum(get_token_count(m["content"], model_id) + 8 for m in messages) + 16
        estimated += get_token_count(json.dumps(response_format), model_id)
        limit = min(_positive_env_integer("AI_LIBRARY_ANSWER_MAX_INPUT_TOKENS", 30_000),
                    calculate_token_budget(model_id, metadata["max_completion_tokens"]))
        timeout = min(_positive_env_integer("AI_LIBRARY_ANSWER_TIMEOUT_SECONDS", 120), 180)
    except (ValueError, ImportError, OSError):
        raise AnswerError("ANSWER_PREFLIGHT_FAILED", "Answer input limits or tokenizer are unavailable. Nothing was sent.", 503) from None
    if estimated > limit:
        raise AnswerError("ANSWER_INPUT_LIMIT", "The question, complete passages and output schema exceed the configured input limit. Refine the search; nothing was truncated or sent.", 400)
    metadata.update(prompt_version=PROMPT_VERSION, schema_version=SCHEMA_VERSION,
                    passage_version=PASSAGE_VERSION, estimated_input_tokens=estimated,
                    evidence_sha256=fingerprint(evidence), prompt_sha256=fingerprint(messages),
                    usage=None, duration_ms=None)
    return PreparedAnswer(messages, response_format, metadata, evidence, context["coverage"], timeout)


async def generate(prepared, client):
    started = time.monotonic()
    metadata = dict(prepared.generation)

    def result(status, failure=None, **fields):
        metadata["duration_ms"] = max(0, int((time.monotonic() - started) * 1000))
        return {"status": status, "generation": metadata, "failure": failure,
                "outcome": None, "statements": [], "limitations": [], **fields}

    try:
        response = await asyncio.wait_for(create_chat_completion(
            client.with_options(max_retries=0, timeout=prepared.timeout),
            model=metadata["model_id"], messages=prepared.messages,
            max_completion_tokens=metadata["max_completion_tokens"],
            reasoning_effort=metadata["reasoning_effort"], response_format=prepared.response_format,
            validate_output=False), timeout=prepared.timeout)
    except (Exception, asyncio.CancelledError) as error:
        if isinstance(error, asyncio.CancelledError):
            raise
        message = error.public_message if isinstance(error, AIRequestError) else "The provider request did not complete."
        return result("failed_or_unknown", message + " Charges may apply; no automatic retry was made.")
    usage = _usage(response)
    metadata["usage"] = usage.model_dump() if usage else None
    choices = getattr(response, "choices", None)
    choice = choices[0] if choices else None
    message = getattr(choice, "message", None)
    content = getattr(message, "content", None)
    if (getattr(choice, "finish_reason", None) != "stop" or getattr(message, "refusal", None)
            or not isinstance(content, str) or not content.strip() or len(content.encode()) > 100_000):
        return result("failed", "The provider returned refused, incomplete or oversized output. No partial answer was saved.")
    try:
        parsed = GeneratedLibraryAnswer.model_validate(json.loads(content, object_pairs_hook=_unique_keys))
        inventory = {item["id"] for item in prepared.evidence}
        if any(not set(item.evidence_ids) <= inventory for item in parsed.statements):
            return result("failed", "A generated reference was not in this answer's evidence inventory. The entire answer was withheld.")
    except (ValueError, TypeError, RecursionError):
        return result("failed", "The generated answer failed its structured-output contract. No answer was saved.")
    data = parsed.model_dump()
    coverage = prepared.coverage
    if coverage["documents_not_examined"] or coverage["documents_unsearchable"] or coverage["documents_partial"]:
        if data["outcome"] == "answered":
            data["outcome"] = "partial"
        data["limitations"].append("Some library agreements or extracted pages were not covered. This answer is limited to the supplied passages.")
    return result("completed", **data)
