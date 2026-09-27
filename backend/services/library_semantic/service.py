"""Explicit indexing and semantic retrieval over current immutable source passages.

The supported local server has one backend process. Locks serialize deletion
with index writes; Mongo conditional updates fence source and attempt identity.
"""

import asyncio
from datetime import datetime, timezone
import logging

from database.library_semantic import SemanticRepository
from services.library_semantic.lifecycle import RUNTIME_ID, active_attempts, document_lock
from services.library_semantic.provider import embed
from services.library_trace import LibraryTrace
from services.library_semantic.source import (
    MAX_TOTAL_TOKENS, MODEL, VERSION, SemanticError, cost, digest, source_plan, token_count,
)

logger = logging.getLogger(__name__)
MAX_ATTEMPTS = 100


def now():
    return datetime.now(timezone.utc).isoformat()


class LibrarySemanticService:
    def __init__(self, documents, vectors, provider=embed, repository=None):
        self.documents, self.vectors, self.provider = documents, vectors, provider
        self.repository = repository or SemanticRepository(documents)

    async def document(self, workspace, document):
        record = await self.documents.get_document_for_workspace(document, workspace)
        if not record:
            raise SemanticError("DOCUMENT_NOT_FOUND", "This agreement is no longer available.", 404)
        return record

    async def describe(self, workspace, document):
        state = document.get("semantic_index") or {}
        result = {"document_id": document["id"], "filename": document["filename"],
                  "generation_id": state.get("generation_id"), "status": state.get("status", "not_indexed"),
                  "indexed_at": state.get("completed_at"), "partial": False,
                  "passages": 0, "excluded_headers": 0, "failure": state.get("failure")}
        try:
            plan = source_plan(document)
        except SemanticError:
            result["status"] = "unavailable"
            return result, None
        result.update(partial=plan.partial, passages=len(plan.passages), excluded_headers=plan.excluded_headers)
        if state.get("status") == "processing" and (workspace, document["id"], state.get("generation_id")) not in active_attempts:
            result["status"] = "interrupted"
        elif state.get("status") == "ready":
            if state.get("fingerprint") != plan.fingerprint or state.get("version") != VERSION:
                result["status"] = "stale"
            elif await self.vectors.count(workspace, document["id"], state["generation_id"]) != len(plan.passages):
                result["status"] = "missing_vectors"
        return result, plan

    async def status(self, workspace):
        total, documents = await self.repository.list(workspace)
        items = []
        for document in documents:
            item, _ = await self.describe(workspace, document)
            items.append(item)
        return {"model": MODEL, "documents": items, "documents_in_library": total,
                "documents_not_examined": max(0, total - len(items)),
                "indexed_documents": sum(item["status"] == "ready" for item in items)}

    async def plan(self, workspace, document_id):
        document = await self.document(workspace, document_id)
        plan = source_plan(document)
        tokens = token_count([p.text for p in plan.passages.values()])
        state = document.get("semantic_index") or {}
        return {"document_id": document_id, "filename": document["filename"],
                "fingerprint": plan.fingerprint, "expected_generation": state.get("generation_id"),
                "source_revision_id": document["source_revision_id"], "model": MODEL,
                "passages": len(plan.passages), "excluded_headers": plan.excluded_headers,
                "partial": plan.partial, "input_tokens": tokens, "estimated_usd": cost(tokens),
                "maximum_usd": cost(MAX_TOTAL_TOKENS), "price_verified_on": "2026-09-26"}

    async def _save(self, workspace, document, previous, updated, *, source_fence=False):
        expected = {"semantic_index": previous}
        if source_fence:
            expected.update(source_revision_id=document["source_revision_id"],
                            source_sha256=document["source_sha256"], source_extraction=document["source_extraction"])
        if not await self.documents.update_document_if(document["id"], workspace, expected, {"semantic_index": updated}):
            raise SemanticError("INDEX_CHANGED", "The source or index changed. Reload before taking another action.")

    async def index(self, workspace, document_id, request):
        async with document_lock(workspace, document_id):
            document = await self.document(workspace, document_id)
            previous = document.get("semantic_index")
            state = previous or {}
            request_id = str(request.request_id)
            if request_id in state.get("attempts", []):
                # A replay never dispatches again, even after removal or restart.
                return (await self.describe(workspace, document))[0]
            if state.get("generation_id") != request.expected_generation:
                raise SemanticError("INDEX_CHANGED", "The index changed since the preview. Preview it again.")
            if state.get("status") == "processing" and (workspace, document_id, state.get("generation_id")) in active_attempts:
                raise SemanticError("INDEX_BUSY", "Indexing is already running. Refresh its status; do not resend.")
            if len(state.get("attempts", [])) >= MAX_ATTEMPTS:
                raise SemanticError("INDEX_ATTEMPT_LIMIT", "This agreement has reached its saved indexing-attempt limit.")
            plan = source_plan(document)
            if plan.fingerprint != request.fingerprint:
                raise SemanticError("SOURCE_CHANGED", "The source changed since the preview. Preview it again.")
            if state.get("status") == "ready" and state.get("fingerprint") == plan.fingerprint:
                if await self.vectors.count(workspace, document_id, state["generation_id"]) == len(plan.passages):
                    return (await self.describe(workspace, document))[0]
            texts = [passage.text for passage in plan.passages.values()]
            tokens = token_count(texts)
            await self.vectors.ensure()  # Storage readiness BEFORE any provider call.
            api_key = await self.documents.get_workspace_api_key(workspace)
            if not api_key:
                raise SemanticError("API_KEY_REQUIRED", "Add your OpenAI API key in Settings to index agreement text.", 400)
            claim = {"version": VERSION, "status": "processing", "generation_id": request_id,
                     "runtime_id": RUNTIME_ID, "fingerprint": plan.fingerprint,
                     "source_revision_id": document["source_revision_id"], "started_at": now(),
                     "estimated_tokens": tokens, "maximum_usd": cost(MAX_TOTAL_TOKENS),
                     "attempts": [*state.get("attempts", []), request_id]}
            await self._save(workspace, document, previous, claim, source_fence=True)
            active = (workspace, document_id, request_id)
            active_attempts.add(active)
            usage = None
            try:
                vectors, usage = await self.provider(texts, api_key)
                current = await self.document(workspace, document_id)
                if current.get("semantic_index") != claim or source_plan(current).fingerprint != plan.fingerprint:
                    raise SemanticError("SOURCE_CHANGED", "The source changed during indexing; the result was not published.")
                await self.vectors.put(workspace, document_id, request_id, plan, vectors)
                if await self.vectors.count(workspace, document_id, request_id) != len(plan.passages):
                    raise SemanticError("INDEX_WRITE_UNCONFIRMED", "The complete vector write could not be confirmed.", 503)
                ready = {**claim, "status": "ready", "completed_at": now(), "input_tokens": usage,
                         "usage_based_usd": cost(usage), "passages": len(plan.passages)}
                await self._save(workspace, document, claim, ready, source_fence=True)
            except (Exception, asyncio.CancelledError) as error:
                logger.warning("Library indexing stopped: %s", type(error).__name__)
                # Publication may have succeeded before its acknowledgement was
                # lost. Read back BEFORE deciding whether our vectors are orphaned.
                current = await self.documents.get_document_for_workspace(document_id, workspace)
                saved = (current or {}).get("semantic_index") or {}
                if (saved.get("status") == "ready" and saved.get("generation_id") == request_id
                        and saved.get("fingerprint") == plan.fingerprint):
                    return (await self.describe(workspace, current))[0]
                if saved == claim:
                    failed = {**claim, "status": "failed", "completed_at": now(),
                              "input_tokens": usage, "usage_based_usd": cost(usage) if usage is not None else None,
                              "failure": "The attempt did not complete. Provider usage may be uncertain; no automatic retry was made."}
                    await self._save(workspace, current, claim, failed)
                # Exact attempt cleanup only. Failure leaves nonservable vectors
                # recoverable through explicit index removal, never a success state.
                await self.vectors.remove(workspace, document_id, request_id)
                if isinstance(error, asyncio.CancelledError):
                    raise
                if isinstance(error, SemanticError):
                    raise
                raise SemanticError("INDEX_FAILED", "Indexing did not complete. Refresh status; a new attempt may incur another charge.", 503) from None
            finally:
                active_attempts.discard(active)
            # Previous generations are nonservable even if cleanup fails. Keep a
            # visible warning; explicit removal always cleans the entire namespace.
            if state.get("generation_id"):
                try:
                    await self.vectors.remove(workspace, document_id, state["generation_id"])
                except Exception:
                    warning = {**ready, "failure": "The current index is ready, but older derived vectors need cleanup. Remove the index to clear them."}
                    await self._save(workspace, document, ready, warning)
            return (await self.describe(workspace, await self.document(workspace, document_id)))[0]

    async def remove_locked(self, workspace, document):
        """Caller owns document_lock through deletion of the document itself."""
        state = document.get("semantic_index")
        if not state:
            return
        await self.vectors.remove(workspace, document["id"])
        removed = {"status": "not_indexed", "generation_id": state.get("generation_id"),
                   "attempts": state.get("attempts", []), "version": VERSION}
        await self._save(workspace, document, state, removed)

    async def remove(self, workspace, document_id, expected_generation):
        async with document_lock(workspace, document_id):
            document = await self.document(workspace, document_id)
            if (document.get("semantic_index") or {}).get("generation_id") != expected_generation:
                raise SemanticError("INDEX_CHANGED", "The index changed; reload before removing it.")
            await self.remove_locked(workspace, document)
            return (await self.describe(workspace, await self.document(workspace, document_id)))[0]

    async def search(self, workspace, request):
        trace = LibraryTrace("retrieval", "semantic")
        trace.fields["model_id"] = MODEL
        try:
            result = await self._search(workspace, request, trace)
            trace.fields.update(coverage=result["coverage"], returned_passages=len(result["results"]))
            result["trace"] = trace.finish("completed")
            return result
        except BaseException:
            trace.finish("failed_or_unknown")
            raise

    async def _search(self, workspace, request, trace):
        total, documents = await self.repository.list(workspace)
        current = {}
        states = []
        for document in documents:
            state, plan = await self.describe(workspace, document)
            states.append(state)
            if state["status"] == "ready":
                current[document["id"]] = (document, plan, state["generation_id"])
        if not current:
            raise SemanticError("NO_CURRENT_INDEX", "No current semantic index is available. Index an agreement or use Keyword search.", 400)
        token_count([request.query])
        api_key = await self.documents.get_workspace_api_key(workspace)
        if not api_key:
            raise SemanticError("API_KEY_REQUIRED", "Add your OpenAI API key in Settings for semantic queries.", 400)
        request_id = str(request.request_id)
        claimed, receipt = await self.repository.claim_query(workspace, request_id, digest(request.query))
        if not claimed:
            raise SemanticError("SEARCH_ALREADY_SUBMITTED", "This semantic request was already submitted. It was not sent again; a deliberate new search incurs a separate charge.")
        usage = None
        try:
            trace.fields.update(provider_started=True, source_index_fingerprint=digest(
                sorted((key, item[1].fingerprint, item[2]) for key, item in current.items())))
            with trace.stage("embedding_ms"):
                vectors, usage = await self.provider([request.query], api_key)
            trace.fields["embedding_tokens"] = usage
            with trace.stage("vector_search_ms"):
                hits = await self.vectors.search(workspace, {key: item[2] for key, item in current.items()}, vectors[0], request.limit)
            results = []
            seen = set()
            # Recheck once per contributing document AFTER provider/vector reads.
            for document_id, (original, plan, generation) in list(current.items()):
                latest = await self.documents.get_document_for_workspace(document_id, workspace)
                if (not latest or (latest.get("semantic_index") or {}).get("status") != "ready"
                        or latest["semantic_index"].get("generation_id") != generation
                        or source_plan(latest).fingerprint != plan.fingerprint):
                    raise SemanticError("INDEX_CHANGED", "An indexed source changed during the search. Results were withheld; the query may have been charged.")
            for hit in hits:
                payload = hit.payload or {}
                entry = current.get(payload.get("document_id"))
                if not entry:
                    raise SemanticError("INVALID_SEARCH_HIT", "A search result failed source validation; results were withheld.", 503)
                document, plan, generation = entry
                passage = plan.passages.get(payload.get("passage_id"))
                identity = (document["id"], payload.get("passage_id"))
                if (not passage or payload.get("workspace_id") != workspace or payload.get("generation_id") != generation
                        or payload.get("fingerprint") != plan.fingerprint or payload.get("text_sha256") != digest(passage.text)
                        or payload.get("page_number") != passage.page_number
                        or payload.get("source_revision_id") != passage.source_revision_id or identity in seen):
                    raise SemanticError("INVALID_SEARCH_HIT", "A search result failed source validation; results were withheld.", 503)
                seen.add(identity)
                results.append({"document_id": document["id"], "filename": document["filename"],
                                "source_revision_id": passage.source_revision_id, "page_number": passage.page_number,
                                "passage_id": passage.id, "excerpt": passage.text, "excerpt_partial": False,
                                "source_incomplete": plan.partial})
            await self.repository.finish_query(workspace, request_id, "completed", usage)
            return {"results": results, "coverage": {"documents_in_library": total,
                    "documents_scanned": len(current), "documents_not_examined": total - len(current),
                    "documents_searchable": len(current), "documents_unsearchable": 0,
                    "documents_partial": sum(item[1].partial for item in current.values()),
                    "passages_examined": sum(len(item[1].passages) for item in current.values()),
                    "matched_passages": len(results), "results_truncated": len(results) == request.limit,
                    "scan_truncated": total != len(current)},
                    "semantic": {"model": MODEL, "input_tokens": usage, "usage_based_usd": cost(usage),
                                 "abstention_threshold": None, "coverage": states}}
        except (Exception, asyncio.CancelledError):
            await self.repository.finish_query(workspace, request_id, "failed_or_unknown", usage)
            raise
