# Library quality v2: large retrieval and Sol reasoning effort

Measured 2026-09-27 against the [frozen protocol](LIBRARY_QUALITY_V2_PROTOCOL.md).
This is an assistant-authored, assistant-assessed synthetic regression study, not
independent legal validation or a population-wide accuracy claim.

## Findings and decisions

- Large dense retrieval reached **95% macro passage recall@5** on ten answerable
  questions within a twelve-question set over three new documents, versus
  **85% for Keyword**. This is retrieval recall,
  not answer accuracy. Dense and hybrid recovered all labels for nine of ten
  answerable questions; both missed an entire agreement in the remaining question.
- Hybrid tied dense on fresh documents, helped on the old development split and
  hurt on the old regression split. It remains an experiment, not a product mode.
- Sol xhigh preserved all frozen qualifications in these four fixed-evidence
  cases. Medium/high omitted one initial-notice qualification; medium also
  abstained where a useful partial answer was possible. Higher effort was slower
  and used more output tokens. One sample per case/effort is not a stable ranking.
- New Library indexes use **text-embedding-3-large / 3072**. Earlier small indexes
  remain stale until explicitly rebuilt. No new small-model calls were made and
  this is not a paired small-versus-large comparison. Settings stays Sol/medium;
  this small comparison does not automatically change the person's choice.

## Method and frozen scope

The original 24 development and 20 formerly-held-out questions are now explicitly
known regression data. Both use the original seven PDFs (six searchable; 203
passages). The separate [fresh corpus](../../tests/fixtures/pdfs/fresh-library-v1/README.md)
contains three new fictional agreements of 3, 5 and 7 pages, 60 canonical passages,
and [twelve labelled questions](../../backend/fixtures/library_quality_v2/README.md).
PDF hashes are disjoint from the original corpus. All fifteen new pages were
rendered and inspected; labels were resolved against actual PDF extraction before
ranking. Labels, criteria and expected outcomes were not sent to OpenAI.

Retrieval uses the same questions/passages for Keyword, exact cosine dense search
and equal-weight reciprocal-rank fusion (constant 60, candidate depth 20), scored
at k=5. Dense excludes repeated headers under the existing policy. Hybrid fuses
that dense arm with unmodified Keyword; it is not the earlier filter-both-arms
ablation. No query rewriting, reranker, diversity rescue or abstention threshold.
This scorer uses cached vectors and exact local ranking, not the live Qdrant/UI
path. Runtime compatibility is checked separately with isolated storage tests.

Generation uses four frozen evidence bundles through the normal Library answer
engine, GPT-6 Sol medium/high/xhigh, the same `library-answer-v2` prompt/schema,
6,000 total completion/reasoning tokens and a 120-second timeout. All twelve calls
completed, with no retry, fallback, paid checker or output-limit extension.
Fixed evidence includes selected baseline/amendment passages and deliberately
missing/irrelevant evidence; it is **not** the output of this retrieval run.

These fresh documents were measured once before inspecting candidate scores.
They are now regression fixtures, not a reusable unseen holdout. No independent
human/legal assessment or user usefulness study was performed.

## Retrieval results

Macro metrics average answerable queries only. No-answer cases are reported
separately. Passage precision counts exact labelled targets, not every possibly
helpful passage; returning five hits when only one is labelled limits precision.

| Split | Method | Passage recall@5 | Passage precision@5 | All targets found |
| --- | --- | ---: | ---: | ---: |
| Known development (20 answerable + 4 no-answer) | Keyword | 80.8% | 25.0% | 14/20 |
| | Large dense | 92.5% | 29.0% | 18/20 |
| | Large hybrid | 97.5% | 30.0% | 19/20 |
| Known regression (16 + 4) | Keyword | 71.9% | 17.5% | 10/16 |
| | Large dense | 96.9% | 25.0% | 15/16 |
| | Large hybrid | 90.6% | 23.8% | 14/16 |
| Fresh documents (10 + 2) | Keyword | 85.0% | 34.0% | 7/10 |
| | Large dense | 95.0% | 38.0% | 9/10 |
| | Large hybrid | 95.0% | 38.0% | 9/10 |

Fresh macro document recall was 95.0% Keyword and 96.7% dense/hybrid. Exact-term
and exception passage recall was 100% for each method; paraphrase was 75% Keyword
versus 100% dense/hybrid; multi-document was 66.7% versus 83.3%. These category
samples contain only two or three questions each.

Every method returned nonempty hits for **all ten no-answer queries** across the
three splits. There were zero invalid source identities/excerpts or duplicate
hits. Valid coordinates and similarity scores do not establish answer support.

### Misses, including the result-limit ceiling

`fresh-multi-03` asks for baseline and later schedule across three agreements:
six labelled passages. At k=5, one miss is unavoidable and the fresh split's macro
recall ceiling is 98.33%, not 100%. Dense and hybrid actually returned only three
of six targets: the equipment baseline and both processing baseline/amendment
were missing. Thus **two additional misses exceed the capacity limit**, and the
processing agreement was absent entirely. Raising k could remove the structural
ceiling but is not proven to fix ranking; it was not changed after scoring.

Keyword also missed the processing notice amendment in `fresh-paraphrase-01` and
the processing exit clause in `fresh-multi-02`. On known data, dense still missed
the consulting approval for third-party analysis (`paraphrase-02`), service-terms
acceptance (`multi-03`), and managed-services audit/testing safeguards
(`holdout-multi_document-03`). Hybrid
recovered the first and third but lost targets in `holdout-paraphrase-01` and
`holdout-multi_document-04`. This is why the highest development score alone is
not a sound reason to ship hybrid.

## Answer assessment

Each statement was checked against its **own** cited full passages and the frozen
criteria. Across twelve outputs, nineteen statement units were emitted; none
was found unsupported or attributed to the wrong agreement. That observation
does not erase the omissions and over-abstention below or imply 100% accuracy.

| Fixed case | Medium | High | Xhigh |
| --- | --- | --- | --- |
| Cross-schedule changes | All criteria covered | All criteria covered | All criteria covered |
| Breach notice qualification | Initial notice's “facts then known” qualification omitted | Same qualification omitted | All criteria covered, including reasonably available notice details |
| Missing pump schedule | Over-abstains; omits available baseline, labels insufficient evidence instead of partial | Supported partial baseline; missing schedule disclosed | Supported partial baseline; missing schedule disclosed |
| Unsupported biometric escrow | Appropriate abstention | Appropriate abstention | Appropriate abstention |

All efforts correctly distinguished the three clocks and effective dates in the
cross-schedule case: technician response is not repair completion; breach notice
starts on confirmation; the final-report acceptance clock requires its appendix.
In the breach case, medium/high preserved the main deadlines, trigger, scope,
updates and regulator distinction. Their omission is criterion-coverage failure,
not an invented deadline. The missing-schedule case is deliberately different:
the supplied baseline can be explained, but the four-hour/weekend promise cannot
be established. Medium safely declined it but failed the intended partial-answer
behaviour. All three escrow answers limited absence claims to supplied evidence.

### Usage and latency

| Effort | Calls | Input tokens | Completion/reasoning tokens | Median duration (range) | Usage-priced upper estimate |
| --- | ---: | ---: | ---: | --- | ---: |
| Medium | 4 | 5,111 | 1,037 | 4.67s (2.17–8.10s) | $0.0231475 |
| High | 4 | 5,111 | 2,090 | 9.10s (2.44–10.04s) | $0.0336775 |
| Xhigh | 4 | 5,111 | 5,267 | 14.76s (2.99–24.14s) | $0.0654475 |

Five large embedding batches used 22,946 input tokens, costing $0.00298298.
Generation's conservative usage-priced total was $0.1222725; combined **$0.12525548**
against a pre-dispatch maximum reservation of $2.01972224. Pricing was checked on
2026-09-27: [large embeddings](https://developers.openai.com/api/docs/models/text-embedding-3-large)
$0.13/M input; [Sol pricing](https://developers.openai.com/api/docs/pricing)
$2/M standard input and $10/M output. The runner conservatively prices all Sol
input at the higher $2.50/M cache-write allowance, without claiming an invoice.
[Sol's model page](https://developers.openai.com/api/docs/models/gpt-6-sol)
documents the tested reasoning settings.

Generation timings are single serial API/engine observations, not latency SLOs.
Embedding batches took 1.36–6.58 seconds each and measure collection throughput.
Cached ranking timings exclude provider embedding, PDF preparation and product
storage/UI access; they must not be presented as interactive search speed.

## Reproduction and remaining gap

Use the key-free preparation and explicitly approved live commands in
[Development](../DEVELOPMENT.md#fresh-documents-and-sol-effort-comparison).
Source, label, code and exact-request fingerprints were frozen before dispatch:

- Retrieval plan: `f484748eff439406e04d7e0dd1fb787a3e1208b61ffe360bdc79c9bbeb8c6683`.
- Answer plan: `d5c11907a8189d748bd4ec347948f995fa4dceebd5e2ae5d3b6d59bb8687d710`.
- Fresh retrieval labels: `81f7bdf749df07f9fd8f235798dcaa49875728257f3b21b176b6e40c9a31dd98`.
- Individual PDF and evidence hashes are in the checked-in fixture manifests.

Raw outputs, vectors, ledgers and detailed assessment notes remain ignored; this
reviewed summary preserves failures as well as successes. Private original
records were not reindexed, deleted or used as evaluation inputs.

This checkpoint supports keeping large dense retrieval, not claiming exhaustive
library coverage. Xhigh is a promising quality option, not a demonstrated universal
winner. The next bounded quality work is multi-part evidence coverage and a repeated
comparison on critical cases, followed by a current-profile **end-to-end** check.
No new live large/v2 end-to-end result is claimed here; earlier small/v1 results
remain historical. Different cases also mean this run cannot isolate the v2
prompt's causal benefit over v1.
