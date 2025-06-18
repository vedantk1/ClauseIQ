/**
 * Results counter component
 * Extracted from main documents page - shows filtered results count
 */

import { formatContractType } from "@/utils/documentUtils";

interface ResultsCounterProps {
  filteredCount: number;
  totalCount: number;
  searchQuery: string;
  selectedContractType: string;
}

export const ResultsCounter = ({
  filteredCount,
  totalCount,
  searchQuery,
  selectedContractType,
}: ResultsCounterProps) => {
  if (!searchQuery && !selectedContractType) {
    return null;
  }

  return (
    <div className="mb-6">
      <p className="text-text-secondary text-sm">
        {filteredCount} document{filteredCount !== 1 ? "s" : ""} found
        {searchQuery && ` matching "${searchQuery}"`}
        {selectedContractType &&
          ` of type "${formatContractType(selectedContractType)}"`}
        {(searchQuery || selectedContractType) && ` out of ${totalCount} total`}
      </p>
    </div>
  );
};
