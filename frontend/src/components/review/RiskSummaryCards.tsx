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
    <div className="grid grid-cols-3 gap-2 mb-4">
      {/* High Risk Card */}
      <div
        onClick={() => onFilterChange(clauseFilter === "high" ? "all" : "high")}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all hover:scale-105 ${
          clauseFilter === "high"
            ? "bg-accent-rose/20 border-2 border-accent-rose ring-2 ring-accent-rose/30"
            : "bg-accent-rose/10 border border-accent-rose/20 hover:bg-accent-rose/15"
        }`}
        title={
          clauseFilter === "high"
            ? "Clear high risk filter"
            : "Filter to show only high risk clauses"
        }
      >
        <div className="w-3 h-3 rounded-full bg-accent-rose"></div>
        <span className="text-sm font-medium text-accent-rose">
          {safeRiskHigh} High
        </span>
      </div>

      {/* Medium Risk Card */}
      <div
        onClick={() =>
          onFilterChange(clauseFilter === "medium" ? "all" : "medium")
        }
        className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all hover:scale-105 ${
          clauseFilter === "medium"
            ? "bg-accent-amber/20 border-2 border-accent-amber ring-2 ring-accent-amber/30"
            : "bg-accent-amber/10 border border-accent-amber/20 hover:bg-accent-amber/15"
        }`}
        title={
          clauseFilter === "medium"
            ? "Clear medium risk filter"
            : "Filter to show only medium risk clauses"
        }
      >
        <div className="w-3 h-3 rounded-full bg-accent-amber"></div>
        <span className="text-sm font-medium text-accent-amber">
          {safeRiskMedium} Medium
        </span>
      </div>

      {/* Low Risk Card */}
      <div
        onClick={() => onFilterChange(clauseFilter === "low" ? "all" : "low")}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all hover:scale-105 ${
          clauseFilter === "low"
            ? "bg-accent-green/20 border-2 border-accent-green ring-2 ring-accent-green/30"
            : "bg-accent-green/10 border border-accent-green/20 hover:bg-accent-green/15"
        }`}
        title={
          clauseFilter === "low"
            ? "Clear low risk filter"
            : "Filter to show only low risk clauses"
        }
      >
        <div className="w-3 h-3 rounded-full bg-accent-green"></div>
        <span className="text-sm font-medium text-accent-green">
          {safeRiskLow} Low
        </span>
      </div>
    </div>
  );
}
