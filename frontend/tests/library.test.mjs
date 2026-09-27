import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

function loadModule(path, imports = {}) {
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, React,
    fetch() { assert.fail("Library rendering must not issue requests"); },
    require(name) { assert.ok(name in imports, `Unexpected dependency: ${name}`); return imports[name]; },
  });
  return exports;
}

const sourceStatus = loadModule("../src/lib/sourceStatus.ts");
const state = loadModule("../src/components/documents/libraryState.ts", { "@/lib/sourceStatus": sourceStatus });
const workspaceState = loadModule("../src/components/workspace/workspaceState.ts");
const documentUtils = loadModule("../src/utils/documentUtils.ts", { react: React });
const icon = props => React.createElement("svg", props);
const Link = ({ children, ...props }) => React.createElement("a", props, children);
const { LibraryContent, AgreementInspector, ContinueReviewing } = loadModule("../src/components/documents/LibraryContent.tsx", {
  react: React, "next/link": Link, "./libraryState": state, "@/utils/documentUtils": documentUtils,
  "@/lib/sourceStatus": sourceStatus,
  "@/components/ui/Modal": ({ isOpen, children }) => isOpen ? React.createElement("div", { role: "dialog" }, children) : null,
  "./Library.module.css": { library: "library", detailsPanel: "details-panel" },
  "lucide-react": { ArrowRight: icon, FileText: icon, RefreshCw: icon, Search: icon, Trash2: icon, Upload: icon },
});

const summary = (overrides = {}) => ({ kind: "ai", status: "ready", saved_question_count: 1,
  last_activity_at: "2026-09-19T12:00:00Z", can_resume: true, ...overrides });
const document = (id, overrides = {}) => ({ id, filename: `Agreement ${id}.pdf`,
  upload_date: "2026-09-18T12:00:00Z", page_count: 12, source_revision_id: `source-${id}`,
  source_status: "stored", extraction_status: "ready", analysis_status: "not_started",
  review_summary: summary(), ...overrides });
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props));

function contentProps(overrides = {}) {
  const calls = [];
  const callback = name => (...args) => calls.push([name, ...args]);
  const documents = overrides.documents || [document("one"), document("two")];
  return { calls, props: {
    documents, filteredDocuments: documents, loading: false, error: null,
    selectedId: documents[0]?.id || "", searchQuery: "", searchInputRef: { current: null },
    sortBy: "newest", contractType: "", contractTypes: ["service_agreement"],
    isSelectMode: false, selectedDocuments: new Set(), busy: false,
    onRetry: callback("retry"), onSelect: callback("select"), onSearch: callback("search"),
    onSort: callback("sort"), onContractType: callback("type"),
    onToggleSelectMode: callback("toggle-mode"), onToggleSelection: callback("toggle-selection"),
    onSelectAll: callback("select-all"), onClearSelection: callback("clear-selection"),
    onDeleteSelected: callback("delete-selected"), onDeleteAll: callback("delete-all"),
    onDelete: callback("delete"), ...overrides,
  } };
}

// Resolve only these stateless view components to inspect their explicit handlers.
// This is not a browser/focus/layout test.
function nodes(node) {
  if (!React.isValidElement(node)) return [];
  const children = typeof node.type === "function"
    ? [node.type(node.props)] : React.Children.toArray(node.props.children);
  return [node, ...children.flatMap(nodes)];
}
function text(node) {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node !== "object") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  return text(node.props?.children);
}
function button(tree, label) {
  const found = nodes(tree).find(node => node.type === "button" && text(node) === label);
  assert.ok(found, `Missing button: ${label}`);
  return found;
}

test("continue reviewing chooses latest eligible persisted activity without mutating inventory", () => {
  const older = document("older", { review_summary: summary({ last_activity_at: "2026-09-18T14:00:00Z" }) });
  const newer = document("newer", { review_summary: summary({ status: "incomplete", last_activity_at: "2026-09-19T12:00:00Z" }) });
  const ignored = document("failed", { review_summary: summary({ status: "failed", last_activity_at: "2026-09-20T12:00:00Z" }) });
  const inventory = [older, ignored, newer];
  assert.equal(state.continuingDocument(inventory), newer);
  assert.deepEqual(inventory, [older, ignored, newer]);
});

test("resume ordering treats naive backend timestamps as UTC and retains explicit offsets", () => {
  const naive = document("naive", { review_summary: summary({ last_activity_at: "2026-09-19T12:00:00" }) });
  const offset = document("offset", { review_summary: summary({ last_activity_at: "2026-09-19T16:00:00+05:30" }) });
  assert.equal(state.continuingDocument([offset, naive]), naive);
  const tied = document("aaa", { review_summary: summary({ last_activity_at: "2026-09-19T12:00:00Z" }) });
  assert.equal(state.continuingDocument([naive, tied]), tied);
});

test("invalid or missing activity dates are deterministic fallbacks, never newer than valid activity", () => {
  const invalid = document("bbb", { review_summary: summary({ last_activity_at: "invalid" }) });
  const missing = document("aaa", { review_summary: summary({ last_activity_at: null }) });
  const valid = document("zzz");
  assert.equal(state.continuingDocument([invalid, missing, valid]), valid);
  assert.equal(state.continuingDocument([invalid, missing]), missing);
  assert.equal(state.libraryDate("invalid"), "Date unavailable");
  assert.equal(state.libraryDate(null), "Date unavailable");
  assert.equal(state.libraryDate(undefined), "Date unavailable");
  assert.equal(state.libraryDate("2026-09-19T12:00:00"), state.libraryDate("2026-09-19T12:00:00Z"));
});

test("unreviewed, unusable, legacy and unresumable records never become a resume shortcut", () => {
  for (const status of ["not_started", "processing", "failed", "interrupted", "unavailable"]) {
    assert.equal(state.continuingDocument([document(status, { review_summary: summary({ status }) })]), null);
  }
  for (const overrides of [{ review_summary: null }, { review_summary: undefined },
    { review_summary: summary({ can_resume: false }) }, { source_revision_id: null },
    { source_status: "storing" }, { source_status: "storage_failed" }]) {
    assert.equal(state.continuingDocument([document("excluded", overrides)]), null);
  }
  assert.equal(state.continuingDocument([]), null);
  assert.equal(render(ContinueReviewing, { document: null }), "");
});

test("destinations encode document identities and only source workspaces accept resume", () => {
  const id = "a/b?x=1&resume=9#section ü";
  const modern = document(id);
  assert.equal(state.documentDestination(modern), `/workspace?documentId=${encodeURIComponent(id)}`);
  assert.equal(state.documentDestination(modern, true), `/workspace?documentId=${encodeURIComponent(id)}&resume=1`);
  const legacy = document(id, { source_revision_id: null });
  assert.equal(state.documentDestination(legacy, true), `/review?documentId=${encodeURIComponent(id)}`);
});

test("duplicate names have stable distinct import identity and modern imports do not invent legacy results", () => {
  const first = document("record-aaaaaa", { filename: "same.pdf" });
  const second = document("record-bbbbbb", { filename: "same.pdf" });
  assert.notEqual(state.duplicateIdentity(first, [first, second]), state.duplicateIdentity(second, [first, second]));
  assert.match(state.duplicateIdentity(first, [first, second]), /Imported.*aaaaaa/);
  assert.equal(state.duplicateIdentity(first, [first]), null);
  assert.doesNotMatch(render(AgreementInspector, { document: first, onDelete() {}, deleting: false }), /Earlier analysis &amp; original/);
  assert.match(render(AgreementInspector, { document: { ...first, analysis_status: "ready" }, onDelete() {}, deleting: false }), /Earlier analysis &amp; original/);
  assert.doesNotMatch(render(LibraryContent, contentProps({ selectedId: "" }).props), /role="dialog"/);
});

test("inspector selection closes after filtering or deletion rather than substituting another record", () => {
  const first = document("first"), second = document("second");
  assert.equal(state.selectedLibraryDocument([first, second], second.id), second);
  assert.equal(state.selectedLibraryDocument([first], second.id), null);
  assert.equal(state.selectedLibraryDocument([second], first.id), null);
  assert.equal(state.selectedLibraryDocument([first, second], "missing"), null);
  assert.equal(state.selectedLibraryDocument([], second.id), null);
});

test("review labels use actual workspace status independently of extraction or legacy analysis", () => {
  for (const [status, kind, expected] of [
    ["ready", "fixture", "Example review"], ["ready", "ai", "AI review available"],
    ["incomplete", "fixture", "Incomplete example"], ["incomplete", "ai", "Incomplete AI review"],
    ["processing", "ai", "Review in progress"], ["failed", "ai", "Review failed"],
    ["interrupted", "ai", "Review interrupted"], ["unavailable", null, "Review state unavailable"],
    ["not_started", null, "Review not started"],
  ]) {
    assert.equal(state.libraryReviewLabel(document("one", {
      extraction_status: "partial", review_summary: summary({ status, kind }),
    })), expected);
  }
  assert.equal(state.libraryReviewLabel(document("one", { review_summary: null })), "Review status unavailable");
  assert.equal(state.libraryReviewLabel(document("legacy", { review_summary: null, analysis_status: "ready" })), "Earlier analysis available");
  assert.equal(state.libraryReviewLabel({ id: "old", filename: "Old.pdf" }), "Earlier analysis available");
});

test("source lifecycle notices remain independent and factual", () => {
  for (const [overrides, expected] of [
    [{ source_status: "storage_failed" }, "Original not saved"], [{ source_status: "storing" }, "Saving original"],
    [{ extraction_status: "partial" }, "Incomplete source text"], [{ extraction_status: "failed" }, "Text extraction failed"],
    [{ extraction_status: "unavailable" }, "No extractable text"], [{ extraction_status: "pending" }, "Preparing source text"],
    [{ extraction_status: "processing" }, "Preparing source text"], [{ extraction_status: "ready" }, null],
  ]) assert.equal(state.sourceNotice(document("one", overrides)), expected);
  assert.equal(state.pageCountLabel(document("one", { page_count: 1 })), "1 page");
  assert.equal(state.pageCountLabel(document("one", { page_count: 25 })), "25 pages");
  for (const count of [null, undefined, 0, -1, 2.5, Number.NaN])
    assert.equal(state.pageCountLabel(document("one", { page_count: count })), "Pages unavailable");
  assert.equal(state.savedQuestionLabel(document("one")), "1 saved question");
  assert.equal(state.savedQuestionLabel(document("one", { review_summary: summary({ saved_question_count: 2 }) })), "2 saved questions");
});

test("authored examples and partial source warnings appear together in the actual Library", () => {
  const fixture = document("fixture", { extraction_status: "partial", review_summary: summary({ kind: "fixture" }) });
  const { props, calls } = contentProps({ documents: [fixture] });
  const html = render(LibraryContent, props);
  assert.match(html, /Example review/);
  assert.match(html, /Synthetic example/);
  assert.match(html, /Incomplete source text/);
  assert.match(html, /Check the original and source state/);
  assert.doesNotMatch(html, /Not yet reviewed|Review not started|AI generated|AI review available/);
  assert.deepEqual(calls, []);
});

test("loading, request error, empty inventory and search-empty are distinct views", () => {
  const loading = render(LibraryContent, contentProps({ loading: true, error: "old error" }).props);
  assert.match(loading, /role="status"/);
  assert.match(loading, /Loading your library/);
  assert.doesNotMatch(loading, /Couldn’t load|Continue reviewing|cl-document-list/);
  const failure = contentProps({ error: "Server unavailable" });
  const error = render(LibraryContent, failure.props);
  assert.match(error, /role="alert"/);
  assert.match(error, /Server unavailable/);
  assert.doesNotMatch(error, /Your first agreement|cl-document-list/);
  button(LibraryContent(failure.props), "Retry").props.onClick();
  assert.deepEqual(failure.calls, [["retry"]]);
  const empty = render(LibraryContent, contentProps({ documents: [] }).props);
  assert.match(empty, /Your first agreement/);
  assert.match(empty, /No API key needed/);
  assert.doesNotMatch(empty, /No matching agreements|Continue reviewing|cl-document-list/);
  const filtered = contentProps({ filteredDocuments: [], searchQuery: "missing", contractType: "nda" });
  const unmatched = render(LibraryContent, filtered.props);
  assert.match(unmatched, /No matching agreements/);
  assert.match(unmatched, /0 of 2 agreements/);
  assert.doesNotMatch(unmatched, /role="dialog"/);
  assert.doesNotMatch(unmatched, /Your first agreement/);
  button(LibraryContent(filtered.props), "Clear filters").props.onClick();
  assert.deepEqual(filtered.calls, [["search", ""], ["type", ""]]);
});

test("Library renders only supplied inventory and no callbacks, keys or paid actions", () => {
  const docs = [document("real-one", { filename: "Stored alpha.pdf" }), document("real-two", { filename: "Stored beta.pdf" })];
  const { props, calls } = contentProps({ documents: docs });
  const html = render(LibraryContent, props);
  assert.equal((html.match(/class="cl-list-item"/g) || []).length, 2);
  assert.equal((html.match(/>Import agreement</g) || []).length, 1);
  assert.match(html, /Stored alpha.pdf/);
  assert.match(html, /Stored beta.pdf/);
  assert.doesNotMatch(html, /managed-services-25p|consulting-5p|Synthetic example|Start review|Send to AI|api.key/i);
  assert.doesNotMatch(html, /Importing and opening files do not run AI|Opening saved work does not run AI/);
  assert.deepEqual(calls, []);
});

test("row selection is distinct from free open and resume links", () => {
  const chosen = document("one/with?query");
  const { props, calls } = contentProps({ documents: [chosen] });
  const tree = LibraryContent(props);
  const row = nodes(tree).find(node => node.type === "button" && node.props.className === "cl-details-button");
  assert.equal(row.props["aria-haspopup"], "dialog");
  assert.equal(row.props.href, undefined);
  row.props.onClick();
  assert.deepEqual(calls, [["select", chosen.id]]);
  const links = nodes(tree).filter(node => node.type === Link);
  const href = label => links.find(node => text(node).trim() === label)?.props.href;
  assert.equal(href("Open workspace"), state.documentDestination(chosen));
  assert.equal(href("Resume review"), state.documentDestination(chosen, true));
  assert.equal(href("Earlier analysis & original"), undefined);
  assert.equal(links.find(node => node.props.className === "cl-document-name").props.href, state.documentDestination(chosen));
  assert.equal(href("Import agreement"), "/import");
});

test("filtering affects inspector selection, not the latest saved resume shortcut", () => {
  const hiddenRecent = document("recent"), shown = document("shown", { review_summary: summary({ last_activity_at: "2026-09-18T12:00:00Z" }) });
  const { props } = contentProps({ documents: [shown, hiddenRecent], filteredDocuments: [shown], selectedId: hiddenRecent.id });
  const tree = LibraryContent(props);
  assert.equal(nodes(tree).find(node => node.type === ContinueReviewing).props.document, hiddenRecent);
  assert.equal(nodes(tree).find(node => node.type === AgreementInspector), undefined);
});

test("search, sort, contract type and refresh controls invoke only their explicit callbacks", () => {
  const { props, calls } = contentProps();
  const controls = nodes(LibraryContent(props));
  controls.find(node => node.type === "input" && node.props["aria-label"] === "Filter by filename").props.onChange({ target: { value: "alpha" } });
  const selects = controls.filter(node => node.type === "select");
  selects[0].props.onChange({ target: { value: "name" } });
  selects[1].props.onChange({ target: { value: "service_agreement" } });
  controls.find(node => node.type === "button" && node.props["aria-label"] === "Refresh library").props.onClick();
  assert.deepEqual(calls, [["search", "alpha"], ["sort", "name"], ["type", "service_agreement"], ["retry"]]);
});

test("Browse and contract search stay mounted independently with only the active view exposed", () => {
  const searchPanel = React.createElement("section", { "aria-label": "Contract search content" }, "Saved answer and query draft");
  const { props, calls } = contentProps({ searchPanel, selectedId: "" });
  const browse = LibraryContent(props);
  const browseNodes = nodes(browse);
  const browseRegion = browseNodes.find(node => node.props.id === "library-browse");
  const searchRegion = browseNodes.find(node => node.props.id === "library-search");
  assert.equal(browseRegion.props.hidden, false);
  assert.equal(searchRegion.props.hidden, true);
  assert.equal(searchRegion.props.children, searchPanel);
  assert.equal(button(browse, "Browse").props["aria-pressed"], true);
  assert.equal(button(browse, "Search contract text").props["aria-pressed"], false);
  assert.ok(browseNodes.some(node => node.props.role === "group" && node.props["aria-label"] === "Library view"));
  assert.equal(button(browse, "Search contract text").props["aria-controls"], "library-search");
  const search = LibraryContent({ ...props, view: "search" });
  const searchNodes = nodes(search);
  assert.equal(searchNodes.find(node => node.props.id === "library-browse").props.hidden, true);
  assert.equal(searchNodes.find(node => node.props.id === "library-search").props.hidden, false);
  assert.equal(searchNodes.find(node => node.props.id === "library-search").props.children, searchPanel);
  assert.ok(searchNodes.some(node => node.type === ContinueReviewing));
  assert.ok(searchNodes.some(node => node.props["aria-label"] === "Filter by filename"));
  assert.equal(button(search, "Search contract text").props["aria-pressed"], true);
  assert.deepEqual(calls, [], "Showing either view must not dispatch data or paid actions");
});

test("view controls request only view changes without clearing filters, drafts or selection", () => {
  const viewCalls = [];
  const { props, calls } = contentProps({
    searchPanel: React.createElement("section", null, "Search"),
    onViewChange: view => viewCalls.push(view),
    searchQuery: "saved filter", isSelectMode: true, selectedDocuments: new Set(["one"]),
  });
  const tree = LibraryContent(props);
  button(tree, "Search contract text").props.onClick();
  button(tree, "Browse").props.onClick();
  assert.deepEqual(viewCalls, ["search", "browse"]);
  assert.deepEqual(calls, []);
  assert.equal(props.searchQuery, "saved filter");
  assert.equal(props.selectedDocuments.has("one"), true);
});

test("without contract search the library remains directly browsable", () => {
  const { props } = contentProps({ view: "search" });
  const tree = LibraryContent(props);
  const controls = nodes(tree);
  assert.equal(controls.find(node => node.props.id === "library-browse").props.hidden, false);
  assert.equal(controls.some(node => node.props["aria-label"] === "Library view"), false);
  assert.equal(controls.some(node => node.props.id === "library-search"), false);
});

test("legacy analysis and unreadable metadata remain accessible without pretending there is a usable review", () => {
  const legacy = document("old/id", { source_revision_id: null, source_status: null, extraction_status: null, analysis_status: "ready", review_summary: null });
  const html = render(AgreementInspector, { document: legacy, onDelete() {}, deleting: false });
  assert.match(html, /Earlier analysis available/);
  assert.match(html, /Open earlier review/);
  assert.match(html, /href="\/review\?documentId=old%2Fid"/);
  assert.doesNotMatch(html, /Open workspace|AI generated|Resume review/);
  const unavailable = render(AgreementInspector, { document: document("one", { review_summary: summary({ kind: null, status: "unavailable", can_resume: false }) }), onDelete() {}, deleting: false });
  assert.match(unavailable, /Review state unavailable/);
  assert.match(unavailable, /Saved review metadata could not be read/);
  assert.match(unavailable, /Your stored work has not been changed/);
});

test("missing or unavailable review metadata never confirms zero saved questions", () => {
  for (const review_summary of [undefined, null,
    summary({ status: "unavailable", kind: null, saved_question_count: 0, can_resume: false })]) {
    const html = render(AgreementInspector, { document: document("one", { review_summary }), onDelete() {}, deleting: false });
    assert.match(html, /<dt>Saved questions<\/dt><dd>Not available<\/dd>/);
    assert.doesNotMatch(html, /0 saved questions/);
  }
  const confirmedEmpty = render(AgreementInspector, {
    document: document("one", { review_summary: summary({ saved_question_count: 0 }) }), onDelete() {}, deleting: false,
  });
  assert.match(confirmedEmpty, /<dt>Saved questions<\/dt><dd>0 saved questions<\/dd>/);
});

test("legacy processing and failure labels remain visible when no modern run is available", () => {
  for (const [analysis_status, expected] of [["processing", "Earlier analysis in progress"], ["failed", "Earlier analysis failed"]]) {
    for (const review_summary of [undefined, null, summary({ status: "not_started", kind: null, can_resume: false })]) {
      const legacy = document("legacy", { analysis_status, review_summary });
      assert.equal(state.libraryReviewLabel(legacy), expected);
      assert.match(render(AgreementInspector, { document: legacy, onDelete() {}, deleting: false }), new RegExp(expected));
    }
    const modern = document("modern", { analysis_status, review_summary: summary({ kind: "fixture" }) });
    assert.equal(state.libraryReviewLabel(modern), "Example review", "A modern saved run takes precedence over legacy analysis state");
  }
});

function resumableWorkspace(overrides = {}) {
  const run = { id: "run-latest", kind: "ai", status: "ready", source_revision_id: "source-current", findings: [
    { id: "finding-2", evidence: [{ span_id: "page-25-span-1", page_number: 25 }, { span_id: "page-22-span-3", page_number: 22 }] },
    { id: "finding-3", evidence: [] },
  ] };
  return { source_revision_id: "source-current", runs: [run], personal: {
    "run-latest": { position: { view: "findings", finding_id: "finding-2", evidence_span_id: "page-25-span-1" } },
  }, ...overrides };
}
const plain = value => JSON.parse(JSON.stringify(value));

test("Library resume restores the latest run's saved finding and exact evidence page", () => {
  const workspace = resumableWorkspace();
  const original = JSON.stringify(workspace);
  assert.deepEqual(plain(workspaceState.libraryResumePosition(workspace)), {
    runId: "run-latest", position: { view: "findings", finding_id: "finding-2", evidence_span_id: "page-25-span-1" }, pageNumber: 25,
  });
  assert.equal(JSON.stringify(workspace), original, "Computing resume must not change saved state");
  workspace.personal["run-latest"].position = { view: "document", finding_id: "finding-2", evidence_span_id: "page-22-span-3" };
  const sourceResume = workspaceState.libraryResumePosition(workspace);
  assert.equal(sourceResume.position.view, "document");
  assert.equal(sourceResume.pageNumber, 22);
});

test("Library resume uses only the latest run and never falls back after its failure or source mismatch", () => {
  const workspace = resumableWorkspace();
  const older = { ...workspace.runs[0], id: "run-older", created_at: "2026-09-20T12:00:00Z" };
  workspace.runs = [older, { ...workspace.runs[0], created_at: "2026-09-19T12:00:00Z" }];
  workspace.personal[older.id] = { position: { view: "findings", finding_id: "finding-3", evidence_span_id: null } };
  assert.equal(workspaceState.libraryResumePosition(workspace).runId, "run-latest", "Persisted run order is authoritative, not a timestamp re-sort");
  for (const status of ["processing", "failed", "interrupted"]) {
    workspace.runs[1] = { ...workspace.runs[1], status };
    assert.equal(workspaceState.libraryResumePosition(workspace), null, status);
  }
  workspace.runs[1] = { ...workspace.runs[1], status: "ready", source_revision_id: "source-old" };
  assert.equal(workspaceState.libraryResumePosition(workspace), null);
  assert.equal(workspaceState.libraryResumePosition(resumableWorkspace({ runs: [] })), null);
});

test("Library resume safely defaults missing or stale finding positions to overview", () => {
  const overview = { runId: "run-latest", position: { view: "overview", finding_id: null, evidence_span_id: null }, pageNumber: null };
  assert.deepEqual(plain(workspaceState.libraryResumePosition(resumableWorkspace({ personal: {} }))), overview);
  const stale = resumableWorkspace({ personal: { "run-latest": {
    position: { view: "findings", finding_id: "deleted-finding", evidence_span_id: "page-25-span-1" },
  } } });
  assert.deepEqual(plain(workspaceState.libraryResumePosition(stale)), overview);
  stale.personal["run-latest"].position = { view: "findings", finding_id: "finding-3", evidence_span_id: "page-25-span-1" };
  assert.deepEqual(plain(workspaceState.libraryResumePosition(stale)), {
    runId: "run-latest", position: { view: "findings", finding_id: "finding-3", evidence_span_id: null }, pageNumber: null,
  });
  stale.runs[0].status = "incomplete";
  assert.equal(workspaceState.libraryResumePosition(stale).runId, "run-latest", "Incomplete saved review remains inspectable");
});

test("delete and bulk actions are explicit callbacks, with independent inspector and deletion selection", () => {
  const { props, calls } = contentProps({ isSelectMode: true, selectedDocuments: new Set(["two"]) });
  const tree = LibraryContent(props);
  const checkbox = nodes(tree).find(node => node.type === "input" && node.props["aria-label"] === "Select Agreement two.pdf for deletion");
  assert.equal(checkbox.props.checked, true);
  checkbox.props.onChange();
  for (const label of ["Select all shown", "Clear selection", "Delete selected (1)", "Delete all agreements", "Done", "Delete agreement"])
    button(tree, label).props.onClick();
  assert.deepEqual(calls, [["toggle-selection", "two"], ["select-all"], ["clear-selection"],
    ["delete-selected"], ["delete-all"], ["toggle-mode"], ["select", ""], ["delete", props.documents[0]]]);
  assert.equal(nodes(tree).find(node => node.type === AgreementInspector).props.document.id, "one");
});

test("busy or empty bulk selections disable destructive controls without hiding recovery navigation", () => {
  const emptySelection = LibraryContent(contentProps({ isSelectMode: true }).props);
  assert.equal(button(emptySelection, "Delete selected (0)").props.disabled, true);
  const noMatches = LibraryContent(contentProps({ isSelectMode: true, filteredDocuments: [] }).props);
  assert.equal(button(noMatches, "Select all shown").props.disabled, true);
  const busy = LibraryContent(contentProps({ busy: true, isSelectMode: true, selectedDocuments: new Set(["one"]) }).props);
  for (const label of ["Finish selection", "Delete all agreements", "Select all shown", "Clear selection", "Delete selected (1)", "Done", "Deleting…"])
    assert.equal(button(busy, label).props.disabled, true, label);
  const checkboxes = nodes(busy).filter(node => node.type === "input" && node.props.type === "checkbox");
  assert.ok(checkboxes.every(node => node.props.disabled));
  assert.ok(nodes(busy).some(node => node.type === Link && text(node).trim() === "Open workspace"));
});
