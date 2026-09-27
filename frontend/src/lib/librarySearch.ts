import type { DocumentSourceResponse } from "@clauseiq/shared-types";
import apiClient from "@/lib/api";

export interface LibrarySearchHit {
  document_id: string;
  filename: string;
  source_revision_id: string;
  page_number: number;
  passage_id: string;
  excerpt: string;
  excerpt_partial: boolean;
  source_incomplete: boolean;
}

export interface LibrarySearchCoverage {
  documents_in_library: number;
  documents_scanned: number;
  documents_not_examined: number;
  documents_searchable: number;
  documents_unsearchable: number;
  documents_partial: number;
  passages_examined: number;
  matched_passages: number;
  results_truncated: boolean;
  scan_truncated: boolean;
}

export interface LibrarySearchResult {
  results: LibrarySearchHit[];
  coverage: LibrarySearchCoverage;
  answer_context_id?: string | null;
}

export interface LibrarySourceTarget {
  sourceRevisionId: string;
  pageNumber: number;
}

export type ParsedLibrarySourceTarget =
  | { kind: "none" }
  | { kind: "invalid"; message: string }
  | { kind: "target"; target: LibrarySourceTarget };

/** The query is sent only in the POST body, never in a route, log or bookmark. */
export async function searchAgreementText(query: string): Promise<LibrarySearchResult> {
  const response = await apiClient.post<LibrarySearchResult>("/library/search", { query });
  if (!response.success) throw new Error(response.error?.message || "Agreement text search failed.");
  if (!Array.isArray(response.data?.results) || !response.data?.coverage) {
    throw new Error("Agreement text search returned an unexpected response.");
  }
  return response.data;
}

export function librarySearchHitHref(hit: LibrarySearchHit): string | null {
  if (typeof hit.document_id !== "string" || !hit.document_id.trim() ||
    typeof hit.source_revision_id !== "string" || !hit.source_revision_id.trim() ||
    !Number.isSafeInteger(hit.page_number) || hit.page_number < 1) return null;
  return `/workspace?documentId=${encodeURIComponent(hit.document_id)}&sourceRevisionId=${encodeURIComponent(hit.source_revision_id)}&page=${hit.page_number}&from=library-search`;
}

/** Missing or malformed source targets must never become an ordinary bookmark restore. */
export function parseLibrarySourceTarget(params: Pick<URLSearchParams, "get">): ParsedLibrarySourceTarget {
  const revision = params.get("sourceRevisionId");
  const page = params.get("page");
  if (revision === null && page === null) return { kind: "none" };
  if (!revision?.trim() || revision.length > 256 || !page || !/^[1-9]\d*$/.test(page)) {
    return { kind: "invalid", message: "This search link has an invalid source page. Open the agreement from Library instead." };
  }
  const pageNumber = Number(page);
  if (!Number.isSafeInteger(pageNumber)) {
    return { kind: "invalid", message: "This search link has an invalid source page. Open the agreement from Library instead." };
  }
  return { kind: "target", target: { sourceRevisionId: revision, pageNumber } };
}

/** A saved result can only open the exact revision and physical page it described. */
export function librarySourceTargetError(target: LibrarySourceTarget, source: DocumentSourceResponse): string | null {
  if (!source.source_revision_id || source.source_revision_id !== target.sourceRevisionId) {
    return "This search result refers to an earlier source revision. No page jump was made.";
  }
  const extraction = source.source_extraction;
  if (!extraction || !Number.isSafeInteger(extraction.page_count) || target.pageNumber > extraction.page_count ||
    !extraction.pages.some(page => page.page_number === target.pageNumber)) {
    return "This search result's source page is no longer available. No page jump was made.";
  }
  return null;
}
