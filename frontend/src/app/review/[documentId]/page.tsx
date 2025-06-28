/**
 * 🏗️ FOUNDATIONAL ARCHITECTURE - ROUTE LAYER
 *
 * Responsibilities:
 * 1. Route parameter extraction ONLY
 * 2. Error boundary establishment ONLY
 * 3. Provider orchestration ONLY
 *
 * Does NOT handle:
 * - Data fetching
 * - Business logic
 * - UI state management
 * - Authentication (delegated to providers)
 */

import React from "react";
import { notFound } from "next/navigation";
import { AnalysisProvider } from "@/context/AnalysisContext";
import { AuthProvider } from "@/context/AuthContext";
import ReviewErrorBoundary from "@/components/error-boundaries/ReviewErrorBoundary";
import DocumentReviewProvider from "@/components/providers/DocumentReviewProvider";
import ReviewLayout from "@/components/review/ReviewLayout";

interface ReviewPageProps {
  params: {
    documentId: string;
  };
}

export default function ReviewPage({ params }: ReviewPageProps) {
  const { documentId } = params;

  // Validate document ID format (basic validation at route level)
  if (
    !documentId ||
    typeof documentId !== "string" ||
    documentId.trim() === ""
  ) {
    notFound();
  }

  return (
    <AuthProvider>
      <AnalysisProvider>
        <ReviewErrorBoundary documentId={documentId}>
          <DocumentReviewProvider documentId={documentId}>
            <ReviewLayout />
          </DocumentReviewProvider>
        </ReviewErrorBoundary>
      </AnalysisProvider>
    </AuthProvider>
  );
}

/**
 * 🎯 ARCHITECTURAL PRINCIPLES DEMONSTRATED:
 *
 * 1. Single Responsibility: Only handles route concerns
 * 2. Error Boundaries: Proper fault isolation
 * 3. Provider Pattern: Clean dependency injection
 * 4. Separation of Concerns: UI, data, and routing are separate
 * 5. Composability: Each layer can be tested independently
 */
