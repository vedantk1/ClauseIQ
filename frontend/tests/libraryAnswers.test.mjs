import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

function load(path, imports) {
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, React, encodeURIComponent, crypto: { randomUUID: () => "attempt-one" },
    require(name) { assert.ok(name in imports, `Unexpected dependency ${name}`); return imports[name]; } });
  return exports;
}
function harness() {
  const state = [], refs = [], effects = [], deps = [];
  let cursor = 0, refCursor = 0, effectCursor = 0;
  return { react: { ...React,
    useState(initial) { const index = cursor++; if (!(index in state)) state[index] = initial;
      return [state[index], next => { state[index] = typeof next === "function" ? next(state[index]) : next; }]; },
    useRef(value) { return refs[refCursor++] ||= { current: value }; },
    useCallback(callback) { return callback; },
    useEffect(callback, dependencies) { const index = effectCursor++;
      // useCallback in this tiny harness is not memoized; run the mount read once.
      if (!(index in deps) || (index > 0 && dependencies.some((value, i) => value !== deps[index][i]))) effects.push(callback);
      deps[index] = dependencies; },
  }, render(Component, props) { cursor = refCursor = effectCursor = 0;
    const tree = Component(props); effects.splice(0).forEach(effect => effect()); return tree; } };
}
const nodes = tree => !tree || typeof tree !== "object" ? [] : [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)];
const text = tree => typeof tree === "string" ? tree : React.Children.toArray(tree?.props?.children).map(text).join("");
const button = (tree, label) => nodes(tree).find(node => node.type === "button" && text(node) === label);
const settle = () => new Promise(resolve => setImmediate(resolve));
const evidence = { id: "S1", filename: "Synthetic.pdf", document_id: "doc", source_revision_id: "rev", page_number: 2,
  passage_id: "p2", quote: "The exact preserved source.", continuation_after: true };
const plan = { context_id: "search-one", question: "What is payable?", method: "keyword", evidence: [evidence],
  coverage: { documents_scanned: 1, documents_in_library: 3, documents_unsearchable: 0, documents_partial: 0 },
  generation: { model_id: "gpt-6-sol", reasoning_effort: "medium", estimated_input_tokens: 400, max_completion_tokens: 6000 } };
const answer = { ...plan, request_id: "attempt-one", status: "completed", outcome: "partial", failure: null,
  statements: [{ text: "A supported interpretation.", evidence_ids: ["S1"] }], limitations: ["Another requested agreement was not supplied."] };
const Modal = props => props.isOpen ? React.createElement("div", {}, props.children) : null;
const Link = props => React.createElement("a", props, props.children);

test("answer API separates unpaid reads/preview from explicit paid dispatch; no quotes in client request", async () => {
  const calls = [];
  const api = { get: async (...args) => { calls.push(["GET", ...args]); return { success: true, data: [] }; },
    post: async (...args) => { calls.push(["POST", ...args]); return { success: true, data: answer }; } };
  const lib = load("../src/lib/libraryAnswers.ts", { "@/lib/api": api });
  await lib.recentLibraryAnswers(); await lib.previewLibraryAnswer("search-one");
  await lib.readLibraryAnswer("attempt/one"); await lib.startLibraryAnswer(plan, "attempt-one");
  assert.equal(calls[2][1], "/library/answers/attempt%2Fone");
  assert.equal(calls[2][2], undefined); // no timeout/query data in URL params
  assert.equal(calls[3][2].confirm_paid, true);
  assert.equal(calls[3][2].request_id, "attempt-one");
  assert.doesNotMatch(JSON.stringify(calls[3][2]), /quote|What is payable|preserved/);
  assert.equal(lib.statementEvidence(answer, ["S99"]), null);
  assert.equal(lib.statementEvidence(answer, ["S1", "S1"]), null);
  assert.equal(lib.statementEvidence(answer, []), null);
  assert.equal(lib.statementEvidence(answer, ["S1"])[0].quote, evidence.quote);
});

function component(h, api) {
  const helpers = load("../src/lib/libraryAnswers.ts", { "@/lib/api": {} });
  return load("../src/components/documents/LibraryAnswers.tsx", { react: h.react,
    "next/link": Link, "@/components/ui/Modal": Modal, "./LibrarySearch.module.css": {},
    "@/lib/librarySearch": { librarySearchHitHref: hit => `/workspace?page=${hit.page_number}&sourceRevisionId=${hit.source_revision_id}` },
    "@/lib/libraryAnswers": { ...helpers, ...api },
  }).LibraryAnswers;
}

test("preview/cancel/readback never dispatch; double confirmation dispatches once with partial answer and exact evidence", async () => {
  const h = harness(), calls = [];
  let finish;
  const Component = component(h, {
    recentLibraryAnswers: async () => { calls.push("list"); return []; },
    previewLibraryAnswer: async () => { calls.push("preview"); return plan; },
    startLibraryAnswer: async (value, id) => { calls.push("paid"); assert.equal(value, plan); assert.equal(id, "attempt-one");
      return await new Promise(resolve => { finish = resolve; }); },
  });
  const render = () => h.render(Component, { contextId: "search-one" });
  render(); await settle(); assert.deepEqual(calls, ["list"]);
  button(render(), "Answer from these results").props.onClick(); await settle();
  button(render(), "Cancel").props.onClick(); assert.equal(calls.filter(x => x === "paid").length, 0);
  button(render(), "Answer from these results").props.onClick(); await settle();
  const confirm = button(render(), "Generate answer · paid");
  confirm.props.onClick(); confirm.props.onClick(); await settle();
  assert.equal(calls.filter(x => x === "paid").length, 1);
  finish(answer); await settle();
  const html = renderToStaticMarkup(render());
  assert.match(html, /Partial answer/); assert.match(html, /Another requested agreement/);
  assert.match(html, /The exact preserved source/); assert.match(html, /View page 2/);
  assert.match(html, /not a complete review/);
});

test("a late preview for earlier search results cannot be confirmed or send", async () => {
  const h = harness(); let finish, paid = 0;
  const Component = component(h, { recentLibraryAnswers: async () => [],
    previewLibraryAnswer: () => new Promise(resolve => { finish = resolve; }),
    startLibraryAnswer: async () => { paid++; return answer; } });
  let contextId = "search-one";
  const render = () => h.render(Component, { contextId });
  render(); button(render(), "Answer from these results").props.onClick();
  contextId = "search-two"; render(); finish(plan); await settle();
  const modal = nodes(render()).find(node => node.type === Modal && node.props.title === "Answer from these results");
  assert.equal(modal.props.isOpen, false); assert.equal(paid, 0);
});

test("unknown outcome keeps refresh recovery unpaid and reads persisted attempts", async () => {
  const h = harness(); let paid = 0, reads = 0;
  const Component = component(h, { recentLibraryAnswers: async () => [{ request_id: "attempt-one", question: "Saved question", status: "interrupted" }],
    previewLibraryAnswer: async () => plan,
    startLibraryAnswer: async () => { paid++; throw new Error("Outcome unknown"); },
    readLibraryAnswer: async () => { reads++; return { ...answer, status: "interrupted", outcome: null, statements: [], failure: "Outcome unknown" }; },
  });
  const render = () => h.render(Component, { contextId: "search-one" });
  render(); await settle(); button(render(), "Answer from these results").props.onClick(); await settle();
  button(render(), "Generate answer · paid").props.onClick(); await settle();
  assert.equal(paid, 1); assert.match(text(render()), /Outcome unknown/);
  const saved = nodes(render()).find(node => node.type === "button" && text(node).startsWith("Saved question"));
  saved.props.onClick(); await settle();
  button(render(), "Refresh saved status").props.onClick(); await settle();
  assert.equal(paid, 1); assert.equal(reads, 1);
});
