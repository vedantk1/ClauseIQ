"use client";
import React from "react";
import Card from "@/components/Card";
import DocumentStatsBar from "@/components/DocumentStatsBar";
import StructuredSummary from "@/components/StructuredSummary";
import type { Clause } from "@shared/common_generated";
import type { StructuredSummary as StructuredSummaryType } from "@/context/AnalysisContext";

interface SummaryContentProps {
  structuredSummary?: StructuredSummaryType;
  summary?: string;
  fullText?: string;
  clauses?: Clause[];
  riskSummary: { high: number; medium: number; low: number };
  onRiskCardClick: (riskLevel: "high" | "medium" | "low") => void;
}

export default function SummaryContent({
  structuredSummary,
  summary,
  fullText,
  clauses,
  riskSummary,
  onRiskCardClick,
}: SummaryContentProps) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-6">
        {/* Document Stats Bar */}
        <DocumentStatsBar
          fullText={fullText}
          clauseCount={clauses?.length || 0}
          riskSummary={riskSummary}
          clauses={clauses}
        />

        {/* Structured Summary */}
        <StructuredSummary
          structuredSummary={structuredSummary || null}
          fallbackSummary={summary}
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
      </div>
    </div>
  );
}
