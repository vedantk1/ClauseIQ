"""Bounded, ephemeral search contexts. No database, credentials or provider writes.

An opaque random ID refers to server-owned search coordinates/coverage, never
client-supplied quotes. Contexts expire or disappear on reload; they cannot cause
an automatic re-search. Durable answer attempts copy their evidence separately.
"""

from collections import OrderedDict
from copy import deepcopy
import hashlib
import json
import time
from uuid import uuid4

from services.library_search import _valid_source
from services.library_trace import safe_trace
from . import AnswerError

TTL_SECONDS = 15 * 60
MAX_CONTEXTS = 64
MAX_BUNDLE_BYTES = 256 * 1024


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False,
                                     separators=(",", ":")).encode()).hexdigest()


def source_binding(document):
    return fingerprint({key: document.get(key) for key in (
        "id", "source_revision_id", "source_sha256", "source_status", "has_pdf_file",
        "extraction_status", "source_extraction",
    )})


class SearchContexts:
    def __init__(self, clock=time.monotonic):
        self.clock, self.items = clock, OrderedDict()

    def put(self, workspace, context):
        now = self.clock()
        for key in list(self.items):
            if self.items[key][0] <= now:
                del self.items[key]
        while len(self.items) >= MAX_CONTEXTS:
            self.items.popitem(last=False)
        identity = str(uuid4())
        self.items[(workspace, identity)] = (now + TTL_SECONDS, deepcopy(context))
        return identity

    def get(self, workspace, identity):
        value = self.items.get((workspace, str(identity)))
        if value is None or value[0] <= self.clock():
            self.items.pop((workspace, str(identity)), None)
            raise AnswerError("SEARCH_CONTEXT_EXPIRED", "These search results expired. Search again deliberately before requesting an answer.")
        return deepcopy(value[1])


contexts = SearchContexts()


async def resolve_evidence(documents, workspace, hits, bindings=None):
    """Return full exact passages and complete source fingerprints, or fail closed."""
    if not hits or len(hits) > 30:
        raise AnswerError("EMPTY_EVIDENCE", "Search for usable source passages before asking for an answer.", 400)
    loaded, evidence, actual_bindings, seen = {}, [], {}, set()
    for hit in hits:
        doc_id = hit["document_id"]
        if doc_id not in loaded:
            document = await documents.get_document_for_workspace(doc_id, workspace)
            valid = _valid_source(document) if document else None
            if not valid:
                raise AnswerError("ANSWER_SOURCE_CHANGED", "An agreement's source is unavailable. Search again; no answer was published.")
            binding = source_binding(document)
            if bindings is not None and bindings.get(doc_id) != binding:
                raise AnswerError("ANSWER_SOURCE_CHANGED", "An agreement changed since this search. No answer was published.")
            actual_bindings[doc_id] = binding
            loaded[doc_id] = document, valid[0], {p.id: p for p in valid[1]}
        document, extraction, passages = loaded[doc_id]
        passage = passages.get(hit["passage_id"])
        identity = (doc_id, hit["passage_id"])
        if (not passage or hit["source_revision_id"] != document["source_revision_id"]
                or hit["page_number"] != passage.page_number or identity in seen
                or ("excerpt" in hit and (not hit["excerpt"] or hit["excerpt"] not in passage.text))):
            raise AnswerError("INVALID_ANSWER_SOURCE", "A result no longer resolves to its exact source. No answer was published.")
        seen.add(identity)
        evidence.append({"id": f"S{len(evidence) + 1}", "document_id": doc_id,
                         "filename": document["filename"], "source_revision_id": passage.source_revision_id,
                         "page_number": passage.page_number, "passage_id": passage.id,
                         "quote": passage.text, "source_incomplete": extraction.status == "partial",
                         "continuation_before": passage.continuation_before,
                         "continuation_after": passage.continuation_after})
    if len(json.dumps(evidence, ensure_ascii=False).encode()) > MAX_BUNDLE_BYTES:
        raise AnswerError("ANSWER_EVIDENCE_LIMIT", "These complete passages exceed the answer limit. Refine the search; nothing was truncated or sent.", 400)
    return evidence, actual_bindings


async def capture_search(documents, workspace, query, method, result, store=contexts):
    """Called by HTTP adapters only, leaving the measured search engines unchanged."""
    if not result["results"]:
        return None
    try:
        _, bindings = await resolve_evidence(documents, workspace, result["results"])
    except AnswerError as error:
        # An answer bundle limit must not disable otherwise valid local search.
        if error.code == "ANSWER_EVIDENCE_LIMIT":
            return None
        raise
    return store.put(workspace, {"question": query, "method": method,
        "retrieval_trace": safe_trace(result.get("trace")),
        "coverage": result["coverage"], "bindings": bindings,
        "hits": [{key: hit[key] for key in ("document_id", "source_revision_id", "page_number", "passage_id")}
                 for hit in result["results"]]})
