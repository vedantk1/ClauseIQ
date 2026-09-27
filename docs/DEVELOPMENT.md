# Development

## Setup

Use Node.js 24+, Python 3.13+ and Docker with Docker Compose.

~~~bash
cp -n backend/.env.example backend/.env
cp -n frontend/.env.example frontend/.env.local
npm ci
npm run setup
~~~

No JWT, SMTP or admin-email setup is needed. Do not put an OpenAI key in an
environment file; enter it in the application's Settings when needed.

### Existing workspace continuity

Keep an existing `.env` rather than overwriting it with the example. The backend
always loads `backend/.env`, independent of the launch directory; explicit process
environment variables still take precedence. New installations default to the
`clauseiq` MongoDB database in native and Compose setup. Existing installations
may use another name, including the earlier `legal_ai`; keep their explicit
`MONGODB_DATABASE` value. Changing the name selects a different database, **not**
a rename or migration. Native and full-Compose stores are not automatically shared.

On startup, `database-binding.json` in `WORKSPACE_STATE_DIR` pins the database
name and collection prefix before migration, credential initialization or cleanup.
A mismatch or corrupt marker stops startup instead of opening a different library.
For older unbound installations with a credential file, the selected database must
contain a saved credential or deliberate-removal record before binding it.
The marker contains no URI, secrets or document content; it does not detect
switching MongoDB servers with the same database name and prefix.

If the library/key appears missing, check the configured database, process
overrides and local state directory before adding another key. Restore the original
configuration; do not delete the binding, rotate credential state, drop databases
or merge records to bypass the check. Back up MongoDB and workspace state together.
A deliberate separate installation needs separate state and data/vector stores;
an intentional migration requires a reviewed backup/restore and rebinding plan.

Check ports 3000, 8000, 27017, 6333 and 6334 before starting another service:

~~~bash
docker compose -f docker-compose.dev.yml up -d
npm run dev
~~~

Open http://localhost:3000. Servers use development mode and loopback bindings.
The root opens Library; new agreements use /import and the review workspace.
The retired /legacy-analysis uploader redirects to /import, and /analytics to
/documents. Existing /review links and stored earlier analyses remain supported.
MongoDB and Qdrant must both be available for workspace migration preflight.
Leave `QDRANT_API_KEY` blank for the unkeyed local service. Blank or whitespace-only
values are treated as absent so the client uses local HTTP, not key-triggered HTTPS.
Compose pins Qdrant server 1.16.3 with Python client 1.16.2. See
[version and existing-store guidance](../DOCKER.md#qdrant-versions-and-existing-stores)
before recreating an existing container; setup commands do not back up its data.

The frontend predev/prebuild hooks prepare the pinned Mozilla PDF.js worker,
fonts, character maps, decoders and annotation assets under public/pdfjs. These
generated files are ignored and served locally, not downloaded from a CDN when
a PDF opens. After updating dependencies with a server already running, run
`node frontend/scripts/prepare-pdf-assets.mjs` once from the root. Use the npm
dev/build commands rather than invoking Next.js directly so fresh installations
also prepare these assets. The Docker build follows the same npm hook.

## Commands

| Command | Purpose |
| --- | --- |
| npm run setup | Install dependencies and build shared types |
| npm run dev | Hot-reloading frontend and backend |
| npm test | Deterministic backend and frontend tests, no paid AI calls |
| npm run test:backend | Backend tests only |
| npm run test:frontend | Local API, persistence state, viewer adapter and render-contract tests |
| npm --prefix frontend run test:e2e | Isolated, synthetic Chromium UI journeys; separate from npm run check |
| npm --prefix frontend run test:e2e:real | Real API/storage Chromium journey using disposable Docker services |
| npm run typecheck | Frontend types |
| npm run lint | Frontend lint |
| npm run build | Shared types and frontend production build |
| npm run check | Complete deterministic validation sequence |

## Continuous integration

[The CI workflow](../.github/workflows/ci.yml) runs on pull requests targeting main
and pushes to main. Its independent jobs cover:

- Backend deterministic Pytest tests using Python 3.13, with branch-coverage
  reporting, critical Python lint and a declared strict typing subset. A key-free
  preflight downloads the public tokenizer vocabularies needed by the tests.
- Shared TypeScript build; frontend unit/component tests, typecheck, lint and
  production bundle build using Node.js 24.
- Chromium browser journeys on an isolated development frontend with synthetic
  API responses. No real backend, database or saved credentials are accessed.
- A separate Chromium journey through real FastAPI, MongoDB/GridFS and Qdrant
  startup, using test-owned disposable services. Import, authored findings,
  confirmed saving, reopening and physical PDF navigation use the real API.
- Gitleaks scanning across the fetched reachable Git history, with redacted output.

Actions and the secret scanner are pinned; workflow permissions are read-only and
checkout credentials are not persisted. Failed browser runs can retain synthetic
diagnostics for seven days. Dependency installation and tokenizer/browser downloads
need network access; this is an unpaid workflow, not an air-gapped one.

There are no paid evaluations, deployment steps or changes to repository settings.
The real-stack check does not use an existing installation or saved API key.
Required-check enforcement must be configured separately.
Passing CI does not establish legal quality, exhaustive security or compatibility
with a particular person's saved installation. Keep isolated storage smoke checks
for changes to persistence or migration, and retain the batched visual review.

### Browser smoke

After normal dependency setup, install the browser once and run the journeys from
the repository root:

~~~bash
(cd frontend && npx --no-install playwright install chromium)
npm --prefix frontend run test:e2e
~~~

On Linux CI, installation also uses `--with-deps` for system libraries. The pinned
Playwright runner starts its own Next.js development server at 127.0.0.1:3100 and
refuses to reuse an existing server on that port. Its `CLAUSEIQ_E2E=1` build uses
`.next-e2e` and `tsconfig.e2e.json`, separate from the ordinary development cache.
The normal TypeScript configuration excludes `.next-e2e`. Next.js still temporarily
rewrites the shared generated `next-env.d.ts`; the test-server wrapper snapshots
that file and restores its original bytes when it shuts down. Do not run the
ordinary frontend typecheck or build concurrently with this smoke suite.
Do not stop the person's port-3000 application or switch its database to run it.
Playwright stops only the server it started.

The tests cover direct Library opening, finding excerpt preview, physical PDF-page
navigation and return, explicit question saving, refresh/resume, PDF selection into
unpaid setup, the 1280×800 entry layout, Black/Graphite captures at 1440×1000 and
the finding selector at 720px width. API
responses and saved work are test-owned in-memory fixtures derived from the exact
synthetic 25-page PDF and its authored review. The browser still runs the actual
frontend and local PDF.js renderer. Unexpected API routes, external traffic and
provider-dispatch routes fail the test instead of falling through to live services.

This tests browser interaction with a synthetic API contract, not FastAPI extraction,
real database durability, credential handling, model quality or a complete
accessibility audit. Retain unit/controller tests and isolated backend storage
smokes for those respective boundaries. `npm run check` does not include the
browser command; CI runs it as a separate job. Diagnostics and generated screenshots
stay under ignored `output/playwright/`.

For a reproducible product capture only:

~~~bash
npm --prefix frontend run test:e2e:screenshots
~~~

This runs the synthetic showcase case and produces Black/Graphite captures under
`output/playwright/showcase/`. It does not capture the person's live installation.
Review selected images against [repository policy](REPOSITORY_POLICY.md) before
publishing a copy under docs/images; generated test-output folders stay untracked.

### Real API/storage browser smoke

This separate check uses real frontend and FastAPI development servers, MongoDB/
GridFS persistence and Qdrant startup. It creates its own digest-pinned MongoDB and
Qdrant containers with temporary in-memory storage, unique ownership labels and
random loopback store ports. Existing Compose services, backend environment files,
credential directories and application records are not used or changed. Next.js
may load the normal frontend environment files; the test overrides its API origin
explicitly and blocks requests outside the isolated origins. No environment file
is modified by the harness.

After normal dependencies and Chromium are installed, inspect and explicitly pull
the prerequisites once, then run from the repository root:

~~~bash
python3 scripts/run_realstack_smoke.py --print-images
# Run docker pull for each exact image printed above.
npm --prefix frontend run test:e2e:real
~~~

The runner uses backend/venv when present, otherwise the launching interpreter.
It checks the declared Qdrant client version before starting the journey. If a
working installation has dependency drift, use a separate interpreter installed
from backend/requirements.txt rather than altering a running application's venv:

~~~bash
python3.13 scripts/run_realstack_smoke.py --run-isolated-live --python path/to/isolated/python
~~~

The runner never pulls implicitly. It refuses occupied test ports 3101/8101,
starts a separate Next.js cache at .next-e2e-real and runs FastAPI from a temporary
directory with application environment-file loading disabled. The test launcher
blocks provider construction, credential-file reads and connections outside its
owned database services. Browser requests are allowlisted to the isolated UI and
the unpaid API routes exercised. These controls are test-only; they do not add a
production bypass or a second application configuration mode.

The journey imports the unchanged 25-page PDF, loads its labelled authored example,
saves a question, clears browser storage and reloads it from the API, then previews
evidence and opens the original physical page. It checks downloaded original bytes
against the fixture hash. A separate Ask lifecycle smoke on the same test-owned
MongoDB uses a fresh fixture database and mocked provider boundary to check
fresh-connection readback, inline citation mappings and historical-answer preservation.
No embeddings, real model answers or legal quality are tested.

Cleanup validates exact container IDs, invocation labels, mounts and bindings
before stopping only owned disposable services. Failures must remain visible;
never use volume pruning or stop the person's normal services to resolve a test
failure. Diagnostics contain synthetic data and remain ignored under
output/playwright/real-stack. The temporary source/credential-state directory is
removed. Do not run this suite alongside the mock-browser suite, frontend typecheck
or a build: Next.js still shares the generated next-env.d.ts file, which the
test wrapper restores on exit.

### Focused local checks

Incremental backend quality tools are optional for normal runtime setup:

~~~bash
cd backend
venv/bin/python -m pip install -r requirements-dev.txt
venv/bin/python -m ruff check .
venv/bin/python -m mypy
venv/bin/python -m coverage run -m pytest tests -q
venv/bin/python -m coverage report
venv/bin/python -m coverage xml
~~~

Ruff currently checks critical syntax, invalid comparisons and undefined names
across backend source and tests, not a comprehensive style policy. Strict mypy
is limited to source-passage construction, Ask inline-citation binding and HTTP
request context; imports retain their types but unrelated modules are not claimed
as checked. Expand this explicit scope as modules are maintained. Branch coverage
is reported over backend source without an arbitrary global percentage gate;
the report identifies gaps, not model quality. Generated coverage files stay
ignored. CI retains the XML report for seven days.

Focused commands:

~~~bash
docker compose -f docker-compose.dev.yml ps
cd backend && venv/bin/python -m pytest tests -v
npm --prefix shared run build
~~~

Optional isolated live storage checks (no OpenAI calls) are documented in
../backend/tests/README.md. They create and clean up only their own fixture stores.

For Qdrant dependency changes, run `tests/test_qdrant_configuration.py`,
`tests/test_qdrant_version_contract.py` and `tests/test_workspace_storage.py` with
the candidate dependency environment, then the opt-in `manual_qdrant_smoke.py`.
That smoke requires Docker and the exact cached image, creates a separate
tmpfs-only container on an unused loopback port, and uses deterministic synthetic
vectors instead of an AI provider. It never starts either Compose stack or
connects to the application's Qdrant service. See backend/tests/README.md for flags.

For source import/extraction changes, focused checks include:

~~~bash
cd backend
venv/bin/python -m pytest tests/test_source_extraction.py tests/test_source_import.py tests/test_source_storage.py tests/test_source_analysis.py tests/test_source_error_responses.py -q
venv/bin/python tests/manual_source_smoke.py --run-isolated-live
~~~

The manual source smoke requires the existing development MongoDB only, not
Qdrant or a provider key. It uses a verified-absent disposable database, checks
real GridFS bytes/page anchors, retry/fencing and unrelated-data preservation,
then reports cleanup. Never point it at the application database.
This source increment is additive; no source backfill/migration or vector rebuild
is required. Existing analyses are not silently re-extracted or overwritten.

For review workspace persistence changes:

~~~bash
cd backend
venv/bin/python -m pytest tests/test_review_workspace.py tests/test_review_generation_lifecycle.py tests/test_review_generation.py tests/test_review_run_contract.py -q
venv/bin/python tests/manual_review_workspace_smoke.py --run-isolated-live
~~~

The review smoke uses an isolated synthetic database on the existing local MongoDB
service. It verifies fresh-connection restoration, competing revision writes,
scoping, immutable runs and deletion of nested personal work without
touching the application database. Its final report must show no leftovers.
It also checks real generation claims/finalization with a mocked provider,
same-ID replay, restart-visible interruption and fencing of late results after
deletion. It makes no provider or vector requests or saved credential reads.

For review evidence and quality-contract changes, run the focused offline checks:

~~~bash
cd backend
venv/bin/python -m pytest tests/test_review_passages.py tests/test_review_generation.py tests/test_review_run_contract.py tests/test_review_evaluation_cases.py tests/test_review_evaluation_guard.py -q
~~~

These check exact passage preservation, provider-reference resolution, historical
single-span compatibility and evaluation-case safety. They do not grade real model
interpretation. Passage grouping is derived from immutable extraction; it requires
no source migration, re-extraction or vector rebuild. Include frontend workspace
tests and type checking when changing the range-evidence display contract.

The /import and /workspace routes support source-backed AI reviews and a key-free
fixture preview. Import tests/fixtures/pdfs/managed-services-25p.pdf, then load its
labelled synthetic example to exercise findings and saved work. Other PDFs may be
imported and reviewed explicitly with AI, but never receive those example findings. Fixture
definitions ship under backend/fixtures/reviews; missing definitions disable the
example rather than inventing output. Existing /review analysis remains separate.
Focused frontend tests include delayed replies, conflicts, explicit saves,
debounced draft recovery, page navigation and exact source excerpt checks. Paid
generation is outside the normal save retry queue: unknown outcomes are reconciled
by GET, and any deliberate resend retains its original request ID/model/revision.
No automatic review occurs on import, navigation, brief changes or reload.

## Findings presentation checks

The workspace keeps provenance in the compact Details disclosure beside its tabs.
Overview uses one summary heading and direct Findings/My review actions rather
than a reserved activity sidebar. Routine source details are disclosed; missing
pages, source/read failures and unknown model-authored limitations stay visible.
Only the fixed generator disclaimer is treated as routine automatically; do not
use text heuristics to hide potentially material limitations or rewrite stored output.

Settings keeps a saved key collapsed until Change key is selected (or re-entry is
required). Cancelling clears the replacement draft and returns focus to Change key.
Save changes is disabled while preferences are unchanged; changing a field clears
stale success feedback. Key status describes local storage, not provider validation.

For the shared entry/Settings shell, existing-run Overview, confirmed My review
and independent source/metadata read recovery, run:

~~~bash
node --test frontend/tests/journeyShell.test.mjs frontend/tests/workspaceShell.test.mjs frontend/tests/workspaceSummaries.test.mjs frontend/tests/reviewWorkspace.test.mjs frontend/tests/workspaceReads.test.mjs frontend/tests/sourceReadNotice.test.mjs frontend/tests/local-api.test.mjs
~~~

These cover saved settings, retired-entry redirects, question/draft separation,
exact source-return navigation, independent failures, one in-flight read per
resource, cancellation/deadlines and safe diagnostics. Read retries are bounded
GETs only; they never dispatch AI, restart extraction or reset the write controller.
Do not treat deterministic failure simulation as diagnosis of an observed browser
transport error. A combined unpaid browser checkpoint should exercise Library →
workspace → My review → source → return, plus Settings and retained earlier results,
without changing saved settings or starting paid actions.

Reliability regressions in these tests also cover a controller remount while its
previous PUT is still pending, a bounded wait without write replay, document
isolation, and readable content-free transport diagnostics. The workspace-state
GET is bounded as well as source/metadata reads. PDF navigation tests cover
non-animated physical page targeting; they do not certify all viewport-resize
behavior, particularly zoomed-out single-page mode. Keep historical browser
observations separate from mechanisms demonstrated by deterministic tests.

Workspace-read diagnostics distinguish network failure before headers from a
failed response-body stream, malformed JSON, explicit timeout and HTTP failure.
A body-stream network failure can retain status 200: server middleware timing
records header completion, not proof that the browser received the full body.
Diagnostics exclude document content, URLs, identifiers and raw error messages.
This distinction improves investigation; it does not diagnose an intermittent
failure without a matching observation, and does not add automatic retries.

The Findings layout retains all navigation items and shows the selected quotation
above compact reference selectors. Excerpt/passage labels do not certify a complete
clause. Optional surrounding extracted text is display-only and stays separate
from the unchanged saved citation. Unchanged, confirmed saved questions use quiet
status; edited wording restores the save action. Review and Ask switch in the
centre column while evidence stays available. Ask's compact source chips select
the exact saved passage associated with an answer paragraph, without repeating
the quotation in the conversation. Raw inline citation IDs with no stored passage
association receive display-only unlinked-reference labels; their original IDs
remain disclosed. This does not repair attribution or infer claim-to-citation links.
Opening/copying a question never sends through the paid controls. My review defaults
to confirmed questions and marked findings; All findings remains available without
affecting export scope.

Focused checks, from the repository root:

~~~bash
node --test frontend/tests/evidencePresentation.test.mjs frontend/tests/evidenceSelection.test.mjs frontend/tests/askAnswerPresentation.test.mjs frontend/tests/findingReview.test.mjs frontend/tests/reviewWorkspace.test.mjs frontend/tests/themePalette.test.mjs frontend/tests/readerViewState.test.mjs frontend/tests/pdfPageNavigation.test.mjs frontend/tests/pdfJsRenderer.test.mjs frontend/tests/myReviewChecklist.test.mjs frontend/tests/library.test.mjs
npm --prefix frontend run typecheck
npm --prefix frontend run lint
~~~

Renderer/handler/state tests check exact Unicode context, clipped/page boundaries,
ambiguous and malformed anchors, all references and finding navigation, independent
Ask/drafts, explicit save states and preservation of quote identity. Theme tests
check token contrast, not a complete accessibility assessment. A scoped existing
synthetic-record layout check can supplement these; batch broader keyboard,
responsive, theme and PDF navigation checks with the other entry-flow changes.
No paid AI request or regeneration is needed to validate these presentation changes.
The combined browser checkpoint should include reading-position restoration after
tab switching and reload, fresh citation precedence, fit modes, Ask/evidence,
question-editor focus, Library details dismissal/focus return, both themes and
1280×800 plus a narrower layout. Browser reader preferences contain no source
text and are scoped by document/revision; clearing browser storage clears these
preferences, not server-stored review work. There is no reader-state migration.

## Import and review-setup checks

The /import screen supports one selected or dropped PDF with a configured size
limit and an explicit, key-free import. A workspace without runs opens review
setup; existing runs keep their Overview and original context. The setup describes
source readiness and missing pages without claiming a completed review. Original
access and brief saving need no key; Start review keeps the existing paid-action,
Settings, source and save-conflict gates.

Focused frontend checks, from the repository root:

~~~bash
node --test frontend/tests/importFlow.test.mjs frontend/tests/reviewSetup.test.mjs frontend/tests/reviewWorkspace.test.mjs frontend/tests/sourceStatus.test.mjs frontend/tests/workspaceShell.test.mjs
npm --prefix frontend run typecheck
npm --prefix frontend run lint
~~~

These deterministic renderer, handler and state tests cover file validation,
duplicate-submit locking, saved-record/uncertain-result recovery, in-app navigation
confirmation and suppression of stale completion redirects. Setup tests cover
source states, exact missing-page limitations, save-before-generation and conflict
preservation, explicit model/key/payment gates and existing-run presentation.
They do not exercise a real file dialog, drag event, focus flow or provider.
In-app import links are guarded; browser back and tab close are not intercepted.
Shared dialogs keep Tab/Shift+Tab inside the topmost open dialog and restore focus
to the opener on close when it remains available. Escape respects the dialog's
dismissal setting, and nested dialogs share one body-scroll lock. Regression
coverage lives in frontend/tests/modalFocus.test.mjs; it does not replace live
keyboard or assistive-technology checks.
At batched walkthroughs, check file picking and dropping, both themes,
keyboard/modal focus, narrow layouts and saved brief return/reload. Keep it unpaid:
do not click Start review. No storage or provider contract changed in this UI slice.

## Library and resume checks

The /documents Library uses the compact GET /documents/ summary, not one full
workspace request per agreement. Filenames open directly; each row's Details
action opens a dismissible inspector rather than reserving an empty column.
Continue reviewing is independent of filters and chooses an eligible latest run
by recorded review activity. The resume link restores the saved view, finding and
evidence locally; it does not enqueue a save or dispatch AI. Import links continue
to /import; retired /legacy-analysis bookmarks also redirect there. Earlier saved
results remain accessible at /review.

Focused checks:

~~~bash
(cd backend && venv/bin/python -m pytest tests/test_document_library.py -q)
npm --prefix frontend test
npm --prefix frontend run typecheck
npm --prefix frontend run lint
~~~

Run these commands from the repository root. The backend tests use synthetic
projected records and mock reads; they check scoping, status selection, privacy,
malformed metadata and legacy compatibility. Frontend tests cover rendered
states, selection, explicit navigation, resume restoration and unknown counts.
The Library's select-all shortcut does not intercept native text selection in
editable controls. At narrow widths, Continue reviewing puts its action below
the filename/metadata rather than squeezing the title beside the button. Focused
regressions are in libraryKeyboard.test.mjs and libraryResponsive.test.mjs; the
responsive tests check CSS contracts, not a browser layout engine.
At batched walkthroughs, include multiple records, long filenames, both
themes, keyboard navigation and deletion confirmations. No AI key is required.

## My review checklist and export checks

~~~bash
node --test frontend/tests/reviewBrief.test.mjs frontend/tests/reviewBriefExport.test.mjs frontend/tests/workspaceSummaries.test.mjs frontend/tests/reviewWorkspace.test.mjs
npm run typecheck
npm run lint
~~~

These check selected-run saved-question/marker scoping, draft/Ask exclusion,
source matching and unavailable-source labels, literal Markdown safety, safe
filenames, pending-save gates, clipboard rejection and download cleanup. Exports
are generated from saved state in the browser; they make no API or paid call.
At a batched UI checkpoint, use a retained synthetic review, copy/download its
brief and compare it with My review. Do not export private source records as test
artifacts or treat a successful copy as legal validation.

My review prioritizes saved wording with one empty state and compact filters/export.
Ordinary editing avoids duplicating confirmed wording; blocked editing shows the
last confirmed question beside the local draft for recovery comparison. A refreshed
saved draft remains separately identifiable, and removed questions are not restored
implicitly. Checklist edits use the existing revisioned workspace queue. Include inline
edit/cancel/save, direct markers, Revisit/Saved questions filters, remove-confirm
and cancel, absent-question replay and cross-tab conflict checks. Removal must
preserve newer/empty drafts, recover wording only when no draft exists, and leave
other findings/runs unchanged. Backend coverage lives in test_review_workspace.py;
manual_review_workspace_smoke.py checks persisted removal and fresh-connection
readback in its isolated fixture database. Never delete retained review work for
a visual check.

For document-reader and layout changes:

~~~bash
node --test frontend/tests/documentWorkspace.test.mjs frontend/tests/pdfPageNavigation.test.mjs frontend/tests/pdfJsRenderer.test.mjs frontend/tests/workspaceDensity.test.mjs frontend/tests/libraryResponsive.test.mjs
~~~

At one batched browser checkpoint, inspect Library, Overview, Findings, Document
and My review in Black/Graphite. Check physical-page entry and source-return,
zoom/mode switching, the optional extraction panel, narrow viewport scrolling and
keyboard focus. Citation context uses one compact return/title/disclosure row;
opening its source details does not change the saved quotation or guess a highlight.
Reader toolbar regressions keep the native mode selector labelled
and aligned with zoom, without a redundant button-like border around its label.
CSS contract tests guard layout intent; they are not a substitute
for visual inspection or a measured accessibility assessment.

## Finding-scoped Ask checks

Finding-scoped Ask uses deterministic mocked checks during development:

~~~bash
cd backend
venv/bin/python -m pytest tests/test_review_ask_contract.py tests/test_review_ask.py tests/test_review_ask_lifecycle.py -q
venv/bin/python tests/manual_review_ask_smoke.py --run-isolated-live
~~~

The Ask smoke uses a verified-absent disposable MongoDB/GridFS database and mocked
AI/credentials. It checks durable answers and independent drafts, fresh-connection
restore, replay, concurrent edits, interruption and deletion fencing. It must
report cleanup with no leftovers; never point it at the application database.
Run frontend workspace tests/type checking for the matching UI/controller changes.
No command above dispatches paid requests. Actual answer quality belongs to a
separately approved source-reviewed synthetic checkpoint, not a passing mock test.

## Verification cadence

- Routine changes: add or update focused deterministic tests and run the affected
  tests, type checks and lint. Use the existing hot-reloading development servers.
  Documentation-only edits normally need link/content review and git diff --check.
- Broader checkpoints: batch manual UI testing and the full npm run check sequence
  after several related implementations or a substantial milestone. A production
  build and end-to-end manual walkthrough are not required after every small edit.
- Build earlier if the change affects bundling, dependency compatibility, Next.js
  configuration, generated shared output, or a defect only reproducible in a build.
  Rebuild only the affected package where sufficient; do not restart working
  services or rebuild Docker images without a relevant reason.
- Run targeted migration, data-integrity, local-access and credential checks when
  those boundaries change. Batch testing is not a reason to defer safety checks.
- Record what was checked, what is deferred to the next checkpoint, and any known
  failures. Mocked AI tests do not establish real model quality or actual cost.

### Synthetic PDF fixtures

At a batched functional checkpoint, exercise the local-only path separately from
paid quality evaluation:

1. Import the 25-page managed-services fixture through /import and load its
   explicitly labelled example. Confirm import itself does not start AI.
2. Change and save the brief; confirm existing findings and Ask retain their
   original run context instead of silently adopting the new perspective.
3. Follow related evidence on physical pages 22 and 25, including after reload.
   Check the visible page, not only the page label, and that the PDF scrolls
   within a bounded pane. Exact quotation matching is not semantic verification.
4. Save a question, mark a finding Revisit, and enter a separate Ask draft without
   sending it. Reload and resume; confirm all three remain distinct and intact.
5. Import a short fixture without an authored example. Confirm it remains an
   unreviewed source instead of acquiring unrelated fixture findings.
6. Keep existing records and repository fixtures intact. Retain newly created
   test records when requested; test deletion only with explicitly disposable
   data and the required in-app confirmation.

Do not click Start review or Send question to AI during this unpaid walkthrough.
Provider answers, paid failures and live output quality require their own approved
budget and source-reviewed cases; mocked tests cover their routine regressions.

tests/fixtures/pdfs contains explicitly synthetic PDFs spanning 1, 2, 5, 12 and
25 pages, their readable sources/manifest, and a deterministic generator. Keep
the small cases for fast diagnosis; use the longer agreements for late-page
extraction, distant cross-references, schedules and document-wide checks. Length
alone does not establish realistic difficulty or AI coverage. The corpus also
includes conflicting terms, untrusted embedded instructions and image-only input.
These are not real agreements or legally validated examples, and their presence
does not select a target contract family for the product.

From the repository root:

~~~bash
backend/venv/bin/python tests/fixtures/pdfs/generate.py --check
cd backend && venv/bin/python -m pytest tests/test_pdf_fixtures.py -q
~~~

See tests/fixtures/pdfs/README.md for regeneration and expectations. The default
tests perform local extraction checks only; no fixture is uploaded to the app or
sent to an AI provider automatically. Live model evaluation remains separately
approved and cost-capped.

### Unpaid Library search and retrieval regression

Library Keyword search is a separate POST action over the current source
extraction. It scans at most 100 agreements and 10,000 canonical page passages
per request, returning up to 30 exact excerpts. Its coverage fields distinguish
unsearched agreements, unavailable/partial sources and result truncation. It
does not read Settings credentials, build embeddings, call an AI provider or
write an index. The retained per-document Qdrant chat uses a different path.

The frozen synthetic retrieval set verifies source labels against the checked-in
PDFs, then scores the current lexical ranker without touching the application
database. From `backend`:

~~~bash
venv/bin/python -m pytest tests/test_library_search.py tests/test_library_search_evaluation.py -q
venv/bin/python -m evaluations.library_search_evaluation --limit 5
~~~

The JSON report separates document and exact-passage precision/recall, no-answer
near matches and latency. It is a visible 24-question development regression set,
not a held-out benchmark, legal answer evaluation or an AI-quality pass. The
source-reviewed labels and interpretation limits are in
[library_search_evaluations](../backend/fixtures/library_search_evaluations/README.md)
and [Evaluation](EVALUATION.md#retrieval-boundary). Semantic indexing and
cross-contract answers are not exercised by this lexical command.

### Library semantic index lifecycle

In Library, select **Semantic → Manage semantic index → Preview indexing**.
Preview is key-free and shows eligible passages, partial-text limits and cost.
Only **Index agreement · paid** dispatches embeddings using the Settings key.
**Search semantic · paid** separately embeds the query. Keyword remains default
and free. Neither mode generates a cross-contract answer; top-ranked semantic
passages can be irrelevant, and unindexed documents are not negative matches.

This version uses one local backend process. Do not enable multiple Uvicorn
workers: index/deletion serialization uses in-process locks alongside Mongo
conditional writes. Reloading the backend during indexing may leave an
interrupted/unknown attempt; refresh status and explicitly preview a new attempt
only if another possible charge is acceptable. Missing/stale indexes are excluded
until rebuilt. Index-only removal is unpaid and keeps the original/saved work.
An indexing failure disables that generation; older derived vectors are not
silently used as a fallback. Removal cleans all generations for that document.

No new database or legacy migration is needed. The Library Qdrant collection is
namespaced from the existing database binding and created only on explicit
indexing. It must be included with the existing storage in backups. Current
bounds are 100 examined documents, 512 canonical passages per indexed document,
8,192 tokens per embedding input and 200,000 per request; oversized sources are
refused, never truncated. Index request IDs remain fenced for up to 100 attempts
per document; query receipts remain private in the existing Mongo database.

Focused checks from `backend` (no provider calls):

~~~bash
TIKTOKEN_CACHE_DIR=.local-only/tokenizers venv/bin/python -c "import tiktoken; [tiktoken.get_encoding(name) for name in ('o200k_base', 'cl100k_base')]"
TIKTOKEN_CACHE_DIR=.local-only/tokenizers venv/bin/python -m pytest tests/test_library_semantic.py tests/test_rate_limiter.py -q
TIKTOKEN_CACHE_DIR=.local-only/tokenizers venv/bin/python -m tests.manual_library_semantic_smoke --run-isolated-live
~~~

The last command requires already-running development MongoDB/Qdrant. It creates
verified-absent, uniquely named fixture stores, guards cleanup ownership and
reports leftovers. Real original-PDF/GridFS storage, index publication, duplicate
fencing, Qdrant workspace scope, query receipts and document deletion run with
deterministic stub embeddings and real OpenAI constructors prohibited. It never
indexes the user's library or reads its credential. This validates mechanics,
not semantic quality; the separate live comparison supplies that bounded evidence.
Use the repository-pinned Qdrant client/server pair described above.

### Bounded live semantic runtime smoke

`evaluations.library_semantic_live` exercises the actual indexing/search services
with real embeddings and real isolated MongoDB/GridFS/Qdrant storage. It uses
only the two-page service terms and 25-page managed-services fixtures and four
fixed, already inspected development questions. It does not generate answers or
measure fresh holdout performance. It calls services directly, not browser UI or
HTTP route latency. The normal unpaid smoke above remains separate.

From `backend`, after tokenizer preflight:

~~~bash
venv/bin/python -m pytest tests/test_library_semantic_live.py -q
TIKTOKEN_CACHE_DIR=.local-only/tokenizers venv/bin/python -m evaluations.library_semantic_live
# Only with a reviewed plan, current pricing and an approved finite total budget:
TIKTOKEN_CACHE_DIR=.local-only/tokenizers venv/bin/python -m evaluations.library_semantic_live --run-paid --cap-usd APPROVED_CAP --approved-plan DIGEST_FROM_DRY_RUN
~~~

Default dry run checks source hashes, existing relevance anchors, extraction,
passage eligibility and tokenizer limits without storage/key access. Paid mode
reserves six maximum product request ceilings before reading the existing Settings
key, then runs two index calls and four queries serially. No key is copied into
the disposable fixture store. Stop on a failed/unknown call; never automatically
retry, switch models or reclaim an uncertain reservation. Pricing approval expires
after seven days and the official endpoint is enforced.

An exclusive private directory under `.local-only/semantic-runtime` holds the
code/source/input manifest, fsynced request ledger and report. Existing output for
the same plan refuses another dispatch. Do not delete it to bypass an uncertain
run. Only uniquely named, verified-owned fixture stores are cleaned; the cleanup
event records leftovers requiring explicit recovery. The person's library,
saved work, vector collection and credential state remain unchanged.

### Retrieval comparison experiment

This is a development command, not a new Library search mode. It uses only the
seven allowlisted repository PDFs, the 24-question development set and a frozen
20-question new-family holdout. Existing application data and Qdrant stay intact.
After the recorded first comparison, both question sets are inspected regression
data for subsequent changes, not an untouched holdout.
From `backend`, prepare the public tokenizer vocabulary once, then run offline:

~~~bash
TIKTOKEN_CACHE_DIR=.local-only/tokenizers venv/bin/python -c 'import tiktoken; tiktoken.get_encoding("cl100k_base")'
TIKTOKEN_CACHE_DIR=.local-only/tokenizers venv/bin/python -m evaluations.retrieval_embeddings
TIKTOKEN_CACHE_DIR=.local-only/tokenizers venv/bin/python -m pytest tests/test_retrieval_comparison.py -q
~~~

The default command validates PDF/split hashes, exact labels and token limits,
then prints a plan digest, input counts, pricing date, estimate and conservative
reservation. It reads no key and makes no paid call. Tokenizer failure stops
preflight; do not substitute a character-count guess. The public vocabulary
download is not an embedding request. CI already prepares this tokenizer.

Only after a current finite-budget approval and pricing review:

~~~bash
TIKTOKEN_CACHE_DIR=.local-only/tokenizers venv/bin/python -m evaluations.retrieval_embeddings --run-paid --cap-usd APPROVED_CAP --approved-plan DIGEST_FROM_DRY_RUN
TIKTOKEN_CACHE_DIR=.local-only/tokenizers venv/bin/python -m evaluations.retrieval_embeddings --replay
~~~

The runner batches 203 passage inputs in groups of at most 32 and sends the
44 queries individually for query-latency measurement: 51 serial requests total.
It uses `text-embedding-3-small`, 1536 dimensions, the official endpoint and zero
SDK retries. All per-input 8192-token maximums are reserved before saved-key
access. The price review expires after seven days. A unique plan directory under
the repository's ignored `.local-only/retrieval-comparison` is created exclusively;
an existing attempt refuses another dispatch, even if interrupted or failed.
There is no automatic resumption, retry, model switch or paid grading call.
Keep the attempt ledger and full reservation for uncertain outcomes. To repeat
an experiment, obtain new approval and deliberately design a new version; do not
delete a failed ledger to get around this guard.

A complete cache requires all vectors, valid source/config/code fingerprints,
provider usage, and a completed ledger. Corruption, missing/stale vectors or
unknown usage fail closed. `--replay` prints all three rankers' per-case/category
results without contacting a provider. Raw caches, reports and attempt logs stay
ignored; publish reviewed aggregate results and failures with their dataset and
implementation versions. Mocked contract tests do not establish dense/hybrid
retrieval quality. The comparison and product-index limits are in
[Evaluation](EVALUATION.md#densehybrid-comparison). The
[first recorded comparison](evaluations/LIBRARY_RETRIEVAL_V1.md) includes real
embedding usage, all three methods' results and observed regressions. Replaying
an existing complete cache is unpaid; reproducing without it requires new
embedding calls. Do not mix those measurements with fake-vector unit tests.

### Offline retrieval refinement

The follow-up ablates repeated page-header eligibility and document diversity
over the original real embedding cache. It never calls a provider, reads a saved
key or writes an application index. Run from `backend`:

~~~bash
TIKTOKEN_CACHE_DIR=.local-only/tokenizers venv/bin/python -m pytest tests/test_retrieval_refinement.py -q
TIKTOKEN_CACHE_DIR=.local-only/tokenizers venv/bin/python -m evaluations.retrieval_refinement
~~~

The second command prints the report. Optional `--output` writes an exclusive
file only under the repository's ignored `.local-only/retrieval-comparison`;
it refuses to overwrite an earlier result. Missing or incompatible original
cache fails closed and never triggers fresh embedding calls. This requires the
same tokenizer preflight as the baseline. Reproduction without the private cache
requires a separately approved embedding collection, not a fake-vector substitute.

The baseline validator remains intact, including the producer code, inputs,
source hashes, labels and request accounting. The new consumer records separate
code and cache fingerprints. Both inspected question sets are regression data;
new adversarial unit tests test mechanics, not unseen semantic quality. See the
[refinement result and rejected diversity default](evaluations/LIBRARY_RETRIEVAL_REFINEMENT.md).
No product search mode or source passage is changed by this command.

## Existing local installations

### Model defaults and bounded requests

Workspace Settings selects the review model and an optional separate chat query
preparation model. Without a saved review choice, OPENAI_DEFAULT_MODEL can
override the catalog default (gpt-6-sol). The catalog offers GPT-6 Luna, Sol and
Astra only. Query preparation also defaults to Sol. Retired GPT-5, Mini, Nano
and GPT-5.6 Luna/Terra/Sol selections/default overrides resolve to Sol/medium
without rewriting saved run attribution. Other saved choices take precedence over the
environment default. Unknown IDs produce an explicit error, not a fallback.

Provider limits/prices are maintained in backend/ai_models/models.py and checked
against the [official model catalog](https://developers.openai.com/api/docs/models).
GPT-6 Luna and Sol support none/low/medium/high/xhigh/max; Astra supports
low/medium/high/xhigh/max. Settings saves the review model and reasoning effort
together; medium is the default. The selected effort applies to reviews, Ask,
earlier analysis, summaries, rewrites and chat answers. Query preparation remains
separate at low effort. The displayed model and effort are checked before new
review/Ask dispatch; stale selections are rejected without a provider request.
Existing and in-flight results keep the original settings snapshot. High effort
does not enlarge token/time limits or guarantee complete output.

Settings persistence can be checked without touching the application library:

~~~bash
cd backend
venv/bin/python -m pytest tests/test_model_registry.py tests/test_model_settings.py -q
venv/bin/python tests/manual_model_settings_smoke.py --run-isolated-live
~~~

The opt-in smoke uses a verified-absent random localhost MongoDB database and
removes it afterward. It checks retired-choice resolution, paired persistence,
invalid-pair rejection, reconnect reads and unchanged synthetic history/credential
state, without an API key or provider request.

Task completion budgets include reasoning and visible answer tokens. Override
these in the backend environment or backend/.env as needed:

| Setting | Default |
| --- | --- |
| AI_MAX_INPUT_TOKENS | 100000 |
| AI_CLASSIFICATION_MAX_COMPLETION_TOKENS | 1024 |
| AI_EXTRACTION_MAX_COMPLETION_TOKENS | 16000 |
| AI_REVIEW_MAX_COMPLETION_TOKENS | 16000 |
| AI_REVIEW_TIMEOUT_SECONDS | 120 (maximum 180) |
| AI_REVIEW_ASK_TIMEOUT_SECONDS | 120 (maximum 180) |
| REVIEW_ASK_MAX_STORAGE_BYTES | 2097152 (maximum 8388608) |
| AI_SUMMARY_MAX_COMPLETION_TOKENS | 4000 |
| AI_REWRITE_MAX_COMPLETION_TOKENS | 6000 |
| AI_QUERY_GATE_MAX_COMPLETION_TOKENS | 1024 |
| AI_QUERY_REWRITE_MAX_COMPLETION_TOKENS | 2048 |
| AI_CHAT_MAX_COMPLETION_TOKENS | 4000 |

The input cap applies to the complete estimated message input, not just document
text; a 2,048-token capacity margin is also reserved. Completion settings clamp
to the model's output maximum. Invalid budgets fail visibly. These are per-call
limits, not an account-level monetary cap. The legacy analysis makes multiple calls;
the new source-backed review makes one strict-schema call, with schema overhead
included in its input guard. Its SDK retries are disabled and its total provider
wait is bounded by AI_REVIEW_TIMEOUT_SECONDS, including connection time.
Oversized prompts are rejected, not silently truncated. Partial-output failures
do not trigger an automatic larger or more expensive retry.

Finding-scoped Ask uses AI_CHAT_MAX_COMPLETION_TOKENS and the selected review
model and reasoning effort saved in Settings. Its complete source/context/history and output
schema count against AI_MAX_INPUT_TOKENS. AI_REVIEW_ASK_TIMEOUT_SECONDS bounds the
whole provider wait; SDK retries are disabled. A fresh question can deliberately
exclude conversation history while keeping the source and original review brief.
At most six recent usable same-finding answers enter a request; the UI and stored
history provenance disclose this boundary.

Ask saves at most 100 attempts per document. Each resolved answer/limitations
envelope is limited to 256 KiB; REVIEW_ASK_MAX_STORAGE_BYTES bounds the BSON Ask
history (default 2 MiB, capped at 8 MiB). Preflight reserves result/metadata
headroom and refuses documents projected beyond 12 MiB rather than approaching
MongoDB's document limit. Previous work is never removed to make room. These are
local capacity guards, not a guarantee of model accuracy or an account spending cap.

The existing OpenAI Python SDK remains pinned: deterministic tests exercise its
actual Chat Completions serialization through a local mock transport for every
supported ID. This is request compatibility coverage, not a live provider-access
or output-quality guarantee. tiktoken may download its public tokenizer vocabulary
on first use; it is cached locally and contains no document or credential data.

Paid evaluation is separate: agree on models, synthetic/public fixtures, a finite
spending ceiling and stop conditions before making calls. Record correctness,
grounding, latency and actual usage—not just a successful HTTP response. Do not
paste keys into test files or use confidential agreements as evaluation fixtures.

A separately authorized, single-call check is available in
backend/tests/manual_review_generation_check.py (run from backend). It is fixed
to GPT-6 Sol and accepts only the source-reviewed cases in
backend/fixtures/review_evaluations. Use --case managed-services-25p (the default)
for cross-page commercial/exit provisions or --case service-terms-conflict for
the contrasting two-page payment-deadline conflict and delivery table. The harness
verifies each PDF hash, page count and authored source anchors. It sends only the
case's brief and normal extracted source to the model, never expected answers or
assessment criteria. It reads the key through the normal credential service and
leaves the application library/Settings unchanged.

No paid call is part of ordinary tests. Obtain approval and recheck official
pricing and remaining approved spend before supplying --run-paid, --cap-usd,
--previous-reserved-usd and a unique --report-name. Caps and prior reservations must
be finite; each invocation permits at most one provider dispatch. There is no
automatic retry, model fallback or second grading call. The local
report reserves a conservative text-request byte/framing bound plus the completion
budget, including applicable long-context and cache-write uplifts, before dispatch.
Only the fixed text-only request shape can use this guard; changed payloads fail
closed. An existing report name refuses another call. Prior spend/reservations must
be supplied explicitly; this is not an automatically reconciled account budget.
Retain the full reservation for uncertain outcomes. Reports remain ignored under
.local-only. Only this allowlisted synthetic diagnostic retains raw response message
content; application generation does not. Reports record case/version/criteria
provenance and leave semantic assessment explicitly unassessed.

Use backend/fixtures/review_evaluations/README.md for the manual assessment method.
Record met/partial/missing/incorrect against source-reviewed criteria, assess each
finding's own supporting passages, and record incorrect claims outside the checklist
too. Check material triggers, scope, deadlines, exceptions and costs together;
evidence elsewhere in the output does not repair unsupported claims in a finding.
Do not require fixed titles, wording or finding counts, and do not substitute
keyword matches for semantic assessment. Source-anchor tests and a ready result
establish provenance/structural acceptance, not a passed quality evaluation.

### Development-only support and coverage checker

The checker is a separate evaluation tool, not part of Start review. It diagnoses
fixed authored synthetic candidates without regenerating or repairing them.
It does not certify legal correctness. The ten cases include six negative
mutations and four positive controls; their reference labels never enter the
model request. See backend/fixtures/review_checks/README.md for calibration rules.

From backend, offline checks and a metadata-only dry run are:

~~~bash
venv/bin/python -m pytest tests/test_review_checker_preparation.py tests/test_review_checker_engine.py tests/test_review_checker_cases.py tests/test_review_checker_guard.py -q
venv/bin/python tests/manual_review_checker.py --case convenience-wrong-finding
venv/bin/python tests/manual_review_checker.py --case acceptance-focused-concise
~~~

Dry runs load only allowlisted synthetic fixtures and print bounded request/binding
metadata. They do not read the saved key, connect to the database/provider or write
reports. No generic document or captured-report path is accepted. The checker
uses Sol with medium reasoning, independent of the saved app model choice.
Earlier Terra evaluation reports remain historical and are not rewritten or
treated as Sol results. The generation harness also uses the fixed Sol model.
AI_REVIEW_MAX_COMPLETION_TOKENS is read for the experiment's output budget but
must not exceed its 16,000-token hard ceiling or fall below its target-inventory
reserve. AI_MAX_INPUT_TOKENS applies to complete input including output schema;
nothing is truncated. Inputs have at most 100 diagnostic targets. Response JSON
is limited to 1,000,000 UTF-8 bytes. AI_REVIEW_CHECK_TIMEOUT_SECONDS defaults to
120 and is clamped at 180 seconds; nonpositive values are rejected.

A live run needs separate approval, current pricing review, --run-paid, a finite
--cap-usd, an unused --report-name and explicit --previous-reserved-usd accounting
for earlier attempts in that budget. Run attempts serially and retain full
reservations for unknown outcomes; this is not an account-wide spending ledger.
The harness reserves the full conservative request ceiling before credential
access, permits one exact request to the official endpoint, disables retries and
refuses reused report names or symlink report paths. There is no fallback or
second grading call. Reports contain parsed diagnostics, usage, versions and
source/candidate/brief bindings; raw provider response text is not retained by
this checker harness. Normal app data and Settings are not written.

Completed is a structural outcome, not a passed quality evaluation. Manually
assess detected issues, misses and false alarms against the unchanged source and
frozen case labels. Record semantic calibration separately; a syntactically valid
report or empty issue list cannot establish checker reliability. The held-out
source is not part of this initial allowlist and has not been calibrated.

### Workspace migration

Back up MongoDB, GridFS and Qdrant before the first workspace-mode startup.
Do not clear volumes or replace an existing .env file to fix a startup issue.

Startup checks ownership across all stores, then adds workspace metadata
without deleting accounts, legacy ownership fields, original ciphertext or
document relationships. A migration marker makes interrupted runs restartable.
Inherited automatic deletion is disabled; re-enable it only deliberately in
Settings. Legacy document-count settings are no longer enforced.

Multiple old accounts, missing ownership or conflicting data stop startup
rather than silently merging libraries. Select/import the intended data into
a separate local installation with an explicit migration plan; there is no
automatic account-selection or destructive reset command.

A single legacy key can be re-encrypted if the old API_KEY_ENCRYPTION_SECRET
(or its old JWT_SECRET_KEY fallback) remains available in the backend environment
or its existing .env. These values are used only for legacy decryption, not
new account functionality. If unavailable, Settings shows that key re-entry is
needed; document access is unaffected and the original ciphertext is preserved.

## Credential state and backups

The first key save creates backend/.local-only/workspace/credential.key with
owner-only permissions. WORKSPACE_STATE_DIR overrides the directory, relative
to backend unless absolute. This is ignored runtime data, not source.

Back up the database and credential directory together. Full Compose uses the
backend_credentials volume instead. Host development and full Compose use
different data/credential volumes; switching workflows is not a data migration.
A missing key file requires restoration or explicit key re-entry, never a reset
of the document library.

## Troubleshooting

- Database/vector startup failure: check Docker and both development services.
- Migration refusal: preserve data, read the ownership error and plan an explicit
  import. Repeated restarts cannot resolve ambiguous ownership.
- Key not usable: re-enter it in Settings, or restore the matching credential
  state. Saving does not validate OpenAI balance/model access.
- Local-access denial: use localhost, the configured frontend port and the
  X-ClauseIQ-Local: 1 request header; do not broaden CORS to external origins.
- Frontend API failure: NEXT_PUBLIC_API_URL defaults to http://localhost:8000.
  Restart frontend development after changing public environment values.
- Type-check errors referring to removed routes after switching revisions:
  regenerate Next.js types with a fresh frontend build.

See ../DOCKER.md for container smoke testing. Hosted deployment is unsupported.
