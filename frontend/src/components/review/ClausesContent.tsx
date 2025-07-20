"use client";
import React from "react";
import ClauseNavigator from "@/components/review/ClauseNavigator";
import ClauseDetailsPanel from "@/components/review/ClauseDetailsPanel";
import type { Clause } from "@clauseiq/shared-types";

interface Note {
  id: string;
  text: string;
  created_at?: string;
}

/**
 * Props for ClausesContent component
 * Supports both clause list navigation and individual clause details
 */
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
  // Note management and clause interaction props - used in details view
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

/**
 * ClausesContent - Handles clause navigation and details display
 *
 * This component implements a list-to-detail navigation pattern:
 * - When no clause is selected: Shows ClauseNavigator with filters and clause list
 * - When a clause is selected: Shows ClauseDetailsPanel with back button
 *
 * @param selectedClause - Currently selected clause (null for list view)
 * @param onClauseSelect - Callback to select/deselect clauses (pass null to go back to list)
 */
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
      <div className="h-full">
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
          onBack={() => onClauseSelect(null)}
        />
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
