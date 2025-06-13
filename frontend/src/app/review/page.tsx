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
import StructuredSummary from "@/components/StructuredSummary";
import DocumentInsights from "@/components/DocumentInsights";
import ClauseNavigator from "@/components/review/ClauseNavigator";
import ClauseDetailsPanel from "@/components/review/ClauseDetailsPanel";
import { getClauseTypeLabel } from "@/components/review/clauseUtils";
import type { Clause } from "@shared/common_generated";
import toast from "react-hot-toast";

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
  const handleAddNote = async (clause: { id?: string }) => {
    const note = prompt("Add a note for this clause:");
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
        const confirmDelete = window.confirm(
          "Are you sure you want to delete this note?"
        );
        if (confirmDelete) {
          try {
            await deleteNote(clause.id, targetNoteId);
          } catch {
            // Error handling is done in the hook
          }
        }
      }
    }
  };

  const handleEditNote = async (clause: { id?: string }, noteId?: string) => {
    if (clause.id && hasNotes(clause.id)) {
      const notes = getAllNotes(clause.id);
      const targetNote = noteId ? notes.find((n) => n.id === noteId) : notes[0];

      if (targetNote) {
        const updatedNote = prompt("Edit your note:", targetNote.text);
        if (updatedNote !== null && updatedNote !== targetNote.text) {
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

  const handleExportClause = (clause: Clause) => {
    const exportData = {
      clause_type: getClauseTypeLabel(clause.clause_type),
      risk_level: clause.risk_level,
      summary: clause.summary,
      risk_assessment: clause.risk_assessment,
      recommendations: clause.recommendations,
      full_text: clause.text,
      user_notes: clause.id ? getAllNotes(clause.id) : [],
      flagged: clause.id ? flaggedClauses.has(clause.id) : false,
      exported_date: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clause-analysis-${clause.clause_type || "unknown"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setTimeout(() => {
      toast.success("Clause analysis exported successfully");
    }, 0);
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
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => router.push("/")}>
              Upload Another
            </Button>
            <Button variant="secondary">Export Analysis</Button>
          </div>
        </div>

        {/* Tabs Navigation */}
        <Tabs defaultValue="summary">
          <TabsList className="mb-6">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="clauses">Clauses</TabsTrigger>
            <TabsTrigger value="risks">Risks & Suggestions</TabsTrigger>
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
                        <div className="flex items-center gap-2 p-2 rounded bg-accent-rose/10">
                          <div className="w-2 h-2 bg-accent-rose rounded-full"></div>
                          <span className="text-sm text-accent-rose font-medium">
                            {safeRiskHigh} high-risk clause
                            {safeRiskHigh > 1 ? "s" : ""} found
                          </span>
                        </div>
                      )}
                      {safeRiskMedium > 0 && (
                        <div className="flex items-center gap-2 p-2 rounded bg-accent-amber/10">
                          <div className="w-2 h-2 bg-accent-amber rounded-full"></div>
                          <span className="text-sm text-accent-amber font-medium">
                            {safeRiskMedium} medium-risk clause
                            {safeRiskMedium > 1 ? "s" : ""} to review
                          </span>
                        </div>
                      )}
                      {safeRiskLow > 0 && (
                        <div className="flex items-center gap-2 p-2 rounded bg-accent-green/10">
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
                      Share Analysis
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
                onExportClause={handleExportClause}
              />
            </div>
          </TabsContent>

          {/* Risks Tab */}
          <TabsContent value="risks">
            <div className="space-y-6">
              <Card>
                <h2 className="font-heading text-heading-sm text-text-primary mb-6">
                  Risk Assessment
                </h2>

                {/* Risk Overview */}
                {riskSummary &&
                  (safeRiskHigh > 0 ||
                    safeRiskMedium > 0 ||
                    safeRiskLow > 0) && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <div className="bg-accent-rose/5 border border-accent-rose/20 rounded-lg p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-accent-rose rounded-full flex items-center justify-center">
                            <span className="text-white text-lg font-bold">
                              !
                            </span>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-accent-rose">
                              {safeRiskHigh}
                            </div>
                            <div className="text-sm text-accent-rose">
                              High Risk Clauses
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="bg-accent-amber/5 border border-accent-amber/20 rounded-lg p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-accent-amber rounded-full flex items-center justify-center">
                            <span className="text-white text-lg font-bold">
                              ⚠
                            </span>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-accent-amber">
                              {safeRiskMedium}
                            </div>
                            <div className="text-sm text-accent-amber">
                              Medium Risk Clauses
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="bg-accent-green/5 border border-accent-green/20 rounded-lg p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-accent-green rounded-full flex items-center justify-center">
                            <span className="text-white text-lg font-bold">
                              ✓
                            </span>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-accent-green">
                              {safeRiskLow}
                            </div>
                            <div className="text-sm text-accent-green">
                              Low Risk Clauses
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                {/* Risk Details */}
                <div className="space-y-4">
                  {/* High Risk Clauses */}
                  {clauses
                    ?.filter((clause) => clause.risk_level === "high")
                    .map((clause, index) => (
                      <div
                        key={clause.id || index}
                        className="border-l-4 border-accent-rose bg-accent-rose/5 p-4 rounded-r-lg"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-accent-rose rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-white text-sm font-medium">
                              !
                            </span>
                          </div>
                          <div className="flex-1">
                            <h3 className="font-medium text-text-primary mb-1">
                              High Risk:{" "}
                              {getClauseTypeLabel(clause.clause_type)}
                            </h3>
                            <p className="text-text-secondary text-sm mb-3">
                              {clause.risk_assessment ||
                                clause.summary ||
                                "This clause requires careful review."}
                            </p>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="tertiary"
                                onClick={() => setSelectedClause(clause)}
                              >
                                View Details
                              </Button>
                              <Button size="sm" variant="tertiary">
                                Generate Rewrite Suggestion
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                  {/* Medium Risk Clauses */}
                  {clauses
                    ?.filter((clause) => clause.risk_level === "medium")
                    .map((clause, index) => (
                      <div
                        key={clause.id || index}
                        className="border-l-4 border-accent-amber bg-accent-amber/5 p-4 rounded-r-lg"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-accent-amber rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-white text-sm font-medium">
                              ⚠
                            </span>
                          </div>
                          <div className="flex-1">
                            <h3 className="font-medium text-text-primary mb-1">
                              Medium Risk:{" "}
                              {getClauseTypeLabel(clause.clause_type)}
                            </h3>
                            <p className="text-text-secondary text-sm mb-3">
                              {clause.risk_assessment ||
                                clause.summary ||
                                "This clause should be reviewed for potential issues."}
                            </p>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="tertiary"
                                onClick={() => setSelectedClause(clause)}
                              >
                                View Details
                              </Button>
                              <Button size="sm" variant="tertiary">
                                View Suggestions
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                  {/* Low Risk Information */}
                  {clauses?.filter((clause) => clause.risk_level === "low")
                    .length > 0 && (
                    <div className="border-l-4 border-accent-green bg-accent-green/5 p-4 rounded-r-lg">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-accent-green rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-white text-sm font-medium">
                            ✓
                          </span>
                        </div>
                        <div>
                          <h3 className="font-medium text-text-primary mb-1">
                            Low Risk Clauses (
                            {
                              clauses.filter(
                                (clause) => clause.risk_level === "low"
                              ).length
                            }
                            )
                          </h3>
                          <p className="text-text-secondary text-sm mb-3">
                            These clauses appear to be standard and generally
                            favorable. You can view them in the Clauses tab for
                            detailed analysis.
                          </p>
                          <Button size="sm" variant="tertiary">
                            View All Low Risk Clauses
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* No Risks Found */}
                  {(!clauses || clauses.length === 0) && (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-accent-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg
                          className="w-8 h-8 text-accent-green"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <h3 className="font-medium text-text-primary mb-2">
                        No Risk Analysis Available
                      </h3>
                      <p className="text-text-secondary">
                        Upload a contract with clauses to see AI-powered risk
                        assessment and recommendations.
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Chat Tab */}
          <TabsContent value="chat">
            <Card>
              <h2 className="font-heading text-heading-sm text-text-primary mb-6">
                Ask Questions About Your Contract
              </h2>
              <div className="space-y-4">
                <div className="bg-bg-elevated rounded-lg p-4 min-h-96">
                  <div className="text-center py-12">
                    <svg
                      className="w-12 h-12 text-text-secondary mx-auto mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                    <p className="text-text-secondary mb-4">
                      Chat with your contract feature coming soon
                    </p>
                    <p className="text-sm text-text-secondary">
                      Ask questions like &ldquo;What happens if I want to
                      quit?&rdquo; or &ldquo;Are there any unusual
                      clauses?&rdquo;
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Ask a question about your contract..."
                    className="flex-1 px-4 py-2 bg-bg-elevated border border-border-muted rounded-lg text-text-primary placeholder-text-secondary focus:ring-2 focus:ring-accent-purple focus:border-transparent"
                    disabled
                  />
                  <Button disabled>Send</Button>
                </div>
              </div>
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
    </div>
  );
}
