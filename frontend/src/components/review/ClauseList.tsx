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
    <div className="space-y-3 max-h-[600px] overflow-y-auto">
      {clauses.map((clause, index) => (
        <div
          key={clause.id || index}
          onClick={() => onClauseSelect(clause)}
          className={`p-3 rounded-lg border cursor-pointer transition-all ${
            selectedClause?.id === clause.id
              ? "border-accent-purple bg-accent-purple/5"
              : "border-border-muted bg-bg-elevated hover:bg-bg-elevated/80"
          }`}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <h3 className="font-medium text-text-primary text-sm">
                {clause.heading ||
                  `${getClauseTypeLabel(clause.clause_type)} Clause`}
              </h3>
              <div className="flex items-center gap-1 mt-1">
                {clause.id && flaggedClauses.has(clause.id) && (
                  <span className="text-xs text-accent-rose">🚩</span>
                )}
                {clause.id && hasNotes(clause.id) && (
                  <span className="text-xs text-accent-blue">📝</span>
                )}
              </div>
            </div>
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
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-text-secondary bg-bg-primary px-2 py-1 rounded">
              {highlightSearchText(
                getClauseTypeLabel(clause.clause_type),
                searchQuery
              )}
            </span>
          </div>
          <p className="text-sm text-text-secondary line-clamp-2">
            {highlightSearchText(
              clause.summary ||
                (clause.text
                  ? clause.text.substring(0, 100) + "..."
                  : "No content available"),
              searchQuery
            )}
          </p>
        </div>
      ))}
    </div>
  );
}
