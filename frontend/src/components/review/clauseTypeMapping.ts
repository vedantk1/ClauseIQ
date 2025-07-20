// Import shared enums instead of defining locally
import { ContractType, ClauseType } from "@clauseiq/shared-types";

/**
 * Maps contract types to their relevant clause types.
 * This mirrors the backend logic in backend/services/ai_service.py
 */

// Universal clauses applicable to most contracts
const UNIVERSAL_CLAUSE_TYPES = [
  ClauseType.CONFIDENTIALITY,
  ClauseType.INTELLECTUAL_PROPERTY,
  ClauseType.DISPUTE_RESOLUTION,
  ClauseType.LIABILITY,
  ClauseType.INDEMNIFICATION,
  ClauseType.FORCE_MAJEURE,
  ClauseType.GOVERNING_LAW,
  ClauseType.ASSIGNMENT_RIGHTS,
  ClauseType.AMENDMENT_PROCEDURES,
  ClauseType.NOTICES,
  ClauseType.ENTIRE_AGREEMENT,
  ClauseType.SEVERABILITY,
  ClauseType.GENERAL,
];

// Contract-specific clause types
const CONTRACT_SPECIFIC_CLAUSE_TYPES: Record<ContractType, ClauseType[]> = {
  [ContractType.EMPLOYMENT]: [
    ClauseType.COMPENSATION,
    ClauseType.TERMINATION,
    ClauseType.NON_COMPETE,
    ClauseType.BENEFITS,
    ClauseType.WORKING_CONDITIONS,
    ClauseType.PROBATION,
    ClauseType.SEVERANCE,
    ClauseType.OVERTIME_PAY,
    ClauseType.VACATION_POLICY,
    ClauseType.STOCK_OPTIONS,
    ClauseType.BACKGROUND_CHECK,
  ],
  [ContractType.NDA]: [
    ClauseType.DISCLOSURE_OBLIGATIONS,
    ClauseType.RETURN_OF_INFORMATION,
    ClauseType.DEFINITION_OF_CONFIDENTIAL,
    ClauseType.EXCEPTIONS_TO_CONFIDENTIALITY,
    ClauseType.DURATION_OF_OBLIGATIONS,
  ],
  [ContractType.SERVICE_AGREEMENT]: [
    ClauseType.SCOPE_OF_WORK,
    ClauseType.DELIVERABLES,
    ClauseType.PAYMENT_TERMS,
    ClauseType.SERVICE_LEVEL,
    ClauseType.WARRANTIES,
    ClauseType.SERVICE_CREDITS,
    ClauseType.DATA_PROTECTION,
    ClauseType.THIRD_PARTY_SERVICES,
    ClauseType.CHANGE_MANAGEMENT,
  ],
  [ContractType.CONSULTING]: [
    ClauseType.SCOPE_OF_WORK,
    ClauseType.DELIVERABLES,
    ClauseType.PAYMENT_TERMS,
    ClauseType.SERVICE_LEVEL,
  ],
  [ContractType.CONTRACTOR]: [
    ClauseType.SCOPE_OF_WORK,
    ClauseType.DELIVERABLES,
    ClauseType.PAYMENT_TERMS,
    ClauseType.TERMINATION,
  ],
  [ContractType.LEASE]: [
    ClauseType.RENT,
    ClauseType.SECURITY_DEPOSIT,
    ClauseType.MAINTENANCE,
    ClauseType.USE_RESTRICTIONS,
    ClauseType.UTILITIES,
    ClauseType.PARKING,
    ClauseType.PET_POLICY,
    ClauseType.SUBLETTING,
    ClauseType.EARLY_TERMINATION,
    ClauseType.RENEWAL_OPTIONS,
    ClauseType.PROPERTY_INSPECTION,
  ],
  [ContractType.PURCHASE]: [
    ClauseType.DELIVERY_TERMS,
    ClauseType.INSPECTION_RIGHTS,
    ClauseType.TITLE_TRANSFER,
    ClauseType.RISK_OF_LOSS,
    ClauseType.RETURNS_REFUNDS,
  ],
  [ContractType.PARTNERSHIP]: [
    ClauseType.SCOPE_OF_WORK,
    ClauseType.PAYMENT_TERMS,
    ClauseType.TERMINATION,
  ],
  [ContractType.LICENSE]: [
    ClauseType.SCOPE_OF_WORK,
    ClauseType.PAYMENT_TERMS,
    ClauseType.TERMINATION,
  ],
  [ContractType.OTHER]: [],
};

/**
 * Get relevant clause types for a specific contract type
 */
export function getRelevantClauseTypes(contractType?: string): ClauseType[] {
  if (!contractType) {
    // If no contract type, return all possible clause types
    return [
      ...UNIVERSAL_CLAUSE_TYPES,
      ...Object.values(CONTRACT_SPECIFIC_CLAUSE_TYPES).flat(),
    ].filter((type, index, arr) => arr.indexOf(type) === index); // Remove duplicates
  }

  // Use the contractType directly as it comes from the backend (e.g., "lease", "employment")
  // The enum values match the backend values
  const contractTypeValue = contractType.toLowerCase() as ContractType;

  const specificClauses =
    CONTRACT_SPECIFIC_CLAUSE_TYPES[contractTypeValue] || [];

  const result = [...specificClauses, ...UNIVERSAL_CLAUSE_TYPES];

  return result;
}

/**
 * Get clause type options for dropdown UI
 */
export function getClauseTypeOptions(
  contractType?: string
): Array<{ value: string; label: string }> {
  const relevantTypes = getRelevantClauseTypes(contractType);

  // Convert clause types to dropdown options
  const options = relevantTypes.map((type) => ({
    value: type,
    label: getClauseTypeDisplayName(type),
  }));

  // Sort options alphabetically by label
  options.sort((a, b) => a.label.localeCompare(b.label));

  // Add "All Types" option at the beginning
  const finalOptions = [{ value: "all", label: "All Types" }, ...options];

  return finalOptions;
}

/**
 * Get display name for clause type
 */
export function getClauseTypeDisplayName(type: ClauseType): string {
  const displayNames: Record<ClauseType, string> = {
    // Employment-specific clauses
    [ClauseType.COMPENSATION]: "Compensation",
    [ClauseType.TERMINATION]: "Termination",
    [ClauseType.NON_COMPETE]: "Non-Compete",
    [ClauseType.BENEFITS]: "Benefits",
    [ClauseType.WORKING_CONDITIONS]: "Working Conditions",
    [ClauseType.PROBATION]: "Probation",
    [ClauseType.SEVERANCE]: "Severance",
    [ClauseType.OVERTIME_PAY]: "Overtime Pay",
    [ClauseType.VACATION_POLICY]: "Vacation Policy",
    [ClauseType.STOCK_OPTIONS]: "Stock Options",
    [ClauseType.BACKGROUND_CHECK]: "Background Check",

    // Universal clauses
    [ClauseType.CONFIDENTIALITY]: "Confidentiality",
    [ClauseType.INTELLECTUAL_PROPERTY]: "Intellectual Property",
    [ClauseType.DISPUTE_RESOLUTION]: "Dispute Resolution",
    [ClauseType.LIABILITY]: "Liability",
    [ClauseType.INDEMNIFICATION]: "Indemnification",
    [ClauseType.FORCE_MAJEURE]: "Force Majeure",
    [ClauseType.GOVERNING_LAW]: "Governing Law",
    [ClauseType.ASSIGNMENT_RIGHTS]: "Assignment Rights",
    [ClauseType.AMENDMENT_PROCEDURES]: "Amendment Procedures",
    [ClauseType.NOTICES]: "Notices",
    [ClauseType.ENTIRE_AGREEMENT]: "Entire Agreement",
    [ClauseType.SEVERABILITY]: "Severability",

    // NDA-specific clauses
    [ClauseType.DISCLOSURE_OBLIGATIONS]: "Disclosure Obligations",
    [ClauseType.RETURN_OF_INFORMATION]: "Return of Information",
    [ClauseType.DEFINITION_OF_CONFIDENTIAL]:
      "Definition of Confidential Information",
    [ClauseType.EXCEPTIONS_TO_CONFIDENTIALITY]: "Exceptions to Confidentiality",
    [ClauseType.DURATION_OF_OBLIGATIONS]: "Duration of Obligations",

    // Service Agreement clauses
    [ClauseType.SCOPE_OF_WORK]: "Scope of Work",
    [ClauseType.DELIVERABLES]: "Deliverables",
    [ClauseType.PAYMENT_TERMS]: "Payment Terms",
    [ClauseType.SERVICE_LEVEL]: "Service Level Agreement",
    [ClauseType.WARRANTIES]: "Warranties",
    [ClauseType.SERVICE_CREDITS]: "Service Credits",
    [ClauseType.DATA_PROTECTION]: "Data Protection",
    [ClauseType.THIRD_PARTY_SERVICES]: "Third Party Services",
    [ClauseType.CHANGE_MANAGEMENT]: "Change Management",

    // Lease-specific clauses
    [ClauseType.RENT]: "Rent",
    [ClauseType.SECURITY_DEPOSIT]: "Security Deposit",
    [ClauseType.MAINTENANCE]: "Maintenance",
    [ClauseType.USE_RESTRICTIONS]: "Use Restrictions",
    [ClauseType.UTILITIES]: "Utilities",
    [ClauseType.PARKING]: "Parking",
    [ClauseType.PET_POLICY]: "Pet Policy",
    [ClauseType.SUBLETTING]: "Subletting",
    [ClauseType.EARLY_TERMINATION]: "Early Termination",
    [ClauseType.RENEWAL_OPTIONS]: "Renewal Options",
    [ClauseType.PROPERTY_INSPECTION]: "Property Inspection",

    // Purchase/Sales Agreement clauses
    [ClauseType.DELIVERY_TERMS]: "Delivery Terms",
    [ClauseType.INSPECTION_RIGHTS]: "Inspection Rights",
    [ClauseType.TITLE_TRANSFER]: "Title Transfer",
    [ClauseType.RISK_OF_LOSS]: "Risk of Loss",
    [ClauseType.RETURNS_REFUNDS]: "Returns & Refunds",

    // Generic/fallback
    [ClauseType.GENERAL]: "General",
  };

  return displayNames[type] || type;
}
