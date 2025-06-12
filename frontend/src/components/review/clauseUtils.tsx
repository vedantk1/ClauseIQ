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
    compensation: "Compensation",
    termination: "Termination",
    non_compete: "Non-Compete",
    confidentiality: "Confidentiality",
    benefits: "Benefits",
    working_conditions: "Working Conditions",
    intellectual_property: "Intellectual Property",
    dispute_resolution: "Dispute Resolution",
    probation: "Probation",
    general: "General",
  };
  return labels[type || ""] || type || "Unknown";
};

export const getClauseNegotiability = (clauseType?: string) => {
  const negotiabilityMap: Record<string, string> = {
    compensation: "High",
    termination: "Medium",
    non_compete: "High",
    confidentiality: "Low",
    benefits: "Medium",
    working_conditions: "Medium",
    intellectual_property: "Low",
    dispute_resolution: "Medium",
    probation: "Low",
    general: "Medium",
  };
  return negotiabilityMap[clauseType || ""] || "Medium";
};

export const getIndustryBenchmark = (
  clauseType?: string,
  riskLevel?: string
) => {
  const benchmarks: Record<string, Record<string, string>> = {
    termination: {
      high: "This termination clause is more restrictive than 85% of similar contracts. Consider negotiating for more reasonable notice periods.",
      medium:
        "Standard termination terms, found in 60% of employment contracts. Generally acceptable with minor adjustments.",
      low: "Favorable termination conditions. This clause protects your interests well.",
    },
    compensation: {
      high: "Compensation terms may be below market standards. Consider benchmarking against industry averages.",
      medium: "Compensation structure aligns with typical market practices.",
      low: "Competitive compensation package that exceeds many industry standards.",
    },
    non_compete: {
      high: "Non-compete restrictions are stricter than 90% of contracts. Strong negotiation recommended.",
      medium:
        "Standard non-compete terms, but review geographic and time limitations.",
      low: "Reasonable non-compete clause with fair limitations.",
    },
  };
  return (
    benchmarks[clauseType || ""]?.[riskLevel || ""] ||
    "Industry comparison data not available for this clause type."
  );
};

// Search text highlighting utility
export const highlightSearchText = (
  text: string,
  query: string
): React.ReactNode => {
  if (!query.trim()) return text;

  const regex = new RegExp(
    `(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
    "gi"
  );
  const parts = text.split(regex);

  return parts.map((part, index) =>
    regex.test(part) ? (
      <mark
        key={index}
        className="bg-accent-purple/20 text-accent-purple rounded px-1"
      >
        {part}
      </mark>
    ) : (
      part
    )
  );
};
