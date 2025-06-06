/**
 * Generated TypeScript interfaces from Python Pydantic models
 * Source: shared/clauseiq_types/common.py
 * This file is auto-generated. Do not edit directly.
 */

export interface AvailableModel {
  id?: string;
  name?: string;
  description?: string;
}

export interface BaseModel {
}

export interface Clause {
  id?: string;
  heading?: string;
  text?: string;
  clause_type?: ClauseType;
  risk_level?: RiskLevel;
  summary: string | null;
  risk_assessment: string | null;
  recommendations: string[] | null;
  key_points: string[] | null;
  position_start: number | null;
  position_end: number | null;
}

export interface Document {
  id?: string;
  filename?: string;
  upload_date?: string;
  text: string | null;
  ai_full_summary: string | null;
  sections: module.Section[] | null;
  clauses: module.Clause[] | null;
  risk_summary: module.RiskSummary | null;
  user_id?: string;
}

export interface RiskSummary {
  high?: number;
  medium?: number;
  low?: number;
}

export interface Section {
  heading?: string;
  text?: string;
  summary: string | null;
}

export interface User {
  id?: string;
  email?: string;
  full_name?: string;
  created_at?: string;
}

export interface UserPreferences {
  preferred_model?: string;
}
