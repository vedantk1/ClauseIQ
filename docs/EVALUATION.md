# Evaluation

ClauseIQ separates application correctness from the quality of generated reviews.
A successful request, a matched quotation and a passing test suite measure
different things. None establishes a complete or legally reliable review.

## What exists

| Layer | Evidence | What it establishes |
| --- | --- | --- |
| Application contracts | Deterministic backend/frontend tests and unpaid browser checks | Source identity, scoped persistence, explicit dispatch, failure handling and navigation under the tested conditions |
| Generation references | Two source-reviewed synthetic cases with frozen criteria | A repeatable basis for assessing short and long reviews, not an automated semantic score |
| Diagnostic checker calibration | Ten authored candidates: six negative mutations and four positive controls | Known errors and valid counterexamples for evaluating the development-only checker |
| Import corpus | Seven synthetic PDFs, including scanned and adversarial inputs | Extraction and workflow edge cases; these are not seven labelled AI-quality benchmarks |
| Library retrieval | 24 labelled synthetic development questions and a local lexical-ranking harness | Passage/document retrieval regression, including missed passages and irrelevant near-matches |
| Live retrieval comparison | Fixed lexical/dense/hybrid comparison using 24 development and 20 new-family known-corpus questions | Measured retrieval gains, per-case regressions, near-matches, usage and latency; not generated-answer quality |
| Retrieval refinement | Header-filtering and diversity ablations replayed over the same real provider embeddings | Post-change regression tradeoffs on inspected questions; no additional API calls or new holdout claim |
| Semantic runtime smoke | Two isolated synthetic documents, four fixed development queries, real embeddings and real Mongo/GridFS/Qdrant | Actual index/search integration, source resolution and a recorded cross-agreement miss; not a new broad accuracy score |
| Library answers with fixed evidence | Eleven frozen, inspected synthetic cases through the normal generation engine | Source-assessed statements, omissions and abstention/label errors when the evidence is controlled; not end-to-end RAG quality |
| End-to-end Library RAG | Four inspected questions × actual Keyword/Semantic top-five results, real storage and eight live answers | Links observed retrieval misses to partial answers; records qualification omission, precision error and abstention separately |

The generator cases are in
[backend/fixtures/review_evaluations](../backend/fixtures/review_evaluations/README.md).
Checker candidates and holdout rules are in
[backend/fixtures/review_checks](../backend/fixtures/review_checks/README.md).
The authored example shown in the workspace is a separate demonstration fixture,
not generated output or a passing evaluation result.

## Assessing review and Ask output

Use the normal application engines and immutable source PDFs. Reference criteria
and expected answers must stay outside model inputs. For each attempt, retain the
source/case version, prompt/schema version, model, reasoning effort, token usage,
latency and operational outcome. Failed, refused or uncertain attempts count;
do not drop them from the denominator or rerun until a good answer appears.

Assess these dimensions separately against the source:

- **Priority coverage:** record met, partial, missing or incorrect for each
  source-reviewed criterion. Do not require specific titles or finding counts.
- **Material qualifications:** check triggers, exceptions, time anchors, scope,
  costs and cross-page amendments together.
- **Own-citation support:** each paragraph or finding's displayed evidence must
  support its assertions. A correct citation elsewhere does not repair it.
- **Unsupported claims and uncertainty:** identify invented rights, calculations
  or deadlines; distinguish absent scenario facts from ambiguity in the text.

Exact-reference validation is a structural gate. An accepted reference can match
real source text while supporting only part of the associated claim. Report invalid
or rejected output separately from the semantic support of accepted output.
Likewise, an inline citation mapping establishes which saved passage an identifier
refers to, not whether the model interpreted that passage correctly.

Keep per-case results and source-grounded explanations. A small synthetic corpus
supports bounded regression comparisons, not a general accuracy percentage or a
claim about legal documents in the wild. The diagnostic checker is not an
independent ground truth: its misses and false alarms also need assessment.

## Retrieval boundary

| Product path | Current method | Evaluation status |
| --- | --- | --- |
| Individual review and finding-scoped Ask | Complete supported extracted source with bounded input | Source-reviewed criteria and a small recorded live baseline; known omissions remain |
| Library Keyword search | Local BM25 ranking over canonical page passages | Implemented; offline development-set results below and real-stack search/page-navigation coverage |
| Library Semantic search | Explicit text-embedding-3-small indexing and exact Qdrant cosine retrieval | Implemented; live runtime smoke and separate ranking comparison, plus deterministic lifecycle tests and isolated stub-provider storage checks |
| Retained earlier document chat | Embeddings and Qdrant retrieval followed by generation | Existing legacy RAG; not exercised by the Library retrieval benchmark |
| Library answers from search results | Explicit paid generation over a server-resolved snapshot of Keyword or Semantic results | Implemented; eleven fixed-evidence and eight end-to-end live cases source-assessed, plus deterministic lifecycle tests and isolated storage checks |

The [Library-answer evaluation contract](evaluations/LIBRARY_ANSWERS_PROTOCOL.md)
separates fixed-evidence answer quality from end-to-end retrieval failures. It
specifies per-claim support, qualifications, cross-agreement attribution and
insufficient-evidence behaviour. The [first fixed-evidence result](evaluations/LIBRARY_ANSWERS_FIXED_V1.md)
records eleven completed GPT-6 Sol/Medium calls, one omitted Archive dependency
requirement and two outcome-label mismatches. It is not an overall accuracy score.

The current review workspace and finding-scoped Ask use the complete supported
extracted source, subject to their input guards. They do not use top-k retrieval.
Retained earlier document chat uses Qdrant retrieval. Library offers a separate,
key-free lexical baseline and optional paid semantic retrieval over explicitly
indexed canonical passages. A separate **Answer from these results** confirmation
generates cited statements from those selected passages; searching never starts
generation automatically. Preview/readback/navigation remain unpaid.
Semantic search uses the measured embedding/header-eligibility candidate, not
automatic hybrid fusion or blanket document diversity. Published comparison
scores describe that frozen synthetic experiment, not a live product acceptance
score or a fresh evaluation of arbitrary user libraries.

The [live runtime checkpoint](evaluations/LIBRARY_SEMANTIC_RUNTIME_V1.md) subsequently
completed six real embedding calls through the actual index/search services and
isolated storage. Both payment-conflict passages and both Archive-exit passages
were found; one requested agreement's correction duty was missed, and an
unsupported question still returned candidates. All hit identities resolved
correctly. This is integration evidence with disclosed retrieval failures,
not a generated-answer pass or an independent benchmark.

The frozen [24-question synthetic development set](../backend/fixtures/library_search_evaluations/README.md)
contains six searchable PDFs plus one image-only exclusion, with 203 canonical
passages. The initial local lexical run at five returned passages per question
reported:

| Retrieval measure | Initial result |
| --- | ---: |
| Macro document recall@5 / precision@5 | 93.3% / 54.8% |
| Macro exact-passage recall@5 / precision@5 | 80.8% / 25.0% |
| Exact-term / paraphrase passage recall@5 | 100% / 60% |
| Multi-document / exception passage recall@5 | 73.3% / 90% |
| Reviewed unanswerable queries returning a lexical match | 4 of 4 |
| Invalid source hits | 0 |

The dataset is visible and small, so these are local regression measurements,
not independent benchmark accuracy. In particular, a returned lexical match is
not an answer: all four no-answer cases still produced near-matches. Latency
depends on the computer and library size; the harness reports its own query
timings and excludes PDF extraction/preparation.

The synthetic retrieval set freezes source-relevant document/page/passage labels
for exact-term, paraphrase, multi-document, near-match and unanswerable questions.
Run the unpaid harness on the same corpus and query set when changing passage
construction or ranking. Record document and passage recall/precision at a fixed
result limit separately, along with latency, skipped sources and the dataset,
passage and extraction versions. Small authored fixtures are a regression set,
not a population-wide accuracy estimate. Do not tune on a held-out question
family and then report it as unseen performance.

Locating relevant passages and answering from them are separate evaluation
problems. Recall at a chosen result limit measures how many labelled relevant
passages were returned; it does not prove that every agreement in a collection
was inspected. Exact source identity and quote matching also do not establish
retrieval completeness. Retrieval-grounded answer evaluation must
hold the retrieved evidence fixed while assessing support, missed qualifications,
cross-document confusion and abstention; all/every claims additionally require
explicit collection coverage. The fixed-evidence result below does not establish
retrieval completeness or end-to-end answer quality.

### Dense/hybrid comparison

The lexical baseline is published. The development-only comparison tooling now
includes a separate frozen 20-question holdout on new topics, with four cases per
category. Labels were checked against authored source text, exact PDF passages
and representative rendered pages before implementing the candidate rankers.
These are assistant-authored labels on the **same known synthetic contracts**, not
independent annotations or evidence of generalization to unseen agreements.

The first comparison is fixed: `text-embedding-3-small` at 1536 dimensions,
unchanged canonical passages, exact cosine search, and equal-weight reciprocal
rank fusion (RRF constant 60, top 20 candidates from each ranker), scored at five
results. It reuses the current lexical ranker. There is no query rewrite, reranker,
generated answer or Qdrant approximation in this experiment. Embeddings contain
only passage text or the question; labels/rationales are never provider inputs.
Dense/hybrid use no abstention threshold and therefore return near-matches even
for no-answer questions. Their cosine scores are not confidence probabilities.

Hypothesis before live results: hybrid improves paraphrase/multi-document passage
recall without reducing exact-term/exception recall against lexical retrieval.
Report category results and failures even if that hypothesis fails. Inspect the
missed qualifications and latency/cost tradeoff before recommending a product
change; a tied result is not a reason to introduce a paid indexing dependency.
Do not tune on the holdout or report post-tuning performance as unseen evidence.

The [first live comparison](evaluations/LIBRARY_RETRIEVAL_V1.md) completed on
2026-09-26: 51 embedding requests, no retries/failures, 18,776 provider-reported
input tokens and $0.00037552 usage-based cost. Macro passage recall@5 was:

| Split | Lexical | Dense | Hybrid |
| --- | ---: | ---: | ---: |
| Development | 80.8% | 85.0% | 97.5% |
| New-family holdout | 71.9% | 93.8% | 87.5% |

Hybrid improved the hypothesized category means against lexical, but did not
dominate individual questions or dense search. In one holdout case, all five
dense/hybrid hits were title/disclaimer/heading blocks, displacing testing
restrictions that lexical found. All methods returned near-matches for all eight
no-answer cases. The linked report preserves category precision/recall, concrete
misses, source checks, exact configuration and limits. Keyword was not replaced
by an automatically selected winning method.

The run used an approved finite budget, reserved all conservative input ceilings
before reading the saved key, and dispatched serially without retries or model
changes. Completed private vectors support unpaid replay; source/config/code
drift rejects the cache. Application data, model settings and legacy vectors were
unchanged. The [completed header/diversity refinement](evaluations/LIBRARY_RETRIEVAL_REFINEMENT.md)
reuses this cache: filtered hybrid recovers the testing restrictions but introduces
one paraphrase miss; blanket document diversity loses qualifications and is not
selected as a default. These inspected questions are regression evidence, not a
fresh holdout. The keyword ranker remains unchanged; optional semantic indexing
is a separate product lifecycle, not another review-model switch.

Reports separate indexing and single-query embedding usage/API latency from
offline ranking latency. Lexical rebuilds its in-memory index per query; dense
uses a preloaded exact matrix. These timings are not a production-scale or Qdrant
benchmark. See [comparison commands and safeguards](DEVELOPMENT.md#retrieval-comparison-experiment).

The subsequent [product index lifecycle](ARCHITECTURE.md#explicit-semantic-indexing-and-search)
adds explicit consent/cost preview, versioned identity, visible
pending/failed/interrupted/partial coverage, exact source revalidation and scoped
deletion. Its regressions cover duplicate dispatch, lost acknowledgements, partial
vector writes, source changes and deletion races. A separate isolated MongoDB /
GridFS / Qdrant smoke uses deterministic stub embeddings and prohibits actual
OpenAI clients. Thus it tests storage and safety mechanics without claiming a new
paid semantic-quality pass. No real user library is indexed by those tests.
Generated Library answers now have a separate source-grounded assessment with
fixed evidence inputs. The [eight-case end-to-end checkpoint](evaluations/LIBRARY_RAG_RUNTIME_V1.md)
then preserves actual top-five bundles from both methods. Both miss the service
agreement's correction passage and honestly return partial answers; both decline
the unsupported Bitcoin question. Keyword's Archive answer omits a retrieved
dependency duty, while Semantic includes it with a narrower trigger paraphrase.
All eight operational completions count, including these quality failures.
Publish the dataset
and implementation versions, commands, sample counts and limitations alongside
results; keep a concise result/link in the README rather than an overall AI
accuracy badge.

## Operational evidence

The backend has correlated HTTP request/error logs and in-memory endpoint timings,
error counts and system metrics. Review and Ask preserve attempt outcomes and
generation metadata. Library answers also retain original search coverage/method,
exact source/evidence snapshots, prompt/schema hashes, duration and known usage.
These aid debugging but do not measure answer quality.
Keyword has no persistent index. Semantic index metadata retains source/policy
fingerprints, attempt identity, timestamps, outcome and known token/cost usage;
query receipts retain request identity, a query hash, outcome and known tokens,
not query/source text. The retrieval harness measures local query latency.
The embedding experiment additionally retains an
exclusive developer-only reservation/attempt ledger with batch outcome, input
fingerprints, usage and latency. Runtime search now emits allowlisted content-free
stage traces; explicit answer attempts persist their retrieval and generation
traces, linked through server-owned IDs. These include method/version/source-index
fingerprints, coverage, duration, embedding/vector/generation timings, known usage
and safe statuses/outcomes. Keyword search alone remains non-persisting.

Queries, filenames, source/answer text, credentials and raw failures are excluded
from these logs. Old records may lack optional traces. A trace is a historical
diagnostic, not the current status after source deletion or a quality verdict.
There is no new external telemetry service, monitoring dashboard, load test or
operational reliability claim attached to the evaluation results.

## Running checks

Ordinary tests and CI make no paid AI calls. Commands, tokenizer preflight,
isolated storage/browser checks and explicit evaluation opt-ins are documented in
[Development](DEVELOPMENT.md#model-defaults-and-bounded-requests).

Live evaluations require an approved finite spending ceiling, current pricing,
fixed cases and stop conditions. The existing manual harnesses disable automatic
retry and model switching. Preserve reservations for uncertain outcomes. A stronger
model or a higher reasoning setting is a hypothesis to test, not a recorded fix.
Private outputs, assessments and budget ledgers remain ignored; they are not
published by running CI.
