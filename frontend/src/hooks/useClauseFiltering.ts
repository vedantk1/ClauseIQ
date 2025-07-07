"use client";
import { useMemo } from "react";
import { getClauseTypeLabel } from "../components/review/clauseUtils";
import type { Clause } from "@shared/common_generated";

interface UseClauseFilteringProps {
  clauses: Clause[];
  clauseFilter: "all" | "high" | "medium" | "low";
  clauseTypeFilter: string;
  searchQuery: string;
  sortBy: string;
  flaggedClauses: Set<string>;
}

export function useClauseFiltering({
  clauses,
  clauseFilter,
  clauseTypeFilter,
  searchQuery,
  sortBy,
  flaggedClauses,
}: UseClauseFilteringProps) {
  const filteredClauses = useMemo(() => {
    return (
      clauses?.filter((clause) => {
        // Risk level filter
        if (clauseFilter !== "all" && clause.risk_level !== clauseFilter)
          return false;

        // Clause type filter
        if (
          clauseTypeFilter !== "all" &&
          clause.clause_type !== clauseTypeFilter
        )
          return false;

        // Enhanced search filter with partial word matching
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase().trim();
          const searchableFields = [
            clause.heading || "",
            clause.text || "",
            getClauseTypeLabel(clause.clause_type),
          ];

          // Create searchable text and individual words
          const searchableText = searchableFields.join(" ").toLowerCase();
          const searchableWords = searchableText.split(/\s+/);

          // Check if query appears as substring in any field or as partial word match
          const hasDirectMatch = searchableText.includes(query);
          const hasPartialWordMatch = searchableWords.some((word) =>
            word.includes(query)
          );

          return hasDirectMatch || hasPartialWordMatch;
        }

        return true;
      }) || []
    );
  }, [clauses, clauseFilter, clauseTypeFilter, searchQuery]);

  const sortedClauses = useMemo(() => {
    const riskOrder = { high: 3, medium: 2, low: 1 };

    return [...filteredClauses].sort((a, b) => {
      switch (sortBy) {
        case "risk_level":
          const aRisk = riskOrder[a.risk_level as keyof typeof riskOrder] || 0;
          const bRisk = riskOrder[b.risk_level as keyof typeof riskOrder] || 0;
          if (aRisk !== bRisk) return bRisk - aRisk; // High risk first

          // Secondary sort by clause type alphabetically
          const aRiskLabel = getClauseTypeLabel(a.clause_type);
          const bRiskLabel = getClauseTypeLabel(b.clause_type);
          return aRiskLabel.localeCompare(bRiskLabel);

        case "clause_type":
          const aTypeLabel = getClauseTypeLabel(a.clause_type);
          const bTypeLabel = getClauseTypeLabel(b.clause_type);
          return aTypeLabel.localeCompare(bTypeLabel);

        case "alphabetical":
          const aAlphaLabel = getClauseTypeLabel(a.clause_type);
          const bAlphaLabel = getClauseTypeLabel(b.clause_type);
          const comparison = aAlphaLabel.localeCompare(bAlphaLabel);

          // If clause types are the same, sort by heading/title
          if (comparison === 0) {
            const aTitle = a.heading || aAlphaLabel;
            const bTitle = b.heading || bAlphaLabel;
            return aTitle.localeCompare(bTitle);
          }
          return comparison;

        case "flagged_first":
          const aFlagged = flaggedClauses.has(a.id || "");
          const bFlagged = flaggedClauses.has(b.id || "");

          // Primary sort by flagged status
          if (aFlagged !== bFlagged) return aFlagged ? -1 : 1;

          // Secondary sort by risk level
          const aRiskForFlagged =
            riskOrder[a.risk_level as keyof typeof riskOrder] || 0;
          const bRiskForFlagged =
            riskOrder[b.risk_level as keyof typeof riskOrder] || 0;
          return bRiskForFlagged - aRiskForFlagged;

        case "document_order":
        default:
          // Keep original order from document
          return 0;
      }
    });
  }, [filteredClauses, sortBy, flaggedClauses]);

  return sortedClauses;
}
