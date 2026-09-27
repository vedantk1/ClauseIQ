"""Unpaid, read-only lexical retrieval over current page-anchored sources.

This is a search baseline, not generation, legal verification or a hybrid/vector
index. It never reads credentials, stores derived text or calls a provider.
"""

from collections import Counter
from dataclasses import dataclass
import asyncio
import math
import re
import hashlib
from typing import Any, Iterable

from pydantic import ValidationError

from clauseiq_types.source import SourceExtraction
from models.library_search import (
    LibrarySearchCoverage,
    LibrarySearchHit,
    LibrarySearchResponse,
)
from services.ai.review_passages import ReviewPassage, build_review_passages


MAX_SCAN_DOCUMENTS = 100
MAX_SCAN_PASSAGES = 10_000
MAX_EXCERPT_CHARACTERS = 640
_WORD = re.compile(r"[^\W_]+", re.UNICODE)
_STOP_WORDS = frozenset(
    {
        "a",
        "all",
        "an",
        "and",
        "are",
        "at",
        "by",
        "contracts",
        "contract",
        "document",
        "documents",
        "does",
        "each",
        "every",
        "find",
        "for",
        "from",
        "have",
        "in",
        "is",
        "list",
        "me",
        "my",
        "of",
        "on",
        "or",
        "our",
        "show",
        "that",
        "the",
        "their",
        "these",
        "this",
        "to",
        "what",
        "which",
        "who",
        "with",
    }
)


@dataclass(frozen=True)
class _IndexedPassage:
    document_id: str
    filename: str
    source_revision_id: str
    source_incomplete: bool
    passage: ReviewPassage
    terms: Counter[str]


def _tokens(text: str) -> list[str]:
    return [match.group().casefold() for match in _WORD.finditer(text)]


def _query_tokens(query: str) -> tuple[str, ...]:
    tokens = _tokens(query)
    significant = [token for token in tokens if token not in _STOP_WORDS]
    return tuple(dict.fromkeys(significant or tokens))


def _valid_source(
    document: dict[str, Any],
) -> tuple[SourceExtraction, list[ReviewPassage]] | None:
    try:
        document_id = document["id"]
        filename = document["filename"]
        revision = document["source_revision_id"]
        if (
            not isinstance(document_id, str)
            or not document_id
            or not isinstance(filename, str)
            or not filename
            or not isinstance(revision, str)
            or not revision.strip()
            or document.get("source_status") != "stored"
            or document.get("has_pdf_file") is not True
        ):
            return None
        extraction = SourceExtraction.model_validate(
            document["source_extraction"], strict=True
        )
        if (
            extraction.content_sha256 != document.get("source_sha256")
            or extraction.status != document.get("extraction_status")
            or extraction.status not in ("complete", "partial")
            or extraction.text
            != "\n".join(page.text for page in extraction.pages if page.text).strip()
        ):
            return None
        extracted_pages = sum(page.status == "extracted" for page in extraction.pages)
        if (
            not extracted_pages
            or (
                extraction.status == "complete"
                and extracted_pages != extraction.page_count
            )
            or (
                extraction.status == "partial"
                and extracted_pages == extraction.page_count
            )
        ):
            return None
        passages = build_review_passages(extraction, revision)
        if not passages:
            return None
        return extraction, passages
    except (KeyError, TypeError, ValueError, ValidationError):
        return None


def _excerpt(text: str, query_terms: tuple[str, ...]) -> tuple[str, bool]:
    if len(text) <= MAX_EXCERPT_CHARACTERS:
        return text, False
    first_match = next(
        (
            match.start()
            for match in _WORD.finditer(text)
            if match.group().casefold() in query_terms
        ),
        0,
    )
    start = max(0, first_match - 120)
    end = min(len(text), start + MAX_EXCERPT_CHARACTERS)
    start = max(0, end - MAX_EXCERPT_CHARACTERS)
    return text[start:end], start > 0 or end < len(text)


def search_passages(
    documents: Iterable[dict[str, Any]],
    query: str,
    limit: int = 20,
    *,
    documents_in_library: int | None = None,
) -> LibrarySearchResponse:
    """Rank exact source passages. Document records must already be workspace-scoped.

    The document and passage caps are hard bounds, surfaced in coverage rather
    than hidden as a complete-library or exhaustive-result claim.
    """
    if not isinstance(query, str) or not 2 <= len(query.strip()) <= 200:
        raise ValueError("Search query must contain 2–200 characters")
    if type(limit) is not int or not 1 <= limit <= 30:
        raise ValueError("Search result limit must be 1–30")
    query_terms = _query_tokens(query)
    if not query_terms:
        raise ValueError("Search query needs a letter or number")
    provided = list(documents)
    observed_total = max(len(provided), documents_in_library or 0)
    indexed: list[_IndexedPassage] = []
    scanned = searchable = unsearchable = partial = 0
    for document in provided[:MAX_SCAN_DOCUMENTS]:
        source = _valid_source(document)
        if source is not None and len(indexed) + len(source[1]) > MAX_SCAN_PASSAGES:
            break
        scanned += 1
        if source is None:
            unsearchable += 1
            continue
        extraction, passages = source
        searchable += 1
        source_incomplete = extraction.status == "partial"
        partial += int(source_incomplete)
        indexed.extend(
            _IndexedPassage(
                document_id=document["id"],
                filename=document["filename"],
                source_revision_id=document["source_revision_id"],
                source_incomplete=source_incomplete,
                passage=passage,
                terms=Counter(_tokens(passage.text)),
            )
            for passage in passages
        )

    frequency = Counter(term for item in indexed for term in item.terms)
    average_length = (
        sum(sum(item.terms.values()) for item in indexed) / len(indexed)
        if indexed
        else 0.0
    ) or 1.0
    ranked: list[tuple[float, _IndexedPassage]] = []
    for item in indexed:
        length = sum(item.terms.values())
        score = 0.0
        for term in query_terms:
            occurrences = item.terms[term]
            if not occurrences:
                continue
            inverse_frequency = math.log1p(
                (len(indexed) - frequency[term] + 0.5) / (frequency[term] + 0.5)
            )
            denominator = occurrences + 1.2 * (
                1 - 0.75 + 0.75 * length / average_length
            )
            score += inverse_frequency * occurrences * 2.2 / denominator
        if score > 0:
            ranked.append((score, item))
    ranked.sort(
        key=lambda scored: (
            -scored[0],
            scored[1].filename.casefold(),
            scored[1].document_id,
            scored[1].passage.page_number,
            scored[1].passage.start,
        )
    )
    hits = []
    for _, item in ranked[:limit]:
        excerpt, excerpt_partial = _excerpt(item.passage.text, query_terms)
        hits.append(
            LibrarySearchHit(
                document_id=item.document_id,
                filename=item.filename,
                source_revision_id=item.source_revision_id,
                page_number=item.passage.page_number,
                passage_id=item.passage.id,
                excerpt=excerpt,
                excerpt_partial=excerpt_partial,
                source_incomplete=item.source_incomplete,
            )
        )
    return LibrarySearchResponse(
        results=hits,
        coverage=LibrarySearchCoverage(
            documents_in_library=observed_total,
            documents_scanned=scanned,
            documents_not_examined=observed_total - scanned,
            documents_searchable=searchable,
            documents_unsearchable=unsearchable,
            documents_partial=partial,
            passages_examined=len(indexed),
            matched_passages=len(ranked),
            results_truncated=len(ranked) > limit,
            scan_truncated=scanned < observed_total,
        ),
    )


class LibrarySearchService:
    def __init__(self, documents: Any) -> None:
        self.documents = documents

    async def search(
        self, workspace_id: str, query: str, limit: int = 20
    ) -> LibrarySearchResponse:
        from services.library_trace import LibraryTrace
        trace = LibraryTrace("retrieval", "keyword")
        try:
            total, source_records = await self.documents.list_source_snapshots_for_search(workspace_id, MAX_SCAN_DOCUMENTS)
            result = await asyncio.to_thread(search_passages, source_records, query, limit, documents_in_library=total)
            # Opaque provenance fingerprint, never query/filename/source text.
            identities = sorted((str(d.get("id", "")), str(d.get("source_revision_id", "")),
                                 str(d.get("source_sha256", ""))) for d in source_records)
            trace.fields.update(coverage=result.coverage.model_dump(), returned_passages=len(result.results),
                                source_index_fingerprint=hashlib.sha256(repr(identities).encode()).hexdigest())
            result.trace = trace.finish("completed")
            return result
        except BaseException:
            trace.finish("failed_or_unknown")
            raise
