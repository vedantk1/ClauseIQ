"""Key-free frozen evidence preparation; no generated-answer quality scoring."""

import asyncio
import hashlib
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

from evaluations.library_search_cases import ROOT, prepare_corpus
from services.library_answers.context import fingerprint, resolve_evidence
from services.library_answers.generation import prepare

CASES_PATH = ROOT / "backend/fixtures/library_answer_evaluations/cases.json"


async def prepare_cases():
    raw = CASES_PATH.read_bytes()
    if hashlib.sha256(raw).hexdigest() != CASES_PATH.with_suffix(".sha256").read_text().strip():
        raise ValueError("Answer criteria changed; review and version the frozen cases")
    specification = json.loads(raw)
    corpus = await prepare_corpus()
    records = {doc["id"]: doc for doc in corpus.documents}
    documents = SimpleNamespace(get_document_for_workspace=AsyncMock(side_effect=lambda document, workspace: records.get(document)))
    queries = {case.id: case.query for case in corpus.dataset.cases}
    cases = []
    for case in specification["cases"]:
        hits = []
        for name in case["anchors"]:
            anchor = corpus.dataset.anchors[name]
            passage = corpus.passages[anchor.identity()]
            if hashlib.sha256(passage.text.encode()).hexdigest() != specification["passage_hashes"][name]:
                raise ValueError("A complete answer evidence passage changed")
            hits.append(anchor.model_dump(exclude={"quote"}))
        if case.get("include_planted_instruction"):
            # PDF bytes and extraction version are already frozen by prepare_corpus.
            hits.append({"document_id": "embedded-instructions", "source_revision_id": "eval-embedded-instructions-v1",
                         "page_number": 1, "passage_id": "p1_b3_v1"})
        evidence, bindings = await resolve_evidence(documents, "synthetic-evaluation", hits)
        doc_count = len(bindings)
        gap = case.get("unexamined_documents", 0)
        context = {"question": queries[case["query_case"]], "method": "fixed_evidence", "hits": hits, "bindings": bindings,
                   "coverage": {"documents_in_library": doc_count + gap, "documents_scanned": doc_count,
                     "documents_not_examined": gap, "documents_searchable": doc_count,
                     "documents_unsearchable": 0, "documents_partial": 0, "passages_examined": len(hits),
                     "matched_passages": len(hits), "results_truncated": False, "scan_truncated": bool(gap)}}
        cases.append({**case, "context": context, "evidence": evidence, "evidence_sha256": fingerprint(evidence)})
    return cases


async def main():
    cases = await prepare_cases()
    report = []
    for case in cases:
        prepared = prepare(case["context"], case["evidence"], "gpt-6-sol", "medium")
        report.append({"id": case["id"], "evidence_sha256": case["evidence_sha256"],
                       "expected_outcome": case["expected_outcome"], "generation": prepared.generation})
    print(json.dumps({"mode": "key-free preflight only", "cases": report}, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
