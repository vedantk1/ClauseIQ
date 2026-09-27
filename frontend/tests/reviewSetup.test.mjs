import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { appHeaderHarness } from "./appHeaderHarness.mjs";

function loadModule(path, imports = {}, globals = {}) {
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, React, Error, setTimeout, clearTimeout,
    crypto: { randomUUID: () => "explicit-request-id" },
    fetch() { assert.fail("Rendering review setup must not issue a request"); },
    ...globals,
    require(name) { assert.ok(name in imports, `Unexpected dependency: ${name}`); return imports[name]; },
  });
  return exports;
}

const clone = value => JSON.parse(JSON.stringify(value));
const neutral = { perspective: "neutral", role: "", priorities: "" };
const sourceHelpers = loadModule("../src/components/workspace/reviewSetupState.ts");
const workspaceHelpers = loadModule("../src/components/workspace/workspaceState.ts");
const controls = loadModule("../src/components/workspace/WorkspaceControls.tsx", {
  react: React, "./workspaceState": workspaceHelpers,
});
let workspaceContext;
function resetContext(overrides = {}) {
  workspaceContext = { settings: { model_id: "gpt-6-sol", reasoning_effort: "high", has_api_key: true, api_key_needs_reentry: false },
    isLoading: false, error: null, refresh() { assert.fail("Status refresh must be explicit"); }, ...overrides };
}
resetContext();
// Only the modal's closed local state is stubbed for direct callback inspection.
// These SSR/state tests do not claim browser mounting, focus or layout coverage.
const generation = loadModule("../src/components/workspace/ReviewGenerationControls.tsx", {
  react: { ...React, useState: initial => [initial, () => {}] },
  "@/components/ui/Modal": () => null,
  "@/context/WorkspaceContext": { useWorkspace: () => workspaceContext },
  "./workspaceState": workspaceHelpers, "./WorkspaceControls": controls,
});
const icon = props => React.createElement("svg", props);
const { ReviewSetup } = loadModule("../src/components/workspace/ReviewSetup.tsx", {
  react: React, "lucide-react": { ArrowLeft: icon, ArrowUpRight: icon, FileText: icon },
  "./WorkspaceControls": controls, "./ReviewGenerationControls": generation,
  "./workspaceState": workspaceHelpers, "./reviewSetupState": sourceHelpers,
  "./ReviewSetup.module.css": { setup: "review-setup" },
});
const Link = ({ children, ...props }) => React.createElement("a", props, children);
const themeCalls = [];
const { LibraryHeader } = loadModule("../src/components/documents/LibraryHeader.tsx", {
  react: React,
  "@/components/shell/AppHeader": appHeaderHarness({ Link, toggleTheme: () => themeCalls.push("toggle") }),
});

function source(overrides = {}) {
  return { id: "doc-1", source_revision_id: "source-1", source_status: "stored", source_sha256: "synthetic-source-hash",
    extraction_status: "complete", source_extraction: { status: "complete", page_count: 3,
      text: "Extracted synthetic agreement text.", extraction_version: "test-extractor",
      pages: [1, 2, 3].map(page_number => ({ page_number, status: "extracted", text: `Page ${page_number}` })) }, ...overrides };
}
function workspace(overrides = {}) {
  return { document_id: "doc-1", source_revision_id: "source-1", revision: 0,
    brief: clone(neutral), fixture_available: false, runs: [], personal: {}, ask_turns: [], ...overrides };
}
function state(overrides = {}) {
  return { workspace: workspace(), status: "saved", pending: 0, localDrafts: {}, localAskDrafts: {},
    briefDraft: null, error: null, reviewAction: { status: "idle", error: null, canRetryRequest: false },
    askAction: { status: "idle", error: null }, ...overrides };
}
function setup(overrides = {}) {
  resetContext();
  const calls = [];
  const callback = name => (...args) => calls.push([name, ...args]);
  return { calls, props: { documentId: "doc-1", filename: "Synthetic agreement.pdf", source: source(),
    sourceError: null, state: state(), controller: {
      setBriefDraft: callback("draft"), saveBrief: callback("save"), startReview: callback("generate"),
      createFixture: callback("fixture"), reloadSaved: callback("reload"), retryReviewRequest: callback("retry"),
    }, onOriginal: callback("original"), onEarlierDocument: callback("recovery"),
    onSettings: callback("settings"), onLibrary: callback("library"), ...overrides } };
}
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props));
function nodes(node) {
  if (!React.isValidElement(node)) return [];
  const children = typeof node.type === "function" ? [node.type(node.props)] : React.Children.toArray(node.props.children);
  return [node, ...children.flatMap(nodes)];
}
function text(node) {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node !== "object") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  return text(node.props?.children);
}
function button(tree, label) {
  const found = nodes(tree).find(node => node.type === "button" && text(node).trim() === label);
  assert.ok(found, `Missing button: ${label}`);
  return found;
}
const ready = (value, error = null) => sourceHelpers.reviewSetupSource(value, "doc-1", "source-1", error);

test("complete source readiness describes extraction, not review or legal safety", () => {
  const original = source();
  const before = JSON.stringify(original);
  const result = ready(original);
  assert.equal(result.canReview, true);
  assert.equal(result.limited, false);
  assert.equal(result.pageCount, 3);
  assert.equal(result.extracted, 3);
  assert.equal(result.missing.length, 0);
  assert.equal(result.title, "Source text extracted");
  assert.match(result.message, /not an AI review or a check/);
  assert.equal(JSON.stringify(original), before);
});

test("partial source keeps exact missing-page warnings and permits only bounded review", () => {
  const partial = source();
  partial.extraction_status = partial.source_extraction.status = "partial";
  partial.source_extraction.pages[1].status = "empty";
  partial.source_extraction.pages[2].status = "failed";
  const result = ready(partial);
  assert.equal(result.canReview, true);
  assert.equal(result.limited, true);
  assert.equal(result.extracted, 1);
  assert.deepEqual(clone(result.missing.map(page => page.page_number)), [2, 3]);
  const { props } = setup({ source: partial });
  const html = render(ReviewSetup, props);
  assert.match(html, /1 of 3 pages have extracted text/);
  assert.match(html, /2 \(no text\), 3 \(extraction failed\)/);
  assert.match(html, /Missing pages may contain important conditions/);
  assert.match(html, /not evidence that no issue exists/);
  assert.match(html, /No OCR is performed/);
  assert.doesNotMatch(html, /agreement is safe|verified agreement|all issues found|fully reviewed/i);
  assert.equal(button(ReviewSetup(props), "Start review").props.disabled, false);
});

test("partial status or missing pages independently retain the source limitation", () => {
  const topPartial = source({ extraction_status: "partial" });
  const snapshotPartial = source(); snapshotPartial.source_extraction.status = "partial";
  const missingPage = source(); missingPage.source_extraction.pages[2].status = "empty";
  for (const candidate of [topPartial, snapshotPartial, missingPage]) {
    assert.equal(ready(candidate).limited, true);
    assert.equal(ready(candidate).canReview, true);
  }
});

test("all-empty, blank, missing and unsupported extraction cannot start a review", () => {
  const empty = source(); empty.source_extraction.pages.forEach(page => { page.status = "empty"; });
  const blank = source(); blank.source_extraction.text = " \n ";
  const noPages = source(); noPages.source_extraction.pages = [];
  const unsupported = source(); unsupported.source_extraction.status = "failed";
  for (const candidate of [empty, blank, noPages, source({ source_extraction: null }),
    source({ extraction_status: "unavailable" }), unsupported]) {
    assert.equal(ready(candidate).canReview, false);
    const { props } = setup({ source: candidate });
    assert.equal(button(ReviewSetup(props), "Start review").props.disabled, true);
    assert.ok(button(ReviewSetup(props), "View original"));
  }
});

test("loading, failed, pending, storage and mismatched source states stay distinct and gated", () => {
  const cases = [
    [null, null, "Loading source details…"], [null, "Fetch failed", "Source details unavailable"],
    [source({ extraction_status: "failed" }), null, "Text extraction failed"],
    [source({ extraction_status: "pending" }), null, "Preparing source text"],
    [source({ extraction_status: "processing" }), null, "Preparing source text"],
    [source({ source_status: "storing" }), null, "Original storage not confirmed"],
    [source({ source_status: "storage_failed" }), null, "Original storage not confirmed"],
    [source({ id: "other-document" }), null, "Source identity mismatch"],
    [source({ source_revision_id: "other-revision" }), null, "Source identity mismatch"],
    [source(), "Fetch failed", "Source details unavailable"],
  ];
  for (const [candidate, sourceError, title] of cases) {
    const result = ready(candidate, sourceError);
    assert.equal(result.title, title);
    assert.equal(result.canReview, false);
    const { props } = setup({ source: candidate, sourceError });
    assert.equal(button(ReviewSetup(props), "Start review").props.disabled, true);
  }
});

test("setup rendering is side-effect free and permits original access without a key", () => {
  const { props, calls } = setup();
  resetContext({ settings: { model_id: "gpt-5.6-terra", has_api_key: false, api_key_needs_reentry: false } });
  const before = JSON.stringify(props.state);
  const html = render(ReviewSetup, props);
  assert.match(html, /Set up your review/);
  assert.match(html, /value="neutral" selected=""/);
  assert.match(html, /Saving does not run AI/);
  assert.match(html, /Add or re-enter your API key in Settings/);
  assert.equal(button(ReviewSetup(props), "Start review").props.disabled, true);
  assert.notEqual(button(ReviewSetup(props), "View original").props.disabled, true);
  assert.equal(JSON.stringify(props.state), before);
  assert.deepEqual(calls, []);
  assert.equal(render(ReviewSetup, { ...props, state: state({ workspace: null }) }), "");
});

test("setup groups unpaid source access separately from the explicit paid action", () => {
  const { props, calls } = setup();
  const tree = ReviewSetup(props);
  const all = nodes(tree);
  const sourceRail = all.find(node => node.type === "aside" && node.props["aria-labelledby"] === "setup-agreement-heading");
  assert.ok(sourceRail);
  assert.ok(button(sourceRail, "View original"));
  assert.equal(nodes(sourceRail).some(node => node.type === "button" && text(node) === "Start review"), false);
  const html = render(ReviewSetup, props);
  assert.equal((html.match(/Return to Library/g) || []).length, 1);
  assert.ok(html.indexOf("Return to Library") < html.indexOf("Your agreement"));
  assert.match(html, /Sends document text and your instructions to OpenAI\. API charges apply/);
  assert.ok(button(tree, "Start review"));
  assert.deepEqual(calls, []);
});

test("setup brief is neutral by default and field edits or saving never trigger generation", () => {
  const { props, calls } = setup({ state: state({ briefDraft: { ...neutral, priorities: "Local priority" } }) });
  const tree = ReviewSetup(props);
  const all = nodes(tree);
  const select = all.find(node => node.type === "select");
  const role = all.find(node => node.type === "input");
  const priorities = all.find(node => node.type === "textarea");
  assert.equal(select.props.value, "neutral");
  assert.equal(role.props.maxLength, 200);
  assert.equal(priorities.props.maxLength, 2000);
  assert.equal(role.props.required, undefined);
  assert.equal(priorities.props.required, undefined);
  select.props.onChange({ target: { value: "customer" } });
  role.props.onChange({ target: { value: "Example Customer" } });
  priorities.props.onChange({ target: { value: "Exit conditions" } });
  assert.equal(button(tree, "Save instructions").props.disabled, false);
  button(tree, "Save instructions").props.onClick();
  assert.deepEqual(calls.map(call => call[0]), ["draft", "draft", "draft", "save"]);
  assert.equal(calls[0][1].perspective, "customer");
  assert.equal(calls[2][1].priorities, "Exit conditions");
});

test("original, recovery, Library and Settings actions invoke only their requested callback", () => {
  const { props, calls } = setup({ source: source({ extraction_status: "failed" }) });
  const tree = ReviewSetup(props);
  assert.match(render(ReviewSetup, props), /this screen cannot retry extraction/);
  for (const label of ["View original", "Inspect saved document record", "Return to Library", "Open Settings"])
    button(tree, label).props.onClick();
  assert.deepEqual(calls, [["original"], ["recovery"], ["library"], ["settings"]]);
});

test("synthetic fixture action relies on backend availability, never the filename", () => {
  for (const fixture_available of [false, undefined]) {
    const { props, calls } = setup({ filename: "managed-services-25p.pdf", state: state({ workspace: workspace({ fixture_available }) }) });
    assert.doesNotMatch(render(ReviewSetup, props), /Try the synthetic example|Load synthetic/);
    assert.deepEqual(calls, []);
  }
  const { props, calls } = setup({ state: state({ workspace: workspace({ fixture_available: true }) }) });
  const html = render(ReviewSetup, props);
  assert.match(html, /authored customer-perspective findings are separate from AI output/);
  assert.match(html, /do not use your brief/);
  assert.deepEqual(calls, []);
  button(ReviewSetup(props), "Load synthetic customer-perspective example").props.onClick();
  assert.deepEqual(calls, [["fixture"]]);
});

test("pending edits and paid activity disable synthetic fixture creation and brief saving", () => {
  for (const overrides of [{ pending: 1 }, { status: "conflict" }, { status: "review" }, { status: "failed" },
    { reviewAction: { status: "generating" } }, { askAction: { status: "uncertain" } }]) {
    const { props } = setup({ state: state({ workspace: workspace({ fixture_available: true }),
      briefDraft: { ...neutral, priorities: "Unsaved priority" }, ...overrides }) });
    const tree = ReviewSetup(props);
    assert.equal(button(tree, "Save instructions").props.disabled, true);
    assert.equal(button(tree, "Load synthetic customer-perspective example").props.disabled, true);
  }
});

test("conflict comparison keeps the local brief above the latest saved values", () => {
  const saved = { perspective: "provider", role: "Latest saved provider", priorities: "Saved priorities" };
  const local = { perspective: "customer", role: "Unsaved local customer", priorities: "Local priorities" };
  const { props, calls } = setup({ state: state({ status: "review", workspace: workspace({ brief: saved }), briefDraft: local }) });
  const before = JSON.stringify(props.state);
  const html = render(ReviewSetup, props);
  assert.match(html, /value="Unsaved local customer"/);
  assert.match(html, /Local priorities/);
  assert.match(html, /Latest saved brief/);
  assert.match(html, /Latest saved provider/);
  assert.match(html, /Saved priorities/);
  assert.match(html, /Your different local edits remain above/);
  assert.equal(button(ReviewSetup(props), "Save instructions and start review").props.disabled, true);
  assert.equal(JSON.stringify(props.state), before);
  assert.deepEqual(calls, []);
});

test("setup generation preserves explicit paid start and selected model without automatic calls", () => {
  const { props, calls } = setup();
  const html = render(ReviewSetup, props);
  assert.match(html, /API charges apply/);
  assert.match(html, /Sends document text and your instructions to OpenAI/);
  assert.match(html, /<strong>gpt-6-sol/);
  assert.match(html, /high reasoning/);
  assert.match(html, /cw-start-review/);
  assert.doesNotMatch(html, /Refresh model and key status/);
  assert.deepEqual(calls, []);
  button(ReviewSetup(props), "Start review").props.onClick();
  assert.deepEqual(calls, [["generate", "gpt-6-sol", "explicit-request-id", "high"]]);
});

test("setup generation keeps key, settings, source, save and in-flight request gates", () => {
  const cases = [
    { context: { settings: null } }, { context: { isLoading: true } }, { context: { error: "Status unavailable" } },
    { context: { settings: { model_id: "gpt-5.6-terra", has_api_key: false } } },
    { context: { settings: { model_id: "gpt-5.6-terra", has_api_key: true, api_key_needs_reentry: true } } },
    { sourceReady: false }, ...["loading", "failed", "conflict", "review"].map(status => ({ state: { status } })),
    { state: { reviewAction: { status: "uncertain" } } }, { state: { askAction: { status: "generating" } } },
    { state: { workspace: workspace({ runs: [{ id: "pending", kind: "ai", status: "processing" }] }) } },
  ];
  for (const candidate of cases) {
    const { props, calls } = setup();
    resetContext(candidate.context);
    const tree = generation.ReviewGenerationControls({ state: state(candidate.state), controller: props.controller,
      sourceReady: candidate.sourceReady ?? true, onSettings: props.onSettings, variant: "setup" });
    assert.equal(button(tree, "Start review").props.disabled, true, JSON.stringify(candidate));
    assert.deepEqual(calls, []);
  }
});

test("key-status refresh and uncertain-outcome recovery do not invoke a paid retry automatically", () => {
  const { props, calls } = setup({ state: state({ reviewAction: { status: "uncertain", error: "Outcome unknown", canRetryRequest: true } }) });
  resetContext({ error: "Key status unavailable", refresh: () => calls.push(["refresh-settings"]) });
  const html = render(ReviewSetup, props);
  assert.match(html, /provider may have received this request and charges may apply/);
  assert.match(html, /never starts another review/);
  assert.deepEqual(calls, []);
  const tree = ReviewSetup(props);
  button(tree, "Refresh model and key status").props.onClick();
  button(tree, "Check saved review state").props.onClick();
  assert.deepEqual(calls, [["refresh-settings"], ["reload"]]);
  button(tree, "Retry this request with the same ID").props.onClick();
  assert.deepEqual(calls, [["refresh-settings"], ["reload"], ["retry"]]);
});

test("setup uses the existing controller to confirm a dirty brief before paid dispatch", async () => {
  let saved = workspace();
  const calls = [];
  let confirmSave;
  const controller = new workspaceHelpers.ReviewWorkspaceController("doc-1", {
    async load() { return clone(saved); },
    update(documentId, revision, operation) {
      calls.push(["save", documentId, revision, clone(operation)]);
      return new Promise(resolve => { confirmSave = () => {
        saved = { ...saved, revision: revision + 1, brief: clone(operation.brief) }; resolve(clone(saved));
      }; });
    },
    async generate(documentId, revision, requestId, modelId) {
      calls.push(["generate", documentId, revision, requestId, modelId, clone(saved.brief)]);
      return clone(saved);
    },
  });
  await controller.load();
  const dirty = { ...neutral, perspective: "customer", priorities: "Exit continuity" };
  controller.setBriefDraft(dirty);
  assert.deepEqual(calls, []);
  const started = controller.startReview("gpt-5.6-terra", "explicit-request-id");
  assert.deepEqual(calls.map(call => call[0]), ["save"]);
  assert.equal(controller.getSnapshot().reviewAction.status, "preparing");
  confirmSave();
  await started;
  assert.deepEqual(calls.map(call => call[0]), ["save", "generate"]);
  assert.equal(calls[1][2], 1);
  assert.deepEqual(calls[1][5], dirty);
  assert.equal(controller.getSnapshot().briefDraft, null);
});

test("setup's existing controller blocks paid work after a brief conflict and retains local wording", async () => {
  const calls = [];
  const controller = new workspaceHelpers.ReviewWorkspaceController("doc-1", {
    async load() { return workspace(); },
    async update() { calls.push("save"); throw Object.assign(new Error("Changed elsewhere"), { code: "REVISION_CONFLICT" }); },
    async generate() { calls.push("generate"); assert.fail("Conflicting brief must not be sent"); },
  });
  await controller.load();
  controller.setBriefDraft({ ...neutral, priorities: "Keep my local wording" });
  await controller.startReview("gpt-5.6-terra", "explicit-request-id");
  assert.deepEqual(calls, ["save"]);
  assert.equal(controller.getSnapshot().status, "conflict");
  assert.equal(controller.getSnapshot().briefDraft.priorities, "Keep my local wording");
});

test("Import header guards normal same-tab navigation while keeping modifier and new-tab behavior", () => {
  const calls = [];
  const tree = LibraryHeader({ current: "import", onNavigate: destination => calls.push(destination) });
  const links = nodes(tree).filter(node => node.type === Link);
  assert.equal(links.find(node => text(node) === "Library").props["aria-current"], undefined);
  for (const link of links) {
    let prevented = 0;
    const event = { button: 0, preventDefault() { prevented += 1; } };
    link.props.onClick(event);
    assert.equal(prevented, 1);
    assert.equal(calls.at(-1), link.props.href);
    const count = calls.length;
    for (const overrides of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }, { button: 2 }]) {
      link.props.onClick({ ...event, ...overrides, preventDefault() { assert.fail("Modified navigation must remain native"); } });
    }
    assert.equal(calls.length, count);
  }
  const unguarded = nodes(LibraryHeader()).find(node => node.type === Link && text(node) === "Library");
  assert.equal(unguarded.props["aria-current"], "page");
  unguarded.props.onClick({ button: 0, preventDefault() { assert.fail("An unguarded link stays native"); } });
});
