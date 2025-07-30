"use client";
import React from "react";
import { useDocumentViewing } from "@/hooks/useDocumentViewing";

interface RiskSummary {
  high?: number;
  medium?: number;
  low?: number;
}

interface Clause {
  clause_type?: string;
}

interface DocumentStatsBarProps {
  fullText?: string;
  clauseCount?: number;
  riskSummary?: RiskSummary;
  clauses?: Clause[];
  onClausesClick?: () => void;
  lastViewed?: string | null;
}

export default function DocumentStatsBar({
  fullText,
  clauseCount = 0,
  riskSummary = { high: 0, medium: 0, low: 0 },
  clauses = [],
  onClausesClick,
  lastViewed,
}: DocumentStatsBarProps) {
  const { formatLastViewed } = useDocumentViewing();
  // Document statistics
  const wordCount = fullText
    ? fullText.split(/\s+/).filter((word) => word.length > 0).length
    : 0;

  // Calculate complexity score
  const calculateComplexity = () => {
    let score = 0;

    // Document length factor (0-4 points)
    if (wordCount > 8000) score += 4;
    else if (wordCount > 5000) score += 3;
    else if (wordCount > 2500) score += 2;
    else if (wordCount > 1000) score += 1;

    // Clause density factor (0-3 points)
    if (wordCount > 0) {
      const clausesPerThousandWords = clauseCount / (wordCount / 1000);
      if (clausesPerThousandWords > 20) score += 3;
      else if (clausesPerThousandWords > 15) score += 2;
      else if (clausesPerThousandWords > 10) score += 1;
    }

    // Risk complexity (0-4 points)
    score += (riskSummary.high || 0) * 1.5;
    score += (riskSummary.medium || 0) * 0.5;

    // Clause type diversity (0-2 points)
    const uniqueClauseTypes = new Set(clauses?.map((c) => c.clause_type)).size;
    if (uniqueClauseTypes > 10) score += 2;
    else if (uniqueClauseTypes > 6) score += 1;

    // Convert to human-readable scale
    if (score <= 3) return "Low";
    if (score <= 8) return "Medium";
    return "High";
  };

  const complexity = calculateComplexity();



  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <div
        className={`p-3 bg-bg-elevated rounded-xl border border-border-muted text-center relative ${
          onClausesClick
            ? "cursor-pointer hover:bg-bg-surface hover:border-accent-blue/30 hover:shadow-sm transition-all duration-200"
            : ""
        }`}
        onClick={onClausesClick}
      >
        <div className="text-lg font-bold text-text-primary mb-1">
          {clauseCount}
        </div>
        <div className="text-xs text-text-secondary font-medium flex items-center justify-center gap-1">
          Clauses
          {onClausesClick && (
            <svg
              className="w-3 h-3 text-text-secondary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          )}
        </div>
      </div>
      <div className="p-3 bg-bg-elevated rounded-xl border border-border-muted text-center">
        <div className="text-lg font-bold text-text-primary mb-1">
          {wordCount.toLocaleString()}
        </div>
        <div className="text-xs text-text-secondary font-medium">Words</div>
      </div>
      <div className="p-3 bg-bg-elevated rounded-xl border border-border-muted text-center">
        <div className="text-lg font-bold text-text-primary mb-1">
          {complexity}
        </div>
        <div className="text-xs text-text-secondary font-medium">
          Complexity
        </div>
      </div>
      <div className="p-3 bg-bg-elevated rounded-xl border border-border-muted text-center">
        <div className="text-lg font-bold text-text-primary mb-1">
          {formatLastViewed(lastViewed)}
        </div>
        <div className="text-xs text-text-secondary font-medium">
          Last Viewed
        </div>
      </div>
    </div>
  );
}
