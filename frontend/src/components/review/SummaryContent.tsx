"use client";
import React from "react";
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
}

export default function SummaryContent({
  structuredSummary,
  summary,
  fullText,
  clauses,
  riskSummary,
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
      </div>
    </div>
  );
}
