"""Held-out fictional PDFs and labels are source-bound and require no provider."""

import asyncio
from collections import Counter
import hashlib
import importlib.util
import json
from unittest.mock import patch

import pytest
from pydantic import ValidationError

from evaluations.library_quality_cases import (
    ANSWERS_PATH,
    DATASET_PATH,
    FIXTURE_DIRECTORY,
    QualityDataset,
    load_dataset,
    prepare_answer_cases,
    prepare_corpus,
)
from evaluations.library_search_cases import validate_anchors


@pytest.fixture(scope="module")
def corpus():
    with patch("socket.socket.connect", side_effect=AssertionError("Network forbidden")), \
         patch("openai.OpenAI", side_effect=AssertionError("Provider forbidden")), \
         patch("openai.AsyncOpenAI", side_effect=AssertionError("Provider forbidden")):
        return asyncio.run(prepare_corpus())


def test_new_pdf_generator_reproduces_only_its_own_frozen_pdfs():
    spec = importlib.util.spec_from_file_location("fresh_library_generator", FIXTURE_DIRECTORY / "generate.py")
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.check()
    assert set(module.EXPECTED) == {
        "equipment-maintenance-3p.pdf", "data-processing-5p.pdf", "research-services-7p.pdf",
    }


def test_holdout_inventory_and_source_identity(corpus):
    assert corpus.dataset.id == "fresh-library-quality-v1"
    assert corpus.dataset_sha256 == hashlib.sha256(DATASET_PATH.read_bytes()).hexdigest()
    assert len(corpus.documents) == 3
    assert len(corpus.passages) == 60
    assert {item["id"] for item in corpus.documents} == {
        "fresh-equipment", "fresh-processing", "fresh-research",
    }
    assert {item["source_extraction"]["page_count"] for item in corpus.documents} == {3, 5, 7}
    assert all(item["extraction_status"] == "complete" for item in corpus.documents)
    assert Counter(case.category for case in corpus.dataset.cases) == {
        "exact_term": 2, "paraphrase": 2, "multi_document": 3,
        "exception_near_match": 3, "unanswerable": 2,
    }
    assert all(anchor.identity() in corpus.passages for anchor in corpus.dataset.anchors.values())


def test_label_quotes_match_authored_text_and_exact_extracted_page(corpus):
    source = json.loads((FIXTURE_DIRECTORY / "source.json").read_text())
    authored = {item["filename"]: item for item in source["fixtures"]}
    filenames = {item["id"]: item["filename"] for item in corpus.documents}
    for anchor in corpus.dataset.anchors.values():
        page = authored[filenames[anchor.document_id]]["pages"][anchor.page_number - 1]
        assert sum(anchor.quote in section["text"] for section in page["sections"]) == 1
        passage = corpus.passages[anchor.identity()]
        assert " ".join(passage.text.split()).count(" ".join(anchor.quote.split())) == 1


@pytest.mark.parametrize("mutation", [
    lambda data: data["documents"][0].update(filename="../../private.pdf"),
    lambda data: data["anchors"]["equipment_base"].update(source_revision_id="old-revision"),
    lambda data: data["anchors"]["equipment_base"].update(page_number=4),
    lambda data: data["cases"][0].update(anchors=["missing"]),
    lambda data: data["cases"][0].update(anchors=[]),
    lambda data: data["cases"][-1].update(anchors=["equipment_base"]),
    lambda data: data["cases"][4].update(anchors=["equipment_parts"]),
])
def test_malformed_holdout_identity_and_relevance_contract_fails(corpus, mutation):
    data = corpus.dataset.model_dump()
    mutation(data)
    with pytest.raises(ValidationError):
        QualityDataset.model_validate(data)


def test_hash_drift_fails_before_source_loading(tmp_path):
    path = tmp_path / "dataset.json"
    path.write_bytes(DATASET_PATH.read_bytes() + b"\n")
    path.with_suffix(".sha256").write_text(DATASET_PATH.with_suffix(".sha256").read_text())
    with pytest.raises(ValueError, match="hash changed"):
        load_dataset(path)


def test_anchor_drift_does_not_silently_match_another_page(corpus):
    dataset = corpus.dataset.model_copy(deep=True)
    dataset.anchors["equipment_base"] = dataset.anchors["equipment_base"].model_copy(
        update={"passage_id": "p1_b2_v1"})
    with pytest.raises(ValueError, match="anchor"):
        validate_anchors(dataset, corpus.passages)


def test_four_answer_cases_resolve_complete_fixed_passages_without_provider(corpus):
    with patch("socket.socket.connect", side_effect=AssertionError("Network forbidden")), \
         patch("openai.OpenAI", side_effect=AssertionError("Provider forbidden")), \
         patch("openai.AsyncOpenAI", side_effect=AssertionError("Provider forbidden")):
        cases = asyncio.run(prepare_answer_cases())
    assert hashlib.sha256(ANSWERS_PATH.read_bytes()).hexdigest() == ANSWERS_PATH.with_suffix(".sha256").read_text().strip()
    assert [case["id"] for case in cases] == [
        "fresh-answer-cross-schedules", "fresh-answer-breach-qualification",
        "fresh-answer-missing-pump-schedule", "fresh-answer-unsupported-escrow",
    ]
    assert [case["expected_outcome"] for case in cases] == [
        "answered", "answered", "partial", "insufficient_evidence",
    ]
    for case in cases:
        assert len(case["evidence"]) == len(case["anchors"])
        assert "criteria" not in case["context"]
        assert case["context"]["method"] == "fixed_evidence"
        for item in case["evidence"]:
            key = (item["document_id"], item["source_revision_id"], item["page_number"], item["passage_id"])
            assert item["quote"] == corpus.passages[key].text
            assert item["source_incomplete"] is False
    assert len({item["document_id"] for item in cases[0]["evidence"]}) == 3


def test_answer_specification_hash_drift_is_rejected(tmp_path, monkeypatch):
    from evaluations import library_quality_cases as module

    path = tmp_path / "answers.json"
    path.write_bytes(ANSWERS_PATH.read_bytes() + b"\n")
    path.with_suffix(".sha256").write_text(ANSWERS_PATH.with_suffix(".sha256").read_text())
    monkeypatch.setattr(module, "ANSWERS_PATH", path)
    with pytest.raises(ValueError, match="hash changed"):
        asyncio.run(module.prepare_answer_cases())
