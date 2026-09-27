# Backend tests

The default Pytest suite covers configuration, domain models, local access,
credential privacy, migration, storage scoping and mocked review workflows.
It is deterministic and must not call live AI services.

Model tests also cover the canonical catalog, token-budget overrides, selected
models across all generation operations, safe output/error handling, generation
attribution and the installed SDK's request serialization through a mock HTTP
transport. They do not validate live account access, pricing invoices or AI quality.

Run it from the repository root:

~~~bash
npm run test:backend
~~~

Or run it directly:

~~~bash
cd backend
venv/bin/python -m pytest tests -v
~~~

Add focused tests when changing local request boundaries, workspace and document
scoping, BYOK handling, deletion, or API response contracts. Do not hard-code a test
count in this file because it becomes stale as the suite evolves.

CI also runs critical Ruff rules across the backend, strict mypy in the explicitly
declared domain/helper subset, and branch-coverage reporting. These optional tools
live in requirements-dev.txt; scope and commands are in docs/DEVELOPMENT.md.
Neither coverage nor a structurally valid source reference measures AI quality.

tests/test_pdf_fixtures.py checks the public synthetic PDFs in
../tests/fixtures/pdfs (relative to the backend directory): deterministic bytes,
metadata, page/text expectations and the real local extractor, including image-only
rejection. These are ingestion fixtures, not evidence of legal or AI-review quality.
See the fixture README for regeneration. Use focused tests during routine work;
broader manual UI runs and full builds are checkpoint work (see the repository's
docs/DEVELOPMENT.md).

## Optional live storage smoke

With the development MongoDB and Qdrant services already running, this manual
check creates uniquely named, isolated fixture stores, exercises the real
migration and deletion services, and removes only those fixture stores afterward:

~~~bash
cd backend
venv/bin/python tests/manual_workspace_smoke.py --run-isolated-live
~~~

It does not modify the application's library, settings, credentials, or .env
files, and makes no OpenAI calls. It is excluded from normal Pytest discovery.
Review the final cleanup report; a failed cleanup names any remaining fixture.

The Library semantic lifecycle has a separate real-storage smoke with stub
embeddings (no provider calls):

~~~bash
cd backend
TIKTOKEN_CACHE_DIR=.local-only/tokenizers venv/bin/python -m tests.manual_library_semantic_smoke --run-isolated-live
~~~

It covers actual Mongo conditional publication/query receipts, Qdrant source
scope, duplicate-attempt fencing and original-PDF/derived-index deletion in
owned disposable stores. Source/Settings data in the real workspace is untouched.
See the tokenizer preflight and version requirements in docs/DEVELOPMENT.md.

`test_library_semantic_live.py` validates the separate opt-in live harness without
paid calls: fixed source/case plans, budget/endpoint/price-age checks, exclusive
outputs, stop-on-failure dispatch, reservation retention and own-source scoring.
The live command and recorded result are described in docs/DEVELOPMENT.md and
docs/evaluations/LIBRARY_SEMANTIC_RUNTIME_V1.md; normal Pytest never enables it.

## Qdrant version compatibility

`test_qdrant_configuration.py` checks optional-key handling and SDK HTTP request
construction. `test_qdrant_version_contract.py` guards the declared client/server
pair, used SDK interfaces and disposable-container safety boundaries.

The Qdrant-only smoke uses a separate, owned Docker container, tmpfs storage and
an automatically selected loopback port. It does not require MongoDB or access
existing application data. Install the declared Python dependencies first; pull
the exact image explicitly, then opt in from the repository root:

~~~bash
docker pull qdrant/qdrant:v1.16.3
cd backend
venv/bin/python tests/manual_qdrant_smoke.py --run-isolated-live
~~~

Without the flag it only describes the check. It never pulls implicitly or runs
Compose. `--server-version 1.16.2` tests the earlier same-minor server in another
disposable container if its exact image is cached; `--image` can select a cached
official-image digest, whose running version is checked before use.

The real application service stores and queries deterministic 3,072-dimensional
synthetic vectors, checks document/workspace scoping and deletion, and exercises
paginated scroll plus additive payload/index operations used by migration.
Provider access is forbidden and SDK version checking stays enabled. Cleanup
removes only the owned container and its temporary contents; the report checks
that existing services and named volumes were preserved. This is client/API
compatibility coverage, not an existing-store upgrade or full migration rehearsal.

## Source-foundation checks

test_source_extraction.py exercises page inventories, exact line spans, stable
versioned identities and partial/unavailable/malformed cases using the existing
synthetic corpus. test_source_import.py checks local-only import, original-first
persistence, extraction retry, source identity and stale-result fencing.
test_source_storage.py covers actual adapter contracts and uncertain GridFS pointer
writes. test_source_analysis.py checks source-before-generation, partial-input
refusal and preservation after provider/save failures. test_source_error_responses.py
checks that the application's error standardization retains recovery references.

A smaller real MongoDB/GridFS check is available without Qdrant:

~~~bash
cd backend
venv/bin/python tests/manual_source_smoke.py --run-isolated-live
~~~

It verifies persistence through new connections, exact PDF bytes/page data,
same-record retries, concurrent/stale claims and unrelated fixture preservation.
It creates only its own verified-absent fixture database and removes that database
in finally. Application library/settings/credentials are not read; no provider or
vector client may be requested. Inspect the cleanup report for leftovers.

## Review workspace persistence

test_review_workspace.py covers key-free GET/PUT/fixture routes, revision conflicts,
immutable source/context runs, independent draft and explicitly saved wording,
markers, resume, exact fixture evidence and privacy/scoping failures.

~~~bash
cd backend
venv/bin/python -m pytest tests/test_review_workspace.py tests/test_review_generation_lifecycle.py tests/test_review_generation.py tests/test_review_run_contract.py -q
venv/bin/python tests/manual_review_workspace_smoke.py --run-isolated-live
~~~

The opt-in smoke imports only the reviewed synthetic PDF into a verified-absent
temporary MongoDB/GridFS database. A fresh connection must restore personal work;
real competing writes must have one winner. Scoped deletion removes nested review
state without affecting unrelated synthetic records. Only its exact owned database
is removed in cleanup. The application's library/settings/keys are never read or
changed; real provider and vector clients are forbidden. The generation lifecycle
uses a mocked engine/client with real conditional storage, including claim/replay,
restart-visible interruption and late-result fencing after deletion. Inspect the
cleanup report.

## Source-backed AI review contracts

test_review_generation.py covers the versioned prompt and strict output contract,
full-source/schema input budgeting, unsupported/partial input, exact source
references (supplied passage IDs resolved to exact stored source ranges),
refusal/length handling and usage attribution. It uses the installed
SDK with a local HTTP mock to verify request serialization and disabled retries.
test_review_generation_lifecycle.py checks claim-before-call, same-ID replay,
concurrent edits, interruption, uncertain writes, source/deletion fencing and safe
HTTP errors. test_review_run_contract.py rejects inconsistent persisted states.
None of these tests validates live legal interpretation or spends API credit.

manual_review_generation_check.py is excluded from Pytest. It requires separate
paid-call approval and explicit flags, uses GPT-6 Sol with a known synthetic fixture,
reserves a conservative request ceiling plus explicitly supplied prior reservations,
and refuses a reused report name. See docs/DEVELOPMENT.md for the fixed text-only
bound and manual accounting boundary; it does not read account billing.

## Finding-scoped Ask

test_review_ask_contract.py checks independent Ask drafts, strict explicit-send
requests, backwards-compatible defaults and persisted attempt invariants.
test_review_ask.py checks full-source/context/history preparation, strict answer
shape, exact evidence, input/output limits, refusals, timeout and retained usage
with no automatic retry. test_review_ask_lifecycle.py checks scoped processing
claims, payload-bound replay, concurrent personal edits, interruption, storage
headroom and source/run/deletion fencing. Frontend tests cover explicit send,
separate draft recovery, uncertain outcomes and answer-source navigation.

~~~bash
cd backend
venv/bin/python -m pytest tests/test_review_ask_contract.py tests/test_review_ask.py tests/test_review_ask_lifecycle.py -q
venv/bin/python tests/manual_review_ask_smoke.py --run-isolated-live
~~~

The manual smoke uses existing local MongoDB and only its own verified-absent
synthetic database/GridFS files. It restores answers through a fresh connection,
checks concurrency and unknown/interrupted outcomes, and verifies scoped deletion.
Credentials/provider calls are mocked and application data is never read. Inspect
its final cleanup report. None of these checks establishes real answer quality.

The smoke also verifies new inline citation mappings through MongoDB readback and
leaves historical unmapped answer text unchanged. --mongo-port selects a separate
loopback test service. The real-stack CI harness runs it against its own disposable
MongoDB, then exercises import, saved questions and PDF-page navigation through
the actual browser/API. See docs/DEVELOPMENT.md for the guarded runner and cleanup
boundaries; the existing mocked-API browser journeys remain a separate suite.

## Development-only checker contracts

The test_review_checker_preparation, test_review_checker_engine,
test_review_checker_cases and test_review_checker_guard suites cover exact
source/candidate binding, full-source preparation, bounded target inventory,
strict diagnostic schemas, Unicode excerpt references, parser/provider failures,
one-dispatch budget safeguards and the separation of calibration labels from
model input. Provider tests use local mocks and never spend API credit.
Production imports are checked to keep this tooling outside application routes
and services. These tests do not establish semantic checker quality.

manual_review_checker.py is excluded from Pytest. Unlike the generation harness,
it defaults to a no-key/no-network/no-report dry run and sends an authored
candidate only when explicitly invoked with approved paid flags. It never
regenerates that candidate or retains raw provider output. See
docs/DEVELOPMENT.md for commands, ceilings and manual spend accounting, and
backend/fixtures/review_checks/README.md for the frozen calibration corpus.
