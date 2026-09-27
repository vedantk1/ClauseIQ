# Fresh library quality labels (v1)

This directory freezes a modest document-held-out evaluation bundle over the
three new fictional PDFs in `tests/fixtures/pdfs/fresh-library-v1`. It is kept
separate from the original seven-PDF retrieval baseline, and does not include
real contracts, user data, credentials, ranking code or generated answers.

- `dataset.json`: 12 labelled retrieval questions: two exact-term, two
  paraphrase, three multi-document, three exception/near-match and two
  unanswerable. Fourteen relevance anchors use exact document ID, source
  revision, physical page and canonical passage ID. The source quote for each
  anchor is checked against the actual extracted PDF passage.
- `answers.json`: four fixed-evidence generation questions covering
  cross-contract distinction, material qualifications, a deliberately missing
  schedule passage and abstention on unsupported biometric escrow. Each full
  evidence passage has a SHA-256 hash; expected outcomes and criteria are outside
  the generation context.
- The adjacent `.sha256` files freeze the bytes of those two specifications.
  Source/PDF SHA-256 values are separately frozen in the PDF manifest. The
  extraction and passage algorithm versions are checked before any evaluation.

The loader is `backend/evaluations/library_quality_cases.py`. Its
`prepare_corpus()` and `prepare_answer_cases()` functions only read synthetic
files and resolve exact passages; they never call a model, search service or
provider. Run the key-free fixture checks with:

```bash
backend/venv/bin/python -m pytest backend/tests/test_library_quality_cases.py -q
```

These examples were authored and labelled by the project assistant, not by an
independent legal reviewer. They can expose regressions and specific failure
modes, but their scores are neither an unseen benchmark nor proof of legal
correctness. Keep unsuccessful and unsupported cases visible; do not tune to
these labels after inspecting outcomes and then present them as held-out.
