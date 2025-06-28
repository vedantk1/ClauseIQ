/**
 * 🎨 REVIEW LAYOUT COMPONENT
 *
 * Responsibilities:
 * 1. Main review page layout and UI structure
 * 2. Sidebar and content area orchestration
 * 3. User interaction handling
 * 4. State management for UI elements
 *
 * Architectural Benefits:
 * - Pure presentational component
 * - Consumes data from context only
 * - Testable UI logic
 * - Clean separation from business logic
 */

"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAnalysis } from "@/context/AnalysisContext";
import { useUserInteractions } from "@/hooks/useUserInteractions";
import { useClauseFiltering } from "@/hooks/useClauseFiltering";
import Card from "@/components/Card";
import Button from "@/components/Button";
import Modal from "@/components/ui/Modal";
import DropdownMenu from "@/components/DropdownMenu";
import InteractivePDFViewer from "@/components/InteractivePDFViewer";
import ReviewSidebar from "@/components/ReviewSidebar";
import SummaryContent from "@/components/review/SummaryContent";
import ClausesContent from "@/components/review/ClausesContent";
import ChatContent from "@/components/review/ChatContent";
import { getClauseTypeLabel } from "@/components/review/clauseUtils";
import { documentService } from "@/services/documentService";
import type { Clause } from "@shared/common_generated";
import toast from "react-hot-toast";

export default function ReviewLayout() {
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
  const safeRiskSummary = {
    high: riskSummary?.high ?? 0,
    medium: riskSummary?.medium ?? 0,
    low: riskSummary?.low ?? 0,
  };

  // UI State
  const [clauseFilter, setClauseFilter] = useState<
    "all" | "high" | "medium" | "low"
  >("all");
  const [clauseTypeFilter, setClauseTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("document_order");
  const [activeSidebarTab, setActiveSidebarTab] = useState<string | null>(
    "summary"
  );
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Document operation states
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isDownloadingOriginalPdf, setIsDownloadingOriginalPdf] =
    useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  // Hooks for user interactions and filtering
  const {
    flaggedClauses,
    hasNotes,
    getAllNotes,
    getNotesCount,
    addNote,
    editNote,
    deleteNote,
    toggleFlag,
  } = useUserInteractions(documentId || "");

  const filteredClauses = useClauseFiltering({
    clauses: clauses || [],
    clauseFilter,
    clauseTypeFilter,
    searchQuery,
    sortBy,
    flaggedClauses,
  });

  // Event Handlers
  const handleRiskCardClick = (riskLevel: "high" | "medium" | "low") => {
    setActiveSidebarTab("clauses");
    setClauseFilter(riskLevel);
  };

  const handleDownloadPdf = async () => {
    if (!documentId) {
      toast.error("No document available to export");
      return;
    }

    setIsDownloadingPdf(true);
    try {
      const result = await documentService.downloadPDFReport(
        documentId,
        fileName
      );

      if (result.success && result.blob && result.filename) {
        // Create download link
        const url = window.URL.createObjectURL(result.blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = result.filename;

        // Trigger download
        document.body.appendChild(link);
        link.click();

        // Cleanup
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);

        toast.success("Analysis report downloaded successfully!");
      } else {
        toast.error(result.error?.message || "Failed to download PDF report");
      }
    } catch (error) {
      console.error("Error downloading PDF report:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to download PDF report"
      );
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleDownloadOriginalPdf = async () => {
    if (!documentId) {
      toast.error("No document available to download");
      return;
    }

    setIsDownloadingOriginalPdf(true);
    try {
      const result = await documentService.downloadOriginalPDF(
        documentId,
        fileName
      );

      if (result.success && result.blob && result.filename) {
        // Create download link
        const url = window.URL.createObjectURL(result.blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = result.filename;

        // Trigger download
        document.body.appendChild(link);
        link.click();

        // Cleanup
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);

        toast.success("Original document downloaded successfully!");
      } else {
        toast.error(result.error?.message || "Failed to download original PDF");
      }
    } catch (error) {
      console.error("Error downloading original PDF:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to download original PDF"
      );
    } finally {
      setIsDownloadingOriginalPdf(false);
    }
  };

  const handleDeleteDocument = () => {
    setShowDeleteConfirmation(true);
  };

  const handleConfirmDelete = async () => {
    if (!documentId) {
      toast.error("No document available to delete");
      return;
    }

    setIsDeleting(true);
    try {
      const result = await documentService.deleteDocument(documentId);

      if (result.success) {
        toast.success("Document deleted successfully!");
        router.push("/documents");
      } else {
        toast.error(result.error?.message || "Failed to delete document");
      }
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete document"
      );
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirmation(false);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirmation(false);
  };

  // Note interaction handlers
  const handleAddNote = async (clause: { id?: string }) => {
    if (clause.id) {
      const noteText = prompt("Add a note for this clause:");
      if (noteText && noteText.trim() !== "") {
        try {
          await addNote(clause.id, noteText.trim());
        } catch {
          // Error handling is done in the hook
        }
      }
    }
  };

  const handleEditNote = async (clause: { id?: string }) => {
    if (clause.id && hasNotes(clause.id)) {
      const notes = getAllNotes(clause.id);
      if (notes.length > 0) {
        const targetNote = notes[0]; // Edit the first note for simplicity
        const updatedNote = prompt("Edit your note:", targetNote.text);

        if (updatedNote !== null) {
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

  const handleDeleteNote = async (clause: { id?: string }, noteId?: string) => {
    if (clause.id && noteId) {
      try {
        await deleteNote(clause.id, noteId);
      } catch {
        // Error handling is done in the hook
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
    .join("\\n") || "No recommendations available"
}

FULL TEXT:
${clause.text || "No text available"}

${
  clause.id && hasNotes(clause.id)
    ? `\\nYOUR NOTES:\\n${getAllNotes(clause.id)
        .filter((note) => note && note.text)
        .map(
          (note, i) =>
            `${i + 1}. ${note.text}${
              note.created_at
                ? ` (${new Date(note.created_at).toLocaleDateString()})`
                : ""
            }`
        )
        .join("\\n")}`
    : ""
}

Generated by ClauseIQ on ${new Date().toLocaleDateString()}
    `.trim();

    try {
      await navigator.clipboard.writeText(textToCopy);
      toast.success("Clause analysis copied to clipboard");
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  // Early return for empty state
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

  // Define sidebar tabs
  const sidebarTabs = [
    {
      id: "summary",
      label: "Summary",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
      content: (
        <SummaryContent
          structuredSummary={structuredSummary || undefined}
          summary={summary}
          fileName={fileName}
          fullText={fullText}
          clauses={clauses}
          riskSummary={safeRiskSummary}
          onRiskCardClick={handleRiskCardClick}
          onDownloadPdf={handleDownloadPdf}
          onDownloadOriginalPdf={handleDownloadOriginalPdf}
          isDownloadingPdf={isDownloadingPdf}
          isDownloadingOriginalPdf={isDownloadingOriginalPdf}
        />
      ),
    },
    {
      id: "clauses",
      label: "Clauses",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 10h16M4 14h16M4 18h16"
          />
        </svg>
      ),
      content: (
        <ClausesContent
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
          getAllNotes={getAllNotes}
          getNotesCount={getNotesCount}
          contractType={contract_type}
          onAddNote={handleAddNote}
          onEditNote={handleEditNote}
          onDeleteNote={handleDeleteNote}
          onFlagForReview={handleFlagForReview}
          onCopyClause={handleCopyClause}
        />
      ),
    },
    {
      id: "chat",
      label: "Ask Questions",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      ),
      content: <ChatContent documentId={documentId || ""} />,
    },
  ];

  return (
    <div className="min-h-screen bg-bg-primary flex">
      {/* Canva-inspired Layout: Vertical Sidebar + Main Content */}
      <div className="flex-1 flex">
        {/* ReviewSidebar - Controlled width container */}
        <div
          className={`
          ${
            isSidebarCollapsed || !activeSidebarTab
              ? "w-16"
              : "w-[60%] min-w-[400px] max-w-[800px]"
          } 
          transition-all duration-300 ease-in-out flex-shrink-0
        `}
        >
          <ReviewSidebar
            activeTab={activeSidebarTab}
            onTabChange={setActiveSidebarTab}
            tabs={sidebarTabs}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="h-screen"
          />
        </div>

        {/* Main Document Area - Takes remaining space */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Compact Header */}
          <div className="border-b border-border-light bg-bg-primary px-6 py-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="font-heading text-heading-sm text-text-primary mb-1">
                  Contract Review
                </h1>
                <div className="flex items-center gap-3">
                  <span className="text-text-secondary text-sm">
                    {fileName || "Uploaded Document"}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-accent-green rounded-full"></div>
                    <span className="text-xs text-accent-green font-medium">
                      Analyzed
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Primary Action - Export Analysis */}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDownloadPdf}
                  disabled={isDownloadingPdf}
                  className="flex items-center gap-2"
                >
                  {isDownloadingPdf ? (
                    <>
                      <div className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                      <span className="hidden sm:inline">Generating...</span>
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-3 h-3"
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
                      <span>Export Analysis</span>
                    </>
                  )}
                </Button>

                {/* Kebab Menu for Other Actions */}
                <DropdownMenu
                  align="right"
                  trigger={
                    <div
                      role="button"
                      tabIndex={0}
                      className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8 p-2 cursor-pointer"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                        }
                      }}
                    >
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
                          d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                        />
                      </svg>
                    </div>
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
          </div>

          {/* PDF Viewer - Always visible, takes main space */}
          <div className="flex-1 bg-gray-50">
            <InteractivePDFViewer
              documentId={documentId || ""}
              fileName={fileName}
              onClose={() => {}} // No close needed since it's always visible
              className="h-full"
            />
          </div>
        </div>
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
