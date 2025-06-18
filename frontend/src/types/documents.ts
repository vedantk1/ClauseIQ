/**
 * Document-related TypeScript interfaces and types
 * Extracted from documents page for better type safety and reusability
 */

export interface DocumentItem {
  id: string;
  filename: string;
  upload_date: string;
  contract_type?: string;
}

export type ViewMode = "grid" | "list";

export type SortOption = "newest" | "oldest" | "name";

// Contract type color mapping type
export type ContractTypeColorMap = Record<string, string>;
