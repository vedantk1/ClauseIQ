/**
 * 🏗️ DOCUMENT REVIEW PROVIDER
 *
 * Responsibilities:
 * 1. Document loading orchestration
 * 2. Document-specific state management
 * 3. Error handling for document operations
 * 4. Authentication enforcement
 *
 * Architectural Benefits:
 * - Centralizes document loading logic
 * - Provides clean separation from UI
 * - Enables testing of business logic
 * - Consistent error handling
 */

"use client";
import React, { useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAnalysis } from "@/context/AnalysisContext";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";

interface DocumentReviewProviderProps {
  documentId: string;
  children: ReactNode;
}

export default function DocumentReviewProvider({
  documentId,
  children,
}: DocumentReviewProviderProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { currentDocument, loadDocument } = useAnalysis();
  const [isDocumentLoading, setIsDocumentLoading] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);

  useEffect(() => {
    const loadDocumentIfNeeded = async () => {
      // Wait for auth to complete
      if (authLoading) {
        console.log(
          `🔄 [DocumentReviewProvider] Auth still loading, waiting...`
        );
        return;
      }

      // Redirect if not authenticated
      if (!isAuthenticated) {
        console.log(
          "🔒 [DocumentReviewProvider] User not authenticated, redirecting to login"
        );
        router.push("/auth/login");
        return;
      }

      // Skip if document is already loaded
      if (currentDocument.id === documentId) {
        console.log(
          `📄 [DocumentReviewProvider] Document ${documentId} already loaded`
        );
        return;
      }

      try {
        setIsDocumentLoading(true);
        setDocumentError(null);

        console.log(
          `📄 [DocumentReviewProvider] Loading document ${documentId}`
        );

        // Use only the AnalysisContext method - avoid duplicate API calls
        await loadDocument(documentId);
        console.log(
          `✅ [DocumentReviewProvider] Document ${documentId} loaded successfully`
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "An unexpected error occurred";
        console.error(
          `❌ [DocumentReviewProvider] Unexpected error loading document ${documentId}:`,
          error
        );

        setDocumentError(errorMessage);
        toast.error("Failed to load document. Please try again.");

        // Redirect to documents page on error
        router.push("/documents");
      } finally {
        setIsDocumentLoading(false);
      }
    };

    loadDocumentIfNeeded();
  }, [
    documentId,
    isAuthenticated,
    authLoading,
    currentDocument.id,
    loadDocument,
    router,
  ]);

  // Show loading state
  if (authLoading || isDocumentLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {authLoading ? "Authenticating..." : "Loading document..."}
          </p>
        </div>
      </div>
    );
  }

  // Show error state
  if (documentError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Failed to Load Document
          </h2>
          <p className="text-gray-600 mb-4">{documentError}</p>
          <button
            onClick={() => router.push("/documents")}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Back to Documents
          </button>
        </div>
      </div>
    );
  }

  // Render children when everything is ready
  return <>{children}</>;
}
