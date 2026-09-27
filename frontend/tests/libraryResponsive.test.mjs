import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import postcss from "postcss";

const sheet = postcss.parse(readFileSync(new URL("../src/components/documents/Library.module.css", import.meta.url), "utf8"));

function declarations(selector, media = null) {
  const values = {};
  sheet.walkRules(selector, rule => {
    const parentMedia = rule.parent.type === "atrule" ? rule.parent.params : null;
    if (parentMedia === media) rule.walkDecls(declaration => { values[declaration.prop] = declaration.value; });
  });
  return values;
}

// CSS contract only; the combined browser checkpoint verifies real narrow-screen layout.
test("narrow continue-review cards reserve the full content column for file details and a separate action row", () => {
  const card = declarations(".library :global(.cl-resume-card)", "(max-width: 520px)");
  assert.equal(card.display, "grid");
  assert.equal(card["grid-template-columns"], "auto minmax(0, 1fr)");
  const action = declarations(".library :global(.cl-resume-card > .cl-button)", "(max-width: 520px)");
  assert.equal(action["grid-column"], "1 / -1");
  assert.equal(action.width, "100%");
  assert.equal(action["margin-left"], "0");
});

test("the desktop continue-review card retains its horizontal layout and safely wrapping filename", () => {
  assert.equal(declarations(".library :global(.cl-resume-card)").display, "flex");
  assert.equal(declarations(".library :global(.cl-resume-body)")["min-width"], "0");
  assert.equal(declarations(".library :global(.cl-resume-body h3)")["overflow-wrap"], "anywhere");
});

test("library view controls wrap at narrow widths without reducing their target size", () => {
  assert.equal(declarations(".library :global(.cl-view-toolbar)")["flex-wrap"], "wrap");
  assert.equal(declarations(".library :global(.cl-view-switch)")["flex-wrap"], "wrap");
  assert.equal(declarations(".library :global(.cl-view-switch button)")["min-height"], "36px");
});
