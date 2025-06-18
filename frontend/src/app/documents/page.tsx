"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import type { ViewMode } from "@/types/documents";
import { useDocumentsData } from "@/hooks/useDocumentsData";
import { useDocumentsFiltering } from "@/hooks/useDocumentsFiltering";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { useDocumentOperations } from "@/hooks/useDocumentOperations";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { DocumentsLoading } from "@/components/documents/DocumentsLoading";
import { DocumentsError } from "@/components/documents/DocumentsError";
import { DocumentsEmpty } from "@/components/documents/DocumentsEmpty";
import { AuthLoading } from "@/components/documents/AuthLoading";
import { DocumentsHeader } from "@/components/documents/DocumentsHeader";
import { DocumentsFilters } from "@/components/documents/DocumentsFilters";
import { BulkSelectionToolbar } from "@/components/documents/BulkSelectionToolbar";
import { ContractTypeFilters } from "@/components/documents/ContractTypeFilters";
import { DocumentsGrid } from "@/components/documents/DocumentsGrid";
import { NoResultsMessage } from "@/components/documents/NoResultsMessage";
import { ResultsCounter } from "@/components/documents/ResultsCounter";
import { DocumentsFooter } from "@/components/documents/DocumentsFooter";
import { DeleteAllModal } from "@/components/documents/DeleteAllModal";

export default function Documents() {
  const router = useRouter();

  // Custom hooks for state management
  const {
    documents,
    setDocuments,
    loading,
    error,
    retryFetch,
    isAuthenticated,
    authLoading: isLoading,
  } = useDocumentsData();

  const {
    filteredDocuments,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    selectedContractType,
    setSelectedContractType,
    getAvailableContractTypes,
  } = useDocumentsFiltering({ documents });

  const {
    selectedDocuments,
    setSelectedDocuments,
    isSelectMode,
    setIsSelectMode,
    selectAllDocuments,
    toggleSelectMode,
    toggleDocumentSelection,
    clearSelection,
  } = useBulkSelection({ filteredDocuments });

  const {
    loadingDocId,
    deletingDocId,
    deletingAll,
    handleViewDocument,
    handleDeleteDocument,
    handleDeleteAllDocuments,
    handleBulkDelete,
  } = useDocumentOperations({
    setDocuments,
    setFilteredDocuments: () => {}, // Will be handled by filtering hook
    selectedDocuments,
    setSelectedDocuments,
    setIsSelectMode,
  });

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDeleteAllDialogOpen, setIsDeleteAllDialogOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    searchInputRef,
    isSelectMode,
    searchQuery,
    setSearchQuery,
    setIsSelectMode,
    setSelectedDocuments,
    selectAllDocuments,
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auth loading check
  if (isLoading) {
    return <AuthLoading />;
  }

  // Don't render if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  // Loading State
  if (loading) {
    return <DocumentsLoading />;
  }

  // Error State
  if (error) {
    return <DocumentsError error={error} onRetry={retryFetch} />;
  }

  // Empty State
  if (documents.length === 0) {
    return <DocumentsEmpty onUpload={() => router.push("/")} />;
  }

  // Main Content
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <DocumentsHeader
        documentsCount={documents.length}
        isSelectMode={isSelectMode}
        deletingAll={deletingAll}
        onToggleSelectMode={toggleSelectMode}
        onDeleteAll={() => setIsDeleteAllDialogOpen(true)}
      />

      {/* Controls */}
      <DocumentsFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        sortBy={sortBy}
        setSortBy={setSortBy}
        viewMode={viewMode}
        setViewMode={setViewMode}
        filteredCount={filteredDocuments.length}
        isDropdownOpen={isDropdownOpen}
        setIsDropdownOpen={setIsDropdownOpen}
        dropdownRef={dropdownRef}
        searchInputRef={searchInputRef}
      />

      {/* Bulk Selection Toolbar */}
      <BulkSelectionToolbar
        isSelectMode={isSelectMode}
        selectedDocuments={selectedDocuments}
        filteredDocumentsLength={filteredDocuments.length}
        onSelectAll={selectAllDocuments}
        onClearSelection={clearSelection}
        onBulkDelete={handleBulkDelete}
      />

      {/* Quick Filter Chips */}
      <ContractTypeFilters
        documents={documents}
        selectedContractType={selectedContractType}
        setSelectedContractType={setSelectedContractType}
        getAvailableContractTypes={getAvailableContractTypes}
      />

      {/* Results Count */}
      <ResultsCounter
        filteredCount={filteredDocuments.length}
        totalCount={documents.length}
        searchQuery={searchQuery}
        selectedContractType={selectedContractType}
      />

      {/* Documents Grid/List */}
      <DocumentsGrid
        filteredDocuments={filteredDocuments}
        searchQuery={searchQuery}
        isSelectMode={isSelectMode}
        selectedDocuments={selectedDocuments}
        loadingDocId={loadingDocId}
        deletingDocId={deletingDocId}
        viewMode={viewMode}
        onViewDocument={handleViewDocument}
        onToggleSelection={toggleDocumentSelection}
        onDeleteDocument={handleDeleteDocument}
      />

      {/* No Results */}
      {filteredDocuments.length === 0 &&
        (searchQuery || selectedContractType) && (
          <NoResultsMessage
            searchQuery={searchQuery}
            selectedContractType={selectedContractType}
            onClearSearch={() => setSearchQuery("")}
            onClearFilter={() => setSelectedContractType("")}
          />
        )}

      {/* Footer Stats */}
      <DocumentsFooter
        filteredCount={filteredDocuments.length}
        totalCount={documents.length}
      />

      {/* Delete All Confirmation Dialog */}
      <DeleteAllModal
        isOpen={isDeleteAllDialogOpen}
        onClose={() => setIsDeleteAllDialogOpen(false)}
        onConfirm={handleDeleteAllDocuments}
      />
    </div>
  );
}
