import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";

const API = "http://127.0.0.1:8101";
const WEB = "http://127.0.0.1:3101";
const PDF = fileURLToPath(new URL("../../../tests/fixtures/pdfs/managed-services-25p.pdf", import.meta.url));
const question = "Please clarify the Archive pilot credit band boundaries.";

test("real import → authored finding → durable saved question → original PDF page", async ({ page, context }) => {
  const forbidden = [];
  const errors = [];
  const searchRequests = [];
  let answerHistoryReads = 0;
  page.on("pageerror", error => errors.push(error.message));
  await context.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    if (url.origin === WEB && !url.pathname.startsWith("/api/")) return route.continue();
    const path = url.pathname;
    if (method === "POST" && path === "/api/v1/library/search") {
      searchRequests.push({ query: request.postDataJSON()?.query, urlQuery: url.search });
    }
    if (method === "GET" && path === "/api/v1/library/answers") answerHistoryReads += 1;
    const read = (method === "POST" && path === "/api/v1/library/search") || method === "GET" && (
      ["/api/v1/workspace", "/api/v1/app-config", "/api/v1/documents/", "/api/v1/library/answers"].includes(path)
      || /^\/api\/v1\/documents\/[^/]+(?:\/source|\/pdf|\/review-workspace)?$/.test(path)
    );
    const write = (method === "POST" && (
      path === "/api/v1/documents/import" || /^\/api\/v1\/documents\/[^/]+\/(view|review-workspace\/fixture)$/.test(path)
    )) || (method === "PUT" && /^\/api\/v1\/documents\/[^/]+\/review-workspace$/.test(path));
    if (url.origin !== API || !(read || write)) {
      forbidden.push(`${method} ${url.origin === API ? path : "outside isolated origins"}`);
      return route.abort();
    }
    expect(request.headers()["x-clauseiq-local"]).toBe("1");
    return route.continue(); // Deliberately no API mocking: real FastAPI and storage.
  });

  const get = async path => {
    const response = await context.request.get(`${API}/api/v1${path}`, { headers: { "X-ClauseIQ-Local": "1" } });
    expect(response.ok()).toBe(true);
    const result = await response.json();
    expect(result.success).toBe(true);
    return result.data;
  };
  expect((await get("/workspace")).has_api_key).toBe(false);
  expect((await get("/documents/")).documents).toEqual([]);
  expect(await get("/library/answers")).toEqual([]);
  await page.goto("/import");
  await page.locator('input[type="file"]').setInputFiles(PDF);
  await page.getByRole("button", { name: "Import agreement", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\?documentId=/);
  const id = new URL(page.url()).searchParams.get("documentId");
  await expect(page.getByRole("heading", { name: "Set up your review", exact: true })).toBeVisible();
  await expect(page.getByText("25 of 25 pages have extracted text.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start review", exact: true })).toBeDisabled();
  expect((await get(`/documents/${id}/review-workspace`)).runs).toEqual([]);
  await page.getByText("Try the synthetic example", { exact: true }).click();
  await page.getByRole("button", { name: "Load synthetic customer-perspective example", exact: true }).click();
  await page.getByRole("button", { name: "Findings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Clarify how service credits are earned", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Keep question", exact: true }).click();
  await page.getByRole("textbox", { name: /Question draft for/ }).fill(question);
  await page.getByRole("button", { name: "Save question", exact: true }).click();
  await expect.poll(async () => {
    const workspace = await get(`/documents/${id}/review-workspace`);
    return workspace.personal[workspace.runs[0].id]?.saved_questions["credit-bands"]?.text;
  }).toBe(question);
  await page.getByRole("button", { name: "My review (1 saved question)", exact: true }).click();
  await expect(page.getByText(question, { exact: true })).toBeVisible();
  // Clear browser preferences before reopening: saved wording must come from the
  // actual API/database, not retained component state or local browser storage.
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
  await page.getByRole("button", { name: "My review (1 saved question)", exact: true }).click();
  await expect(page.getByText(question, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.getByRole("link", { name: /managed-services-25p.pdf/ }).click();
  await page.getByRole("button", { name: "Findings", exact: true }).click();
  await page.getByRole("button", { name: "Preview excerpt · Archive pilot exception · page 24", exact: true }).click();
  await expect(page.locator("blockquote.cw-evidence-quote")).toContainText("Archive Service is twenty percent");
  await page.getByRole("button", { name: "View page 24", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "PDF page number", exact: true })).toHaveValue("24");
  const physicalPage = page.locator('.pdfViewer .page[data-page-number="24"]');
  await expect(physicalPage).toBeInViewport();
  await expect(physicalPage.locator("canvas")).toBeVisible();
  await expect(physicalPage.locator(".textLayer")).toContainText("Archive");
  await page.getByRole("button", { name: /Return to this finding$/ }).click();
  await expect(page.getByRole("heading", { name: "Clarify how service credits are earned", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.getByRole("button", { name: "Search contract text", exact: true }).click();
  await page.getByText("Saved Library answers", { exact: true }).click();
  await expect(page.getByText("No saved answer attempts yet.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Refresh saved status", exact: true }).click();
  const textSearch = page.getByRole("search");
  await textSearch.getByRole("searchbox", { name: "Search agreement text" }).fill("Staged export and verification");
  await textSearch.getByRole("button", { name: "Search text" }).click();
  const latePage = page.getByRole("list", { name: "Agreement text results" }).getByRole("link", { name: "View page 25" }).first();
  await expect(latePage).toBeVisible();
  const source = await get(`/documents/${id}/source`);
  const target = new URL(await latePage.getAttribute("href"), WEB);
  expect(target.searchParams.get("documentId")).toBe(id);
  expect(target.searchParams.get("sourceRevisionId")).toBe(source.source_revision_id);
  expect(target.searchParams.get("page")).toBe("25");
  expect(target.searchParams.has("query")).toBe(false);
  await latePage.click();
  await expect(page.getByRole("textbox", { name: "PDF page number", exact: true })).toHaveValue("25");
  const searchedPage = page.locator('.pdfViewer .page[data-page-number="25"]');
  await expect(searchedPage).toBeInViewport();
  await expect(searchedPage.locator(".textLayer")).toContainText("Staged export");
  expect(searchRequests).toEqual([{ query: "Staged export and verification", urlQuery: "" }]);

  const original = await context.request.get(`${API}/api/v1/documents/${id}/pdf`, { headers: { "X-ClauseIQ-Local": "1" } });
  expect(original.ok()).toBe(true);
  const hash = data => createHash("sha256").update(data).digest("hex");
  expect(hash(await original.body())).toBe(hash(await readFile(PDF)));
  const final = await get(`/documents/${id}/review-workspace`);
  expect(final.runs).toHaveLength(1);
  expect(final.runs[0].kind).toBe("fixture");
  expect(final.ask_turns).toEqual([]);
  expect((await get("/workspace")).has_api_key).toBe(false);
  expect(await get("/library/answers")).toEqual([]);
  expect(answerHistoryReads).toBeGreaterThanOrEqual(3);
  expect(forbidden, "Paid, unexpected and external browser requests must never dispatch").toEqual([]);
  expect(errors).toEqual([]);
});
