/**
 * Generated TypeScript interfaces from Python Pydantic models
 * Source: shared/clauseiq_types/common.py
 * This file is auto-generated. Do not edit directly.
 */

import { ClauseType, RiskLevel, ContractType } from "./common";

export interface AvailableModel {
  id?: str;
  name?: str;
  description?: str;
}

export interface BaseModel {
}

export interface Clause {
  id?: str;
  heading?: str;
  text?: str;
  clause_type?: ClauseType;
  risk_level?: RiskLevel;
  risk_assessment?: str | null;
  recommendations?: str[] | null;
  key_points?: str[] | null;
  position_start?: int | null;
  position_end?: int | null;
  risk_reasoning?: str;
  key_terms?: str[];
  relationships?: str[];
}

export interface Document {
  id?: str;
  filename?: str;
  upload_date?: str;
  contract_type?: ContractType | null;
  text?: str | null;
  ai_full_summary?: str | null;
  ai_structured_summary?: Record<str, Any> | null;
  clauses?: Clause[] | null;
  risk_summary?: RiskSummary | null;
  user_id?: str;
  user_interactions?: Record<str, UserInteraction> | null;
  last_viewed?: str | null;
}

export interface Note {
  id?: str;
  text?: str;
  created_at?: str;
}

export interface RiskSummary {
  high?: int;
  medium?: int;
  low?: int;
}

export interface User {
  id?: str;
  email?: str;
  full_name?: str;
  created_at?: str;
}

export interface UserInteraction {
  clause_id?: str;
  user_id?: str;
  notes?: Note[];
  is_flagged?: bool;
  created_at?: str;
  updated_at?: str;
}

export interface UserInteractions {
  document_id?: str;
  user_id?: str;
  interactions?: Record<str, UserInteraction>;
}

export interface UserPreferences {
  preferred_model?: str;
}
