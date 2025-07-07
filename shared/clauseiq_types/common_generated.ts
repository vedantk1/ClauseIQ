/**
 * Generated TypeScript interfaces from Python Pydantic models
 * Source: shared/clauseiq_types/common.py
 * This file is auto-generated. Do not edit directly.
 */

import { ClauseType, RiskLevel, ContractType } from "./common";

export interface AvailableModel {
  id?: string;
  name?: string;
  description?: string;
}

export interface BaseModel {}

export interface Clause {
  id?: string;
  heading?: string;
  text?: string;
  clause_type?: ClauseType;
  risk_level?: RiskLevel;
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
  contract_type: ContractType | null;
  text: string | null;
  ai_full_summary: string | null;
  ai_structured_summary: Record<string, any> | null;
  clauses: Clause[] | null;
  risk_summary: RiskSummary | null;
  user_id?: string;
  user_interactions: Record<string, UserInteraction> | null;
}

export interface Note {
  id?: string;
  text?: string;
  created_at?: string;
}

export interface RiskSummary {
  high?: number;
  medium?: number;
  low?: number;
}

export interface User {
  id?: string;
  email?: string;
  full_name?: string;
  created_at?: string;
}

export interface UserInteraction {
  clause_id?: string;
  user_id?: string;
  notes?: Note[];
  is_flagged?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface UserInteractions {
  document_id?: string;
  user_id?: string;
  interactions?: Record<string, UserInteraction>;
}

export interface UserPreferences {
  preferred_model?: string;
}
