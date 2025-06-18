/**
 * No results message component
 * Extracted from main documents page - shown when filters/search return no results
 */

import Button from "@/components/Button";
import { Search } from "lucide-react";
import { formatContractType } from "@/utils/documentUtils";

interface NoResultsMessageProps {
  searchQuery: string;
  selectedContractType: string;
  onClearSearch: () => void;
  onClearFilter: () => void;
}

export const NoResultsMessage = ({
  searchQuery,
  selectedContractType,
  onClearSearch,
  onClearFilter,
}: NoResultsMessageProps) => {
  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-bg-elevated flex items-center justify-center">
        <Search className="w-8 h-8 text-text-tertiary" />
      </div>
      <h3 className="text-lg font-medium text-text-primary mb-2">
        No documents found
      </h3>
      <p className="text-text-secondary mb-4">
        {searchQuery && selectedContractType
          ? `No "${formatContractType(
              selectedContractType
            )}" documents match "${searchQuery}"`
          : searchQuery
          ? `No documents match "${searchQuery}"`
          : selectedContractType
          ? `No "${formatContractType(selectedContractType)}" documents found`
          : "No documents match your current filters"}
      </p>
      {searchQuery && (
        <p className="text-xs text-text-secondary/70 mb-4">
          Try searching for partial words like &quot;employ&quot; for employment
          contracts, or &quot;non&quot; for non-compete agreements
        </p>
      )}
      <div className="flex gap-2 justify-center">
        {searchQuery && (
          <Button variant="secondary" onClick={onClearSearch}>
            Clear Search
          </Button>
        )}
        {selectedContractType && (
          <Button variant="secondary" onClick={onClearFilter}>
            Clear Filter
          </Button>
        )}
      </div>
    </div>
  );
};
