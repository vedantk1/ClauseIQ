"""Large-only retrieval evaluation on old regression and fresh-document corpora.

Pure preparation/scoring: no credentials, provider or workspace storage access.
"""

from dataclasses import dataclass
from decimal import Decimal
import hashlib

import numpy as np

from evaluations.library_search_cases import DATASET_PATH, ROOT, prepare_corpus
from evaluations.library_search_evaluation import evaluate_search
from evaluations.retrieval_comparison import digest, fuse_rankings, normalize_vector, passage_key, query_key
from evaluations.retrieval_embeddings import EmbeddingInput
from services.library_search import search_passages
from services.retrieval_policy import POLICY_VERSION, repeated_headers

PROFILES = {"large": ("text-embedding-3-large", 3072, Decimal("0.13"))}
VERSION = "library-quality-retrieval-v2"
PRICE_DATE = "2026-09-27"
MAX_INPUT_TOKENS = 8192
MAX_BATCH_TOKENS = 200_000


def code_fingerprints(paths):
    return {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest() for path in paths}


@dataclass(frozen=True)
class RetrievalPlan:
    corpora: dict
    inputs: dict
    batches: list
    manifest: dict


async def plan():
    import tiktoken
    from evaluations.library_quality_cases import prepare_corpus as fresh_corpus

    corpora = {"known_development": await prepare_corpus(),
               "known_regression": await prepare_corpus(DATASET_PATH.with_name("holdout.json")),
               "fresh_documents": await fresh_corpus()}
    old_hashes = {document["source_sha256"] for document in corpora["known_development"].documents}
    if old_hashes & {document["source_sha256"] for document in corpora["fresh_documents"].documents}:
        raise ValueError("Fresh documents overlap the old corpus")
    encoder = tiktoken.get_encoding("cl100k_base")
    inputs = {}

    def add(key, kind, text):
        if key in inputs:
            if inputs[key].text != text:
                raise ValueError("Conflicting source identity")
            return
        count = len(encoder.encode(text, disallowed_special=()))
        if not text.strip() or not 1 <= count <= MAX_INPUT_TOKENS:
            raise ValueError("Empty or oversized input; never truncate")
        inputs[key] = EmbeddingInput(key, kind, text, count)

    for corpus in corpora.values():
        for identity, passage in sorted(corpus.passages.items()):
            add(passage_key(identity), "passage", passage.text)
        for case in corpus.dataset.cases:
            if not 2 <= len(case.query.strip()) <= 200:
                raise ValueError("Evaluation query exceeds the product search bound")
            add(query_key(case.query), "query", case.query)
    batches, pending, tokens = [], [], 0
    for key, item in inputs.items():
        if pending and (len(pending) == 64 or tokens + item.tokens > MAX_BATCH_TOKENS):
            batches.append(pending)
            pending, tokens = [], 0
        pending.append(key)
        tokens += item.tokens
    if pending:
        batches.append(pending)
    paths = [ROOT / "backend" / path for path in (
        "evaluations/library_quality_retrieval.py", "evaluations/library_quality_live.py",
        "evaluations/library_quality_cases.py", "evaluations/library_search_cases.py",
        "evaluations/library_search_evaluation.py", "evaluations/retrieval_comparison.py",
        "services/library_search.py", "services/retrieval_policy.py",
        "services/ai/review_passages.py", "services/ai/text_extractor.py")]
    reserved = Decimal(len(inputs) * MAX_INPUT_TOKENS) * sum(p[2] for p in PROFILES.values()) / 1_000_000
    manifest = {"version": VERSION, "price_verified_on": PRICE_DATE,
                "profiles": {name: {"model": p[0], "dimensions": p[1], "usd_per_million": str(p[2])}
                             for name, p in PROFILES.items()},
                "datasets": {split: {"sha256": corpus.dataset_sha256, "queries": len(corpus.dataset.cases),
                             "documents": len(corpus.documents)} for split, corpus in corpora.items()},
                "inputs": [{"key": key, "text_sha256": digest(item.text), "tokens": item.tokens}
                           for key, item in inputs.items()], "batches": batches,
                "reserved_usd": str(reserved), "code_sha256": code_fingerprints(paths),
                "ranking": {"policy_version": POLICY_VERSION, "k": 5, "candidate_depth": 20,
                            "rrf_constant": 60, "abstention_threshold": None},
                "latency_scope": "Batched embedding collection, not interactive query latency"}
    return RetrievalPlan(corpora, inputs, batches, manifest)


class Candidates:
    def __init__(self, corpus, vectors, dimensions):
        self.corpus = corpus
        excluded = repeated_headers(corpus.passages)
        self.identities = sorted(set(corpus.passages) - set(excluded))
        self.matrix = np.asarray([normalize_vector(vectors[passage_key(identity)], dimensions)
                                  for identity in self.identities], dtype=np.float64)
        self.vectors, self.dimensions = vectors, dimensions
        self.filenames = {d["id"]: d["filename"] for d in corpus.documents}

    def search(self, documents, query, *, limit, hybrid=False):
        if documents is not self.corpus.documents or limit != 5:
            raise ValueError("Frozen corpus or k changed")
        vector = normalize_vector(self.vectors[query_key(query)], self.dimensions)
        scores = self.matrix @ np.asarray(vector, dtype=np.float64)
        ranks = [self.identities[i] for i in sorted(range(len(scores)),
                 key=lambda i: (-float(scores[i]), self.identities[i]))[:20]]
        if hybrid:
            lexical = search_passages(documents, query, limit=20)
            ranks = fuse_rankings(ranks, [(hit.document_id, hit.source_revision_id, hit.page_number, hit.passage_id)
                                         for hit in lexical.results])
        return {"results": [{"document_id": i[0], "source_revision_id": i[1], "page_number": i[2],
                "passage_id": i[3], "filename": self.filenames[i[0]], "excerpt": self.corpus.passages[i].text}
                for i in ranks[:limit]], "coverage": {"eligible_passages": len(self.identities)}}


def score(prepared, vectors):
    results = {}
    for split, corpus in prepared.corpora.items():
        methods = {"keyword": evaluate_search(corpus, search_passages, 5)}
        for profile, (_, dimensions, _) in PROFILES.items():
            candidate = Candidates(corpus, vectors[profile], dimensions)
            methods[profile + "_dense"] = evaluate_search(corpus, candidate.search, 5)
            methods[profile + "_hybrid"] = evaluate_search(
                corpus, lambda documents, query, *, limit, candidate=candidate:
                candidate.search(documents, query, limit=limit, hybrid=True), 5)
        for report in methods.values():
            report["scope"] = ("First frozen document-disjoint synthetic measurement" if split == "fresh_documents"
                               else "Previously inspected synthetic regression questions")
            report["overall"]["all_targets_found"] = sum(
                row["expected_passages"] > 0 and not row["missing_relevant_passages"] for row in report["cases"])
            answerable = [row for row in report["cases"] if row["expected_passages"]]
            report["overall"]["macro_recall_capacity_ceiling"] = sum(
                min(5, row["expected_passages"]) / row["expected_passages"] for row in answerable) / len(answerable)
            report["overall"]["cases_exceeding_k"] = sum(row["expected_passages"] > 5 for row in answerable)
        results[split] = methods
    return results
