import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { appHeaderHarness } from "./appHeaderHarness.mjs";

function loadModule(path, imports = {}) {
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, React, Error, require(name) {
    assert.ok(name in imports, `Unexpected dependency: ${name}`);
    return imports[name];
  } });
  return exports;
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
const render = element => renderToStaticMarkup(element);

test("home redirects to Library without mounting upload or dispatching AI", () => {
  const destinations = [];
  const Home = loadModule("../src/app/page.tsx", { "next/navigation": { redirect: value => destinations.push(value) } }).default;
  Home();
  assert.deepEqual(destinations, ["/documents"]);
});

test("shared navigation marks Settings and excludes retired entry points", () => {
  const { AppHeader } = appHeaderHarness();
  const html = render(React.createElement(AppHeader, { current: "settings" }));
  assert.match(html, /href="\/settings"[^>]*aria-current="page"/);
  assert.match(html, /Switch to Graphite theme/);
  const [primary, secondary] = html.split("<details");
  assert.doesNotMatch(primary, /legacy-analysis|Analytics|About ClauseIQ/);
  assert.match(secondary, /href="\/about"/);
  assert.doesNotMatch(html, /legacy-analysis|\/analytics/);
  assert.doesNotMatch(html, /href="\/"/);
});

test("More closes on ordinary link navigation without intercepting modified links", () => {
  const { AppHeader } = appHeaderHarness();
  const link = node(AppHeader({}), item => item.props.href === "/about");
  const menu = { open: true };
  const event = { button: 0, currentTarget: { closest: () => menu }, preventDefault() { assert.fail("Unguarded navigation remains native"); } };
  link.props.onClick(event);
  assert.equal(menu.open, false);
  for (const override of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }, { button: 2 }]) {
    menu.open = true;
    link.props.onClick({ ...event, ...override });
    assert.equal(menu.open, true);
  }
});

test("More closes before guarded destination callbacks without bypassing the guard", () => {
  const { AppHeader } = appHeaderHarness();
  const menu = { open: true }, calls = [];
  const onNavigate = destination => { assert.equal(menu.open, false); calls.push(destination); };
  const tree = AppHeader({ guarded: true, onNavigate });
  const button = node(tree, item => item.type === "button" && item.props.children === "About ClauseIQ");
  button.props.onClick({ currentTarget: { closest: () => menu } });
  assert.deepEqual(calls, ["/about"]);
  menu.open = true;
  let prevented = false;
  const link = node(AppHeader({ onNavigate }), item => item.props.href === "/about");
  link.props.onClick({ button: 0, currentTarget: { closest: () => menu }, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.deepEqual(calls, ["/about", "/about"]);
});

test("Escape closes an open More menu and returns focus to its summary", () => {
  const { AppHeader } = appHeaderHarness();
  const details = node(AppHeader({}), item => item.type === "details");
  let focused = 0, prevented = 0;
  const target = { open: true, querySelector: selector => {
    assert.equal(selector, "summary"); return { focus: () => focused++ };
  } };
  const event = { key: "Escape", currentTarget: target, preventDefault: () => prevented++ };
  details.props.onKeyDown({ ...event, key: "Enter" });
  assert.equal(target.open, true);
  details.props.onKeyDown(event);
  assert.equal(target.open, false);
  assert.equal(focused, 1);
  assert.equal(prevented, 1);
  details.props.onKeyDown(event);
  assert.equal(focused, 1);
});

test("retired analytics bookmarks redirect to Library without loading dashboard data", () => {
  const destinations = [];
  const Analytics = loadModule("../src/app/analytics/page.tsx", {
    "next/navigation": { redirect: destination => destinations.push(destination) },
  }).default;
  Analytics();
  assert.deepEqual(destinations, ["/documents"]);
});

const modelSelection = loadModule("../src/lib/modelSelection.ts");
const model = (id, legacy = false) => ({ id, name: id, description: "Synthetic model catalog entry", legacy,
  reasoning_efforts: ["none", "low", "medium", "high", "xhigh", "max"], default_reasoning_effort: "medium",
  input_price_per_million: 1, output_price_per_million: 2, pricing_verified_on: "test reference", pricing_note: "" });
const defaultSettings = { has_api_key: true, model_id: "review-model", query_gate_model_id: "saved-legacy",
  reasoning_effort: "medium",
  available_models: [model("review-model"), model("other-model"), model("saved-legacy", true)],
  retention_days: 0, toast_notifications_enabled: true };

function settingsHarness(overrides = {}) {
  const slots = [], effects = [], calls = [], focus = [], mountedRefs = [];
  let index = 0;
  const hooks = { ...React,
    useState(initial) {
      const current = index++;
      if (!(current in slots)) slots[current] = initial;
      return [slots[current], value => { slots[current] = typeof value === "function" ? value(slots[current]) : value; }];
    },
    useRef(initial) {
      const current = index++;
      if (!(current in slots)) slots[current] = { current: initial };
      return slots[current];
    },
    useEffect(effect, dependencies) {
      const current = index++;
      if (!(current in slots) || dependencies.some((value, position) => !Object.is(value, slots[current][position]))) {
        slots[current] = dependencies;
        effects.push(effect);
      }
    },
  };
  const context = { settings: defaultSettings, isLoading: false, error: null,
    refresh: async () => calls.push(["refresh"]),
    updateSettings: async update => { calls.push(["settings", JSON.parse(JSON.stringify(update))]); context.settings = { ...context.settings, ...update }; },
    saveApiKey: async key => calls.push(["key", key]),
    removeApiKey: async () => calls.push(["remove"]), ...overrides };
  const Button = ({ children, loading: _loading, variant: _variant, ...props }) => React.createElement("button", props, children);
  const Modal = () => null;
  const Settings = loadModule("../src/app/settings/page.tsx", {
    react: hooks, "@/context/WorkspaceContext": { useWorkspace: () => context },
    "@/lib/modelSelection": modelSelection, "@/components/Button": Button,
    "@/components/Card": ({ children, ...props }) => React.createElement("div", props, children),
    "@/components/ui/ConfirmModal": Modal, "./Settings.module.css": {},
  }).default;
  const view = () => { index = 0; return Settings(); };
  const commit = () => {
    const tree = view();
    mountedRefs.splice(0).forEach(ref => { ref.current = null; });
    for (const item of nodes(tree)) {
      const ref = item.props.ref;
      if (!ref || typeof ref !== "object") continue;
      mountedRefs.push(ref);
      ref.current = item.type === "input" ? { focus: () => focus.push("key-input") } : {
        querySelector(selector) {
          assert.equal(selector, "[data-key-change]");
          return nodes(tree).some(candidate => candidate.props["data-key-change"])
            ? { focus: () => focus.push("change-key") } : null;
        },
      };
    }
    effects.splice(0).forEach(effect => effect());
  };
  view(); effects.splice(0).forEach(effect => effect());
  return { view, calls, context, focus, commit,
    html: () => render(view()),
    change: (id, value) => node(view(), item => item.props.id === id).props.onChange({ target: { value } }),
    toggle: number => { const input = nodes(view()).filter(item => item.type === "input" && item.props.type === "checkbox")[number]; input.props.onChange({ target: { checked: !input.props.checked } }); },
    submit: (label = "Workspace preferences") => node(view(), item => item.type === "form" && item.props["aria-label"] === label).props.onSubmit({ preventDefault() {} }),
    modal: title => node(view(), item => item.type === Modal && item.props.title === title),
    click: label => node(view(), item => item.type === Button && item.props.children === label).props.onClick(),
    button: label => node(view(), item => item.type === Button && item.props.children === label),
  };
}

test("Settings groups render locally with no secret value, model changes or nested main", () => {
  const h = settingsHarness();
  const html = h.html();
  for (const label of ["OpenAI API key", "AI models", "Document library", "Notifications", "Key saved"])
    assert.ok(html.includes(label), label);
  assert.doesNotMatch(html, /id="openai-key"|Replacement API key|Key verified|Connected/);
  assert.match(html, /saved legacy model/);
  assert.doesNotMatch(html, /<main|type="text"[^>]*id="openai-key"/);
  assert.deepEqual(h.calls, []);
});

test("Settings key status sits with its heading while mutation controls stay separate", () => {
  const h = settingsHarness();
  const titleRow = node(h.view(), item => item.type === "div"
    && React.Children.toArray(item.props.children).some(child => child.props?.id === "ai-access-title"));
  assert.match(render(titleRow), /OpenAI API key.*Key saved/);
  assert.doesNotMatch(render(titleRow), /Change key|Remove key/);
  h.click("Change key");
  assert.equal(node(h.view(), item => item.props.id === "openai-key").props["aria-describedby"], "key-usage");
  assert.match(render(node(h.view(), item => item.props.id === "key-usage")), /send document text to OpenAI.*incur charges/);
  assert.deepEqual(h.calls, []);
});

test("Settings model reference pricing stays secondary with separately labelled token rates", () => {
  const h = settingsHarness();
  const details = nodes(h.view()).filter(item => item.type === "details");
  assert.ok(details.some(item => render(item).includes("Advanced model behaviour")));
  const html = h.html();
  assert.match(html, /<summary>Model details and reference pricing<\/summary>/);
  assert.match(html, /<dt>Model ID<\/dt><dd><code>review-model/);
  assert.match(html, /<dt>Input \/ 1M tokens<\/dt><dd>\$1\.00 USD/);
  assert.match(html, /<dt>Output \/ 1M tokens<\/dt><dd>\$2\.00 USD/);
  assert.match(html, /not a document estimate/);
  assert.deepEqual(h.calls, []);
});

test("Settings retention units and permanent-deletion warning remain linked and visible", () => {
  const h = settingsHarness();
  h.toggle(0);
  const tree = h.view();
  const input = node(tree, item => item.props.id === "retention-days");
  assert.equal(input.props["aria-describedby"], "retention-unit retention-warning");
  const section = node(tree, item => item.props.id === "document-library");
  const warning = node(section, item => item.props.id === "retention-warning");
  assert.match(render(warning), /permanently removes.*Existing older documents are included/);
  assert.equal(nodes(section).some(item => item.type === "details"), false);
  assert.deepEqual(h.calls, []);
});

test("Settings save preserves distinct review and query choices and disabled retention", async () => {
  const h = settingsHarness();
  h.change("analysis-model", "other-model");
  h.submit();
  await Promise.resolve();
  assert.deepEqual(h.calls, [["settings", { model_id: "other-model", reasoning_effort: "medium", query_gate_model_id: "saved-legacy", retention_days: 0, toast_notifications_enabled: true }]]);
});

test("model and effort stay local until explicit save and query preparation remains separate", async () => {
  const h = settingsHarness();
  h.change("reasoning-effort", "max");
  h.change("analysis-model", "other-model");
  assert.equal(node(h.view(), item => item.props.id === "reasoning-effort").props.value, "max");
  assert.deepEqual(h.calls, []);
  h.submit(); await Promise.resolve();
  assert.equal(h.calls[0][1].reasoning_effort, "max");
  assert.equal(h.calls[0][1].query_gate_model_id, "saved-legacy");
});

test("switching from None to Astra shows a compatible unsaved effort and hides None", () => {
  const astra = { ...model("gpt-6-astra"), reasoning_efforts: ["low", "medium", "high", "xhigh", "max"] };
  const h = settingsHarness({ settings: { ...defaultSettings, reasoning_effort: "none",
    available_models: [...defaultSettings.available_models, astra] } });
  h.change("analysis-model", "gpt-6-astra");
  const selector = node(h.view(), item => item.props.id === "reasoning-effort");
  assert.equal(selector.props.value, "medium");
  assert.equal(nodes(selector).some(item => item.type === "option" && item.props.value === "none"), false);
  assert.match(h.html(), /does not support None reasoning/);
  assert.deepEqual(h.calls, []);
});

test("automatic deletion remains opt-in and requires explicit confirmation", async () => {
  const h = settingsHarness();
  h.toggle(0);
  h.change("retention-days", "90");
  h.submit();
  assert.deepEqual(h.calls, []);
  const confirmation = h.modal("Enable automatic deletion?");
  assert.equal(confirmation.props.isOpen, true);
  assert.match(confirmation.props.message, /90 days ago.*permanent deletion/);
  confirmation.props.onClose();
  assert.deepEqual(h.calls, []);
  h.submit();
  h.modal("Enable automatic deletion?").props.onConfirm();
  await Promise.resolve();
  assert.equal(h.calls[0][1].retention_days, 90);
});

test("invalid retention and unavailable saved models cannot silently save", () => {
  const h = settingsHarness();
  h.toggle(0); h.change("retention-days", "0"); h.submit();
  assert.deepEqual(h.calls, []);
  assert.match(h.html(), /whole number of days/);
  const missing = settingsHarness({ settings: { ...defaultSettings, model_id: "unavailable" } });
  missing.submit();
  assert.deepEqual(missing.calls, []);
  assert.match(missing.html(), /Unavailable model: unavailable/);
});

test("key removal still requires confirmation and never removes documents", async () => {
  const h = settingsHarness();
  h.click("Remove key");
  assert.equal(h.modal("Remove your API key?").props.isOpen, true);
  assert.deepEqual(h.calls, []);
  h.modal("Remove your API key?").props.onConfirm();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(h.calls, [["remove"]]);
  assert.match(h.html(), /Saved documents remain available/);
});

test("connection failure keeps explicit retry separate from mutations", () => {
  const h = settingsHarness({ settings: null, error: "Synthetic connection failure" });
  assert.match(h.html(), /Synthetic connection failure/);
  assert.deepEqual(h.calls, []);
  h.click("Retry connection");
  assert.deepEqual(h.calls, [["refresh"]]);
});

test("saved key replacement opens deliberately and Cancel clears the unsent replacement", () => {
  const h = settingsHarness();
  h.click("Change key");
  assert.match(h.html(), /Replacement API key/);
  assert.match(h.html(), /type="password"[^>]*value=""/);
  h.change("openai-key", "synthetic-unsent-value");
  h.click("Cancel");
  assert.doesNotMatch(h.html(), /id="openai-key"/);
  h.click("Change key");
  assert.equal(node(h.view(), item => item.props.id === "openai-key").props.value, "");
  assert.deepEqual(h.calls, []);
});

test("missing or unrestorable keys expose entry without a false saved-success claim", () => {
  for (const overrides of [{ has_api_key: false }, { has_api_key: true, api_key_needs_reentry: true }]) {
    const h = settingsHarness({ settings: { ...defaultSettings, ...overrides } });
    assert.match(h.html(), /id="openai-key"/);
    assert.equal(h.button(overrides.has_api_key ? "Replace key" : "Save key").props.disabled, true);
    assert.deepEqual(h.calls, []);
    if (overrides.api_key_needs_reentry) {
      assert.match(h.html(), /Key needs attention|previous key could not be restored/);
      assert.doesNotMatch(h.html(), />Key saved</);
    }
  }
});

test("key replacement is explicit, clears its draft after saving and does not test the key", async () => {
  const h = settingsHarness();
  h.click("Change key");
  h.change("openai-key", "synthetic-test-only-value");
  assert.deepEqual(h.calls, []);
  h.submit("API key");
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(h.calls, [["key", "synthetic-test-only-value"]]);
  assert.doesNotMatch(h.html(), /id="openai-key"/);
  assert.match(h.html(), /No AI request was made/);
  h.click("Change key");
  assert.equal(node(h.view(), item => item.props.id === "openai-key").props.value, "");
});

test("a failed key save retains the replacement form without claiming success", async () => {
  const h = settingsHarness({ saveApiKey: async () => { throw new Error("Synthetic key save failure"); } });
  h.click("Change key"); h.change("openai-key", "synthetic-test-only-value");
  h.submit("API key");
  await new Promise(resolve => setImmediate(resolve));
  assert.match(h.html(), /Synthetic key save failure/);
  assert.equal(node(h.view(), item => item.props.id === "openai-key").props.value, "synthetic-test-only-value");
  assert.doesNotMatch(h.html(), /API key saved\./);
});

test("key editor moves keyboard focus on opening, cancel and successful replacement only", async () => {
  const h = settingsHarness();
  h.commit();
  assert.deepEqual(h.focus, [], "Initial Settings rendering must not steal focus");
  h.click("Change key"); h.commit();
  assert.deepEqual(h.focus, ["key-input"]);
  h.change("openai-key", "synthetic-test-only-value"); h.commit();
  assert.deepEqual(h.focus, ["key-input"], "Typing must not refocus the field");
  h.click("Cancel"); h.commit();
  assert.deepEqual(h.focus, ["key-input", "change-key"]);
  h.click("Change key"); h.commit();
  h.change("openai-key", "synthetic-test-only-value");
  h.submit("API key"); h.commit();
  await new Promise(resolve => setImmediate(resolve));
  h.commit();
  assert.deepEqual(h.focus, ["key-input", "change-key", "key-input", "change-key"]);
});

test("failed key replacement keeps its editor without moving focus to a removed trigger", async () => {
  const h = settingsHarness({ saveApiKey: async () => { throw new Error("Synthetic key save failure"); } });
  h.click("Change key"); h.commit();
  h.change("openai-key", "synthetic-test-only-value"); h.submit("API key"); h.commit();
  await new Promise(resolve => setImmediate(resolve));
  h.commit();
  assert.deepEqual(h.focus, ["key-input"]);
  assert.match(h.html(), /Synthetic key save failure/);
  assert.equal(node(h.view(), item => item.props.id === "openai-key").props.value, "synthetic-test-only-value");
});

test("unchanged settings do not save; edits and reverting show accurate dirty state", async () => {
  const h = settingsHarness();
  assert.equal(h.button("Save changes").props.disabled, true);
  assert.match(h.html(), /No unsaved changes/);
  h.submit();
  assert.deepEqual(h.calls, []);
  h.change("reasoning-effort", "high");
  assert.equal(h.button("Save changes").props.disabled, false);
  assert.match(h.html(), /Unsaved changes/);
  h.change("reasoning-effort", "medium");
  assert.equal(h.button("Save changes").props.disabled, true);
  h.toggle(1);
  assert.equal(h.button("Save changes").props.disabled, false);
  h.submit();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.button("Save changes").props.disabled, true);
  assert.match(h.html(), /No unsaved changes/);
  assert.equal(h.calls.length, 1);
});

test("failed settings save keeps edits available and reports the failure", async () => {
  const h = settingsHarness({ updateSettings: async () => { throw new Error("Synthetic save failure"); } });
  h.change("reasoning-effort", "high"); h.submit();
  await new Promise(resolve => setImmediate(resolve));
  assert.match(h.html(), /Synthetic save failure/);
  assert.equal(node(h.view(), item => item.props.id === "reasoning-effort").props.value, "high");
  assert.equal(h.button("Save changes").props.disabled, false);
});
