"use client";
import React from "react";
import DocumentStatsBar from "@/components/DocumentStatsBar";
import StructuredSummary from "@/components/StructuredSummary";
import type { Clause } from "@clauseiq/shared-types";
import type { StructuredSummary as StructuredSummaryType } from "@/context/AnalysisContext";

interface SummaryContentProps {
  structuredSummary?: StructuredSummaryType;
  summary?: string;
  fullText?: string;
  clauses?: Clause[];
  riskSummary: { high: number; medium: number; low: number };
  sectionStates: Record<string, boolean>;
  onSectionToggle: (sectionId: string, isExpanded: boolean) => void;
  onClausesClick?: () => void;
  lastViewed?: string | null;
}

export default function SummaryContent({
  structuredSummary,
  summary,
  fullText,
  clauses,
  riskSummary,
  sectionStates,
  onSectionToggle,
  onClausesClick,
  lastViewed,
}: SummaryContentProps) {
  return (
    <div className="h-full flex flex-col">
      {/* Header - fixed */}
      {/* <div className="p-4 border-b border-border-muted flex-shrink-0">
        <h2 className="font-heading text-heading-sm text-text-primary">
          Document Overview
        </h2>
      </div> */}

      {/* Content area - flexible with scrolling */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-4 space-y-3">
          {/* Document Stats Bar */}
          <DocumentStatsBar
            fullText={fullText}
            clauseCount={clauses?.length || 0}
            riskSummary={riskSummary}
            clauses={clauses}
            onClausesClick={onClausesClick}
            lastViewed={lastViewed}
          />

          {/* Structured Summary */}
          <StructuredSummary
            structuredSummary={structuredSummary || null}
            fallbackSummary={summary}
            sectionStates={sectionStates}
            onSectionToggle={onSectionToggle}
          />
        </div>
      </div>
    </div>
  );
}
