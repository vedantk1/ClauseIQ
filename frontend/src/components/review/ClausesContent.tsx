"use client";
import React from "react";
import ClauseNavigator from "@/components/review/ClauseNavigator";
import ClauseDetailsPanel from "@/components/review/ClauseDetailsPanel";
import Button from "@/components/Button";
import type { Clause } from "@shared/common_generated";

interface Note {
  id: string;
  text: string;
  created_at?: string;
}

interface ClausesContentProps {
  clauses: Clause[];
  filteredClauses: Clause[];
  selectedClause: Clause | null;
  onClauseSelect: (clause: Clause | null) => void;
  riskSummary: { high: number; medium: number; low: number };
  clauseFilter: "all" | "high" | "medium" | "low";
  onClauseFilterChange: (filter: "all" | "high" | "medium" | "low") => void;
  clauseTypeFilter: string;
  onClauseTypeFilterChange: (filter: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: string;
  onSortByChange: (sortBy: string) => void;
  flaggedClauses: Set<string>;
  hasNotes: (clauseId: string) => boolean;
  contractType?: string;
  // Unused props from previous implementation - kept for compatibility
  getAllNotes: (clauseId: string) => Note[];
  getNotesCount: (clauseId: string) => number;
  onAddNote: (clause: { id?: string }, noteText?: string) => Promise<void>;
  onEditNote: (
    clause: { id?: string },
    noteId?: string,
    editedText?: string
  ) => Promise<void>;
  onDeleteNote: (clause: { id?: string }, noteId?: string) => Promise<void>;
  onFlagForReview: (
    clause: { id?: string },
    event?: React.MouseEvent
  ) => Promise<void>;
  onCopyClause: (clause: Clause) => Promise<void>;
}

export default function ClausesContent({
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
  getAllNotes,
  getNotesCount,
  contractType,
  onAddNote,
  onEditNote,
  onDeleteNote,
  onFlagForReview,
  onCopyClause,
}: ClausesContentProps) {
  // If a clause is selected, show the details view
  if (selectedClause) {
    return (
      <div className="h-full flex flex-col">
        {/* Header with back button */}
        <div className="p-4 border-b border-border-light">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onClauseSelect(null)}
              className="flex items-center gap-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to Clauses
            </Button>
          </div>
        </div>

        {/* Clause Details */}
        <div className="flex-1 overflow-hidden">
          <ClauseDetailsPanel
            selectedClause={selectedClause}
            flaggedClauses={flaggedClauses}
            hasNotes={hasNotes}
            getAllNotes={getAllNotes}
            getNotesCount={getNotesCount}
            onAddNote={onAddNote}
            onEditNote={onEditNote}
            onDeleteNote={onDeleteNote}
            onFlagForReview={onFlagForReview}
            onCopyClause={onCopyClause}
          />
        </div>
      </div>
    );
  }

  // Default view: show the clause navigator
  return (
    <div className="h-full">
      <ClauseNavigator
        clauses={clauses}
        filteredClauses={filteredClauses}
        selectedClause={selectedClause}
        onClauseSelect={onClauseSelect}
        riskSummary={riskSummary}
        clauseFilter={clauseFilter}
        onClauseFilterChange={onClauseFilterChange}
        clauseTypeFilter={clauseTypeFilter}
        onClauseTypeFilterChange={onClauseTypeFilterChange}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        sortBy={sortBy}
        onSortByChange={onSortByChange}
        flaggedClauses={flaggedClauses}
        hasNotes={hasNotes}
        contractType={contractType}
      />
    </div>
  );
}
