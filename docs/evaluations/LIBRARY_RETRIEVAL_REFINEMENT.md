# Library retrieval: header filtering and document diversity

Date: 2026-09-26. Development-only follow-up to the
[original live comparison](LIBRARY_RETRIEVAL_V1.md). At this experiment's checkpoint,
Library search was unpaid lexical only. The subsequent
[optional semantic index](../ARCHITECTURE.md#explicit-semantic-indexing-and-search)
is a separate implementation; it does not turn these frozen scores into a new
product benchmark.

## Decision

Header filtering fixes the observed header-crowding failure in hybrid retrieval,
but does not make hybrid universally better. Keep keyword access and do not
promote a single automatic replacement from these results. Reject blanket
document diversity as a default: it displaces supporting qualifications and
reduces precision. Further product work should establish explicit indexing,
coverage, freshness and deletion behavior before adding semantic search.

This is a **post-change regression comparison**, not a second unseen benchmark.
The original 24 development and 20 holdout questions have now been inspected.
The latter retain their original dataset name only for traceability. No fresh
semantic holdout, generated-answer evaluation or independent annotation was
performed in this follow-up.

## Fixed changes

The source PDFs, extraction, 203 canonical passages, labels, model and cached
embedding inputs are unchanged. Eligibility is separate derived metadata:

- Consider only the first complete block on a page that has other passages.
  At least two leading lines must repeat on three or more pages and at least
  60% of the observed pages in the same document/source revision.
- Require a small heading/informational-notice block with no detected operative
  wording. Keep ambiguous blocks, short clauses, numbered clauses, mixed
  header/body passages and clauses with attached footers. This is a conservative
  text heuristic, not a general PDF-layout or legal-content classifier.
- Exclude eligible headers before taking the candidate window. Do not delete,
  rewrite, combine or renumber source text. All original passages stay available
  to source viewing and the baseline.
- Compare filtered lexical, filtered dense and filtered hybrid with the original
  BM25 constants, cosine similarity, RRF constant 60, depth 20 and final k=5.
  Filtering also changes the lexical corpus statistics, not just final output.
- Separately test one best fused hit per represented document, then refill spare
  slots in fused order. This uses neither relevance labels nor case categories.
  It does not infer which documents the question actually needs.

These rules were recorded before reviewing the new scores. Tests exposed a
physical-page continuation flag being mistaken for an incomplete header; that
implementation error was corrected before assessment. No rank weights, cutoffs
or thresholds were tuned against the new scores.

The policy excludes 42 repeated headers from the three longer agreements,
leaving 161 retrieval candidates across six extractable documents. No labelled
relevant passage is excluded. One- and two-page documents retain their headers;
the image-only PDF remains unsearchable. Footers embedded in substantive clauses
are not stripped. Eligibility alone is not proof that every retained passage is
useful or every excluded header is meaningless for every possible query.

## Results

Macro passage recall@5 and precision@5 are over answerable questions, as in the
original report. The 24-question set has 20 answerable questions; the 20-question
set has 16. These small synthetic sets do not support a general accuracy claim.

| Inspected set | Candidate | Passage recall@5 | Passage precision@5 |
| --- | --- | ---: | ---: |
| 24-question development | Lexical → filtered lexical | 80.8% → 79.2% | 25.0% → 24.0% |
| 24-question development | Dense → filtered dense | 85.0% → 85.0% | 27.0% → 27.0% |
| 24-question development | Hybrid → filtered hybrid | 97.5% → 97.5% | 30.0% → 30.0% |
| 24-question development | Diverse filtered hybrid | 82.5% | 25.0% |
| 20-question former holdout | Lexical → filtered lexical | 71.9% → 71.9% | 17.5% → 17.5% |
| 20-question former holdout | Dense → filtered dense | 93.8% → 93.8% | 23.8% → 23.8% |
| 20-question former holdout | Hybrid → filtered hybrid | 87.5% → 90.6% | 21.3% → 23.8% |
| 20-question former holdout | Diverse filtered hybrid | 87.5% | 22.5% |

Filtered hybrid finds all labelled passages for 19/20 answerable development
questions and 14/16 former-holdout questions, versus 19/20 and 13/16 originally.
It retrieves 30/31 and 19/21 labelled passage occurrences respectively. These
micro counts differ from macro recall because questions have different numbers
of labelled passages.

All four variants still return hits for **all eight no-answer questions**; no
abstention threshold has been added. All hits retain valid exact source identity
and verbatim text; there are zero invalid or duplicate hits. Neither property
establishes answer support or completeness.

## Gains, losses and remaining misses

- **Testing restrictions:** filtered hybrid moves the software page 2 and
  managed-services page 18 clauses to ranks 1 and 2. Previously both were absent
  from the hybrid top five, which contained only headers. Filtered dense moves
  the clauses into its candidate window, but only to ranks 6 and 10: removing
  noise does not itself solve every semantic-ranking problem.
- **Restoration testing:** the quarterly exercise moves from hybrid rank 6 to
  5, alongside the backup obligation at rank 1. Both labelled passages now fit.
- **Knowledge concentration regression:** the requirement not to depend on one
  employee moves out of hybrid's top five to rank 6, although dense ranks it 1.
  It is absent from the lexical candidate window. This is consistent with RRF
  favoring candidates present in both lists over this dense-only hit.
- **Lexical regression:** after recomputing corpus statistics without headers,
  the consulting liability cap slips to rank 6. The multi-agreement caps query
  drops from two of three labelled passages to one of three. The original
  keyword implementation therefore remains unchanged in the app.
- **Unresolved candidate recall:** the short service-terms resubmission clause
  remains outside both 20-candidate windows. Diversity cannot recover a passage
  that never reaches fusion. Managed-services investigation approval remains
  dense rank 2 but filtered-hybrid rank 10.
- **Diversity tradeoff:** reserving slots for different documents drops four
  development rule/exception questions from full to half coverage and loses a
  paraphrase hit. Development passage recall falls from filtered hybrid's 97.5%
  to 82.5%; document precision falls from 59.3% to 28.7%. Former-holdout document
  precision falls from 57.3% to 30.8%. Finding more distinct agreements is not a
  substitute for retrieving a rule and its qualification together.

## Reproduction and validation

No new API calls were made. This is a new ranking run over **real cached provider
embeddings**, not fake-vector semantic scoring. The original 51-request
collection cost $0.00037552; this replay's additional provider cost is $0.

The original strict source/input/dataset/code/cache validator is unchanged.
Refinement provenance separately records its consumer code hashes and the
original producer/cache hashes; an incompatible cache is rejected rather than
silently reused. Both original and refined reports remain privately retained.

- Producer plan: `3e082794e7b76db30675f5d5c68e04efb3b1b86220af626d25a927d49a60bffb`
- Consumer: `0e590ed022a1e4b52c8620b4ecb07fc49824bd56ea374bf08b23f100da3912f9`
- Policy: `repeated-header-eligibility-v1`
- Experiment: `retrieval-header-diversity-ablation-v1`

Fresh deterministic tests cover short/repeated operative clauses, mixed blocks,
page-boundary flags, document/revision isolation, candidate-window refill,
label-free ranking, diversity, immutable cache replay and no provider/key access.
Fake vectors in these tests establish mechanics only. The cached-vector report
above supplies the separate semantic retrieval measurement. All 129 focused
retrieval, evaluation and source-passage tests passed, including 31 new tests.

See [offline commands](../DEVELOPMENT.md#offline-retrieval-refinement).
Offline query timing excludes prebuilt-index construction and API latency and is
not directly comparable with the original lexical per-query rebuild timing.
No UI behavior, production index, Qdrant data or existing workspace was changed.
Unseen-contract generalization and library-wide generated answers remain untested.
