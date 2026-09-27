# Library semantic search: live runtime checkpoint

Recorded 2026-09-27. **The indexing/search integration completed successfully;
retrieval was not complete.** This is a small integration regression, not an
unseen benchmark, generated-answer evaluation or legal-quality pass.

## What ran

The actual LibrarySemanticService, request-scoped OpenAI embedding provider,
MongoDB/GridFS persistence and exact Qdrant cosine search were exercised together.
The fixed corpus was isolated copies of the reviewed two-page service terms and
25-page managed-services PDFs. Four already inspected development questions ran
at k=5. No app library records were indexed, no generated answers were requested,
and no paid grader, retry, fallback or tuning was used.

- Index: text-embedding-3-small, 1,536 dimensions, library-semantic-v1.
- The short agreement supplied 10 passages. The long agreement supplied 75,
  excluding 25 repeated header blocks. Canonical source text stayed unchanged.
- Real MongoDB/GridFS and Qdrant 1.16.3; repository-pinned client 1.16.2.
- Two serial indexing requests followed by four serial query embeddings.
- Replaying each completed index attempt made no additional provider request.
- The harness resolved all 20 returned hits back to their own exact current
  agreement/revision/page/passage/text. No fabricated, stale or duplicate hit
  passed that check.
- Only verified-owned temporary stores were cleaned; cleanup reported no leftovers.

The harness calls services directly. It is not a browser journey or HTTP-latency
benchmark. Separate unpaid tests cover API bodies, local access boundaries,
storage failure/race cases and UI confirmation. Real embeddings here replace
the deterministic stub vectors used by the earlier storage smoke.

## Case results

Labels refer to the frozen
[development dataset](../../backend/fixtures/library_search_evaluations/dataset.json).
Rank is within the five returned passages. Irrelevant extra passages still consume
slots even when every labelled passage is found.

| Case | Relevant passages returned | Miss or limitation |
| --- | --- | --- |
| exception-01: conflicting invoice deadlines | Two-page schedule, page 2, rank 1; main payment clause, page 1, rank 2 | Both 7-day and 30-day terms located; retrieval does not resolve their conflict |
| exception-04: standard exit and Archive extension | Archive amendment, page 25, rank 1; standard transition clause, page 22, rank 2 | Both labelled passages located; a later answer must preserve the conditional 120-day total, not add it to 60 days |
| multi-03: correction duties across both agreements | Managed-services export-defect clause, page 25, rank 3 | **Missed service-terms acceptance/resubmission on page 1. All five hits came from managed services**, despite both agreements being indexed |
| none-02: Bitcoin payment address | Five payment/invoice/general candidates | No labelled supporting passage exists; candidates are **not a supported answer** |

The missing service passage is p1_b4_v1, where an identified deliverable failure
must be corrected and resubmitted. The returned managed-services p25_b3_v1 concerns
export-defect correction charges: it is not a substitute for another agreement's
resubmission duty. The unsupported payment-detail question illustrates the absence
of a calibrated relevance/abstention threshold. Merely having a current index and
valid source links cannot justify answering from irrelevant evidence.

Do not compare these four-case results directly with the earlier six-extractable-
document experiment: corpus size, distractors and question selection differ.
The existing cases and labels were not altered after the run. No new general
accuracy percentage or unseen-data claim follows from this checkpoint.

## Usage, latency and stop conditions

| Stage | Calls | Provider input tokens | Usage-based USD | Observed duration |
| --- | ---: | ---: | ---: | --- |
| Index embeddings | 2 | 9,809 | $0.00019618 | Provider: 4,096 / 4,355 ms; indexing plus replay check: 4,156 / 4,679 ms |
| Query embeddings | 4 | 68 | $0.00000136 | Provider: 742–792 ms; complete search service: 795–859 ms |
| Total | 6 | 9,877 | **$0.00019754** | Small local sample; no production-scale latency claim |

Cost is reported input usage multiplied by the
[official $0.02/million embedding price](https://developers.openai.com/api/docs/models/text-embedding-3-small),
checked on the recorded date—not an invoice reconciliation. The run reserved
$0.024 before credential access (six full product request ceilings) within a
$0.05 slice cap. All calls completed; there were no uncertain outcomes. The
private ledger retains reservations without reclaiming them within the run.

Manifest digest:
`7db91ca67b63c3fa7dea83bececf1ad165f50ea918b3be5eb390058579f8c44f`.
The private manifest binds fixture/dataset/code/input hashes, selected questions,
model, dimensions, limits and pricing. Detailed synthetic outputs and the
fsynced ledger remain ignored, not exposed by the application.
See [commands and safeguards](../DEVELOPMENT.md#bounded-live-semantic-runtime-smoke).

## Decision

Keep Keyword alongside optional Semantic search; do not market top-k retrieval
as an exhaustive collection review. No ranking or prompt change was made to
make these four cases pass. The cross-agreement miss and unsupported near-match
belong in the next [Library-answer evaluation contract](LIBRARY_ANSWERS_PROTOCOL.md).
The next step is explicit answering from selected, source-checked results, with
fixed-evidence and end-to-end tests kept separate—not automatic generation after
every search. Generated Library answers are still unimplemented.
