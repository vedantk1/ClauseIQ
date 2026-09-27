import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import ts from "typescript";

function elements(node, predicate) {
  if (!node || typeof node !== "object") return [];
  return [...(predicate(node) ? [node] : []),
    ...React.Children.toArray([node.props?.children, node.props?.toolbarLeading, node.props?.toolbarActions]).flatMap(child => elements(child, predicate))];
}

function text(node) {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node !== "object") return String(node);
  return React.Children.toArray([node.props?.children, node.props?.toolbarLeading, node.props?.toolbarActions]).map(text).join(" ");
}

function harness(initial = {}, presentationOverrides = {}) {
  const slots = [];
  let effects = [];
  let cursor = 0;
  let tree;
  let props = { documentId: "synthetic-document", filename: "synthetic.pdf", source: null, finding: null,
    evidence: null, navigationRequest: undefined, onReturn() {}, ...initial };
  const PDFViewer = () => null;
  const evidenceCalls = [];
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL("../src/components/workspace/DocumentWorkspace.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    require(name) {
      if (name === "react") return { ...React, useRef(initialValue) {
        const index = cursor++;
        slots[index] ??= { current: initialValue };
        return slots[index];
      }, useEffect(callback, deps) {
        const index = cursor++;
        const previous = slots[index];
        if (!previous || deps.some((value, offset) => value !== previous.deps[offset])) effects.push(callback);
        slots[index] = { deps };
      }, useState(initialValue) {
        const index = cursor++;
        slots[index] ??= { value: initialValue };
        return [slots[index].value, next => { slots[index].value = typeof next === "function" ? next(slots[index].value) : next; }];
      } };
      if (name === "@/components/PDFViewer") return PDFViewer;
      if (name === "./evidencePresentation") return { presentEvidence(evidence, source) {
        evidenceCalls.push({ evidence, source });
        return { matchLabel: "Quote matched to source", scope: "Saved excerpt", matched: true, ...presentationOverrides };
      } };
      if (name.endsWith(".module.css")) return new Proxy({}, { get: (_, key) => key === "__esModule" ? false : `document-${String(key)}` });
      assert.fail(`Unexpected dependency: ${name}`);
    },
    fetch() { assert.fail("Document presentation must not request data or AI"); },
  });
  return {
    render(next = {}) { props = { ...props, ...next }; cursor = 0; effects = []; tree = exports.DocumentWorkspace(props); return tree; },
    flushEffects() { effects.forEach(callback => callback()); effects = []; },
    find(predicate) { return elements(tree, predicate)[0]; },
    all(predicate) { return elements(tree, predicate); },
    viewer() { return elements(tree, node => node.type === PDFViewer)[0].props; },
    text() { return text(tree); },
    button(label) {
      const action = elements(tree, node => node.type === PDFViewer)[0]?.props.toolbarActions;
      return [...elements(tree, node => node.type === "button"), ...elements(action, node => node.type === "button")]
        .find(node => text(node).includes(label) || node.props["aria-label"] === label);
    },
    evidenceCalls,
  };
}

const finding = { id: "finding-1", title: "Plan the exit", facts: "Transition assistance lasts sixty days." };
const evidence = { id: "evidence-1", label: "Exit assistance", page_number: 2, span_id: "span-2", quote: "sixty days" };
const source = { source_revision_id: "revision-1", source_extraction: { pages: [
  { page_number: 1, text: "First physical page.\nOriginal extraction order.", spans: [] },
  { page_number: 2, text: "Second physical page contains sixty days.", spans: [] },
] } };

test("direct Document reading has no unrelated finding context and extraction starts closed", () => {
  const h = harness({ finding, source });
  const tree = h.render();
  assert.equal(tree.type, "section");
  assert.equal(tree.props["aria-label"], "Document reader");
  assert.equal(tree.props.className, "document-workspace");
  assert.equal(h.all(node => node.type === "header").length, 0, "plain reading has no empty context bar");
  assert.equal(h.viewer().toolbarActions.props["aria-controls"], "document-extracted-text");
  assert.doesNotMatch(h.text(), /Plan the exit|Transition assistance|Return to|Saved extraction/);
  assert.equal(h.all(node => node.type === "details").length, 0);
  assert.equal(h.all(node => node.type === "aside").length, 0);
  assert.equal(h.button("Extracted text").props["aria-expanded"], false);
  assert.equal(h.evidenceCalls.length, 0);
});

test("source context is a compact closed disclosure and forwards exact physical navigation", () => {
  const request = { requestId: 7, pageNumber: 2 };
  let returned = 0;
  const h = harness({ finding, evidence, source, navigationRequest: request, onReturn: () => { returned += 1; } });
  h.render();
  const details = h.find(node => node.type === "details");
  assert.ok(details);
  assert.notEqual(details.props.open, true);
  assert.equal(h.find(node => node.type === "summary").props["aria-label"], "Source reference · page 2");
  assert.equal(text(h.find(node => node.type === "blockquote")), evidence.quote);
  assert.match(h.text(), /Quote matched to source\s*\.\s*Saved excerpt\s*; may begin or end mid-clause/);
  assert.match(h.text(), /No guessed highlight is applied/);
  assert.equal(h.viewer().navigationRequest, request);
  assert.equal(h.viewer().sourceRevisionId, source.source_revision_id);
  assert.equal(h.viewer().documentId, "synthetic-document");
  assert.equal(h.viewer().fileName, "synthetic.pdf");
  assert.equal(h.viewer().highlightedClause, undefined);
  assert.equal(returned, 0);
  h.button("Return to this finding").props.onClick();
  assert.equal(returned, 1);
});

test("citation return and context share the PDF toolbar and context dismisses with Escape", () => {
  const h = harness({ finding, evidence, source });
  h.render();
  assert.equal(h.all(node => node.type === "header").length, 0, "citations must not add a second reader bar");
  const leading = h.viewer().toolbarLeading;
  const details = elements(leading, node => node.type === "details");
  assert.equal(details.length, 1);
  assert.ok(elements(leading, node => node.type === "button").some(node => text(node).includes("Return")));
  assert.ok(elements(details[0], node => node.type === "h2").some(node => text(node) === finding.title));
  let focused = false;
  const target = { open: true, querySelector: () => ({ focus() { focused = true; } }) };
  details[0].props.onKeyDown({ key: "Escape", currentTarget: target, stopPropagation() {} });
  assert.equal(target.open, false);
  assert.equal(focused, true);
  target.open = true;
  focused = false;
  h.button("Close review context").props.onClick({ currentTarget: { closest: () => target } });
  assert.equal(target.open, false);
  assert.equal(focused, true, "explicit close returns focus to Context");
});

test("Library return uses the reader toolbar without a placeholder source heading", () => {
  let returned = false;
  const h = harness({ source, returnLabel: "Return to Library", onReturn() { returned = true; } });
  h.render();
  assert.equal(h.all(node => node.type === "header" || node.type === "details").length, 0);
  assert.doesNotMatch(h.text(), /Agreement source/);
  const action = elements(h.viewer().toolbarLeading, node => node.type === "button")[0];
  assert.match(text(action), /Return to Library/);
  action.props.onClick();
  assert.equal(returned, true);
});

test("overview, Ask and My review preserve distinct return context without finding facts", () => {
  const h = harness({ finding, evidence, source, overviewText: "Agreement overview excerpt." });
  h.render();
  assert.match(h.text(), /Agreement overview excerpt/);
  assert.ok(h.button("Return to overview"));
  assert.doesNotMatch(h.text(), /Transition assistance lasts/);
  h.render({ overviewText: undefined, answerText: "A saved Ask response.", returnLabel: "Return to Ask answer" });
  assert.match(h.text(), /A saved Ask response/);
  assert.match(h.text(), /A wording match is not legal verification/);
  assert.ok(h.button("Return to Ask answer"));
  assert.doesNotMatch(h.text(), /Transition assistance lasts|Agreement overview excerpt/);
  h.render({ answerText: undefined, returnLabel: "Return to My review" });
  assert.ok(h.button("Return to My review"));
});

test("extraction is an explicit side panel following physical PDF page changes", () => {
  const h = harness({ source });
  h.render();
  h.button("Extracted text").props.onClick();
  h.render();
  assert.equal(h.button("Hide extracted text").props["aria-expanded"], true);
  assert.equal(h.find(node => node.type === "aside").props["aria-label"], "Extracted text on page 1");
  assert.match(h.text(), /First physical page/);
  assert.match(h.text(), /Saved extraction output, not the PDF layout/);
  h.viewer().onPageChange(2);
  h.render();
  assert.equal(h.find(node => node.type === "aside").props["aria-label"], "Extracted text on page 2");
  assert.match(h.text(), /Second physical page contains sixty days/);
  assert.doesNotMatch(h.text(), /First physical page/);
  h.button("Close extracted text").props.onClick();
  h.render();
  assert.equal(h.all(node => node.type === "aside").length, 0);
  assert.equal(h.button("Extracted text").props["aria-expanded"], false);
});

test("missing extraction does not prevent the original PDF and has an honest empty state", () => {
  const h = harness({ source: null, navigationRequest: { requestId: 1, pageNumber: 9 } });
  h.render();
  assert.equal(h.viewer().sourceRevisionId, undefined);
  h.button("Extracted text").props.onClick();
  h.render();
  assert.equal(h.find(node => node.type === "aside").props["aria-label"], "Extracted text on page 9");
  assert.match(h.text(), /No extracted text is available on this page/);
  assert.ok(h.viewer());
});

test("extraction focuses its heading on open and Escape restores the reader toggle", () => {
  const h = harness({ source });
  h.render();
  let toggleFocused = 0;
  let headingFocused = 0;
  h.button("Extracted text").props.ref.current = { focus() { toggleFocused += 1; } };
  h.button("Extracted text").props.onClick();
  h.render();
  const heading = h.find(node => node.type === "h3");
  assert.equal(heading.props.tabIndex, -1);
  heading.props.ref.current = { focus() { headingFocused += 1; } };
  h.flushEffects();
  assert.equal(headingFocused, 1);
  h.viewer().onPageChange(2);
  h.render();
  h.flushEffects();
  assert.equal(headingFocused, 1, "scrolling to another PDF page must not steal focus");
  let stopped = false;
  h.find(node => node.type === "aside").props.onKeyDown({ key: "Escape", stopPropagation() { stopped = true; } });
  h.render();
  assert.equal(stopped, true);
  assert.equal(toggleFocused, 1);
  assert.equal(h.find(node => node.type === "aside"), undefined);
});

test("source mismatch stays explicit beside unchanged quoted text", () => {
  const quote = "  Partial wording\nwith exact spacing.  ";
  const h = harness({ finding, evidence: { ...evidence, quote }, source }, {
    matched: false, matchLabel: "Quote could not be matched to this source",
  });
  h.render();
  assert.equal(text(h.find(node => node.type === "blockquote")), quote);
  const warning = h.find(node => node.props?.className === "document-warning");
  assert.match(text(warning), /Quote could not be matched to this source/);
  assert.match(text(warning), /may begin or end mid-clause/);
  assert.equal(h.viewer().highlightedClause, undefined);
});

test("navigation failures remain visible until a successful physical-page update", () => {
  const h = harness();
  h.render();
  h.viewer().onNavigationError("The requested page is outside this PDF.");
  h.render();
  assert.equal(text(h.find(node => node.props?.role === "alert")), "The requested page is outside this PDF.");
  h.button("Extracted text").props.onClick();
  h.render();
  assert.ok(h.find(node => node.props?.role === "alert"));
  h.viewer().onPageChange(1);
  h.render();
  assert.equal(h.find(node => node.props?.role === "alert"), undefined);
});

test("long evidence and context are preserved inside bounded disclosures, not silently clipped", () => {
  const quote = "A synthetic complete reference. ".repeat(100);
  const h = harness({ source, finding, evidence: { ...evidence, quote } });
  h.render();
  assert.equal(text(h.find(node => node.type === "blockquote")), quote);
  const css = readFileSync(new URL("../src/components/workspace/DocumentWorkspace.module.css", import.meta.url), "utf8");
  assert.match(css, /\.contextBody\s*\{[^}]*max-height:\s*min\(420px,\s*52dvh\);[^}]*overflow-y:\s*auto/s);
  assert.match(css, /\.workspace\s*\{[^}]*height:\s*100%;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.readingArea\s*\{[^}]*flex:\s*1;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.extraction\s*\{[^}]*overflow-y:\s*auto/s);
  assert.match(css, /\.extractionHeading\s*\{[^}]*position:\s*sticky/s);
  assert.match(css, /\.extractionText\s*\{[^}]*font-size:\s*15px;[^}]*line-height:\s*1\.8/s);
  assert.doesNotMatch(css, /(?:min-|max-)?height:\s*(?:75vh|900px)/);
  assert.match(css, /@media\s*\(max-width:\s*900px\)\s*\{[^]*?\.withText\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\);/);
});
