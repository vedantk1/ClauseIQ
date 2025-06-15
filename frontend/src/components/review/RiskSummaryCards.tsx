"use client";
import React from "react";

interface RiskSummaryCardsProps {
  safeRiskHigh: number;
  safeRiskMedium: number;
  safeRiskLow: number;
  clauseFilter: "all" | "high" | "medium" | "low";
  onFilterChange: (filter: "all" | "high" | "medium" | "low") => void;
}

export default function RiskSummaryCards({
  safeRiskHigh,
  safeRiskMedium,
  safeRiskLow,
  clauseFilter,
  onFilterChange,
}: RiskSummaryCardsProps) {
  return (
    <div className="grid grid-cols-3 gap-0 mb-4 bg-bg-surface border border-border-muted rounded-lg overflow-hidden shadow-sm">
      {/* High Risk Card - Segmented Control Style */}
      <div
        onClick={() => onFilterChange(clauseFilter === "high" ? "all" : "high")}
        className={`flex items-center justify-center gap-2 px-3 py-3 cursor-pointer transition-all hover:scale-[1.02] border-r border-border-muted ${
          clauseFilter === "high"
            ? "bg-accent-rose/20 border-2 border-accent-rose ring-1 ring-accent-rose/30"
            : "bg-accent-rose/5 hover:bg-accent-rose/10"
        }`}
        title={
          clauseFilter === "high"
            ? "Clear high risk filter"
            : "Filter to show only high risk clauses"
        }
      >
        <div className="w-3 h-3 rounded-full bg-accent-rose flex-shrink-0"></div>
        <span className="text-sm font-medium text-accent-rose whitespace-nowrap">
          {safeRiskHigh} High
        </span>
      </div>

      {/* Medium Risk Card - Segmented Control Style */}
      <div
        onClick={() =>
          onFilterChange(clauseFilter === "medium" ? "all" : "medium")
        }
        className={`flex items-center justify-center gap-2 px-3 py-3 cursor-pointer transition-all hover:scale-[1.02] border-r border-border-muted ${
          clauseFilter === "medium"
            ? "bg-accent-amber/20 border-2 border-accent-amber ring-1 ring-accent-amber/30"
            : "bg-accent-amber/5 hover:bg-accent-amber/10"
        }`}
        title={
          clauseFilter === "medium"
            ? "Clear medium risk filter"
            : "Filter to show only medium risk clauses"
        }
      >
        <div className="w-3 h-3 rounded-full bg-accent-amber flex-shrink-0"></div>
        <span className="text-sm font-medium text-accent-amber whitespace-nowrap">
          {safeRiskMedium} Medium
        </span>
      </div>

      {/* Low Risk Card - Segmented Control Style */}
      <div
        onClick={() => onFilterChange(clauseFilter === "low" ? "all" : "low")}
        className={`flex items-center justify-center gap-2 px-3 py-3 cursor-pointer transition-all hover:scale-[1.02] ${
          clauseFilter === "low"
            ? "bg-accent-green/20 border-2 border-accent-green ring-1 ring-accent-green/30"
            : "bg-accent-green/5 hover:bg-accent-green/10"
        }`}
        title={
          clauseFilter === "low"
            ? "Clear low risk filter"
            : "Filter to show only low risk clauses"
        }
      >
        <div className="w-3 h-3 rounded-full bg-accent-green flex-shrink-0"></div>
        <span className="text-sm font-medium text-accent-green whitespace-nowrap">
          {safeRiskLow} Low
        </span>
      </div>
    </div>
  );
}
