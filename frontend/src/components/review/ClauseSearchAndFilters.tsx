"use client";
import React from "react";
import Button from "@/components/Button";

interface ClauseSearchAndFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  clauseFilter: "all" | "high" | "medium" | "low";
  onClauseFilterChange: (filter: "all" | "high" | "medium" | "low") => void;
  clauseTypeFilter: string;
  onClauseTypeFilterChange: (type: string) => void;
  sortBy: string;
  onSortByChange: (sort: string) => void;
  filteredClausesCount: number;
}

export default function ClauseSearchAndFilters({
  searchQuery,
  onSearchChange,
  clauseFilter,
  onClauseFilterChange,
  clauseTypeFilter,
  onClauseTypeFilterChange,
  sortBy,
  onSortByChange,
  filteredClausesCount,
}: ClauseSearchAndFiltersProps) {
  return (
    <div className="space-y-4 mb-4">
      {/* Search Bar */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search clauses... (try comp, terminate, etc.)"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full px-3 py-2 pl-10 pr-10 text-sm bg-bg-elevated border border-border-muted rounded-md text-text-primary placeholder-text-secondary focus:ring-2 focus:ring-accent-purple focus:border-transparent"
        />
        <svg
          className="absolute left-3 top-2.5 w-4 h-4 text-text-secondary"
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
        {/* Search indicator */}
        {searchQuery && (
          <div className="absolute right-3 top-2.5 flex items-center">
            <span className="text-xs text-accent-purple bg-accent-purple/10 px-2 py-0.5 rounded-full">
              {filteredClausesCount} found
            </span>
          </div>
        )}
      </div>

      {/* Filters and Sort Controls - Segmented Control */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Segmented Control Container */}
        <div className="flex-1 bg-bg-elevated border border-border-muted rounded-lg overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border-muted">
            {/* Risk Level Segment */}
            <div className="relative">
              <label className="block text-xs font-medium text-text-secondary px-3 pt-2 pb-1">
                Risk
              </label>
              <select
                value={clauseFilter}
                onChange={(e) =>
                  onClauseFilterChange(
                    e.target.value as "all" | "high" | "medium" | "low"
                  )
                }
                className="w-full px-3 pb-2 text-sm bg-transparent border-none text-text-primary focus:ring-0 focus:outline-none appearance-none cursor-pointer"
                style={{ backgroundImage: "none" }}
              >
                <option value="all">All Risk Levels</option>
                <option value="high">High Risk Only</option>
                <option value="medium">Medium Risk Only</option>
                <option value="low">Low Risk Only</option>
              </select>
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <svg
                  className="w-4 h-4 text-text-secondary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>

            {/* Type Segment */}
            <div className="relative">
              <label className="block text-xs font-medium text-text-secondary px-3 pt-2 pb-1">
                Type
              </label>
              <select
                value={clauseTypeFilter}
                onChange={(e) => onClauseTypeFilterChange(e.target.value)}
                className="w-full px-3 pb-2 text-sm bg-transparent border-none text-text-primary focus:ring-0 focus:outline-none appearance-none cursor-pointer"
                style={{ backgroundImage: "none" }}
              >
                <option value="all">All Types</option>
                <option value="termination">Termination</option>
                <option value="compensation">Compensation</option>
                <option value="non_compete">Non-Compete</option>
                <option value="confidentiality">Confidentiality</option>
                <option value="intellectual_property">IP Rights</option>
                <option value="dispute_resolution">Dispute Resolution</option>
                <option value="other">Other</option>
              </select>
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <svg
                  className="w-4 h-4 text-text-secondary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>

            {/* Sort Segment */}
            <div className="relative">
              <label className="block text-xs font-medium text-text-secondary px-3 pt-2 pb-1">
                Order
              </label>
              <select
                value={sortBy}
                onChange={(e) => onSortByChange(e.target.value)}
                className="w-full px-3 pb-2 text-sm bg-transparent border-none text-text-primary focus:ring-0 focus:outline-none appearance-none cursor-pointer"
                style={{ backgroundImage: "none" }}
              >
                <option value="document_order">Document Order</option>
                <option value="risk_level">Risk Level</option>
                <option value="clause_type">Clause Type</option>
                <option value="alphabetical">Alphabetical</option>
              </select>
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <svg
                  className="w-4 h-4 text-text-secondary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Clear Search Button */}
        {searchQuery && (
          <Button
            size="sm"
            variant="tertiary"
            onClick={() => onSearchChange("")}
            title="Clear search"
            className="text-xs whitespace-nowrap"
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
