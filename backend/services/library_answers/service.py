"""Explicit Library-answer lifecycle; reads and replays can never dispatch."""

import asyncio
from contextlib import AsyncExitStack, asynccontextmanager
from copy import deepcopy
from datetime import datetime, timezone
import logging

from database.library_answers import AnswerRepository
from services.ai.client_manager import workspace_openai_client
from services.library_semantic.lifecycle import document_lock
from services.library_trace import LibraryTrace, safe_trace
from . import AnswerError
from .context import contexts, fingerprint, resolve_evidence
from .generation import generate, prepare

logger = logging.getLogger(__name__)
active = set()
MAX_ATTEMPTS = 500


def now():
    return datetime.now(timezone.utc).isoformat()


@asynccontextmanager
async def source_locks(workspace, context):
    async with AsyncExitStack() as stack:
        for document_id in sorted(context["bindings"]):
            await stack.enter_async_context(document_lock(workspace, document_id))
        yield


class LibraryAnswerService:
    def __init__(self, documents, repository=None, store=contexts, generator=generate, client_factory=workspace_openai_client):
        self.documents = documents
        self.repository = repository or AnswerRepository(documents)
        self.store, self.generator, self.client_factory = store, generator, client_factory

    async def _resolve(self, workspace, context):
        return (await resolve_evidence(self.documents, workspace, context["hits"], context["bindings"]))[0]

    async def preview(self, workspace, context_id):
        context = self.store.get(workspace, context_id)
        evidence = await self._resolve(workspace, context)
        selection = await self.documents.get_workspace_generation_settings(workspace)
        prepared = prepare(context, evidence, selection["model_id"], selection["reasoning_effort"])
        return {"context_id": str(context_id), "question": context["question"], "method": context["method"],
                "coverage": context["coverage"], "evidence": evidence, "generation": prepared.generation}

    async def recent(self, workspace):
        rows = await self.repository.recent(workspace)
        for row in rows:
            if row["status"] == "processing" and (workspace, row["request_id"]) not in active:
                row["status"] = "interrupted"
        return rows

    async def read(self, workspace, request_id):
        record = await self.repository.get(workspace, str(request_id))
        if not record:
            raise AnswerError("ANSWER_NOT_FOUND", "This saved answer attempt was not found.", 404)
        result = deepcopy(record)
        for field in ("_id", "workspace_id", "request_hash", "document_ids", "context"):
            result.pop(field, None)
        if result["status"] == "processing" and (workspace, str(request_id)) not in active:
            result.update(status="interrupted", failure="The request was interrupted. Its provider outcome may be unknown; it was not sent again.")
        if result["status"] == "completed":
            try:
                await self._resolve(workspace, record["context"])
            except AnswerError:
                result.update(status="source_unavailable", outcome=None, statements=[], evidence=[], limitations=[],
                              failure="An associated source changed or is unavailable. This saved answer is withheld; no new request was sent.")
        return result

    async def interrupt(self, workspace, request_id):
        await self.read(workspace, request_id)
        await self.repository.finish(workspace, str(request_id), {
            "status": "interrupted", "completed_at": now(),
            "failure": "Marked interrupted locally. Provider work may still finish or incur a charge. No automatic resend.",
        })
        return await self.read(workspace, request_id)

    async def start(self, workspace, request):
        trace = LibraryTrace("answer")
        try:
            result = await self._start(workspace, request, trace)
            trace.finish(result["status"])
            return result
        except BaseException:
            trace.finish("failed_or_unknown")
            raise

    async def _start(self, workspace, request, trace):
        request_id = str(request.request_id)
        request_hash = fingerprint(request.model_dump(mode="json"))
        async with document_lock("library-answer-attempts", workspace):
            existing = await self.repository.get(workspace, request_id)
            if existing:
                trace.fields["replayed"] = True
                if existing["request_hash"] != request_hash:
                    raise AnswerError("ANSWER_ID_CONFLICT", "This attempt ID belongs to a different answer request. It was not sent again.")
                return await self.read(workspace, request_id)
            if await self.repository.count(workspace) >= MAX_ATTEMPTS:
                raise AnswerError("ANSWER_STORAGE_LIMIT", "The saved Library-answer attempt limit has been reached. Existing work remains intact.")
            if any(scope == workspace for scope, _ in active):
                raise AnswerError("ANSWER_BUSY", "A Library answer is already running. Read its status before another paid request.")
            context = self.store.get(workspace, request.context_id)
            retrieval_trace = safe_trace(context.get("retrieval_trace"))
            trace.fields.update(method=context["method"], coverage=context["coverage"],
                                parent_trace_id=retrieval_trace["trace_id"] if retrieval_trace else None,
                                source_index_fingerprint=retrieval_trace["source_index_fingerprint"] if retrieval_trace else None)
            async with source_locks(workspace, context):
                evidence = await self._resolve(workspace, context)
                selection = await self.documents.get_workspace_generation_settings(workspace)
                if (selection["model_id"], selection["reasoning_effort"]) != (request.model_id, request.reasoning_effort):
                    raise AnswerError("ANSWER_SETTINGS_CHANGED", "Model or reasoning changed in Settings. Preview and confirm again.")
                prepared = prepare(context, evidence, request.model_id, request.reasoning_effort)
                trace.fields["returned_passages"] = len(evidence)
                trace.generation(prepared.generation)
                api_key = await self.documents.get_workspace_api_key(workspace)
                if not api_key:
                    raise AnswerError("API_KEY_REQUIRED", "Add your OpenAI API key in Settings before generating an answer.", 400)
                record = {"workspace_id": workspace, "request_id": request_id, "request_hash": request_hash,
                          "context_id": str(request.context_id), "question": context["question"],
                          "method": context["method"], "coverage": context["coverage"], "context": context,
                          "document_ids": list(context["bindings"]), "evidence": evidence,
                          "created_at": now(), "completed_at": None, "generation": prepared.generation,
                          "status": "processing", "outcome": None, "statements": [], "limitations": [], "failure": None}
                record["retrieval_trace"] = retrieval_trace
                record["answer_trace"] = trace.snapshot("processing")
                # An unacknowledged insert exits before provider access. A later
                # replay can inspect that same durable attempt, never send again.
                if not await self.repository.claim(record):
                    return await self.read(workspace, request_id)
                active.add((workspace, request_id))
        try:
            # Recheck immediately before dispatch; no key or source text is logged.
            await self._resolve(workspace, context)
            with trace.stage("generation_ms"):
                async with self.client_factory(api_key) as client:
                    trace.fields["provider_started"] = True
                    output = await self.generator(prepared, client)
            trace.generation(output["generation"])
            async with source_locks(workspace, context):
                try:
                    await self._resolve(workspace, context)
                except AnswerError:
                    output.update(status="source_unavailable", outcome=None, statements=[], limitations=[], evidence=[],
                                  failure="A source changed during generation. Output was withheld; provider charges may apply.")
                trace.fields["answer_outcome"] = output.get("outcome")
                await self.repository.finish(workspace, request_id, {**output, "completed_at": now(),
                    "answer_trace": trace.snapshot(output["status"])})
        except (Exception, asyncio.CancelledError) as error:
            logger.warning("Library answer stopped: %s", type(error).__name__)
            try:
                await self.repository.finish(workspace, request_id, {
                    "status": "failed_or_unknown", "completed_at": now(),
                    "failure": "The answer could not be completed or its save confirmed. Charges may apply; no automatic retry was made.",
                    "answer_trace": trace.snapshot("failed_or_unknown"),
                })
            except Exception:
                raise AnswerError("ANSWER_SAVE_UNCONFIRMED", "The answer's saved status is uncertain. Refresh history before another paid attempt.", 503) from None
            if isinstance(error, asyncio.CancelledError):
                raise
        finally:
            active.discard((workspace, request_id))
        return await self.read(workspace, request_id)
