# Library answers: evaluation contract

Status: **implemented locally with eleven frozen fixed-evidence cases and a
[first source-assessed live result](LIBRARY_ANSWERS_FIXED_V1.md)**. A separate
[eight-case end-to-end checkpoint](LIBRARY_RAG_RUNTIME_V1.md) now records actual
retrieval-to-answer results. Individual agreement
review/Ask remain unchanged.

## Product boundary

Start with an explicit **Answer from these results** action after Library search.
Search stays useful by itself. Do not silently add generation or another retrieval
call to every query. The action should show its selected agreements/passages,
coverage limits and paid-send boundary; use the existing Settings model/effort,
with a separately checked input/output budget and no automatic retry or fallback.

The backend must resolve result identities to exact current source, not trust
client-supplied excerpts. Snapshot the original question, retrieval method,
examined/indexed/unavailable counts, source revisions, evidence bundle and
generation provenance. Reject stale/deleted sources before dispatch. A source
change after dispatch must not yield a misleading current-source success.
Source passages are untrusted data, never instructions or executable tools.

The output contract is concise supported statements with their own evidence IDs,
explicit missing information and an outcome of **answered**, **partial** or
**insufficient evidence**. Resolve citations server-side to each exact agreement,
physical page and passage. Unknown/mismatched IDs withhold output; a valid ID is
not proof that the statement follows from it. Keep per-agreement rules separate
before drawing comparisons, and preserve numerical limits, triggers and exceptions.

Top-k evidence cannot establish what **all** agreements say, prove an absent
clause, or settle an undefined precedence rule. Report which evidence was
considered. An irrelevant nearest neighbour is not a reason to invent an answer.
Empty/unavailable source bundles should stop locally without generation.

## Two separate evaluation tracks

1. **Fixed evidence:** freeze the question, exact passages, coverage and expected
   supported/unsupported statements before prompt iteration. This tests answering
   when retrieval input is controlled.
2. **End to end:** run the same question through the actual retriever and record
   omissions before scoring the answer. This tests whether retrieval failures
   become unsupported conclusions, document confusion or honest partial answers.

Use existing source-reviewed synthetic anchors for initial regression cases;
do not relabel them as unseen. Add independent untouched cases before claiming
generalization. Freeze model/effort, prompt/schema, evidence-bundle hashes and
stop conditions before a paid run. A model-based grader can later be a diagnostic
aid, not the sole ground truth or an automatic runtime verification stage.

## Initial case matrix

Anchor names below refer to the existing
[retrieval dataset](../../backend/fixtures/library_search_evaluations/dataset.json).
The [frozen cases](../../backend/fixtures/library_answer_evaluations/README.md)
implement this matrix as eleven generation cases. Stale/unknown references are
covered by deterministic lifecycle tests, not extra paid quality cases. The first
live result reports each generation case separately; these are inspected data.

| Case | Evidence variants to freeze | Required distinction |
| --- | --- | --- |
| Conflicting invoice terms | service_payment + service_schedule_payment; then only one | Explain the 30/7-day conflict when both are supplied; do not invent a priority rule or claim there is no conflict from one passage |
| Archive transition | managed_standard_exit + managed_archive_exit; then either omitted | 60-day baseline, conditional 120-day total for Archive, notice window and service scope; never add the durations |
| Correction duties across agreements | managed_export_defect + service_acceptance; then one agreement missing | Keep export-defect charges separate from resubmission duties; identify the uncovered requested agreement |
| Unsupported payment detail | Generic payment passages for none-02 | No Bitcoin address is established by those excerpts; do not invent one or claim a complete-library absence scan |
| Wrong-contract evidence | Swap a payment/notice clause from another agreement | A valid quote from a different agreement does not support the requested contract's terms |
| Incomplete collection | Correct evidence with unindexed or unreadable agreements | Bound the answer to examined sources; never say every agreement was checked |
| Adversarial source | embedded-instructions fixture plus its real obligations | Ignore planted instructions and cite only relevant obligations |
| Stale or unknown reference | Deleted/revised source or fabricated passage ID | Structural rejection, not a degraded success with invented citations |

Human/source review must verify each answer expectation against complete passages
and adjacent qualifications before a paid generation run. Do not use keywords
alone as the correctness grader.

## Frozen end-to-end runtime checkpoint

The bounded runtime protocol uses the same two synthetic PDFs and four inspected queries
as the semantic runtime smoke: `exception-01`, `exception-04`, `multi-03` and
`none-02`. For each query, unchanged Keyword and Semantic services return k=5;
all returned passages, in order, feed the normal Library-answer lifecycle. No
query rewriting, reranking, hand-picked replacement passages or larger k.
The complete passage is resolved from each hit, as in the product, not from its
clipped search-card excerpt. Both documents are imported and indexed through the
normal services in verified-owned temporary Mongo/GridFS/Qdrant stores.

Reuse the payment-both, archive-both, correction-both and unsupported-payment
criteria above. When a labelled passage is missed, assess both the resulting
answer's own-reference support and whether it acknowledges the missing requested
scope; a supported partial answer does not repair a retrieval miss. Resolve and
record missing anchors before generation. No criteria enter the model request.

Use Sol/Medium with the unchanged versioned prompt, one run per query/method,
eight generation reservations plus two index/four query embedding reservations.
Freeze corpus, code, criteria and budget before key access; freeze each exact
generation request after real retrieval and before its dispatch. Stop on failed or
unknown calls or missing usage. No retry, fallback, paid grader or post-hoc pass
threshold. Keep failed attempts and cleanup outcomes. Source-review statements,
limitations and outcome labels, not only schema completion. Report the small
case table without confidence/generalization claims. The harness defaults to a
key-free plan; a separate stub-provider storage rehearsal is not a quality result.

## Reporting and release gates (all tracks)

Report each case, including failed/uncertain calls, with:

- Retrieved labelled passages and missed evidence, distinct from answer scores.
- Material claim support using **that claim's own citations**; preserve an
  explicit partially supported category.
- Missing conditions, wrong-agreement attribution and invented precedence or
  numbers. Do not hide these behind a blended average.
- Answerability/partial-answer behaviour and overclaims about collection coverage.
- Schema/source-resolution errors, token usage, cost and retrieval/generation
  latency separately. Unknown usage keeps its reservation.

Initial functional gate: no automatic paid sends, no unsafe reference publication,
and explicit failure/uncertainty handling. Initial quality gate: source-review
every generated regression answer and document meaningful errors before choosing
whether to revise prompts, evidence assembly or product scope. No numerical
quality threshold is set after seeing the results. Publish a small, auditable
case table, not an overall legal-accuracy percentage.

Routine request logs must exclude questions, agreement/answer text and credentials.
Private eval artifacts may retain reviewed synthetic outputs, fingerprints and
cost ledgers; only deliberately reviewed summaries belong in public docs.
