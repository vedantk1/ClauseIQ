import React from "react";
import Card from "./Card";
import CollapsibleSection from "./CollapsibleSection";
import { StructuredSummary as StructuredSummaryType } from "../context/AnalysisContext";

interface StructuredSummaryProps {
  structuredSummary: StructuredSummaryType | null;
  fallbackSummary?: string;
}

export default function StructuredSummary({
  structuredSummary,
  fallbackSummary,
}: StructuredSummaryProps) {
  // If no structured summary, show fallback or message
  if (!structuredSummary) {
    return (
      <Card>
        <div className="mb-6">
          <h2 className="font-heading text-heading-sm text-text-primary mb-3">
            AI Summary
          </h2>
          <div className="prose prose-invert max-w-none">
            <p className="text-text-secondary leading-relaxed">
              {fallbackSummary ||
                "No summary available. The document analysis may still be processing."}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Section */}
      {structuredSummary.overview && (
        <CollapsibleSection
          title="Document Overview"
          defaultExpanded={true}
          icon={
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          }
        >
          <p className="text-text-secondary leading-relaxed">
            {structuredSummary.overview}
          </p>
        </CollapsibleSection>
      )}

      {/* Key Parties Section */}
      {structuredSummary.key_parties &&
        structuredSummary.key_parties.length > 0 && (
          <CollapsibleSection
            title="Key Parties"
            defaultExpanded={false}
            icon={
              <svg
                className="w-5 h-5 text-accent-purple"
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
            }
          >
            <div className="flex flex-wrap gap-2">
              {structuredSummary.key_parties.map((party, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-bg-elevated text-text-primary border border-border-muted"
                >
                  {party}
                </span>
              ))}
            </div>
          </CollapsibleSection>
        )}

      {/* Important Dates Section */}
      {structuredSummary.important_dates &&
        structuredSummary.important_dates.length > 0 && (
          <CollapsibleSection
            title="Important Dates"
            defaultExpanded={false}
            icon={
              <svg
                className="w-5 h-5 text-accent-amber"
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
            }
          >
            <div className="space-y-2">
              {structuredSummary.important_dates.map((date, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 bg-bg-elevated rounded-lg border border-border-muted"
                >
                  <div className="w-2 h-2 bg-accent-amber rounded-full flex-shrink-0"></div>
                  <span className="text-text-secondary">{date}</span>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

      {/* Major Obligations Section */}
      {structuredSummary.major_obligations &&
        structuredSummary.major_obligations.length > 0 && (
          <CollapsibleSection
            title="Major Obligations"
            defaultExpanded={false}
            icon={
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
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
          >
            <ul className="space-y-3">
              {structuredSummary.major_obligations.map((obligation, index) => (
                <li key={index} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 bg-accent-blue rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-text-secondary leading-relaxed">
                    {obligation}
                  </span>
                </li>
              ))}
            </ul>
          </CollapsibleSection>
        )}

      {/* Risk Highlights Section */}
      {structuredSummary.risk_highlights &&
        structuredSummary.risk_highlights.length > 0 && (
          <CollapsibleSection
            title="Risk Highlights"
            defaultExpanded={true}
            icon={
              <svg
                className="w-5 h-5 text-accent-rose"
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
            }
          >
            <div className="space-y-3">
              {structuredSummary.risk_highlights.map((risk, index) => (
                <div
                  key={index}
                  className="p-4 bg-accent-rose/5 border border-accent-rose/20 rounded-lg"
                >
                  <div className="flex items-start gap-3">
                    <svg
                      className="w-4 h-4 text-accent-rose mt-0.5 flex-shrink-0"
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
                    <span className="text-text-secondary text-sm leading-relaxed">
                      {risk}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

      {/* Key Insights Section */}
      {structuredSummary.key_insights &&
        structuredSummary.key_insights.length > 0 && (
          <CollapsibleSection
            title="Key Insights"
            defaultExpanded={false}
            icon={
              <svg
                className="w-5 h-5 text-accent-green"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            }
          >
            <div className="space-y-3">
              {structuredSummary.key_insights.map((insight, index) => (
                <div
                  key={index}
                  className="p-4 bg-accent-green/5 border border-accent-green/20 rounded-lg"
                >
                  <div className="flex items-start gap-3">
                    <svg
                      className="w-4 h-4 text-accent-green mt-0.5 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                      />
                    </svg>
                    <span className="text-text-secondary text-sm leading-relaxed">
                      {insight}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}
    </div>
  );
}
