"use client";
import React from "react";
import RiskSummaryCards from "./RiskSummaryCards";
import ClauseSearchAndFilters from "./ClauseSearchAndFilters";
import ClauseList from "./ClauseList";
import {
  getRiskColor,
  getClauseTypeLabel,
  highlightSearchText,
} from "./clauseUtils";
import type { Clause, RiskSummary } from "@shared/common_generated";

interface ClauseNavigatorProps {
  clauses: Clause[];
  filteredClauses: Clause[];
  selectedClause: Clause | null;
  onClauseSelect: (clause: Clause) => void;
  riskSummary: RiskSummary;
  clauseFilter: "all" | "high" | "medium" | "low";
  onClauseFilterChange: (filter: "all" | "high" | "medium" | "low") => void;
  clauseTypeFilter: string;
  onClauseTypeFilterChange: (type: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: string;
  onSortByChange: (sort: string) => void;
  flaggedClauses: Set<string>;
  hasNotes: (clauseId: string) => boolean;
  contractType?: string;
}

export default function ClauseNavigator({
  clauses,
  filteredClauses,
  selectedClause,
  onClauseSelect,
  riskSummary,
  clauseFilter,
  onClauseFilterChange,
  clauseTypeFilter,
  onClauseTypeFilterChange,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortByChange,
  flaggedClauses,
  hasNotes,
  contractType,
}: ClauseNavigatorProps) {
  const safeRiskHigh = riskSummary?.high ?? 0;
  const safeRiskMedium = riskSummary?.medium ?? 0;
  const safeRiskLow = riskSummary?.low ?? 0;

  const hasRiskData = safeRiskHigh > 0 || safeRiskMedium > 0 || safeRiskLow > 0;

  return (
    <div className="p-4">
      {/* <div className="bg-bg-surface border border-border-muted rounded-lg shadow-card p-2"> */}
      {/* <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-heading-sm text-text-primary">
          Clause Navigator
        </h2>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-text-secondary">
            {filteredClauses.length} clauses
          </span>
        </div>
      </div> */}

      {/* Risk Summary - Clickable Filter Cards */}
      {riskSummary && hasRiskData && (
        <RiskSummaryCards
          safeRiskHigh={safeRiskHigh}
          safeRiskMedium={safeRiskMedium}
          safeRiskLow={safeRiskLow}
          clauseFilter={clauseFilter}
          onFilterChange={onClauseFilterChange}
        />
      )}

      {/* Search and Filters */}
      <ClauseSearchAndFilters
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        clauseFilter={clauseFilter}
        onClauseFilterChange={onClauseFilterChange}
        clauseTypeFilter={clauseTypeFilter}
        onClauseTypeFilterChange={onClauseTypeFilterChange}
        clauses={clauses}
        sortBy={sortBy}
        onSortByChange={onSortByChange}
        filteredClausesCount={filteredClauses.length}
      />

      {/* Clause List */}
      {filteredClauses.length > 0 ? (
        <ClauseList
          clauses={filteredClauses}
          selectedClause={selectedClause}
          onClauseSelect={onClauseSelect}
          searchQuery={searchQuery}
          flaggedClauses={flaggedClauses}
          hasNotes={hasNotes}
          getRiskColor={getRiskColor}
          getClauseTypeLabel={getClauseTypeLabel}
          highlightSearchText={highlightSearchText}
        />
      ) : clauses && clauses.length > 0 ? (
        <div className="text-center py-8">
          <svg
            className="w-8 h-8 text-text-secondary mx-auto mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <p className="text-text-secondary mb-2">
            {searchQuery
              ? `No clauses match "${searchQuery}"`
              : "No clauses match the selected filters"}
          </p>
          {searchQuery && (
            <p className="text-xs text-text-secondary/70">
              Try searching for partial words like &quot;comp&quot; for
              compensation, or &quot;term&quot; for termination
            </p>
          )}
        </div>
      ) : (
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
      )}
    </div>
    // </div>
  );
}
