/**
 * Shared type definitions for ClauseIQ.
 * These types are shared between frontend and backend.
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
  // Employment-specific clauses
  COMPENSATION = "compensation",
  TERMINATION = "termination",
  NON_COMPETE = "non_compete",
  BENEFITS = "benefits",
  WORKING_CONDITIONS = "working_conditions",
  PROBATION = "probation",
  SEVERANCE = "severance",
  OVERTIME_PAY = "overtime_pay",
  VACATION_POLICY = "vacation_policy",
  STOCK_OPTIONS = "stock_options",
  BACKGROUND_CHECK = "background_check",

  // Universal clauses (applicable to multiple contract types)
  CONFIDENTIALITY = "confidentiality",
  INTELLECTUAL_PROPERTY = "intellectual_property",
  DISPUTE_RESOLUTION = "dispute_resolution",
  LIABILITY = "liability",
  INDEMNIFICATION = "indemnification",
  FORCE_MAJEURE = "force_majeure",
  GOVERNING_LAW = "governing_law",
  ASSIGNMENT_RIGHTS = "assignment_rights",
  AMENDMENT_PROCEDURES = "amendment_procedures",
  NOTICES = "notices",
  ENTIRE_AGREEMENT = "entire_agreement",
  SEVERABILITY = "severability",

  // NDA-specific clauses
  DISCLOSURE_OBLIGATIONS = "disclosure_obligations",
  RETURN_OF_INFORMATION = "return_of_information",
  DEFINITION_OF_CONFIDENTIAL = "definition_of_confidential",
  EXCEPTIONS_TO_CONFIDENTIALITY = "exceptions_to_confidentiality",
  DURATION_OF_OBLIGATIONS = "duration_of_obligations",

  // Service Agreement clauses
  SCOPE_OF_WORK = "scope_of_work",
  DELIVERABLES = "deliverables",
  PAYMENT_TERMS = "payment_terms",
  SERVICE_LEVEL = "service_level",
  WARRANTIES = "warranties",
  SERVICE_CREDITS = "service_credits",
  DATA_PROTECTION = "data_protection",
  THIRD_PARTY_SERVICES = "third_party_services",
  CHANGE_MANAGEMENT = "change_management",

  // Lease-specific clauses
  RENT = "rent",
  SECURITY_DEPOSIT = "security_deposit",
  MAINTENANCE = "maintenance",
  USE_RESTRICTIONS = "use_restrictions",
  UTILITIES = "utilities",
  PARKING = "parking",
  PET_POLICY = "pet_policy",
  SUBLETTING = "subletting",
  EARLY_TERMINATION = "early_termination",
  RENEWAL_OPTIONS = "renewal_options",
  PROPERTY_INSPECTION = "property_inspection",

  // Purchase/Sales Agreement clauses
  DELIVERY_TERMS = "delivery_terms",
  INSPECTION_RIGHTS = "inspection_rights",
  TITLE_TRANSFER = "title_transfer",
  RISK_OF_LOSS = "risk_of_loss",
  RETURNS_REFUNDS = "returns_refunds",

  // Generic/fallback
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
  // New required AI analysis fields (first-class)
  risk_reasoning: string; // explanation of why clause assessed at this risk level
  key_terms: string[]; // extracted decisive terms
  relationships: string[]; // relationships to other clauses / dependencies
  // Rewrite suggestion fields (optional)
  rewrite_suggestion?: string;
  rewrite_generated_at?: string;
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
