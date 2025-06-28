/**
 * Custom hook for managing document data fetching and state
 * Extracted from documents page to separate data concerns
 */

import { useState, useEffect } from "react";
import { useApiCall } from "@/lib/apiUtils";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import toast from "react-hot-toast";
import type { DocumentItem } from "@/types/documents";

export const useDocumentsData = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuthRedirect();
  const apiCall = useApiCall();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = async () => {
    try {
      const res = await apiCall(`/documents/`);

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(
          `Error retrieving documents: ${res.status} - ${errorText}`
        );
      }

      const data = (await res.json()) as {
        error?: string;
        documents?: DocumentItem[];
      };

      if (data.error) {
        throw new Error(data.error);
      }

      const docs = data.documents || [];
      setDocuments(docs);
    } catch (err) {
      console.error("Failed to fetch documents:", err);
      setError(err instanceof Error ? err.message : "Failed to load documents");
      toast.error("Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  const retryFetch = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await apiCall(`/documents/`);

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(
          `Error retrieving documents: ${res.status} - ${errorText}`
        );
      }

      const data = (await res.json()) as {
        error?: string;
        documents?: DocumentItem[];
      };

      if (data.error) {
        throw new Error(data.error);
      }

      const docs = data.documents || [];
      setDocuments(docs);
    } catch (err) {
      console.error("Failed to fetch documents:", err);
      setError(err instanceof Error ? err.message : "Failed to load documents");
      toast.error("Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      fetchDocuments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated]); // Intentionally omitting apiCall to prevent infinite loop

  return {
    documents,
    setDocuments,
    loading,
    error,
    retryFetch,
    isAuthenticated,
    authLoading,
  };
};
