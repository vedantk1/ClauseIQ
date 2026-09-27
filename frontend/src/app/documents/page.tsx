"use client";

import { Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useDocumentsData } from "@/hooks/useDocumentsData";
import { useDocumentsFiltering } from "@/hooks/useDocumentsFiltering";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { useDocumentOperations } from "@/hooks/useDocumentOperations";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { LibraryHeader } from "@/components/documents/LibraryHeader";
import { LibraryContent } from "@/components/documents/LibraryContent";
import { LibrarySearch } from "@/components/documents/LibrarySearch";
import { DeleteAllModal } from "@/components/documents/DeleteAllModal";
import { DeleteDocumentModal } from "@/components/documents/DeleteDocumentModal";
import { DeleteSelectedModal } from "@/components/documents/DeleteSelectedModal";
import styles from "@/components/documents/Library.module.css";

export default function Documents() {
  return <Suspense fallback={<div className={styles.library}><LibraryHeader /><p role="status">Loading Library…</p></div>}><DocumentsContent /></Suspense>;
}

function DocumentsContent() {
  const searchParams = useSearchParams();
  const { documents, setDocuments, loading, error, retryFetch } = useDocumentsData();
  const filtering = useDocumentsFiltering({ documents });
  const selection = useBulkSelection({ filteredDocuments: filtering.filteredDocuments });
  const [selectedId, setSelectedId] = useState("");
  const [view, setView] = useState<"browse" | "search">(searchParams.get("view") === "search" ? "search" : "browse");
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deleteSelectedOpen, setDeleteSelectedOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<{ id: string; name: string } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const operations = useDocumentOperations({
    setDocuments, setFilteredDocuments: () => {},
    selectedDocuments: selection.selectedDocuments,
    setSelectedDocuments: selection.setSelectedDocuments,
    setIsSelectMode: selection.setIsSelectMode,
  });
  const busy = operations.deletingAll || operations.deletingSelected || !!operations.deletingDocId;
  useKeyboardShortcuts({
    enabled: view === "browse",
    searchInputRef, isSelectMode: selection.isSelectMode, searchQuery: filtering.searchQuery,
    setSearchQuery: filtering.setSearchQuery, setIsSelectMode: selection.setIsSelectMode,
    setSelectedDocuments: selection.setSelectedDocuments, selectAllDocuments: selection.selectAllDocuments,
  });

  return <div className={styles.library}>
    <LibraryHeader />
    <LibraryContent searchPanel={<LibrarySearch />} view={view} onViewChange={setView} documents={documents} filteredDocuments={filtering.filteredDocuments}
      loading={loading} error={error} onRetry={() => void retryFetch()}
      selectedId={selectedId} onSelect={setSelectedId}
      searchQuery={filtering.searchQuery} onSearch={filtering.setSearchQuery} searchInputRef={searchInputRef}
      sortBy={filtering.sortBy} onSort={filtering.setSortBy}
      contractType={filtering.selectedContractType} contractTypes={filtering.getAvailableContractTypes()} onContractType={filtering.setSelectedContractType}
      isSelectMode={selection.isSelectMode} selectedDocuments={selection.selectedDocuments}
      onToggleSelectMode={selection.toggleSelectMode} onToggleSelection={selection.toggleDocumentSelection}
      onSelectAll={selection.selectAllDocuments} onClearSelection={selection.clearSelection}
      onDeleteSelected={() => setDeleteSelectedOpen(true)} onDeleteAll={() => setDeleteAllOpen(true)}
      onDelete={document => setDocumentToDelete({ id: document.id, name: document.filename })} busy={busy} />
    <DeleteAllModal isOpen={deleteAllOpen} onClose={() => setDeleteAllOpen(false)} deletingAll={operations.deletingAll}
      onConfirm={async () => { await operations.handleDeleteAllDocuments(); selection.clearSelection(); setDeleteAllOpen(false); }} />
    <DeleteSelectedModal isOpen={deleteSelectedOpen} onClose={() => setDeleteSelectedOpen(false)}
      selectedCount={selection.selectedDocuments.size} deleting={operations.deletingSelected}
      onConfirm={async () => { await operations.handleBulkDelete(); setDeleteSelectedOpen(false); }} />
    <DeleteDocumentModal isOpen={!!documentToDelete} onClose={() => setDocumentToDelete(null)}
      documentName={documentToDelete?.name || ""} deleting={!!operations.deletingDocId}
      onConfirm={async () => {
        if (documentToDelete) {
          await operations.handleDeleteDocument(documentToDelete.id);
          selection.clearSelection();
        }
        setDocumentToDelete(null);
      }} />
  </div>;
}
