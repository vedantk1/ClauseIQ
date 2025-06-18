/**
 * Documents grid view component
 * Extracted from main documents page - handles grid layout of documents
 */

import type { DocumentItem, ViewMode } from "@/types/documents";
import { DocumentCard } from "./DocumentCard";

interface DocumentsGridProps {
  filteredDocuments: DocumentItem[];
  searchQuery: string;
  isSelectMode: boolean;
  selectedDocuments: Set<string>;
  loadingDocId: string | null;
  deletingDocId: string | null;
  viewMode: ViewMode;
  onViewDocument: (id: string) => void;
  onToggleSelection: (id: string) => void;
  onDeleteDocument: (id: string, name: string) => void;
}

export const DocumentsGrid = ({
  filteredDocuments,
  searchQuery,
  isSelectMode,
  selectedDocuments,
  loadingDocId,
  deletingDocId,
  viewMode,
  onViewDocument,
  onToggleSelection,
  onDeleteDocument,
}: DocumentsGridProps) => {
  if (viewMode === "grid") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDocuments.map((doc) => (
          <DocumentCard
            key={doc.id}
            document={doc}
            searchQuery={searchQuery}
            isSelectMode={isSelectMode}
            isSelected={selectedDocuments.has(doc.id)}
            isLoading={loadingDocId === doc.id}
            isDeleting={deletingDocId === doc.id}
            viewMode="grid"
            onDocumentClick={() => onViewDocument(doc.id)}
            onToggleSelection={() => onToggleSelection(doc.id)}
            onDelete={() => onDeleteDocument(doc.id, doc.filename)}
            onView={() => onViewDocument(doc.id)}
          />
        ))}
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-3">
      {filteredDocuments.map((doc) => (
        <DocumentCard
          key={doc.id}
          document={doc}
          searchQuery={searchQuery}
          isSelectMode={isSelectMode}
          isSelected={selectedDocuments.has(doc.id)}
          isLoading={loadingDocId === doc.id}
          isDeleting={deletingDocId === doc.id}
          viewMode="list"
          onDocumentClick={() => onViewDocument(doc.id)}
          onToggleSelection={() => onToggleSelection(doc.id)}
          onDelete={() => onDeleteDocument(doc.id, doc.filename)}
          onView={() => onViewDocument(doc.id)}
        />
      ))}
    </div>
  );
};
