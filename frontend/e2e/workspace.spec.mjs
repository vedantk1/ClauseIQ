import { mkdir, readFile } from "node:fs/promises";
import { test, expect, DOCUMENT_ID, IMPORT_ID, RUN_ID, PDF_PATH, LIBRARY_QUESTION } from "./fixtures.mjs";

async function openFindings(page) {
  await page.goto("/documents");
  await page.getByRole("link", { name: /managed-services-25p.pdf/ }).click();
  await expect(page).toHaveURL(new RegExp(`/workspace\\?documentId=${DOCUMENT_ID}$`));
  await page.getByRole("button", { name: "Findings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Clarify how service credits are earned", exact: true })).toBeVisible();
}

async function captureLibraryThemes(page, screen) {
  await mkdir("../output/playwright/showcase", { recursive: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator("html")).toHaveAttribute("data-theme", "black");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `../output/playwright/showcase/${screen}-black-1280.png` });
  await page.getByRole("button", { name: "Switch to Graphite theme", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "graphite");
  await page.screenshot({ path: `../output/playwright/showcase/${screen}-graphite-1280.png` });
  await page.setViewportSize({ width: 720, height: 800 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByRole("button", { name: "Search contract text", exact: true })).toBeInViewport();
  await page.screenshot({ path: `../output/playwright/showcase/${screen}-graphite-720.png` });
  await page.getByRole("button", { name: "Switch to Black theme", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "black");
  await page.screenshot({ path: `../output/playwright/showcase/${screen}-black-720.png` });
  await page.setViewportSize({ width: 1280, height: 800 });
}

test("showcase: Library Browse remains focused in both themes at laptop and narrow widths", async ({ page, mockWorkspace }) => {
  await page.goto("/documents");
  await expect(page.getByRole("button", { name: "Browse", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("link", { name: "Resume review", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Filter by filename", exact: true })).toBeVisible();
  await expect(page.getByRole("search")).toBeHidden();
  await captureLibraryThemes(page, "library-browse");
  expect(mockWorkspace.libraryRequests.searches).toEqual([]);
  expect(mockWorkspace.libraryRequests.sends).toEqual([]);
});

test("Library → authored finding → exact PDF page → return → saved question → resume", async ({ page, mockWorkspace }) => {
  await openFindings(page);
  await page.getByRole("button", { name: "Preview excerpt · Archive pilot exception · page 24", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Archive pilot exception", exact: true })).toBeFocused();
  await expect(page.locator("blockquote.cw-evidence-quote")).toContainText("Archive Service is twenty percent");
  await page.getByRole("button", { name: "View page 24", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "PDF page number", exact: true })).toHaveValue("24");
  await expect(page.locator('.pdfViewer .page[data-page-number="24"]')).toBeInViewport();
  await expect(page.locator('.pdfViewer .page[data-page-number="24"] canvas')).toBeVisible();
  await page.getByRole("textbox", { name: "PDF page number", exact: true }).fill("22");
  await page.getByRole("button", { name: "Go to page", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "PDF page number", exact: true })).toHaveValue("22");
  await page.getByRole("combobox", { name: "PDF zoom", exact: true }).selectOption("page-width");
  await page.getByRole("combobox", { name: "PDF reading mode", exact: true }).selectOption("single");
  await page.getByRole("button", { name: "Findings", exact: true }).click();
  await page.getByRole("button", { name: "Document", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "PDF page number", exact: true })).toHaveValue("22");
  await expect(page.getByRole("combobox", { name: "PDF zoom", exact: true })).toHaveValue("page-width");
  await expect(page.getByRole("combobox", { name: "PDF reading mode", exact: true })).toHaveValue("single");
  await page.getByRole("button", { name: "Findings", exact: true }).click();
  await page.getByRole("button", { name: "View page 24 · Archive pilot exception", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "PDF page number", exact: true })).toHaveValue("24");
  await expect(page.locator('.pdfViewer .page[data-page-number="24"]')).toBeInViewport();
  await expect(page.locator('.pdfViewer .page[data-page-number="24"] canvas')).toBeVisible();
  await page.getByRole("button", { name: /Return to this finding$/ }).click();
  await expect(page.getByRole("heading", { name: "Clarify how service credits are earned", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Keep question", exact: true }).click();
  const question = "Please clarify the Archive pilot credit band boundaries.";
  await page.getByRole("textbox", { name: /Question draft for/ }).fill(question);
  await page.getByRole("button", { name: "Save question", exact: true }).click();
  await expect.poll(() => mockWorkspace.fixture.workspace.personal[RUN_ID].saved_questions["credit-bands"]?.text).toBe(question);
  await page.getByRole("button", { name: "My review (1 saved question)", exact: true }).click();
  await expect(page.getByText(question, { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "My review (1 saved question)", exact: true }).click();
  await expect(page.getByText(question, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.getByRole("link", { name: "Resume review", exact: true }).click();
  await expect(page).toHaveURL(/resume=1/);
  await expect(page.getByRole("button", { name: "My review (1 saved question)", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText(question, { exact: true })).toBeVisible();
  expect(mockWorkspace.operations.some(operation => operation.type === "save_question")).toBe(true);
});

test("synthetic PDF import opens unpaid setup without a key or provider request", async ({ page, mockWorkspace }) => {
  await page.goto("/import");
  await expect(page.getByRole("heading", { name: "Import an agreement", exact: true })).toBeVisible();
  await captureEntryThemes(page, "import-empty");
  await page.locator('input[type="file"]').setInputFiles(PDF_PATH);
  await expect(page.getByText("managed-services-25p.pdf", { exact: true })).toBeVisible();
  await captureEntryThemes(page, "import-selected");
  await page.getByRole("button", { name: "Import agreement", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`documentId=${IMPORT_ID}`));
  await expect(page.getByRole("heading", { name: "Set up your review", exact: true })).toBeVisible();
  await expect(page.getByText("25 of 25 pages have extracted text.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start review", exact: true })).toBeDisabled();
  await captureEntryThemes(page, "review-setup");
  expect(mockWorkspace.imported.workspace.runs).toHaveLength(0);
});

async function captureEntryThemes(page, screen) {
  await mkdir("../output/playwright/showcase", { recursive: true });
  for (const [width, theme] of [[1280, "black"], [1280, "graphite"], [720, "graphite"], [720, "black"]]) {
    await page.setViewportSize({ width, height: 800 });
    if (await page.locator("html").getAttribute("data-theme") !== theme) {
      await page.getByRole("button", { name: `Switch to ${theme === "black" ? "Black" : "Graphite"} theme`, exact: true }).click();
    }
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `../output/playwright/showcase/${screen}-${theme}-${width}.png` });
  }
  await page.setViewportSize({ width: 1280, height: 800 });
}

test("showcase: Overview keeps saved wording and its own source-return context", async ({ page, mockWorkspace }) => {
  const run = mockWorkspace.fixture.workspace.runs[0];
  const reference = run.findings[0].evidence.find(item => item.page_number === 24);
  await page.goto(`/workspace?documentId=${DOCUMENT_ID}`);
  await expect(page.getByRole("heading", { name: "Agreement summary", exact: true })).toBeVisible();
  await expect(page.getByText(run.overview, { exact: true })).toBeVisible();
  await captureEntryThemes(page, "agreement-overview");
  // Explicitly authored interaction fixture; no generated claim or support score.
  const summary = "Synthetic overview citation fixture: read the Archive pilot exception in the source.";
  run.overview_items = [{ text: summary, evidence: [reference] }];
  await page.reload();
  await expect(page.getByText(summary, { exact: true })).toBeVisible();
  await page.getByText("1 source reference", { exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("blockquote")).toContainText(reference.quote);
  await captureEntryThemes(page, "overview-reference");
  await page.getByRole("button", { name: "View page 24", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "PDF page number", exact: true })).toHaveValue("24");
  await page.getByRole("button", { name: /Return to overview$/i }).click();
  await expect(page.getByText(summary, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Explore findings/ }).click();
  await expect(page.getByRole("button", { name: "Findings", exact: true })).toHaveAttribute("aria-current", "page");
  expect(run.overview_items[0].text).toBe(summary);
  expect(mockWorkspace.operations.every(operation => operation.type === "set_position")).toBe(true);
});

test("showcase: Settings stays local and key/deletion controls retain deliberate cancellation", async ({ page, mockWorkspace }) => {
  mockWorkspace.settings.has_api_key = true; // Status flag only; no key exists in this fixture.
  mockWorkspace.settings.available_models = ["sol", "luna"].map(name => ({
    id: `gpt-6-${name}`, name: `GPT-6 ${name === "sol" ? "Sol" : "Luna"}`,
    description: "Synthetic browser catalog entry, not model-quality evidence.", legacy: false,
    reasoning_efforts: ["low", "medium", "high"], default_reasoning_effort: "medium",
    input_price_per_million: 1, output_price_per_million: 2,
    pricing_verified_on: "synthetic fixture", pricing_note: "Test values, not provider prices.",
  }));
  await page.goto("/settings");
  await expect(page.getByText("Key saved", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save changes", exact: true })).toBeDisabled();
  await captureEntryThemes(page, "workspace-settings");
  await page.getByRole("button", { name: "Change key", exact: true }).click();
  await expect(page.getByLabel("Replacement API key", { exact: true })).toBeFocused();
  await expect(page.getByLabel("Replacement API key", { exact: true })).toHaveAttribute("type", "password");
  await expect(page.getByLabel("Replacement API key", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("button", { name: "Change key", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Remove key", exact: true }).click();
  const remove = page.getByRole("dialog", { name: "Remove your API key?", exact: true });
  await expect(remove).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(remove).toBeHidden();
  await page.getByRole("combobox", { name: "Reasoning effort", exact: true }).selectOption("high");
  await expect(page.getByText("Unsaved changes", { exact: true })).toBeVisible();
  await page.getByRole("checkbox", { name: "Automatic deletion", exact: true }).check();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  const deletion = page.getByRole("dialog", { name: "Enable automatic deletion?", exact: true });
  await expect(deletion).toContainText("including documents already in your library");
  await deletion.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(mockWorkspace.settings.retention_days).toBe(0);
  expect(mockWorkspace.settings.reasoning_effort).toBe("medium");
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "Automatic deletion", exact: true })).not.toBeChecked();
  await expect(page.getByRole("combobox", { name: "Reasoning effort", exact: true })).toHaveValue("medium");
  await expect(page.getByText("Key saved", { exact: true })).toBeVisible();
  expect(mockWorkspace.operations).toEqual([]);
  expect(mockWorkspace.libraryRequests.sends).toEqual([]);
});

test("showcase: Black and Graphite keep a usable laptop and narrow layout", async ({ page }) => {
  await openFindings(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "black");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  // A real app capture, with fixture badges retained and no browser chrome.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mkdir("../output/playwright/showcase", { recursive: true });
  await page.screenshot({ path: "../output/playwright/showcase/review-workspace-black.png" });
  await page.getByRole("button", { name: "Switch to Graphite theme", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "graphite");
  await page.screenshot({ path: "../output/playwright/showcase/review-workspace-graphite.png" });
  await page.setViewportSize({ width: 720, height: 800 });
  await expect(page.getByRole("combobox", { name: "Finding", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Keep question", exact: true })).toBeInViewport();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("combobox", { name: "Finding", exact: true }).selectOption("archive-exit");
  await expect(page.getByRole("heading", { name: "Plan for the conditional Archive exit extension", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Switch to Black theme", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "black");
});

async function captureWorkspaceThemes(page, screen) {
  await mkdir("../output/playwright/showcase", { recursive: true });
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "black");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `../output/playwright/showcase/${screen}-black-1280.png` });
  await page.getByRole("button", { name: "Switch to Graphite theme", exact: true }).click();
  await page.screenshot({ path: `../output/playwright/showcase/${screen}-graphite-1280.png` });
  await page.setViewportSize({ width: 720, height: 800 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (screen === "document-reader") {
    const extraction = page.getByRole("complementary", { name: "Extracted text on page 24", exact: true });
    await expect(extraction).toHaveCSS("position", "absolute");
    await expect(page.getByRole("button", { name: "Close extracted text", exact: true })).toBeInViewport();
  }
  await page.screenshot({ path: `../output/playwright/showcase/${screen}-graphite-720.png` });
  await page.getByRole("button", { name: "Switch to Black theme", exact: true }).click();
  await page.screenshot({ path: `../output/playwright/showcase/${screen}-black-720.png` });
  await page.setViewportSize({ width: 1280, height: 800 });
}

test("showcase: workspace drafts, answer sources, reader and confirmed export stay separate", async ({ page, mockWorkspace }) => {
  test.setTimeout(60_000);
  const { workspace } = mockWorkspace.fixture;
  const personal = workspace.personal[RUN_ID];
  const [first, second, third] = workspace.runs[0].findings;
  const firstQuestion = "Please clarify the Archive pilot credit band boundaries.";
  const secondQuestion = "Who requests the Archive extension and approves the assistance charges?";
  personal.saved_questions = {
    [first.id]: { id: "saved-credit-question", text: firstQuestion, saved_at: "2026-01-01T12:00:00Z" },
    [second.id]: { id: "saved-exit-question", text: secondQuestion, saved_at: "2026-01-01T12:00:00Z" },
  };
  personal.markers = { [first.id]: "revisit", [third.id]: "reviewed_by_me" };
  const reference = first.evidence.find(item => item.page_number === 24);
  const savedAnswer = "Synthetic saved-answer fixture: inspect the Archive pilot exception in the source.";
  workspace.ask_turns = [{ id: "synthetic-saved-ask", run_id: RUN_ID, finding_id: first.id,
    source_revision_id: workspace.source_revision_id, question: "Does the Archive pilot use the ordinary credit ceiling?",
    status: "ready", answer: [{ text: savedAnswer, evidence: [reference] }],
    limitations: ["Authored browser fixture, not a live model result."], failure: null,
    created_at: "2026-01-01T12:00:00Z", completed_at: "2026-01-01T12:00:01Z",
    history_turn_ids: [], include_history: false, history_truncated: false,
    generation: { model_id: "gpt-6-sol", reasoning_effort: "medium", endpoint: "chat.completions",
      prompt_version: "browser-fixture", schema_version: "browser-fixture", extraction_version: "browser-fixture",
      estimated_input_tokens: 1000, max_completion_tokens: 2000, usage: null, duration_ms: 1000 },
    coverage: { page_count: 25, extracted_pages: Array.from({ length: 25 }, (_, index) => index + 1),
      omitted_pages: [], input_scope: "all_extracted_text", limitations: [] },
  }];
  await openFindings(page);
  await captureWorkspaceThemes(page, "finding-reading");
  await page.getByRole("button", { name: "Ask (1)", exact: true }).click();
  await expect(page.getByText(savedAnswer, { exact: true })).toBeVisible();
  const askDraft = page.getByRole("textbox", { name: "Your question", exact: true });
  await askDraft.fill("A separate unsent Ask draft.");
  await page.getByRole("button", { name: "Use review question", exact: true }).click();
  const replacement = page.getByRole("dialog", { name: "Replace the Ask draft?", exact: true });
  await expect(replacement).toBeVisible();
  await replacement.getByRole("button", { name: "Keep Ask draft", exact: true }).click();
  await expect(askDraft).toHaveValue("A separate unsent Ask draft.");
  await page.getByRole("button", { name: "Use review question", exact: true }).click();
  await replacement.getByRole("button", { name: "Replace Ask draft", exact: true }).click();
  await expect(askDraft).toHaveValue(firstQuestion);
  await expect(page.getByRole("button", { name: "Send question to AI", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: `Preview excerpt · page 24 · ${reference.label}`, exact: true }).click();
  await expect(page.getByRole("complementary", { name: "Evidence for the selected answer", exact: true })).toContainText(reference.quote);
  await captureWorkspaceThemes(page, "finding-ask");
  await page.getByRole("button", { name: "View page 24", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "PDF page number", exact: true })).toHaveValue("24");
  await page.getByRole("combobox", { name: "PDF zoom", exact: true }).selectOption("page-width");
  await page.getByRole("button", { name: "Extracted text", exact: true }).click();
  await expect(page.getByRole("complementary", { name: "Extracted text on page 24", exact: true })).toBeVisible();
  await captureWorkspaceThemes(page, "document-reader");
  await page.getByRole("button", { name: "Close extracted text", exact: true }).click();
  await expect(page.getByRole("button", { name: "Extracted text", exact: true })).toBeFocused();
  await page.getByRole("button", { name: /Return to Ask$/ }).click();
  await expect(askDraft).toHaveValue(firstQuestion);
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page.getByRole("button", { name: "Edit question", exact: true }).click();
  const reviewDraft = page.getByRole("textbox", { name: /Question draft for/ });
  await reviewDraft.fill("An unsaved review edit, separate from Ask.");
  await page.getByRole("button", { name: "Close editor", exact: true }).click();
  await page.getByRole("button", { name: "Ask (1)", exact: true }).click();
  await expect(askDraft).toHaveValue(firstQuestion);
  await page.getByRole("button", { name: "My review (2 saved questions)", exact: true }).click();
  const checklist = page.getByRole("list", { name: "Review checklist", exact: true });
  await expect(checklist.locator(":scope > li")).toHaveCount(3);
  await expect(checklist.getByText(firstQuestion, { exact: true })).toBeVisible();
  await expect(checklist.getByText(secondQuestion, { exact: true })).toBeVisible();
  await captureWorkspaceThemes(page, "saved-review");
  await page.getByRole("button", { name: /^Revisit\s*1$/ }).click();
  await expect(checklist.locator(":scope > li")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Download Markdown", exact: true })).toBeEnabled();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Markdown", exact: true }).click();
  const download = await downloadEvent;
  const markdown = await readFile(await download.path(), "utf8");
  expect(markdown).toContain(firstQuestion);
  expect(markdown).toContain(secondQuestion);
  expect(markdown).not.toContain("An unsaved review edit");
  expect(markdown).not.toContain(savedAnswer);
  expect(workspace.personal[RUN_ID].saved_questions[first.id].text).toBe(firstQuestion);
  expect(mockWorkspace.libraryRequests.sends).toEqual([]);
});

test("workspace alignment keeps status actions level and Details beside multiple runs", async ({ page, mockWorkspace }) => {
  const earlier = structuredClone(mockWorkspace.fixture.workspace.runs[0]);
  earlier.id = "earlier-authored-example";
  earlier.created_at = "2025-12-31T12:00:00Z";
  mockWorkspace.fixture.workspace.runs.unshift(earlier);
  mockWorkspace.fixture.workspace.personal[earlier.id] = structuredClone(mockWorkspace.fixture.workspace.personal[RUN_ID]);
  await page.goto(`/workspace?documentId=${DOCUMENT_ID}`);
  const details = page.getByLabel("Review details", { exact: true });
  const runLabel = page.locator(".cw-run-selector");
  await expect(page.getByRole("combobox", { name: "Review run", exact: true })).toHaveValue(RUN_ID);
  const detailsBox = await details.boundingBox();
  const runBox = await runLabel.boundingBox();
  expect(runBox.x - (detailsBox.x + detailsBox.width)).toBeGreaterThanOrEqual(0);
  expect(runBox.x - (detailsBox.x + detailsBox.width)).toBeLessThanOrEqual(20);
  expect(Math.abs(detailsBox.y + detailsBox.height / 2 - runBox.y - runBox.height / 2)).toBeLessThan(2);
  await details.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".cw-provenance-content")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(details).toBeFocused();
  await expect(page.locator(".cw-provenance-content")).toBeHidden();
  await page.getByRole("navigation", { name: "Agreement workspace views", exact: true }).getByRole("button", { name: "My review", exact: true }).click();
  await page.getByRole("button", { name: /^All findings/ }).click();
  const row = page.getByRole("list", { name: "Review checklist", exact: true }).locator(":scope > li").first();
  const add = row.getByRole("button", { name: "Add question", exact: true });
  const marker = row.getByRole("combobox", { name: /^Marker for / });
  await expect(row.getByText("Personal status", { exact: true })).toHaveCount(0);
  const addBox = await add.boundingBox();
  const markerBox = await marker.boundingBox();
  expect(Math.abs(addBox.y - markerBox.y)).toBeLessThan(1);
  expect(Math.abs(addBox.height - markerBox.height)).toBeLessThan(1);
  await captureEntryThemes(page, "review-alignment");
  await page.setViewportSize({ width: 400, height: 800 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(details).toBeInViewport();
  await expect(page.getByRole("combobox", { name: "Review run", exact: true })).toBeInViewport();
  expect(mockWorkspace.libraryRequests.sends).toEqual([]);
});

test.describe("Library answer journey with an explicitly enabled provider stub", () => {
  test.use({ allowLibraryAnswer: true });

  test("search → cancel preview → explicit send → own citation → saved answer after reload", async ({ page, mockWorkspace }) => {
    const { libraryRequests, answerPlan } = mockWorkspace;
    await page.goto("/documents");
    await page.getByRole("button", { name: "Search contract text", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("textbox", { name: "Filter by filename", exact: true })).toBeHidden();
    await expect(page.getByRole("link", { name: "Resume review", exact: true })).toBeHidden();
    await page.getByText("Saved Library answers", { exact: true }).click();
    await expect(page.getByText("No saved answer attempts yet.", { exact: true })).toBeVisible();
    await page.getByText("Saved Library answers", { exact: true }).click();
    const search = page.getByRole("search");
    await search.getByRole("searchbox", { name: "Search agreement text" }).fill(LIBRARY_QUESTION);
    await search.getByRole("button", { name: "Search text", exact: true }).click();
    await expect(page.getByRole("list", { name: "Agreement text results" }).getByRole("listitem")).toHaveCount(2);
    const historyReads = libraryRequests.history;
    await page.getByRole("button", { name: "Browse", exact: true }).click();
    await expect(search).toBeHidden();
    await page.getByRole("textbox", { name: "Filter by filename", exact: true }).fill("managed");
    await page.getByRole("button", { name: "Search contract text", exact: true }).click();
    await expect(search.getByRole("searchbox", { name: "Search agreement text" })).toHaveValue(LIBRARY_QUESTION);
    await expect(page.getByRole("list", { name: "Agreement text results" }).getByRole("listitem")).toHaveCount(2);
    expect(libraryRequests.history).toBe(historyReads);
    expect(libraryRequests.searches).toHaveLength(1);
    expect(libraryRequests.sends).toEqual([]);
    await page.getByRole("button", { name: "Answer from these results", exact: true }).click();
    const modal = page.getByRole("dialog", { name: "Answer from these results", exact: true });
    await expect(modal).toBeVisible();
    await expect(modal).toContainText("Charges apply. No new search or automatic retry.");
    await modal.getByText("Inspect evidence being sent", { exact: true }).click();
    await expect(modal.getByText(`Reference S2 · passage ${answerPlan.evidence[1].passage_id}`, { exact: true })).toBeHidden();
    await modal.getByText("Preview excerpt · managed-services-25p.pdf · page 25", { exact: true }).click();
    await expect(modal.locator("blockquote").filter({ hasText: answerPlan.evidence[1].quote })).toBeVisible();
    await expect(modal.getByText(`Reference S2 · passage ${answerPlan.evidence[1].passage_id}`, { exact: true })).toBeVisible();
    expect(libraryRequests.sends).toEqual([]);
    await modal.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(modal).not.toBeVisible();
    expect(libraryRequests.sends).toEqual([]);

    await page.getByRole("button", { name: "Answer from these results", exact: true }).click();
    await modal.getByRole("button", { name: "Generate answer · paid", exact: true }).click();
    const answer = page.getByRole("article", { name: "Saved Library answer", exact: true });
    await expect(answer.getByRole("heading", { name: "Partial answer", exact: true })).toBeVisible();
    await expect(answer).toHaveAttribute("data-search-context", "current");
    await expect(page.locator('[data-layout="answer-and-results"]')).toBeVisible();
    await expect(page.getByText("Saved Library answers (1)", { exact: true })).toBeVisible();
    expect(libraryRequests.sends).toHaveLength(1);
    expect(libraryRequests.searches).toHaveLength(1);
    expect(libraryRequests.previews).toHaveLength(2);
    await page.getByRole("button", { name: "Browse", exact: true }).click();
    await expect(answer).toBeHidden();
    await expect(page.getByRole("textbox", { name: "Filter by filename", exact: true })).toHaveValue("managed");
    await page.getByRole("button", { name: "Search contract text", exact: true }).click();
    await expect(answer.getByRole("heading", { name: "Partial answer", exact: true })).toBeVisible();
    await expect(search.getByRole("searchbox", { name: "Search agreement text" })).toHaveValue(LIBRARY_QUESTION);
    expect(libraryRequests.sends).toHaveLength(1);
    expect(libraryRequests.searches).toHaveLength(1);
    await captureLibraryThemes(page, "library-answer");
    // Only S2 is attributed to this statement. The first search hit (S1/page 24)
    // must not be substituted, even though it is available in the answer plan.
    await expect(answer.getByText("Preview excerpt · managed-services-25p.pdf · page 24", { exact: true })).toHaveCount(0);
    await expect(answer.getByText(`Reference S2 · passage ${answerPlan.evidence[1].passage_id}`, { exact: true })).toBeHidden();
    await answer.getByText("Preview excerpt · managed-services-25p.pdf · page 25", { exact: true }).click();
    await expect(answer.locator("blockquote")).toHaveText(answerPlan.evidence[1].quote);
    await expect(answer.getByText(`Reference S2 · passage ${answerPlan.evidence[1].passage_id}`, { exact: true })).toBeVisible();
    // Publishable framing keeps the partial outcome, fixture label and the
    // answer's own excerpt visible. It does not retouch or fabricate an answer.
    await page.setViewportSize({ width: 1440, height: 1120 });
    await page.screenshot({ path: "../output/playwright/showcase/library-answer-source-black.png" });
    await page.setViewportSize({ width: 1280, height: 800 });
    await answer.getByRole("link", { name: "View page 25", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`documentId=${DOCUMENT_ID}&sourceRevisionId=${DOCUMENT_ID}-source-v1&page=25&from=library-search`));
    await expect(page.getByRole("textbox", { name: "PDF page number", exact: true })).toHaveValue("25");
    const physicalPage = page.locator('.pdfViewer .page[data-page-number="25"]');
    await expect(physicalPage).toBeInViewport();
    await expect(physicalPage.locator("canvas")).toBeVisible();
    await expect(physicalPage.locator(".textLayer")).toContainText("Archive");

    await page.getByRole("button", { name: /Return to Library$/ }).click();
    await expect(page).toHaveURL(/\/documents\?view=search$/);
    await expect(page.getByRole("button", { name: "Search contract text", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(search).toBeVisible();
    await expect(page.getByText("Saved Library answers (1)", { exact: true })).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "Search contract text", exact: true }).click();
    await page.getByText("Saved Library answers (1)", { exact: true }).click();
    await page.getByRole("button", { name: `${LIBRARY_QUESTION} · Saved`, exact: true }).click();
    await expect(answer.getByRole("heading", { name: "Partial answer", exact: true })).toBeVisible();
    await expect(answer).toHaveAttribute("data-search-context", "earlier");
    await expect(answer.getByText("Saved answer · earlier search", { exact: true })).toBeVisible();
    await answer.getByText("Preview excerpt · managed-services-25p.pdf · page 25", { exact: true }).click();
    await expect(answer.locator("blockquote")).toHaveText(answerPlan.evidence[1].quote);
    // A repeated keyword search creates a new fixture context. The saved answer
    // retains its original context and must not be presented beside fresh results
    // as though it were generated from them. No second generation is permitted.
    answerPlan.context_id = "synthetic-library-context-later";
    await search.getByRole("searchbox", { name: "Search agreement text" }).fill(LIBRARY_QUESTION);
    await search.getByRole("button", { name: "Search text", exact: true }).click();
    await expect(page.getByRole("list", { name: "Agreement text results" }).getByRole("listitem")).toHaveCount(2);
    await expect(answer).toHaveAttribute("data-search-context", "earlier");
    await expect(answer.getByText("This saved answer uses earlier search results, not the results shown below.", { exact: true })).toBeVisible();
    await expect(page.locator('[data-layout="answer-and-results"]')).toHaveCount(0);
    expect(libraryRequests.reads).toEqual([libraryRequests.sends[0].request_id]);
    expect(libraryRequests.sends).toHaveLength(1);
    expect(libraryRequests.searches).toHaveLength(2);
    expect(mockWorkspace.savedAnswers.size).toBe(1);
  });
});
