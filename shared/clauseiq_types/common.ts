/**
 * Shared type definitions for ClauseIQ.
 * These types are shared between frontend and backend.
 */

export enum ClauseType {
  COMPENSATION = "compensation",
  TERMINATION = "termination",
  NON_COMPETE = "non_compete",
  CONFIDENTIALITY = "confidentiality",
  BENEFITS = "benefits",
  WORKING_CONDITIONS = "working_conditions",
  INTELLECTUAL_PROPERTY = "intellectual_property",
  DISPUTE_RESOLUTION = "dispute_resolution",
  PROBATION = "probation",
  GENERAL = "general",
}

export enum RiskLevel {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
}

export interface Section {
  heading: string;
  text: string;
  summary?: string;
}

export interface Clause {
  id: string;
  heading: string;
  text: string;
  clause_type: ClauseType;
  risk_level: RiskLevel;
  summary?: string;
  risk_assessment?: string;
  recommendations?: string[];
  key_points?: string[];
  position_start?: number;
  position_end?: number;
}

export interface RiskSummary {
  high: number;
  medium: number;
  low: number;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
}

export interface UserPreferences {
  preferred_model: string;
}

export interface AvailableModel {
  id: string;
  name: string;
  description: string;
}
