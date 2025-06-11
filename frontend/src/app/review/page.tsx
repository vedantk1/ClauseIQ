"use client";
import React, { useState, useRef } from "react";
import { useAnalysis } from "@/context/AnalysisContext";
import { useRouter } from "next/navigation";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/Tabs";
import Card from "@/components/Card";
import Button from "@/components/Button";
import StructuredSummary from "@/components/StructuredSummary";
import DocumentInsights from "@/components/DocumentInsights";
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
  const [showRewriteSuggestion, setShowRewriteSuggestion] = useState(false);
  const [showNegotiationTips, setShowNegotiationTips] = useState(false);
  const [userNotes, setUserNotes] = useState<Record<string, string>>({});
  const [flaggedClauses, setFlaggedClauses] = useState<Set<string>>(new Set());

  const [showFinancialCalculator, setShowFinancialCalculator] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // Ref to prevent duplicate flag operations due to React StrictMode
  const flagOperationRef = useRef<Set<string>>(new Set());

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

  // Utility functions for clause handling
  const getRiskColor = (level?: string) => {
    switch (level) {
      case "high":
        return "text-accent-rose bg-accent-rose/10 border-accent-rose/20";
      case "medium":
        return "text-accent-amber bg-accent-amber/10 border-accent-amber/20";
      case "low":
        return "text-accent-green bg-accent-green/10 border-accent-green/20";
      default:
        return "text-text-secondary bg-bg-elevated border-border-muted";
    }
  };

  const getClauseTypeLabel = (type?: string) => {
    const labels: Record<string, string> = {
      compensation: "Compensation",
      termination: "Termination",
      non_compete: "Non-Compete",
      confidentiality: "Confidentiality",
      benefits: "Benefits",
      working_conditions: "Working Conditions",
      intellectual_property: "Intellectual Property",
      dispute_resolution: "Dispute Resolution",
      probation: "Probation",
      general: "General",
    };
    return labels[type || ""] || type || "Unknown";
  };

  const getClauseNegotiability = (clauseType?: string) => {
    const negotiabilityMap: Record<string, string> = {
      compensation: "High",
      termination: "Medium",
      non_compete: "High",
      confidentiality: "Low",
      benefits: "Medium",
      working_conditions: "Medium",
      intellectual_property: "Low",
      dispute_resolution: "Medium",
      probation: "High",
      general: "Medium",
    };
    return negotiabilityMap[clauseType || ""] || "Medium";
  };

  // Simple text highlighting utility
  const highlightSearchText = (
    text: string,
    searchQuery: string
  ): React.ReactNode => {
    if (!searchQuery.trim() || !text) return text;

    const query = searchQuery.trim();
    const regex = new RegExp(
      `(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
      "gi"
    );
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark
          key={index}
          className="bg-accent-purple/20 text-accent-purple px-1 rounded"
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const handleGenerateRewrite = async (clause: any) => {
    setShowRewriteSuggestion(true);
    // TODO: Implement AI-powered rewrite suggestion
    console.log("Generating rewrite suggestion for:", clause);
    // Defer toast to avoid state update during render
    setTimeout(() => {
      toast.success("Generating rewrite suggestion...");
    }, 0);
  };

  const handleAddNote = (clause: any) => {
    const note = prompt("Add a note for this clause:");
    if (note && clause.id) {
      setUserNotes((prev) => ({
        ...prev,
        [clause.id]: note,
      }));
      // Defer toast to avoid state update during render
      setTimeout(() => {
        toast.success("Note added successfully");
      }, 0);
    }
  };

  const handleDeleteNote = (clause: any) => {
    if (clause.id && userNotes[clause.id]) {
      const confirmDelete = window.confirm(
        "Are you sure you want to delete this note?"
      );
      if (confirmDelete) {
        setUserNotes((prev) => {
          const updated = { ...prev };
          delete updated[clause.id];
          return updated;
        });
        // Defer toast to avoid state update during render
        setTimeout(() => {
          toast.success("Note deleted successfully");
        }, 0);
      }
    }
  };

  const handleEditNote = (clause: any) => {
    if (clause.id && userNotes[clause.id]) {
      const currentNote = userNotes[clause.id];
      const updatedNote = prompt("Edit your note:", currentNote);
      if (updatedNote !== null && updatedNote !== currentNote) {
        if (updatedNote.trim() === "") {
          // If the user clears the note, delete it
          handleDeleteNote(clause);
        } else {
          setUserNotes((prev) => ({
            ...prev,
            [clause.id]: updatedNote,
          }));
          // Defer toast to avoid state update during render
          setTimeout(() => {
            toast.success("Note updated successfully");
          }, 0);
        }
      }
    }
  };

  const handleFlagForReview = (clause: any, event?: React.MouseEvent) => {
    // Prevent event bubbling and default behavior
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (clause.id) {
      // Check if this operation is already in progress - atomic check and set
      if (flagOperationRef.current.has(clause.id)) {
        console.log(
          "🚩 [DEBUG] Operation already in progress, skipping:",
          clause.id
        );
        return;
      }

      // Immediately mark this operation as in progress
      flagOperationRef.current.add(clause.id);

      // Determine current state before the update
      const wasAlreadyFlagged = flaggedClauses.has(clause.id);

      // Update the state
      setFlaggedClauses((prev) => {
        const newSet = new Set(prev);
        if (wasAlreadyFlagged) {
          newSet.delete(clause.id);
        } else {
          newSet.add(clause.id);
        }
        return newSet;
      });

      // Show toast and clear operation flag OUTSIDE the state updater
      // This prevents duplicate toasts from React Strict Mode double-invocation
      setTimeout(() => {
        if (wasAlreadyFlagged) {
          toast.success("Clause unflagged");
        } else {
          toast.success("Clause flagged for review");
        }

        // Clear the operation flag after showing toast
        setTimeout(() => {
          flagOperationRef.current.delete(clause.id);
        }, 100);
      }, 0);
    }
  };

  const handleShowNegotiationTips = () => {
    setShowNegotiationTips(!showNegotiationTips);
  };

  const handleShowFinancialCalculator = () => {
    setShowFinancialCalculator(!showFinancialCalculator);
  };

  const handleExportClause = (clause: any) => {
    // Create a formatted export of the clause
    const exportData = {
      clause_type: getClauseTypeLabel(clause.clause_type),
      risk_level: clause.risk_level,
      summary: clause.summary,
      risk_assessment: clause.risk_assessment,
      recommendations: clause.recommendations,
      full_text: clause.text,
      user_note: clause.id ? userNotes[clause.id] : null,
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
    // Defer toast to avoid state update during render
    setTimeout(() => {
      toast.success("Clause analysis exported successfully");
    }, 0);
  };

  const handleCopyClause = async (clause: any) => {
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
  clause.id && userNotes[clause.id]
    ? `\nYOUR NOTES:\n${userNotes[clause.id]}`
    : ""
}

Generated by ClauseIQ on ${new Date().toLocaleDateString()}
    `.trim();

    try {
      await navigator.clipboard.writeText(textToCopy);
      // Defer toast to avoid state update during render
      setTimeout(() => {
        toast.success("Clause analysis copied to clipboard");
      }, 0);
    } catch (err) {
      // Defer toast to avoid state update during render
      setTimeout(() => {
        toast.error("Failed to copy to clipboard");
      }, 0);
    }
  };

  const getIndustryBenchmark = (clauseType?: string, riskLevel?: string) => {
    // This would normally come from a database of industry standards
    const benchmarks: Record<string, any> = {
      termination: {
        high: "Most companies provide 2-4 weeks notice. This clause provides less protection than standard.",
        medium:
          "This notice period aligns with industry averages for similar roles.",
        low: "This termination clause is more favorable than typical industry standards.",
      },
      compensation: {
        high: "Compensation structure has unusual restrictions. Consider market analysis.",
        medium: "Compensation terms are within normal industry ranges.",
        low: "Compensation structure is favorable compared to industry standards.",
      },
      non_compete: {
        high: "Non-compete restrictions are broader than industry standard. Consider geographic/time limits.",
        medium:
          "Non-compete terms are typical for this industry and role level.",
        low: "Non-compete restrictions are reasonable and industry-appropriate.",
      },
    };

    return (
      benchmarks[clauseType || ""]?.[riskLevel || ""] ||
      "Industry comparison data not available for this clause type."
    );
  };

  // Enhanced filtering with search and sort
  const filteredClauses =
    clauses
      ?.filter((clause) => {
        // Risk level filter
        if (clauseFilter !== "all" && clause.risk_level !== clauseFilter)
          return false;

        // Clause type filter
        if (
          clauseTypeFilter !== "all" &&
          clause.clause_type !== clauseTypeFilter
        )
          return false;

        // Enhanced search filter with partial word matching
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase().trim();
          const searchableFields = [
            clause.heading || "",
            clause.summary || "",
            clause.text || "",
            getClauseTypeLabel(clause.clause_type),
          ];

          // Create searchable text and individual words
          const searchableText = searchableFields.join(" ").toLowerCase();
          const searchableWords = searchableText.split(/\s+/);

          // Check if query matches any part of the searchable content
          const queryMatches =
            searchableText.includes(query) || // Exact phrase match
            searchableWords.some((word) => word.startsWith(query)) || // Word starts with query
            searchableWords.some(
              (word) => word.includes(query) && query.length >= 3
            ); // Partial match for 3+ chars

          if (!queryMatches) return false;
        }

        return true;
      })
      ?.sort((a, b) => {
        switch (sortBy) {
          case "risk_level":
            const riskOrder: Record<string, number> = {
              high: 3,
              medium: 2,
              low: 1,
            };
            const aRisk = riskOrder[a.risk_level || ""] || 0;
            const bRisk = riskOrder[b.risk_level || ""] || 0;

            // Primary sort by risk level (high to low)
            if (aRisk !== bRisk) return bRisk - aRisk;

            // Secondary sort by clause type alphabetically
            const aRiskLabel = getClauseTypeLabel(a.clause_type);
            const bRiskLabel = getClauseTypeLabel(b.clause_type);
            return aRiskLabel.localeCompare(bRiskLabel);

          case "alphabetical":
            const aAlphaLabel = getClauseTypeLabel(a.clause_type);
            const bAlphaLabel = getClauseTypeLabel(b.clause_type);
            const comparison = aAlphaLabel.localeCompare(bAlphaLabel);

            // If clause types are the same, sort by heading/title
            if (comparison === 0) {
              const aTitle = a.heading || aAlphaLabel;
              const bTitle = b.heading || bAlphaLabel;
              return aTitle.localeCompare(bTitle);
            }
            return comparison;

          case "flagged_first":
            const aFlagged = flaggedClauses.has(a.id || "");
            const bFlagged = flaggedClauses.has(b.id || "");

            // Primary sort by flagged status
            if (aFlagged !== bFlagged) return aFlagged ? -1 : 1;

            // Secondary sort by risk level for same flagged status
            const flaggedRiskOrder: Record<string, number> = {
              high: 3,
              medium: 2,
              low: 1,
            };
            const aFlaggedRisk = flaggedRiskOrder[a.risk_level || ""] || 0;
            const bFlaggedRisk = flaggedRiskOrder[b.risk_level || ""] || 0;
            return bFlaggedRisk - aFlaggedRisk;

          case "noted_first":
            const aNoted = !!(a.id && userNotes[a.id]);
            const bNoted = !!(b.id && userNotes[b.id]);

            // Primary sort by noted status
            if (aNoted !== bNoted) return aNoted ? -1 : 1;

            // Secondary sort by risk level for same noted status
            const notedRiskOrder: Record<string, number> = {
              high: 3,
              medium: 2,
              low: 1,
            };
            const aNotedRisk = notedRiskOrder[a.risk_level || ""] || 0;
            const bNotedRisk = notedRiskOrder[b.risk_level || ""] || 0;
            return bNotedRisk - aNotedRisk;

          case "document_order":
          default:
            return 0; // Maintain original order
        }
      }) || [];

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
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-heading text-heading-sm text-text-primary">
                    Clause Navigator
                  </h2>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-text-secondary">
                      {filteredClauses.length} clauses
                    </span>
                  </div>
                </div>

                {/* Risk Summary */}
                {riskSummary &&
                  (safeRiskHigh > 0 ||
                    safeRiskMedium > 0 ||
                    safeRiskLow > 0) && (
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent-rose/10 border border-accent-rose/20">
                        <div className="w-3 h-3 rounded-full bg-accent-rose"></div>
                        <span className="text-sm font-medium text-accent-rose">
                          {safeRiskHigh} High
                        </span>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent-amber/10 border border-accent-amber/20">
                        <div className="w-3 h-3 rounded-full bg-accent-amber"></div>
                        <span className="text-sm font-medium text-accent-amber">
                          {safeRiskMedium} Medium
                        </span>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent-green/10 border border-accent-green/20">
                        <div className="w-3 h-3 rounded-full bg-accent-green"></div>
                        <span className="text-sm font-medium text-accent-green">
                          {safeRiskLow} Low
                        </span>
                      </div>
                    </div>
                  )}

                {/* Filters */}
                <div className="space-y-3 mb-4">
                  {/* Search Bar */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search clauses... (try comp, terminate, etc.)"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full px-3 py-2 pl-10 pr-10 text-sm bg-bg-elevated border border-border-muted rounded-md text-text-primary placeholder-text-secondary focus:ring-2 focus:ring-accent-purple focus:border-transparent"
                    />
                    <svg
                      className="absolute left-3 top-2.5 w-4 h-4 text-text-secondary"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    {/* Search indicator */}
                    {searchQuery && (
                      <div className="absolute right-3 top-2.5 flex items-center">
                        <span className="text-xs text-accent-purple bg-accent-purple/10 px-2 py-0.5 rounded-full">
                          {filteredClauses.length} found
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Filter and Sort Controls */}
                  <div className="flex gap-2">
                    <select
                      value={clauseFilter}
                      onChange={(e) =>
                        setClauseFilter(
                          e.target.value as "all" | "high" | "medium" | "low"
                        )
                      }
                      className="px-3 py-1 text-sm bg-bg-elevated border border-border-muted rounded-md text-text-primary focus:ring-2 focus:ring-accent-purple focus:border-transparent"
                    >
                      <option value="all">All Risk Levels</option>
                      <option value="high">High Risk</option>
                      <option value="medium">Medium Risk</option>
                      <option value="low">Low Risk</option>
                    </select>
                    <select
                      value={clauseTypeFilter}
                      onChange={(e) => setClauseTypeFilter(e.target.value)}
                      className="px-3 py-1 text-sm bg-bg-elevated border border-border-muted rounded-md text-text-primary focus:ring-2 focus:ring-accent-purple focus:border-transparent"
                    >
                      <option value="all">All Types</option>
                      <option value="compensation">Compensation</option>
                      <option value="termination">Termination</option>
                      <option value="non_compete">Non-Compete</option>
                      <option value="confidentiality">Confidentiality</option>
                      <option value="benefits">Benefits</option>
                      <option value="working_conditions">
                        Working Conditions
                      </option>
                      <option value="intellectual_property">
                        Intellectual Property
                      </option>
                      <option value="dispute_resolution">
                        Dispute Resolution
                      </option>
                      <option value="probation">Probation</option>
                      <option value="general">General</option>
                    </select>
                  </div>

                  {/* Sort Controls */}
                  <div className="flex gap-2">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="px-3 py-1 text-sm bg-bg-elevated border border-border-muted rounded-md text-text-primary focus:ring-2 focus:ring-accent-purple focus:border-transparent"
                    >
                      <option value="document_order">Document Order</option>
                      <option value="risk_level">
                        Risk Level (High First)
                      </option>
                      <option value="alphabetical">
                        Alphabetical (by Type)
                      </option>
                      <option value="flagged_first">Flagged First</option>
                      <option value="noted_first">Notes First</option>
                    </select>

                    {/* Clear Search Button */}
                    {searchQuery && (
                      <Button
                        size="sm"
                        variant="tertiary"
                        onClick={() => setSearchQuery("")}
                        title="Clear search"
                        className="text-xs"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>

                {/* Clause List */}
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {filteredClauses.length > 0 ? (
                    filteredClauses.map((clause, index) => (
                      <div
                        key={clause.id || index}
                        onClick={() => setSelectedClause(clause)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          selectedClause?.id === clause.id
                            ? "border-accent-purple bg-accent-purple/5"
                            : "border-border-muted bg-bg-elevated hover:bg-bg-elevated/80"
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h3 className="font-medium text-text-primary text-sm">
                              {highlightSearchText(
                                clause.heading ||
                                  `${getClauseTypeLabel(
                                    clause.clause_type
                                  )} Clause`,
                                searchQuery
                              )}
                            </h3>
                            {/* Status indicators */}
                            <div className="flex items-center gap-1 mt-1">
                              {clause.id && flaggedClauses.has(clause.id) && (
                                <span className="text-xs text-accent-rose">
                                  🚩
                                </span>
                              )}
                              {clause.id && userNotes[clause.id] && (
                                <span className="text-xs text-accent-blue">
                                  📝
                                </span>
                              )}
                            </div>
                          </div>
                          <div
                            className={`px-2 py-1 rounded-full text-xs font-medium border ${getRiskColor(
                              clause.risk_level
                            )}`}
                          >
                            {clause.risk_level
                              ? clause.risk_level.charAt(0).toUpperCase() +
                                clause.risk_level.slice(1)
                              : "Unknown"}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-text-secondary bg-bg-primary px-2 py-1 rounded">
                            {highlightSearchText(
                              getClauseTypeLabel(clause.clause_type),
                              searchQuery
                            )}
                          </span>
                        </div>
                        <p className="text-sm text-text-secondary line-clamp-2">
                          {highlightSearchText(
                            clause.summary ||
                              (clause.text
                                ? clause.text.substring(0, 100) + "..."
                                : "No content available"),
                            searchQuery
                          )}
                        </p>
                      </div>
                    ))
                  ) : clauses && clauses.length > 0 ? (
                    <div className="text-center py-8">
                      <svg
                        className="w-8 h-8 text-text-secondary mx-auto mb-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                      <p className="text-text-secondary mb-2">
                        {searchQuery
                          ? `No clauses match "${searchQuery}"`
                          : "No clauses match the selected filters"}
                      </p>
                      {searchQuery && (
                        <p className="text-xs text-text-secondary/70">
                          Try searching for partial words like &quot;comp&quot;
                          for compensation, or &quot;term&quot; for termination
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
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
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <p className="text-text-secondary">
                        No clauses extracted yet. Upload a contract with clauses
                        to see detailed analysis.
                      </p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Clause Details */}
              <Card>
                <h2 className="font-heading text-heading-sm text-text-primary mb-4">
                  Clause Details
                </h2>
                {selectedClause ? (
                  <div className="space-y-6">
                    {/* Quick Action Bar */}
                    <div className="flex items-center justify-between p-3 bg-bg-elevated rounded-lg border border-border-muted">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text-primary">
                          Quick Actions:
                        </span>
                        <Button
                          size="sm"
                          variant="tertiary"
                          onClick={() => handleGenerateRewrite(selectedClause)}
                          title="Get AI rewrite suggestions"
                        >
                          ✨ Rewrite
                        </Button>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="tertiary"
                          onClick={() => handleCopyClause(selectedClause)}
                          title="Copy analysis to clipboard"
                        >
                          📋
                        </Button>
                        <Button
                          size="sm"
                          variant="tertiary"
                          onClick={() => handleExportClause(selectedClause)}
                          title="Export clause analysis"
                        >
                          📤
                        </Button>
                      </div>
                    </div>

                    {/* Clause Header */}
                    <div>
                      {" "}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-medium text-text-primary">
                            {selectedClause.heading ||
                              `${getClauseTypeLabel(
                                selectedClause.clause_type
                              )} Clause`}
                          </h3>
                          {/* User status indicators */}
                          <div className="flex items-center gap-2 mt-1">
                            {selectedClause.id &&
                              flaggedClauses.has(selectedClause.id) && (
                                <span className="text-xs bg-accent-rose/10 text-accent-rose px-2 py-1 rounded-full">
                                  🚩 Flagged for Review
                                </span>
                              )}
                            {selectedClause.id &&
                              userNotes[selectedClause.id] && (
                                <span className="text-xs bg-accent-blue/10 text-accent-blue px-2 py-1 rounded-full">
                                  📝 Has Note
                                </span>
                              )}
                          </div>
                        </div>
                        <div
                          className={`px-3 py-1 rounded-full text-sm font-medium border ${getRiskColor(
                            selectedClause.risk_level
                          )}`}
                        >
                          {selectedClause.risk_level
                            ? selectedClause.risk_level
                                .charAt(0)
                                .toUpperCase() +
                              selectedClause.risk_level.slice(1)
                            : "Unknown"}{" "}
                          Risk
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm text-text-secondary bg-bg-elevated px-2 py-1 rounded">
                          {getClauseTypeLabel(selectedClause.clause_type)}
                        </span>
                      </div>
                    </div>

                    {/* Clause Summary */}
                    {selectedClause.summary && (
                      <div>
                        <h4 className="font-medium text-text-primary mb-2">
                          Summary
                        </h4>
                        <p className="text-text-secondary text-sm leading-relaxed">
                          {selectedClause.summary}
                        </p>
                      </div>
                    )}

                    {/* Risk Assessment */}
                    {selectedClause.risk_assessment && (
                      <div>
                        <h4 className="font-medium text-text-primary mb-2">
                          Risk Assessment
                        </h4>
                        <p className="text-text-secondary text-sm leading-relaxed">
                          {selectedClause.risk_assessment}
                        </p>
                      </div>
                    )}

                    {/* Key Points */}
                    {selectedClause.key_points &&
                      selectedClause.key_points.length > 0 && (
                        <div>
                          <h4 className="font-medium text-text-primary mb-2">
                            Key Points
                          </h4>
                          <ul className="space-y-1">
                            {selectedClause.key_points.map((point, index) => (
                              <li
                                key={index}
                                className="flex items-start gap-2 text-sm text-text-secondary"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-accent-purple mt-2 flex-shrink-0"></span>
                                {point}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                    {/* Recommendations */}
                    {selectedClause.recommendations &&
                      selectedClause.recommendations.length > 0 && (
                        <div>
                          <h4 className="font-medium text-text-primary mb-2">
                            Recommendations
                          </h4>
                          <ul className="space-y-2">
                            {selectedClause.recommendations.map(
                              (rec, index) => (
                                <li
                                  key={index}
                                  className="flex items-start gap-2 text-sm"
                                >
                                  <span className="w-5 h-5 rounded-full bg-accent-green/20 text-accent-green flex items-center justify-center text-xs font-medium mt-0.5 flex-shrink-0">
                                    ✓
                                  </span>
                                  <span className="text-text-secondary">
                                    {rec}
                                  </span>
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      )}

                    {/* User Notes Display */}
                    {selectedClause.id && userNotes[selectedClause.id] && (
                      <div className="bg-accent-blue/5 border border-accent-blue/20 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-accent-blue text-sm">
                            📝 Your Notes
                          </h4>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="tertiary"
                              onClick={() => handleEditNote(selectedClause)}
                              title="Edit this note"
                              className="text-xs text-accent-blue hover:bg-accent-blue/10"
                            >
                              ✏️ Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="tertiary"
                              onClick={() => handleDeleteNote(selectedClause)}
                              title="Delete this note"
                              className="text-xs text-accent-rose hover:bg-accent-rose/10"
                            >
                              🗑️ Delete
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-text-secondary">
                          {userNotes[selectedClause.id]}
                        </p>
                      </div>
                    )}

                    {/* Negotiation Tips */}
                    {showNegotiationTips &&
                      selectedClause.risk_level === "high" && (
                        <div className="bg-accent-purple/5 border border-accent-purple/20 rounded-lg p-3">
                          <h4 className="font-medium text-accent-purple text-sm mb-2">
                            🎯 Negotiation Strategy
                          </h4>
                          <div className="space-y-2 text-sm text-text-secondary">
                            <p>
                              <strong>Opening Position:</strong> Request
                              modification to reduce risk exposure
                            </p>
                            <p>
                              <strong>Fallback Option:</strong> Add protective
                              language or mutual obligations
                            </p>
                            <p>
                              <strong>Walk-away Point:</strong> Consider if this
                              clause is a deal-breaker
                            </p>
                          </div>
                        </div>
                      )}

                    {/* Industry Comparison */}
                    <div className="bg-accent-green/5 border border-accent-green/20 rounded-lg p-3">
                      <h4 className="font-medium text-accent-green text-sm mb-2">
                        📊 Industry Benchmark
                      </h4>
                      <p className="text-sm text-text-secondary mb-3">
                        {getIndustryBenchmark(
                          selectedClause.clause_type,
                          selectedClause.risk_level
                        )}
                      </p>
                      <div className="bg-bg-elevated rounded p-2 text-xs">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="font-medium">
                              Market Position:
                            </span>
                            <br />
                            <span
                              className={
                                selectedClause.risk_level === "high"
                                  ? "text-accent-rose"
                                  : selectedClause.risk_level === "medium"
                                  ? "text-accent-amber"
                                  : "text-accent-green"
                              }
                            >
                              {selectedClause.risk_level === "high"
                                ? "Below Market"
                                : selectedClause.risk_level === "medium"
                                ? "Market Standard"
                                : "Above Market"}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium">Prevalence:</span>
                            <br />
                            <span>
                              {selectedClause.risk_level === "high"
                                ? "15% of contracts"
                                : selectedClause.risk_level === "medium"
                                ? "65% of contracts"
                                : "85% of contracts"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Financial Calculator */}
                    {showFinancialCalculator &&
                      (selectedClause.clause_type === "termination" ||
                        selectedClause.clause_type === "compensation") && (
                        <div className="bg-accent-blue/5 border border-accent-blue/20 rounded-lg p-3">
                          <h4 className="font-medium text-accent-blue text-sm mb-2">
                            💰 Financial Impact Calculator
                          </h4>
                          {selectedClause.clause_type === "termination" ? (
                            <div className="space-y-2 text-sm">
                              <p className="text-text-secondary">
                                <strong>Potential Impact Analysis:</strong>
                              </p>
                              <div className="bg-bg-elevated rounded p-2 text-xs space-y-1">
                                <div className="flex justify-between">
                                  <span>Notice Period Value:</span>
                                  <span className="font-medium">
                                    $8,000 - $16,000
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Severance Exposure:</span>
                                  <span className="font-medium">
                                    $0 - $25,000
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Legal Risk:</span>
                                  <span
                                    className={
                                      selectedClause.risk_level === "high"
                                        ? "text-accent-rose font-medium"
                                        : "text-accent-green"
                                    }
                                  >
                                    {selectedClause.risk_level === "high"
                                      ? "High ($5K+ potential costs)"
                                      : "Low"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2 text-sm">
                              <p className="text-text-secondary">
                                <strong>Compensation Analysis:</strong>
                              </p>
                              <div className="bg-bg-elevated rounded p-2 text-xs space-y-1">
                                <div className="flex justify-between">
                                  <span>Annual Impact:</span>
                                  <span className="font-medium">
                                    Varies by role
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Negotiation Potential:</span>
                                  <span className="text-accent-green font-medium">
                                    {getClauseNegotiability(
                                      selectedClause.clause_type
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                    {/* Full Clause Text */}
                    <div>
                      <h4 className="font-medium text-text-primary mb-2">
                        Full Text
                      </h4>
                      <div className="bg-bg-elevated rounded-lg p-4 max-h-48 overflow-y-auto">
                        <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                          {selectedClause.text}
                        </p>
                      </div>
                    </div>

                    {/* Actions & Tools */}
                    <div className="pt-4 border-t border-border-muted space-y-4">
                      {/* Quick Actions */}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleGenerateRewrite(selectedClause)}
                          title="Generate AI-powered alternative language for this clause"
                        >
                          Rewrite Suggestion
                        </Button>
                      </div>

                      {/* Negotiation Guidance */}
                      {selectedClause.risk_level === "high" && (
                        <div className="bg-accent-rose/5 border border-accent-rose/20 rounded-lg p-3">
                          <h5 className="font-medium text-accent-rose text-sm mb-2">
                            🎯 Negotiation Priority
                          </h5>
                          <p className="text-xs text-text-secondary mb-2">
                            This high-risk clause should be your top negotiation
                            priority.
                          </p>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="tertiary"
                              onClick={handleShowNegotiationTips}
                            >
                              Talking Points
                            </Button>
                            <Button size="sm" variant="tertiary">
                              Alternatives
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Impact Calculator */}
                      {(selectedClause.clause_type === "termination" ||
                        selectedClause.clause_type === "compensation") && (
                        <div className="bg-accent-blue/5 border border-accent-blue/20 rounded-lg p-3">
                          <h5 className="font-medium text-accent-blue text-sm mb-2">
                            💰 Financial Impact
                          </h5>
                          <p className="text-xs text-text-secondary mb-2">
                            Calculate potential financial implications of this
                            clause.
                          </p>
                          <Button
                            size="sm"
                            variant="tertiary"
                            onClick={handleShowFinancialCalculator}
                          >
                            Open Calculator
                          </Button>
                        </div>
                      )}

                      {/* Clause Insights */}
                      <div className="bg-bg-elevated rounded-lg p-3">
                        <h5 className="font-medium text-text-primary text-sm mb-2">
                          📊 Clause Insights
                        </h5>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-text-secondary">
                              Fairness Score:
                            </span>
                            <span
                              className={`font-medium ${
                                selectedClause.risk_level === "high"
                                  ? "text-accent-rose"
                                  : selectedClause.risk_level === "medium"
                                  ? "text-accent-amber"
                                  : "text-accent-green"
                              }`}
                            >
                              {selectedClause.risk_level === "high"
                                ? "2/10 - Unfavorable"
                                : selectedClause.risk_level === "medium"
                                ? "6/10 - Moderate"
                                : "8/10 - Favorable"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-text-secondary">
                              Industry Standard:
                            </span>
                            <span className="text-text-primary">
                              {selectedClause.risk_level === "high"
                                ? "Below Average"
                                : selectedClause.risk_level === "medium"
                                ? "Typical"
                                : "Above Average"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-text-secondary">
                              Negotiability:
                            </span>
                            <span className="text-accent-green">
                              {getClauseNegotiability(
                                selectedClause.clause_type
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* User Actions */}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="tertiary"
                          className="flex-1"
                          onClick={() => handleAddNote(selectedClause)}
                          title="Add a personal note to this clause for future reference"
                        >
                          📝 Add Note
                        </Button>
                        <Button
                          size="sm"
                          variant="tertiary"
                          className="flex-1"
                          onClick={(event) =>
                            handleFlagForReview(selectedClause, event)
                          }
                          title={
                            flaggedClauses.has(selectedClause.id || "")
                              ? "Remove flag from this clause"
                              : "Flag this clause for legal team review"
                          }
                        >
                          {flaggedClauses.has(selectedClause.id || "")
                            ? "🏳️ Unflag"
                            : "🚩 Flag for Review"}
                        </Button>
                      </div>

                      {/* Smart Suggestions */}
                      <div className="bg-accent-purple/5 border border-accent-purple/20 rounded-lg p-3">
                        <h5 className="font-medium text-accent-purple text-sm mb-2">
                          🧠 Smart Suggestions
                        </h5>
                        <div className="space-y-2 text-xs">
                          {selectedClause.risk_level === "high" && (
                            <div className="bg-accent-rose/10 border border-accent-rose/20 rounded p-2">
                              <p className="font-medium text-accent-rose mb-1">
                                ⚠️ High Priority Action
                              </p>
                              <p className="text-text-secondary">
                                Schedule a review meeting to discuss this clause
                                before signing. Consider bringing in legal
                                expertise for negotiation strategy.
                              </p>
                            </div>
                          )}

                          {selectedClause.clause_type === "termination" && (
                            <div className="bg-accent-blue/10 border border-accent-blue/20 rounded p-2">
                              <p className="font-medium text-accent-blue mb-1">
                                💡 Termination Tip
                              </p>
                              <p className="text-text-secondary">
                                Ask about notice periods, severance packages,
                                and grounds for termination. Ensure mutual
                                obligations where possible.
                              </p>
                            </div>
                          )}

                          {selectedClause.clause_type === "non_compete" && (
                            <div className="bg-accent-amber/10 border border-accent-amber/20 rounded p-2">
                              <p className="font-medium text-accent-amber mb-1">
                                🎯 Non-Compete Strategy
                              </p>
                              <p className="text-text-secondary">
                                Focus on narrowing geographic scope, time
                                limits, and industry definitions. Ensure
                                reasonable compensation if enforced.
                              </p>
                            </div>
                          )}

                          {selectedClause.clause_type === "compensation" && (
                            <div className="bg-accent-green/10 border border-accent-green/20 rounded p-2">
                              <p className="font-medium text-accent-green mb-1">
                                💰 Compensation Focus
                              </p>
                              <p className="text-text-secondary">
                                Verify bonus structures, raise schedules, and
                                performance metrics. Ensure clarity on
                                commission calculations if applicable.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Export & Share */}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="tertiary"
                          className="flex-1"
                          onClick={() => handleExportClause(selectedClause)}
                          title="Export this clause analysis as a separate document"
                        >
                          📤 Export Clause
                        </Button>
                        <Button
                          size="sm"
                          variant="tertiary"
                          className="flex-1"
                          onClick={() => handleCopyClause(selectedClause)}
                          title="Copy clause text and analysis to clipboard"
                        >
                          📋 Copy
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
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
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <p className="text-text-secondary">
                      Select a clause to view detailed analysis
                    </p>
                  </div>
                )}
              </Card>
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
    </div>
  );
}
