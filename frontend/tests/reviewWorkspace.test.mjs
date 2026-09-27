import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { appHeaderHarness } from "./appHeaderHarness.mjs";

function loadModule(path, imports = {}, globals = {}) {
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, React, Error, console, setTimeout, clearTimeout, ...globals,
    require(name) { assert.ok(name in imports, `Unexpected dependency: ${name}`); return imports[name]; },
  });
  return exports;
}

const clone = value => JSON.parse(JSON.stringify(value));
const brief = { perspective: "neutral", role: "", priorities: "" };
const customer = { perspective: "customer", role: "Example Customer", priorities: "Exit continuity" };
function initial() {
  return { document_id: "doc-1", source_revision_id: "source-1", revision: 0, brief: clone(brief), fixture_available: true,
    runs: [{ id: "run-1", kind: "fixture", source_revision_id: "source-1", created_at: "2026-01-01", context: clone(customer),
      fixture_version: "fixture-v1", overview: "Selected synthetic overview", findings: [{ id: "finding-1", title: "Archive exit",
        facts: "A conditional extension.", interpretation: "This may preserve continuity.", uncertainty: "No notice date supplied.",
        next_step: "Check scope.", suggested_question: "Can the Archive extension be confirmed?", evidence: [] }] }],
    personal: { "run-1": { drafts: {}, saved_questions: {}, markers: {}, opened_finding_ids: [],
      position: { view: "findings", finding_id: "finding-1", evidence_span_id: null } } } };
}

function apply(workspace, operation) {
  const next = clone(workspace);
  next.revision += 1;
  if (operation.type === "set_brief") next.brief = clone(operation.brief);
  else {
    const personal = next.personal[operation.run_id];
    if (operation.type === "set_draft") personal.drafts[operation.finding_id] = operation.text;
    if (operation.type === "set_ask_draft") (personal.ask_drafts ||= {})[operation.finding_id] = operation.text;
    if (operation.type === "save_question") personal.saved_questions[operation.finding_id] = {
      id: personal.saved_questions[operation.finding_id]?.id || "question-1", text: operation.text, saved_at: "2026-01-01",
    };
    if (operation.type === "remove_question") {
      const question = personal.saved_questions[operation.finding_id];
      if (question && !Object.hasOwn(personal.drafts, operation.finding_id)) personal.drafts[operation.finding_id] = question.text;
      delete personal.saved_questions[operation.finding_id];
    }
    if (operation.type === "set_marker") personal.markers[operation.finding_id] = operation.marker;
    if (operation.type === "set_position") personal.position = clone(operation.position);
  }
  return next;
}

function harness({ delayed = false } = {}) {
  let server = initial();
  let timerId = 0;
  const timers = new Map();
  const calls = [];
  let failure = null;
  const state = loadModule("../src/components/workspace/workspaceState.ts", {}, {
    setTimeout(callback) { const id = ++timerId; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); },
  });
  const transport = {
    async load() { return clone(server); },
    async update(documentId, revision, operation) {
      const call = { documentId, revision, operation: clone(operation) }; calls.push(call);
      if (failure) { const error = failure; failure = null; throw error; }
      const commit = () => {
        if (revision !== server.revision) throw Object.assign(new Error("Changed elsewhere"), { code: "REVISION_CONFLICT" });
        server = apply(server, operation); return clone(server);
      };
      if (!delayed) return commit();
      return new Promise((resolve, reject) => { call.finish = () => { try { resolve(commit()); } catch (error) { reject(error); } }; });
    },
    async fixture(documentId, revision) { calls.push({ documentId, revision, fixture: true }); return clone(server); },
    async generate(documentId, revision, requestId, modelId) {
      calls.push({ documentId, revision, requestId, modelId, generate: true });
      if (!server.runs.some(run => run.id === requestId)) {
        server.revision += 1;
        server.runs.push({ ...clone(server.runs[0]), id: requestId, kind: "ai", status: "ready", context: clone(server.brief) });
        server.personal[requestId] = clone(state.emptyPersonal());
      }
      return clone(server);
    },
    async interrupt(documentId, revision, runId) {
      calls.push({ documentId, revision, runId, interrupt: true });
      server.revision += 1;
      server.runs.find(run => run.id === runId).status = "interrupted";
      return clone(server);
    },
    async ask(documentId, revision, requestId, modelId, runId, findingId, question, includeHistory) {
      calls.push({ documentId, revision, requestId, modelId, runId, findingId, question, includeHistory, ask: true });
      server.ask_turns ||= [];
      if (!server.ask_turns.some(turn => turn.id === requestId)) {
        server.revision += 1;
        server.ask_turns.push({ ...askTurn(), id: requestId, modelId, run_id: runId, finding_id: findingId, question,
          include_history: includeHistory });
      }
      return clone(server);
    },
    async interruptAsk(documentId, revision, turnId) {
      calls.push({ documentId, revision, turnId, interruptAsk: true });
      server.revision += 1;
      server.ask_turns.find(turn => turn.id === turnId).status = "interrupted";
      return clone(server);
    },
  };
  const controller = new state.ReviewWorkspaceController("doc-1", transport, 500);
  return { state, controller, calls, transport,
    timers: () => { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(callback => callback()); },
    timerCount: () => timers.size,
    failNext(error) { failure = error; }, server: () => server, setServer(value) { server = value; },
  };
}
const settle = async () => { for (let index = 0; index < 12; index += 1) await Promise.resolve(); };

test("question removal waits for confirmation and retains drafts, markers and source-scoped output", async () => {
  const h = harness({ delayed: true }); const server = h.server();
  server.personal["run-1"].saved_questions["finding-1"] = { id: "kept", text: "Saved wording", saved_at: "earlier" };
  server.personal["run-1"].drafts["finding-1"] = "Separate draft";
  server.personal["run-1"].markers["finding-1"] = "revisit";
  const runBefore = JSON.stringify(server.runs);
  await h.controller.load(); h.controller.removeQuestion("run-1", "finding-1"); h.controller.removeQuestion("run-1", "finding-1");
  assert.equal(h.calls.length, 1);
  assert.deepEqual(h.calls[0].operation, { type: "remove_question", run_id: "run-1", finding_id: "finding-1" });
  assert.equal(h.controller.getSnapshot().workspace.personal["run-1"].saved_questions["finding-1"].text, "Saved wording");
  h.calls[0].finish(); await settle();
  const personal = h.controller.getSnapshot().workspace.personal["run-1"];
  assert.equal(personal.saved_questions["finding-1"], undefined); assert.equal(personal.drafts["finding-1"], "Separate draft");
  assert.equal(personal.markers["finding-1"], "revisit"); assert.equal(JSON.stringify(h.server().runs), runBefore);
});

test("removal recovers missing draft but preserves explicit empty draft, and recovered wording can be saved again", async () => {
  for (const priorDraft of [undefined, ""]) {
    const h = harness(); const personal = h.server().personal["run-1"];
    personal.saved_questions["finding-1"] = { id: "kept", text: "Recover me", saved_at: "earlier" };
    if (priorDraft !== undefined) personal.drafts["finding-1"] = priorDraft;
    await h.controller.load(); h.controller.removeQuestion("run-1", "finding-1"); await settle();
    assert.equal(h.controller.getSnapshot().workspace.personal["run-1"].drafts["finding-1"], priorDraft ?? "Recover me");
    h.controller.saveQuestion("run-1", "finding-1", "Deliberately restored"); await settle();
    assert.equal(h.server().personal["run-1"].saved_questions["finding-1"].text, "Deliberately restored");
  }
});

test("removal refuses foreign, absent, pending and processing targets", async () => {
  const h = harness(); h.server().personal["run-1"].saved_questions["finding-1"] = { text: "Saved" };
  h.controller.removeQuestion("run-1", "finding-1"); assert.equal(h.calls.length, 0);
  await h.controller.load(); h.controller.removeQuestion("other-run", "finding-1"); h.controller.removeQuestion("run-1", "other-finding");
  assert.equal(h.calls.length, 0);
  h.controller.setDraft("run-1", "finding-1", "Pending draft"); h.controller.removeQuestion("run-1", "finding-1");
  assert.equal(h.calls.length, 0); h.timers(); await settle();
  h.server().runs[0].status = "processing"; await h.controller.load(); h.controller.removeQuestion("run-1", "finding-1");
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0].operation.type, "set_draft");
  h.controller.dispose(); h.controller.removeQuestion("run-1", "finding-1"); assert.equal(h.calls.length, 1);
});

test("conflicted removal keeps confirmed question and requires explicit reconciliation before applying", async () => {
  const h = harness(); h.server().personal["run-1"].saved_questions["finding-1"] = { text: "Saved" };
  await h.controller.load(); h.server().revision += 1;
  h.controller.removeQuestion("run-1", "finding-1"); await settle();
  assert.equal(h.controller.getSnapshot().status, "conflict"); assert.equal(h.calls.length, 1);
  assert.equal(h.controller.getSnapshot().workspace.personal["run-1"].saved_questions["finding-1"].text, "Saved");
  h.controller.removeQuestion("run-1", "finding-1"); assert.equal(h.calls.length, 1);
  await h.controller.reloadSaved(); assert.equal(h.controller.getSnapshot().status, "review"); assert.equal(h.calls.length, 1);
  h.controller.retryPending(); await settle(); assert.equal(h.server().personal["run-1"].saved_questions["finding-1"], undefined);
});

test("lost removal response does not erase recovery wording or automatically replay against refreshed state", async () => {
  const h = harness(); h.server().personal["run-1"].saved_questions["finding-1"] = { text: "Saved" };
  const update = h.transport.update;
  h.transport.update = async (...args) => { await update(...args); throw new Error("Lost response"); };
  await h.controller.load(); h.controller.removeQuestion("run-1", "finding-1"); await settle();
  assert.equal(h.controller.getSnapshot().status, "failed"); assert.equal(h.calls.length, 1);
  assert.equal(h.server().personal["run-1"].drafts["finding-1"], "Saved");
  await h.controller.reloadSaved(); assert.equal(h.calls.length, 1);
  assert.equal(h.controller.getSnapshot().status, "review");
  assert.equal(h.controller.getSnapshot().workspace.personal["run-1"].saved_questions["finding-1"], undefined);
  assert.equal(h.controller.getSnapshot().workspace.personal["run-1"].drafts["finding-1"], "Saved");
});

test("drafts debounce to latest text, show pending immediately and never add saved questions", async () => {
  const h = harness(); await h.controller.load();
  h.controller.setDraft("run-1", "finding-1", "a");
  h.controller.setDraft("run-1", "finding-1", "latest");
  assert.equal(h.calls.length, 0);
  assert.equal(h.controller.getSnapshot().pending, 1);
  assert.equal(h.state.hasUnconfirmedChanges(h.controller.getSnapshot()), true);
  h.timers(); await settle();
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].operation.text, "latest");
  assert.equal(h.server().personal["run-1"].drafts["finding-1"], "latest");
  assert.deepEqual(h.server().personal["run-1"].saved_questions, {});
  assert.equal(h.state.hasUnconfirmedChanges(h.controller.getSnapshot()), false);
});

test("writes are serialized with confirmed revisions and delayed replies cannot erase newer wording", async () => {
  const h = harness({ delayed: true }); await h.controller.load();
  h.controller.setDraft("run-1", "finding-1", "first"); h.timers();
  h.controller.setDraft("run-1", "finding-1", "newer"); h.timers();
  assert.equal(h.calls.length, 1);
  h.calls[0].finish(); await settle();
  assert.equal(h.calls.length, 2);
  assert.deepEqual(h.calls.map(call => call.revision), [0, 1]);
  assert.equal(h.controller.getSnapshot().localDrafts[h.state.draftKey("run-1", "finding-1")], "newer");
  assert.equal(h.controller.getSnapshot().workspace.personal["run-1"].drafts["finding-1"], "first");
  h.calls[1].finish(); await settle();
  assert.equal(h.server().personal["run-1"].drafts["finding-1"], "newer");
  assert.equal(h.controller.getSnapshot().pending, 0);
});

test("question updates keep the old saved wording until confirmed and do not create duplicate entries", async () => {
  const h = harness({ delayed: true });
  h.setServer(apply(h.server(), { type: "save_question", run_id: "run-1", finding_id: "finding-1", text: "Saved before" }));
  await h.controller.load();
  h.controller.saveQuestion("run-1", "finding-1", "Explicit new question");
  assert.equal(h.controller.getSnapshot().workspace.personal["run-1"].saved_questions["finding-1"].text, "Saved before");
  h.calls[0].finish(); await settle();
  assert.equal(h.calls[1].operation.type, "save_question");
  assert.equal(h.controller.getSnapshot().workspace.personal["run-1"].saved_questions["finding-1"].text, "Saved before");
  h.controller.setDraft("run-1", "finding-1", "A still newer draft");
  h.calls[1].finish(); await settle();
  assert.equal(h.server().personal["run-1"].saved_questions["finding-1"].text, "Explicit new question");
  assert.equal(Object.keys(h.server().personal["run-1"].saved_questions).length, 1);
  assert.equal(h.server().personal["run-1"].saved_questions["finding-1"].id, "question-1");
  assert.equal(h.controller.getSnapshot().localDrafts[h.state.draftKey("run-1", "finding-1")], "A still newer draft");
});

test("conflicts freeze queued changes; reload preserves local drafts and requires explicit apply", async () => {
  const h = harness(); await h.controller.load();
  h.setServer(apply(h.server(), { type: "set_draft", run_id: "run-1", finding_id: "finding-1", text: "Other tab wording" }));
  h.controller.setDraft("run-1", "finding-1", "My wording"); h.timers(); await settle();
  assert.equal(h.controller.getSnapshot().status, "conflict");
  h.controller.enqueue({ type: "set_marker", run_id: "run-1", finding_id: "finding-1", marker: "revisit" });
  h.controller.retryPending(); await settle();
  assert.equal(h.calls.length, 1);
  await h.controller.reloadSaved(); await settle();
  const snapshot = h.controller.getSnapshot();
  assert.equal(snapshot.status, "review");
  assert.equal(snapshot.workspace.personal["run-1"].drafts["finding-1"], "Other tab wording");
  assert.equal(snapshot.localDrafts[h.state.draftKey("run-1", "finding-1")], "My wording");
  assert.equal(h.calls.length, 1);
  h.controller.retryPending(); await settle();
  assert.deepEqual(h.calls.map(call => call.revision), [0, 1, 2]);
  assert.equal(h.server().personal["run-1"].drafts["finding-1"], "My wording");
  assert.equal(h.server().personal["run-1"].markers["finding-1"], "revisit");
});

test("network failures retain wording and explicit retry still uses the last confirmed revision", async () => {
  const h = harness(); await h.controller.load();
  h.failNext(Object.assign(new Error("Network unavailable"), { code: "NETWORK_ERROR" }));
  h.controller.setDraft("run-1", "finding-1", "Keep me"); h.timers(); await settle();
  assert.equal(h.controller.getSnapshot().status, "failed");
  assert.equal(h.controller.getSnapshot().localDrafts[h.state.draftKey("run-1", "finding-1")], "Keep me");
  h.controller.retryPending(); await settle();
  assert.deepEqual(h.calls.map(call => call.revision), [0, 0]);
  assert.equal(h.server().personal["run-1"].drafts["finding-1"], "Keep me");
});

test("a committed write with a lost response cannot silently replay or duplicate a saved question", async () => {
  const h = harness(); await h.controller.load();
  const update = h.transport.update;
  let loseResponse = true;
  h.transport.update = async (...args) => {
    const result = await update(...args);
    if (loseResponse) { loseResponse = false; throw Object.assign(new Error("Response lost"), { code: "NETWORK_ERROR" }); }
    return result;
  };
  h.controller.saveQuestion("run-1", "finding-1", "Keep one question"); await settle();
  assert.equal(h.server().revision, 1);
  assert.equal(h.controller.getSnapshot().workspace.revision, 0);
  h.controller.retryPending(); await settle();
  assert.equal(h.controller.getSnapshot().status, "conflict");
  assert.equal(h.server().revision, 1);
  await h.controller.reloadSaved();
  assert.equal(h.controller.getSnapshot().status, "review");
  h.controller.retryPending(); await settle();
  assert.equal(Object.keys(h.server().personal["run-1"].saved_questions).length, 1);
  assert.equal(h.server().personal["run-1"].saved_questions["finding-1"].text, "Keep one question");
});

test("flushing before a guarded leave sends pending drafts and does not mark them confirmed early", async () => {
  const h = harness({ delayed: true }); await h.controller.load();
  h.controller.setDraft("run-1", "finding-1", "Before leaving");
  assert.equal(h.state.hasUnconfirmedChanges(h.controller.getSnapshot()), true);
  h.controller.flushDrafts();
  assert.equal(h.calls.length, 1);
  assert.equal(h.state.hasUnconfirmedChanges(h.controller.getSnapshot()), true);
  h.calls[0].finish(); await settle();
  assert.equal(h.state.hasUnconfirmedChanges(h.controller.getSnapshot()), false);
});

test("reloading does not flush draft timers into an automatic write or erase unsaved brief edits", async () => {
  const h = harness(); await h.controller.load();
  h.controller.setDraft("run-1", "finding-1", "Unconfirmed");
  h.controller.setBriefDraft({ ...brief, priorities: "My unsaved priority" });
  await h.controller.reloadSaved(); await settle();
  assert.equal(h.calls.length, 0);
  assert.equal(h.controller.getSnapshot().status, "review");
  assert.equal(h.controller.getSnapshot().briefDraft.priorities, "My unsaved priority");
});

test("disposing a workspace cancels its debounce and cannot write into another document", async () => {
  const h = harness(); await h.controller.load();
  h.controller.setDraft("run-1", "finding-1", "Unconfirmed before close");
  h.controller.dispose(); h.timers(); await settle();
  assert.equal(h.calls.length, 0);
});

test("reopening a document waits for its retired controller write before loading a revision", async () => {
  const h = harness({ delayed: true }); await h.controller.load();
  h.controller.enqueue({ type: "set_position", run_id: "run-1", position: {
    view: "my_review", finding_id: "finding-1", evidence_span_id: null,
  } });
  h.controller.dispose();
  const reopened = new h.state.ReviewWorkspaceController("doc-1", h.transport);
  const loading = reopened.load();
  await settle();
  assert.equal(reopened.getSnapshot().status, "loading");
  h.calls[0].finish(); await loading;
  assert.equal(reopened.getSnapshot().workspace.revision, 1);
  reopened.enqueue({ type: "set_position", run_id: "run-1", position: {
    view: "overview", finding_id: "finding-1", evidence_span_id: null,
  } });
  assert.equal(h.calls[1].revision, 1);
  h.calls[1].finish(); await settle();
  assert.equal(reopened.getSnapshot().status, "saved");
  reopened.dispose();
});

test("a retired write does not block another document and a disposed waiting reader never loads", async () => {
  const h = harness({ delayed: true }); await h.controller.load();
  h.controller.enqueue({ type: "set_marker", run_id: "run-1", finding_id: "finding-1", marker: "revisit" });
  h.controller.dispose();
  const reads = [];
  const load = h.transport.load;
  h.transport.load = async documentId => { reads.push(documentId); return load(documentId); };
  const reopened = new h.state.ReviewWorkspaceController("doc-1", h.transport);
  const loading = reopened.load();
  const other = new h.state.ReviewWorkspaceController("doc-2", h.transport);
  await other.load();
  assert.deepEqual(reads, ["doc-2"]);
  reopened.dispose();
  h.calls[0].finish(); await loading;
  assert.deepEqual(reads, ["doc-2"]);
  other.dispose();
});

test("a failed retired write releases the read barrier without replaying the edit", async () => {
  const h = harness(); await h.controller.load();
  let rejectWrite;
  let writeCount = 0;
  h.transport.update = () => {
    writeCount += 1;
    return new Promise((resolve, reject) => { rejectWrite = reject; });
  };
  h.controller.setDraft("run-1", "finding-1", "Unconfirmed wording"); h.timers();
  h.controller.dispose();
  const reopened = new h.state.ReviewWorkspaceController("doc-1", h.transport);
  const loading = reopened.load();
  await settle();
  assert.equal(reopened.getSnapshot().status, "loading");
  rejectWrite(new Error("Connection closed")); await loading;
  assert.equal(reopened.getSnapshot().status, "saved");
  assert.equal(reopened.getSnapshot().workspace.revision, 0);
  assert.equal(h.timerCount(), 0);
  assert.equal(writeCount, 1);
  assert.equal(h.controller.getSnapshot().localDrafts[h.state.draftKey("run-1", "finding-1")], "Unconfirmed wording");
  reopened.dispose();
});

test("a stalled retired write bounds loading and retry without reading stale state or replaying", async () => {
  const h = harness({ delayed: true }); await h.controller.load();
  h.controller.enqueue({ type: "set_marker", run_id: "run-1", finding_id: "finding-1", marker: "revisit" });
  h.controller.dispose();
  let readCount = 0;
  const load = h.transport.load;
  h.transport.load = async (...args) => { readCount += 1; return load(...args); };
  const reopened = new h.state.ReviewWorkspaceController("doc-1", h.transport);
  const loading = reopened.load();
  assert.equal(h.timerCount(), 1);
  h.timers(); await loading;
  assert.equal(reopened.getSnapshot().status, "failed");
  assert.match(reopened.getSnapshot().error, /earlier save is still awaiting confirmation/);
  assert.equal(readCount, 0);
  assert.equal(h.calls.length, 1);
  assert.equal(h.timerCount(), 0);

  const retry = reopened.reloadSaved();
  h.timers(); await retry;
  assert.equal(reopened.getSnapshot().status, "failed");
  assert.equal(readCount, 0);
  assert.equal(h.calls.length, 1);

  h.calls[0].finish(); await settle();
  await reopened.reloadSaved();
  assert.equal(reopened.getSnapshot().status, "saved");
  assert.equal(reopened.getSnapshot().workspace.revision, 1);
  assert.equal(readCount, 1);
  assert.equal(h.calls.length, 1);
  assert.equal(h.timerCount(), 0);
  reopened.dispose();
});

test("source matching requires exact revision, span, page and Unicode code-point slice", () => {
  const { evidenceMatches } = harness().state;
  const source = { id: "doc-1", source_revision_id: "source-1", source_extraction: { pages: [{ page_number: 2, text: "🙂 obligation", spans: [{ id: "span-1", start: 2, end: 12, text: "obligation" }] }] } };
  const evidence = { source_revision_id: "source-1", page_number: 2, span_id: "span-1", quote: "obligation", label: "Rule" };
  assert.equal(evidenceMatches(evidence, source), true);
  for (const change of [{ source_revision_id: "other" }, { page_number: 1 }, { span_id: "missing" }, { quote: "Obligation" }]) {
    assert.equal(evidenceMatches({ ...evidence, ...change }, source), false);
  }
  assert.equal(evidenceMatches({ ...evidence, end_span_id: null }, source), true);
});

function passageFixture() {
  const text = "🙂 Rule applies.\n  Only if requested.\nCharges continue.";
  const phrases = ["🙂 Rule applies.", "Only if requested.", "Charges continue."];
  const spans = phrases.map((phrase, index) => {
    const start = Array.from(text.slice(0, text.indexOf(phrase))).length;
    return { id: `passage-${index + 1}`, start, end: start + Array.from(phrase).length, text: phrase };
  });
  return {
    source: { id: "doc-1", source_revision_id: "source-1", source_extraction: { pages: [
      { page_number: 2, text, spans },
      { page_number: 3, text: "Other page", spans: [{ id: "other-page", start: 0, end: 10, text: "Other page" }] },
    ] } },
    evidence: { source_revision_id: "source-1", page_number: 2, span_id: spans[0].id,
      end_span_id: spans[2].id, quote: text, label: "Rule, qualification and cost" },
  };
}

test("passage matching preserves complete exact Unicode text and whitespace between inclusive anchors", () => {
  const { evidenceMatches } = harness().state;
  const { evidence, source } = passageFixture();
  assert.equal(evidenceMatches(evidence, source), true);
  const span = source.source_extraction.pages[0].spans[1];
  assert.equal(evidenceMatches({ ...evidence, span_id: span.id, end_span_id: span.id, quote: span.text }, source), true);
  for (const change of [
    { source_revision_id: "wrong-source" }, { page_number: 3 }, { span_id: "missing" },
    { end_span_id: "missing" }, { end_span_id: "other-page" }, { end_span_id: "passage-2" },
    { span_id: "passage-3", end_span_id: "passage-1" }, { quote: evidence.quote.replace("\n  ", " ") },
    { quote: evidence.quote.replace("Only", "only") }, { end_span_id: null },
  ]) assert.equal(evidenceMatches({ ...evidence, ...change }, source), false, JSON.stringify(change));
});

test("passage matching rejects missing, reordered, duplicated, overlapping or tampered anchors", () => {
  const { evidenceMatches } = harness().state;
  const mutations = [
    page => page.spans.splice(1, 1), // Exact quote alone cannot hide unanchored nonblank content.
    page => page.spans.reverse(),
    page => page.spans.push({ ...page.spans[1] }),
    page => { page.spans[1].start -= 1; },
    page => { page.spans[1].text = "Different qualification"; },
    page => { page.spans[1].start = -1; },
    page => { page.spans[1].end = 999; },
    page => { page.spans[1].start += 0.5; },
    page => {
      page.spans.splice(1, 0, { id: "overlap", start: 2, end: 6, text: "Rule" });
    },
    page => {
      page.spans.push({ id: "outside-overlap", start: 2, end: 6, text: "Rule" });
    },
  ];
  for (const mutate of mutations) {
    const { source, evidence } = passageFixture();
    mutate(source.source_extraction.pages[0]);
    assert.equal(evidenceMatches(evidence, source), false, mutate.toString());
  }
  const { source, evidence } = passageFixture();
  source.source_extraction.pages[1].spans[0].id = evidence.end_span_id;
  assert.equal(evidenceMatches(evidence, source), false);
});

test("a complete passage stays one evidence card and navigates to its physical page with the first resume anchor", () => {
  const helpers = harness().state;
  const controlsForEvidence = loadModule("../src/components/workspace/WorkspaceControls.tsx", {
    react: React, "./workspaceState": helpers,
  });
  let navigation;
  const { EvidenceList } = loadModule("../src/components/workspace/EvidenceSourcePane.tsx", {
    react: React,
    "./evidencePresentation": evidencePresentation,
    "./workspaceState": helpers, "./WorkspaceControls": controlsForEvidence, "lucide-react": icons,
  });
  const { DocumentWorkspace } = loadModule("../src/components/workspace/DocumentWorkspace.tsx", {
    react: React, "@/components/PDFViewer": props => { navigation = props.navigationRequest; return null; },
    "./evidencePresentation": evidencePresentation, "./DocumentWorkspace.module.css": {},
  });
  const { source, evidence } = passageFixture();
  let opened;
  const card = EvidenceList({ evidence: [evidence], source, onOpen(item) { opened = item; } });
  const html = renderToStaticMarkup(card);
  assert.equal((html.match(/<article/g) || []).length, 1);
  assert.match(html, /Passage matched to source/);
  assert.match(html, /Only if requested/);
  assert.match(html, /Charges continue/);
  assert.doesNotMatch(html, /disabled=""/);
  function clickAction(node) {
    if (!React.isValidElement(node)) return;
    if (node.props.onClick) node.props.onClick();
    React.Children.forEach(node.props.children, clickAction);
  }
  clickAction(card);
  assert.equal(opened, evidence);
  const run = initial().runs[0]; run.findings[0].evidence = [opened];
  const position = helpers.safeReviewPosition(run, "document", "finding-1", opened.span_id);
  assert.equal(position.evidence_span_id, "passage-1");
  assert.equal(position.finding_id, "finding-1");
  renderToStaticMarkup(React.createElement(DocumentWorkspace, {
    documentId: "doc-1", filename: "synthetic.pdf", source, finding: run.findings[0], evidence: opened,
    navigationRequest: { requestId: 1, pageNumber: opened.page_number }, onReturn() {},
  }));
  assert.equal(navigation.pageNumber, 2);
});

test("the source PDF has a bounded viewport while preserving the requested physical page", () => {
  let navigation;
  const { DocumentWorkspace } = loadModule("../src/components/workspace/DocumentWorkspace.tsx", {
    react: React,
    "./evidencePresentation": evidencePresentation,
    "@/components/PDFViewer": props => {
      navigation = props.navigationRequest;
      return React.createElement("div", { "data-testid": "pdf-viewer-stub" });
    },
    "./DocumentWorkspace.module.css": { pdfPane: "document-pdf-pane" },
  });
  const html = renderToStaticMarkup(React.createElement(DocumentWorkspace, {
    documentId: "long-doc", filename: "long-synthetic.pdf", source: null,
    finding: null, evidence: null,
    navigationRequest: { requestId: 1, pageNumber: 25 }, onReturn() {},
  }));
  assert.match(html, /<div class="document-pdf-pane"><div data-testid="pdf-viewer-stub"><\/div><\/div>/);
  assert.equal(navigation.pageNumber, 25);
  // CSS sizing is covered by documentWorkspace.test; this preserves the physical-page adapter.
});

test("unmatched evidence renders an explicit limitation and cannot jump to a guessed location", () => {
  const helpers = harness().state;
  const controlsForEvidence = loadModule("../src/components/workspace/WorkspaceControls.tsx", {
    react: React, "./workspaceState": helpers,
  });
  const { EvidenceSourcePane } = loadModule("../src/components/workspace/EvidenceSourcePane.tsx", {
    react: React, "./workspaceState": helpers,
    "./evidencePresentation": evidencePresentation,
    "./WorkspaceControls": controlsForEvidence, "lucide-react": icons,
  });
  const finding = { ...initial().runs[0].findings[0], evidence: [{ source_revision_id: "source-1",
    span_id: "not-found", page_number: 25, quote: "Unmatched excerpt", label: "Possible exception" }] };
  const html = renderToStaticMarkup(React.createElement(EvidenceSourcePane, { finding, source: null, onOpen() {} }));
  assert.match(html, /Quote could not be matched/);
  assert.match(html, /disabled=""/);
  assert.doesNotMatch(html, /Finding verified/);
});

test("API mutations carry expected revisions, preserve errors and encode document identity", async () => {
  const calls = [];
  const api = { async get(path) { calls.push(path); return { success: true, data: initial() }; },
    async put(path, body) { calls.push({ path, body }); return { success: false, error: { code: "REVISION_CONFLICT", message: "Changed elsewhere" } }; },
    async post(path, body, options) { calls.push({ path, body, options }); return { success: true, data: initial() }; } };
  const { reviewWorkspaceApi } = loadModule("../src/lib/reviewWorkspaceApi.ts", { "@/lib/api": { default: api, __esModule: true } });
  await reviewWorkspaceApi.load("a/b");
  const operation = { type: "set_brief", brief };
  await assert.rejects(reviewWorkspaceApi.update("a/b", 7, operation), error => error.code === "REVISION_CONFLICT" && error.message === "Changed elsewhere");
  await reviewWorkspaceApi.fixture("a/b", 8);
  await reviewWorkspaceApi.generate("a/b", 9, "request-1", "test-model", "max");
  await reviewWorkspaceApi.interrupt("a/b", 10, "run/a");
  assert.equal(calls[0], "/documents/a%2Fb/review-workspace");
  assert.equal(calls[1].body.expected_revision, 7);
  assert.equal(calls[1].body.operation, operation);
  assert.equal(calls[2].body.expected_revision, 8);
  assert.deepEqual(clone(calls[3].body), { expected_revision: 9, request_id: "request-1", model_id: "test-model", reasoning_effort: "max" });
  assert.equal(calls[3].options.timeout, 210000);
  assert.equal(calls[4].path, "/documents/a%2Fb/review-workspace/runs/run%2Fa/interrupt");
  assert.equal(calls[4].body.expected_revision, 10);
});

const stateHelpers = loadModule("../src/components/workspace/workspaceState.ts");
const evidencePresentation = loadModule("../src/components/workspace/evidencePresentation.ts", { "./workspaceState": stateHelpers });
const askAnswerPresentation = loadModule("../src/components/workspace/askAnswerPresentation.ts");
const controls = loadModule("../src/components/workspace/WorkspaceControls.tsx", { react: React, "./workspaceState": stateHelpers });
const icon = name => props => React.createElement("i", { ...props, "data-icon": name });
const icons = Object.fromEntries(["ChevronRight", "FileText", "Info", "CircleHelp", "ArrowLeft", "ArrowRight", "BookOpen", "Settings", "Palette"].map(name => [name, icon(name)]));
const generationControls = loadModule("../src/components/workspace/ReviewGenerationControls.tsx", {
  react: React, "./workspaceState": stateHelpers, "./WorkspaceControls": controls,
  "@/components/ui/Modal": () => null,
  "@/context/WorkspaceContext": { useWorkspace: () => ({ settings: { has_api_key: true, model_id: "test-model" }, isLoading: false, error: null, refresh() {} }) },
});
const evidenceControls = loadModule("../src/components/workspace/EvidenceSourcePane.tsx", {
  react: React, "./workspaceState": stateHelpers,
  "./evidencePresentation": evidencePresentation,
  "./WorkspaceControls": controls, "lucide-react": icons,
});
const documentControls = loadModule("../src/components/workspace/DocumentWorkspace.tsx", {
  react: React, "@/components/PDFViewer": props => props.toolbarLeading || null,
  "./evidencePresentation": evidencePresentation, "./DocumentWorkspace.module.css": {},
});
const askControls = loadModule("../src/components/workspace/FindingAsk.tsx", {
  react: React, "./workspaceState": stateHelpers, "./WorkspaceControls": controls,
  "./askAnswerPresentation": askAnswerPresentation,
  "./EvidenceSourcePane": evidenceControls, "@/components/ui/Modal": () => null,
  "@/context/WorkspaceContext": { useWorkspace: () => ({ settings: { has_api_key: true, model_id: "test-model" }, isLoading: false, error: null, refresh() {} }) },
});
const summaryImports = { react: React, "lucide-react": icons, "./workspaceState": stateHelpers,
  "./WorkspaceControls": controls, "./EvidenceSourcePane": evidenceControls,
  "./ReviewBriefExport": { ReviewBriefExport: props => React.createElement("section", {
    "data-testid": "review-brief-export", "data-unavailable": props.unavailable,
  }) },
  "./WorkspaceSummaries.module.css": { summaries: "workspace-summaries" },
  "./MyReview.module.css": { review: "my-review" }, "@/components/ui/Modal": () => null };
const overviewControls = loadModule("../src/components/workspace/AgreementOverview.tsx", summaryImports);
const myReviewControls = loadModule("../src/components/workspace/MyReview.tsx", { ...summaryImports, react: { ...React, useState: value => [value, () => {}] } });
const readNoticeControls = loadModule("../src/components/workspace/SourceReadNotice.tsx", summaryImports);
const headerControls = loadModule("../src/components/workspace/WorkspaceHeader.tsx", {
  react: React, "./workspaceState": stateHelpers, "./WorkspaceControls": controls,
  "@/components/shell/AppHeader": appHeaderHarness(),
});
const findingControls = loadModule("../src/components/workspace/FindingReview.tsx", {
  react: React, "./workspaceState": stateHelpers, "./WorkspaceControls": controls, "lucide-react": icons,
  "./EvidenceSourcePane": evidenceControls, "./FindingAsk": askControls,
});

test("saving feedback is honest during debounce, brief editing and conflict recovery", () => {
  const savedState = { workspace: initial(), status: "saved", pending: 0, localDrafts: {}, briefDraft: null, error: null };
  function html(state) { return renderToStaticMarkup(React.createElement(controls.SaveFeedback, { state, onReload() {}, onRetry() {} })); }
  assert.match(html({ ...savedState, pending: 1 }), /Saving changes/);
  assert.match(html({ ...savedState, briefDraft: customer }), /Brief edits have not been saved/);
  assert.match(html({ ...savedState, status: "conflict" }), /No conflicting edits were applied/);
  assert.match(html({ ...savedState, status: "review" }), /Apply my pending changes/);
});

function renderWorkspace(view, overrides = {}) {
  const workspace = initial();
  workspace.personal["run-1"].opened_finding_ids = ["finding-1"];
  workspace.personal["run-1"].saved_questions["finding-1"] = { id: "question-1", text: "Previously saved question", saved_at: "2026-01-01" };
  workspace.personal["run-1"].drafts["finding-1"] = "A recovered draft";
  const state = { workspace, status: "saved", pending: 0, localDrafts: {}, briefDraft: null, error: null, ...overrides };
  const component = loadModule("../src/components/workspace/ReviewWorkspace.tsx", {
    react: { ...React, useState: value => [value === "overview" ? view : value, () => {}] },
    "next/link": ({ children, ...props }) => React.createElement("a", props, children),
    "next/navigation": { useRouter: () => ({ push() {} }) },
    "@/components/ui/Modal": () => null,
    "@/hooks/useReviewWorkspace": { useReviewWorkspace: () => ({ controller: {}, state, source: null, filename: "synthetic.pdf", sourceError: null }) },
    "@/lib/librarySearch": { librarySourceTargetError: () => null },
    "./workspaceState": stateHelpers, "./WorkspaceControls": controls,
    "./DocumentWorkspace": { DocumentWorkspace: () => null },
    "./EvidenceSourcePane": { EvidenceSourcePane: () => null, EvidenceList: () => null },
    "./ReviewGenerationControls": generationControls,
    "./FindingAsk": askControls,
    "./WorkspaceHeader": headerControls,
    "./ReviewSetup": { ReviewSetup: () => React.createElement("section", { "data-testid": "review-setup" }, "Prepare a review") },
    "./FindingReview": findingControls,
    "./AgreementOverview": overviewControls, "./MyReview": myReviewControls, "./SourceReadNotice": readNoticeControls,
    "./ReviewWorkspace.module.css": { shell: "workspace-shell" },
  }).default;
  return renderToStaticMarkup(React.createElement(component, { documentId: "doc-1" }));
}

function initialWorkspaceReadHarness(overrides = {}) {
  const calls = [];
  const state = { workspace: null, status: "failed", pending: 0, localDrafts: {}, localAskDrafts: {},
    briefDraft: null, error: "Request could not be completed." };
  const reads = { state, source: null, filename: "Agreement", sourceStatus: "error", metadataStatus: "error",
    sourceError: "Source text could not be loaded.", metadataError: "Agreement details could not be loaded.",
    retrySource: () => calls.push("source"), retryMetadata: () => calls.push("metadata"), ...overrides };
  const component = loadModule("../src/components/workspace/ReviewWorkspace.tsx", {
    react: { ...React, useEffect() {}, useRef: current => ({ current }), useState: value => [value, () => {}] },
    "next/link": ({ children, ...props }) => React.createElement("a", props, children),
    "next/navigation": { useRouter: () => ({ push() { assert.fail("Initial read recovery must not navigate automatically"); } }) },
    "@/components/ui/Modal": () => null,
    "@/hooks/useReviewWorkspace": { useReviewWorkspace: () => ({ ...reads,
      controller: { reloadSaved: () => calls.push("workspace") } }) },
    "@/lib/librarySearch": { librarySourceTargetError: () => null },
    "./workspaceState": stateHelpers, "./WorkspaceControls": controls,
    "./DocumentWorkspace": documentControls,
    "./EvidenceSourcePane": evidenceControls, "./ReviewGenerationControls": generationControls,
    "./WorkspaceHeader": headerControls, "./FindingReview": findingControls,
    "./ReviewSetup": { ReviewSetup: () => null },
    "./AgreementOverview": overviewControls, "./MyReview": myReviewControls, "./SourceReadNotice": readNoticeControls,
    "./ReviewWorkspace.module.css": { workspace: "workspace-shell" },
  }).default;
  const tree = () => component({ documentId: "doc-1" });
  function nodes(node) {
    if (!React.isValidElement(node)) return [];
    const children = typeof node.type === "function" ? [node.type(node.props)] : React.Children.toArray(node.props.children);
    return [node, ...children.flatMap(nodes)];
  }
  return { calls, state, reads, html: () => renderToStaticMarkup(tree()),
    click(label) {
      const action = nodes(tree()).find(node => node.type === "button" && node.props.children === label);
      assert.ok(action, `Missing read recovery action: ${label}`);
      action.props.onClick();
    } };
}

test("initial workspace read failure does not masquerade as a failed save", () => {
  const h = initialWorkspaceReadHarness();
  const html = h.html();
  assert.match(html, /The review workspace could not be loaded/);
  assert.match(html, /Request could not be completed/);
  assert.match(html, /Retry reads saved review work/);
  assert.match(html, /It does not start a review or send a question/);
  assert.doesNotMatch(html, /Saving could not be confirmed|Retry pending changes|Apply my pending changes|Changes saved locally/);
  assert.match(html, /href="\/documents"/);
  assert.match(html, /href="\/review\?documentId=doc-1"/);
  assert.deepEqual(h.calls, []);
  h.click("Retry workspace loading");
  assert.deepEqual(h.calls, ["workspace"]);
});

test("source and metadata recovery remain independent before a workspace has loaded", () => {
  const h = initialWorkspaceReadHarness();
  const before = JSON.stringify(h.state);
  assert.match(h.html(), /Source text could not be loaded/);
  assert.match(h.html(), /Agreement details could not be loaded/);
  h.click("Retry source loading");
  h.click("Retry agreement details");
  assert.deepEqual(h.calls, ["source", "metadata"]);
  assert.equal(JSON.stringify(h.state), before);
  h.reads.sourceStatus = "ready";
  h.reads.sourceError = null;
  assert.doesNotMatch(h.html(), /Retry source loading/);
  assert.match(h.html(), /Retry agreement details/);
  assert.match(h.html(), /Retry workspace loading/);
});

test("initial workspace loading reports a read in progress and still offers other failed-read recovery", () => {
  const h = initialWorkspaceReadHarness();
  h.state.status = "loading";
  h.state.error = null;
  const html = h.html();
  assert.match(html, /role="status"[^>]*>Loading saved review workspace/);
  assert.doesNotMatch(html, /could not be loaded\. Request|Retry workspace loading|Saving changes/);
  assert.match(html, /Retry source loading/);
  assert.match(html, /Retry agreement details/);
  h.click("Retry source loading");
  assert.deepEqual(h.calls, ["source"]);
});

function workspaceInteractionHarness(workspace, source = null, readOverrides = {}, resumeOnOpen = false, sourceTarget) {
  const slots = [];
  const operations = [];
  let cursor = 0;
  let effects = [];
  const state = { workspace, status: "saved", pending: 0, localDrafts: {}, localAskDrafts: {}, briefDraft: null, error: null };
  const reads = { source, filename: "synthetic.pdf", sourceError: null, sourceStatus: "ready", metadataStatus: "ready", ...readOverrides };
  const FindingProbe = () => null;
  const DocumentProbe = () => null;
  const component = loadModule("../src/components/workspace/ReviewWorkspace.tsx", {
    react: { ...React, useEffect(callback) { effects.push(callback); }, useRef(current) { return slots[cursor++] ||= { current }; }, useState(value) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = value;
      return [slots[index], update => { slots[index] = typeof update === "function" ? update(slots[index]) : update; }];
    } },
    "next/link": () => null, "next/navigation": { useRouter: () => ({ push() {} }) },
    "@/components/ui/Modal": () => null,
    "@/hooks/useReviewWorkspace": { useReviewWorkspace: () => ({
      controller: { enqueue(operation) { operations.push(clone(operation)); state.workspace = apply(state.workspace, operation); } },
      state, ...reads,
    }) },
    "@/lib/librarySearch": { librarySourceTargetError(target, currentSource) {
      if (target.sourceRevisionId !== currentSource.source_revision_id) return "Stale source revision";
      return target.pageNumber <= currentSource.source_extraction?.page_count ? null : "Source page unavailable";
    } },
    "./workspaceState": stateHelpers, "./WorkspaceControls": controls,
    "./DocumentWorkspace": { DocumentWorkspace: DocumentProbe },
    "./EvidenceSourcePane": { EvidenceList: () => null },
    "./ReviewGenerationControls": generationControls,
    "./WorkspaceHeader": headerControls, "./FindingReview": { FindingReview: FindingProbe },
    "./ReviewSetup": { ReviewSetup: () => null },
    "./AgreementOverview": overviewControls, "./MyReview": myReviewControls, "./SourceReadNotice": readNoticeControls,
    "./ReviewWorkspace.module.css": { workspace: "workspace-shell" },
  }).default;
  function tree() { cursor = 0; const result = component({ documentId: workspace.document_id, resumeOnOpen, sourceTarget }); const pending = effects; effects = []; pending.forEach(callback => callback()); return result; }
  function children(node) {
    if (!React.isValidElement(node)) return [];
    return [node, ...React.Children.toArray(node.props.children).flatMap(children)];
  }
  return { state, reads, operations,
    finding: () => children(tree()).find(node => node.type === FindingProbe)?.props,
    document: () => children(tree()).find(node => node.type === DocumentProbe)?.props,
    overview: () => children(tree()).find(node => node.type === overviewControls.AgreementOverview)?.props,
    myReview: () => children(tree()).find(node => node.type === myReviewControls.MyReview)?.props,
    tab(label) { children(tree()).find(node => node.type === "button" && node.props.children[0] === label).props.onClick(); },
    selectRun(id) { children(tree()).find(node => node.type === "select").props.onChange({ target: { value: id } }); },
    mount() { tree(); },
  };
}

test("a Library text result opens its exact physical source page without saving or running AI", () => {
  const source = { source_revision_id: "source-1", source_extraction: { page_count: 25 } };
  const target = { kind: "target", target: { sourceRevisionId: "source-1", pageNumber: 24 } };
  const h = workspaceInteractionHarness(initial(), source, {}, false, target);
  h.mount();
  const reader = h.document();
  assert.ok(reader);
  assert.equal(reader.navigationRequest.pageNumber, 24);
  assert.equal(reader.navigationRequest.restore, undefined);
  assert.equal(reader.returnLabel, "Return to Library");
  assert.deepEqual(h.operations, []);
});

test("a stale Library source result never substitutes a current page or saved bookmark", () => {
  const source = { source_revision_id: "source-2", source_extraction: { page_count: 25 } };
  const target = { kind: "target", target: { sourceRevisionId: "source-1", pageNumber: 24 } };
  const h = workspaceInteractionHarness(initial(), source, {}, false, target);
  h.mount();
  assert.equal(h.document(), undefined);
  assert.deepEqual(h.operations, []);
});

test("My review exports only after pending saves and conflicts are resolved", () => {
  const h = workspaceInteractionHarness(initial());
  h.tab("My review");
  assert.equal(h.myReview().exportUnavailable, undefined);
  for (const status of ["loading", "failed", "conflict", "review", "saving"]) {
    h.state.status = status;
    assert.match(h.myReview().exportUnavailable, /Finish saving or resolve pending changes/, status);
  }
  h.state.status = "saved";
  h.state.pending = 1;
  assert.match(h.myReview().exportUnavailable, /Finish saving/);
  h.state.pending = 0;
  h.state.reviewAction = { status: "generating" };
  assert.match(h.myReview().exportUnavailable, /Finish saving/);
  h.state.reviewAction = { status: "idle" };
  h.state.askAction = { status: "uncertain" };
  assert.match(h.myReview().exportUnavailable, /Finish saving/);
  h.state.askAction = { status: "idle" };
  assert.equal(h.myReview().exportUnavailable, undefined);
});

test("My review waits for document metadata but source read failure still permits a qualified export", () => {
  const workspace = initial();
  workspace.personal["run-1"].saved_questions["finding-1"] = { id: "question-1", text: "Confirmed question?", saved_at: "2026-01-01" };
  const h = workspaceInteractionHarness(workspace, null, { sourceStatus: "error", sourceError: "Source unavailable", metadataStatus: "loading" });
  h.tab("My review");
  assert.match(h.myReview().exportUnavailable, /Load the agreement details/);
  h.reads.metadataStatus = "error";
  assert.match(h.myReview().exportUnavailable, /Load the agreement details/);
  h.reads.metadataStatus = "ready";
  const props = h.myReview();
  assert.equal(props.exportUnavailable, undefined);
  assert.equal(props.source, null);
  assert.equal(props.filename, "synthetic.pdf");
  assert.equal(props.run.id, "run-1");
  assert.equal(props.personal.saved_questions["finding-1"].text, "Confirmed question?");
  const rendered = myReviewControls.MyReview(props);
  const toolbar = React.Children.toArray(rendered.props.children).find(node => node.props?.className === "mr-toolbar");
  const exportNode = React.Children.toArray(toolbar.props.children).find(node => node.type === summaryImports["./ReviewBriefExport"].ReviewBriefExport);
  assert.equal(exportNode.props.unavailable, undefined);
  assert.equal(exportNode.props.source, null);
  assert.equal(exportNode.props.filename, props.filename);
  assert.equal(exportNode.props.run, props.run);
  assert.equal(exportNode.props.personal, props.personal);
});

test("workspace selection keeps exact references sharing one span through source navigation and saved-state refresh", () => {
  const workspace = initial();
  const { source, evidence } = passageFixture();
  const short = { ...evidence, end_span_id: null, quote: source.source_extraction.pages[0].spans[0].text, label: "Base wording" };
  const qualified = { ...evidence, label: "Rule and qualifications" };
  const differentlyLabelled = { ...evidence, label: "Continuing charges" };
  workspace.runs[0].findings[0].evidence = [short, qualified, differentlyLabelled];
  const h = workspaceInteractionHarness(workspace, source);
  h.tab("Findings");
  h.finding().onSelectEvidence(h.finding().finding.evidence[1]);
  let selected = h.finding();
  assert.deepEqual(selected.selectedEvidence, qualified);
  assert.equal(h.state.workspace.revision, 2); // Navigation and selection each return cloned saved state.
  const pane = renderToStaticMarkup(React.createElement(evidenceControls.EvidenceSourcePane, {
    finding: selected.finding, source, selectedEvidence: selected.selectedEvidence, onOpen() {},
  }));
  assert.match(pane, /Only if requested/);
  assert.match(pane, /Charges continue/);
  assert.match(pane, /Passage matched to source/);
  selected.onOpenEvidence(selected.selectedEvidence);
  assert.deepEqual(h.document().evidence, qualified);
  assert.equal(h.document().navigationRequest.pageNumber, 2);
  h.document().onReturn();
  assert.deepEqual(h.finding().selectedEvidence, qualified);
  h.finding().onSelectEvidence(h.finding().finding.evidence[2]);
  selected = h.finding();
  assert.deepEqual(selected.selectedEvidence, differentlyLabelled);
  selected.onOpenEvidence(selected.selectedEvidence);
  assert.deepEqual(h.document().evidence, differentlyLabelled);
  assert.equal(h.operations.every(operation => operation.type === "set_position"), true);
  assert.equal(h.operations.every(operation => !Object.hasOwn(operation.position, "index")), true);
  assert.equal(h.state.workspace.personal["run-1"].position.evidence_span_id, evidence.span_id);
});

test("direct Document tab clears earlier citation context while explicit source opening preserves its exact target", () => {
  const workspace = initial(); const { source, evidence } = passageFixture();
  workspace.runs[0].findings[0].evidence = [evidence];
  const h = workspaceInteractionHarness(workspace, source);
  h.tab("Findings"); h.finding().onSelectEvidence(h.finding().finding.evidence[0]);
  h.tab("Document");
  assert.equal(h.document().finding, null); assert.equal(h.document().evidence, null);
  assert.equal(h.document().navigationRequest, undefined);
  assert.equal(h.operations.at(-1).position.evidence_span_id, null);
  assert.equal(h.state.workspace.personal["run-1"].position.evidence_span_id, null);
  assert.equal(stateHelpers.libraryResumePosition(h.state.workspace).pageNumber, null);
  h.tab("Findings"); h.finding().onOpenEvidence(h.finding().finding.evidence[0]);
  assert.equal(h.document().finding.id, "finding-1"); assert.deepEqual(h.document().evidence, evidence);
  assert.equal(h.document().navigationRequest.pageNumber, evidence.page_number);
  assert.equal(h.operations.at(-1).position.evidence_span_id, evidence.span_id);
  assert.equal(stateHelpers.libraryResumePosition(h.state.workspace).pageNumber, evidence.page_number);
  h.tab("Document"); assert.equal(h.document().finding, null); assert.equal(h.document().evidence, null);
  assert.equal(h.operations.at(-1).position.evidence_span_id, null);
});

test("Ask source return restores the same finding conversation without a paid action or finding-anchor rewrite", () => {
  const workspace = initial(); const { source, evidence } = passageFixture();
  workspace.runs[0].findings.push({ ...clone(workspace.runs[0].findings[0]), id: "finding-2", title: "Second finding" });
  const h = workspaceInteractionHarness(workspace, source);
  h.tab("Findings");
  h.finding().onFinding("finding-2");
  h.finding().onShowAsk();
  assert.equal(h.finding().showAsk, true);
  const before = h.operations.length;
  h.finding().onAskEvidence("Exact saved answer", evidence);
  assert.equal(h.document().returnLabel, "Return to Ask");
  assert.equal(h.document().answerText, "Exact saved answer");
  assert.deepEqual(h.document().evidence, evidence);
  assert.equal(h.document().navigationRequest.pageNumber, evidence.page_number);
  assert.equal(h.operations.length, before); // Answer references are not finding resume anchors.
  h.document().onReturn();
  assert.equal(h.finding().finding.id, "finding-2");
  assert.equal(h.finding().run.id, "run-1");
  assert.equal(h.finding().showAsk, true);
  assert.equal(h.operations.every(operation => operation.type === "set_position"), true);
});

test("exact evidence choice does not leak into another finding or run, and fresh resume uses its stored span", () => {
  const workspace = initial();
  const { source, evidence } = passageFixture();
  workspace.runs[0].findings[0].evidence = [{ ...evidence, label: "First entry" }, { ...evidence, label: "Second entry" }];
  workspace.runs[0].findings.push({ ...clone(workspace.runs[0].findings[0]), id: "finding-2", title: "Another finding",
    evidence: [{ ...evidence, label: "Other finding entry" }] });
  const otherRun = { ...clone(workspace.runs[0]), id: "run-2" };
  otherRun.findings[0].evidence = [{ ...evidence, label: "Other run entry" }];
  workspace.runs.unshift(otherRun);
  workspace.personal["run-2"] = clone(stateHelpers.emptyPersonal());
  const h = workspaceInteractionHarness(workspace, source);
  h.tab("Findings");
  h.finding().onSelectEvidence(h.finding().finding.evidence[1]);
  h.finding().onFinding("finding-2");
  assert.equal(h.finding().selectedEvidence, null);
  assert.equal(h.finding().finding.evidence[0].label, "Other finding entry");
  h.selectRun("run-2");
  h.tab("Findings");
  assert.equal(h.finding().selectedEvidence, null);
  assert.equal(h.finding().finding.evidence[0].label, "Other run entry");

  const restored = initial();
  restored.runs[0].findings[0].evidence = clone(workspace.runs[1].findings[0].evidence);
  restored.personal["run-1"].position = { view: "findings", finding_id: "finding-1", evidence_span_id: evidence.span_id };
  const fresh = workspaceInteractionHarness(restored, source, {}, true);
  fresh.mount();
  assert.deepEqual(fresh.finding().selectedEvidence, restored.runs[0].findings[0].evidence[0]);
  assert.equal(fresh.finding().selectedEvidence.label, "First entry");
});

test("workspace render labels fixture and context mismatch; reopening defaults to overview with explicit resume", () => {
  const html = renderWorkspace("overview");
  assert.match(html, /Authored synthetic example, not an AI-generated review/);
  assert.match(html, /saved brief differs/);
  assert.doesNotMatch(html, /Continue from saved position/);
  assert.doesNotMatch(html, /Saved position: Findings/);
  assert.match(html, /not review completeness/);
  assert.doesNotMatch(html, /data-testid="review-setup"/);
});

test("only an unreviewed workspace opens the new setup, never an existing or failed run", () => {
  const workspace = initial();
  workspace.runs = [];
  workspace.personal = {};
  const html = renderWorkspace("overview", { workspace });
  assert.match(html, /data-testid="review-setup"/);
  assert.match(html, />Review setup<\/button>/);
  assert.doesNotMatch(html, /Pick up where you left off|Continue from saved position/);
  for (const status of ["ready", "incomplete", "processing", "failed", "interrupted"]) {
    const stored = initial();
    stored.runs[0].status = status;
    assert.doesNotMatch(renderWorkspace("overview", { workspace: stored }), /data-testid="review-setup"/);
  }
});

test("finding render keeps draft and saved question distinct and does not turn opened into reviewed", () => {
  const html = renderWorkspace("findings");
  assert.match(html, /A recovered draft/);
  assert.match(html, /Previously saved question/);
  assert.match(html, /<option value="not_marked" selected="">Not marked<\/option>/);
  assert.match(html, /Opened/);
  assert.match(html, /Send question to AI/);
  assert.match(html, /Preview answer sources alongside this conversation/);
  assert.match(html, /Nothing is sent until you choose Send/);
});

test("My review contains confirmed saved questions and direct marker controls, not draft wording", () => {
  const html = renderWorkspace("my_review");
  assert.match(html, /Previously saved question/);
  assert.doesNotMatch(html, /A recovered draft/);
  assert.match(html, /Revisit/);
  assert.match(html, /Reviewed by me/);
  assert.match(html, /Marker for Archive exit/);
});

test("My review source navigation selects the exact finding reference and returns to the takeaway", () => {
  const workspace = initial();
  const { source, evidence } = passageFixture();
  workspace.runs[0].findings.push({ ...clone(workspace.runs[0].findings[0]), id: "finding-2", title: "Second finding",
    evidence: [{ ...evidence, label: "Base" }, { ...evidence, label: "Qualifications" }] });
  const h = workspaceInteractionHarness(workspace, source);
  h.tab("My review");
  const selected = h.myReview().run.findings[1];
  h.myReview().onSource(selected.id, selected.evidence[1]);
  assert.equal(h.document().finding.id, "finding-2");
  assert.equal(h.document().evidence.label, "Qualifications");
  assert.equal(h.document().returnLabel, "Return to My review");
  assert.equal(h.operations.at(-1).position.finding_id, "finding-2");
  h.document().onReturn();
  assert.ok(h.myReview());
  assert.equal(h.operations.at(-1).position.view, "my_review");
});

test("Overview keeps normal rerun controls secondary and opens recovery controls when needed", () => {
  const h = workspaceInteractionHarness(initial());
  assert.equal(h.overview().controlsOpen, false);
  h.state.reviewAction = { status: "uncertain" };
  assert.equal(h.overview().controlsOpen, true);
  h.state.reviewAction = { status: "idle" };
  h.state.briefDraft = { ...brief, priorities: "Unconfirmed brief" };
  assert.equal(h.overview().controlsOpen, true);
  h.state.briefDraft = null;
  h.state.workspace.runs[0].status = "processing";
  assert.equal(h.overview().controlsOpen, true);
});

test("starting review confirms dirty brief and all draft timers before one paid request", async () => {
  const h = harness(); await h.controller.load();
  h.controller.setBriefDraft(customer);
  h.controller.setDraft("run-1", "finding-1", "Keep my wording");
  await h.controller.startReview("test-model", "attempt-1");
  assert.deepEqual(h.calls.map(call => call.operation?.type || "generate"), ["set_brief", "set_draft", "generate"]);
  assert.equal(h.calls[2].revision, 2);
  assert.equal(h.controller.getSnapshot().reviewAction.status, "idle");
  assert.deepEqual(h.server().runs.at(-1).context, customer);
  assert.equal(h.server().personal["run-1"].drafts["finding-1"], "Keep my wording");
  assert.deepEqual(h.server().personal["attempt-1"].drafts, {});
});

test("double click cannot reserve two paid attempts while saves or generation are in flight", async () => {
  const h = harness({ delayed: true }); await h.controller.load();
  h.controller.setBriefDraft(customer);
  const first = h.controller.startReview("test-model", "attempt-1");
  const duplicate = h.controller.startReview("test-model", "attempt-2");
  assert.equal(h.controller.getSnapshot().reviewAction.status, "preparing");
  assert.equal(h.calls.length, 1);
  h.calls[0].finish(); await first; await duplicate;
  assert.equal(h.calls.filter(call => call.generate).length, 1);
  assert.equal(h.calls.find(call => call.generate).requestId, "attempt-1");
});

test("failed or conflicted brief save blocks paid work and keeps the unsaved brief", async () => {
  for (const code of ["NETWORK_ERROR", "REVISION_CONFLICT"]) {
    const h = harness(); await h.controller.load();
    h.controller.setBriefDraft(customer);
    h.failNext(Object.assign(new Error("Not saved"), { code }));
    await h.controller.startReview("test-model", "attempt-1");
    assert.equal(h.calls.filter(call => call.generate).length, 0);
    assert.equal(h.controller.getSnapshot().reviewAction.status, "idle");
    assert.match(h.controller.getSnapshot().reviewAction.error, /not started/);
    assert.equal(h.controller.getSnapshot().briefDraft.priorities, customer.priorities);
  }
});

test("editing the brief while its save is pending does not send a stale perspective", async () => {
  const h = harness({ delayed: true }); await h.controller.load();
  h.controller.setBriefDraft(customer);
  const start = h.controller.startReview("test-model", "attempt-1");
  h.controller.setBriefDraft({ ...customer, perspective: "provider" });
  h.calls[0].finish(); await start;
  assert.equal(h.calls.filter(call => call.generate).length, 0);
  assert.equal(h.controller.getSnapshot().briefDraft.perspective, "provider");
});

test("provider response preserves edits made meanwhile and requires explicit application", async () => {
  const h = harness(); await h.controller.load();
  const generate = h.transport.generate;
  let finish;
  h.transport.generate = (...args) => new Promise(resolve => { finish = async () => resolve(await generate(...args)); });
  const start = h.controller.startReview("test-model", "attempt-1"); await settle();
  assert.equal(h.controller.getSnapshot().reviewAction.status, "generating");
  h.controller.setDraft("run-1", "finding-1", "Edited while generating"); h.timers();
  h.controller.setBriefDraft({ ...brief, priorities: "New local priorities" });
  assert.equal(h.calls.length, 0);
  finish(); await start;
  assert.equal(h.controller.getSnapshot().status, "review");
  assert.equal(h.controller.getSnapshot().localDrafts[h.state.draftKey("run-1", "finding-1")], "Edited while generating");
  assert.equal(h.controller.getSnapshot().briefDraft.priorities, "New local priorities");
  assert.equal(h.calls.length, 1);
  h.controller.retryPending(); await settle();
  assert.equal(h.server().personal["run-1"].drafts["finding-1"], "Edited while generating");
  assert.equal(h.server().runs.length, 2);
});

test("lost paid response never joins ordinary retry queue; GET recovers the same recorded run", async () => {
  const h = harness(); await h.controller.load();
  const generate = h.transport.generate;
  h.transport.generate = async (...args) => {
    await generate(...args);
    throw Object.assign(new Error("Response lost"), { code: "NETWORK_ERROR" });
  };
  await h.controller.startReview("test-model", "attempt-1");
  assert.equal(h.controller.getSnapshot().reviewAction.status, "uncertain");
  h.controller.retryPending(); await settle();
  await h.controller.startReview("test-model", "attempt-2");
  await h.controller.retryReviewRequest();
  assert.equal(h.calls.length, 1);
  await h.controller.reloadSaved();
  assert.equal(h.controller.getSnapshot().reviewAction.status, "idle");
  assert.equal(h.controller.getSnapshot().workspace.runs.at(-1).id, "attempt-1");
  assert.equal(h.calls.length, 1);
});

test("an unrecorded uncertain attempt requires read-only refresh and explicit same-id replay", async () => {
  const h = harness(); await h.controller.load();
  const generate = h.transport.generate;
  const attempts = [];
  let fail = true;
  h.transport.generate = async (...args) => {
    attempts.push(args);
    if (fail) { fail = false; throw new Error("Connection failed"); }
    return generate(...args);
  };
  await h.controller.startReview("original-model", "attempt-1", "xhigh");
  await h.controller.retryReviewRequest();
  assert.equal(attempts.length, 1);
  await h.controller.reloadSaved();
  assert.equal(h.controller.getSnapshot().reviewAction.canRetryRequest, true);
  h.controller.setBriefDraft(customer);
  h.controller.retryPending(); await settle();
  assert.equal(attempts.length, 1);
  await h.controller.retryReviewRequest();
  assert.deepEqual(attempts[1], attempts[0]);
  assert.equal(attempts[1].at(-1), "xhigh");
  assert.equal(h.controller.getSnapshot().briefDraft.perspective, "customer");
  assert.equal(h.server().runs.length, 2);
});

test("definitive preflight rejections permit a new attempt only after saved-state refresh", async () => {
  for (const code of ["REVISION_CONFLICT", "REVIEW_MODEL_CHANGED", "API_KEY_REQUIRED", "REVIEW_INPUT_REJECTED"]) {
    const h = harness(); await h.controller.load();
    h.transport.generate = async () => { throw Object.assign(new Error("Preflight rejected"), { code }); };
    await h.controller.startReview("test-model", "attempt-1");
    assert.equal(h.controller.getSnapshot().reviewAction.requestRejected, true);
    assert.equal(h.controller.getSnapshot().reviewAction.status, "uncertain");
    await h.controller.reloadSaved();
    assert.equal(h.controller.getSnapshot().reviewAction.status, "idle");
    assert.equal(h.controller.getSnapshot().reviewAction.canRetryRequest, false);
  }
});

test("unconfirmed final save never becomes a safe preflight failure", async () => {
  const h = harness(); await h.controller.load();
  h.transport.generate = async () => { throw Object.assign(new Error("Result save unconfirmed"), { code: "REVIEW_SAVE_UNCONFIRMED" }); };
  await h.controller.startReview("test-model", "attempt-1");
  await h.controller.reloadSaved();
  assert.equal(h.controller.getSnapshot().reviewAction.status, "uncertain");
  assert.equal(h.controller.getSnapshot().reviewAction.requestRejected, false);
});

test("reopening a processing run never generates, blocks a new attempt, and can be interrupted explicitly", async () => {
  const h = harness();
  const current = h.server(); current.runs[0].kind = "ai"; current.runs[0].status = "processing";
  await h.controller.load();
  await h.controller.startReview("test-model", "attempt-1");
  assert.equal(h.calls.length, 0);
  await h.controller.reloadSaved();
  assert.equal(h.calls.length, 0);
  await h.controller.interruptRun("run-1");
  assert.equal(h.calls[0].interrupt, true);
  assert.equal(h.controller.getSnapshot().workspace.runs[0].status, "interrupted");
});

test("recovered processing result keeps local drafts frozen for explicit compare and apply", async () => {
  const h = harness(); await h.controller.load();
  h.transport.generate = async (_doc, _revision, requestId) => {
    const server = h.server(); server.revision += 1;
    server.runs.push({ ...clone(server.runs[0]), id: requestId, kind: "ai", status: "processing" });
    throw new Error("Outcome unavailable");
  };
  await h.controller.startReview("test-model", "attempt-1");
  h.controller.setDraft("run-1", "finding-1", "Local after timeout");
  await h.controller.reloadSaved();
  assert.equal(h.controller.getSnapshot().status, "review");
  assert.equal(h.controller.getSnapshot().reviewAction.status, "idle");
  assert.equal(h.calls.length, 0);
  assert.equal(h.controller.getSnapshot().localDrafts[h.state.draftKey("run-1", "finding-1")], "Local after timeout");
});

test("run labels distinguish legacy fixtures and incomplete, failed, interrupted and processing AI runs", () => {
  assert.equal(stateHelpers.runLabel(initial().runs[0]), "Synthetic example — available");
  for (const status of ["incomplete", "failed", "interrupted", "processing"]) {
    assert.equal(stateHelpers.runLabel({ ...initial().runs[0], kind: "ai", status }), `AI review — ${status}`);
  }
});

test("empty-run Findings navigation cannot enqueue an invalid position; other views clear dangling evidence", () => {
  const run = { ...initial().runs[0], findings: [] };
  assert.equal(stateHelpers.safeReviewPosition(run, "findings", null, null), null);
  assert.equal(stateHelpers.safeReviewPosition(run, "findings", "old-finding", "old-span"), null);
  assert.deepEqual(clone(stateHelpers.safeReviewPosition(run, "document", "old-finding", "old-span")), {
    view: "document", finding_id: null, evidence_span_id: null,
  });
});

test("new-run positions never reuse an evidence span from an unrelated finding", () => {
  const run = initial().runs[0];
  run.findings[0].evidence = [{ span_id: "current-span" }];
  assert.deepEqual(clone(stateHelpers.safeReviewPosition(run, "findings", "finding-1", "old-span")), {
    view: "findings", finding_id: "finding-1", evidence_span_id: null,
  });
  assert.equal(stateHelpers.safeReviewPosition(run, "document", "finding-1", "current-span").evidence_span_id, "current-span");
});

test("AI overview render exposes incomplete status, provenance, coverage and retained old run selection", () => {
  const workspace = initial();
  workspace.runs.push({ ...clone(workspace.runs[0]), id: "run-2", kind: "ai", status: "incomplete", context: brief,
    overview_items: [{ text: "Source-backed overview", evidence: [] }],
    coverage: { page_count: 3, extracted_pages: [1, 3], omitted_pages: [2], input_scope: "all_extracted_text", limitations: ["Page 2 has no extractable text."] },
    generation: { model_id: "test-model", endpoint: "chat.completions", reasoning_effort: "low", prompt_version: "review-v1", schema_version: "review-v1", extraction_version: "extract-v1", estimated_input_tokens: 1000, max_completion_tokens: 2000, usage: null, duration_ms: 2000 },
  });
  const html = renderWorkspace("overview", { workspace });
  assert.match(html, /AI review — incomplete/);
  assert.match(html, /This review is incomplete/);
  assert.match(html, /Source-backed overview/);
  assert.match(html, /Pages omitted from this review: 2/);
  assert.match(html, /Synthetic example — available/);
  assert.match(html, /Prompt: review-v1/);
  assert.match(html, /usage unavailable; this does not mean no charge/);
  assert.doesNotMatch(html, /Example agreement overview/);
});

test("not-found findings expose reviewed scope and do not imply absence from missing materials", () => {
  const workspace = initial(); workspace.runs[0].kind = "ai";
  workspace.runs[0].findings[0].basis = "not_found";
  workspace.runs[0].findings[0].coverage_basis = "Pages 1 and 3 only";
  const html = renderWorkspace("findings", { workspace });
  assert.match(html, /Not found within the reviewed scope/);
  assert.match(html, /Pages 1 and 3 only/);
  assert.match(html, /not proof of absence/);
  assert.match(html, /AI-suggested wording/);
});

test("uncertain request controls expose read-only recovery and charge warning, not generic paid auto-retry", () => {
  const state = { workspace: initial(), status: "saved", pending: 0, briefDraft: null,
    reviewAction: { status: "uncertain", error: "Outcome unknown", canRetryRequest: false } };
  const html = renderToStaticMarkup(React.createElement(generationControls.ReviewGenerationControls, { state, controller: {}, sourceReady: true, onSettings() {} }));
  assert.match(html, /Check saved review state/);
  assert.match(html, /charges may apply/);
  assert.doesNotMatch(html, /Retry this request with the same ID/);
  assert.match(html, /API charges apply/);
  assert.match(html, /test-model/);
});

function askTurn(overrides = {}) {
  return { id: "ask-1", run_id: "run-1", finding_id: "finding-1", source_revision_id: "source-1",
    question: "Does another clause qualify this?", created_at: "2026-01-01", completed_at: "2026-01-01",
    status: "ready", answer: [{ text: "A conditional extension may apply.", evidence: [] }], limitations: [], failure: null,
    history_turn_ids: [], include_history: true, history_truncated: false,
    generation: { model_id: "test-model", endpoint: "chat.completions", reasoning_effort: "medium", prompt_version: "ask-v1",
      schema_version: "ask-v1", extraction_version: "extract-v1", estimated_input_tokens: 1000, max_completion_tokens: 2000,
      usage: null, duration_ms: 2000 },
    coverage: { page_count: 3, extracted_pages: [1, 3], omitted_pages: [2], input_scope: "all_extracted_text", limitations: ["Page 2 has no extractable text."] },
    ...overrides };
}

test("Ask drafts debounce independently from kept-question drafts and never run AI", async () => {
  const h = harness(); await h.controller.load();
  h.controller.setDraft("run-1", "finding-1", "Keep this question");
  h.controller.setAskDraft("run-1", "finding-1", "First AI question");
  h.controller.setAskDraft("run-1", "finding-1", "Latest AI question");
  assert.equal(h.controller.getSnapshot().pending, 2);
  h.timers(); await settle();
  assert.deepEqual(h.calls.map(call => call.operation.type), ["set_draft", "set_ask_draft"]);
  assert.equal(h.server().personal["run-1"].drafts["finding-1"], "Keep this question");
  assert.equal(h.server().personal["run-1"].ask_drafts["finding-1"], "Latest AI question");
  assert.equal(h.controller.getSnapshot().pending, 0);
  assert.deepEqual(h.server().personal["run-1"].saved_questions, {});
  assert.equal(h.calls.filter(call => call.ask || call.generate).length, 0);
});

test("Ask confirms draft saves, retains question and original context without saving the dirty brief", async () => {
  const h = harness(); await h.controller.load();
  h.controller.setBriefDraft({ ...brief, perspective: "provider", priorities: "Unsent changed brief" });
  h.controller.setAskDraft("run-1", "finding-1", "What qualifies it?");
  await h.controller.startAsk("run-1", "finding-1", "What qualifies it?", "selected-model", "ask-1", false);
  assert.deepEqual(h.calls.map(call => call.operation?.type || "ask"), ["set_ask_draft", "ask"]);
  assert.equal(h.calls[1].revision, 1);
  assert.equal(h.calls[1].includeHistory, false);
  assert.equal(h.calls[1].modelId, "selected-model");
  assert.equal(h.controller.getSnapshot().askAction.status, "idle");
  assert.deepEqual(h.server().runs[0].context, customer);
  assert.deepEqual(h.server().brief, brief);
  assert.equal(h.controller.getSnapshot().briefDraft.priorities, "Unsent changed brief");
  assert.equal(h.server().personal["run-1"].ask_drafts["finding-1"], "What qualifies it?");
});

test("failed saves and edits during Ask preparation prevent dispatch and preserve drafts", async () => {
  const h = harness({ delayed: true }); await h.controller.load();
  h.controller.setAskDraft("run-1", "finding-1", "Original question");
  const attempt = h.controller.startAsk("run-1", "finding-1", "Original question", "model", "ask-1");
  h.controller.setAskDraft("run-1", "finding-1", "Newer question");
  h.calls[0].finish(); h.timers(); await settle();
  h.calls[1].finish(); await attempt;
  assert.equal(h.calls.some(call => call.ask), false);
  assert.match(h.controller.getSnapshot().askAction.error, /not sent/);
  assert.equal(h.server().personal["run-1"].ask_drafts["finding-1"], "Newer question");
  for (const code of ["NETWORK_ERROR", "REVISION_CONFLICT"]) {
    const failed = harness(); await failed.controller.load();
    failed.failNext(Object.assign(new Error("Save failed"), { code }));
    failed.controller.setAskDraft("run-1", "finding-1", "Retain me");
    await failed.controller.startAsk("run-1", "finding-1", "Retain me", "model", "ask-1");
    assert.equal(failed.calls.some(call => call.ask), false);
    assert.equal(failed.controller.getSnapshot().localAskDrafts[failed.state.draftKey("run-1", "finding-1")], "Retain me");
  }
});

test("Ask and review generation mutually exclude paid work, including double clicks", async () => {
  const h = harness({ delayed: true }); await h.controller.load();
  h.controller.setAskDraft("run-1", "finding-1", "Question");
  const first = h.controller.startAsk("run-1", "finding-1", "Question", "model", "ask-1");
  await h.controller.startAsk("run-1", "finding-1", "Question", "model", "ask-2");
  await h.controller.startReview("model", "review-1");
  assert.equal(h.state.hasUnconfirmedChanges(h.controller.getSnapshot()), true);
  h.calls[0].finish(); await first;
  assert.equal(h.calls.filter(call => call.ask).length, 1);
  assert.equal(h.calls.filter(call => call.generate).length, 0);

  const g = harness({ delayed: true }); await g.controller.load();
  g.controller.setBriefDraft(customer);
  const review = g.controller.startReview("model", "review-1");
  await g.controller.startAsk("run-1", "finding-1", "Question", "model", "ask-1");
  g.calls[0].finish(); await review;
  assert.equal(g.calls.filter(call => call.ask).length, 0);
});

test("Ask result cannot erase edits made during the request or automatically apply them", async () => {
  const h = harness(); await h.controller.load();
  const ask = h.transport.ask;
  let finish;
  h.transport.ask = (...args) => new Promise(resolve => { finish = async () => resolve(await ask(...args)); });
  h.controller.setAskDraft("run-1", "finding-1", "Sent question");
  const pending = h.controller.startAsk("run-1", "finding-1", "Sent question", "model", "ask-1");
  await settle();
  h.controller.setAskDraft("run-1", "finding-1", "Next question drafted meanwhile"); h.timers();
  h.controller.setDraft("run-1", "finding-1", "Keep separate wording"); h.timers();
  finish(); await pending;
  assert.equal(h.controller.getSnapshot().status, "review");
  assert.equal(h.server().personal["run-1"].ask_drafts["finding-1"], "Sent question");
  assert.equal(h.controller.getSnapshot().localAskDrafts[h.state.draftKey("run-1", "finding-1")], "Next question drafted meanwhile");
  h.controller.retryPending(); await settle();
  assert.equal(h.server().personal["run-1"].ask_drafts["finding-1"], "Next question drafted meanwhile");
  assert.equal(h.server().personal["run-1"].drafts["finding-1"], "Keep separate wording");
  assert.equal(h.calls.filter(call => call.ask).length, 1);
});

test("lost Ask response recovers through GET without another paid call or lost draft", async () => {
  const h = harness(); await h.controller.load();
  const ask = h.transport.ask;
  h.transport.ask = async (...args) => { await ask(...args); throw new Error("Response lost"); };
  h.controller.setAskDraft("run-1", "finding-1", "Keep question");
  await h.controller.startAsk("run-1", "finding-1", "Keep question", "model", "ask-1");
  assert.equal(h.controller.getSnapshot().askAction.status, "uncertain");
  h.controller.retryPending(); await h.controller.retryAskRequest();
  await h.controller.startReview("model", "review-1");
  await h.controller.startAsk("run-1", "finding-1", "Keep question", "model", "ask-2");
  assert.equal(h.calls.filter(call => call.ask).length, 1);
  await h.controller.reloadSaved();
  assert.equal(h.controller.getSnapshot().askAction.status, "idle");
  assert.equal(h.controller.getSnapshot().workspace.ask_turns[0].id, "ask-1");
  assert.equal(h.calls.filter(call => call.ask).length, 1);
});

test("unrecorded uncertain Ask requires explicit same-ID replay with the immutable question snapshot", async () => {
  const h = harness(); await h.controller.load();
  const ask = h.transport.ask; const calls = []; let fail = true;
  h.transport.ask = async (...args) => { calls.push(args); if (fail) { fail = false; throw new Error("Network uncertain"); } return ask(...args); };
  await h.controller.startAsk("run-1", "finding-1", "Original question", "original-model", "ask-1", false, "max");
  await h.controller.retryAskRequest(); assert.equal(calls.length, 1);
  await h.controller.reloadSaved();
  assert.equal(h.controller.getSnapshot().askAction.canRetryRequest, true);
  h.controller.setAskDraft("run-1", "finding-1", "New local question");
  h.controller.retryPending(); await settle();
  assert.equal(calls.length, 1);
  await h.controller.retryAskRequest();
  assert.deepEqual(calls[0], calls[1]);
  assert.equal(calls[1].at(-1), "max");
  assert.equal(h.controller.getSnapshot().status, "review");
  assert.equal(h.controller.getSnapshot().localAskDrafts[h.state.draftKey("run-1", "finding-1")], "New local question");
});

test("Ask preflight errors resolve only after refresh, but unconfirmed saves remain uncertain", async () => {
  for (const code of ["ASK_INPUT_REJECTED", "ASK_ALREADY_PROCESSING", "ASK_REVIEW_UNAVAILABLE", "ASK_STORAGE_LIMIT", "ASK_TURN_LIMIT", "INVALID_QUESTION", "REVIEW_MODEL_CHANGED", "REVIEW_REASONING_CHANGED"]) {
    const h = harness(); await h.controller.load();
    h.transport.ask = async () => { throw Object.assign(new Error("Rejected"), { code }); };
    await h.controller.startAsk("run-1", "finding-1", "Question", "model", "ask-1");
    assert.equal(h.controller.getSnapshot().askAction.requestRejected, true, code);
    await h.controller.reloadSaved();
    assert.equal(h.controller.getSnapshot().askAction.status, "idle", code);
  }
  const h = harness(); await h.controller.load();
  h.transport.ask = async () => { throw Object.assign(new Error("Save unknown"), { code: "ASK_SAVE_UNCONFIRMED" }); };
  await h.controller.startAsk("run-1", "finding-1", "Question", "model", "ask-1");
  await h.controller.reloadSaved();
  assert.equal(h.controller.getSnapshot().askAction.status, "uncertain");
  assert.equal(h.controller.getSnapshot().askAction.requestRejected, false);
});

test("reopening a processing Ask is read-only, blocks paid work, warns on leave and allows explicit interrupt", async () => {
  const h = harness(); h.server().ask_turns = [askTurn({ status: "processing", answer: [], completed_at: null })];
  await h.controller.load(); await h.controller.reloadSaved();
  assert.equal(h.state.hasUnconfirmedChanges(h.controller.getSnapshot()), true);
  await h.controller.startAsk("run-1", "finding-1", "Another question", "model", "ask-2");
  await h.controller.startReview("model", "review-1");
  assert.equal(h.calls.length, 0);
  await h.controller.interruptAsk("ask-1");
  assert.equal(h.calls[0].interruptAsk, true);
  assert.equal(h.controller.getSnapshot().workspace.ask_turns[0].status, "interrupted");
  assert.equal(h.state.hasUnconfirmedChanges(h.controller.getSnapshot()), false);
});

test("Ask draft conflict recovery keeps both local and saved wording for deliberate comparison", async () => {
  const h = harness(); await h.controller.load();
  h.setServer(apply(h.server(), { type: "set_ask_draft", run_id: "run-1", finding_id: "finding-1", text: "Other tab Ask" }));
  h.controller.setAskDraft("run-1", "finding-1", "My Ask draft"); h.timers(); await settle();
  assert.equal(h.controller.getSnapshot().status, "conflict");
  await h.controller.reloadSaved();
  assert.equal(h.controller.getSnapshot().status, "review");
  assert.equal(h.controller.getSnapshot().workspace.personal["run-1"].ask_drafts["finding-1"], "Other tab Ask");
  assert.equal(h.controller.getSnapshot().localAskDrafts[h.state.draftKey("run-1", "finding-1")], "My Ask draft");
  h.controller.retryPending(); await settle();
  assert.equal(h.server().personal["run-1"].ask_drafts["finding-1"], "My Ask draft");
  assert.equal(h.calls.some(call => call.ask), false);
});

test("Ask API uses encoded finding and run identity, revision and explicit history choice", async () => {
  const calls = [];
  const api = { async post(path, body, options) { calls.push({ path, body, options }); return { success: true, data: initial() }; } };
  const { reviewWorkspaceApi } = loadModule("../src/lib/reviewWorkspaceApi.ts", { "@/lib/api": { default: api, __esModule: true } });
  await reviewWorkspaceApi.ask("doc/a", 12, "request-1", "model", "run/b", "finding/c", "Question?", false, "high");
  await reviewWorkspaceApi.interruptAsk("doc/a", 13, "ask/d");
  assert.equal(calls[0].path, "/documents/doc%2Fa/review-workspace/runs/run%2Fb/findings/finding%2Fc/ask");
  assert.deepEqual(clone(calls[0].body), { expected_revision: 12, request_id: "request-1", model_id: "model", question: "Question?", include_history: false, reasoning_effort: "high" });
  assert.equal(calls[0].options.timeout, 210000);
  assert.equal(calls[1].path, "/documents/doc%2Fa/review-workspace/ask/ask%2Fd/interrupt");
  assert.equal(calls[1].body.expected_revision, 13);
});

test("finding Ask render isolates conversation, saved-question wording, drafts and original perspective", () => {
  const workspace = initial();
  workspace.personal["run-1"].ask_drafts = { "finding-1": "Recovered Ask draft" };
  workspace.ask_turns = [askTurn(), askTurn({ id: "ask-other", finding_id: "another-finding", question: "Other finding question" })];
  const html = renderWorkspace("findings", { workspace });
  assert.match(html, /Recovered Ask draft/);
  assert.match(html, /Does another clause qualify this/);
  assert.doesNotMatch(html, /Other finding question/);
  assert.match(html, /Example Customer/);
  assert.match(html, /real paid AI answer/);
  assert.match(html, /Separate Ask draft/);
  assert.match(html, /last 6 usable/);
  assert.match(html, /Model: test-model · reasoning: medium/);
  assert.match(html, /Omitted pages: 2/);
  assert.match(html, /not correctness, completeness or legal verification/);
});

test("Ask evidence uses the source adapter for passages outside the original finding's citations", () => {
  const { source, evidence } = passageFixture();
  const turn = askTurn({ answer: [{ text: "Another passage qualifies this finding.", evidence: [evidence] }] });
  let opened;
  const element = askControls.AskTurn({ turn, source, onEvidence(text, item) { opened = { text, item }; },
    onRefresh() {}, onInterrupt() {}, controlsDisabled: false });
  const html = renderToStaticMarkup(element);
  assert.match(html, /Passage matched to source/);
  assert.match(html, /Preview excerpt · page 2/);
  function findEvidence(node) {
    if (!React.isValidElement(node)) return;
    if (node.type === evidenceControls.EvidenceList) node.props.onOpen(evidence);
    React.Children.forEach(node.props.children, findEvidence);
  }
  findEvidence(element);
  assert.equal(opened.item, evidence);
  assert.equal(opened.text, turn.answer[0].text);
  assert.equal(stateHelpers.safeReviewPosition(initial().runs[0], "document", "finding-1", evidence.span_id).evidence_span_id, null);
  const sourceHtml = renderToStaticMarkup(React.createElement(documentControls.DocumentWorkspace, {
    documentId: "doc-1", filename: "synthetic.pdf", source, finding: initial().runs[0].findings[0], evidence,
    answerText: opened.text, navigationRequest: { requestId: 1, pageNumber: 2 }, onReturn() {},
  }));
  assert.match(sourceHtml, /Ask answer/);
  assert.match(sourceHtml, /Another passage qualifies this finding/);
  assert.match(sourceHtml, /Return to this finding/);
});

test("incomplete, failed and uncertain Ask UI exposes limitations and recovery without false verification", () => {
  const workspace = initial(); workspace.ask_turns = [askTurn({ status: "incomplete", limitations: ["Missing extracted schedule"] }),
    askTurn({ id: "ask-2", status: "failed", answer: [], failure: { code: "ASK_GENERATION_FAILED", message: "No usable response." } })];
  const html = renderWorkspace("findings", { workspace, askAction: { status: "uncertain", runId: "run-1", findingId: "finding-1", error: "Unknown outcome", canRetryRequest: false } });
  assert.match(html, /This answer is incomplete/);
  assert.match(html, /Missing extracted schedule/);
  assert.match(html, /No usable answer was completed/);
  assert.match(html, /Check saved Ask state/);
  assert.match(html, /charges may apply/);
  assert.doesNotMatch(html, /Resend same Ask request/);
  assert.doesNotMatch(html, /Answer verified/);
});

test("history availability respects the successful fresh-question boundary and six-turn cap", () => {
  const turns = Array.from({ length: 8 }, (_, index) => askTurn({ id: `ask-${index}` }));
  assert.deepEqual(clone(stateHelpers.askHistorySummary(turns, "run-1", "finding-1")), { count: 6, truncated: true });
  turns.push(askTurn({ id: "fresh", include_history: false }));
  turns.push(askTurn({ id: "followup", status: "incomplete" }));
  turns.push(askTurn({ id: "failed-fresh", status: "failed", answer: [], include_history: false }));
  turns.push(askTurn({ id: "other-finding", finding_id: "other", include_history: false }));
  turns.push(askTurn({ id: "other-run", run_id: "other", include_history: false }));
  assert.deepEqual(clone(stateHelpers.askHistorySummary(turns, "run-1", "finding-1")), { count: 2, truncated: false });
  const workspace = initial(); workspace.ask_turns = turns;
  const html = renderWorkspace("findings", { workspace });
  assert.match(html, /since the latest successful fresh question/);
  assert.match(html, /2 currently available/);
  assert.doesNotMatch(html, /Older turns stay visible but are omitted from this request/);
});

test("copying a review question is deliberate and replacing a different Ask draft requires confirmation", () => {
  const slots = []; let cursor = 0;
  const calls = [];
  const workspace = initial();
  workspace.personal["run-1"].ask_drafts = { "finding-1": "Different unsent question" };
  const ModalProbe = () => null;
  const module = loadModule("../src/components/workspace/FindingAsk.tsx", {
    react: { ...React, useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial;
      return [slots[i], next => { slots[i] = next; }]; } },
    "./workspaceState": stateHelpers, "./WorkspaceControls": controls, "./EvidenceSourcePane": evidenceControls,
    "./askAnswerPresentation": askAnswerPresentation,
    "@/components/ui/Modal": ModalProbe,
    "@/context/WorkspaceContext": { useWorkspace: () => ({ settings: { has_api_key: true, model_id: "test-model" }, isLoading: false, error: null, refresh() {} }) },
  });
  const props = { run: workspace.runs[0], finding: workspace.runs[0].findings[0], reviewQuestion: "Current review wording",
    state: { workspace, status: "saved", pending: 0, localAskDrafts: {}, reviewAction: { status: "idle" }, askAction: { status: "idle" } },
    controller: { setAskDraft(...args) { calls.push(args); }, startAsk() { assert.fail("Copying must never send"); } }, source: null, sourceReady: true, onEvidence() {}, onSettings() {} };
  function all(node) { if (!React.isValidElement(node)) return []; return [node, ...React.Children.toArray(node.props.children).flatMap(all)]; }
  const tree = () => { cursor = 0; return module.FindingAsk(props); };
  const copy = () => all(tree()).find(node => node.type === controls.Action && node.props.children === "Use review question").props.onClick();
  const dialog = () => all(tree()).find(node => node.type === ModalProbe && node.props.title === "Replace the Ask draft?");
  assert.equal(calls.length, 0); copy(); assert.equal(calls.length, 0); assert.equal(dialog().props.isOpen, true);
  dialog().props.onClose(); assert.equal(dialog().props.isOpen, false); assert.equal(calls.length, 0);
  copy();
  all(dialog().props.footer).find(node => node.props.children === "Replace Ask draft").props.onClick();
  assert.deepEqual(calls, [["run-1", "finding-1", "Current review wording"]]);
  assert.equal(workspace.personal["run-1"].ask_drafts["finding-1"], "Different unsent question", "confirmed persistence is controller-owned");
  workspace.personal["run-1"].ask_drafts["finding-1"] = "";
  copy(); assert.equal(calls.length, 2); assert.equal(dialog().props.isOpen, false);
});

test("Ask component only sends on explicit action, with Settings model and the selected history choice", () => {
  for (const includeHistory of [true, false]) {
    const calls = [];
    const workspace = initial(); workspace.personal["run-1"].ask_drafts = { "finding-1": "Persisted question" };
    const module = loadModule("../src/components/workspace/FindingAsk.tsx", {
      react: { ...React, useState: initial => [typeof initial === "boolean" ? includeHistory : initial, () => {}] },
      "./workspaceState": stateHelpers, "./WorkspaceControls": controls, "./EvidenceSourcePane": evidenceControls,
      "./askAnswerPresentation": askAnswerPresentation,
      "@/components/ui/Modal": () => null,
      "@/context/WorkspaceContext": { useWorkspace: () => ({ settings: { has_api_key: true, model_id: "selected-in-settings", reasoning_effort: "max" }, isLoading: false, error: null, refresh() {} }) },
    }, { crypto: { randomUUID: () => "unique-request" } });
    const controller = { setAskDraft(...args) { calls.push(["draft", ...args]); }, flushDrafts() { calls.push(["flush"]); },
      startAsk(...args) { calls.push(["send", ...args]); } };
    const element = module.FindingAsk({ run: workspace.runs[0], finding: workspace.runs[0].findings[0],
      state: { workspace, status: "saved", pending: 0, localAskDrafts: {}, reviewAction: { status: "idle" }, askAction: { status: "idle" } },
      controller, source: null, sourceReady: true, onEvidence() {}, onSettings() {} });
    const html = renderToStaticMarkup(element);
    assert.equal(calls.length, 0);
    if (!includeHistory) assert.match(html, /Fresh question: no earlier Ask turns/);
    let textarea, send;
    function visit(node) {
      if (!React.isValidElement(node)) return;
      if (node.type === "textarea") textarea = node;
      if (node.type === controls.Action && node.props["aria-label"] === "Send question to AI") send = node;
      React.Children.forEach(node.props.children, visit);
    }
    visit(element);
    textarea.props.onChange({ target: { value: "Updated draft" } }); textarea.props.onBlur();
    assert.deepEqual(calls.map(item => item[0]), ["draft", "flush"]);
    assert.equal(send.props.disabled, false);
    send.props.onClick();
    assert.deepEqual(calls[2], ["send", "run-1", "finding-1", "Persisted question", "selected-in-settings", "unique-request", includeHistory, "max"]);
  }
});

test("Ask disposal cancels draft timers and prevents a preparing request from dispatching", async () => {
  const h = harness({ delayed: true }); await h.controller.load();
  h.controller.setAskDraft("run-1", "finding-1", "Before close");
  const pending = h.controller.startAsk("run-1", "finding-1", "Before close", "model", "ask-1");
  h.controller.dispose(); h.calls[0].finish(); await pending;
  assert.equal(h.calls.some(call => call.ask), false);
  const g = harness(); await g.controller.load();
  g.controller.setAskDraft("run-1", "finding-1", "Unsent");
  g.controller.dispose(); g.timers(); await settle();
  assert.equal(g.calls.length, 0);
});
