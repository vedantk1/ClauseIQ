import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as icons from "lucide-react";
import ts from "typescript";

function load(path, imports = {}) {
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, require(name) {
    assert.ok(name in imports, `Unexpected dependency: ${name}`);
    return imports[name];
  } });
  return exports;
}

function fixture() {
  const first = "A base rule and its full qualification.";
  const second = "An exception applies only when requested.\nThe agreed charges continue.";
  const third = "A further condition must also be met.";
  const evidence = [first, second, third].map((quote, index) => ({ source_revision_id: "source-1",
    span_id: `span-${index}`, page_number: index === 1 ? 25 : 22, quote,
    label: ["Base rule", "Archive exception", "Conditions"][index] }));
  const source = { source_revision_id: "source-1", source_extraction: { pages: [
    { page_number: 22, text: `${first}\n\n${third}`, spans: [
      { id: "span-0", start: 0, end: first.length, text: first },
      { id: "span-2", start: first.length + 2, end: first.length + 2 + third.length, text: third },
    ] },
    { page_number: 25, text: second, spans: [{ id: "span-1", start: 0, end: second.length, text: second }] },
  ] } };
  return { finding: { id: "finding-1", evidence }, source };
}

function elements(node, predicate) {
  if (!React.isValidElement(node)) return [];
  return [...(predicate(node) ? [node] : []),
    ...React.Children.toArray(node.props.children).flatMap(child => elements(child, predicate))];
}

function harness() {
  const slots = [];
  let cursor = 0;
  let effects = [];
  const hooks = { ...React, useState(initial) {
    const index = cursor++;
    if (!(index in slots)) slots[index] = initial;
    return [slots[index], next => { slots[index] = typeof next === "function" ? next(slots[index]) : next; }];
  }, useRef(initial) {
    const index = cursor++;
    if (!(index in slots)) slots[index] = { current: initial };
    return slots[index];
  }, useEffect(effect, dependencies) {
    const index = cursor++;
    const previous = slots[index];
    if (!previous || dependencies.some((dependency, position) => !Object.is(previous[position], dependency))) {
      effects.push(effect);
      slots[index] = dependencies;
    }
  } };
  const state = load("../src/components/workspace/workspaceState.ts");
  const controls = load("../src/components/workspace/WorkspaceControls.tsx", { react: hooks, "./workspaceState": state });
  const presentation = load("../src/components/workspace/evidencePresentation.ts", { "./workspaceState": state });
  const { EvidenceSourcePane } = load("../src/components/workspace/EvidenceSourcePane.tsx", {
    react: hooks, "lucide-react": icons, "@/components/PDFViewer": () => null,
    "./evidencePresentation": presentation, "./WorkspaceControls": controls,
  });
  const selected = [];
  const opened = [];
  const focused = [];
  const scrolled = [];
  let props = { ...fixture(), onSelect: evidence => selected.push(evidence), onOpen: evidence => opened.push(evidence) };
  let tree;
  return {
    selected, opened, focused, scrolled,
    render(next = {}) {
      props = { ...props, ...next }; cursor = 0; effects = []; tree = EvidenceSourcePane(props);
      for (const node of elements(tree, node => node.props.ref && typeof node.props.ref === "object")) {
        node.props.ref.current = {
          focus: options => focused.push({ text: node.props.children, options }),
          scrollIntoView: options => scrolled.push(options),
        };
      }
      effects.forEach(effect => effect());
      return tree;
    },
    buttons() { return elements(tree, node => node.type === "button" && "aria-pressed" in node.props); },
    openButtons() { return elements(tree, node => node.type === "button" && node.props.className === "cw-reference-open"); },
    quote() { return elements(tree, node => node.type === "blockquote")[0]?.props.children; },
    action() { return elements(tree, node => node.type === controls.Action)[0]; },
    html() { return renderToStaticMarkup(tree); },
  };
}

test("all evidence references remain available while only the first exact quotation is initially shown", () => {
  const h = harness(); const { finding, source } = fixture();
  h.render({ finding, source });
  assert.equal(h.buttons().length, finding.evidence.length);
  assert.deepEqual(h.buttons().map(button => button.props["aria-pressed"]), [true, false, false]);
  assert.equal(h.quote(), finding.evidence[0].quote);
  const html = h.html();
  for (const evidence of finding.evidence) assert.ok(html.includes(evidence.label));
  assert.equal((html.match(/<blockquote/g) || []).length, 1);
  assert.ok(html.indexOf("<blockquote") < html.indexOf('aria-label="Evidence references"'));
  assert.match(html, /Saved excerpt · may begin or end mid-clause/);
  assert.match(html, /Inspect surrounding text · page 22/);
  assert.match(html, /A source match locates wording/);
  assert.match(html, /does not verify the interpretation/);
});

test("the selected excerpt groups its exact-page action with the heading and keeps the quotation before reference navigation", () => {
  const h = harness(); const { finding, source } = fixture();
  const tree = h.render({ finding, source, selectedEvidence: finding.evidence[1] });
  const topline = elements(tree, node => node.props.className === "cw-evidence-detail-topline")[0];
  const title = elements(topline, node => node.type === "h3")[0];
  assert.equal(title.props.children, "Archive exception");
  assert.equal(elements(topline, node => node.props.className === "cw-evidence-open").length, 1);
  assert.equal(h.quote(), finding.evidence[1].quote);
  assert.ok(h.html().indexOf("<blockquote") < h.html().indexOf('aria-label="Evidence references"'));
  assert.deepEqual(h.opened, [], "presentation and selection do not navigate or send anything");
});

test("selecting a reference only changes the detail; original navigation requires its own action", () => {
  const h = harness(); const { finding, source } = fixture();
  h.render({ finding, source });
  h.buttons()[1].props.onClick(); h.render();
  assert.deepEqual(h.selected, [finding.evidence[1]]);
  assert.deepEqual(h.opened, []);
  assert.equal(h.quote(), finding.evidence[1].quote);
  assert.deepEqual(h.buttons().map(button => button.props["aria-pressed"]), [false, true, false]);
  assert.equal(h.action().props.disabled, false);
  h.action().props.onClick();
  assert.equal(h.opened[0], finding.evidence[1]);
  assert.equal(h.opened[0].page_number, 25);
});

test("every reference distinguishes preview from a direct original-page action", () => {
  const h = harness(); const { finding, source } = fixture();
  h.render({ finding, source });
  assert.match(h.html(), /Preview excerpt/);
  assert.equal(h.openButtons().length, finding.evidence.length);
  h.openButtons()[1].props.onClick();
  assert.equal(h.opened[0], finding.evidence[1]);
  assert.deepEqual(h.selected, [], "direct page opening does not first require preview selection");
  assert.match(h.openButtons()[1].props["aria-label"], /View page 25 · Archive exception/);
  h.render({ source: null });
  assert.ok(h.openButtons().every(button => button.props.disabled));
  h.openButtons()[0].props.onClick();
  assert.equal(h.opened.length, 1, "even a stale handler cannot open unmatched evidence");
});

test("controlled selection uses a canonical reference and follows its owner", () => {
  const h = harness(); const { finding, source } = fixture();
  h.render({ finding, source, selectedEvidence: { ...finding.evidence[1] } });
  assert.equal(h.quote(), finding.evidence[1].quote);
  h.buttons()[2].props.onClick(); h.render();
  assert.equal(h.selected[0], finding.evidence[2]);
  assert.equal(h.quote(), finding.evidence[1].quote);
  h.render({ selectedEvidence: finding.evidence[2] });
  assert.equal(h.quote(), finding.evidence[2].quote);
  h.action().props.onClick();
  assert.equal(h.opened[0], finding.evidence[2]);
});

test("stale or changed references cannot inject text and local selection resets on a different finding", () => {
  const h = harness(); const { finding, source } = fixture();
  h.render({ finding, source });
  h.buttons()[1].props.onClick(); h.render();
  h.render({ finding: { ...finding, id: "finding-2" } });
  assert.equal(h.quote(), finding.evidence[0].quote);
  h.render({ finding, selectedEvidence: { ...finding.evidence[1], quote: "Not the current evidence" } });
  assert.equal(h.quote(), finding.evidence[0].quote);
  assert.doesNotMatch(h.html(), /Not the current evidence/);
  h.render({ selectedEvidence: { ...finding.evidence[1], label: "Not the current label" } });
  assert.equal(h.quote(), finding.evidence[0].quote);
  h.render({ selectedEvidence: finding.evidence[1], finding: { ...finding, evidence: [finding.evidence[0]] } });
  assert.equal(h.quote(), finding.evidence[0].quote);
});

test("unmatched evidence stays selectable and readable but cannot open an invented source location", () => {
  const h = harness(); const { finding, source } = fixture();
  finding.evidence[1] = { ...finding.evidence[1], source_revision_id: "wrong-revision" };
  h.render({ finding, source });
  assert.equal(h.buttons()[1].props.disabled, undefined);
  h.buttons()[1].props.onClick(); h.render();
  assert.equal(h.quote(), finding.evidence[1].quote);
  assert.equal(h.action().props.disabled, true);
  assert.match(h.html(), /Source not matched/);
  assert.match(h.html(), /Quote could not be matched to this source/);
  assert.doesNotMatch(h.html(), /Inspect surrounding text/);
  assert.deepEqual(h.opened, []);
});

test("empty evidence explains its limitation without an original-page action", () => {
  const h = harness();
  h.render({ finding: { id: "empty", evidence: [] }, source: null });
  assert.equal(h.buttons().length, 0);
  assert.equal(h.quote(), undefined);
  assert.equal(h.action(), undefined);
  assert.match(h.html(), /No source quotation accompanies this finding/);
  assert.match(h.html(), /not proof that a term is absent/);
});

test("references are not capped or deduplicated, including identical references", () => {
  const h = harness(); const { finding, source } = fixture();
  finding.evidence = Array.from({ length: 8 }, () => ({ ...finding.evidence[0] }));
  h.render({ finding, source });
  assert.equal(h.buttons().length, 8);
  h.buttons()[7].props.onClick(); h.render();
  assert.equal(h.buttons()[7].props["aria-pressed"], true);
  assert.equal(h.buttons().filter(button => button.props["aria-pressed"]).length, 1);
  assert.equal(h.selected[0], finding.evidence[7]);
});

test("full multi-span passages retain exact whitespace and canonical source matching", () => {
  const h = harness(); const { finding, source } = fixture();
  const text = "First complete sentence.\n\nSecond complete sentence.";
  const split = text.indexOf("\n");
  source.source_extraction.pages[1] = { page_number: 25, text, spans: [
    { id: "passage-start", start: 0, end: split, text: text.slice(0, split) },
    { id: "passage-end", start: split + 2, end: text.length, text: text.slice(split + 2) },
  ] };
  finding.evidence[1] = { ...finding.evidence[1], span_id: "passage-start", end_span_id: "passage-end", quote: text };
  h.render({ finding, source, selectedEvidence: finding.evidence[1] });
  assert.equal(h.quote(), text);
  assert.equal(h.action().props.disabled, false);
  assert.match(h.html(), /Passage matched to source/);
  assert.match(h.html(), /Selected passage · may begin or end mid-clause/);
});

test("a selected fragment remains exact while surrounding source is distinctly disclosed", () => {
  const h = harness(); const { finding, source } = fixture();
  const before = "Archive assistance is one hundred and ";
  const quote = "twenty days instead of sixty days, provided the customer requests it or within";
  const after = " ten business days after the exit notice.";
  source.source_extraction.pages[1] = { page_number: 25, text: before + quote + after,
    spans: [{ id: "fragment", start: before.length, end: before.length + quote.length, text: quote }] };
  finding.evidence[1] = { ...finding.evidence[1], span_id: "fragment", quote };
  h.render({ finding, source, selectedEvidence: finding.evidence[1] });
  assert.equal(h.quote(), quote);
  const html = h.html();
  assert.match(html, /<details class="cw-evidence-context">/);
  assert.ok(html.includes(`${before}<mark class="cw-evidence-context-match">${quote}</mark>${after}`));
  assert.match(html, /Surrounding text is not added to this citation/);
  assert.match(html, /qualifications may be on other pages/);
  assert.deepEqual(h.selected, []);
  assert.deepEqual(h.opened, []);
});

test("ambiguous single-span anchors expose neither matched claims nor nearby source text", () => {
  const h = harness(); const { finding, source } = fixture();
  source.source_extraction.pages[0].spans.push({ ...source.source_extraction.pages[0].spans[0] });
  h.render({ finding, source });
  assert.equal(h.quote(), finding.evidence[0].quote);
  assert.equal(h.action().props.disabled, true);
  assert.doesNotMatch(h.html(), /Inspect surrounding text|Quote matched to source/);
});

test("clipped context labels its limits and offers the unchanged full extracted page", () => {
  const h = harness(); const { finding, source } = fixture();
  const before = "Before ".repeat(80); const after = " after".repeat(80);
  const evidence = finding.evidence[0];
  source.source_extraction.pages[0] = { page_number: 22, text: before + evidence.quote + after,
    spans: [{ id: evidence.span_id, start: before.length, end: before.length + evidence.quote.length, text: evidence.quote }] };
  h.render({ finding, source });
  const html = h.html();
  assert.match(html, /Earlier text on this page is outside this window/);
  assert.match(html, /Later text on this page is outside this window/);
  assert.match(html, /View full extracted page 22/);
  assert.ok(html.includes(before + evidence.quote + after));
  assert.equal(h.quote(), evidence.quote);
});

test("initial, resumed and externally changed evidence never move focus", () => {
  const h = harness(); const { finding, source } = fixture();
  h.render({ finding, source, selectedEvidence: finding.evidence[1] });
  h.render({ selectedEvidence: finding.evidence[2] });
  h.render({ finding: { ...finding, id: "another-finding" } });
  assert.equal(h.focused.length, 0);
  assert.equal(h.scrolled.length, 0);
  assert.deepEqual(h.opened, []);
});

test("explicit reference selection focuses its rendered heading once, including the same reference", () => {
  const h = harness(); const { finding, source } = fixture();
  const tree = h.render({ finding, source });
  const heading = elements(tree, node => node.props.className === "cw-evidence-detail-heading")[0];
  assert.equal(heading.props.tabIndex, -1);
  h.buttons()[2].props.onClick();
  assert.equal(h.focused.length, 0);
  h.render();
  assert.equal(h.focused.length, 1);
  assert.equal(h.focused[0].text, finding.evidence[2].label);
  assert.equal(h.focused[0].options.preventScroll, true);
  assert.equal(h.scrolled[0].block, "nearest");
  h.render();
  assert.equal(h.focused.length, 1);
  h.buttons()[2].props.onClick(); h.render();
  assert.equal(h.focused.length, 2);
  assert.equal(h.scrolled.length, 2);
  assert.deepEqual(h.opened, []);
});

test("controlled selection focuses only after its chosen reference appears and drops stale finding intent", () => {
  const h = harness(); const { finding, source } = fixture();
  h.render({ finding, source, selectedEvidence: finding.evidence[0] });
  h.buttons()[1].props.onClick(); h.render();
  assert.equal(h.focused.length, 0);
  assert.equal(h.quote(), finding.evidence[0].quote);
  h.render({ selectedEvidence: { ...finding.evidence[1] } });
  assert.equal(h.focused.length, 1);
  assert.equal(h.focused[0].text, finding.evidence[1].label);
  h.buttons()[2].props.onClick(); h.render();
  h.render({ finding: { ...finding, id: "new-finding" }, selectedEvidence: finding.evidence[2] });
  assert.equal(h.focused.length, 1);
  assert.equal(h.scrolled.length, 1);
});

test("context disclosure identity follows finding and exact evidence instead of only list position", () => {
  const h = harness(); const { finding, source } = fixture();
  const contextKey = tree => elements(tree, node => typeof node.type === "function" && node.type.name === "SourceContext")[0].key;
  const firstKey = contextKey(h.render({ finding, source }));
  const secondKey = contextKey(h.render({ finding: { ...finding, id: "new-finding" } }));
  assert.notEqual(firstKey, secondKey);
  const changed = { ...finding, evidence: [{ ...finding.evidence[0], source_revision_id: "new-source" }] };
  const changedKey = contextKey(h.render({ finding: changed }));
  assert.notEqual(firstKey, changedKey);
  const newQuoteKey = contextKey(h.render({ finding: { ...changed, evidence: [{ ...changed.evidence[0], quote: "new quote" }] } }));
  assert.notEqual(changedKey, newQuoteKey);
});
