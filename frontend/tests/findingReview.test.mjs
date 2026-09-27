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
    require(name) { assert.ok(name in imports, `Unexpected dependency: ${name}`); return imports[name]; },
  });
  return exports;
}
const stateHelpers = loadModule("../src/components/workspace/workspaceState.ts");
const controls = loadModule("../src/components/workspace/WorkspaceControls.tsx", { react: React, "./workspaceState": stateHelpers });
const icon = () => React.createElement("i", { "aria-hidden": true });

function harness(overrides = {}, { trackEffects = false } = {}) {
  let refIndex = 0;
  let effectIndex = 0;
  let pendingEffects = [];
  const refs = [];
  const effectDependencies = [];
  const mountedNodes = new Map();
  const calls = [];
  const stateSlots = [];
  let stateIndex = 0;
  const findings = Array.from({ length: 7 }, (_, index) => ({
    id: `finding-${index + 1}`, title: `Finding title ${index + 1}`, facts: `Source facts ${index + 1}`,
    interpretation: `Interpretation ${index + 1}`, uncertainty: `Uncertainty ${index + 1}`,
    next_step: `Next step ${index + 1}`, suggested_question: `Suggested question ${index + 1}`, evidence: [],
  }));
  const personal = { drafts: {}, saved_questions: {}, markers: {}, opened_finding_ids: [],
    position: { view: "findings", finding_id: findings[0].id, evidence_span_id: null } };
  const run = { id: "run-1", kind: "fixture", context: { perspective: "customer", role: "Example Customer", priorities: "Exit" }, findings };
  const state = { status: "saved", workspace: { runs: [run], personal: { [run.id]: personal }, ask_turns: [] },
    pending: 0, localDrafts: {}, localAskDrafts: {}, briefDraft: null, reviewAction: { status: "idle" }, askAction: { status: "idle" } };
  const controller = Object.fromEntries(["setDraft", "flushDrafts", "saveQuestion", "enqueue", "startAsk", "startReview"]
    .map(method => [method, (...args) => calls.push({ method, args })]));
  const props = { run, finding: findings[0], personal, state, controller, source: null, sourceReady: true,
    draft: "My local question", savedQuestion: undefined, blocked: false, selectedEvidence: null, showAsk: false,
    onFinding: id => calls.push({ method: "onFinding", args: [id] }), onSelectEvidence() {}, onOpenEvidence() {}, onAskEvidence() {},
    onShowAsk: () => calls.push({ method: "onShowAsk", args: [] }),
    onShowEvidence: () => calls.push({ method: "onShowEvidence", args: [] }), onSettings() {}, ...overrides };
  const components = loadModule("../src/components/workspace/FindingReview.tsx", {
    react: { ...React,
      useState(initial) { const index = stateIndex++; if (!(index in stateSlots)) stateSlots[index] = initial;
        return [stateSlots[index], value => { stateSlots[index] = typeof value === "function" ? value(stateSlots[index]) : value; }]; },
      useEffect(callback, dependencies) {
        if (!trackEffects) return;
        const index = effectIndex++;
        const previous = effectDependencies[index];
        if (!previous || dependencies.some((value, item) => !Object.is(value, previous[item]))) pendingEffects.push(callback);
        effectDependencies[index] = [...dependencies];
      },
      useRef: () => {
        if (!trackEffects) return { current: null };
        const index = refIndex++;
        return refs[index] ||= { current: null };
      },
    },
    "lucide-react": { ChevronRight: icon, FileText: icon, CircleHelp: icon, ArrowLeft: icon },
    "./WorkspaceControls": controls, "./workspaceState": stateHelpers,
    "./EvidenceSourcePane": { EvidenceSourcePane: () => React.createElement("p", null, "Related evidence content") },
    "./FindingAsk": { FindingAsk: () => React.createElement("p", null, "Explicit paid Ask controls") },
  });
  const tree = () => {
    refIndex = 0; effectIndex = 0; stateIndex = 0; pendingEffects = [];
    return components.FindingReview(props);
  };
  return { calls, props, findings, tree, html: () => renderToStaticMarkup(tree()),
    commit() {
      const element = tree();
      for (const node of nodes(element)) {
        if (!node.props.ref) continue;
        const key = node.props.className || node.type;
        if (!mountedNodes.has(key)) mountedNodes.set(key, { scrollTop: 0, focus() {} });
        node.props.ref.current = mountedNodes.get(key);
      }
      pendingEffects.forEach(effect => effect());
      return mountedNodes;
    },
  };
}

function nodes(node) {
  if (!node || typeof node !== "object") return [];
  if (typeof node.type === "function") return nodes(node.type(node.props));
  return [node, ...React.Children.toArray(node.props?.children).flatMap(nodes)];
}
function text(node) {
  if (typeof node === "string" || typeof node === "number") return String(node);
  return React.Children.toArray(node?.props?.children).map(text).join("");
}
const button = (h, label) => nodes(h.tree()).find(node => node.type === "button" && text(node) === label);
const railButtons = h => {
  const list = nodes(h.tree()).find(node => node.type === "ol");
  return nodes(list).filter(node => node.type === "button");
};

test("finding reading retains full long content and next-step details", () => {
  const h = harness();
  const long = "A long qualification remains part of the review. ".repeat(160);
  Object.assign(h.props.finding, { facts: `${long}FACTS END`, interpretation: `${long}INTERPRETATION END`,
    uncertainty: `${long}UNCERTAINTY END`, next_step: `${long}NEXT STEP END` });
  const html = h.html();
  for (const property of ["facts", "interpretation", "uncertainty", "next_step"]) assert.ok(html.includes(h.props.finding[property]), property);
  assert.match(html, /<h3>Possible next step<\/h3>/);
  assert.match(html, /<summary>About your status/);
  assert.doesNotMatch(html, /line-clamp/);
});

test("all findings are visible immediately without a five-item gate", () => {
  const h = harness();
  assert.equal(railButtons(h).length, 7);
  assert.equal(button(h, "View all 7"), undefined);
  assert.equal(button(h, "Show fewer findings"), undefined);
  railButtons(h)[6].props.onClick();
  assert.deepEqual(h.calls, [{ method: "onFinding", args: ["finding-7"] }]);
  h.props.finding = h.findings[6];
  assert.equal(railButtons(h).length, 7);
  assert.equal(railButtons(h)[6].props["aria-current"], "true");
  assert.match(text(railButtons(h)[6]), /^07Finding title 7/);
});

test("the compact rail retains the count, non-exhaustive scope and both personal annotations", () => {
  const h = harness();
  h.props.personal.markers["finding-1"] = "revisit";
  h.props.personal.saved_questions["finding-1"] = { text: "Confirmed question" };
  const html = h.html();
  assert.match(html, /aria-label="7 findings"/);
  assert.match(html, /Examples · Not exhaustive/);
  assert.match(text(railButtons(h)[0]), /Revisit · Question saved/);
  assert.equal(nodes(railButtons(h)[0]).filter(node => node.props.className === "cw-finding-meta").length, 1);
  assert.deepEqual(h.calls, []);
});

test("opening Ask switches the centre panel while evidence stays visible and sends nothing", () => {
  const h = harness();
  assert.deepEqual(h.calls, []);
  assert.equal(button(h, "Ask").props["aria-pressed"], false);
  button(h, "Ask").props.onClick();
  assert.deepEqual(h.calls, [{ method: "onShowAsk", args: [] }]);
  h.props.showAsk = true;
  assert.equal(button(h, "Ask").props["aria-pressed"], true);
  const companion = nodes(h.tree()).find(node => node.props?.id === "finding-companion");
  assert.equal(companion.props["aria-label"], "Evidence for the selected finding");
  const evidencePane = nodes(companion).find(node => node.type === "div" && node.props.hidden === true);
  assert.equal(evidencePane, undefined);
  button(h, "Review").props.onClick();
  assert.deepEqual(h.calls.map(call => call.method), ["onShowAsk", "onShowEvidence"]);
});

test("question editor is deliberately opened and closed while saved work and separate Ask remain available", () => {
  const h = harness();
  const editor = () => nodes(h.tree()).find(node => node.props.className === "cw-question");
  assert.equal(editor().props.hidden, true);
  button(h, "Keep question").props.onClick();
  assert.equal(editor().props.hidden, false);
  button(h, "Close editor").props.onClick();
  assert.equal(editor().props.hidden, true);
  assert.deepEqual(h.calls.map(call => call.method), ["onShowEvidence", "flushDrafts"]);
});

test("answer references preview in the evidence companion before an explicit original-page jump", () => {
  const h = harness({ showAsk: true });
  function raw(node) { if (!React.isValidElement(node)) return []; return [node, ...React.Children.toArray(node.props.children).flatMap(raw)]; }
  const ask = raw(h.tree()).find(node => node.props.reviewQuestion !== undefined);
  const evidence = { span_id: "answer-span", page_number: 22, quote: "Unchanged source words", label: "Answer reference" };
  ask.props.onEvidence("The answer's actual claim", evidence);
  assert.deepEqual(h.calls, []);
  const pane = raw(h.tree()).find(node => node.props.heading === "Answer evidence");
  assert.equal(pane.props.finding.evidence[0], evidence);
  assert.ok(button(h, "← Finding evidence"));
  button(h, "← Finding evidence").props.onClick();
  assert.equal(raw(h.tree()).find(node => node.props.heading === "Answer evidence"), undefined);
});

test("draft edits and explicit saved questions use local controller operations only", () => {
  const h = harness();
  const draft = nodes(h.tree()).find(node => node.type === "textarea" && node.props.id === "question-draft");
  draft.props.onChange({ target: { value: "Updated local wording" } });
  draft.props.onBlur();
  button(h, "Save question").props.onClick();
  assert.deepEqual(h.calls, [
    { method: "setDraft", args: ["run-1", "finding-1", "Updated local wording"] },
    { method: "flushDrafts", args: [] },
    { method: "saveQuestion", args: ["run-1", "finding-1", "My local question"] },
  ]);
  assert.match(h.html(), /Local draft — save to add it to My review/);
  h.props.draft = " ";
  assert.equal(button(h, "Save question").props.disabled, true);
  h.props.draft = "Saved exactly";
  h.props.savedQuestion = { text: "Saved exactly" };
  assert.equal(button(h, "Update saved question"), undefined);
  assert.match(h.html(), /class="cw-question-saved" role="status">Saved in My review/);
  assert.equal(nodes(h.tree()).filter(node => node.props.role === "status").length, 1);
});

test("editing a confirmed question restores the explicit update action and keeps saved wording", () => {
  const h = harness({ savedQuestion: { text: "Last confirmed question" }, draft: "Last confirmed question" });
  assert.equal(button(h, "Update saved question"), undefined);
  h.props.draft = "New wording not yet saved";
  assert.equal(button(h, "Update saved question").props.disabled, false);
  assert.doesNotMatch(h.html(), /cw-question-saved/);
  assert.match(h.html(), /<blockquote class="cw-saved-wording">Last confirmed question<\/blockquote>/);
  button(h, "Update saved question").props.onClick();
  assert.deepEqual(h.calls, [{ method: "saveQuestion", args: ["run-1", "finding-1", "New wording not yet saved"] }]);
});

for (const [status, pending, message] of [
  ["saved", 1, "Workspace changes are not yet confirmed"],
  ["saving", 0, "Workspace changes are not yet confirmed"],
  ["loading", 0, "Loading saved workspace state"],
  ["failed", 1, "Save not confirmed"],
  ["conflict", 1, "Pending changes need review"],
  ["review", 1, "Pending changes need review"],
]) {
  test(`unchanged question does not imply all work is saved during ${status} with ${pending} pending`, () => {
    const h = harness({ savedQuestion: { text: "Confirmed wording" }, draft: "Confirmed wording" });
    h.props.state.status = status;
    h.props.state.pending = pending;
    h.props.blocked = ["loading", "failed", "conflict", "review"].includes(status);
    assert.doesNotMatch(h.html(), /cw-question-saved/);
    assert.ok(h.html().includes(message));
    assert.match(h.html(), /Confirmed wording/);
    assert.equal(button(h, "Update saved question").props.disabled, true);
    assert.deepEqual(h.calls, []);
  });
}

test("failed saves retain local and last confirmed wording without a success claim", () => {
  const h = harness({ savedQuestion: { text: "Last confirmed question" }, draft: "New local wording", blocked: true });
  h.props.state.status = "failed";
  h.props.state.pending = 1;
  assert.match(h.html(), /Save not confirmed. Keep this page open/);
  assert.match(h.html(), /New local wording/);
  assert.match(h.html(), /<blockquote class="cw-saved-wording">Last confirmed question<\/blockquote>/);
  assert.doesNotMatch(h.html(), /Saved in My review/);
  assert.equal(button(h, "Update saved question").props.disabled, true);
  button(h, "Ask").props.onClick();
  assert.deepEqual(h.calls, [{ method: "onShowAsk", args: [] }]);
});

test("markers remain explicit and navigation does not mark a finding reviewed", () => {
  const h = harness();
  railButtons(h)[1].props.onClick();
  assert.deepEqual(h.calls.map(call => call.method), ["onFinding"]);
  const marker = nodes(h.tree()).find(node => node.type === "select" && node.props.className === "cw-marker");
  assert.equal(marker.props.value, "not_marked");
  marker.props.onChange({ target: { value: "reviewed_by_me" } });
  assert.equal(h.calls[1].method, "enqueue");
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls[1].args)), [{
    type: "set_marker", run_id: "run-1", finding_id: "finding-1", marker: "reviewed_by_me",
  }]);
  assert.match(h.html(), /Opening or saving does not set it/);
  h.props.blocked = true;
  assert.equal(nodes(h.tree()).find(node => node.type === "select" && node.props.className === "cw-marker").props.disabled, true);
  assert.equal(button(h, "Save question").props.disabled, true);
});

test("not-found scope and changed saved questions remain visible outside collapsed details", () => {
  const h = harness({ savedQuestion: { text: "Last confirmed question" } });
  h.props.finding.basis = "not_found";
  h.props.finding.coverage_basis = "Only the supplied service schedule was reviewed.";
  const html = h.html();
  const readingBeforeDisclosure = html.split('<details class="cw-finding-details">')[0];
  assert.match(readingBeforeDisclosure, /Not found within the reviewed scope/);
  assert.match(readingBeforeDisclosure, /Only the supplied service schedule was reviewed/);
  assert.match(readingBeforeDisclosure, /not proof of absence from the original/);
  assert.match(html, /Draft changed. Your last saved question is retained below/);
  assert.match(html, /<blockquote class="cw-saved-wording">Last confirmed question<\/blockquote>/);
  assert.match(html, /My local question/);
  assert.match(html, /Update saved question/);
});

test("conflict comparison retains both latest stored and local drafts", () => {
  const h = harness();
  h.props.state.status = "review";
  h.props.personal.drafts["finding-1"] = "Someone else's saved wording";
  const html = h.html();
  assert.match(html, /Latest saved draft from the workspace/);
  assert.match(html, /Someone else&#x27;s saved wording/);
  assert.match(html, /My local question/);
  assert.match(html, /Apply pending changes only after comparing both/);
});

test("reading and companion scroll reset for a different finding or run, not normal edits", () => {
  const h = harness({}, { trackEffects: true });
  const mounted = h.commit();
  const reading = mounted.get("cw-finding-body");
  const companion = mounted.get("cw-companion");
  assert.ok(reading && companion);
  reading.scrollTop = 760; companion.scrollTop = 430;
  h.props.draft = "Typing should keep my reading position";
  h.props.state = { ...h.props.state, pending: 1 };
  h.commit();
  assert.equal(reading.scrollTop, 760);
  assert.equal(companion.scrollTop, 430);
  h.props.finding = h.findings[1];
  h.commit();
  assert.equal(reading.scrollTop, 0);
  assert.equal(companion.scrollTop, 0);
  reading.scrollTop = 420; companion.scrollTop = 280;
  h.props.run = { ...h.props.run, id: "another-run" };
  h.commit();
  assert.equal(reading.scrollTop, 0);
  assert.equal(companion.scrollTop, 0);
});

test("opening and closing Ask preserves reading and evidence scroll positions", () => {
  const h = harness({}, { trackEffects: true });
  const mounted = h.commit();
  const reading = mounted.get("cw-finding-body");
  const companion = mounted.get("cw-companion");
  reading.scrollTop = 640; companion.scrollTop = 330;
  h.props.showAsk = true;
  h.commit();
  assert.equal(reading.scrollTop, 640);
  assert.equal(companion.scrollTop, 330);
  companion.scrollTop = 900;
  h.props.showAsk = false;
  h.commit();
  assert.equal(reading.scrollTop, 640);
  assert.equal(companion.scrollTop, 900);
  assert.deepEqual(h.calls, []);
});
