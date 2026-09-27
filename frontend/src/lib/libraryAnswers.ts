import apiClient from "@/lib/api";
import type { LibrarySearchCoverage } from "@/lib/librarySearch";

export interface AnswerEvidence {
  id: string;
  document_id: string;
  filename: string;
  source_revision_id: string;
  page_number: number;
  passage_id: string;
  quote: string;
  source_incomplete: boolean;
  continuation_before: boolean;
  continuation_after: boolean;
}
export interface AnswerGeneration {
  model_id: string;
  reasoning_effort: string;
  max_completion_tokens: number;
  estimated_input_tokens: number;
  prompt_version: string;
  evidence_sha256: string;
  duration_ms: number | null;
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
}
export interface AnswerPlan {
  context_id: string;
  question: string;
  method: "keyword" | "semantic";
  evidence: AnswerEvidence[];
  coverage: LibrarySearchCoverage;
  generation: AnswerGeneration;
}
export type AnswerStatus = "processing" | "completed" | "interrupted" | "failed" | "failed_or_unknown" | "source_unavailable";
export interface AnswerSummary {
  request_id: string;
  question?: string;
  created_at: string;
  status: AnswerStatus;
  outcome: "answered" | "partial" | "insufficient_evidence" | null;
}
export interface LibraryAnswer extends AnswerSummary, Omit<AnswerPlan, "question"> {
  statements: { text: string; evidence_ids: string[] }[];
  limitations: string[];
  failure: string | null;
}

export async function previewLibraryAnswer(contextId: string): Promise<AnswerPlan> {
  const response = await apiClient.post<AnswerPlan>("/library/answers/preview", { context_id: contextId });
  if (!response.success || !response.data) throw new Error(response.error?.message || "Answer preview is unavailable.");
  return response.data;
}
export async function startLibraryAnswer(plan: AnswerPlan, requestId: string): Promise<LibraryAnswer> {
  const response = await apiClient.post<LibraryAnswer>("/library/answers", {
    context_id: plan.context_id, request_id: requestId, model_id: plan.generation.model_id,
    reasoning_effort: plan.generation.reasoning_effort, confirm_paid: true,
  }, { timeout: 190000 });
  if (!response.success || !response.data) throw new Error(response.error?.message || "The answer outcome is unknown. Refresh saved answers before another paid request.");
  return response.data;
}
export async function recentLibraryAnswers(): Promise<AnswerSummary[]> {
  const response = await apiClient.get<AnswerSummary[]>("/library/answers", undefined, { timeout: 10000 });
  if (!response.success || !response.data) throw new Error(response.error?.message || "Saved answers are unavailable.");
  return response.data;
}
export async function readLibraryAnswer(id: string): Promise<LibraryAnswer> {
  const response = await apiClient.get<LibraryAnswer>(`/library/answers/${encodeURIComponent(id)}`, undefined, { timeout: 10000 });
  if (!response.success || !response.data) throw new Error(response.error?.message || "This answer's saved status is unavailable.");
  return response.data;
}
export async function interruptLibraryAnswer(id: string): Promise<LibraryAnswer> {
  const response = await apiClient.post<LibraryAnswer>(`/library/answers/${encodeURIComponent(id)}/interrupt`, {});
  if (!response.success || !response.data) throw new Error(response.error?.message || "Interruption could not be saved.");
  return response.data;
}

/** The UI never infers a claim-to-source mapping from prose or array position. */
export function statementEvidence(answer: LibraryAnswer, ids: string[]): AnswerEvidence[] | null {
  const evidence = ids.map(id => answer.evidence.find(item => item.id === id));
  if (!ids.length || new Set(ids).size !== ids.length || evidence.some(item => !item)) return null;
  return evidence as AnswerEvidence[];
}
