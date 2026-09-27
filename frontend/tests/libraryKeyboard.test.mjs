import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Exercise the real event handler without a browser or any document mutations.
class Element {
  constructor(tagName, isContentEditable = false) {
    this.tagName = tagName;
    this.isContentEditable = isContentEditable;
  }
}

function harness({ activeElement = new Element("BODY"), isSelectMode = true, searchQuery = "", enabled = true } = {}) {
  let listener;
  let cleanup;
  const calls = { selectAll: 0, focus: 0, blur: 0, search: [], selectMode: [], selection: [] };
  const document = {
    activeElement,
    addEventListener(name, callback) { assert.equal(name, "keydown"); listener = callback; },
    removeEventListener(name, callback) { assert.equal(name, "keydown"); assert.equal(callback, listener); listener = null; },
  };
  const compiled = ts.transpileModule(readFileSync(new URL("../src/hooks/useKeyboardShortcuts.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, document, HTMLElement: Element,
    require(name) { assert.equal(name, "react"); return { useEffect(effect) { cleanup = effect(); } }; },
  });
  exports.useKeyboardShortcuts({
    enabled,
    searchInputRef: { current: { focus() { calls.focus++; }, blur() { calls.blur++; } } },
    isSelectMode, searchQuery,
    setSearchQuery: value => calls.search.push(value),
    setIsSelectMode: value => calls.selectMode.push(value),
    setSelectedDocuments: value => calls.selection.push(value),
    selectAllDocuments: () => calls.selectAll++,
  });
  return {
    calls,
    key(key, properties = {}) {
      let prevented = false;
      listener({ key, target: activeElement, ctrlKey: false, metaKey: false, altKey: false,
        ...properties, preventDefault() { prevented = true; } });
      return prevented;
    },
    cleanup() { cleanup(); assert.equal(listener, null); },
  };
}

for (const [name, target] of [
  ["input", new Element("INPUT")],
  ["textarea", new Element("TEXTAREA")],
  ["select", new Element("SELECT")],
  ["contenteditable descendant", new Element("SPAN", true)],
]) {
  test(`bulk-selection shortcuts preserve native editing in ${name}`, () => {
    const app = harness({ activeElement: target });
    assert.equal(app.key("a", { metaKey: true }), false);
    assert.equal(app.key("a", { ctrlKey: true }), false);
    assert.equal(app.key("/"), false);
    assert.equal(app.calls.selectAll, 0);
    assert.equal(app.calls.focus, 0);
  });
}

test("editable event targets are protected even when activeElement is not the field", () => {
  const app = harness();
  assert.equal(app.key("a", { ctrlKey: true, target: new Element("INPUT") }), false);
  assert.equal(app.key("/", { target: new Element("DIV", true) }), false);
  assert.equal(app.calls.selectAll, 0);
  assert.equal(app.calls.focus, 0);
});

test("active editable fields are protected when the event target is not an element", () => {
  const app = harness({ activeElement: new Element("TEXTAREA") });
  assert.equal(app.key("a", { metaKey: true, target: null }), false);
  assert.equal(app.calls.selectAll, 0);
});

test("Cmd/Ctrl+A still selects shown agreements outside editable controls in selection mode", () => {
  const app = harness({ activeElement: new Element("BUTTON") });
  assert.equal(app.key("a", { metaKey: true }), true);
  assert.equal(app.key("a", { ctrlKey: true }), true);
  assert.equal(app.calls.selectAll, 2);
  assert.equal(app.key("a"), false);
});

test("Cmd/Ctrl+A remains native outside selection mode", () => {
  const app = harness({ isSelectMode: false });
  assert.equal(app.key("a", { metaKey: true }), false);
  assert.equal(app.key("a", { ctrlKey: true }), false);
  assert.equal(app.calls.selectAll, 0);
});

test("slash focuses search only outside editable fields and without command modifiers", () => {
  const app = harness();
  assert.equal(app.key("/"), true);
  assert.equal(app.calls.focus, 1);
  for (const modifier of ["ctrlKey", "metaKey", "altKey"]) {
    assert.equal(app.key("/", { [modifier]: true }), false);
  }
  assert.equal(app.calls.focus, 1);
});

test("existing Escape selection/search behavior and listener cleanup remain intact", () => {
  const selecting = harness({ activeElement: new Element("INPUT"), searchQuery: "agreement" });
  selecting.key("Escape");
  assert.deepEqual(selecting.calls.selectMode, [false]);
  assert.equal(selecting.calls.selection[0].size, 0);
  assert.deepEqual(selecting.calls.search, []);
  selecting.cleanup();

  const searching = harness({ isSelectMode: false, searchQuery: "agreement" });
  searching.key("Escape");
  assert.deepEqual(searching.calls.search, [""]);
  assert.equal(searching.calls.blur, 1);
  searching.cleanup();
});

test("contract-search view disables browse shortcuts rather than focusing or mutating hidden controls", () => {
  const app = harness({ enabled: false, isSelectMode: true, searchQuery: "retained filename filter" });
  assert.equal(app.key("/"), false);
  assert.equal(app.key("a", { ctrlKey: true }), false);
  assert.equal(app.key("Escape"), false);
  assert.equal(app.calls.focus, 0);
  assert.equal(app.calls.blur, 0);
  assert.equal(app.calls.selectAll, 0);
  assert.deepEqual(app.calls.search, []);
  assert.deepEqual(app.calls.selectMode, []);
  assert.deepEqual(app.calls.selection, []);
  app.cleanup();
});
