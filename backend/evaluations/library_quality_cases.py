"""Frozen document-held-out fixtures for offline retrieval and answer evaluations.

This module loads only checked-in fictional PDFs and exact source coordinates.
It does not search, generate an answer, read settings, or contact a provider.
"""

from collections import Counter
import hashlib
import json
from pathlib import Path
from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock

from pydantic import Field, model_validator

from evaluations.library_search_cases import (
    EvaluationCorpus,
    FixtureDocument,
    FixtureModel,
    RetrievalCase,
    RetrievalDataset,
    ROOT,
    SourceAnchor,
    validate_anchors,
)
from services.ai.review_passages import PASSAGE_VERSION, build_review_passages
from services.ai.text_extractor import EXTRACTION_VERSION, TextExtractor
from services.library_answers.context import fingerprint, resolve_evidence


FIXTURE_DIRECTORY = ROOT / "tests/fixtures/pdfs/fresh-library-v1"
DATA_DIRECTORY = ROOT / "backend/fixtures/library_quality_v2"
DATASET_PATH = DATA_DIRECTORY / "dataset.json"
ANSWERS_PATH = DATA_DIRECTORY / "answers.json"
EXPECTED_PAGES = {
    "equipment-maintenance-3p.pdf": 3,
    "data-processing-5p.pdf": 5,
    "research-services-7p.pdf": 7,
}


class QualityDataset(FixtureModel):
    """Same scorer-facing fields as RetrievalDataset, without its seven-PDF allowlist."""

    id: str
    version: str
    purpose: str
    review_basis: str
    extraction_version: str
    passage_version: str
    documents: list[FixtureDocument] = Field(min_length=3, max_length=3)
    anchors: dict[str, SourceAnchor]
    cases: list[RetrievalCase] = Field(min_length=12, max_length=12)

    @model_validator(mode="after")
    def validate_references(self):
        documents = {document.id: document for document in self.documents}
        if (len(documents) != 3
                or {document.filename: document.pages for document in self.documents} != EXPECTED_PAGES
                or not all(document.extractable for document in self.documents)
                or len({document.source_revision_id for document in self.documents}) != 3
                or len({case.id for case in self.cases}) != 12):
            raise ValueError("Holdout requires three distinct extractable documents and twelve cases")
        if Counter(case.category for case in self.cases) != {
            "exact_term": 2, "paraphrase": 2, "multi_document": 3,
            "exception_near_match": 3, "unanswerable": 2,
        }:
            raise ValueError("Holdout case category mix changed")
        for anchor in self.anchors.values():
            document = documents.get(anchor.document_id)
            if (document is None or anchor.source_revision_id != document.source_revision_id
                    or anchor.page_number > document.pages):
                raise ValueError("Anchor must identify a physical page in its exact source revision")
        used = set()
        for case in self.cases:
            names = set(case.anchors)
            if len(names) != len(case.anchors) or not names.issubset(self.anchors):
                raise ValueError("Case has duplicate or missing source anchors")
            if (case.category == "unanswerable") != (not case.anchors):
                raise ValueError("Only unanswerable cases have no relevance anchors")
            if case.category == "multi_document" and len({self.anchors[name].document_id for name in names}) < 2:
                raise ValueError("Multi-document case needs at least two documents")
            used.update(names)
        if used != set(self.anchors):
            raise ValueError("Unused source anchor in frozen holdout")
        return self


def _frozen_json(path: Path) -> tuple[dict, str]:
    raw = path.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    if digest != path.with_suffix(".sha256").read_text().strip():
        raise ValueError(f"Frozen {path.name} hash changed; review and version deliberately")
    return json.loads(raw), digest


def load_dataset(path: Path = DATASET_PATH) -> tuple[QualityDataset, str]:
    data, digest = _frozen_json(path)
    dataset = QualityDataset.model_validate(data)
    if dataset.extraction_version != EXTRACTION_VERSION or dataset.passage_version != PASSAGE_VERSION:
        raise ValueError("Extraction or passage version changed; source labels need review")
    manifest = json.loads((FIXTURE_DIRECTORY / "manifest.json").read_text())
    source_hash = hashlib.sha256((FIXTURE_DIRECTORY / "source.json").read_bytes()).hexdigest()
    if (manifest.get("source_sha256") != source_hash
            or manifest.get("pdf_sha256") != {doc.filename: doc.sha256 for doc in dataset.documents}):
        raise ValueError("Holdout manifest does not match the frozen authored source and PDFs")
    return dataset, digest


async def prepare_corpus(path: Path = DATASET_PATH) -> EvaluationCorpus:
    """Resolve all labels against actual PDF extraction; no provider or user data."""
    dataset, digest = load_dataset(path)
    documents, passages = [], {}
    for fixture in dataset.documents:
        content = (FIXTURE_DIRECTORY / fixture.filename).read_bytes()
        if hashlib.sha256(content).hexdigest() != fixture.sha256:
            raise ValueError("Holdout PDF hash changed; do not silently relabel")
        source = await TextExtractor().extract_source(content, fixture.filename)
        if (source.status != "complete" or source.page_count != fixture.pages
                or source.extraction_version != dataset.extraction_version):
            raise ValueError("Holdout PDF extraction or physical pages changed")
        documents.append({
            "id": fixture.id, "filename": fixture.filename, "workspace_id": "synthetic-evaluation",
            "source_revision_id": fixture.source_revision_id, "source_sha256": fixture.sha256,
            "source_status": "stored", "has_pdf_file": True, "extraction_status": source.status,
            "source_extraction": source.model_dump(),
        })
        for passage in build_review_passages(source, fixture.source_revision_id):
            identity = fixture.id, fixture.source_revision_id, passage.page_number, passage.id
            passages[identity] = passage
    # The existing scorer consumes the same fields; its original seven-PDF
    # validator is intentionally not used for this separate holdout.
    validate_anchors(cast(RetrievalDataset, dataset), passages)
    return EvaluationCorpus(cast(RetrievalDataset, dataset), digest, documents, passages)


async def prepare_answer_cases() -> list[dict]:
    """Resolve four fixed evidence bundles, without retrieving or generating."""
    specification, _ = _frozen_json(ANSWERS_PATH)
    corpus = await prepare_corpus()
    if specification.get("version") != "fresh-library-quality-answers-v1":
        raise ValueError("Unknown held-out answer specification")
    cases = specification.get("cases")
    if (not isinstance(cases, list) or len(cases) != 4
            or len({case.get("id") for case in cases}) != 4
            or {case.get("expected_outcome") for case in cases}
               != {"answered", "partial", "insufficient_evidence"}):
        raise ValueError("Held-out answer case set changed")
    used_names = {name for case in cases for name in case["anchors"]}
    if set(specification.get("passage_hashes", {})) != used_names:
        raise ValueError("Answer passage hashes must cover exactly the fixed evidence")
    records = {document["id"]: document for document in corpus.documents}
    documents = SimpleNamespace(get_document_for_workspace=AsyncMock(
        side_effect=lambda document, workspace: records.get(document) if workspace == "synthetic-evaluation" else None))
    prepared = []
    for case in cases:
        if (not case.get("question") or not case.get("criteria")
                or not isinstance(case["criteria"], list) or not case["anchors"]
                or len(set(case["anchors"])) != len(case["anchors"])):
            raise ValueError("Answer question, criteria and unique evidence are required")
        hits = []
        for name in case["anchors"]:
            anchor = corpus.dataset.anchors[name]
            passage = corpus.passages[anchor.identity()]
            if hashlib.sha256(passage.text.encode()).hexdigest() != specification["passage_hashes"][name]:
                raise ValueError("A complete answer evidence passage changed")
            hits.append(anchor.model_dump(exclude={"quote"}))
        evidence, bindings = await resolve_evidence(documents, "synthetic-evaluation", hits)
        doc_count = len(bindings)
        coverage = {"documents_in_library": doc_count, "documents_scanned": doc_count,
                    "documents_not_examined": 0, "documents_searchable": doc_count,
                    "documents_unsearchable": 0, "documents_partial": 0,
                    "passages_examined": len(hits), "matched_passages": len(hits),
                    "results_truncated": False, "scan_truncated": False}
        context = {"question": case["question"], "method": "fixed_evidence",
                   "hits": hits, "bindings": bindings, "coverage": coverage}
        prepared.append({**case, "context": context, "evidence": evidence,
                         "evidence_sha256": fingerprint(evidence)})
    return prepared
