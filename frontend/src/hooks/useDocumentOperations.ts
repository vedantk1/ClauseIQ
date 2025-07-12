/**
 * Custom hook for managing individual document operations (view, delete)
 * Extracted from documents page to separate operation concerns
 */

import { useState } from "react";
import { useAnalysis } from "@/context/AnalysisContext";
import { useApiCall } from "@/lib/apiUtils";
import toast from "react-hot-toast";
import type { DocumentItem } from "@/types/documents";

interface UseDocumentOperationsProps {
  setDocuments: React.Dispatch<React.SetStateAction<DocumentItem[]>>;
  setFilteredDocuments: React.Dispatch<React.SetStateAction<DocumentItem[]>>;
  selectedDocuments: Set<string>;
  setSelectedDocuments: React.Dispatch<React.SetStateAction<Set<string>>>;
  setIsSelectMode: React.Dispatch<React.SetStateAction<boolean>>;
  onDeleteDocument?: (documentId: string, documentName: string) => void;
}

export const useDocumentOperations = ({
  setDocuments,
  setFilteredDocuments,
  selectedDocuments,
  setSelectedDocuments,
  setIsSelectMode,
  onDeleteDocument,
}: UseDocumentOperationsProps) => {
  const { loadDocument } = useAnalysis();
  const apiCall = useApiCall();
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);

  const handleViewDocument = async (documentId: string) => {
    try {
      setLoadingDocId(documentId);
      // Use the AnalysisContext loadDocument method
      await loadDocument(documentId);
      window.open(`/review?documentId=${documentId}`, "_blank");
      toast.success("Document loaded successfully!");
    } catch (err) {
      console.error("Failed to fetch document:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to load document"
      );
    } finally {
      setLoadingDocId(null);
    }
  };

  const initiateDeleteDocument = (documentId: string, documentName: string) => {
    // This function will trigger the modal
    if (onDeleteDocument) {
      onDeleteDocument(documentId, documentName);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    try {
      setDeletingDocId(documentId);
      const res = await apiCall(`/documents/${documentId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(
          `Error deleting document: ${res.status} - ${errorText}`
        );
      }

      // Remove the document from the local state
      setDocuments((prevDocs) =>
        prevDocs.filter((doc) => doc.id !== documentId)
      );
      setFilteredDocuments((prevDocs) =>
        prevDocs.filter((doc) => doc.id !== documentId)
      );

      toast.success("Document deleted successfully!");
    } catch (err) {
      console.error("Failed to delete document:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to delete document"
      );
    } finally {
      setDeletingDocId(null);
    }
  };

  const handleDeleteAllDocuments = async () => {
    try {
      setDeletingAll(true);
      const res = await apiCall(`/documents`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(
          `Error deleting documents: ${res.status} - ${errorText}`
        );
      }

      const result = (await res.json()) as { message?: string };

      // Clear all documents from the local state
      setDocuments([]);
      setFilteredDocuments([]);

      toast.success(result.message || "All documents deleted successfully!");
    } catch (err) {
      console.error("Failed to delete all documents:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to delete all documents"
      );
    } finally {
      setDeletingAll(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedDocuments.size === 0) return;

    const selectedCount = selectedDocuments.size;
    if (
      !window.confirm(
        `Are you sure you want to delete ${selectedCount} selected document${
          selectedCount > 1 ? "s" : ""
        }? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      const deletePromises = Array.from(selectedDocuments).map(
        async (docId) => {
          const res = await apiCall(`/documents/${docId}`, {
            method: "DELETE",
          });
          if (!res.ok) {
            const errorText = await res.text();
            throw new Error(
              `Error deleting document ${docId}: ${res.status} - ${errorText}`
            );
          }
        }
      );

      await Promise.all(deletePromises);

      // Remove deleted documents from local state
      setDocuments((prev) =>
        prev.filter((doc) => !selectedDocuments.has(doc.id))
      );
      setFilteredDocuments((prev) =>
        prev.filter((doc) => !selectedDocuments.has(doc.id))
      );

      // Clear selection and exit select mode
      setSelectedDocuments(new Set());
      setIsSelectMode(false);

      toast.success(
        `${selectedCount} document${
          selectedCount > 1 ? "s" : ""
        } deleted successfully!`
      );
    } catch (err) {
      console.error("Failed to delete documents:", err);
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to delete selected documents"
      );
    }
  };

  return {
    loadingDocId,
    deletingDocId,
    deletingAll,
    handleViewDocument,
    initiateDeleteDocument,
    handleDeleteDocument,
    handleDeleteAllDocuments,
    handleBulkDelete,
  };
};
