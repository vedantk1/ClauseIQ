# Library retrieval: first live comparison

Recorded 2026-09-26. This measures passage retrieval on authored synthetic
agreements, not generated-answer accuracy or legal-review quality. At this
experiment's checkpoint the application used key-free lexical search only;
the candidates below were development-only. Subsequent optional semantic
integration has its own [runtime checkpoint](LIBRARY_SEMANTIC_RUNTIME_V1.md).

## Outcome

Embeddings improved aggregate retrieval, but no candidate dominated. Hybrid led
on the development set; dense led on the new-question holdout. Hybrid also lost
both relevant passages on one holdout question that lexical search answered at
the retrieval level. Keep that regression visible rather than selecting a
universal winner from an average.

| Split / retriever | Document recall@5 | Document precision@5 | Passage recall@5 | Passage precision@5 | All labelled passages found |
| --- | ---: | ---: | ---: | ---: | ---: |
| Development / lexical | 93.3% | 54.8% | 80.8% | 25.0% | 14/20 answerable cases |
| Development / dense | 97.5% | 51.0% | 85.0% | 27.0% | 17/20 |
| Development / hybrid | 97.5% | 56.8% | 97.5% | 30.0% | 19/20 |
| Holdout / lexical | 93.8% | 58.3% | 71.9% | 17.5% | 10/16 answerable cases |
| Holdout / dense | 96.9% | 60.4% | 93.8% | 23.8% | 15/16 |
| Holdout / hybrid | 96.9% | 53.1% | 87.5% | 21.3% | 13/16 |

Recall/precision are macro averages over answerable questions, not pooled passage
counts. Document precision uses distinct returned document IDs; passage precision
divides relevant unique passages by five, including unfilled positions. With one
labelled relevant passage, a perfect retrieval still has only 20% passage
precision@5. Relevance is to the frozen labels, not an exhaustive annotation of
everything a legal expert might consider relevant.
Scoring credits the exact relevant passage identity; it does not require a
short displayed excerpt to contain every qualification in that passage.

Each split also contains four unanswerable questions. **Every retriever returned
at least one result for all eight**; these cases are reported separately, not
counted as successful answers. There were zero invalid source identities/excerpts
or duplicate hits in either split for all three candidates. That checks source
resolution, not whether a passage supports a generated claim.

### Category passage recall@5

| Split / category | Questions | Lexical | Dense | Hybrid |
| --- | ---: | ---: | ---: | ---: |
| Development / exact term | 5 | 100% | 100% | 100% |
| Development / paraphrase | 5 | 60% | 60% | 100% |
| Development / multi-document | 5 | 73.3% | 80% | 90% |
| Development / exception / near-match | 5 | 90% | 100% | 100% |
| Holdout / exact term | 4 | 100% | 100% | 100% |
| Holdout / paraphrase | 4 | 37.5% | 100% | 87.5% |
| Holdout / multi-document | 4 | 50% | 75% | 62.5% |
| Holdout / exception / near-match | 4 | 100% | 100% | 100% |

The predeclared hypothesis was that hybrid would improve paraphrase and
multi-document recall without reducing exact-term/exception recall versus
lexical. These category means support it on both splits. They do **not** imply
that every question improves, that hybrid beats dense, or that the result
generalizes beyond this small corpus.

## What failed, and why it matters

The exact cases and relevance anchors are in the
[development and holdout fixtures](../../backend/fixtures/library_search_evaluations/README.md).
Ranks below refer to the fixed candidate lists, not a subsequently tuned run.

| Case | Observed behavior | Consequence |
| --- | --- | --- |
| Development `paraphrase-02`: consultant sending files to an external analysis service | Correct consulting passage ranked lexical 5, dense 12, hybrid 4 | Dense alone missed a permission condition that keyword ranking preserved. |
| Development `paraphrase-03`: withholding an export over a disputed invoice | Correct managed-services page-22 passage ranked lexical 14, dense 6, hybrid 2 | Fusion recovered a clause absent from either individual top five. |
| Development `multi-03`: export-defect correction and two-page service resubmission | The service-terms resubmission passage was outside both top-20 candidate lists; hybrid found only the managed-services half | A multi-agreement answer could silently omit an entire requested agreement. Fusion cannot recover a passage absent from both candidate lists. |
| Holdout `holdout-paraphrase-04`: successful backup versus restoration proof | Managed-services page-17 restoration exercise ranked lexical 19, dense 4, hybrid 6 | Hybrid retained the backup rule but lost its concrete quarterly verification requirement at k=5. |
| Holdout `holdout-multi_document-03`: safeguards on disruptive testing | Software page-2 and managed-services page-18 restrictions ranked lexical 3/1, outside dense top 20, and hybrid 13/10 | Both embedding-based top fives missed both relevant clauses. All five were title/disclaimer/section-heading passages from the managed-services document. |
| Holdout `holdout-multi_document-04`: capacity and change-investigation charges | Managed-services page-9 investigation consent ranked dense 2 but hybrid 10; hybrid found only software capacity | Fusion lost a supporting agreement even though dense retrieved both. |

The disruptive-testing result is a directly observed failure, not a provider
error: repeated page-header blocks outranked substantive restrictions. Inspection
of the software page 2 and managed-services pages 17–18 confirms that the missed
qualifications exist in the preserved PDFs. The original source, passages, labels
and ranking parameters were **not edited after observing these results**.

No-answer queries asked for absent details such as an insurer/policy number or an
exact certificate number. Generic insurance/assurance text is a plausible search
hit, not evidence for those details. Dense and hybrid have no abstention
threshold; returning top-k passages cannot establish answerability or justify
an assertion about all agreements.

## Cost, latency and operational outcome

The live run made **51 serial embedding requests**: seven batches covering 203
passages, followed by 44 individual query requests. All 51 completed and passed
response/vector/usage checks. There were no retries, failures, uncertain outcomes,
model switches, generated answers or paid graders. The existing workspace key
was used without reading private agreements or changing Library data or Qdrant.

| Stage | Requests | Provider-reported input tokens | Usage-based USD | API latency p50 / p95 |
| --- | ---: | ---: | ---: | ---: |
| Passage embedding | 7 | 18,100 | $0.00036200 | 747 / 6,688 ms per batch |
| Query embedding | 44 | 676 | $0.00001352 | 374 / 436 ms per query |
| Total | 51 | 18,776 | **$0.00037552** | 29.33 seconds summed API duration |

This is provider-reported usage multiplied by the
[$0.02 per million input-token price](https://developers.openai.com/api/docs/models/text-embedding-3-small)
checked on the run date, not an independently reconciled invoice. The run reserved
$0.04046848 beforehand using every input's full 8,192-token ceiling; reservations
were not recycled into additional requests.

Offline ranking times, excluding PDF preparation and embedding API calls:

| Split | Lexical p50 / p95 | Dense p50 / p95 | Hybrid p50 / p95 |
| --- | ---: | ---: | ---: |
| Development | 9.951 / 12.270 ms | 0.073 / 0.089 ms | 10.364 / 11.769 ms |
| Holdout | 10.027 / 30.947 ms | 0.073 / 0.082 ms | 10.122 / 11.264 ms |

These are one local run's timings, not a load test. Lexical rebuilds its index per
query; dense uses a preloaded matrix; hybrid includes both. Query API latency is
additional. Percentiles use nearest rank and are sensitive to these small sample
counts. No Qdrant, approximate-nearest-neighbor or end-to-end product-latency
claim is made.

## Reproducible setup

- Corpus: seven immutable synthetic PDFs, six extractable and one image-only
  exclusion; 203 unchanged canonical passages. No OCR or private contracts.
- Splits: 24 visible development questions and 20 new-family holdout questions,
  with four negative/no-answer questions in each. Related variants stay within
  their split; labelled passage identities do not overlap across splits.
- Embedding model: `text-embedding-3-small`, 1536 dimensions, passage/question
  text only. No relevance labels, rationales, filenames prepended to passages,
  rewritten queries or reranking prompts.
- Ranking: current BM25 lexical implementation; exact cosine dense search;
  equal-weight reciprocal rank fusion with constant 60 and 20 candidates per
  ranker. Final k=5; deterministic ties; no abstention threshold.
- Extraction: `pdfplumber:0.11.10:page-lines-v1`; passage version:
  `source-passages-v1`; comparison version: `synthetic-exact-dense-rrf-v1`.
- Prepared plan SHA-256:
  `3e082794e7b76db30675f5d5c68e04efb3b1b86220af626d25a927d49a60bffb`.
  The printed plan includes dataset, source, input and implementation hashes.

Use the [documented comparison commands](../DEVELOPMENT.md#retrieval-comparison-experiment).
Dry run and fixture/scoring tests require no paid requests. Collecting new
embeddings requires an approved budget; an existing complete private cache can
be replayed without spending. Raw vectors, per-request logs and generated
reports remain ignored, while this reviewed result summary and the fixtures are
public-source material. Reproduction without that private cache makes new API
calls; a mutable model alias or environment change can produce different results.

## Interpretation and next step

The later [header/diversity refinement](LIBRARY_RETRIEVAL_REFINEMENT.md) follows
this recommendation and records both improvements and new regressions. The
original results and configuration remain the baseline, not overwritten with
post-change scores.

This is useful engineering evidence, not an academic benchmark. The same known
synthetic contracts appear in both splits; labels were authored and checked in
the development workflow, not independently annotated by legal experts. Category
sample sizes are four or five, and there is one live embedding collection. We
make no statistical-significance or general-contract-accuracy claim.

Do not automatically replace the current keyword search based on these averages.
The next bounded improvement is to distinguish repeated non-clause page furniture
from substantive retrieval candidates, without deleting source text or breaking
source identities. Detect structural page furniture rather than hard-coding this
fixture's disclaimer or discarding all short passages; legitimate short clauses
and repeated operative wording need preservation tests. Investigate
multi-document candidate coverage and preserve
keyword access. Any change informed by these misses must report these questions
as regression data; freeze fresh untouched cases before making a new holdout
claim. No rank weights or thresholds were tuned on this holdout.

Only then promote a measured semantic/hybrid path with explicit indexing consent,
visible coverage, source-revision freshness and deletion safety. Library-wide
generated answers remain unimplemented and need separate evidence-support,
qualification, cross-document attribution and insufficient-evidence evaluations.
Single-agreement review/Ask remains on its existing full-source path.
