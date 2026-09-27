import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import postcss from "postcss";

function css(file) {
  const sheet = postcss.parse(readFileSync(new URL(`../src/components/${file}`, import.meta.url), "utf8"));
  return (selector, media = null) => {
    const values = {};
    sheet.walkRules(selector, rule => {
      const parentMedia = rule.parent.type === "atrule" ? rule.parent.params : null;
      if (parentMedia === media) rule.walkDecls(decl => { values[decl.prop] = decl.value; });
    });
    return values;
  };
}

// Layout intent only. The batched browser checkpoint checks the rendered result.
test("review status aligns with question actions and run tools share one right-aligned group", () => {
  const review = css("workspace/MyReview.module.css");
  assert.equal(review(".review :global(.mr-marker)").display, "block");
  assert.equal(review(".review :global(.mr-item-compact .mr-item-heading)")["align-items"], "flex-start");
  assert.equal(review(".review :global(.mr-marker select)")["min-height"], "36px");
  const workspace = css("workspace/ReviewWorkspace.module.css");
  assert.equal(workspace(".workspace :global(.cw-run-tools)")["margin-left"], "auto");
  assert.equal(workspace(".workspace :global(.cw-run-tools)").display, "flex");
  assert.equal(workspace(".workspace :global(.cw-provenance)")["margin-left"], undefined);
  assert.equal(workspace(".workspace :global(.cw-run-selector)")["margin-left"], undefined);
});

test("document canvas keeps the remaining viewport rather than a padded scrolling page", () => {
  const rules = css("workspace/ReviewWorkspace.module.css");
  const document = rules(".workspace :global(.cw-view-document)");
  assert.equal(document.display, "flex");
  assert.equal(document.padding, "0");
  assert.equal(document.overflow, "hidden");
  const frame = rules(".workspace:has(:global(.cw-view-document))", "(max-width: 950px)");
  assert.equal(frame.height, "100dvh");
  assert.equal(frame.overflow, "hidden");
  assert.equal(rules(".workspace :global(.cw-view-document)", "(max-width: 950px)").overflow, "hidden");
});

test("findings retain readable copy and prioritize the reading column", () => {
  const rules = css("workspace/ReviewWorkspace.module.css");
  assert.match(rules(".workspace :global(.cw-findings-layout)")["grid-template-columns"], /minmax\(380px, 1fr\)/);
  assert.equal(rules(".workspace :global(.cw-finding-body > *)")["max-width"], "72ch");
  assert.equal(rules(".workspace :global(.cw-finding-section p)")["font-size"], "16px");
  assert.equal(rules(".workspace :global(.cw-finding-section p)")["line-height"], "1.7");
});

test("overview has inline next actions instead of a permanently reserved activity sidebar", () => {
  const component = readFileSync(new URL("../src/components/workspace/AgreementOverview.tsx", import.meta.url), "utf8");
  const main = component.indexOf('className="co-agreement-summary"');
  const coverage = component.indexOf('className="co-source-coverage"');
  const controls = component.indexOf('className="co-review-controls"');
  assert.ok(main > 0 && main < coverage && coverage < controls);
  assert.doesNotMatch(component, /<aside|co-activity/);
  assert.match(component.slice(main, coverage), /co-findings-next/);
});

test("library toolbar shares a row without permanently reserved inspector space", () => {
  const rules = css("documents/Library.module.css");
  assert.equal(rules(".library :global(.cl-toolbar)").display, "flex");
  assert.equal(rules(".library :global(.cl-document-row)")["min-height"], "72px");
  assert.equal(rules(".library :global(.cl-library-grid)")["grid-template-columns"], undefined);
});

test("conversation sources wrap and the composer cannot occupy most of its pane", () => {
  const rules = css("workspace/ReviewWorkspace.module.css");
  assert.equal(rules(".workspace :global(.cw-ask-composer)")["max-height"], "45%");
  assert.equal(rules(".workspace :global(.cw-ask-evidence-list > li)")["max-width"], "100%");
  const chip = rules(".workspace :global(.cw-ask-evidence-chip)");
  assert.equal(chip["max-width"], "100%");
  assert.equal(chip["overflow-wrap"], "anywhere");
});

test("source and action hierarchy stays compact without shrinking reading copy", () => {
  const rules = css("workspace/ReviewWorkspace.module.css");
  assert.equal(rules(".workspace :global(.cw-evidence-detail-topline)").display, "flex");
  assert.equal(rules(".workspace :global(.cw-evidence-quote)")["font-size"], "16px");
  assert.equal(rules(".workspace :global(.cw-evidence-open)")["flex-shrink"], "0");
  assert.equal(rules(".workspace :global(.cw-finding-tools)")["flex-shrink"], "0");
  assert.equal(rules(".workspace :global(.cw-conversation-history)")["overflow-y"], "auto");
  assert.equal(rules(".workspace :global(.cw-ask-warning)")["border-left"], "2px solid var(--accent-amber)");
  assert.equal(rules(".workspace :global(.cw-evidence-detail-heading:focus-visible)").outline, "2px solid var(--cw-accent)");
});

test("workspace visibility, question actions and finding sections have one base rule each", () => {
  const sheet = postcss.parse(readFileSync(new URL("../src/components/workspace/ReviewWorkspace.module.css", import.meta.url), "utf8"));
  for (const selector of [".workspace :global([hidden])", ".workspace :global(.cw-question-actions)", ".workspace :global(.cw-finding-section)"]) {
    const rules = [];
    sheet.walkRules(selector, rule => { if (rule.parent.type === "root") rules.push(rule); });
    assert.equal(rules.length, 1, selector);
  }
});
