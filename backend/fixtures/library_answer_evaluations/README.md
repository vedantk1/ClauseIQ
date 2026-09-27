# Fixed-evidence Library answers

Eleven inspected synthetic regression cases. `cases.json` freezes the question
by existing retrieval-case ID, evidence anchors, complete passage hashes, expected
outcome and source-reviewed criteria. Its adjacent checksum prevents accidental
label changes. The existing retrieval dataset freezes original PDF hashes,
extraction/passage versions and source coordinates; those labels are unchanged.

The evaluator supplies **complete canonical passages**, not just the short anchor
quote. The planted instruction case also supplies the exact adversarial block
from the hash-bound PDF. Its inclusion is deliberate untrusted source data.

From backend:

~~~bash
TIKTOKEN_CACHE_DIR=.local-only/tokenizers venv/bin/python -m evaluations.library_answer_cases
~~~

This key-free preflight resolves every passage, validates frozen hashes, and
checks the normal answer engine's prompt/schema/token limits. It makes no model
call, reads no Settings key and writes no application data. Passing it is **not**
an answer-quality result. Backend unit tests separately cover stale/deleted or
fabricated references, paid dispatch fencing and uncertain outcomes.

Before a paid evaluation, freeze model/effort, exact prepared request hashes,
budget and stop conditions. Assess each generated statement against **its own**
citations and record missing conditions, numeric/precedence inventions, wrong
agreement attribution and coverage overclaims. Expected outcomes are not a
keyword-based correctness grader. Keep partially supported claims separate.

These are known development cases, not held-out data. A separate end-to-end run
must report actual retrieved/missed anchors before answer assessment; do not
replace failed retrieval with these authored bundles and call it RAG success.
