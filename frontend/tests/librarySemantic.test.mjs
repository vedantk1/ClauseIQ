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
  vm.runInNewContext(compiled, { exports, React, encodeURIComponent, crypto: { randomUUID: () => "synthetic-request-id" },
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
  model: "text-embedding-3-small", passages: 2, input_tokens: 100, estimated_usd: "0.000002", maximum_usd: "0.004", excluded_headers: 0, partial: false };

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
    react: h.react, "@/components/ui/Modal": Modal, "@/lib/librarySemantic": api, "./LibrarySearch.module.css": {},
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
