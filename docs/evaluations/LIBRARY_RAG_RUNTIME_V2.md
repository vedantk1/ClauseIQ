# Library RAG: current-profile end-to-end checkpoint

Recorded 2026-09-27 against code revision `d4d38cf`. Eight live answers and six
embedding calls completed through the current large-embedding/v2-answer pipeline.
Persistence, source resolution, replay without redispatch and temporary-store
cleanup passed. **Keyword still missed one requested agreement's passage.**
This is a bounded service/storage/provider regression, not a fresh browser test,
independent legal assessment or general accuracy benchmark.

## Frozen method

- Two existing synthetic PDFs: `service-terms-conflict.pdf` (2 pages) and
  `managed-services-25p.pdf` (25 pages), imported through the normal source service
  into uniquely owned temporary MongoDB/GridFS/Qdrant stores. Fixture byte hashes
  and extraction equality were checked. The person's library, key, Settings and
  indexes were not changed; test stores were removed and absence checked.
- Four already-inspected questions from the
  [retrieval dataset](../../backend/fixtures/library_search_evaluations/README.md),
  each run once through Keyword and Semantic at k=5. Assessment used the frozen
  [answer criteria](../../backend/fixtures/library_answer_evaluations/README.md),
  kept outside provider inputs. Relevant PDF pages were rendered and read again.
- Unchanged local BM25 over 110 passages versus `text-embedding-3-large`, 3,072
  dimensions, `library-semantic-v2`, exact Qdrant cosine retrieval over 85 eligible
  passages. The existing policy excludes 25 repeated headers from Semantic.
  No hybrid fusion, query rewrite, reranking, balancing or replacement evidence.
- Normal `LibraryAnswerService`: preview actual results, resolve complete canonical
  passages, freeze the exact request, explicitly generate, persist, read and replay
  the same attempt with a new service and empty transient search-context store.
  Replay issued no extra provider call; saved retrieval/answer traces remained linked.
- `gpt-6-sol` / `medium`, `library-answer-v2`, `library-answer-output-v1` and
  `source-passages-v1`. Admission limit 30k counted input tokens, 6k total
  completion/reasoning tokens, 120-second timeout. No retries, fallback, model
  changes, tools or paid grader. Failed/uncertain outcomes would stop the run.
- Key-free tokenizer/plan preparation, 24 focused guard tests and an isolated
  eight-answer/six-embedding **stub** rehearsal passed before key access. Stub
  results are not included in the live quality assessment.
- Frozen plan SHA-256:
  `0b38ddafa3ba107b4d1d9dd90b7c4280ceb91a91a1928bc3b22212719bcb7a2a`.
  Raw outputs, exact request/code/source hashes, ledger and assessment notes remain
  ignored. See [commands and guards](../DEVELOPMENT.md#end-to-end-library-rag-regression).

## Results, including the remaining miss

Counts refer to prelabelled required passages, not every potentially useful
passage. Outcome labels are the saved model outputs, not verification badges.

| Question / method | Required passages found | Outcome | Source assessment |
| --- | --- | --- | --- |
| Payment conflict / Keyword | 2/2 | answered | Supports both 30/7-day receipt-based deadlines; does not borrow another agreement's priority rule |
| Payment conflict / Semantic | 2/2 | answered | Both deadlines and invoice-submission rule supported; no invented controlling deadline |
| Archive exit / Keyword | 2/2 | answered | Preserves 60-day baseline, plan/charges, conditional 120-day replacement, notice window, restricted scope and dependency/minimum-arrangement duty |
| Archive exit / Semantic | 2/2 | answered | Preserves the same frozen criteria, including the actual “impracticable” dependency threshold |
| Cross-agreement correction / Keyword | 1/2 | partial | Supported managed export charging exception; explicitly discloses absent service-terms resubmission evidence |
| Cross-agreement correction / Semantic | 2/2 | answered | Finds and separately cites both agreements; retains new-work charges and the service customer's ten-business-day material-failure window |
| Bitcoin address / Keyword | No relevant target; 5 near-matches | insufficient evidence | No fabricated address; absence statement limited to supplied passages, with truncation disclosed |
| Bitcoin address / Semantic | No relevant target; 5 near-matches | insufficient evidence | No fabricated address or whole-library absence claim |

Across the three answerable questions, Semantic found six of six labelled targets;
Keyword found five. Keyword's missing `service_acceptance` is page 1,
`p1_b4_v1`, of the service-terms fixture. All five Keyword correction hits came
from managed services. An honest partial answer is appropriate handling, but it
does not repair the retrieval failure. Both search modes still return candidates
for unsupported questions; the generator must decide whether those support an answer.

All 40 returned coordinates resolved to their own document/revision/physical page
and canonical passage. Ten emitted statement units were assessed against their
own references; no unsupported material assertion or wrong-contract attribution
was identified. No frozen qualification was omitted from evidence that was
actually supplied. Keyword's absent resubmission duty remains a separate coverage
failure. These observations are not a percentage score or a completeness guarantee.

| Saved statement units | Own source references | Assessment |
| --- | --- | --- |
| Payment Keyword 1 | S2: service page 2 `p2_b3_v1`; S3: page 1 `p1_b3_v1` | Both deadlines, submission timing and no supplied controlling rule supported |
| Payment Semantic 1–2 | Unit 1: S1/S2, the same page 2/page 1 clauses; unit 2: S2 | Deadline comparison and clause 2's absent priority rule supported |
| Archive Keyword 1–2 | Unit 1: S1, managed page 22 `p22_b2_v1`; unit 2: S1/S2, adding page 25 `p25_b2_v1` | Baseline, replacement period and material extension qualifications supported |
| Archive Semantic 1–2 | Unit 1: S2, managed page 22 `p22_b2_v1`; unit 2: S1/S2, adding page 25 `p25_b2_v1` | Same criteria supported; no narrower dependency-trigger paraphrase |
| Correction Keyword 1 | S1: managed page 25 `p25_b3_v1` | Supported new-work versus supplier-caused agreed-format correction charges |
| Correction Semantic 1–2 | Unit 1: S2, managed page 25 `p25_b3_v1`; unit 2: S5, service page 1 `p1_b4_v1` | Supported, separately attributed charging and correction/resubmission rules |

The two abstentions contain no substantive statements. Their limitations match
their selected evidence. No schema rejection, unknown source ID, refusal, timeout,
lost usage, failed persistence or extra replay dispatch occurred.

## Usage and latency

Generation used **14,914 input + 1,624 completion/reasoning tokens** over eight
calls; six embedding calls used **9,877 input tokens**. Official
[Sol pricing](https://developers.openai.com/api/docs/pricing) and
[large-embedding pricing](https://developers.openai.com/api/docs/models/text-embedding-3-large)
were rechecked on 2026-09-27. The pre-dispatch reservation was 8 × $0.14 generation
plus 6 × $0.026 embeddings = **$1.276**, within a $1.30 run cap.

Generation reservations allow 32k input at the higher $2.50/M cache-write rate
plus 6k output at $10/M; embedding reservations allow 200k input per call at
$0.13/M. Pricing all reported generation input at $2.50/M conservatively gives
**$0.05352500** generation plus **$0.00128401** embeddings: **$0.05480901** total.
This is a usage-priced upper estimate, not an account invoice.

| Question | Keyword retrieval / generation ms | Semantic retrieval / generation ms |
| --- | ---: | ---: |
| Payment conflict | 10 / 3,283 | 849 / 5,596 |
| Archive exit | 11 / 5,487 | 1,094 / 6,393 |
| Cross-agreement correction | 18 / 3,682 | 831 / 4,446 |
| Bitcoin address | 12 / 2,911 | 863 / 1,885 |

Semantic retrieval includes query embedding (771–1,037 ms) and vector lookup
(14–20 ms). The two index embedding calls took 3.59 and 3.70 seconds. Generation
timings exclude preparation/final persistence. This single serial two-document
run is not a load benchmark. The existing local Qdrant client 1.19.0/server 1.16.3
compatibility warning remained; this check does not resolve that environment gap.

## Interpretation and stop point

The current large-embedding/v2-prompt pieces now have a live combined checkpoint,
not only separate retrieval and fixed-evidence tests. The earlier
[small/v1 runtime result](LIBRARY_RAG_RUNTIME_V1.md) stays intact. In this run,
Semantic recovered the correction passage missed previously, and both Archive
answers retained the dependency duty without narrowing its threshold. Both
embeddings and prompt changed, and generation was sampled once: this is not a
controlled attribution of gains to either change or proof of stable superiority.

The [broader large-retrieval study](LIBRARY_QUALITY_V2.md) still matters: the same
correction target was missed with more competing agreements, and a fresh broad
question missed a whole agreement. Success in this reduced two-document corpus
does not erase those failures or establish exhaustive library coverage.

No runtime, ranking, default-model or reasoning-setting change followed this run.
Keyword remains the free default; Semantic remains explicit and optional. Further
retrieval tuning and model sweeps are parked. UI polish and showcase packaging
are separate deferred work, not evidence this check claims to provide.
