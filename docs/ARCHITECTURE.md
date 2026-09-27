# Architecture

ClauseIQ is a single-person local application. It has one server-selected
workspace namespace (`local`), not a default user, membership model or account.

| Component | Responsibility |
| --- | --- |
| Next.js | Import, review workspace, document library/search, chat and Settings |
| FastAPI | Local request boundary, document processing and AI orchestration |
| MongoDB / GridFS | Documents, PDFs, interactions, chats, settings and encrypted credentials |
| Qdrant | Source-versioned Library semantic indexes and separate legacy chat vectors |

Shared Python and TypeScript domain types live in shared/clauseiq_types.

## Document flow

1. The local browser submits a PDF with the local-request marker.
2. The backend validates the file and supplies its own workspace identifier.
3. The backend creates a document/source revision and stores the original PDF
   before local page-aware extraction. Import itself needs no key or AI call.
4. The person prepares an optional brief and explicitly starts a review using
   a request-scoped personal OpenAI client. The run snapshots its source/context
   in that same document; personal questions and markers remain separate.
5. The frontend connects overview, findings and original-page evidence to the
   saved review. Opening results or saving personal work does not call AI.
6. Finding-scoped Ask is another explicit paid request. Legacy document chat
   remains scoped to that document's vectors and saved messages.

The earlier upload/analysis UI is retired. Its backend generation endpoint remains
deprecated for compatibility; existing clauses, notes, rewrites and reports are
preserved. Documents, PDFs and embeddings retain workspace/document identifiers.

Reading saved analysis does not make a new AI request. Deleting a document
must remove its files, vector chunks, interactions and embedded chat; failures
must be reported rather than claiming complete deletion.

### Library read model

The Library uses a dedicated workspace-scoped metadata projection, separate from
the full-document listing retained for internal document/workspace operations.
database/library_summary.py projects only list fields, physical page count and
compact saved-run/question metadata in Mongo. Source/review/evidence text, personal
question wording, storage pointers and credentials are not returned by this query.
The service performs one list read, not one workspace fetch per document.

Review status follows the final saved run, as the workspace does; it never selects
an older success to hide a newer failure. Fixture provenance remains distinct from
AI output and legacy analysis_status remains unchanged. Resume eligibility and
the selected run's saved-question count are conservative display metadata, not
review completeness or evidence validation. Inconsistent projected state becomes
unavailable; full workspace validation still happens on opening. Existing view,
run and saved-question timestamps provide activity ordering without introducing
new writes, data migrations or automatic AI calls.

The frontend / route redirects to /documents. The Library uses a shared navigation
header with direct
agreement links, an on-demand accessible details drawer and a Continue reviewing shortcut. Presentation
and pure state/destination helpers live in components/documents; the route retains
existing fetch/filter/selection/deletion hooks and in-app confirmation modals.
Continue chooses the latest eligible recorded activity across the library,
independent of search filters. Its resume=1 workspace link restores the latest
run's saved view/finding/evidence locally after loading, once per opening, without
enqueueing a write. Regular Open workspace still starts at Overview. No source,
prompt or saved-review data is copied from design mockups into the app.

### Agreement-text search

Library filename/type filtering remains a metadata-only browser interaction.
Keyword agreement-text search is a separate, explicit local API request over the current
workspace's stored source extractions. It derives bounded page-local passages
from the same exact source spans used by review, ranks them lexically, and returns
verbatim excerpts with document, source-revision, passage and physical-page
identity. It does not use legacy Qdrant chat chunks, create vectors or contact an
AI provider. No search index is persisted, so deletion or source-revision change
cannot leave a stale secondary hit.

The search response distinguishes searchable, unavailable and partial sources
and reports result truncation. A result is a candidate passage, not a legal
answer or proof that every agreement was considered. Opening its PDF page checks
the current source revision again; a stale or invalid target fails visibly rather
than opening a substitute page. Search terms are sent in a POST body instead of
being copied into URLs or browser history.

### Explicit semantic indexing and search

The optional Semantic mode uses services/library_semantic, separate from the
unchanged keyword baseline. It embeds canonical page passages using
text-embedding-3-large / 3,072 dimensions, excluding only conservative repeated
header blocks under the versioned retrieval policy. Canonical source text is
never rewritten. A key-free plan checks tokenizer/input limits and shows the
source revision, partial coverage and estimated/maximum cost. Only confirmation
dispatches one embedding request; semantic queries are separately labelled paid
submits. There are no provider retries, automatic indexing or hybrid fusion.
Generation is a separate confirmed action described below.

Index metadata lives on the existing Mongo document. Before dispatch, a
conditional write saves the attempt ID and fingerprints the source hash,
revision, extraction, passage/policy versions, model and dimensions. Vectors are
published as ready only after complete storage acknowledgement, count verification
and another source-conditional write. Failed, interrupted, stale or missing-vector
generations cannot be searched. Replaying an attempt never resends it, including
after index removal. Explicit new attempts can incur another charge; an uncertain
provider outcome remains uncertain.

The v2 Qdrant collection name includes a digest of the bound Mongo database and
collection prefix. Earlier small/1,536 indexes remain stored but are visibly stale;
no startup/status read automatically rebuilds them. Explicit confirmed rebuilding
uses the large embedding space, then cleans the matching older Library generation.
Explicit index/document removal checks both Library namespaces. Legacy chat's
collection is separate and is not repurposed. Payloads hold
workspace/document/generation and source/passage identity, not text or filenames.
Exact cosine search filters current document-generation tuples; every returned
passage is resolved and hash-checked against current Mongo source. A source
change during search withholds results. Keyword remains available independently.
There is no calibrated relevance cutoff: closest passages may be irrelevant.

The supported single-process local backend serializes index writes/removal and
document deletion with per-document locks plus durable conditional updates.
Deletion verifies semantic vector cleanup before deleting the original; cleanup
failure is not success. Index-only removal preserves the PDF and saved work.
Multi-worker/distributed indexing is not supported by this lock design.

The bounded view examines the newest 100 documents; indexing rejects more than
512 canonical passages or the embedding token limits without truncation. Coverage
exposes excluded/unindexed documents and partial text. A durable query receipt in
the same Mongo database prevents request-ID replay from making another paid call;
it retains a query hash, outcome and known token usage, not query or answer text.
It is not a saved-search history or an answer-quality trace.

### Library answers from selected results

The HTTP search adapters issue an opaque answer-context ID for nonempty, valid
results. A process-local cache retains at most 64 contexts for 15 minutes, scoped
by workspace. It stores the original query, method, coverage, source fingerprints
and result coordinates—not a key or client-authored excerpt. Restart/expiry requires
a deliberate new search; it never replays a paid semantic query. Search engines and
the frozen retrieval benchmarks are unchanged. No database write or provider call
is added to Keyword search or answer preview.

`services/library_answers` separates context resolution, prompt/schema, generation
and lifecycle. Preview resolves the **complete canonical passages** (which can be
longer than clipped search excerpts), then checks the Settings model/effort and
input/output limits. Confirmed dispatch revalidates those choices and sources.
The provider gets the original question plus selected evidence, not whole PDFs,
labels, external tools or another retrieval call. Source text remains untrusted.

The existing Mongo database holds `library_answers`, with one durable record per
workspace/request ID before dispatch. It snapshots source bindings, evidence,
coverage, model/effort, prompt/schema hashes, usage and duration. Same-ID replays,
history reads and interruption never send. Conditional completion and the existing
per-document lifecycle locks fence deletion and late results. Unknown outcomes
remain visibly uncertain; no retries or model fallback. This remains a supported
single-process local backend, not a distributed job system.

Each generated statement has explicit inventory references. Unknown/duplicate/
empty references, malformed JSON, refusal and unfinished output withhold the
entire answer. References resolve only to the saved exact document/revision/page/
passage; they establish location, not semantic support. Outcomes distinguish
answered, partial and insufficient evidence. Missing collection/extraction coverage
prevents a fully answered status. Even complete retrieval coverage does not make
top-k passages exhaustive. Saved reads recheck sources before displaying answers.

The v2 answer prompt checks each requested agreement/subquestion and material
conditions, including exceptions, scope, obligations and costs. It directs partial
answers or abstention for missing necessary evidence. This is one generation call,
not an independent verification stage; prompt instructions cannot guarantee
complete or correct interpretation. Historical answers retain their saved versions.

Evidence is bounded to 30 passages/256 KiB, with a default 30k total input-token
limit and 6k completion/reasoning tokens. There are at most 500 durable attempts
per workspace; history shows the newest 20. Deleting an associated agreement
removes the whole cross-document answer's question, evidence and statements,
retaining only a no-resend receipt and safe generation/coverage metadata. A cleanup
failure blocks successful document deletion. Backups must include this sensitive
collection with the existing database; there is no separate database selection.

### Content-free Library stage traces

`services/library_trace.py` validates a strict allowlist before emitting local
`library_stage` logs. Keyword/Semantic search returns an optional `trace` with a
server-generated stage ID, HTTP request ID, pipeline/passage versions, source/index
fingerprint, coverage/counts and duration. Semantic adds embedding/vector-search
timings and known embedding tokens. It does not persist search text or add a
database write to Keyword search.

When an answer is explicitly requested, its record retains `retrieval_trace` and
`answer_trace`; the latter links back through `parent_trace_id` and adds model,
effort, generation timing, known tokens, operational status and answer outcome.
Replays log a separate no-dispatch event without replacing the original traces.
Older or malformed optional diagnostics do not block reading or generation.
Traces are historical stage receipts: a later deletion/interruption can change
the current answer status without rewriting the original timing event.

Only validated enumerations, counts, UUIDs and opaque fingerprints enter these
logs—never questions, filenames, source/answer text, credentials or raw errors.
There is no external telemetry exporter, new store or monitoring dashboard.
Provider-start flags and unknown outcomes are conservative; neither a timing
record nor `completed` proves semantic support or a confirmed billing amount.

## Original sources and extraction

services/source_service.py owns local import and extraction; it never requests
credentials, generation or embeddings. The original file, content SHA-256 and
source-revision ID are retained before extraction. Source and extraction status
are distinct from analysis status; a stored PDF is not a completed review.

services/ai/text_extractor.py extracts in a worker thread from in-memory bytes.
Each PDF page retains its one-based position, exact extracted text, empty/failed
state and deterministic line-span IDs. Offsets count Unicode code points from
the start of the page text and are end-exclusive, not JavaScript UTF-16 indices
or PDF geometry. IDs incorporate the file hash, extractor/version and location.
These anchors match extracted text; they do not establish layout fidelity,
interpretation accuracy or comprehensive review. No OCR is performed.

The page-aware snapshot is immutable once published. Retrying a completed,
partial or unavailable extraction returns the saved snapshot. Failed/pending
extractions can be retried against the same original; an explicit restart can
supersede an interrupted processing attempt. Conditional workspace/document and
attempt-token updates reject late results. This restarts local extraction only,
never a paid AI request. A storage-status interruption can be reconciled only
from a readable original that matches the recorded hash.

Malformed/encrypted PDFs can remain stored with failed extraction; empty or
unreadable pages remain visible as limitations. The legacy analyze path currently
requires complete text extraction; it will not silently analyze a partial prefix.
Generation failure retains the original/source snapshot and records failed
analysis. New imports have explicit status, while legacy records without source
metadata stay readable without inventing provenance or migrating their findings.
The library and review screen distinguish non-ready imports from completed legacy
analysis. The key-free import UI opens setup in the separate review workspace;
the existing analysis screen remains available without converting old clauses.

Source metadata and page snapshots live in the existing scoped document record;
no migration, new database or vector reindex is needed. GridFS pointer writes are
confirmed before reporting success. On an uncertain outcome, potentially attached
files are retained rather than deleted. Only a confirmed-unattached new file is
eligible for rollback; previous originals are preserved.

## Review workspace

The /import and /workspace frontend routes are independent of the legacy /review
screen. services/review_workspace_service.py stores a review_workspace object in
the existing document, using the same workspace/document boundary. Deleting that
document also deletes its review state; there is no new collection, migration or
legacy-note conversion. GET returns an empty default without writing anything.

The Import screen reuses the Library shell and theme tokens. Client-side checks
accept one non-empty PDF within the configured size limit; the server still
validates its bytes. Import is explicit, with an immediate duplicate-submit lock.
A failed response with a document ID links to the existing saved-record screen;
an uncertain response directs the person to check the Library before trying again.
Neither path automatically reuploads or retries extraction. In-app navigation
offers a confirmation while a file is selected or import is pending; a late result
cannot redirect after leaving. Browser back and tab close are not intercepted.

Only a workspace with no review run opens the new review-setup presentation.
It places original access, source readiness and missing-page limitations beside
the optional brief and the existing explicit paid generation controls. Setup
blocks generation for loading, mismatched, unstored or unusable source snapshots;
usable partial text retains its limitations. Existing runs, including failed and
processing runs, retain their overview and recovery controls. This presentation
uses the existing save/conflict and generation controllers, not another paid
pipeline or persistence path. The retired /legacy-analysis uploader redirects to
/import; existing /review links, stored results and failed-import recovery remain.
The standalone Analytics dashboard/API and its chart-only dependencies are removed.
Old /analytics bookmarks redirect to /documents. Library activity and My review
still describe personal work, not aggregate legal safety or review completeness.

The workspace keeps the current brief, immutable review runs and personal work
separate. Runs snapshot their source revision and context; editing the brief
does not reinterpret existing findings. Personal data is scoped by run/finding:
recoverable drafts, explicitly saved questions, explicit reversible markers and
navigation/opened history are distinct. Reading a finding never marks it reviewed.
Saving wording does not send it, accept a term or resolve a finding.
An explicit remove_question operation removes only confirmed wording for the
selected run/finding. Existing drafts and markers survive; absent drafts recover
the removed wording. It uses the same revision/CAS checks as other personal writes.

My review can produce a local Markdown brief through a pure selected-run serializer
in components/workspace/reviewBrief.ts. It includes only findings with confirmed
questions or explicit personal markers, recorded finding context, physical source
references and run provenance/coverage. Drafts, Ask answers, other runs, full source
text and internal URLs/identifiers are excluded. Source matching is labelled
separately from interpretation; missing source does not discard saved questions.
The original run context is used, never the current editable brief. Untrusted
wording is literal Markdown text, not active HTML, images or links.

Copy and download are explicit browser-only actions with no API/provider request,
save, new record or schema change. Pending/conflicted saves and unavailable
filename metadata block export. Clipboard/download failures use inline feedback
and a read-only manual-copy fallback, not native dialogs. Object URLs are revoked
after download dispatch. The earlier analysis PDF report remains separate.

Updates carry an expected workspace revision and a typed operation. An atomic
conditional document update rejects stale writes; it never upserts or changes
identity. The frontend serializes its own writes and debounces draft recovery.
It keeps newer local wording while a response is pending and preserves the last
confirmed saved question after failure. Cross-tab conflicts stop the queue; the
person must reload saved state and explicitly choose whether to apply pending
edits. Unconfirmed browser-only edits are not promised to survive a hard close.

An explicitly requested synthetic fixture run is also available.
The fixture definition ships in backend/fixtures/reviews, is bound to the unchanged
25-page synthetic PDF SHA-256 and resolves each evidence match uniquely against
persisted page spans. Arbitrary files never receive these example findings.
The fixed Example Customer scenario is labelled and does not overwrite the
person's brief. No generation, embeddings, credential reads or paid retries are
part of the fixture path. Explicit Ask about a fixture finding is a separate,
real paid action and is labelled as AI output, not part of that authored example.

### Workspace presentation

Library, Import, Settings and workspace reuse components/shell/AppHeader.tsx.
Workspace destinations continue through its unsaved-work guard; Import retains
its own selected-file/pending-import guard. Settings groups existing credential,
model, opt-in retention and notification controls without changing save semantics.

For an existing run, AgreementOverview leads with the saved agreement summary,
source references and direct Findings/My review actions. It has no reserved
activity sidebar; revisit items and routine source/run details use disclosures.
The brief and another explicit generation sit in a secondary disclosure, opened
for pending edits or recovery. Changed-context, incomplete/failed-run and
save-recovery warnings remain visible, as do model-authored limitations that may
describe material omissions. Only the exact fixed generator disclaimer is treated
as routine. MyReview is a full-width selected-run checklist,
defaulting to Saved work (confirmed questions or explicit personal markers),
with All findings, Revisit and Saved questions filters, direct markers and inline
question editing. Explicit Save changes confirmed wording; Cancel closes the
editor but retains the recoverable draft. An in-app confirmation removes a saved
question without removing its draft or marker. Drafts and provider answers remain
separate. Filters never narrow the whole-run confirmed brief export. Pending,
conflicted and paid-operation states retain the existing mutation/export guards.

DocumentWorkspace gives the PDF the available viewport beneath compact controls.
Document reading uses one toolbar: extraction access sits with page/zoom controls.
Source navigation adds its return action and optional context disclosure to that
same toolbar; Library search links do not add a placeholder source heading.
Return and extraction actions remain available when PDF loading/rendering fails.
An ordinary Document tab opens without unrelated finding context.
Extracted text is an optional side panel for the visible physical page, not a
substitute for the original layout. PDFViewer groups page, zoom and viewing-mode
controls, with bounded direct physical-page entry and explicit fit-width/fit-page
zoom choices. A versioned browser-local reader bookmark stores only page/coordinates,
zoom and mode per document/source revision. In-memory fallback survives component
remounts when browser storage is unavailable. Preferences flush on unmount/pagehide;
obsolete or malformed bookmarks are ignored. Fresh citation requests override a
bookmark; Library's saved citation anchor is only a fallback on reopening. This
does not change the backend review-position schema or persist document text.
The local PDF.js renderer,
source identity checks and quote-matching rules are unchanged. Opening a checklist
reference preserves its exact finding/reference selection and returns to My review
without generating or accepting anything.

Finding reference rows explicitly distinguish excerpt preview from a direct View page
action for the original physical page. Preview selects/focuses the passage in the
evidence pane; View page retains exact reference identity and source-match guards.
Review and Ask share the centre column without hiding the evidence companion.
Their mounted views preserve independent scroll positions while switching; drafts,
confirmed questions and conversations remain controller-owned and distinct.
Question editing opens deliberately from the persistent action bar. Use review
question copies current review wording into the Ask draft; replacing a different
non-empty draft requires confirmation. Neither action dispatches a provider call.
Answer references preview their own exact passage and can open Document with a
return to the same finding's Ask conversation. No claim-level relationship is
inferred from a finding's reference list. Overview omits same-page resume controls;
its saved summary and source limitations remain unchanged.

lib/workspaceReads.ts handles source and filename metadata independently from
the persistent review controller. Each read has a 20-second deadline, explicit
retry and stale-response fencing. Retry does not reset drafts, write state,
restart extraction or call a provider. Caller cancellation is quiet; timeout and
other read failures retain distinct UI states and content-free diagnostic fields
(resource category, status, duration and connectivity), without URLs, document
identifiers, source text or raw errors. Source failures disable matched-reference
actions until a successful read; they do not remove saved review output.
The workspace-state GET uses the same 20-second read deadline. Diagnostics are
serialized allowlisted JSON and distinguish failure before headers from failure
during response-body handling, so log collectors do not lose the fields.
Body-stream network failures retain the received HTTP status and are distinguished
from malformed JSON; a 200 header alone does not establish complete delivery.

Ordinary writes already dispatched by a retiring controller are tracked by transport
and document in the current JavaScript runtime. A replacement controller waits for
those writes before reading its starting revision; otherwise it could read stale
state just before the old PUT commits. The wait has its own 20-second deadline and
fails explicitly rather than replaying the write or bypassing it with a stale GET.
This protects same-runtime remounts, not hard reloads, separate tabs or every module
replacement. Genuine external conflicts still require an explicit choice.

The frontend workspace uses a compact header with the selected run's original
perspective, labelled run kind/status and confirmed-save feedback. Normal
provenance is disclosed on demand; changed-context, incomplete/failed-run and
save-recovery warnings remain visible. The Findings view separates navigation,
the full finding plus personal question editor, and a companion pane. All findings
remain in the scrollable navigation, without a first-five gate. The selected exact
quotation precedes compact reference selectors; every reference remains accessible
and source matching still gates the separate original-page action. Reading text
uses a larger, more relaxed hierarchy while retaining Inter and both dark themes.
An unchanged, confirmed saved question shows quiet status instead of a disabled
update button; pending writes and conflicts never acquire that saved-state claim.
Editing restores the action and retains the previously saved wording. Opening
Ask replaces the centre-column reading content while the evidence companion stays
visible. Compact source chips preview the exact evidence associated with each
answer paragraph rather than repeating full quotations in the conversation.
For newly generated answers, services/ai/ask_citations.py binds explicitly mentioned
bracketed passage IDs to that paragraph's already-resolved evidence indexes.
The saved optional inline_citations mapping drives inline excerpt previews; it is
not a semantic support check. The response schema and original generated prose
remain unchanged, and UI-only mappings are excluded from subsequent model history.
Some historical text has no persisted inline association. Unknown/historical IDs
remain labelled as unlinked references with the original IDs in a disclosure;
no mapping is inferred from order, page number or wording.
The Send action, independent Ask drafts and saved personal questions
retain their existing controller contracts. Layout styles consume the shared
Black/Graphite theme tokens; this presentation layer does not change provider or
personal-work semantics.

Physical source-page navigation disables the viewer's smooth-scroll animation;
an animated jump would keep writing a pixel offset measured before a resize.
Legacy analysis keeps its existing behavior. This removes that animation race,
not every resize issue: zoomed-out single-page layout can still change its page
offsets with viewport height and is not certified to preserve the reading position.

### Appearance

The browser offers two dark palettes: Black (default) and Graphite. The named
theme switch is available in the main navigation and workspace header. There is
no light or system-following mode. Both use the same layout, fonts and interaction
states; original PDF pages retain their source colours.

Theme choice is browser-local, separate from server Settings and document data.
The retained clauseiq-theme storage key migrates legacy dark to Graphite and
legacy light, missing or invalid values to Black. Initialization applies the
stored palette before hydration; the provider keeps the DOM and app state in
sync. Unavailable browser storage does not prevent switching in the current
session. Global CSS owns palette values, and workspace CSS aliases those tokens
rather than maintaining an independent theme definition.

### Explicit review generation

services/ai/review_generation.py owns the versioned prompt, strict structured
output and source-reference validation. It supplies all successfully extracted
nonblank text as ordered page-local passages plus the saved brief. Initial review
does not use top-k vector retrieval, make embedding requests, truncate the source, or migrate
the retained Chat Completions endpoint. Input budgeting includes messages and the
output schema; the completion allowance is a separate configurable spending guard.

services/ai/review_passages.py derives these passages without changing stored
extraction. Generic numbering and blank separators guide grouping; bounded fallback
groups prefer sentence boundaries. Each original line anchor remains in exactly one
passage, including headings, tables and page noise. Ordinary groups are limited to
4,000 characters and 32 spans; a longer single line remains intact up to 20,000
characters or fails before dispatch. Physical page boundaries and forced splits
carry conservative continuation flags. These are navigation heuristics, not proof
that a passage is a complete clause or that adjacent pages are semantically joined.

The new output separates source facts, interpretation, uncertainty and possible
actions. Overview statements have evidence too. The provider returns supplied
passage IDs and relevance labels, not authoritative quotations, page numbers or
line IDs. The server resolves each ID within the prepared snapshot and publishes
its exact original text with the source revision, physical page, first span_id and
inclusive end_span_id. Unknown or repeated IDs in one evidence list are rejected;
there is no excerpt repair, fuzzy matching or search for a different passage.
A reference-validation failure withholds the generated output and records an
incomplete result rather than dropping a
finding silently. Missing-term findings require a stated reviewed scope. This
validation establishes wording and location, not truth, applicability or legal
completeness. Partly extracted input remains incomplete even if every returned
reference resolves. Unsupported input and zero findings are not a clean bill of health.

Canonical passage expansion also has a per-result safety bound:
MAX_RESOLVED_REVIEW_BYTES limits the combined serialized overview_items/findings
envelope to 1,000,000 UTF-8 bytes, checked incrementally as items are resolved.
Exceeding it records incomplete/REVIEW_RESOLVED_OUTPUT_LIMIT, withholds all generated
overview/findings, retains available usage and makes no retry. This is not a total
stored-document-size guarantee or a migration policy.

The prompt requires each finding and overview item to carry its own support for
material assertions, including relevant conditions, exceptions and costs. Evidence
elsewhere in the review does not make a finding self-contained. These instructions
are quality targets, not a semantic validator. The source-reviewed synthetic cases
in backend/fixtures/review_evaluations provide separate manual assessment criteria;
they never enter the production prompt or prescribe a fixed finding count.

services/review_generation_service.py owns the persisted attempt lifecycle. The
explicit generation request checks the saved workspace revision and displayed
model against Settings, snapshots the source/brief/model, and conditionally saves
a processing run before contacting OpenAI with the person's request-scoped key.
The request ID is the run ID. Replaying that ID returns its existing state, never
another paid call. Provider retries and automatic model fallback are disabled on
this path. A new request ID is a deliberate new review, not recovery of the old one.

Finalization rereads and conditionally updates the workspace, preserving concurrent
personal edits. Completed runs retain prompt/schema/extraction versions, model,
estimated input, actual usage when returned, duration and safe failure information.
Source changes, deletion and explicit interruption fence late results. Terminal
runs and older personal work are not overwritten by a new run. A process loss can
leave a processing attempt; read-only refresh and explicit interruption expose
that uncertainty without replaying paid work. Interruption does not cancel or
refund a provider request, and exactly-once billing is not promised. There is no
background worker or automatic restart recovery in this increment.

### Finding-scoped Ask

services/ai/review_ask.py prepares one bounded Chat Completions request using the
selected finding, its immutable run context and all extracted source passages.
Previous generated findings/answers and document content are untrusted input;
the source, not previous AI prose, supplies factual support. No retrieval, tools,
external research, automatic repair or checker stage is added. Over-budget input
is rejected without truncating source or silently switching models.

The structured answer contains paragraphs with canonical passage evidence and
limitations. Clarification/uncertainty can be expressed without pretending a
citation proves missing information. Material factual statements are instructed
to include their own support and relevant qualifications. The shared exact
passage resolver checks references, not semantic accuracy; invalid/oversized
output is withheld, with known usage retained. Partial extraction remains visible
as incomplete. Refusals, timeouts and incomplete provider output never trigger
another call automatically.

services/review_ask_service.py stores Ask attempts separately from generated runs
and personal saved questions, in review_workspace.ask_turns. Each attempt retains
document/run/finding/source identity, its question, supplied-history IDs, model,
prompt/schema/extraction versions, coverage, usage, duration and outcome. New
personal ask_drafts are independent of saved-question drafts and are never sent
by an autosave. Existing records default to empty Ask state; no migration is needed.

Ask uses up to six recent usable answers from the same run/finding, starting at
the most recent successful fresh question. History exclusion/shortening is
disclosed. Choosing a fresh question excludes past conversation, not the source
or original review context, and does not delete earlier answers. There is no
cross-document, cross-run or cross-finding conversation sharing.

An explicit send checks the displayed Settings model and workspace revision,
then persists a processing claim before provider dispatch. Replaying the same
request identity cannot charge again; conflicting payloads are rejected. At most
one Ask attempt per document is processing. Read-only refresh reconciles uncertain
outcomes; explicit interruption fences late output without cancelling/refunding
provider work. Finalization preserves concurrent drafts/markers and rejects changed
source or run/finding identity. Deleting the document removes its embedded Ask
state and late responses cannot recreate it. The existing legacy document-chat
path is unchanged.

Ask has separate record/result/storage bounds and a conservative BSON document
headroom check before dispatch. These prevent new Ask history from growing without
bound; reaching a cap preserves previous work and stops further sends. They do not
retroactively migrate or certify the size of historical documents.

### Development-only review diagnostics

backend/evaluations/review_checker is isolated evaluation tooling, not an
application stage. Routers and production services do not import it. Start review
still makes one generation call; this checker adds no app latency, database state,
UI badge, repair loop or automatic paid request.

Preparation binds an immutable candidate and its saved brief to exact source and
extraction digests. All available source passages are supplied once. Original
evidence must map to exact canonical passages; no better citation is substituted.
The input inventory includes overview text, finding fields, evidence labels and
coverage limitations. Oversized or inconsistent inputs are rejected, not truncated.

A separately invoked Sol request reports exact field excerpts, source passage
references and priority gaps. The parser requires a complete target inventory,
strict schema and exact Unicode offsets/IDs. It never edits the candidate.
Completed means the diagnostic contract was satisfied, not that the review is
correct. Partial source or unassessable targets remain incomplete; malformed
output withholds diagnostics and retains known usage. Reference validation cannot
prove that a selected passage actually supports the model's explanation.

Authored synthetic calibration cases and false-alarm controls live separately in
backend/fixtures/review_checks. Their expectations never enter the checker input.
Offline tests establish input/transport/parser boundaries only. Model detection,
misses and false alarms still require separately approved source-reviewed live
calibration; product integration is not implied by this tooling.

### Evidence display and PDF adapter

The workspace checks source revision, page-local anchor order and the exact Unicode
code-point slice before presenting evidence as matched. For end_span_id ranges,
it verifies the inclusive anchor sequence and all original text between the first
and last anchor. Missing, reversed, cross-page or inconsistent ranges are not
repaired. An omitted/null end_span_id retains the legacy exact single-span contract;
older saved runs and authored fixtures need no migration. The presentation helper
also rejects duplicate physical pages, ambiguous anchors and overlapping legacy
single-span anchors before showing a matched claim, context or an original-page
action. It never repairs an old quotation or upgrades it into a broader citation.

Single-span excerpts and selected ranges are explicitly labelled as potentially
starting or ending mid-clause. The original quote is shown unchanged. An optional,
separately labelled disclosure displays up to 360 Unicode code points before and
after it on the same exact source page, with the saved quote marked in extracted
text. Explicit boundary notices identify clipped context; a nested full-page
disclosure is available when clipped. This is neither a clause-boundary heuristic
nor a claim that all qualifications are on that page. Context is never appended
to the saved evidence, used to rewrite a finding or sent to AI by opening it.
Overview and Ask evidence lists and the Document source pane use the same helper.
The separate original action requests the physical PDF page through the renderer adapter.
It never passes evidence to the legacy fuzzy highlighter or invents rectangles.
Quote matching does not verify interpretation, layout fidelity or completeness.

The source PDF uses a bounded, internally scrolling viewport so a long agreement
does not expand the entire workspace. Source-navigation mode initializes the
renderer at the selected scale before applying its physical-page request; it does
not issue a competing load-time zoom. This avoids measuring a page jump against
an obsolete scale. The same scale remains selected when changing view mode.

PDFViewer owns local-header fetch, revocable blob URLs and the source-navigation
session. PdfJsRenderer is a client-loaded adapter for Mozilla PDF.js 6.3.289's
viewer, link service and find controller. It owns rendering, selectable text,
read-only annotations, single/continuous mode, zoom and worker teardown. Callbacks
from replaced source/mode/retry sessions cannot overwrite the active position.
Legacy clause highlighting searches the supplied text using PDF.js's normalized
text-search rules and reports match counts; it does not guess substitute phrases,
poll unrelated DOM nodes or claim geometrically verified evidence. The workspace's
physical source-page path remains separate and does not invoke text search.

The commercial React PDF Viewer plugins, obsolete DOM-polling hook and global
console interception have been removed. PDF.js retains isEvalSupported:false;
document scripting and editing are disabled. Version-matched worker, character
maps, fonts and decoders are copied to ignored frontend/public/pdfjs by the
frontend predev/prebuild script and served locally, including upstream licensing.
No CDN runtime is required. See SECURITY.md for the untrusted-document boundary.

## Settings and credentials

The workspace service separates key handling from document operations.
Settings expose key presence only, the review/query-preparation model catalog,
optional retention and presentation preferences. No account, SMTP, role,
database-browser or raw-log administration routes remain.

A random encryption key is generated automatically in the backend's private
runtime directory on the first key save. Only encrypted API-key material is
stored in MongoDB. The decrypting key is owner-readable, excluded from Git and
Docker build contexts, and persisted in a separate volume in full Compose.
Missing state does not silently generate a replacement during decryption.

## Local request boundary

The application ports bind to loopback by default. The API validates loopback
Host names, exact configured browser Origins and the X-ClauseIQ-Local header.
The header is a browser preflight marker, not a password. See SECURITY.md for
the trusted-OS-user boundary and limitations.

Inside that boundary, middleware/request_context.py supplies one server-generated
HTTP identity shared by safe logs, standard response correlation_id and both
X-Request-ID/X-Correlation-ID header aliases. Caller-supplied IDs are not adopted.
Context is reset after the request; persisted review/Ask attempt IDs remain a
different concern. Early rate-limit responses use the same error envelope.
Module logger lookup does not configure global handlers. Backend startup explicitly
configures INFO-level rotating application logs; reconfiguration replaces only
application-owned handlers. Diagnostic events retain allowlisted metadata and
exception classes, not document content, credentials or raw exception messages.

## Model selection and request contracts

backend/ai_models/models.py is the canonical model catalog. The workspace API
serves its names, limits, reasoning options and dated base prices to the frontend;
the UI does not maintain a second catalog. The active choices are GPT-6 Luna,
Sol and Astra. New installations use Sol for review and optional chat query
preparation. Retired GPT-5/5.6 saved choices or environment defaults resolve to
Sol, without rewriting historical run attribution or other preferences.
Other stored choices take precedence over the initial default. Unknown saved IDs
remain visible and fail explicitly instead of silently selecting another model.

Classification, clause extraction, structured summaries, clause rewrites and
chat answers honor the review model and reasoning effort. These two preferences
are stored in one configuration record and read as one request snapshot. Missing
effort defaults to medium; retired model choices resolve to Sol/medium on read.
Settings validates model/effort combinations before any setting writes. The UI
offers only supported efforts and discloses resetting an incompatible unsaved
effort when switching models. Review/Ask requests carry the displayed effort as
well as model; a mismatch with Settings rejects new dispatch. Same-ID recovery
retains the original request snapshot. Historical generation metadata is unchanged.
Chat context detection and query rewriting
honor the separate advanced model at low effort. Both choices use request-scoped personal
credentials. Database errors must not be mistaken for an unset model preference.

services/ai/generation.py validates every generation call against that catalog,
uses Chat Completions with explicit reasoning effort and completion limits, and
disables provider-side response storage with store=false. This is not a promise
of Zero Data Retention; OpenAI's account/data policies still apply. It reports
safe errors for unavailable models, provider failures, refusals, empty output and
incomplete completions. Structured analysis validates its output before saving.
Oversized requests fail before generation rather than silently reviewing a prefix.

services/ai/token_utils.py separates model capacities from task spending budgets.
Larger model capacity never automatically increases output allowances. Token
counts are local estimates using o200k_base, not provider billing measurements.
See DEVELOPMENT.md for budget overrides and evaluation limits.

New analysis results record model ID, endpoint, reasoning effort, completion
budget and catalog verification date per stage in analysis_generation. New
rewrites and chat answers record rewrite_generation and generation respectively.
Old saved results remain valid without this metadata. Cached rewrites keep their
original attribution and are not regenerated merely by changing Settings.

## Migration

Startup preflights MongoDB, GridFS and Qdrant before applying an additive,
restartable migration. Zero or one legacy owner is supported automatically.
Multiple owners, ambiguous ownership or conflicting workspace data stop startup
for an explicit data-selection decision. Existing account rows, ciphertext,
legacy owner fields, document IDs and relationships are not deleted.

Inherited retention is disabled during the first migration; newly opted-in
retention is preserved on later restarts. A decryptable legacy API key is copied
into the new credential store. If its old encryption secret is unavailable, the
library remains usable and Settings requests key re-entry.

## Scope

Next.js, FastAPI, MongoDB and Qdrant are retained. Legacy chat embeddings remain
text-embedding-3-large with 3,072-dimensional vectors; no legacy reindex is required.
Library semantic search uses a separate source-versioned large / 3,072 index;
earlier Library small indexes require explicit rebuilding, not legacy-chat migration.
This version does not introduce a job queue, a Responses API migration, offline
inference, team support or agent orchestration.
