"use client";
import React from "react";
import type { Clause } from "@shared/common_generated";

interface ClauseListProps {
  clauses: Clause[];
  selectedClause: Clause | null;
  onClauseSelect: (clause: Clause) => void;
  searchQuery: string;
  flaggedClauses: Set<string>;
  hasNotes: (clauseId: string) => boolean;
  getRiskColor: (level?: string) => string;
  getClauseTypeLabel: (type?: string) => string;
  highlightSearchText: (text: string, query: string) => React.ReactNode;
}

export default function ClauseList({
  clauses,
  selectedClause,
  onClauseSelect,
  searchQuery,
  flaggedClauses,
  hasNotes,
  getRiskColor,
  getClauseTypeLabel,
  highlightSearchText,
}: ClauseListProps) {
  if (clauses.length === 0) {
    return (
      <div className="text-center py-8">
        <svg
          className="w-12 h-12 text-text-secondary mx-auto mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h2 className="font-heading text-heading-sm text-text-primary mb-2">
          No clauses extracted yet
        </h2>
        <p className="text-text-secondary">
          Upload a contract with clauses to see detailed analysis.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-border-muted rounded-lg bg-bg-surface p-3">
      <div className="space-y-3 max-h-[600px] overflow-y-auto">
        {clauses.map((clause, index) => (
          <div
            key={clause.id || index}
            onClick={() => onClauseSelect(clause)}
            className={`p-3 rounded-lg cursor-pointer transition-all duration-100 focus:outline-none focus:outline-offset-2 focus:outline-accent-purple ${
              selectedClause?.id === clause.id
                ? "bg-accent-purple/5 border-transparent"
                : "border border-border-muted bg-bg-elevated hover:bg-bg-elevated/80 hover:shadow-sm"
            }`}
            tabIndex={0}
            role="button"
            aria-label={`Select clause: ${
              clause.heading || getClauseTypeLabel(clause.clause_type)
            }`}
          >
            {/* Top Row: Title + Icons + Risk Badge */}
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-medium text-text-primary text-sm flex-grow pr-2">
                {highlightSearchText(
                  clause.heading ||
                    `${getClauseTypeLabel(clause.clause_type)} Clause`,
                  searchQuery
                )}
              </h3>

              {/* Meta Flex: Icons + Risk Badge */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Action Icons */}
                {clause.id && flaggedClauses.has(clause.id) && (
                  <span
                    className="text-sm text-accent-rose hover:scale-110 transition-transform duration-100 min-w-[44px] min-h-[44px] flex items-center justify-center -m-2"
                    aria-label="Flagged for review"
                    title="Flagged for review"
                  >
                    🚩
                  </span>
                )}
                {clause.id && hasNotes(clause.id) && (
                  <span
                    className="text-sm text-accent-blue hover:scale-110 transition-transform duration-100 min-w-[44px] min-h-[44px] flex items-center justify-center -m-2"
                    aria-label="Has notes"
                    title="Has notes"
                  >
                    📝
                  </span>
                )}

                {/* Risk Badge */}
                <div
                  className={`px-2 py-1 rounded-full text-xs font-medium border ${getRiskColor(
                    clause.risk_level
                  )}`}
                >
                  {clause.risk_level
                    ? clause.risk_level.charAt(0).toUpperCase() +
                      clause.risk_level.slice(1)
                    : "Unknown"}
                </div>
              </div>
            </div>

            {/* Bottom Row: Type Tag + Snippet (collapsed onto same line) */}
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-xs text-text-secondary bg-bg-primary px-2 py-1 rounded flex-shrink-0">
                {highlightSearchText(
                  getClauseTypeLabel(clause.clause_type),
                  searchQuery
                )}
              </span>
              <p className="text-sm text-text-secondary line-clamp-1 flex-1 min-w-0">
                {highlightSearchText(
                  clause.text
                    ? clause.text.substring(0, 90) + "..."
                    : "No content available",
                  searchQuery
                )}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
