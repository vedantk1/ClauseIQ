/**
 * Zod schema generators for shared types.
 * This module provides functions that generate Zod validation schemas for our shared types.
 */
import { z } from "zod";
import {
  ClauseType,
  RiskLevel,
  Section,
  Clause,
  RiskSummary,
  User,
  UserPreferences,
  AvailableModel,
} from "./common";

/**
 * Create a Zod enum schema from string enum values
 */
export function createEnumSchema<T extends string>(enumValues: readonly T[]) {
  return z.enum(enumValues as [T, ...T[]]);
}

// Define Zod schemas for shared types
export const clauseTypeSchema = z.enum([
  "compensation",
  "termination",
  "non_compete",
  "confidentiality",
  "benefits",
  "working_conditions",
  "intellectual_property",
  "dispute_resolution",
  "probation",
  "general",
] as const);

export const riskLevelSchema = z.enum(["low", "medium", "high"] as const);

export const sectionSchema = z.object({
  heading: z.string(),
  text: z.string(),
  summary: z.string().optional(),
});

export const clauseSchema = z.object({
  id: z.string(),
  heading: z.string(),
  text: z.string(),
  clause_type: clauseTypeSchema,
  risk_level: riskLevelSchema,
  summary: z.string().optional(),
  risk_assessment: z.string().optional(),
  recommendations: z.array(z.string()).optional(),
  key_points: z.array(z.string()).optional(),
  position_start: z.number().optional(),
  position_end: z.number().optional(),
});

export const riskSummarySchema = z.object({
  high: z.number(),
  medium: z.number(),
  low: z.number(),
});

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  full_name: z.string(),
  created_at: z.string(),
});

export const userPreferencesSchema = z.object({
  preferred_model: z.string(),
});

export const availableModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
});

/**
 * Type-safe validators
 */
export const validateSection = (data: unknown): Section =>
  sectionSchema.parse(data);
export const validateClause = (data: unknown): Clause =>
  clauseSchema.parse(data);
export const validateRiskSummary = (data: unknown): RiskSummary =>
  riskSummarySchema.parse(data);
export const validateUser = (data: unknown): User => userSchema.parse(data);
export const validateUserPreferences = (data: unknown): UserPreferences =>
  userPreferencesSchema.parse(data);
export const validateAvailableModel = (data: unknown): AvailableModel =>
  availableModelSchema.parse(data);

// Lists
export const validateSections = (data: unknown): Section[] =>
  z.array(sectionSchema).parse(data);
export const validateClauses = (data: unknown): Clause[] =>
  z.array(clauseSchema).parse(data);
export const validateAvailableModels = (data: unknown): AvailableModel[] =>
  z.array(availableModelSchema).parse(data);
