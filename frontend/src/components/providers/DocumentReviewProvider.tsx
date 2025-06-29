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

  useEffect(() => {
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

    // Document loading is now handled centrally in AnalysisContext with deduplication
    // No need to duplicate the logic here
    console.log(
      `📄 [DocumentReviewProvider] Auth complete for document ${documentId}`
    );
  }, [documentId, isAuthenticated, authLoading, router]);

  // Show loading state for auth only (document loading handled by child components)
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Authenticating...</p>
        </div>
      </div>
    );
  }

  // Render children when everything is ready
  return <>{children}</>;
}
