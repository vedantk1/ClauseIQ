/**
 * PDF Resource Hook
 *
 * A React hook that provides:
 * - Automatic PDF fetching with authentication
 * - Blob URL management through PDF System Manager
 * - Loading states and error handling
 * - Automatic cleanup on unmount
 *
 * This hook integrates with the PDF System Manager for proper resource lifecycle.
 */

"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { pdfSystemManager } from "../utils/pdfSystemManager";

interface UsePDFResourceOptions {
  documentId: string;
  enabled?: boolean;
}

interface UsePDFResourceReturn {
  pdfUrl: string | null;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
}

export function usePDFResource({
  documentId,
  enabled = true,
}: UsePDFResourceOptions): UsePDFResourceReturn {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resourceIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Create resource ID for this hook instance
  const resourceId = `pdf-resource-${documentId}`;

  const fetchPDF = useCallback(async () => {
    if (!enabled || !documentId) {
      return;
    }

    // Abort any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsLoading(true);
    setError(null);

    try {
      console.log(`🔧 PDF Hook: Fetching PDF for document ${documentId}`);

      // Check if we already have this resource
      const existingUrl = pdfSystemManager.accessResource(resourceId);
      if (existingUrl) {
        console.log(`✅ PDF Hook: Using cached resource for ${documentId}`);
        setPdfUrl(existingUrl);
        setIsLoading(false);
        return;
      }

      // Get auth token
      const token = localStorage.getItem("access_token");
      if (!token) {
        throw new Error("Authentication required");
      }

      // Get API base URL from config
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

      // Fetch PDF from backend
      const response = await fetch(
        `${apiUrl}/api/v1/reports/documents/${documentId}/pdf`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: abortController.signal,
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Authentication failed");
        }
        if (response.status === 404) {
          throw new Error("Document not found");
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Convert response to blob
      const blob = await response.blob();
      console.log(
        `📄 PDF Hook: Received blob (${blob.size} bytes) for ${documentId}`
      );

      // Verify it's a PDF
      if (blob.type !== "application/pdf") {
        console.warn(`PDF Hook: Unexpected content type: ${blob.type}`);
      }

      // Create resource through system manager
      const url = await pdfSystemManager.createResource(resourceId, blob);
      resourceIdRef.current = resourceId;

      setPdfUrl(url);
      setIsLoading(false);

      console.log(
        `✅ PDF Hook: Successfully created resource ${resourceId} -> ${url}`
      );
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        console.log(`🛑 PDF Hook: Request aborted for ${documentId}`);
        return;
      }

      console.error(`❌ PDF Hook: Failed to fetch PDF for ${documentId}:`, err);
      setError(err instanceof Error ? err.message : "Failed to load PDF");
      setIsLoading(false);
    }
  }, [documentId, enabled, resourceId]);

  // Main effect for fetching PDF
  useEffect(() => {
    fetchPDF();

    // Cleanup function
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchPDF]);

  // Cleanup resource on unmount
  useEffect(() => {
    return () => {
      if (resourceIdRef.current) {
        console.log(
          `🧹 PDF Hook: Cleaning up resource ${resourceIdRef.current}`
        );
        pdfSystemManager.destroyResource(resourceIdRef.current);
      }
    };
  }, []);

  const retry = useCallback(() => {
    console.log(`🔄 PDF Hook: Retrying fetch for ${documentId}`);
    fetchPDF();
  }, [fetchPDF, documentId]);

  return {
    pdfUrl,
    isLoading,
    error,
    retry,
  };
}
