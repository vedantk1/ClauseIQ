import React from "react";

// Utility functions for clause handling
export const getRiskColor = (level?: string) => {
  switch (level) {
    case "high":
      return "text-accent-rose bg-accent-rose/10 border-accent-rose/20";
    case "medium":
      return "text-accent-amber bg-accent-amber/10 border-accent-amber/20";
    case "low":
      return "text-accent-green bg-accent-green/10 border-accent-green/20";
    default:
      return "text-text-secondary bg-bg-elevated border-border-muted";
  }
};

export const getClauseTypeLabel = (type?: string) => {
  const labels: Record<string, string> = {
    // Employment-specific clauses
    compensation: "Compensation",
    termination: "Termination",
    non_compete: "Non-Compete",
    benefits: "Benefits",
    working_conditions: "Working Conditions",
    probation: "Probation",
    severance: "Severance",
    overtime_pay: "Overtime Pay",
    vacation_policy: "Vacation Policy",
    stock_options: "Stock Options",
    background_check: "Background Check",

    // Universal clauses (applicable to multiple contract types)
    confidentiality: "Confidentiality",
    intellectual_property: "Intellectual Property",
    dispute_resolution: "Dispute Resolution",
    liability: "Liability",
    indemnification: "Indemnification",
    force_majeure: "Force Majeure",
    governing_law: "Governing Law",
    assignment_rights: "Assignment Rights",
    amendment_procedures: "Amendment Procedures",
    notices: "Notices",
    entire_agreement: "Entire Agreement",
    severability: "Severability",

    // NDA-specific clauses
    disclosure_obligations: "Disclosure Obligations",
    return_of_information: "Return of Information",
    definition_of_confidential: "Definition of Confidential Information",
    exceptions_to_confidentiality: "Exceptions to Confidentiality",
    duration_of_obligations: "Duration of Obligations",

    // Service Agreement clauses
    scope_of_work: "Scope of Work",
    deliverables: "Deliverables",
    payment_terms: "Payment Terms",
    service_level: "Service Level Agreement",
    warranties: "Warranties",
    service_credits: "Service Credits",
    data_protection: "Data Protection",
    third_party_services: "Third Party Services",
    change_management: "Change Management",

    // Lease-specific clauses
    rent: "Rent",
    security_deposit: "Security Deposit",
    maintenance: "Maintenance",
    use_restrictions: "Use Restrictions",
    utilities: "Utilities",
    parking: "Parking",
    pet_policy: "Pet Policy",
    subletting: "Subletting",
    early_termination: "Early Termination",
    renewal_options: "Renewal Options",
    property_inspection: "Property Inspection",

    // Purchase/Sales Agreement clauses
    delivery_terms: "Delivery Terms",
    inspection_rights: "Inspection Rights",
    title_transfer: "Title Transfer",
    risk_of_loss: "Risk of Loss",
    returns_refunds: "Returns & Refunds",

    // Generic/fallback
    general: "General",
  };
  return labels[type || ""] || type || "Unknown";
};

// Token highlighting patterns for legal documents
const LEGAL_TOKEN_PATTERNS = {
  // Money patterns - simple and working
  money:
    /[$£€]\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s?(?:USD|GBP|EUR)\b/gi,

  // Time periods - comprehensive patterns
  timeWithNumber:
    /\b\d+(?:\.\d+)?\s?(?:business\s+days?|working\s+days?|calendar\s+days?|days?|weeks?|months?|years?|hrs?|hours?|minutes?|mins?)\b/gi,

  // Percentage patterns
  percentage: /\d+(?:\.\d+)?\s?%|\d+(?:\.\d+)?\s?(?:percent|per\s+cent)\b/gi,

  // Date ranges and deadlines
  dateRange:
    /\b\d+\s?[-–—]\s?\d+\s?(?:business\s+days?|working\s+days?|calendar\s+days?|days?|weeks?|months?|years?)\b/gi,

  // Interest rates and financial terms
  financialTerms:
    /\b\d+(?:\.\d+)?\s?(?:per\s+annum|p\.a\.|annually|monthly|quarterly|basis\s+points?|bps)\b/gi,
};

// Token highlighting utility for legal content
export const highlightLegalTokens = (text: string): React.ReactNode => {
  // Track positions to avoid overlapping highlights
  const tokenPositions: Array<{ start: number; end: number; type: string }> =
    [];

  // Find all token matches
  Object.entries(LEGAL_TOKEN_PATTERNS).forEach(([type, pattern]) => {
    const matches = Array.from(text.matchAll(pattern));
    matches.forEach((match) => {
      if (match.index !== undefined) {
        tokenPositions.push({
          start: match.index,
          end: match.index + match[0].length,
          type,
        });
      }
    });
  });

  // Sort by position and remove overlaps
  tokenPositions.sort((a, b) => a.start - b.start);
  const filteredPositions = tokenPositions.filter((pos, index) => {
    // Remove overlapping tokens (keep the first one)
    return index === 0 || pos.start >= tokenPositions[index - 1].end;
  });

  if (filteredPositions.length === 0) {
    return text;
  }

  // Split text and wrap tokens
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  filteredPositions.forEach((pos, index) => {
    // Add text before token
    if (pos.start > lastIndex) {
      parts.push(text.slice(lastIndex, pos.start));
    }

    // Add highlighted token
    const tokenText = text.slice(pos.start, pos.end);
    const tokenClass = getTokenClassName();

    parts.push(
      <span
        key={`token-${index}`}
        className={tokenClass}
        title={`Legal token: ${pos.type}`}
        aria-label={`Important ${pos.type}: ${tokenText}`}
      >
        {tokenText}
      </span>
    );

    lastIndex = pos.end;
  });

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts}</>;
};

// Get CSS class for token type
const getTokenClassName = (): string => {
  // Use a single, subtle purple accent that matches the UI theme
  return "font-semibold text-purple-300 border-b border-purple-300/40 border-dotted";
};

// Combined highlighting: tokens first, then search highlighting
export const highlightTextWithTokensAndSearch = (
  text: string,
  searchQuery: string
): React.ReactNode => {
  // First apply token highlighting
  const tokenHighlighted = highlightLegalTokens(text);

  // If no search query, return token-highlighted text
  if (!searchQuery.trim()) {
    return tokenHighlighted;
  }

  // For search highlighting on token-highlighted content, we need to process differently
  // Convert the token-highlighted content back to searchable format
  const searchRegex = new RegExp(
    `(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
    "gi"
  );

  // If the token highlighting produced only a string, apply search highlighting
  if (typeof tokenHighlighted === "string") {
    const parts = tokenHighlighted.split(searchRegex);
    return parts.map((part, index) =>
      searchRegex.test(part) ? (
        <mark
          key={`search-${index}`}
          className="bg-accent-purple/20 text-accent-purple rounded px-1"
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  }

  // For complex token-highlighted content, apply search highlighting to the original text
  // and let token highlighting take precedence in non-overlapping areas
  const searchParts = text.split(searchRegex);
  const hasSearchMatch = searchParts.length > 1;

  if (hasSearchMatch) {
    // If search matches exist, prioritize search highlighting and apply token highlighting to non-search parts
    return searchParts.map((part, index) =>
      searchRegex.test(part) ? (
        <mark
          key={`search-${index}`}
          className="bg-accent-purple/20 text-accent-purple rounded px-1 font-semibold"
        >
          {part}
        </mark>
      ) : (
        <span key={`part-${index}`}>{highlightLegalTokens(part)}</span>
      )
    );
  }

  return tokenHighlighted;
};

// Legacy function for backward compatibility
export const highlightSearchText = (
  text: string,
  query: string
): React.ReactNode => {
  return highlightTextWithTokensAndSearch(text, query);
};
