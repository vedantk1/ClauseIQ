"use client";
import React, { useState } from "react";
import Button from "@/components/Button";
import ClauseNavigator from "@/components/review/ClauseNavigator";
import ClauseDetailsPanel from "@/components/review/ClauseDetailsPanel";
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
  getAllNotes: (clauseId: string) => Note[];
  getNotesCount: (clauseId: string) => number;
  contractType?: string;
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
  const [isNavigatorCollapsed, setIsNavigatorCollapsed] = useState(false);
  const [isDetailsCollapsed, setIsDetailsCollapsed] = useState(false);

  return (
    <div className="h-full flex flex-col">
      {/* Clause Navigator Panel */}
      <div
        className={`border-b border-border-light transition-all duration-200 ${
          isNavigatorCollapsed ? "flex-shrink-0" : "flex-1 min-h-0"
        }`}
      >
        {/* Navigator Header */}
        <div className="p-3 border-b border-border-light bg-bg-secondary">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-sm font-medium text-text-primary">
              Clause Navigator
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsNavigatorCollapsed(!isNavigatorCollapsed)}
              className="p-1"
              aria-label={
                isNavigatorCollapsed ? "Expand navigator" : "Collapse navigator"
              }
            >
              <svg
                className={`w-4 h-4 transition-transform ${
                  isNavigatorCollapsed ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 15l7-7 7 7"
                />
              </svg>
            </Button>
          </div>
        </div>

        {/* Navigator Content */}
        {!isNavigatorCollapsed && (
          <div className="flex-1 min-h-0">
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
        )}
      </div>

      {/* Clause Details Panel - Only show when a clause is selected */}
      {selectedClause && (
        <div
          className={`transition-all duration-200 ${
            isDetailsCollapsed ? "flex-shrink-0" : "flex-1 min-h-0"
          }`}
        >
          {/* Details Header */}
          <div className="p-3 border-b border-border-light bg-bg-secondary">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-sm font-medium text-text-primary">
                Clause Details
              </h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsDetailsCollapsed(!isDetailsCollapsed)}
                  className="p-1"
                  aria-label={
                    isDetailsCollapsed ? "Expand details" : "Collapse details"
                  }
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${
                      isDetailsCollapsed ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 15l7-7 7 7"
                    />
                  </svg>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onClauseSelect(null)}
                  className="p-1"
                  aria-label="Close details"
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </Button>
              </div>
            </div>
          </div>

          {/* Details Content */}
          {!isDetailsCollapsed && (
            <div className="flex-1 min-h-0">
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
          )}
        </div>
      )}

      {/* Empty state when no clause is selected */}
      {!selectedClause && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center text-text-secondary">
            <p className="text-sm">Select a clause above to view details</p>
          </div>
        </div>
      )}
    </div>
  );
}
