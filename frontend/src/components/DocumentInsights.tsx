import React, { useState } from "react";
import Card from "./Card";
import { StructuredSummary as StructuredSummaryType } from "../context/AnalysisContext";

interface DocumentInsightsProps {
  structuredSummary: StructuredSummaryType | null;
  fileName?: string;
  fullText?: string;
  clauseCount?: number;
}

export default function DocumentInsights({
  structuredSummary,
  fileName,
  fullText,
  clauseCount = 0,
}: DocumentInsightsProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // Document statistics
  const wordCount = fullText ? fullText.split(/\s+/).length : 0;
  const charCount = fullText ? fullText.length : 0;

  // Check if we have structured data to show
  const hasStructuredData =
    structuredSummary &&
    (structuredSummary.key_parties?.length ||
      structuredSummary.important_dates?.length ||
      structuredSummary.major_obligations?.length ||
      structuredSummary.risk_highlights?.length ||
      structuredSummary.key_insights?.length);

  return (
    <Card>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <svg
            className="w-5 h-5 text-accent-blue"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <h3 className="font-heading text-lg text-text-primary">
            Document Insights
          </h3>
        </div>

        {/* Document Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-3 bg-bg-elevated rounded-lg border border-border-muted text-center">
            <div className="text-lg font-semibold text-text-primary">
              {clauseCount}
            </div>
            <div className="text-sm text-text-secondary">Clauses</div>
          </div>
          <div className="p-3 bg-bg-elevated rounded-lg border border-border-muted text-center">
            <div className="text-lg font-semibold text-text-primary">
              {Math.ceil(wordCount / 100) / 10}k
            </div>
            <div className="text-sm text-text-secondary">Words</div>
          </div>
          <div className="p-3 bg-bg-elevated rounded-lg border border-border-muted text-center">
            <div className="text-lg font-semibold text-text-primary">
              {Math.ceil(charCount / 1000)}k
            </div>
            <div className="text-sm text-text-secondary">Characters</div>
          </div>
          <div className="p-3 bg-bg-elevated rounded-lg border border-border-muted text-center">
            <div className="text-lg font-semibold text-text-primary">
              {Math.ceil(wordCount / 250)}
            </div>
            <div className="text-sm text-text-secondary">Est. Pages</div>
          </div>
        </div>

        {hasStructuredData ? (
          <div className="space-y-4">
            {/* Quick Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Key Parties Summary */}
              {structuredSummary?.key_parties?.length && (
                <div
                  className="p-4 bg-accent-purple/5 border border-accent-purple/20 rounded-lg cursor-pointer hover:bg-accent-purple/10 transition-colors"
                  onClick={() => toggleSection("parties")}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-accent-purple"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                      </svg>
                      <span className="font-medium text-text-primary">
                        Key Parties
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-accent-purple font-medium">
                        {structuredSummary.key_parties.length}
                      </span>
                      <svg
                        className={`w-4 h-4 text-text-secondary transition-transform ${
                          expandedSection === "parties" ? "rotate-180" : ""
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>
                  {expandedSection === "parties" && (
                    <div className="mt-3 pt-3 border-t border-accent-purple/20">
                      <div className="flex flex-wrap gap-2">
                        {structuredSummary.key_parties.map((party, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-accent-purple/20 text-accent-purple"
                          >
                            {party}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Risk Highlights Summary */}
              {structuredSummary?.risk_highlights?.length && (
                <div
                  className="p-4 bg-accent-rose/5 border border-accent-rose/20 rounded-lg cursor-pointer hover:bg-accent-rose/10 transition-colors"
                  onClick={() => toggleSection("risks")}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-accent-rose"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                        />
                      </svg>
                      <span className="font-medium text-text-primary">
                        Risk Areas
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-accent-rose font-medium">
                        {structuredSummary.risk_highlights.length}
                      </span>
                      <svg
                        className={`w-4 h-4 text-text-secondary transition-transform ${
                          expandedSection === "risks" ? "rotate-180" : ""
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>
                  {expandedSection === "risks" && (
                    <div className="mt-3 pt-3 border-t border-accent-rose/20">
                      <div className="space-y-2">
                        {structuredSummary.risk_highlights
                          .slice(0, 3)
                          .map((risk, index) => (
                            <div
                              key={index}
                              className="text-sm text-text-secondary"
                            >
                              •{" "}
                              {risk.length > 80
                                ? `${risk.slice(0, 80)}...`
                                : risk}
                            </div>
                          ))}
                        {structuredSummary.risk_highlights.length > 3 && (
                          <div className="text-xs text-accent-rose font-medium">
                            +{structuredSummary.risk_highlights.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Important Dates and Obligations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {structuredSummary?.important_dates?.length && (
                <div
                  className="p-4 bg-accent-amber/5 border border-accent-amber/20 rounded-lg cursor-pointer hover:bg-accent-amber/10 transition-colors"
                  onClick={() => toggleSection("dates")}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-accent-amber"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      <span className="font-medium text-text-primary">
                        Important Dates
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-accent-amber font-medium">
                        {structuredSummary.important_dates.length}
                      </span>
                      <svg
                        className={`w-4 h-4 text-text-secondary transition-transform ${
                          expandedSection === "dates" ? "rotate-180" : ""
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>
                  {expandedSection === "dates" && (
                    <div className="mt-3 pt-3 border-t border-accent-amber/20">
                      <div className="space-y-2">
                        {structuredSummary.important_dates.map(
                          (date, index) => (
                            <div
                              key={index}
                              className="text-sm text-text-secondary"
                            >
                              📅 {date}
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {structuredSummary?.major_obligations?.length && (
                <div
                  className="p-4 bg-accent-green/5 border border-accent-green/20 rounded-lg cursor-pointer hover:bg-accent-green/10 transition-colors"
                  onClick={() => toggleSection("obligations")}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-accent-green"
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
                      <span className="font-medium text-text-primary">
                        Key Obligations
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-accent-green font-medium">
                        {structuredSummary.major_obligations.length}
                      </span>
                      <svg
                        className={`w-4 h-4 text-text-secondary transition-transform ${
                          expandedSection === "obligations" ? "rotate-180" : ""
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>
                  {expandedSection === "obligations" && (
                    <div className="mt-3 pt-3 border-t border-accent-green/20">
                      <div className="space-y-2">
                        {structuredSummary.major_obligations
                          .slice(0, 3)
                          .map((obligation, index) => (
                            <div
                              key={index}
                              className="text-sm text-text-secondary"
                            >
                              •{" "}
                              {obligation.length > 80
                                ? `${obligation.slice(0, 80)}...`
                                : obligation}
                            </div>
                          ))}
                        {structuredSummary.major_obligations.length > 3 && (
                          <div className="text-xs text-accent-green font-medium">
                            +{structuredSummary.major_obligations.length - 3}{" "}
                            more
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Fallback: Show basic document preview if no structured data */
          <div>
            <h4 className="text-md font-medium text-text-primary mb-3">
              Document Preview
            </h4>
            <div className="bg-bg-elevated rounded-lg p-4 max-h-64 overflow-y-auto">
              <pre className="text-sm text-text-secondary whitespace-pre-wrap font-sans">
                {fullText?.substring(0, 800) || "No document content available"}
                {fullText && fullText.length > 800 && "..."}
              </pre>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
