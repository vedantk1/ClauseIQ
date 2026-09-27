import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import ts from "typescript";

function load(path, imports) {
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, React, Error, encodeURIComponent, crypto: { randomUUID: () => "synthetic-request-id" },
    require(name) { assert.ok(name in imports, `Unexpected dependency ${name}`); return imports[name]; } });
  return exports;
}
function harness() {
  const state = [], refs = [];
  let cursor = 0, refCursor = 0, effectUsed = false;
  const effects = [];
  return {
    react: { ...React,
      useState(value) { const index = cursor++; if (!(index in state)) state[index] = value;
        return [state[index], next => { state[index] = typeof next === "function" ? next(state[index]) : next; }]; },
      useRef(value) { return refs[refCursor++] ||= { current: value }; },
      useCallback(callback) { return callback; },
      useEffect(callback) { if (!effectUsed) { effectUsed = true; effects.push(callback); } },
    },
    render(Component) { cursor = 0; refCursor = 0; const tree = Component(); effects.splice(0).forEach(effect => effect()); return tree; },
  };
}
function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  return [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)];
}
const text = tree => typeof tree === "string" ? tree : React.Children.toArray(tree?.props?.children).map(text).join("");
const button = (tree, label) => nodes(tree).find(item => item.type === "button" && text(item) === label);
const settle = () => new Promise(resolve => setImmediate(resolve));
const plan = { document_id: "doc", filename: "Synthetic.pdf", fingerprint: "hash", expected_generation: null,
  model: "text-embedding-3-large", dimensions: 3072, passages: 2, input_tokens: 100, estimated_usd: "0.000013", maximum_usd: "0.026", excluded_headers: 0, partial: false };

test("semantic API keeps query out of URL and carries explicit paid/idempotency intent", async () => {
  const calls = [];
  const api = {
    get: async path => { calls.push(["GET", path]); return { success: true, data: {} }; },
    post: async (path, body) => { calls.push(["POST", path, body]); return { success: true, data: {} }; },
  };
  const lib = load("../src/lib/librarySemantic.ts", { "@/lib/api": api });
  await lib.semanticStatus();
  await lib.previewIndex("doc/one");
  assert.equal(calls[1][1], "/library/semantic/documents/doc%2Fone/plan");
  assert.equal(calls[0][0], "GET");
  await lib.indexAgreement(plan, "request-1");
  await lib.searchSemantic("private query", "request-2");
  assert.equal(calls[2][2].confirm_paid, true);
  assert.equal(calls[2][2].request_id, "request-1");
  assert.equal(calls[3][2].query, "private query");
  assert.equal(calls[3][2].request_id, "request-2");
  assert.doesNotMatch(calls[3][1], /private|query=/);
});

test("index panel status and preview are unpaid; confirmation and removal are deliberate", async () => {
  const h = harness(), calls = [];
  let ready = false;
  const Modal = props => props.isOpen ? React.createElement("div", props, props.children) : null;
  const api = {
    semanticStatus: async () => { calls.push("status"); return { indexed_documents: ready ? 1 : 0, documents_in_library: 1,
      documents_not_examined: 0, documents: [{ document_id: "doc", filename: "Synthetic.pdf", status: ready ? "ready" : "not_indexed",
        generation_id: ready ? "generation" : null, partial: false }] }; },
    previewIndex: async () => { calls.push("preview"); return plan; },
    indexAgreement: async (selected, id) => { calls.push("index"); assert.equal(selected, plan); assert.equal(id, "synthetic-request-id"); ready = true; return { status: "ready" }; },
    removeIndex: async () => { calls.push("remove"); ready = false; },
  };
  const { LibrarySemanticPanel } = load("../src/components/documents/LibrarySemanticPanel.tsx", {
    react: h.react, "@/components/ui/Modal": Modal, "@/lib/librarySemantic": api, "./LibrarySemanticPanel.module.css": {},
  });
  let tree = h.render(LibrarySemanticPanel); await settle();
  assert.deepEqual(calls, ["status"]);
  tree = h.render(LibrarySemanticPanel);
  button(tree, "Preview indexing").props.onClick(); await settle();
  tree = h.render(LibrarySemanticPanel);
  assert.deepEqual(calls, ["status", "preview"]);
  const dialog = nodes(tree).find(item => item.type === Modal && item.props.title === "Index agreement for semantic search");
  assert.equal(dialog.props.isOpen, true);
  assert.match(text(dialog), /sends extracted text to OpenAI/);
  assert.match(text(dialog), /Settings key/);
  assert.match(text(dialog), /Estimated \$0\.000013/);
  assert.match(text(dialog), /Request ceiling \$0\.026/);
  assert.match(text(dialog), /No automatic retry/);
  assert.match(text(dialog), /interrupted attempt may still incur a charge/);
  button(dialog, "Index agreement · paid").props.onClick(); await settle();
  assert.deepEqual(calls, ["status", "preview", "index", "status"]);
  tree = h.render(LibrarySemanticPanel);
  button(tree, "Remove index").props.onClick(); await settle();
  tree = h.render(LibrarySemanticPanel);
  assert.equal(calls.filter(call => call === "remove").length, 0);
  const remove = nodes(tree).find(item => item.type === Modal && item.props.title === "Remove semantic index");
  assert.equal(remove.props.isOpen, true);
  button(remove, "Remove index").props.onClick(); await settle();
  assert.equal(calls.filter(call => call === "remove").length, 1);
});

test("ready index management is compact and keeps unpaid refresh inside the collapsed disclosure", async () => {
  const h = harness(), calls = [];
  const Modal = () => null;
  const { LibrarySemanticPanel } = load("../src/components/documents/LibrarySemanticPanel.tsx", {
    react: h.react, "@/components/ui/Modal": Modal, "./LibrarySemanticPanel.module.css": {},
    "@/lib/librarySemantic": {
      semanticStatus: async () => { calls.push("status"); return { indexed_documents: 1, documents_in_library: 1,
        documents_not_examined: 0, documents: [{ document_id: "doc", filename: "Synthetic.pdf", status: "ready", partial: false }] }; },
      previewIndex: () => { throw new Error("No preview from navigation"); },
      indexAgreement: () => { throw new Error("No paid call from navigation"); },
      removeIndex: () => { throw new Error("No removal from navigation"); },
    },
  });
  h.render(LibrarySemanticPanel); await settle();
  const tree = h.render(LibrarySemanticPanel);
  const management = nodes(tree).find(node => node.type === "details");
  assert.equal(management.props.open, undefined);
  const summary = nodes(management).find(node => node.type === "summary");
  assert.match(text(summary), /1 of 1 indexed/);
  assert.match(text(summary), /Manage index/);
  assert.ok(button(management, "Refresh status"));
  assert.ok(!nodes(tree).some(node => node.props["aria-label"] === "Index coverage limits"));
  assert.doesNotMatch(text(tree), /Semantic searches send your query|Keyword stays free/);
  assert.deepEqual(calls, ["status"]);
  button(management, "Refresh status").props.onClick(); await settle();
  assert.deepEqual(calls, ["status", "status"]);
});

test("collapsed index management leaves missing, stale, incomplete and uncertain coverage visible", async () => {
  const h = harness();
  const states = ["ready", "not_indexed", "stale", "missing_vectors", "failed", "interrupted", "unavailable", "processing"];
  const { LibrarySemanticPanel } = load("../src/components/documents/LibrarySemanticPanel.tsx", {
    react: h.react, "@/components/ui/Modal": () => null, "./LibrarySemanticPanel.module.css": {},
    "@/lib/librarySemantic": {
      semanticStatus: async () => ({ indexed_documents: 1, documents_in_library: 10, documents_not_examined: 2,
        documents: states.map((status, index) => ({ document_id: `document-${index}`, filename: "Synthetic.pdf", status,
          partial: index === 0, failure: status === "failed" ? "Synthetic storage failure" : null })) }),
    },
  });
  h.render(LibrarySemanticPanel); await settle();
  const tree = h.render(LibrarySemanticPanel);
  const management = nodes(tree).find(node => node.type === "details");
  const limits = nodes(tree).find(node => node.props["aria-label"] === "Index coverage limits");
  assert.ok(limits);
  assert.ok(!nodes(management).includes(limits), "coverage must remain outside the collapsed content");
  for (const expected of ["1 not indexed", "1 outdated", "1 incomplete", "1 failed", "1 interrupted · outcome unknown",
    "1 without usable text", "1 indexing", "1 with partial text", "2 not examined"]) assert.ok(text(limits).includes(expected));
  assert.match(text(management), /Synthetic storage failure/);
  assert.match(text(management), /Synthetic.pdf · ment-0/);
});

test("an unavailable index status is visible without claiming coverage or triggering a paid action", async () => {
  const h = harness(), calls = [];
  const { LibrarySemanticPanel } = load("../src/components/documents/LibrarySemanticPanel.tsx", {
    react: h.react, "@/components/ui/Modal": () => null, "./LibrarySemanticPanel.module.css": {},
    "@/lib/librarySemantic": {
      semanticStatus: async () => { calls.push("status"); throw new Error("Synthetic index status failure"); },
    },
  });
  h.render(LibrarySemanticPanel); await settle();
  const tree = h.render(LibrarySemanticPanel);
  assert.match(text(nodes(tree).find(node => node.type === "summary")), /Index status unavailable/);
  assert.match(text(nodes(tree).find(node => node.props.role === "alert")), /Synthetic index status failure/);
  assert.deepEqual(calls, ["status"]);
});

test("mode switches never dispatch; semantic search has a paid submit and ignores stale responses", async () => {
  const h = harness();
  const calls = [];
  let resolve;
  const { LibrarySearch } = load("../src/components/documents/LibrarySearch.tsx", {
    react: h.react, "next/link": props => React.createElement("a", props),
    "lucide-react": { Search: () => null }, "./LibrarySearch.module.css": {},
    "./LibrarySemanticPanel": { LibrarySemanticPanel: () => null },
    "./LibraryAnswers": { LibraryAnswers: () => null },
    "@/lib/librarySearch": { searchAgreementText: () => { throw new Error("Not keyword"); }, librarySearchHitHref: () => null },
    "@/lib/librarySemantic": { searchSemantic: (query, id) => {
      calls.push([query, id]); return new Promise(done => { resolve = done; });
    } },
  });
  let tree = h.render(LibrarySearch);
  button(tree, "Semantic · paid").props.onClick();
  tree = h.render(LibrarySearch);
  assert.equal(calls.length, 0);
  assert.ok(button(tree, "Search semantic · paid"));
  nodes(tree).find(node => node.type === "input").props.onChange({ target: { value: "Archive obligations" } });
  tree = h.render(LibrarySearch);
  nodes(tree).find(node => node.type === "form").props.onSubmit({ preventDefault() {} });
  // A repeated submit before React renders the disabled state must not pay twice.
  nodes(tree).find(node => node.type === "form").props.onSubmit({ preventDefault() {} });
  await settle();
  assert.deepEqual(calls, [["Archive obligations", "synthetic-request-id"]]);
  tree = h.render(LibrarySearch);
  button(tree, "Keyword · free").props.onClick();
  resolve({ results: [{ excerpt: "old semantic answer" }], coverage: {} }); await settle();
  tree = h.render(LibrarySearch);
  assert.ok(button(tree, "Search text"));
  assert.doesNotMatch(text(tree), /old semantic answer/);
  assert.equal(calls.length, 1);
});
