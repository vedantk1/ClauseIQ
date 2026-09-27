# Library RAG: first end-to-end checkpoint

Recorded 2026-09-27. Four known synthetic questions were each run through
Keyword and Semantic search, then the normal Library-answer engine on the
**actual five returned passages**. All eight answer calls and six embedding
calls completed with known usage. This is an assistant-led source assessment,
not independent legal review, unseen-data accuracy or a production benchmark.

## Frozen method

- Two hash-bound PDFs: `service-terms-conflict.pdf` (2 pages) and
  `managed-services-25p.pdf` (25 pages), imported through the normal source service
  into verified-owned temporary Mongo/GridFS/Qdrant stores. Original installation
  data and Settings were untouched; temporary stores were removed and checked.
- [Predeclared protocol](LIBRARY_ANSWERS_PROTOCOL.md#frozen-end-to-end-runtime-checkpoint),
  existing [retrieval labels](../../backend/fixtures/library_search_evaluations/README.md)
  and [answer criteria](../../backend/fixtures/library_answer_evaluations/README.md).
  Cases were already inspected; criteria never entered model inputs.
- Unchanged local BM25 versus explicit `text-embedding-3-small` / 1,536-dimension
  Qdrant exact cosine search, with the existing repeated-header eligibility rule.
  Keyword examines 110 passages; Semantic indexes 85. Each returns k=5 in its
  original order. Complete canonical passages are resolved from hits; no clipped
  excerpt, query rewriting, reranking, replacement evidence or document balancing.
- `gpt-6-sol` / `medium`, `library-answer-v1`, `library-answer-output-v1`,
  `source-passages-v1`. Admission limit 30k counted input tokens, 6k
  completion/reasoning tokens, 120-second timeout, no tools or paid grader.
- One call per query/method. No retry, fallback, prompt revision or model switch.
  Source misses were recorded before generation; each exact answer request was
  hashed after retrieval and before dispatch. Saved readback/replay did not send
  again. Failure, unknown output or missing usage would stop the sequence.
- Run-plan SHA-256:
  `47c2f7dc7cbc6b018060c7c3d5e8a50474aae7f26e5757f8226347bd351363e5`.
  The private plan binds corpus, labels, code, model, prompt and budgets. Private
  outputs and ledgers remain ignored. The unpaid stub rehearsal is not included
  in these quality results.

## Results, including failures

Retrieval counts below cover the prelabelled required passages, not every
potentially useful passage. `answered` is the returned label, not our quality
verdict. A missing requested agreement remains a failure even when disclosed.

| Query / method | Required passages found | Returned outcome | Source assessment |
| --- | --- | --- | --- |
| Payment conflict / Keyword | 2/2 | answered | Correct 30/7-day conflict with own references; no invented precedence, despite an unrelated agreement's precedence clause ranking first |
| Payment conflict / Semantic | 2/2 | answered | Both deadlines and receipt trigger supported; no controlling deadline invented |
| Archive exit / Keyword | 2/2 | answered | Supported 60-day baseline, plan/charges, conditional 120-day replacement, request window and service restriction; **omits dependency identification and minimum additional arrangement**, present in retrieved evidence |
| Archive exit / Semantic | 2/2 | answered | Retains the dependency duty as well as duration/notice/scope; **precision caveat:** says a dependency “prevents” isolated handover where source says it makes handover “impracticable” |
| Cross-agreement correction / Keyword | 1/2 | partial | Misses service-terms acceptance/resubmission passage; supports managed export charge exception and explicitly identifies missing other-agreement evidence |
| Cross-agreement correction / Semantic | 1/2 | partial | Same missing agreement; supported managed charge distinction, no invented resubmission duty |
| Bitcoin address / Keyword | No relevant labelled passage; 5 near-matches returned | insufficient evidence | No fabricated address or claim that the entire library contains none; limitation correctly notes selected/truncated results |
| Bitcoin address / Semantic | No relevant labelled passage; 5 near-matches returned | insufficient evidence | Declines to infer an address from generic payment clauses; no all-library absence claim |

Both methods found 5 of the 6 required passage targets across the three answerable
queries. Both missed `service_acceptance` (`service-terms-conflict.pdf`, page 1,
`p1_b4_v1`): the customer's ten-business-day material-failure window and supplier
correction/resubmission duty. All five hits in each correction bundle came from
the managed-services agreement. The collection itself was fully examined/indexed;
**collection coverage is not query evidence coverage**.

All 40 returned coordinates resolved to their own document/revision/physical
page and full canonical passage. Ten generated statement units were inspected:
nine had support for their material assertions; one was conservatively marked
**partially supported** for the Archive dependency-trigger narrowing above.
None was classified as wholly unsupported. This assessment is deliberately not
a citation-accuracy percentage: a statement can contain several assertions, and
omitted conditions remain a separate error.

Own-citation audit (statement numbering is the saved output order):

| Output units | Own evidence | Assessment |
| --- | --- | --- |
| Payment Keyword 1–2 | S3: service page 1 `p1_b3_v1`; S2: service page 2 `p2_b3_v1` | Both deadline comparison and absence of a supplied priority rule supported |
| Payment Semantic 1 | S2: service page 1 `p1_b3_v1` | 30-day deadline/receipt supported |
| Payment Semantic 2 | S1: service page 2 `p2_b3_v1`; S2: service page 1 `p1_b3_v1` | 7-day rule, submission invoicing and comparison supported |
| Archive Keyword 1 / Semantic 1 | S1 / S2 respectively: managed page 22 `p22_b2_v1` | Baseline, effective-end-date trigger, plan and approved charges supported |
| Archive Keyword 2 | S2: managed page 25 `p25_b2_v1` | Returned duration/request/scope assertions supported; separate dependency-duty omission |
| Archive Semantic 2 | S1: managed page 25 `p25_b2_v1` | Duration/request/scope/minimum-arrangement duty supported; dependency trigger paraphrase too narrow |
| Correction Keyword 1 / Semantic 1 | S1 / S3 respectively: managed page 25 `p25_b3_v1` | New approved work versus supplier-caused agreed-format correction charges supported |

The two abstentions contain no substantive statements. Their limitations were
checked against the selected bundles and coverage metadata. No invented numerical
deadline, cross-agreement rule transfer, schema rejection, unknown source ID,
timeout, refusal or lost-usage event occurred. These observations do not establish
reliability on other contracts or excuse the documented coverage/precision errors.

## Usage and latency

Generation: **13,541 input + 1,428 output/reasoning tokens** over eight calls.
Embeddings: **9,877 input tokens** over two index and four query calls.

[Official generation pricing](https://developers.openai.com/api/docs/pricing) and
[embedding pricing](https://developers.openai.com/api/docs/models/text-embedding-3-small)
were rechecked on 2026-09-27. All maximums were reserved before key access:
8 × $0.14 generation plus 6 × $0.004 embedding = **$1.144**, within a $1.20
allocation. Each generation reservation uses 32k input at the higher $2.50/M
cache-write rate plus 6k output at $10/M. Actual ordinary input rate is $2/M;
using the higher rate for all reported input gives a conservative generation
usage estimate of **$0.0481325**. Embeddings at $0.02/M add **$0.00019754**.
Total: **$0.04833004**, a usage-priced estimate, not an account invoice.

| Query | Keyword retrieval / generation ms | Semantic retrieval / generation ms |
| --- | ---: | ---: |
| Payment conflict | 10 / 4,266 | 879 / 3,519 |
| Archive exit | 14 / 5,183 | 954 / 3,671 |
| Cross-agreement correction | 10 / 3,053 | 896 / 4,251 |
| Bitcoin address | 10 / 2,365 | 874 / 2,619 |

Semantic retrieval includes query embedding (817–884 ms) and vector lookup
(10–14 ms), plus source/index checks. Generation timings exclude preparation and
final persistence. Index embedding calls took approximately 3.18 and 3.74 seconds.
One local serial run on two documents is not a load/production latency benchmark.
The existing local Qdrant client/server compatibility warning remained visible;
successful tested calls do not resolve that separate environment-version issue.

## Decision

The retrieval → generation → persisted source-linked answer path works under
these tested conditions. The project now has separate retrieval, fixed-evidence
answer and end-to-end evidence, including actual omissions and abstentions.
Keep Keyword as the default and Semantic optional; this tiny run does not select
a universal winner. Do not promote answer labels to verification badges.

The next quality experiment, when resumed, should target the known cross-document
miss and qualification preservation with fresh cases. Do not silently repair
this baseline or keep rerunning it until every row looks good. No prompt, ranking,
model or UI changes were made in response to these results. Publication of the
engineering checkpoint and later UI/showcase work are separate steps.

See [commands and guards](../DEVELOPMENT.md#end-to-end-library-rag-regression).
