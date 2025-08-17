/**
 * ClauseIQ Shared Types - Main Export File
 * This file provides a clean interface for importing shared types.
 */

// Export from manually maintained TypeScript types (primary source for enums)
export * from "./clauseiq_types/common";

// Export from generated TypeScript types (interfaces only)
export type {
  RiskSummary,
  User,
  UserPreferences,
  AvailableModel,
  Document,
  Note,
  UserInteraction,
  UserInteractions,
} from "./clauseiq_types/common_generated";

// Use the manually maintained Clause interface (stricter required fields)
export type { Clause } from "./clauseiq_types/common";

// Re-export commonly used types for convenience
export type { RiskLevel, Section } from "./clauseiq_types/common";
