# Security

ClauseIQ handles confidential documents and personal AI credentials. It supports
one person on their own computer, not a shared or hosted installation.

## Trust boundary

- There are no accounts or passwords. Access to the local OS session is access
  to this workspace.
- Application and database ports bind to loopback in the provided workflows.
  Do not expose them through LAN bindings, reverse proxies or public tunnels.
- The API accepts only loopback Host names and exact permitted browser Origins.
  Every workspace request requires X-ClauseIQ-Local: 1, forcing cross-origin
  browser requests through an allowlisted CORS preflight.
- This header is not a secret and does not authenticate a native process.
  Other programs running on the computer are trusted. These safeguards do not
  protect against malware, a compromised local frontend, browser extensions,
  or another person with access to the same OS session.
- CORS configuration permits only exact loopback origins. Staging and production
  backend modes are rejected; they are not an authentication bypass.
- Document, file, note, chat, report and vector operations preserve document and
  workspace scoping. A caller cannot select a different workspace.

Minimal liveness and generated API documentation do not expose workspace content.
Application API responses are not browser-cacheable. Admin database/log and AI
debug routes have been removed.

The in-memory rate limiter keeps independent per-client operation buckets:
60 default requests, 10 local PDF uploads/imports and 20 AI requests per minute.
Review generation, finding Ask, semantic indexing/search, legacy analysis/rewrite and chat messages share
the AI bucket across all documents; changing a document or request ID does not
reset it. Reads, personal edits, fixtures and recovery/interruption use the
default bucket and do not consume upload or AI capacity. These process-local
limits are safeguards, not an authentication boundary or an API spending cap.

## Credentials

Enter an OpenAI key in Settings. The browser sends it only to the local backend
for storage; it is not retained in browser storage or returned by the API.
AI calls use request-scoped clients, which are closed after each request.
There is no fallback to an application-owner OPENAI_API_KEY environment value.

API keys are encrypted in MongoDB using a randomly generated local Fernet key.
The key file defaults to backend/.local-only/workspace/credential.key and uses
owner-only file permissions. WORKSPACE_STATE_DIR can change its directory;
relative paths resolve from the backend directory. Full Compose persists it in
the backend_credentials volume.

The same private state directory stores `database-binding.json`, containing only
the database name and collection prefix. Startup refuses mismatches before
migration or cleanup; this protects against accidental workspace switching, not
against a different MongoDB server using the same names. Keep the binding and
credential state with the matching database backup.

Protect both the database and credential directory. Encryption protects a
database-only copy, not someone who can read both stores. Back up them together;
if the key file is lost, restore it or explicitly re-enter the OpenAI key.
Deleting the key in Settings disables future requests but does not revoke it
at OpenAI or cancel a request already in progress.

Legacy encrypted keys are imported only for an unambiguous single-owner
installation. Old account rows and ciphertext remain local for recovery and
are not reachable through account APIs. Removing a workspace key never
automatically reimports it on restart. See DEVELOPMENT.md for migration.

## Data and retention

Documents do not expire by default. Automatic deletion is an explicit Settings
choice and can permanently remove documents already older than the selected
period on the next cleanup run. Treat MongoDB, GridFS, vectors, logs and backups
as sensitive. AI requests send relevant document content to OpenAI; local
storage does not imply offline processing.

Library Keyword search reads current source extractions locally. It needs
no key or provider call, and its terms are sent in a POST body rather than URLs
or browser history. The API response contains verbatim document excerpts, so it
remains sensitive workspace data even though the search itself is unpaid.

Semantic indexing separately sends eligible extracted agreement passages to
OpenAI after an in-app preview/confirmation; each semantic submit sends its query.
Neither import nor navigation does this. It uses the Settings key, with no SDK
retry. An interrupted request may still incur a charge. Embeddings are sensitive
derived data even though Qdrant payloads contain only source identity, not text.
The collection is separate from legacy chat vectors and scoped to the bound
database, workspace, document and index generation. Source fingerprints and
current-generation checks prevent stale vectors from being presented as current.
Index removal preserves originals/saved work; document deletion verifies derived
vector cleanup. Query receipts persist a hash and safe outcome/usage metadata,
not the query text; treat these receipts as private workspace data too.

My review brief copies/downloads contain selected saved questions, personal markers
and finding context. They do not call a provider, but the resulting clipboard/file
is outside ClauseIQ's storage protections and may be handled by other local apps
or OS sync. Review it before sharing. Literal Markdown preserves supplied wording
without introducing active images, links or HTML; it is not a sanitized legal opinion.

Never commit credentials, real contracts, exports, local state or logs. The tracked
document/capture exceptions are the reviewed synthetic test corpus and reviewed
synthetic product screenshots described in REPOSITORY_POLICY.md; neither may
contain private source documents or a real user's workspace state. Rotate a
credential if exposed; removing a file or Git commit is not enough.

## Known limitations

- The repository has deterministic CI and a history secret scan, not a complete
  security audit or supported production environment. These checks do not establish
  that dependencies or arbitrary documents are safe.
- PDF rendering uses pinned Mozilla PDF.js 6.3.289, replacing React PDF Viewer
  and its vulnerable PDF.js 3 dependency. `isEvalSupported: false` remains defense
  in depth; PDF scripting and editing are disabled. Source documents are still
  untrusted input, not safe simply because one historical advisory was removed.
  Worker, fonts, character maps, image/colour decoders and annotation assets are
  served from the same origin, version-matched to the installed library. No PDF
  content or credential is sent to a viewer CDN. Review dependency audits on
  subsequent upgrades. See the [Mozilla advisory](https://github.com/mozilla/pdf.js/security/advisories/GHSA-wgrm-67xf-hhpq).
- Review workspace fixtures are authored synthetic examples, restricted to the
  exact reviewed PDF hash. They are not generated results or evidence of model
  quality. Source content and editable personal work are rendered as text, never
  trusted HTML. All new persistence routes retain the local boundary and scoped
  conditional writes; stale requests cannot silently overwrite newer work.
- New AI review generation is an explicit, local-boundary-protected paid action.
  It sends extracted source text and the saved brief using a request-scoped personal
  key. Document content is untrusted prompt input, never executable instructions;
  no external tools or research are available to this review call. Structured output
  and source-ID checks reduce format/reference failures but cannot guarantee
  resistance to prompt injection or correct legal interpretation. New generation
  returns only supplied passage IDs and relevance labels; the server resolves them
  to exact original text and anchors from the prepared source snapshot. Unknown
  IDs or duplicate IDs in an evidence list are rejected. Provider-authored
  quotations and page numbers are not accepted as evidence. There is no fuzzy
  matching or whitespace/case correction. This validates location, not claim support.
  A persisted request ID prevents automatic duplicate generation on replay; provider
  retries are disabled. An interrupted/lost response can still incur a charge.
  Marking an attempt interrupted fences local output but does not cancel OpenAI.
- Finding-scoped Ask uses the same local boundary and request-scoped personal key.
  Only an explicit send contacts the provider; Ask draft autosaves and saved-answer
  reads are key-free. Source, run/finding identity and the original review context
  are server-selected. Generated findings/history remain untrusted context, not
  authoritative contract text. No external tools or autonomous actions are exposed.
  Exact answer references do not establish semantic correctness. Ask request IDs
  are persisted before dispatch, automatic retries are disabled, and interruption
  or source deletion fences late results without promising cancellation/refunds.
  Per-result/history/storage bounds and document headroom checks reject excessive
  growth. Ask content and raw provider failures must not enter runtime logs.
- Multi-store migration/deletion is restartable but not a distributed transaction.
  Back up legacy data before migration and investigate reported cleanup errors.
- Future agent tools require their own threat model, allowlists, resource limits
  and human confirmation for external side effects.

## Reporting

Do not disclose vulnerabilities, document content or credentials in public issues.
Use GitHub's private vulnerability reporting only if the repository's Security tab
offers it; this project does not assume that feature is enabled. Otherwise contact
the repository owner privately to agree on a safe reporting channel before sharing
sensitive details.
