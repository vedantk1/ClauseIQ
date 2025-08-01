import React from "react";
import Card from "./Card";
import CollapsibleSection from "./CollapsibleSection";
import { StructuredSummary as StructuredSummaryType } from "../context/AnalysisContext";

interface StructuredSummaryProps {
  structuredSummary: StructuredSummaryType | null;
  fallbackSummary?: string;
  sectionStates?: Record<string, boolean>;
  onSectionToggle?: (sectionId: string, isExpanded: boolean) => void;
}

// Utility function to create preview text
const createPreviewText = (
  content: string | string[],
  type: "text" | "list" = "text"
): string => {
  if (type === "list" && Array.isArray(content)) {
    if (content.length === 0) return "";
    if (content.length === 1) return content[0];
    return `${content[0]}, ${content[1]}${
      content.length > 2 ? `, +${content.length - 2} more` : ""
    }`;
  }

  if (typeof content === "string") {
    // Truncate to ~80 characters for preview
    return content.length > 80 ? content.substring(0, 77) + "..." : content;
  }

  return "";
};

export default function StructuredSummary({
  structuredSummary,
  fallbackSummary,
  sectionStates,
  onSectionToggle,
}: StructuredSummaryProps) {
  // If no structured summary, show fallback or message
  if (!structuredSummary) {
    return (
      <Card density="compact">
        <div className="mb-4">
          <h2 className="font-heading text-heading-sm text-text-primary mb-2">
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
    <div className="space-y-3">
      {/* Overview Section */}
      {structuredSummary.overview && (
        <CollapsibleSection
          title="Summary"
          sectionId="summary"
          isExpanded={sectionStates?.["summary"]}
          onToggle={onSectionToggle}
          defaultExpanded={true}
          previewText={createPreviewText(structuredSummary.overview)}
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
          <p className="text-text-secondary text-sm leading-relaxed">
            {structuredSummary.overview}
          </p>
        </CollapsibleSection>
      )}

      {/* Key Parties Section */}
      {structuredSummary.key_parties &&
        structuredSummary.key_parties.length > 0 && (
          <CollapsibleSection
            title="Key Parties"
            sectionId="key-parties"
            isExpanded={sectionStates?.["key-parties"]}
            onToggle={onSectionToggle}
            defaultExpanded={false}
            previewText={createPreviewText(
              structuredSummary.key_parties,
              "list"
            )}
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
            <div className="space-y-2">
              {structuredSummary.key_parties.map((party, index) => (
                <div
                  key={index}
                  className="p-3 bg-accent-purple/5 border border-accent-purple/20 rounded-lg"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-text-secondary text-sm leading-relaxed">
                      {party}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

      {/* Important Dates Section */}
      {structuredSummary.important_dates &&
        structuredSummary.important_dates.length > 0 && (
          <CollapsibleSection
            title="Important Dates"
            sectionId="important-dates"
            isExpanded={sectionStates?.["important-dates"]}
            onToggle={onSectionToggle}
            defaultExpanded={false}
            previewText={createPreviewText(
              structuredSummary.important_dates,
              "list"
            )}
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
                  className="p-3 bg-accent-amber/5 border border-accent-amber/20 rounded-lg"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-text-secondary text-sm leading-relaxed">{date}</span>
                  </div>
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
            sectionId="major-obligations"
            isExpanded={sectionStates?.["major-obligations"]}
            onToggle={onSectionToggle}
            defaultExpanded={false}
            previewText={createPreviewText(
              structuredSummary.major_obligations,
              "list"
            )}
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
            <div className="space-y-2">
              {structuredSummary.major_obligations.map((obligation, index) => (
                <div
                  key={index}
                  className="p-3 bg-accent-blue/5 border border-accent-blue/20 rounded-lg"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-text-secondary text-sm leading-relaxed">
                      {obligation}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

      {/* Risk Highlights Section */}
      {structuredSummary.risk_highlights &&
        structuredSummary.risk_highlights.length > 0 && (
          <CollapsibleSection
            title="Risk Highlights"
            sectionId="risk-highlights"
            isExpanded={sectionStates?.["risk-highlights"]}
            onToggle={onSectionToggle}
            defaultExpanded={false}
            previewText={createPreviewText(
              structuredSummary.risk_highlights,
              "list"
            )}
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
            <div className="space-y-2">
              {structuredSummary.risk_highlights.map((risk, index) => (
                <div
                  key={index}
                  className="p-3 bg-accent-rose/5 border border-accent-rose/20 rounded-lg"
                >
                  <div className="flex items-start gap-3">
                    {/* <svg
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
                    </svg> */}
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
            sectionId="key-insights"
            isExpanded={sectionStates?.["key-insights"]}
            onToggle={onSectionToggle}
            defaultExpanded={false}
            previewText={createPreviewText(
              structuredSummary.key_insights,
              "list"
            )}
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
            <div className="space-y-2">
              {structuredSummary.key_insights.map((insight, index) => (
                <div
                  key={index}
                  className="p-3 bg-accent-green/5 border border-accent-green/20 rounded-lg"
                >
                  <div className="flex items-start gap-3">
                    {/* <svg
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
                    </svg> */}
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
