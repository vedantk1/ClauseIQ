/**
 * Contract type filters component for documents page
 * Extracted from main documents page - handles contract type filter chips
 */

import type { DocumentItem } from "@/types/documents";
import {
  formatContractType,
  getContractTypeColor,
} from "@/utils/documentUtils";

interface ContractTypeFiltersProps {
  documents: DocumentItem[];
  selectedContractType: string;
  setSelectedContractType: (type: string) => void;
  getAvailableContractTypes: () => (string | undefined)[];
}

export const ContractTypeFilters = ({
  documents,
  selectedContractType,
  setSelectedContractType,
  getAvailableContractTypes,
}: ContractTypeFiltersProps) => {
  const availableTypes = getAvailableContractTypes();

  if (documents.length === 0 || availableTypes.length <= 1) {
    return null;
  }

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-text-secondary font-medium">
          Filter by type:
        </span>
        <button
          onClick={() => setSelectedContractType("")}
          className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
            !selectedContractType
              ? "bg-accent-purple/20 text-accent-purple border-accent-purple/30"
              : "bg-bg-elevated text-text-secondary border-border-muted hover:bg-bg-surface"
          }`}
        >
          All ({documents.length})
        </button>
        {availableTypes.map((type) => {
          const count = documents.filter(
            (doc) => doc.contract_type === type
          ).length;
          return (
            <button
              key={type}
              onClick={() =>
                setSelectedContractType(
                  selectedContractType === type ? "" : type || ""
                )
              }
              className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                selectedContractType === type
                  ? getContractTypeColor(type)
                  : "bg-bg-elevated text-text-secondary border-border-muted hover:bg-bg-surface"
              }`}
              title={`Filter by ${formatContractType(type)} contracts`}
            >
              {formatContractType(type)} ({count})
            </button>
          );
        })}
      </div>
    </div>
  );
};
