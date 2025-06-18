/**
 * Custom hook for managing bulk document selection
 * Extracted from documents page to separate selection concerns
 */

import { useState, useCallback } from "react";
import type { DocumentItem } from "@/types/documents";

interface UseBulkSelectionProps {
  filteredDocuments: DocumentItem[];
}

export const useBulkSelection = ({
  filteredDocuments,
}: UseBulkSelectionProps) => {
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(
    new Set()
  );
  const [isSelectMode, setIsSelectMode] = useState(false);

  // Bulk selection functions
  const selectAllDocuments = useCallback(() => {
    const allIds = new Set(filteredDocuments.map((doc) => doc.id));
    setSelectedDocuments(allIds);
  }, [filteredDocuments]);

  const toggleSelectMode = () => {
    setIsSelectMode(!isSelectMode);
    setSelectedDocuments(new Set());
  };

  const toggleDocumentSelection = (documentId: string) => {
    const newSelected = new Set(selectedDocuments);
    if (newSelected.has(documentId)) {
      newSelected.delete(documentId);
    } else {
      newSelected.add(documentId);
    }
    setSelectedDocuments(newSelected);
  };

  const clearSelection = () => {
    setSelectedDocuments(new Set());
  };

  return {
    selectedDocuments,
    setSelectedDocuments,
    isSelectMode,
    setIsSelectMode,
    selectAllDocuments,
    toggleSelectMode,
    toggleDocumentSelection,
    clearSelection,
  };
};
