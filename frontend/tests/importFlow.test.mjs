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
  vm.runInNewContext(compiled, { exports, React, Error,
    require(name) { assert.ok(name in imports, `Unexpected dependency: ${name}`); return imports[name]; },
  });
  return exports;
}

const state = loadModule("../src/components/documents/importState.ts");
const pdf = (overrides = {}) => ({ name: "synthetic-agreement.pdf", size: 1024, ...overrides });
const icon = props => React.createElement("svg", props);
const Header = () => React.createElement("header", null, "Library");
const Modal = () => null;
class SourceImportError extends Error {
  constructor(message, documentId) { super(message); this.documentId = documentId; }
}

// Exercise component event handlers and state transitions without pretending to test
// browser layout, focus, native file picking or routing effects.
function harness({ importSource = async () => ({ id: "saved" }), limit = 3 } = {}) {
  const slots = [];
  const cleanups = [];
  let index = 0;
  const navigations = [];
  const imports = [];
  const hooks = { ...React,
    useState(initial) {
      const current = index++;
      if (!(current in slots)) slots[current] = initial;
      return [slots[current], next => { slots[current] = typeof next === "function" ? next(slots[current]) : next; }];
    },
    useRef(initial) {
      const current = index++;
      if (!(current in slots)) slots[current] = { current: initial };
      return slots[current];
    },
    useEffect(effect) {
      const current = index++;
      if (!(current in slots)) { slots[current] = true; cleanups.push(effect()); }
    },
  };
  const { default: ImportAgreement } = loadModule("../src/components/documents/ImportAgreement.tsx", {
    react: hooks, "next/navigation": { useRouter: () => ({ push: destination => navigations.push(destination) }) },
    "lucide-react": { ArrowLeft: icon, ArrowRight: icon, FileText: icon, LoaderCircle: icon, Upload: icon, X: icon },
    "@/config/config": { maxFileSizeMB: limit }, "@/components/ui/ConfirmModal": Modal,
    "@/lib/sourceImport": { SourceImportError, importSource: file => { imports.push(file); return importSource(file); } },
    "./LibraryHeader": { LibraryHeader: Header }, "./importState": state,
    "./Library.module.css": { library: "library" }, "./ImportAgreement.module.css": {},
  });
  const render = () => { index = 0; return ImportAgreement(); };
  return {
    render, imports, navigations,
    html: () => renderToStaticMarkup(render()),
    select(files = [pdf()]) { const target = { files, value: "chosen" }; node(render(), n => n.type === "input").props.onChange({ target }); return target; },
    submit: () => node(render(), n => n.type === "form").props.onSubmit({ preventDefault() {} }),
    header: () => node(render(), n => n.type === Header),
    modal: () => node(render(), n => n.type === Modal),
    unmount: () => cleanups.forEach(cleanup => cleanup?.()),
  };
}

function nodes(element) {
  if (!React.isValidElement(element)) return [];
  return [element, ...React.Children.toArray(element.props.children).flatMap(nodes)];
}
function node(tree, predicate) {
  const found = nodes(tree).find(predicate);
  assert.ok(found, "Expected UI node was missing");
  return found;
}
function text(element) {
  if (element == null || typeof element === "boolean") return "";
  if (typeof element !== "object") return String(element);
  if (Array.isArray(element)) return element.map(text).join("");
  return text(element.props?.children);
}
function button(tree, label) { return node(tree, n => n.type === "button" && text(n) === label); }
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test("import file validation requires one nonempty PDF and honors the configured limit", () => {
  assert.match(state.validateImportFiles([], 2), /one PDF/);
  assert.match(state.validateImportFiles([pdf(), pdf()], 2), /one PDF/);
  assert.match(state.validateImportFiles([pdf({ name: "file.docx" })], 2), /PDF document/);
  assert.match(state.validateImportFiles([pdf({ name: "file.pdf.exe" })], 2), /PDF document/);
  assert.match(state.validateImportFiles([pdf({ size: 0 })], 2), /empty/);
  assert.match(state.validateImportFiles([pdf({ size: Number.NaN })], 2), /empty/);
  assert.equal(state.validateImportFiles([pdf({ name: "AGREEMENT.PDF", size: 2 * 1024 * 1024 })], 2), null);
  assert.match(state.validateImportFiles([pdf({ size: 2 * 1024 * 1024 + 1 })], 2), /2 MB/);
  for (const invalidLimit of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.match(state.validateImportFiles([pdf()], invalidLimit), /configuration/);
  }
});

test("file sizes are readable and recovery/workspace identities are encoded", () => {
  assert.equal(state.importFileSize(12), "12 bytes");
  assert.equal(state.importFileSize(2048), "2 KB");
  assert.equal(state.importFileSize(1.5 * 1024 * 1024), "1.5 MB");
  const id = "a/b?x=1&next=elsewhere#ü";
  assert.equal(state.importedWorkspaceDestination(id), `/workspace?documentId=${encodeURIComponent(id)}`);
  assert.equal(state.savedImportDestination(id), `/review?documentId=${encodeURIComponent(id)}`);
});

test("initial import is key-free, explicit and separates source import from paid review", () => {
  const app = harness({ importSource: () => assert.fail("Rendering cannot import") });
  const html = app.html();
  assert.match(html, /Import is local and needs no API key/);
  assert.match(html, /does not perform OCR and is not a completed review/);
  assert.match(html, /AI review is a separate paid action/);
  assert.match(html, /Up to 3 MB/);
  assert.match(html, /<summary>Try the synthetic example/);
  assert.match(html, /fixed example findings, not a live AI review/);
  assert.equal((html.match(/<h1/g) || []).length, 1);
  assert.equal(button(app.render(), "Import agreement").props.disabled, true);
  assert.equal(app.header().props.current, "import");
  assert.equal(app.imports.length, 0);
});

test("selection and removal show metadata without importing or requiring Settings", async () => {
  const app = harness();
  const target = app.select([pdf({ name: "Long synthetic agreement.PDF", size: 2000 })]);
  assert.equal(target.value, "");
  assert.match(app.html(), /Long synthetic agreement.PDF/);
  assert.match(app.html(), /2 KB · PDF/);
  assert.equal(button(app.render(), "Import agreement").props.disabled, false);
  assert.equal(app.imports.length, 0);
  button(app.render(), "Remove").props.onClick();
  assert.doesNotMatch(app.html(), /Long synthetic agreement.PDF/);
  await app.submit();
  assert.equal(app.imports.length, 0);
});

test("selected PDF replaces the empty drop illustration and keeps the local-action boundary visible", () => {
  const app = harness();
  assert.match(app.html(), /Drop a PDF here/);
  app.select([pdf({ name: "Selected agreement.pdf" })]);
  const tree = app.render();
  const drop = node(tree, element => !!element.props.onDrop);
  assert.equal(drop.props["data-selected"], true);
  assert.match(text(drop), /Selected agreement.pdf/);
  assert.doesNotMatch(text(drop), /Drop a PDF here|PDF selected/);
  assert.equal(nodes(tree).filter(element => element.type === "span" && text(element) === "Selected agreement.pdf").length, 1);
  const actionRow = node(tree, element => element.type === "div" && React.Children.toArray(element.props.children)
    .some(child => React.isValidElement(child) && child.type === "button" && child.props.type === "submit"));
  assert.match(text(actionRow), /Import is local and needs no API key\. AI review is a separate paid action/);
  assert.equal(button(tree, "Choose another PDF").props.disabled, false);
  assert.equal(app.imports.length, 0);
});

test("invalid replacement and multi-file drop clear the older selection instead of silently importing it", async () => {
  const app = harness();
  app.select([pdf({ name: "original.pdf" })]);
  app.select([pdf({ name: "wrong.docx" })]);
  assert.match(app.html(), /Choose a PDF document/);
  assert.doesNotMatch(app.html(), /original.pdf/);
  assert.equal(button(app.render(), "Import agreement").props.disabled, true);
  await app.submit();
  app.select([pdf({ name: "original.pdf" })]);
  node(app.render(), n => !!n.props.onDrop).props.onDrop({ preventDefault() {}, dataTransfer: { files: [pdf(), pdf()] } });
  assert.match(app.html(), /one PDF agreement at a time/);
  assert.doesNotMatch(app.html(), /original.pdf/);
  assert.equal(button(app.render(), "Import agreement").props.disabled, true);
  await app.submit();
  assert.equal(app.imports.length, 0);
});

test("valid drop only selects a file, and picker cancellation keeps the selection", () => {
  const app = harness();
  node(app.render(), n => !!n.props.onDrop).props.onDrop({ preventDefault() {}, dataTransfer: { files: [pdf()] } });
  app.select([]);
  assert.match(app.html(), /synthetic-agreement.pdf/);
  assert.equal(app.imports.length, 0);
});

test("submit is ref-locked immediately, selected file cannot change, and success stays locked until navigation", async () => {
  const task = deferred();
  const app = harness({ importSource: () => task.promise });
  const original = pdf();
  app.select([original]);
  const handler = node(app.render(), n => n.type === "form").props.onSubmit;
  const request = handler({ preventDefault() {} });
  await handler({ preventDefault() {} });
  assert.equal(app.imports.length, 1);
  app.select([pdf({ name: "replacement.pdf" })]);
  button(app.render(), "Remove").props.onClick();
  assert.match(app.html(), /synthetic-agreement.pdf/);
  assert.doesNotMatch(app.html(), /replacement.pdf/);
  assert.match(app.html(), /Keep this page open for confirmation/);
  task.resolve({ id: "saved /?id" });
  await request;
  assert.deepEqual(app.navigations, [state.importedWorkspaceDestination("saved /?id")]);
  await app.submit();
  assert.equal(app.imports.length, 1);
  assert.equal(button(app.render(), " Importing agreement…").props.disabled, true);
});

test("known-record import failure offers original recovery without claiming storage succeeded or retrying", async () => {
  const app = harness({ importSource: async () => { throw new SourceImportError("Storage could not be confirmed.", "source /1"); } });
  app.select();
  const handler = node(app.render(), n => n.type === "form").props.onSubmit;
  await handler({ preventDefault() {} });
  assert.match(app.html(), /A document record does not confirm that the original was saved/);
  assert.match(app.html(), /Storage could not be confirmed/);
  assert.equal(button(app.render(), "Import agreement").props.disabled, true);
  await handler({ preventDefault() {} });
  await app.submit();
  assert.equal(app.imports.length, 1);
  button(app.render(), "Open saved record").props.onClick();
  assert.deepEqual(app.navigations, [state.savedImportDestination("source /1")]);
});

test("unknown import failure points to Library and never repeats the request automatically", async () => {
  const app = harness({ importSource: async () => { throw new Error("Connection lost."); } });
  app.select();
  await app.submit();
  assert.match(app.html(), /result is uncertain/);
  assert.match(app.html(), /will not retry the import automatically/);
  assert.doesNotMatch(app.html(), /Open saved record/);
  await app.submit();
  assert.equal(app.imports.length, 1);
  button(app.render(), "Check Library").props.onClick();
  assert.deepEqual(app.navigations, ["/documents"]);
});

test("explicit new file selection clears failed-attempt state without starting another import", async () => {
  const app = harness({ importSource: async () => { throw new SourceImportError("Could not confirm."); } });
  app.select();
  await app.submit();
  app.select([pdf({ name: "different.pdf" })]);
  assert.doesNotMatch(app.html(), /Could not confirm/);
  assert.equal(button(app.render(), "Import agreement").props.disabled, false);
  assert.equal(app.imports.length, 1);
});

test("selected-file in-app navigation requires the leave modal; dismissing retains selection", () => {
  const app = harness();
  app.header().props.onNavigate("/settings");
  assert.deepEqual(app.navigations, ["/settings"]);
  app.select();
  app.header().props.onNavigate("/about");
  assert.equal(app.modal().props.isOpen, true);
  assert.match(app.modal().props.message, /not been imported yet/);
  assert.equal(app.navigations.length, 1);
  app.modal().props.onClose();
  assert.equal(app.modal().props.isOpen, false);
  assert.match(app.html(), /synthetic-agreement.pdf/);
  button(app.render(), " Back to Library").props.onClick();
  app.modal().props.onConfirm();
  assert.deepEqual(app.navigations, ["/settings", "/documents"]);
});

test("leaving during import warns about uncertain confirmation and ignores late success", async () => {
  const task = deferred();
  const app = harness({ importSource: () => task.promise });
  app.select();
  const request = app.submit();
  app.header().props.onNavigate("/documents");
  assert.match(app.modal().props.title, /import is running/);
  assert.match(app.modal().props.message, /interrupt confirmation/);
  app.modal().props.onConfirm();
  task.resolve({ id: "late-source" });
  await request;
  assert.deepEqual(app.navigations, ["/documents"]);
});

test("unmounting suppresses a late completion redirect without issuing a retry", async () => {
  const task = deferred();
  const app = harness({ importSource: () => task.promise });
  app.select();
  const request = app.submit();
  app.unmount();
  task.resolve({ id: "late-source" });
  await request;
  assert.deepEqual(app.navigations, []);
  assert.equal(app.imports.length, 1);
});

test("route is a thin wrapper and the import implementation has no account/key/provider dependency", () => {
  const route = readFileSync(new URL("../src/app/import/page.tsx", import.meta.url), "utf8");
  const component = readFileSync(new URL("../src/components/documents/ImportAgreement.tsx", import.meta.url), "utf8");
  assert.match(route, /<ImportAgreement \/>/);
  assert.doesNotMatch(component, /useWorkspace|has_api_key|analyzeDocument|generateReview|window\.confirm|window\.alert/);
});
