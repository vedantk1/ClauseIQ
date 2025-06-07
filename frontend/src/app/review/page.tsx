"use client";
import React, { useState } from "react";
import { useAnalysis } from "@/context/AnalysisContext";
import { useRouter } from "next/navigation";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/Tabs";
import Card from "@/components/Card";
import Button from "@/components/Button";

export default function ReviewWorkspace() {
  const { isAuthenticated, isLoading } = useAuthRedirect();
  const { currentDocument, setSelectedClause } = useAnalysis();
  const router = useRouter();

  // Extract data from currentDocument for easier access
  const {
    filename: fileName,
    sections,
    clauses,
    summary,
    fullText,
    riskSummary,
    selectedClause,
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

  if (!summary && !fileName && (!sections || sections.length === 0)) {
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
  const getRiskColor = (level: string) => {
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

  const getClauseTypeLabel = (type: string) => {
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
    return labels[type] || type;
  };

  const filteredClauses =
    clauses?.filter((clause) => {
      const matchesRisk =
        clauseFilter === "all" || clause.risk_level === clauseFilter;
      const matchesType =
        clauseTypeFilter === "all" || clause.clause_type === clauseTypeFilter;
      return matchesRisk && matchesType;
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
                <Card>
                  <div className="mb-6">
                    <h2 className="font-heading text-heading-sm text-text-primary mb-3">
                      AI Summary
                    </h2>
                    <div className="prose prose-invert max-w-none">
                      <p className="text-text-secondary leading-relaxed">
                        {summary ||
                          "No summary available. The document analysis may still be processing."}
                      </p>
                    </div>
                  </div>
                </Card>

                {fullText && (
                  <Card>
                    <div className="mb-4">
                      <h3 className="font-heading text-lg text-text-primary mb-3">
                        Document Preview
                      </h3>
                      <div className="bg-bg-elevated rounded-lg p-4 max-h-96 overflow-y-auto">
                        <pre className="text-sm text-text-secondary whitespace-pre-wrap font-sans">
                          {fullText.substring(0, 1000)}
                          {fullText.length > 1000 && "..."}
                        </pre>
                      </div>
                    </div>
                  </Card>
                )}
              </div>

              {/* Metrics Sidebar */}
              <div className="space-y-6">
                <Card density="compact">
                  <h3 className="font-heading text-lg text-text-primary mb-4">
                    Key Metrics
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-text-secondary">
                        Document Length
                      </span>
                      <span className="text-text-primary font-medium">
                        {fullText
                          ? `${Math.ceil(fullText.length / 1000)}k chars`
                          : "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Clauses Found</span>
                      <span className="text-text-primary font-medium">
                        {clauses?.length || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Contract Type</span>
                      <span className="text-text-primary font-medium">
                        Employment
                      </span>
                    </div>
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
                      Download PDF Report
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
                <div className="flex gap-2 mb-4">
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

                {/* Clause List */}
                <div className="space-y-3 max-h-96 overflow-y-auto">
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
                          <h3 className="font-medium text-text-primary text-sm">
                            {clause.heading ||
                              `${getClauseTypeLabel(
                                clause.clause_type
                              )} Clause`}
                          </h3>
                          <div
                            className={`px-2 py-1 rounded-full text-xs font-medium border ${getRiskColor(
                              clause.risk_level
                            )}`}
                          >
                            {clause.risk_level.charAt(0).toUpperCase() +
                              clause.risk_level.slice(1)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-text-secondary bg-bg-primary px-2 py-1 rounded">
                            {getClauseTypeLabel(clause.clause_type)}
                          </span>
                        </div>
                        <p className="text-sm text-text-secondary line-clamp-2">
                          {clause.summary ||
                            (clause.text
                              ? clause.text.substring(0, 100) + "..."
                              : "No content available")}
                        </p>
                      </div>
                    ))
                  ) : clauses && clauses.length > 0 ? (
                    <div className="text-center py-8">
                      <p className="text-text-secondary">
                        No clauses match the selected filters.
                      </p>
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
                    {/* Clause Header */}
                    <div>
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-medium text-text-primary">
                          {selectedClause.heading ||
                            `${getClauseTypeLabel(
                              selectedClause.clause_type
                            )} Clause`}
                        </h3>
                        <div
                          className={`px-3 py-1 rounded-full text-sm font-medium border ${getRiskColor(
                            selectedClause.risk_level
                          )}`}
                        >
                          {selectedClause.risk_level.charAt(0).toUpperCase() +
                            selectedClause.risk_level.slice(1)}{" "}
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

                    {/* Actions */}
                    <div className="pt-4 border-t border-border-muted">
                      <Button size="sm" variant="secondary" className="w-full">
                        Generate Rewrite Suggestion
                      </Button>
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
