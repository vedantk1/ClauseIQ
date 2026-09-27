import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import postcss from "postcss";
import ts from "typescript";

function loadModule(path, imports = {}) {
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, React,
    fetch() { assert.fail("Rendering saved review summaries must not issue requests"); },
    require(name) { assert.ok(name in imports, `Unexpected dependency: ${name}`); return imports[name]; },
  });
  return exports;
}

const helpers = loadModule("../src/components/workspace/workspaceState.ts");
const controls = loadModule("../src/components/workspace/WorkspaceControls.tsx", {
  react: React, "./workspaceState": helpers,
});
const icon = props => React.createElement("svg", props);
const presentation = loadModule("../src/components/workspace/evidencePresentation.ts", { "./workspaceState": helpers });
const evidence = loadModule("../src/components/workspace/EvidenceSourcePane.tsx", {
  react: React, "lucide-react": { ChevronRight: icon, FileText: icon, Info: icon },
  "@/components/PDFViewer": () => null, "./evidencePresentation": presentation, "./WorkspaceControls": controls,
});
const imports = {
  react: React, "lucide-react": { ArrowRight: icon, BookOpen: icon, FileText: icon },
  "./WorkspaceControls": controls, "./EvidenceSourcePane": evidence, "./workspaceState": helpers,
  "./ReviewBriefExport": { ReviewBriefExport: () => null },
  "./WorkspaceSummaries.module.css": { summaries: "workspace-summaries" },
  "./MyReview.module.css": { review: "my-review" },
  "@/components/ui/Modal": () => null,
};
const { AgreementOverview } = loadModule("../src/components/workspace/AgreementOverview.tsx", imports);
const { MyReview } = loadModule("../src/components/workspace/MyReview.tsx", { ...imports, react: { ...React, useState: value => [value, () => {}] } });
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props));

// Inspect component output/callbacks without claiming mounted layout or browser focus coverage.
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
function fixture(overrides = {}) {
  const quote = "The customer may request an extension.";
  const reference = { source_revision_id: "source-1", span_id: "span-1", page_number: 1,
    quote, label: "Extension conditions" };
  const source = { id: "document-1", source_revision_id: "source-1", source_sha256: "synthetic-source-hash",
    source_status: "stored", extraction_status: "complete", source_extraction: {
      page_count: 1, status: "complete", text: quote, extraction_version: "synthetic-test-extractor",
      pages: [{ page_number: 1, status: "extracted", text: quote,
        spans: [{ id: "span-1", start: 0, end: Array.from(quote).length, text: quote }] }],
    } };
  const findings = [
    { id: "finding-1", title: "Plan the handover", evidence: [reference] },
    { id: "finding-2", title: "Clarify the missing exit plan", evidence: [] },
  ];
  const run = { id: "run-1", kind: "fixture", status: "ready", source_revision_id: "source-1",
    context: { perspective: "customer", role: "Customer role", priorities: "Exit continuity" },
    findings, overview: "Legacy summary wording.",
    overview_items: [{ text: "The agreement offers a conditional extension.", evidence: [reference] }],
    coverage: { page_count: 1, extracted_pages: [1], omitted_pages: [], limitations: [] },
  };
  const personal = { ...helpers.emptyPersonal(),
    position: { view: "findings", finding_id: "finding-1", evidence_span_id: "span-1" },
    opened_finding_ids: ["finding-1", "finding-1", "other-run-finding"],
    markers: { "finding-1": "revisit", "finding-2": "reviewed_by_me", "other-run-finding": "revisit" },
    saved_questions: { "finding-1": { text: "Confirm the minimum handover period.", saved_at: "2026-01-01T00:00:00Z" },
      "other-run-finding": { text: "Question outside the selected run." } },
    drafts: { "finding-1": "Unsaved edited handover wording.", "finding-2": "Recovery draft only." },
    ask_drafts: { "finding-1": "Unsent paid Ask wording." },
  };
  const calls = [];
  const callback = name => (...args) => calls.push([name, ...args]);
  return { calls, reference, props: { run, personal, source,
    onFinding: callback("finding"), onSource: callback("source"), onOriginal: callback("original"),
    onExplore: callback("explore"), onResume: callback("resume"), onMyReview: callback("my-review"),
    children: React.createElement("div", null, "Explicit review controls"), ...overrides } };
}

test("overview leads with saved agreement output and keeps new-review controls secondary", () => {
  const { props, calls } = fixture();
  const before = JSON.stringify(props);
  const html = render(AgreementOverview, props);
  assert.match(html, /Authored synthetic example/);
  assert.doesNotMatch(html, /the context saved with this run/);
  assert.match(html, /The agreement offers a conditional extension/);
  assert.doesNotMatch(html, /Legacy summary wording/);
  assert.equal(button(AgreementOverview(props), "Explore findings2").props.disabled, undefined);
  assert.match(html, /not a complete inventory/);
  assert.match(html, /Changing instructions does not update these saved findings/);
  assert.ok(html.indexOf("Agreement summary") < html.indexOf("Review instructions &amp; new review"));
  assert.equal((html.match(/<h[23][^>]*>Agreement summary/g) || []).length, 1);
  assert.doesNotMatch(html, /Agreement overview|co-activity|co-eyebrow/);
  const disclosure = nodes(AgreementOverview(props)).find(node => node.props.className === "co-review-controls");
  assert.equal(disclosure.props.open, false);
  assert.equal(JSON.stringify(props), before);
  assert.deepEqual(calls, []);
});

test("overview counts only selected-run activity, deduplicates opened items and avoids completion claims", () => {
  const { props } = fixture();
  const html = render(AgreementOverview, props);
  assert.match(html, /1 saved question · 1 to revisit/);
  assert.match(html, /1 findings opened/);
  assert.match(html, /Personal activity, not review completeness/);
  assert.doesNotMatch(html, /Continue from saved position|Saved position:/);
  assert.doesNotMatch(html, /Question outside the selected run|Recovery draft only|Unsent paid Ask wording/);
  props.personal.position.finding_id = "other-run-finding";
  assert.doesNotMatch(render(AgreementOverview, props), /Saved position: Findings —/);
});

test("overview keeps unattributed saved summary text without an empty source disclosure", () => {
  const { props, calls } = fixture();
  const textWithoutReferences = "An authored summary with no saved quotation.\nIt remains unchanged.";
  props.run.overview_items = [{ text: textWithoutReferences, evidence: [] }];
  const before = JSON.stringify(props.run);
  const tree = AgreementOverview(props);
  const summary = nodes(tree).find(node => node.props.className === "co-summary-item");
  assert.equal(nodes(summary).find(node => node.props.className === "co-reading").props.children, textWithoutReferences);
  assert.equal(nodes(summary).filter(node => node.type === "details").length, 0);
  assert.match(text(summary), /No source reference saved/);
  assert.equal(JSON.stringify(props.run), before);
  assert.deepEqual(calls, []);
});

test("overview groups its direct navigation separately from immutable summary wording", () => {
  const { props, calls } = fixture();
  const tree = AgreementOverview(props);
  const actions = nodes(tree).find(node => node.props.role === "group" && node.props["aria-label"] === "Review next actions");
  assert.ok(actions);
  assert.doesNotMatch(text(actions), /The agreement offers|Continue|Generate|Run review/);
  button(actions, "Explore findings2").props.onClick();
  button(actions, "My review1 saved").props.onClick();
  assert.deepEqual(calls, [["explore"], ["my-review"]]);
});

test("overview layout keeps readable evidence, separated next actions and visible limitation styling", () => {
  const sheet = postcss.parse(readFileSync(new URL("../src/components/workspace/WorkspaceSummaries.module.css", import.meta.url), "utf8"));
  const rules = selector => {
    const values = {};
    sheet.walkRules(rule => {
      if (rule.parent.type !== "atrule" && rule.selectors.includes(selector))
        rule.walkDecls(decl => { values[decl.prop] = decl.value; });
    });
    return values;
  };
  assert.equal(rules(".summaries :global(.co-reading)")["font-size"], "16px");
  assert.equal(rules(".summaries :global(.co-overview-evidence blockquote)")["font-size"], "16px");
  assert.equal(rules(".summaries :global(.co-overview-evidence > div > article)").border, "0");
  assert.equal(rules(".summaries :global(.co-findings-next)")["margin-top"], "24px");
  for (const selector of [".summaries :global(.co-source-coverage .co-limitation)", ".summaries :global(.co-source-coverage > [role=\"alert\"])", ".summaries :global(.co-source-coverage > .co-limitations)"])
    assert.equal(rules(selector).color, "var(--accent-amber)");
});

test("overview keeps routine provenance disclosed without hiding unknown source limitations", () => {
  const { props, calls } = fixture();
  const routine = "All successfully extracted text was supplied. Extraction and exact quote matches do not establish complete review, legal validity or correct interpretation.";
  props.run.coverage.limitations = [routine, "The incorporated service schedule was unavailable."];
  const before = JSON.stringify(props.run);
  const coverage = nodes(AgreementOverview(props)).find(node => node.props.className === "co-source-coverage");
  const children = React.Children.toArray(coverage.props.children);
  const disclosure = children.find(node => node.type === "details");
  assert.equal(disclosure.props.open, undefined);
  assert.ok(text(disclosure).includes(routine));
  assert.ok(!text(disclosure).includes("The incorporated service schedule was unavailable."));
  assert.ok(children.some(node => node.type === "ul" && text(node).includes("The incorporated service schedule was unavailable.")));
  assert.equal(JSON.stringify(props.run), before);
  assert.deepEqual(calls, []);
});

test("overview has no reserved activity panel when there is no saved work", () => {
  const { props } = fixture();
  props.personal = helpers.emptyPersonal();
  const html = render(AgreementOverview, props);
  assert.doesNotMatch(html, /<aside|co-activity|Revisit later/);
  assert.ok(button(AgreementOverview(props), "My review"));
  const details = nodes(AgreementOverview(props)).find(node => node.props.className === "co-source-details");
  assert.match(text(details), /0 saved questions · 0 to revisit/);
});

test("overview navigation invokes only its explicit callbacks and source preserves summary context", () => {
  const { props, calls, reference } = fixture();
  const tree = AgreementOverview(props);
  for (const label of ["Open original", "Explore findings2", "Plan the handover", "My review1 saved", "View page 1"])
    button(tree, label).props.onClick();
  assert.deepEqual(calls, [["original"], ["explore"], ["finding", "finding-1"], ["my-review"],
    ["source", "The agreement offers a conditional extension.", reference]]);
});

test("overview source states remain distinct without hiding saved output or running AI", () => {
  const cases = [
    [{ sourceLoading: true }, "Loading source details…"],
    [{ sourceError: "Network error" }, "Source details could not be loaded"],
    [{ source: null }, "Source details are unavailable or do not match this run"],
  ];
  for (const [overrides, message] of cases) {
    const { props, calls } = fixture(overrides);
    const html = render(AgreementOverview, props);
    assert.ok(html.includes(message));
    assert.match(html, /The agreement offers a conditional extension/);
    assert.equal(button(AgreementOverview(props), "View page 1").props.disabled, true);
    // Guard the callback too: a stale event must not navigate using unchecked source.
    button(AgreementOverview(props), "View page 1").props.onClick();
    assert.deepEqual(calls, []);
  }
});

test("overview evidence never enables navigation for a different revision or altered quotation", () => {
  for (const invalidate of [
    props => { props.source.source_revision_id = "different-source"; },
    props => { props.run.overview_items[0].evidence[0].source_revision_id = "different-source"; },
    props => { props.run.overview_items[0].evidence[0].quote = "Unsupported wording"; },
  ]) {
    const { props, calls } = fixture();
    invalidate(props);
    const action = button(AgreementOverview(props), "View page 1");
    assert.equal(action.props.disabled, true);
    action.props.onClick();
    assert.deepEqual(calls, []);
  }
});

test("overview separates extraction coverage from saved run input and retains omitted-page limits", () => {
  const { props } = fixture();
  props.source.source_extraction.page_count = 3;
  props.source.source_extraction.pages.push(
    { page_number: 2, status: "empty", text: "", spans: [] },
    { page_number: 3, status: "failed", text: "", spans: [] });
  props.run.coverage = { page_count: 3, extracted_pages: [1], omitted_pages: [2, 3], limitations: ["Attachments were unavailable."] };
  const html = render(AgreementOverview, props);
  assert.match(html, /1 of 3 source pages have extracted text/);
  assert.match(html, /2 \(no extractable text\), 3 \(extraction failed\)/);
  assert.match(html, /No OCR is performed/);
  assert.match(html, /Saved run input: 1 of 3 pages/);
  assert.match(html, /Pages omitted from this review: 2, 3/);
  assert.match(html, /Attachments were unavailable/);
  assert.match(html, /Text supplied is not proof that every provision was understood/);
  props.source.source_extraction = null;
  assert.match(render(AgreementOverview, props), /No page-aware source snapshot is available/);
});

for (const [status, message] of [
  ["processing", "This review is still processing"],
  ["failed", "No usable agreement summary was completed"],
  ["interrupted", "This run was interrupted"],
]) {
  test(`${status} overview does not present placeholder output as a completed agreement summary`, () => {
    const { props, calls } = fixture();
    props.run.status = status;
    const tree = AgreementOverview(props);
    const html = render(AgreementOverview, props);
    assert.ok(html.includes(message));
    assert.match(html, /A missing result is not a finding that the agreement has no issues/);
    assert.doesNotMatch(html, /The agreement offers a conditional extension|Legacy summary wording|Explore findings|Continue from saved position/);
    assert.ok(button(tree, "Open original"));
    assert.deepEqual(calls, []);
  });
}

test("incomplete and legacy runs retain usable saved output without an implicit restart", () => {
  const { props, calls } = fixture();
  props.run.status = "incomplete";
  assert.match(render(AgreementOverview, props), /The agreement offers a conditional extension/);
  props.run.kind = "ai";
  props.run.status = undefined;
  props.run.overview_items = [];
  const html = render(AgreementOverview, props);
  assert.match(html, /Agreement summary/);
  assert.doesNotMatch(html, /Saved AI review/);
  assert.match(html, /Legacy summary wording/);
  assert.doesNotMatch(html, /2 example findings/);
  assert.deepEqual(calls, []);
});

test("overview exposes its review controls on recovery request without calling them", () => {
  const { props, calls } = fixture({ controlsOpen: true });
  const tree = AgreementOverview(props);
  assert.equal(nodes(tree).find(node => node.props.className === "co-review-controls").props.open, true);
  assert.match(render(AgreementOverview, props), /Explicit review controls/);
  assert.deepEqual(calls, []);
  props.controlsOpen = false;
  assert.equal(nodes(AgreementOverview(props)).find(node => node.props.className === "co-review-controls").props.open, false);
  props.children = null;
  assert.doesNotMatch(render(AgreementOverview, props), /Review instructions &amp; new review/);
});

test("My review renders only confirmed questions belonging to the selected run", () => {
  const { props, calls } = fixture();
  const before = JSON.stringify(props);
  const html = render(MyReview, props);
  assert.doesNotMatch(html, /Questions and personal markers · selected run only/);
  assert.match(html, /1 confirmed question/);
  assert.match(html, /Confirm the minimum handover period/);
  assert.match(html, /Saving never sends a message, accepts a term or resolves a finding/);
  assert.doesNotMatch(html, /Question outside the selected run|Unsaved edited handover wording|Recovery draft only|Unsent paid Ask wording/);
  assert.equal(JSON.stringify(props), before);
  assert.deepEqual(calls, []);
});

test("My review keeps drafts separate when there are no confirmed saves", () => {
  const { props, calls } = fixture();
  props.personal.saved_questions = {};
  const html = render(MyReview, props);
  assert.doesNotMatch(html, /No saved questions in this run/);
  assert.match(html, /Drafts and Ask answers are excluded/);
  assert.match(html, /0 confirmed questions/);
  assert.doesNotMatch(html, /Unsaved edited handover wording|Recovery draft only|Unsent paid Ask wording/);
  assert.deepEqual(calls, []);
});

test("My review markers remain personal activity and navigate without changing save state", () => {
  const { props, calls } = fixture();
  const tree = MyReview(props);
  const html = render(MyReview, props);
  assert.match(html, /Markers are personal activity, not legal safety or completeness/);
  assert.match(html, /Reviewed by me/);
  const before = JSON.stringify(props.personal);
  for (const label of ["Explore findings", "Plan the handover", "Clarify the missing exit plan"])
    button(tree, label).props.onClick();
  assert.deepEqual(calls, [["explore"], ["finding", "finding-1"], ["finding", "finding-2"]]);
  assert.equal(JSON.stringify(props.personal), before);
});

test("My review source actions retain finding context and never claim to verify a personal question", () => {
  const { props, calls, reference } = fixture();
  const tree = MyReview(props);
  const html = render(MyReview, props);
  assert.match(html, /they do not verify your question or its interpretation/);
  const sourceButton = button(tree, "Extension conditionsView page 1");
  assert.equal(sourceButton.props.disabled, false);
  sourceButton.props.onClick();
  assert.deepEqual(calls, [["source", "finding-1", reference]]);
});

test("My review keeps saved wording accessible when source is absent, stale or mismatched", () => {
  for (const invalidate of [
    props => { props.source = null; },
    props => { props.source.source_revision_id = "different-source"; },
    props => { props.run.findings[0].evidence[0].quote = "Unsupported wording"; },
    props => { props.run.findings[0].evidence[0].source_revision_id = "different-source"; },
  ]) {
    const { props, calls } = fixture();
    invalidate(props);
    assert.match(render(MyReview, props), /Confirm the minimum handover period/);
    const sourceButton = button(MyReview(props), "Extension conditionsPage 1 · Source not matched");
    assert.equal(sourceButton.props.disabled, true);
    sourceButton.props.onClick();
    assert.deepEqual(calls, []);
  }
});

test("My review handles no-source findings without inventing citations or absence claims", () => {
  const { props } = fixture();
  props.personal.saved_questions = { "finding-2": { text: "Ask for the exit plan." } };
  const html = render(MyReview, props);
  assert.match(html, /Ask for the exit plan/);
  assert.match(html, /No source reference accompanies this finding/);
  assert.match(html, /A not-found claim is limited to the recorded review scope/);
  // All findings remain visible for triage, including another finding's valid source.
  assert.match(html, /Finding source/);
});

test("My review without a run ignores stale personal state and routes back to setup", () => {
  const { props, calls } = fixture({ run: null });
  const html = render(MyReview, props);
  assert.match(html, /No review run yet/);
  assert.match(html, /0 confirmed questions/);
  assert.doesNotMatch(html, /Confirm the minimum handover period|Plan the handover|Question outside the selected run/);
  button(MyReview(props), "Open review setup").props.onClick();
  assert.deepEqual(calls, [["explore"]]);
});
