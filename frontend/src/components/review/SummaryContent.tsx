"use client";
import React from "react";
import Card from "@/components/Card";
import Button from "@/components/Button";
import StructuredSummary from "@/components/StructuredSummary";
import DocumentInsights from "@/components/DocumentInsights";
import type { Clause } from "@shared/common_generated";
import type { StructuredSummary as StructuredSummaryType } from "@/context/AnalysisContext";

interface SummaryContentProps {
  structuredSummary?: StructuredSummaryType;
  summary?: string;
  fileName?: string;
  fullText?: string;
  clauses?: Clause[];
  riskSummary: { high: number; medium: number; low: number };
  onRiskCardClick: (riskLevel: "high" | "medium" | "low") => void;
  onDownloadPdf: () => void;
  onDownloadOriginalPdf: () => void;
  isDownloadingPdf: boolean;
  isDownloadingOriginalPdf: boolean;
}

export default function SummaryContent({
  structuredSummary,
  summary,
  fileName,
  fullText,
  clauses,
  riskSummary,
  onRiskCardClick,
  onDownloadPdf,
  onDownloadOriginalPdf,
  isDownloadingPdf,
  isDownloadingOriginalPdf,
}: SummaryContentProps) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-6">
        {/* Structured Summary */}
        <StructuredSummary
          structuredSummary={structuredSummary || null}
          fallbackSummary={summary}
        />

        {/* Document Insights */}
        <DocumentInsights
          structuredSummary={structuredSummary}
          fileName={fileName}
          fullText={fullText}
          clauseCount={clauses?.length || 0}
          riskSummary={riskSummary}
          clauses={clauses}
        />

        {/* Risk Overview */}
        <Card density="compact">
          <h3 className="font-heading text-lg text-text-primary mb-4">
            Risk Overview
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-text-secondary">Overall Risk</span>
              <span
                className={`font-medium ${
                  riskSummary.high > 0
                    ? "text-accent-rose"
                    : riskSummary.medium > 0
                    ? "text-accent-amber"
                    : riskSummary.low > 0
                    ? "text-accent-green"
                    : "text-text-secondary"
                }`}
              >
                {riskSummary.high > 0
                  ? "High"
                  : riskSummary.medium > 0
                  ? "Medium"
                  : riskSummary.low > 0
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
              {riskSummary.high > 0 && (
                <div
                  className="flex items-center gap-2 p-2 rounded bg-accent-rose/10 cursor-pointer hover:bg-accent-rose/15 transition-colors"
                  onClick={() => onRiskCardClick("high")}
                  title="Click to view high-risk clauses"
                >
                  <div className="w-2 h-2 bg-accent-rose rounded-full"></div>
                  <span className="text-sm text-accent-rose font-medium">
                    {riskSummary.high} high-risk clause
                    {riskSummary.high > 1 ? "s" : ""} found
                  </span>
                </div>
              )}
              {riskSummary.medium > 0 && (
                <div
                  className="flex items-center gap-2 p-2 rounded bg-accent-amber/10 cursor-pointer hover:bg-accent-amber/15 transition-colors"
                  onClick={() => onRiskCardClick("medium")}
                  title="Click to view medium-risk clauses"
                >
                  <div className="w-2 h-2 bg-accent-amber rounded-full"></div>
                  <span className="text-sm text-accent-amber font-medium">
                    {riskSummary.medium} medium-risk clause
                    {riskSummary.medium > 1 ? "s" : ""} to review
                  </span>
                </div>
              )}
              {riskSummary.low > 0 && (
                <div
                  className="flex items-center gap-2 p-2 rounded bg-accent-green/10 cursor-pointer hover:bg-accent-green/15 transition-colors"
                  onClick={() => onRiskCardClick("low")}
                  title="Click to view low-risk clauses"
                >
                  <div className="w-2 h-2 bg-accent-green rounded-full"></div>
                  <span className="text-sm text-accent-green font-medium">
                    {riskSummary.low} low-risk clause
                    {riskSummary.low > 1 ? "s" : ""} look good
                  </span>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Quick Actions */}
        <Card density="compact">
          <h3 className="font-heading text-lg text-text-primary mb-4">
            Quick Actions
          </h3>
          <div className="space-y-3">
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-start"
              onClick={onDownloadPdf}
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
              {isDownloadingPdf ? "Generating PDF..." : "Download PDF Report"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-start"
              onClick={onDownloadOriginalPdf}
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
  );
}
