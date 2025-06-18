/**
 * Custom hook for managing document filtering, searching, and sorting
 * Extracted from documents page to separate filtering concerns
 */

import { useState, useEffect } from "react";
import type { DocumentItem, SortOption } from "@/types/documents";
import { formatContractType } from "@/utils/documentUtils";

interface UseDocumentsFilteringProps {
  documents: DocumentItem[];
}

export const useDocumentsFiltering = ({
  documents,
}: UseDocumentsFilteringProps) => {
  const [filteredDocuments, setFilteredDocuments] = useState<DocumentItem[]>(
    []
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [selectedContractType, setSelectedContractType] = useState<string>("");

  const getAvailableContractTypes = () => {
    const types = new Set(
      documents.map((doc) => doc.contract_type).filter(Boolean)
    );
    return Array.from(types).sort();
  };

  // Filter and sort documents
  useEffect(() => {
    const filtered = documents.filter((doc) => {
      // Contract type filter
      const matchesType =
        !selectedContractType || doc.contract_type === selectedContractType;

      // Enhanced search filter with partial word matching
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const searchableFields = [
          doc.filename || "",
          formatContractType(doc.contract_type),
        ];

        // Create searchable text and individual words
        const searchableText = searchableFields.join(" ").toLowerCase();
        const searchableWords = searchableText.split(/\s+/);

        // Check if query matches any part of the searchable content
        const queryMatches =
          searchableText.includes(query) || // Exact phrase match
          searchableWords.some((word) => word.startsWith(query)) || // Word starts with query
          searchableWords.some(
            (word) => word.includes(query) && query.length >= 3
          ); // Partial match for 3+ chars

        if (!queryMatches) return false;
      }

      return matchesType;
    });

    // Sort documents
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return (
            new Date(b.upload_date).getTime() -
            new Date(a.upload_date).getTime()
          );
        case "oldest":
          return (
            new Date(a.upload_date).getTime() -
            new Date(b.upload_date).getTime()
          );
        case "name":
          return a.filename.localeCompare(b.filename);
        default:
          return 0;
      }
    });

    setFilteredDocuments(filtered);
  }, [documents, searchQuery, sortBy, selectedContractType]);

  return {
    filteredDocuments,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    selectedContractType,
    setSelectedContractType,
    getAvailableContractTypes,
  };
};
