/**
 * ClauseIQ Shared Types - Main Export File
 * This file provides a clean interface for importing shared types.
 */

// Export from generated TypeScript types
export * from "./clauseiq_types/common_generated";

// Export from manually maintained TypeScript types (for compatibility)
export * from "./clauseiq_types/common";

// Re-export commonly used types for convenience
export type {
  ClauseType,
  RiskLevel,
  Clause,
  Section,
  RiskSummary,
  User,
  UserPreferences,
  AvailableModel,
} from "./clauseiq_types/common_generated";

// Export validation utilities if they exist
export * from "./clauseiq_types/validation";
