"""Versioned source plans. No key, provider, database or source mutation."""

from dataclasses import dataclass
from decimal import Decimal
import hashlib
import json
import math

from services.ai.review_passages import PASSAGE_VERSION
from services.library_search import _valid_source
from services.retrieval_policy import POLICY_VERSION, repeated_headers

MODEL = "text-embedding-3-large"
DIMENSIONS = 3072
VERSION = "library-semantic-v2"
PRICE_PER_MILLION = Decimal("0.13")
PRICE_VERIFIED_ON = "2026-09-27"
MAX_INPUT_TOKENS = 8192
MAX_TOTAL_TOKENS = 200_000
MAX_PASSAGES = 512


class SemanticError(Exception):
    def __init__(self, code, message, status=409):
        self.code, self.message, self.status = code, message, status
        super().__init__(code)


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()).hexdigest()


def cost(tokens):
    return str(Decimal(tokens) * PRICE_PER_MILLION / 1_000_000)


def validate_vector(vector):
    if (not isinstance(vector, list) or len(vector) != DIMENSIONS
            or any(type(value) not in (float, int) or not math.isfinite(value) for value in vector)
            or not 0 < math.hypot(*vector) < float("inf")):
        raise SemanticError("INVALID_EMBEDDING", "The embedding response was invalid. No automatic retry was made.", 502)


@dataclass(frozen=True)
class SourcePlan:
    fingerprint: str
    passages: dict
    total_passages: int
    excluded_headers: int
    partial: bool


def source_plan(document):
    source = _valid_source(document)
    if source is None:
        raise SemanticError("SOURCE_UNAVAILABLE", "This agreement has no usable current source text.", 422)
    extraction, passages = source
    if len(passages) > MAX_PASSAGES:
        raise SemanticError("INDEX_LIMIT", "This agreement exceeds the current 512-passage indexing limit. Keyword search remains available.", 422)
    originals = {(document["id"], document["source_revision_id"], p.page_number, p.id): p for p in passages}
    excluded = repeated_headers(originals)
    eligible = {p.id: p for identity, p in originals.items() if identity not in excluded}
    if not eligible:
        raise SemanticError("SOURCE_UNAVAILABLE", "No eligible source passages are available.", 422)
    fingerprint = digest({"source_sha256": document["source_sha256"], "revision": document["source_revision_id"],
                          "extraction": document["source_extraction"], "passage_version": PASSAGE_VERSION,
                          "policy_version": POLICY_VERSION, "version": VERSION, "model": MODEL,
                          "dimensions": DIMENSIONS})
    return SourcePlan(fingerprint, eligible, len(passages), len(excluded), extraction.status == "partial")


def token_count(texts):
    import tiktoken
    try:
        encoder = tiktoken.get_encoding("cl100k_base")
        counts = [len(encoder.encode(text, disallowed_special=())) for text in texts]
    except Exception:
        raise SemanticError("TOKENIZER_UNAVAILABLE", "The local tokenizer is unavailable. No AI request was sent.", 503) from None
    if not counts or any(not 1 <= count <= MAX_INPUT_TOKENS for count in counts) or sum(counts) > MAX_TOTAL_TOKENS:
        raise SemanticError("EMBEDDING_INPUT_LIMIT", "Source text exceeds the embedding request limits; it was not truncated.", 422)
    return sum(counts)
