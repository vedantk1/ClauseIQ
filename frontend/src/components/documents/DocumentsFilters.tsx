/**
 * Filters component for documents page
 * Extracted from main documents page - handles search, sort, and view mode controls
 */

import { Search, ChevronDown, X, Grid3X3, List } from "lucide-react";
import type { ViewMode, SortOption } from "@/types/documents";

interface DocumentsFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  sortBy: SortOption;
  setSortBy: (sort: SortOption) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  filteredCount: number;
  isDropdownOpen: boolean;
  setIsDropdownOpen: (open: boolean) => void;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}

export const DocumentsFilters = ({
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  viewMode,
  setViewMode,
  filteredCount,
  isDropdownOpen,
  setIsDropdownOpen,
  dropdownRef,
  searchInputRef,
}: DocumentsFiltersProps) => {
  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-8">
      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-tertiary" />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search documents... (try contract type, filename, etc.)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setSearchQuery("");
              e.currentTarget.blur();
            }
          }}
          className="w-full pl-10 pr-10 py-2 bg-bg-elevated border border-border-muted rounded-lg text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent-purple/20 focus:border-accent-purple transition-colors"
        />
        {/* Search indicator */}
        {searchQuery && (
          <div className="absolute right-10 top-1/2 transform -translate-y-1/2 flex items-center">
            <span className="text-xs text-accent-purple bg-accent-purple/10 px-2 py-0.5 rounded-full">
              {filteredCount} found
            </span>
          </div>
        )}
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-bg-surface transition-colors"
            title="Clear search"
          >
            <X className="w-3 h-3 text-text-tertiary" />
          </button>
        )}
      </div>

      <div className="flex gap-2">
        {/* Sort Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="px-3 py-2 bg-bg-elevated border border-border-muted rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-purple/20 focus:border-accent-purple transition-colors hover:bg-bg-elevated/80 flex items-center gap-2 min-w-[140px] justify-between"
          >
            <span>
              {sortBy === "newest" && "Newest First"}
              {sortBy === "oldest" && "Oldest First"}
              {sortBy === "name" && "Name A-Z"}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-text-tertiary transition-transform ${
                isDropdownOpen ? "rotate-180" : ""
              }`}
            />
          </button>
          {isDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-full bg-bg-elevated border border-border-muted rounded-lg shadow-lg z-10">
              <button
                onClick={() => {
                  setSortBy("newest");
                  setIsDropdownOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-text-primary hover:bg-bg-surface transition-colors first:rounded-t-lg ${
                  sortBy === "newest"
                    ? "bg-accent-purple/10 text-accent-purple"
                    : ""
                }`}
              >
                Newest First
              </button>
              <button
                onClick={() => {
                  setSortBy("oldest");
                  setIsDropdownOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-text-primary hover:bg-bg-surface transition-colors ${
                  sortBy === "oldest"
                    ? "bg-accent-purple/10 text-accent-purple"
                    : ""
                }`}
              >
                Oldest First
              </button>
              <button
                onClick={() => {
                  setSortBy("name");
                  setIsDropdownOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-text-primary hover:bg-bg-surface transition-colors last:rounded-b-lg ${
                  sortBy === "name"
                    ? "bg-accent-purple/10 text-accent-purple"
                    : ""
                }`}
              >
                Name A-Z
              </button>
            </div>
          )}
        </div>

        {/* View Mode Toggle */}
        <div className="flex rounded-lg border border-border-muted overflow-hidden">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-2 transition-colors ${
              viewMode === "grid"
                ? "bg-accent-purple text-white"
                : "bg-bg-elevated text-text-secondary hover:text-text-primary"
            }`}
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-2 transition-colors ${
              viewMode === "list"
                ? "bg-accent-purple text-white"
                : "bg-bg-elevated text-text-secondary hover:text-text-primary"
            }`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
