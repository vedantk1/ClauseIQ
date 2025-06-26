"use client";
import React, { useState } from "react";
import { useAnalysis } from "@/context/AnalysisContext";
import { useRouter } from "next/navigation";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { useUserInteractions } from "@/hooks/useUserInteractions";
import { useClauseFiltering } from "@/hooks/useClauseFiltering";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/Tabs";
import Card from "@/components/Card";
import Button from "@/components/Button";
import Modal from "@/components/ui/Modal";
import DropdownMenu from "@/components/DropdownMenu";
import StructuredSummary from "@/components/StructuredSummary";
import DocumentInsights from "@/components/DocumentInsights";
import ClauseNavigator from "@/components/review/ClauseNavigator";
import ClauseDetailsPanel from "@/components/review/ClauseDetailsPanel";
import DocumentChat from "@/components/DocumentChat";
import { getClauseTypeLabel } from "@/components/review/clauseUtils";
import type { Clause } from "@shared/common_generated";
import toast from "react-hot-toast";
import apiClient from "@/lib/api";

export default function ReviewWorkspace() {
  const { isAuthenticated, isLoading } = useAuthRedirect();
  const { currentDocument, setSelectedClause } = useAnalysis();
  const router = useRouter();

  // Extract data from currentDocument for easier access
  const {
    filename: fileName,
    clauses,
    summary,
    structuredSummary,
    fullText,
    riskSummary,
    selectedClause,
    id: documentId,
    contract_type,
  } = currentDocument;

  // Safe access with defaults
  const safeRiskSummary = riskSummary || { high: 0, medium: 0, low: 0 };
  const safeRiskHigh = safeRiskSummary?.high ?? 0;
  const safeRiskMedium = safeRiskSummary?.medium ?? 0;
  const safeRiskLow = safeRiskSummary?.low ?? 0;
  const [clauseFilter, setClauseFilter] = useState<
    "all" | "high" | "medium" | "low"
  >("all");
  const [clauseTypeFilter, setClauseTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("document_order");
  const [activeTab, setActiveTab] = useState<string>("summary");

  // Use persistent user interactions hook instead of local state
  const {
    flaggedClauses,
    addNote,
    editNote,
    deleteNote,
    toggleFlag,
    hasNotes,
    getAllNotes,
    getNotesCount,
  } = useUserInteractions(documentId);

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isDownloadingOriginalPdf, setIsDownloadingOriginalPdf] =
    useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  // Function to handle risk card clicks - switch to clauses tab with filter
  const handleRiskCardClick = (riskLevel: "high" | "medium" | "low") => {
    setActiveTab("clauses");
    setClauseFilter(riskLevel);
  };

  // Use filtering hook for clause logic - moved to top to avoid conditional hook call
  const filteredClauses = useClauseFiltering({
    clauses: clauses || [],
    clauseFilter,
    clauseTypeFilter,
    searchQuery,
    sortBy,
    flaggedClauses,
  });

  // PDF Download function
  const handleDownloadPdf = async () => {
    if (!documentId) {
      // Defer toast to avoid state update during render
      setTimeout(() => {
        toast.error("No document available to generate report");
      }, 0);
      return;
    }

    setIsDownloadingPdf(true);
    try {
      // Get auth token from localStorage
      const accessToken = localStorage.getItem("access_token");
      if (!accessToken) {
        throw new Error("Authentication required");
      }

      // Get API base URL from config
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

      // Make direct fetch call for PDF download
      const response = await fetch(
        `${apiUrl}/api/v1/reports/documents/${documentId}/pdf`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to generate PDF: ${response.status}`);
      }

      // Get the PDF blob
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      // Generate filename
      const cleanFileName = (fileName || "document").replace(".pdf", "");
      link.download = `${cleanFileName}_analysis_report.pdf`;

      // Trigger download
      document.body.appendChild(link);
      link.click();

      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);

      // Defer toast to avoid state update during render
      setTimeout(() => {
        toast.success("PDF report downloaded successfully!");
      }, 0);
    } catch (error) {
      console.error("Error downloading PDF:", error);
      // Defer toast to avoid state update during render
      setTimeout(() => {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to download PDF report"
        );
      }, 0);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Download Original PDF function
  const handleDownloadOriginalPdf = async () => {
    if (!documentId) {
      setTimeout(() => {
        toast.error("No document available to download");
      }, 0);
      return;
    }

    setIsDownloadingOriginalPdf(true);
    try {
      // Get auth token from localStorage
      const accessToken = localStorage.getItem("access_token");
      if (!accessToken) {
        throw new Error("Authentication required");
      }

      // Get API base URL from config
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

      // Make direct fetch call for original PDF download
      const response = await fetch(
        `${apiUrl}/api/v1/documents/${documentId}/pdf`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Original PDF file not available for this document");
        }
        throw new Error(`Failed to download PDF: ${response.status}`);
      }

      // Get the PDF blob
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      // Use original filename or default
      link.download = fileName || "document.pdf";

      // Trigger download
      document.body.appendChild(link);
      link.click();

      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);

      setTimeout(() => {
        toast.success("Original document downloaded successfully!");
      }, 0);
    } catch (error) {
      console.error("Error downloading original PDF:", error);
      setTimeout(() => {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to download original PDF"
        );
      }, 0);
    } finally {
      setIsDownloadingOriginalPdf(false);
    }
  };

  // Delete Document Functions
  const handleDeleteDocument = () => {
    setShowDeleteConfirmation(true);
  };

  const handleConfirmDelete = async () => {
    if (!documentId) {
      setTimeout(() => {
        toast.error("No document available to delete");
      }, 0);
      return;
    }

    setIsDeleting(true);
    try {
      // Get auth token from localStorage
      const accessToken = localStorage.getItem("access_token");
      if (!accessToken) {
        throw new Error("Authentication required");
      }

      // Configure API client auth
      apiClient.setAuthTokenProvider(() => accessToken);

      // Call delete endpoint
      const response = await apiClient.delete(`/documents/${documentId}`);

      if (!response.success) {
        throw new Error(response.error?.message || "Failed to delete document");
      }

      setTimeout(() => {
        toast.success("Document deleted successfully!");
      }, 0);

      // Close modal and redirect to homepage
      setShowDeleteConfirmation(false);
      router.push("/");
    } catch (error) {
      console.error("Error deleting document:", error);
      setTimeout(() => {
        toast.error(
          error instanceof Error ? error.message : "Failed to delete document"
        );
      }, 0);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirmation(false);
  };

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-purple"></div>
      </div>
    );
  }

  // Don't render if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  // Handler functions for ClauseDetailsPanel
  const handleAddNote = async (clause: { id?: string }, noteText?: string) => {
    let note = noteText;
    if (!note) {
      // Fallback to prompt for backward compatibility (though we'll always pass noteText now)
      const promptResult = prompt("Add a note for this clause:");
      note = promptResult || undefined;
    }
    if (note && clause.id) {
      try {
        await addNote(clause.id, note);
      } catch {
        // Error handling is done in the hook
      }
    }
  };

  const handleDeleteNote = async (clause: { id?: string }, noteId?: string) => {
    if (clause.id && hasNotes(clause.id)) {
      const notes = getAllNotes(clause.id);
      const targetNoteId = noteId || notes[0]?.id;

      if (targetNoteId) {
        // Confirmation is now handled by the UI component
        try {
          await deleteNote(clause.id, targetNoteId);
        } catch {
          // Error handling is done in the hook
        }
      }
    }
  };

  const handleEditNote = async (
    clause: { id?: string },
    noteId?: string,
    editedText?: string
  ) => {
    if (clause.id && hasNotes(clause.id)) {
      const notes = getAllNotes(clause.id);
      const targetNote = noteId ? notes.find((n) => n.id === noteId) : notes[0];

      if (targetNote) {
        let updatedNote = editedText;
        if (!updatedNote) {
          // Fallback to prompt for backward compatibility (though we'll always pass editedText now)
          const promptResult = prompt("Edit your note:", targetNote.text);
          updatedNote = promptResult || undefined;
        }
        if (updatedNote && updatedNote !== targetNote.text) {
          if (updatedNote.trim() === "") {
            await handleDeleteNote(clause, targetNote.id);
          } else {
            try {
              await editNote(clause.id, targetNote.id, updatedNote);
            } catch {
              // Error handling is done in the hook
            }
          }
        }
      }
    }
  };

  const handleFlagForReview = async (
    clause: { id?: string },
    event?: React.MouseEvent
  ) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (clause.id) {
      try {
        await toggleFlag(clause.id);
      } catch {
        // Error handling is done in the hook
      }
    }
  };

  const handleCopyClause = async (clause: Clause) => {
    const textToCopy = `
CLAUSE ANALYSIS
===============
Type: ${getClauseTypeLabel(clause.clause_type)}
Risk Level: ${clause.risk_level?.toUpperCase() || "UNKNOWN"}

SUMMARY:
${clause.summary || "No summary available"}

RISK ASSESSMENT:
${clause.risk_assessment || "No risk assessment available"}

RECOMMENDATIONS:
${
  clause.recommendations
    ?.map((rec: string, i: number) => `${i + 1}. ${rec}`)
    .join("\n") || "No recommendations available"
}

FULL TEXT:
${clause.text || "No text available"}

${
  clause.id && hasNotes(clause.id)
    ? `\nYOUR NOTES:\n${getAllNotes(clause.id)
        .filter((note) => note && note.text)
        .map(
          (note, i) =>
            `${i + 1}. ${note.text}${
              note.created_at
                ? ` (${new Date(note.created_at).toLocaleDateString()})`
                : ""
            }`
        )
        .join("\n")}`
    : ""
}

Generated by ClauseIQ on ${new Date().toLocaleDateString()}
    `.trim();

    try {
      await navigator.clipboard.writeText(textToCopy);
      setTimeout(() => {
        toast.success("Clause analysis copied to clipboard");
      }, 0);
    } catch {
      setTimeout(() => {
        toast.error("Failed to copy to clipboard");
      }, 0);
    }
  };

  if (!summary && !fileName && (!clauses || clauses.length === 0)) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center p-6">
        <Card className="text-center max-w-md mx-auto">
          <div className="mb-6">
            <svg
              className="w-16 h-16 text-text-secondary mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h2 className="font-heading text-heading-sm text-text-primary mb-2">
              No document to review
            </h2>
            <p className="text-text-secondary">
              Upload a contract to start your analysis and see detailed insights
              here.
            </p>
          </div>
          <Button onClick={() => router.push("/")}>Upload a Document</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="font-heading text-heading-md text-text-primary mb-2">
              Contract Review
            </h1>
            <div className="flex items-center gap-3">
              <span className="text-text-secondary">
                {fileName || "Uploaded Document"}
              </span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-accent-green rounded-full"></div>
                <span className="text-sm text-accent-green font-medium">
                  Analyzed
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Primary Action - Export Analysis (Always Visible) */}
            <Button
              variant="secondary"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="flex items-center gap-2"
            >
              {isDownloadingPdf ? (
                <>
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                  <span className="hidden sm:inline">Generating...</span>
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span className="hidden sm:inline">Export Analysis</span>
                  <span className="sm:hidden">Export</span>
                </>
              )}
            </Button>

            {/* Kebab Menu for All Other Actions */}
            <DropdownMenu
              align="right"
              trigger={
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                  />
                </svg>
              }
              items={[
                {
                  label: isDownloadingOriginalPdf
                    ? "Downloading..."
                    : "Download Document",
                  icon: (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  ),
                  onClick: handleDownloadOriginalPdf,
                  disabled: isDownloadingOriginalPdf,
                },
                {
                  label: "Upload Another",
                  icon: (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                  ),
                  onClick: () => router.push("/"),
                },
                {
                  label: isDeleting ? "Deleting..." : "Delete Document",
                  icon: (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  ),
                  onClick: handleDeleteDocument,
                  disabled: isDeleting,
                  variant: "danger" as const,
                },
              ]}
            />
          </div>
        </div>

        {/* Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="clauses">Clauses</TabsTrigger>
            <TabsTrigger value="chat">Ask Questions</TabsTrigger>
          </TabsList>

          {/* Summary Tab */}
          <TabsContent value="summary">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                {/* New Structured Summary Component */}
                <StructuredSummary
                  structuredSummary={structuredSummary}
                  fallbackSummary={summary}
                />
              </div>

              {/* Enhanced Sidebar */}
              <div className="space-y-6">
                {/* Enhanced Document Insights Component */}
                <DocumentInsights
                  structuredSummary={structuredSummary}
                  fileName={fileName}
                  fullText={fullText}
                  clauseCount={clauses?.length || 0}
                  riskSummary={safeRiskSummary}
                  clauses={clauses}
                />

                {/* Keep existing Key Metrics for backward compatibility */}
                <Card density="compact">
                  <h3 className="font-heading text-lg text-text-primary mb-4">
                    Risk Overview
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Overall Risk</span>
                      <span
                        className={`font-medium ${
                          safeRiskHigh > 0
                            ? "text-accent-rose"
                            : safeRiskMedium > 0
                            ? "text-accent-amber"
                            : safeRiskLow > 0
                            ? "text-accent-green"
                            : "text-text-secondary"
                        }`}
                      >
                        {safeRiskHigh > 0
                          ? "High"
                          : safeRiskMedium > 0
                          ? "Medium"
                          : safeRiskLow > 0
                          ? "Low"
                          : "Not analyzed"}
                      </span>
                    </div>
                  </div>
                </Card>

                {/* Clause Insights */}
                {clauses && clauses.length > 0 && (
                  <Card density="compact">
                    <h3 className="font-heading text-lg text-text-primary mb-4">
                      Clause Insights
                    </h3>
                    <div className="space-y-3">
                      {safeRiskHigh > 0 && (
                        <div
                          className="flex items-center gap-2 p-2 rounded bg-accent-rose/10 cursor-pointer hover:bg-accent-rose/15 transition-colors"
                          onClick={() => handleRiskCardClick("high")}
                          title="Click to view high-risk clauses"
                        >
                          <div className="w-2 h-2 bg-accent-rose rounded-full"></div>
                          <span className="text-sm text-accent-rose font-medium">
                            {safeRiskHigh} high-risk clause
                            {safeRiskHigh > 1 ? "s" : ""} found
                          </span>
                        </div>
                      )}
                      {safeRiskMedium > 0 && (
                        <div
                          className="flex items-center gap-2 p-2 rounded bg-accent-amber/10 cursor-pointer hover:bg-accent-amber/15 transition-colors"
                          onClick={() => handleRiskCardClick("medium")}
                          title="Click to view medium-risk clauses"
                        >
                          <div className="w-2 h-2 bg-accent-amber rounded-full"></div>
                          <span className="text-sm text-accent-amber font-medium">
                            {safeRiskMedium} medium-risk clause
                            {safeRiskMedium > 1 ? "s" : ""} to review
                          </span>
                        </div>
                      )}
                      {safeRiskLow > 0 && (
                        <div
                          className="flex items-center gap-2 p-2 rounded bg-accent-green/10 cursor-pointer hover:bg-accent-green/15 transition-colors"
                          onClick={() => handleRiskCardClick("low")}
                          title="Click to view low-risk clauses"
                        >
                          <div className="w-2 h-2 bg-accent-green rounded-full"></div>
                          <span className="text-sm text-accent-green font-medium">
                            {safeRiskLow} low-risk clause
                            {safeRiskLow > 1 ? "s" : ""} look good
                          </span>
                        </div>
                      )}
                    </div>
                  </Card>
                )}

                <Card density="compact">
                  <h3 className="font-heading text-lg text-text-primary mb-4">
                    Quick Actions
                  </h3>
                  <div className="space-y-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full justify-start"
                      onClick={handleDownloadPdf}
                      disabled={isDownloadingPdf}
                      loading={isDownloadingPdf}
                    >
                      <svg
                        className="w-4 h-4 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      {isDownloadingPdf
                        ? "Generating PDF..."
                        : "Download PDF Report"}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full justify-start"
                      onClick={handleDownloadOriginalPdf}
                      disabled={isDownloadingOriginalPdf}
                      loading={isDownloadingOriginalPdf}
                    >
                      <svg
                        className="w-4 h-4 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
                        />
                      </svg>
                      {isDownloadingOriginalPdf
                        ? "Downloading Original PDF..."
                        : "Download Original PDF"}
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Clauses Tab */}
          <TabsContent value="clauses">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Clause Navigator */}
              <ClauseNavigator
                clauses={clauses || []}
                filteredClauses={filteredClauses}
                selectedClause={selectedClause}
                onClauseSelect={setSelectedClause}
                riskSummary={safeRiskSummary}
                clauseFilter={clauseFilter}
                onClauseFilterChange={setClauseFilter}
                clauseTypeFilter={clauseTypeFilter}
                onClauseTypeFilterChange={setClauseTypeFilter}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                sortBy={sortBy}
                onSortByChange={setSortBy}
                flaggedClauses={flaggedClauses}
                hasNotes={hasNotes}
                contractType={contract_type}
              />

              {/* Clause Details */}
              <ClauseDetailsPanel
                selectedClause={selectedClause}
                flaggedClauses={flaggedClauses}
                hasNotes={hasNotes}
                getAllNotes={getAllNotes}
                getNotesCount={getNotesCount}
                onAddNote={handleAddNote}
                onEditNote={handleEditNote}
                onDeleteNote={handleDeleteNote}
                onFlagForReview={handleFlagForReview}
                onCopyClause={handleCopyClause}
              />
            </div>
          </TabsContent>

          {/* Chat Tab */}
          <TabsContent value="chat">
            <Card>
              <h2 className="font-heading text-heading-sm text-text-primary mb-6">
                Ask Questions About Your Contract
              </h2>
              <DocumentChat documentId={documentId || ""} />
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      {/* End main content */}
      {/* Subtle regulatory disclaimer at the very bottom, not fixed */}
      <div className="w-full flex justify-center mt-8 mb-2">
        <span
          className="text-xs text-text-tertiary text-center"
          style={{ letterSpacing: "0.01em" }}
          aria-label="Regulatory Disclosure"
        >
          AI-generated analysis – verify before reliance
        </span>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirmation}
        onClose={handleCancelDelete}
        title="Delete Document"
        size="md"
        className="text-center"
      >
        <div className="space-y-4">
          <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
            <svg
              className="w-6 h-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              Are you sure?
            </h3>
            <p className="text-text-secondary">
              This will permanently delete &ldquo;{fileName || "this document"}
              &rdquo; and all its analysis data. This action cannot be undone.
            </p>
          </div>
          <div className="flex gap-3 justify-center pt-4">
            <Button
              variant="secondary"
              onClick={handleCancelDelete}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                  Deleting...
                </>
              ) : (
                "Delete Document"
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
