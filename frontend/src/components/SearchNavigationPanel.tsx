import React, { useState } from "react";
import { Highlight } from "@clauseiq/shared-types";
import Button from "@/components/Button";

interface SearchNavigationPanelProps {
  highlights: Highlight[];
  currentHighlightIndex: number;
  onNavigateToHighlight: (index: number) => void;
  onPreviousHighlight: () => void;
  onNextHighlight: () => void;
  onSearch: (term: string) => void;
}

const SearchNavigationPanel: React.FC<SearchNavigationPanelProps> = ({
  highlights,
  currentHighlightIndex,
  onNavigateToHighlight,
  onPreviousHighlight,
  onNextHighlight,
  onSearch,
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    onSearch(term);
  };

  return (
    <div className="bg-white border-b border-gray-200 p-3 flex items-center gap-4 flex-wrap">
      {/* Search Input */}
      <div className="flex-1 max-w-md min-w-48">
        <div className="relative">
          <input
            type="text"
            placeholder="Search in document..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg
              className="h-4 w-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Highlight Navigation */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600 whitespace-nowrap">
          Highlights ({highlights.length})
        </span>
        {highlights.length > 0 && (
          <>
            <Button
              onClick={onPreviousHighlight}
              size="sm"
              variant="secondary"
              disabled={highlights.length === 0}
            >
              ← Prev
            </Button>
            <span className="text-sm text-gray-600 px-2 whitespace-nowrap">
              {highlights.length > 0 ? currentHighlightIndex + 1 : 0} of{" "}
              {highlights.length}
            </span>
            <Button
              onClick={onNextHighlight}
              size="sm"
              variant="secondary"
              disabled={highlights.length === 0}
            >
              Next →
            </Button>
          </>
        )}
      </div>

      {/* Highlight List Dropdown */}
      {highlights.length > 0 && (
        <div className="relative">
          <select
            onChange={(e) => onNavigateToHighlight(parseInt(e.target.value))}
            value={currentHighlightIndex}
            className="border border-gray-300 rounded px-3 py-1 text-sm min-w-32"
          >
            {highlights.map((highlight, index) => (
              <option key={highlight.id} value={index}>
                {highlight.content.substring(0, 30)}...
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};

export default SearchNavigationPanel;
