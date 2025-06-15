"use client";
import React, { useState } from "react";
import Card from "@/components/Card";
import Button from "@/components/Button";
import {
  getRiskColor,
  getClauseTypeLabel,
  getClauseNegotiability,
  getIndustryBenchmark,
} from "./clauseUtils";
import type { Clause } from "@shared/common_generated";

interface Note {
  id: string;
  text: string;
  created_at?: string;
}

interface ClauseDetailsPanelProps {
  selectedClause: Clause | null;
  flaggedClauses: Set<string>;
  hasNotes: (clauseId: string) => boolean;
  getAllNotes: (clauseId: string) => Note[];
  getNotesCount: (clauseId: string) => number;
  onAddNote: (clause: Clause) => void;
  onEditNote: (clause: Clause, noteId?: string) => void;
  onDeleteNote: (clause: Clause, noteId?: string) => void;
  onFlagForReview: (clause: Clause, event?: React.MouseEvent) => void;
  onCopyClause: (clause: Clause) => void;
}

export default function ClauseDetailsPanel({
  selectedClause,
  flaggedClauses,
  hasNotes,
  getAllNotes,
  getNotesCount,
  onAddNote,
  onEditNote,
  onDeleteNote,
  onFlagForReview,
  onCopyClause,
}: ClauseDetailsPanelProps) {
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);

  // Get fairness score based on risk level
  const getFairnessScore = (riskLevel?: string) => {
    switch (riskLevel) {
      case "high":
        return { score: 2, color: "bg-accent-rose" };
      case "medium":
        return { score: 6, color: "bg-accent-amber" };
      case "low":
        return { score: 8, color: "bg-accent-green" };
      default:
        return { score: 5, color: "bg-gray-400" };
    }
  };

  // Fairness Score Bar Component
  const FairnessScoreBar = ({ riskLevel }: { riskLevel?: string }) => {
    const { score, color } = getFairnessScore(riskLevel);

    return (
      <div className="flex items-center gap-1">
        <div className="flex gap-0.5">
          {Array.from({ length: 10 }, (_, index) => (
            <div
              key={index}
              className={`w-1.5 h-3 rounded-sm ${
                index < score
                  ? color
                  : "bg-bg-surface border border-border-muted"
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-text-secondary ml-1">{score}/10</span>
      </div>
    );
  };

  if (!selectedClause) {
    return (
      <Card>
        <h2 className="font-heading text-heading-sm text-text-primary mb-4">
          Clause Details
        </h2>
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
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="font-heading text-heading-sm text-text-primary mb-4">
        Clause Details
      </h2>
      <div className="space-y-6">
        {/* Quick Action Bar */}
        <div className="flex items-center gap-2 p-3 bg-bg-elevated rounded-lg border border-border-muted">
          <span className="text-sm font-medium text-text-primary">
            Quick Actions:
          </span>
          <Button
            size="sm"
            variant="tertiary"
            onClick={() => onAddNote(selectedClause)}
            title="Add a personal note to this clause"
          >
            📝 Add Note
          </Button>
          <Button
            size="sm"
            variant="tertiary"
            onClick={(event) => onFlagForReview(selectedClause, event)}
            title={
              flaggedClauses.has(selectedClause.id || "")
                ? "Remove flag from this clause"
                : "Flag this clause for legal review"
            }
          >
            {flaggedClauses.has(selectedClause.id || "")
              ? "🏳️ Unflag"
              : "🚩 Flag"}
          </Button>
          <Button
            size="sm"
            variant="tertiary"
            onClick={() => onCopyClause(selectedClause)}
            title="Copy analysis to clipboard"
          >
            📋 Copy
          </Button>
        </div>

        {/* Clause Header */}
        <div>
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className="font-medium text-text-primary">
                {selectedClause.heading ||
                  `${getClauseTypeLabel(selectedClause.clause_type)} Clause`}
              </h3>
            </div>
            <div
              className={`px-3 py-1 rounded-full text-sm font-medium border ${getRiskColor(
                selectedClause.risk_level
              )}`}
            >
              {selectedClause.risk_level
                ? selectedClause.risk_level.charAt(0).toUpperCase() +
                  selectedClause.risk_level.slice(1)
                : "Unknown"}{" "}
              Risk
            </div>
          </div>
          {/* Single horizontal metadata bar */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-sm text-text-secondary bg-bg-elevated px-2 py-1 rounded">
              {getClauseTypeLabel(selectedClause.clause_type)}
            </span>
            {/* Status indicators moved to the right */}
            <div className="flex items-center gap-2">
              {selectedClause.id && flaggedClauses.has(selectedClause.id) && (
                <span className="text-xs bg-accent-rose/10 text-accent-rose px-2 py-1 rounded-full">
                  🚩 Flagged for Review
                </span>
              )}
              {selectedClause.id && hasNotes(selectedClause.id) && (
                <span className="text-xs bg-accent-blue/10 text-accent-blue px-2 py-1 rounded-full">
                  📝 Has {getNotesCount(selectedClause.id)} Note
                  {getNotesCount(selectedClause.id) !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Clause Summary */}
        {selectedClause.summary && (
          <div>
            <h4 className="font-medium text-text-primary mb-2">Summary</h4>
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
        {selectedClause.key_points && selectedClause.key_points.length > 0 && (
          <div>
            <h4 className="font-medium text-text-primary mb-2">Key Points</h4>
            <ul className="space-y-1">
              {selectedClause.key_points.map((point: string, index: number) => (
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
                  (rec: string, index: number) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <span className="w-5 h-5 rounded-full bg-accent-green/20 text-accent-green flex items-center justify-center text-xs font-medium mt-0.5 flex-shrink-0">
                        ✓
                      </span>
                      <span className="text-text-secondary">{rec}</span>
                    </li>
                  )
                )}
              </ul>
            </div>
          )}

        {/* User Notes Display - Collapsible Enhanced UI */}
        {selectedClause.id && hasNotes(selectedClause.id) && (
          <div className="bg-accent-blue/5 border border-accent-blue/20 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setIsNotesExpanded(!isNotesExpanded)}
                className="flex items-center gap-2 font-medium text-accent-blue text-sm hover:text-accent-blue/80 transition-colors"
              >
                <span
                  className={`transform transition-transform ${
                    isNotesExpanded ? "rotate-90" : "rotate-0"
                  }`}
                >
                  ▶
                </span>
                📝 Your Notes ({getNotesCount(selectedClause.id)})
              </button>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="tertiary"
                  onClick={() => onAddNote(selectedClause)}
                  title="Add another note"
                  className="text-xs text-accent-green hover:bg-accent-green/10"
                >
                  ➕ Add
                </Button>
              </div>
            </div>

            {/* Notes List - Enhanced Design with Collapsible */}
            {isNotesExpanded && (
              <div className="space-y-3">
                {getAllNotes(selectedClause.id)
                  .filter((note) => note && note.id && note.text)
                  .map((note, index) => {
                    // Additional safety check to prevent crashes from corrupted state
                    if (!note || !note.id || !note.text) {
                      console.warn(
                        "🚨 [WARNING] Invalid note found in map, skipping:",
                        note
                      );
                      return null;
                    }
                    return (
                      <div
                        key={note.id}
                        className="border border-border-muted rounded-lg p-3 bg-bg-elevated shadow-sm hover:shadow-md transition-shadow"
                      >
                        {/* Note Header */}
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center justify-center w-6 h-6 bg-accent-blue/10 text-accent-blue rounded-full text-xs font-medium">
                              {index + 1}
                            </span>
                            <span className="text-xs text-text-secondary">
                              {note.created_at ? (
                                <>
                                  {new Date(
                                    note.created_at
                                  ).toLocaleDateString()}{" "}
                                  at{" "}
                                  {new Date(note.created_at).toLocaleTimeString(
                                    [],
                                    {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    }
                                  )}
                                </>
                              ) : (
                                "No date"
                              )}
                            </span>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="tertiary"
                              onClick={() =>
                                onEditNote(selectedClause, note.id)
                              }
                              title="Edit this note"
                              className="text-xs text-accent-blue hover:bg-accent-blue/10 px-2 py-1"
                            >
                              ✏️
                            </Button>
                            <Button
                              size="sm"
                              variant="tertiary"
                              onClick={() =>
                                onDeleteNote(selectedClause, note.id)
                              }
                              title="Delete this note"
                              className="text-xs text-accent-rose hover:bg-accent-rose/10 px-2 py-1"
                            >
                              🗑️
                            </Button>
                          </div>
                        </div>

                        {/* Note Content */}
                        <div className="bg-bg-surface rounded p-3 border-l-4 border-accent-blue">
                          <p className="text-sm text-text-primary leading-relaxed">
                            {note.text}
                          </p>
                        </div>
                      </div>
                    );
                  })
                  .filter(Boolean)}
              </div>
            )}

            {/* Quick Actions Footer - Show when expanded */}
            {isNotesExpanded && (
              <div className="mt-3 pt-3 border-t border-border-muted">
                <div className="flex items-center justify-between text-xs text-text-secondary">
                  <span>Total notes: {getNotesCount(selectedClause.id)}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onAddNote(selectedClause)}
                      className="text-accent-green hover:underline"
                    >
                      + Add another note
                    </button>
                  </div>
                </div>
              </div>
            )}
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
                <span className="font-medium">Market Position:</span>
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

        {/* Clause Insights */}
        <div className="bg-bg-elevated rounded-lg p-3">
          <h5 className="font-medium text-text-primary text-sm mb-2">
            📊 Clause Insights
          </h5>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-text-secondary">Fairness Score:</span>
              <FairnessScoreBar riskLevel={selectedClause.risk_level} />
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Industry Standard:</span>
              <span className="text-text-primary">
                {selectedClause.risk_level === "high"
                  ? "Below Average"
                  : selectedClause.risk_level === "medium"
                  ? "Typical"
                  : "Above Average"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Negotiability:</span>
              <span className="text-accent-green">
                {getClauseNegotiability(selectedClause.clause_type)}
              </span>
            </div>
          </div>
        </div>

        {/* Full Clause Text */}
        <div>
          <h4 className="font-medium text-text-primary mb-2">Full Text</h4>
          <div className="bg-bg-elevated rounded-lg p-4 max-h-48 overflow-y-auto">
            <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
              {selectedClause.text}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
