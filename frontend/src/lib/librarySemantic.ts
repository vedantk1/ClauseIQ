import apiClient from "@/lib/api";
import type { LibrarySearchResult } from "@/lib/librarySearch";

export interface SemanticDocument {
  document_id: string;
  filename: string;
  generation_id: string | null;
  status: "not_indexed" | "ready" | "processing" | "interrupted" | "failed" | "stale" | "missing_vectors" | "unavailable";
  indexed_at: string | null;
  partial: boolean;
  passages: number;
  excluded_headers: number;
  failure: string | null;
}
export interface SemanticStatus {
  model: string;
  documents: SemanticDocument[];
  documents_in_library: number;
  documents_not_examined: number;
  indexed_documents: number;
}
export interface IndexPlan {
  document_id: string;
  filename: string;
  fingerprint: string;
  expected_generation: string | null;
  source_revision_id: string;
  model: string;
  passages: number;
  excluded_headers: number;
  partial: boolean;
  input_tokens: number;
  estimated_usd: string;
  maximum_usd: string;
}

function documentPath(id: string) { return `/library/semantic/documents/${encodeURIComponent(id)}`; }

export async function semanticStatus(): Promise<SemanticStatus> {
  const response = await apiClient.get<SemanticStatus>("/library/semantic/status");
  if (!response.success || !response.data) throw new Error(response.error?.message || "Index status is unavailable.");
  return response.data;
}
export async function previewIndex(id: string): Promise<IndexPlan> {
  const response = await apiClient.post<IndexPlan>(`${documentPath(id)}/plan`, {});
  if (!response.success || !response.data) throw new Error(response.error?.message || "Index preview is unavailable.");
  return response.data;
}
export async function indexAgreement(plan: IndexPlan, requestId: string): Promise<SemanticDocument> {
  const response = await apiClient.post<SemanticDocument>(`${documentPath(plan.document_id)}/index`, {
    request_id: requestId, fingerprint: plan.fingerprint, expected_generation: plan.expected_generation, confirm_paid: true,
  }, { timeout: 120000 });
  if (!response.success || !response.data) throw new Error(response.error?.message || "Indexing outcome is unknown. Refresh status before another paid attempt.");
  return response.data;
}
export async function removeIndex(document: SemanticDocument): Promise<void> {
  const response = await apiClient.post(`${documentPath(document.document_id)}/remove`, { expected_generation: document.generation_id });
  if (!response.success) throw new Error(response.error?.message || "Index cleanup is not confirmed.");
}
export async function searchSemantic(query: string, requestId: string): Promise<LibrarySearchResult> {
  const response = await apiClient.post<LibrarySearchResult>("/library/semantic/search", {
    query, request_id: requestId, confirm_paid: true, limit: 5,
  }, { timeout: 90000 });
  if (!response.success || !response.data) throw new Error(response.error?.message || "Semantic search failed. The request may have incurred a charge.");
  return response.data;
}
