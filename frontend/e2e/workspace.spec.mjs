import { mkdir } from "node:fs/promises";
import { test, expect, DOCUMENT_ID, IMPORT_ID, RUN_ID, PDF_PATH, LIBRARY_QUESTION } from "./fixtures.mjs";

async function openFindings(page) {
  await page.goto("/documents");
  await page.getByRole("link", { name: /managed-services-25p.pdf/ }).click();
  await expect(page).toHaveURL(new RegExp(`/workspace\\?documentId=${DOCUMENT_ID}$`));
  await page.getByRole("button", { name: "Findings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Clarify how service credits are earned", exact: true })).toBeVisible();
}

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
  await page.locator('input[type="file"]').setInputFiles(PDF_PATH);
  await page.getByRole("button", { name: "Import agreement", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`documentId=${IMPORT_ID}`));
  await expect(page.getByRole("heading", { name: "Set up your review", exact: true })).toBeVisible();
  await expect(page.getByText("25 of 25 pages have extracted text.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start review", exact: true })).toBeDisabled();
  expect(mockWorkspace.imported.workspace.runs).toHaveLength(0);
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

test.describe("Library answer journey with an explicitly enabled provider stub", () => {
  test.use({ allowLibraryAnswer: true });

  test("search → cancel preview → explicit send → own citation → saved answer after reload", async ({ page, mockWorkspace }) => {
    const { libraryRequests, answerPlan } = mockWorkspace;
    await page.goto("/documents");
    await page.getByText("Saved Library answers", { exact: true }).click();
    await expect(page.getByText("No saved answer attempts yet.", { exact: true })).toBeVisible();
    const search = page.getByRole("search");
    await search.getByRole("searchbox", { name: "Search agreement text" }).fill(LIBRARY_QUESTION);
    await search.getByRole("button", { name: "Search text", exact: true }).click();
    await expect(page.getByRole("list", { name: "Agreement text results" }).getByRole("listitem")).toHaveCount(2);
    expect(libraryRequests.sends).toEqual([]);
    await page.getByRole("button", { name: "Answer from these results", exact: true }).click();
    const modal = page.getByRole("dialog", { name: "Answer from these results", exact: true });
    await expect(modal).toBeVisible();
    await expect(modal).toContainText("separate paid answer");
    await modal.getByText("Inspect evidence being sent", { exact: true }).click();
    await modal.getByText("managed-services-25p.pdf · page 25 · S2", { exact: true }).click();
    await expect(modal.locator("blockquote").filter({ hasText: answerPlan.evidence[1].quote })).toBeVisible();
    expect(libraryRequests.sends).toEqual([]);
    await modal.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(modal).not.toBeVisible();
    expect(libraryRequests.sends).toEqual([]);

    await page.getByRole("button", { name: "Answer from these results", exact: true }).click();
    await modal.getByRole("button", { name: "Generate answer · paid", exact: true }).click();
    const answer = page.getByRole("article", { name: "Saved Library answer", exact: true });
    await expect(answer.getByRole("heading", { name: "Partial answer", exact: true })).toBeVisible();
    await expect(page.getByText("Saved Library answers (1)", { exact: true })).toBeVisible();
    expect(libraryRequests.sends).toHaveLength(1);
    expect(libraryRequests.searches).toHaveLength(1);
    expect(libraryRequests.previews).toHaveLength(2);
    // Only S2 is attributed to this statement. The first search hit (S1/page 24)
    // must not be substituted, even though it is available in the answer plan.
    await expect(answer.getByText("managed-services-25p.pdf · page 24 · S1", { exact: true })).toHaveCount(0);
    await answer.getByText("managed-services-25p.pdf · page 25 · S2", { exact: true }).click();
    await expect(answer.locator("blockquote")).toHaveText(answerPlan.evidence[1].quote);
    await answer.getByRole("link", { name: "View page 25", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`documentId=${DOCUMENT_ID}&sourceRevisionId=${DOCUMENT_ID}-source-v1&page=25&from=library-search`));
    await expect(page.getByRole("textbox", { name: "PDF page number", exact: true })).toHaveValue("25");
    const physicalPage = page.locator('.pdfViewer .page[data-page-number="25"]');
    await expect(physicalPage).toBeInViewport();
    await expect(physicalPage.locator("canvas")).toBeVisible();
    await expect(physicalPage.locator(".textLayer")).toContainText("Archive");

    await page.getByRole("button", { name: /Return to Library$/ }).click();
    await expect(page).toHaveURL(/\/documents$/);
    await expect(page.getByText("Saved Library answers (1)", { exact: true })).toBeVisible();
    await page.reload();
    await page.getByText("Saved Library answers (1)", { exact: true }).click();
    await page.getByRole("button", { name: `${LIBRARY_QUESTION} · Saved`, exact: true }).click();
    await expect(answer.getByRole("heading", { name: "Partial answer", exact: true })).toBeVisible();
    await answer.getByText("managed-services-25p.pdf · page 25 · S2", { exact: true }).click();
    await expect(answer.locator("blockquote")).toHaveText(answerPlan.evidence[1].quote);
    expect(libraryRequests.reads).toEqual([libraryRequests.sends[0].request_id]);
    expect(libraryRequests.sends).toHaveLength(1);
    expect(libraryRequests.searches).toHaveLength(1);
    expect(mockWorkspace.savedAnswers.size).toBe(1);
  });
});
