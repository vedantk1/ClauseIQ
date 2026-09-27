# Library quality checkpoint: frozen comparison protocol

Approved 2026-09-27; results are recorded separately. This is a bounded
assistant-authored synthetic evaluation, not independent human/legal validation.
User usefulness studies and external human assessment are deferred.

## Questions and fixed candidates

1. Which required passages does `text-embedding-3-large` / 3072 dimensions find
   or miss, against the free Keyword baseline and a large-based hybrid candidate?
   No new small-model calls or paired small/large experiment are included.
2. Does Sol benefit from medium, high or xhigh effort when the source evidence,
   question, versioned prompt and output allowance are held fixed?
3. Do generated answers preserve material conditions, distinguish agreements,
   and acknowledge incomplete or irrelevant evidence?

The embedding comparison uses exact cosine retrieval, the existing conservative
repeated-header eligibility policy, k=5, and the existing equal-weight RRF hybrid
candidate (constant 60, depth 20). Keyword remains the unmodified baseline. No
query rewriting, reranker, diversity heuristic or label-informed rescue passages.
Large dense retrieval excludes repeated headers. Hybrid fuses that dense arm
with the unmodified Keyword arm; this is not the older filter-both-arms ablation.
Hybrid is an evaluation candidate, not an automatic product change. Record
complete-target recovery as well as macro passage recall and each missing target.
Unanswerable near-matches are reported separately; similarity is not confidence.

Keep the original 44 inspected questions as regression data. Add three new PDF
documents and twelve frozen questions as a document-disjoint synthetic set. Its
first candidate score is a fresh-document measurement, but the labels are still
assistant-authored and the corpus is small. After inspection it becomes regression
data, not a reusable unseen holdout. Never tune a candidate on these results and
retain an unseen-performance claim.

One fresh multi-agreement question requires six separate passages, more than k=5.
Keep its raw recall and report the capacity ceiling explicitly: no five-hit ranker
can recover all six. Do not present this structural limit as an embedding-model
failure, remove the case after seeing results, or inflate a score by dropping a label.

Four fresh fixed-evidence answer cases cover cross-document distinctions, material
qualifications, missing necessary evidence and abstention. Run each once at Sol
medium/high/xhigh with the same `library-answer-v2` prompt and 6,000 total output /
reasoning token allowance. Twelve calls are a first comparison, not a stability
estimate. Higher effort hitting the bound counts as a failure, not permission to
increase its limit or silently retry. Keep Settings defaults unchanged.

## Assessment and safety

- Freeze PDF, label, code, prompt and exact request fingerprints before dispatch.
  Labels and criteria never enter provider inputs.
- Check retrieval separately from generation. Fixed-evidence answers do not test
  the retrieval-to-answer product path and must not inherit its quality claims.
- Assess each statement against its own cited passages; record omitted conditions,
  strengthened/weakened thresholds, wrong-document attribution and outcome labels.
  Structural citation validity is not semantic correctness.
- Preserve the published v1 baseline, including failures. A v2 prompt evaluated on
  different cases does not isolate the prompt's causal effect.
- Record requests, token usage, known cost, latency and all failures. Generation
  uses the normal engine with no automatic retry, fallback, tools or paid checker.
- Key-free source/tokenizer preflight and unpaid guard tests precede key access.
  Reserve all maxima within the existing project budget. Stop on failed/unknown
  provider output or missing usage; retain uncertain reservations.
- New provider outputs, vectors and ledgers remain in ignored directories. No
  user PDF, index, saved answer or Settings selection is changed by evaluation.
- No independent human assessment, useful-task improvement or broad legal accuracy
  is established by this checkpoint. Do not publish one blended accuracy score.

## Product changes versus experiments

The user selected large embeddings for new semantic indexes. Versioned storage
keeps old small indexes incompatible and visibly stale until deliberately rebuilt;
there is no automatic reindexing or charge. A selected model is not automatically
a measured winner. Existing original PDFs, saved work and legacy chat remain intact.

The v2 answer prompt explicitly checks requested entities and material
qualifications, without adding a second model call or verification badge. The
comparison determines observed behaviour; prompt text alone is not a quality pass.

No new agents, dashboards, model-family sweep or UI redesign is included.
