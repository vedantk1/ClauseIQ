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
  vm.runInNewContext(compiled, { exports, React, URLSearchParams, encodeURIComponent, Number, Error,
    require(name) { assert.ok(name in imports, `Unexpected dependency: ${name}`); return imports[name]; },
  });
  return exports;
}

const calls = [];
const api = { post: async (endpoint, body) => {
  calls.push([endpoint, body]);
  return { success: true, data: { results: [], coverage: {} } };
} };
const search = loadModule("../src/lib/librarySearch.ts", { "@/lib/api": api });
const source = (revision = "rev-1", pageCount = 25) => ({ source_revision_id: revision,
  source_extraction: { page_count: pageCount, pages: Array.from({ length: pageCount }, (_, index) => ({ page_number: index + 1 })) } });

test("agreement-text request stays in POST body and navigation links contain only source coordinates", async () => {
  calls.length = 0;
  await search.searchAgreementText("Service Credits");
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "/library/search");
  assert.equal(calls[0][1].query, "Service Credits");
  const href = search.librarySearchHitHref({ document_id: "doc/one", source_revision_id: "rev&2", page_number: 15 });
  assert.equal(href, "/workspace?documentId=doc%2Fone&sourceRevisionId=rev%262&page=15&from=library-search");
  assert.doesNotMatch(href, /Service|Credits|query=/);
  assert.equal(search.librarySearchHitHref({ document_id: "doc", source_revision_id: "", page_number: 1 }), null);
  assert.equal(search.librarySearchHitHref({ document_id: "doc", source_revision_id: "rev", page_number: 0 }), null);
});

test("source-page links reject malformed, stale and out-of-range targets without a fallback page", () => {
  assert.equal(search.parseLibrarySourceTarget(new URLSearchParams()).kind, "none");
  for (const query of ["page=4", "sourceRevisionId=rev", "sourceRevisionId=rev&page=0",
    "sourceRevisionId=rev&page=1.5", "sourceRevisionId=rev&page=999999999999999999999999"]) {
    assert.equal(search.parseLibrarySourceTarget(new URLSearchParams(query)).kind, "invalid", query);
  }
  const parsed = search.parseLibrarySourceTarget(new URLSearchParams("sourceRevisionId=rev-1&page=25"));
  assert.equal(parsed.kind, "target");
  assert.equal(search.librarySourceTargetError(parsed.target, source()), null);
  assert.match(search.librarySourceTargetError(parsed.target, source("rev-2")), /earlier source revision/);
  assert.match(search.librarySourceTargetError(parsed.target, source("rev-1", 24)), /no longer available/);
  assert.match(search.librarySourceTargetError(parsed.target, { source_revision_id: "rev-1" }), /no longer available/);
});

test("Library search keeps filename filtering separate and exposes bounded coverage", async () => {
  let cursor = 0;
  const state = [];
  const refs = [];
  let refCursor = 0;
  const react = { ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], value => { state[index] = typeof value === "function" ? value(state[index]) : value; }];
    },
    useRef(initial) { const index = refCursor++; return refs[index] ||= { current: initial }; },
  };
  const Link = ({ children, ...props }) => React.createElement("a", props, children);
  const { LibrarySearch } = loadModule("../src/components/documents/LibrarySearch.tsx", {
    "@/lib/librarySemantic": { searchSemantic: () => { throw new Error("Keyword must not call a provider"); } },
    "./LibrarySemanticPanel": { LibrarySemanticPanel: () => null },
    "./LibraryAnswers": { LibraryAnswers: () => null },
    react, "next/link": Link, "lucide-react": { Search: props => React.createElement("svg", props) },
    "@/lib/librarySearch": { ...search, searchAgreementText: async query => {
      assert.equal(query, "Archive exit");
      return { results: [{ document_id: "doc", filename: "Synthetic terms.pdf", source_revision_id: "rev-1",
        page_number: 25, passage_id: "p25", excerpt: "the original wording", excerpt_partial: true, source_incomplete: true }],
        coverage: { documents_in_library: 9, documents_scanned: 5, documents_not_examined: 4, documents_searchable: 3,
          documents_unsearchable: 1, documents_partial: 1, passages_examined: 40,
          matched_passages: 1, results_truncated: true, scan_truncated: true } };
    } }, "./LibrarySearch.module.css": { search: "search", heading: "heading", form: "form",
      inputWrap: "inputWrap", srOnly: "srOnly", results: "results", resultHeading: "resultHeading",
      list: "list", hit: "hit", hitMeta: "hitMeta", filename: "filename", excerpt: "excerpt" },
  });
  function render() { cursor = 0; refCursor = 0; return LibrarySearch(); }
  const tree = render();
  const form = React.Children.toArray(tree.props.children).find(child => child.type === "form");
  const label = React.Children.toArray(form.props.children).find(child => child.type === "label");
  const input = React.Children.toArray(label.props.children).find(child => child.type === "input");
  input.props.onChange({ target: { value: "Archive exit" } });
  const next = render();
  const nextForm = React.Children.toArray(next.props.children).find(child => child.type === "form");
  nextForm.props.onSubmit({ preventDefault() {} });
  await new Promise(resolve => setImmediate(resolve));
  const html = renderToStaticMarkup(render());
  assert.match(html, /Search agreement text/);
  assert.match(html, /Scanned 5 of 9 agreements; 4 were not examined/);
  assert.match(html, /1 could not be searched/);
  assert.match(html, /1 had partial text/);
  assert.match(html, /Excerpt clipped from source passage/);
  assert.match(html, /View page 25/);
  assert.doesNotMatch(html, /query=Archive|Search agreements/);
});
