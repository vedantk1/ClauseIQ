"use client";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useAnalysis } from "@/context/AnalysisContext";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { useUserInteractions } from "@/hooks/useUserInteractions";
import { useClauseFiltering } from "@/hooks/useClauseFiltering";
import Card from "@/components/Card";
import Button from "@/components/Button";
import Modal from "@/components/ui/Modal";
import ContinuousScrollPDFViewer from "@/components/ContinuousScrollPDFViewer";
import ReviewSidebar from "@/components/ReviewSidebar";
import SummaryContent from "@/components/review/SummaryContent";
import ClausesContent from "@/components/review/ClausesContent";
import ChatContent from "@/components/review/ChatContent";
import { getClauseTypeLabel } from "@/components/review/clauseUtils";
import type { Clause } from "@shared/common_generated";
import toast from "react-hot-toast";
import apiClient from "@/lib/api";

export default function ReviewWorkspace() {
  const { isAuthenticated, isLoading } = useAuthRedirect();
  const { currentDocument, setSelectedClause, loadDocument } = useAnalysis();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Load document when component mounts or documentId changes
  useEffect(() => {
    const loadDocumentIfNeeded = async () => {
      if (!isAuthenticated || isLoading) return;

      const documentId = searchParams.get("documentId");

      // If no document ID in URL, redirect to documents page
      if (!documentId) {
        console.log("📄 No document ID in URL, redirecting to documents page");
        router.push("/documents");
        return;
      }

      // If no document is loaded or a different document is loaded, load the requested one
      if (!currentDocument.id || currentDocument.id !== documentId) {
        try {
          console.log(`📄 Loading document ${documentId} for review page`);
          await loadDocument(documentId);
          console.log(`✅ Document ${documentId} loaded successfully`);
        } catch (error) {
          console.error(`❌ Failed to load document ${documentId}:`, error);
          toast.error("Failed to load document. Please try again.");
          // Redirect back to documents page on error
          router.push("/documents");
        }
      }
    };

    loadDocumentIfNeeded();
  }, [
    searchParams,
    isAuthenticated,
    isLoading,
    currentDocument.id,
    loadDocument,
    router,
  ]);

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

  // Safe access with defaults - now memoized
  const safeRiskSummary = useMemo(
    () => riskSummary || { high: 0, medium: 0, low: 0 },
    [riskSummary]
  );
  const [clauseFilter, setClauseFilter] = useState<
    "all" | "high" | "medium" | "low"
  >("all");
  const [clauseTypeFilter, setClauseTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("document_order");

  // Sidebar state for new Canva-inspired layout
  const [activeSidebarTab, setActiveSidebarTab] = useState<string | null>(
    "summary"
  );
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Section state management for persistent expanded/collapsed state
  const [sectionStates, setSectionStates] = useState<Record<string, boolean>>({
    summary: true, // Default expanded
    "key-parties": false,
    "important-dates": false,
    "major-obligations": false,
    "risk-highlights": false,
    "key-insights": false,
  });

  // Memoized handler for section toggle to prevent unnecessary recreations
  const handleSectionToggle = useCallback(
    (sectionId: string, isExpanded: boolean) => {
      setSectionStates((prev) => ({
        ...prev,
        [sectionId]: isExpanded,
      }));
    },
    []
  );

  // Clear selected clause when switching away from clauses tab or when sidebar collapses
  useEffect(() => {
    if (activeSidebarTab !== "clauses" || isSidebarCollapsed) {
      setSelectedClause(null);
    }
  }, [activeSidebarTab, isSidebarCollapsed, setSelectedClause]);

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

  // Use filtering hook for clause logic - moved to top to avoid conditional hook call
  const filteredClauses = useClauseFiltering({
    clauses: clauses || [],
    clauseFilter,
    clauseTypeFilter,
    searchQuery,
    sortBy,
    flaggedClauses,
  });

  // Memoize tab content to prevent component recreation and state loss
  const summaryContent = useMemo(
    () => (
      <SummaryContent
        structuredSummary={structuredSummary || undefined}
        summary={summary}
        fullText={fullText}
        clauses={clauses}
        riskSummary={{
          high: safeRiskSummary?.high ?? 0,
          medium: safeRiskSummary?.medium ?? 0,
          low: safeRiskSummary?.low ?? 0,
        }}
        sectionStates={sectionStates}
        onSectionToggle={handleSectionToggle}
        onClausesClick={() => setActiveSidebarTab("clauses")}
      />
    ),
    [
      structuredSummary,
      summary,
      fullText,
      clauses,
      safeRiskSummary,
      sectionStates,
      handleSectionToggle,
      setActiveSidebarTab,
    ]
  );

  // PDF Download function
  const handleDownloadPdf = useCallback(async () => {
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
  }, [documentId, fileName]);

  // Download Original PDF function
  const handleDownloadOriginalPdf = useCallback(async () => {
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
  }, [documentId, fileName]);

  // Delete Document Functions
  const handleDeleteDocument = useCallback(() => {
    setShowDeleteConfirmation(true);
  }, []);

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

  // Memoize dropdown menu items for PDF viewer
  const pdfViewerDropdownItems = useMemo(
    () => [
      {
        label: isDownloadingPdf ? "Generating..." : "Export Analysis",
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
        onClick: handleDownloadPdf,
        disabled: isDownloadingPdf,
      },
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
    ],
    [
      isDownloadingPdf,
      isDownloadingOriginalPdf,
      isDeleting,
      handleDownloadPdf,
      handleDownloadOriginalPdf,
      handleDeleteDocument,
      router,
    ]
  );

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
    if (noteText && clause.id) {
      try {
        await addNote(clause.id, noteText);
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

      if (targetNote && editedText && editedText !== targetNote.text) {
        if (editedText.trim() === "") {
          await handleDeleteNote(clause, targetNote.id);
        } else {
          try {
            await editNote(clause.id, targetNote.id, editedText);
          } catch {
            // Error handling is done in the hook
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

  // Define sidebar tabs for new Canva-inspired layout
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
      content: summaryContent,
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
          riskSummary={{
            high: safeRiskSummary?.high ?? 0,
            medium: safeRiskSummary?.medium ?? 0,
            low: safeRiskSummary?.low ?? 0,
          }}
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
    <div className="h-screen bg-bg-primary flex">
      {/* Canva-inspired Layout: Vertical Sidebar + Main Content */}
      <div className="flex-1 flex">
        {/* ReviewSidebar - Controlled width container */}
        <div
          className={`
          ${
            isSidebarCollapsed || !activeSidebarTab
              ? "w-16"
              : "w-1/3 min-w-[360px] max-w-[550px]"
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
            onExpandAndSelectTab={(tabId) => {
              setActiveSidebarTab(tabId);
              setIsSidebarCollapsed(false);
            }}
            className="h-screen"
          />
        </div>

        {/* Main Content Area - Now contains Document + Optional Right Panel */}
        <div className="flex-1 flex min-w-0">
          {/* Document Viewer Container - Full height, no header */}
          <div className="flex-1 bg-gray-50">
            <ContinuousScrollPDFViewer
              documentId={documentId || ""}
              fileName={fileName}
              className="h-full"
              dropdownMenuItems={pdfViewerDropdownItems}
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
