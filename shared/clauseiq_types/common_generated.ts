/**
 * Generated TypeScript interfaces from Python Pydantic models
 * Source: shared/clauseiq_types/common.py
 * This file is auto-generated. Do not edit directly.
 */

export enum ContractType {
  EMPLOYMENT = "employment",
  NDA = "nda",
  SERVICE_AGREEMENT = "service_agreement",
  LEASE = "lease",
  PURCHASE = "purchase",
  PARTNERSHIP = "partnership",
  LICENSE = "license",
  CONSULTING = "consulting",
  CONTRACTOR = "contractor",
  OTHER = "other",
}

export enum ClauseType {
  COMPENSATION = "compensation",
  TERMINATION = "termination",
  NON_COMPETE = "non_compete",
  BENEFITS = "benefits",
  WORKING_CONDITIONS = "working_conditions",
  PROBATION = "probation",
  CONFIDENTIALITY = "confidentiality",
  INTELLECTUAL_PROPERTY = "intellectual_property",
  DISPUTE_RESOLUTION = "dispute_resolution",
  LIABILITY = "liability",
  INDEMNIFICATION = "indemnification",
  FORCE_MAJEURE = "force_majeure",
  GOVERNING_LAW = "governing_law",
  DISCLOSURE_OBLIGATIONS = "disclosure_obligations",
  RETURN_OF_INFORMATION = "return_of_information",
  SCOPE_OF_WORK = "scope_of_work",
  DELIVERABLES = "deliverables",
  PAYMENT_TERMS = "payment_terms",
  SERVICE_LEVEL = "service_level",
  RENT = "rent",
  SECURITY_DEPOSIT = "security_deposit",
  MAINTENANCE = "maintenance",
  USE_RESTRICTIONS = "use_restrictions",
  GENERAL = "general",
}

export enum RiskLevel {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
}

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
  contract_type: ContractType | null;
  text: string | null;
  ai_full_summary: string | null;
  ai_structured_summary: Record<string, any> | null;
  sections: Section[] | null;
  clauses: Clause[] | null;
  risk_summary: RiskSummary | null;
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
