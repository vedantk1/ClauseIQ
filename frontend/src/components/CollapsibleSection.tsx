"use client";
import React, { useState, useRef } from "react";
import Card from "./Card";

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  className?: string;
  previewText?: string; // New prop for preview text
  sectionId?: string; // Unique identifier for state persistence
  isExpanded?: boolean; // External state control
  onToggle?: (sectionId: string, isExpanded: boolean) => void; // External state callback
}

export default function CollapsibleSection({
  title,
  icon,
  children,
  defaultExpanded = true,
  className = "",
  previewText,
  sectionId,
  isExpanded: externalIsExpanded,
  onToggle,
}: CollapsibleSectionProps) {
  // Use external state if provided, otherwise fall back to internal state
  const [internalIsExpanded, setInternalIsExpanded] = useState(defaultExpanded);
  const isExpanded =
    externalIsExpanded !== undefined ? externalIsExpanded : internalIsExpanded;
  const contentRef = useRef<HTMLDivElement>(null);

  const toggleExpanded = () => {
    if (onToggle && sectionId) {
      // External state management
      onToggle(sectionId, !isExpanded);
    } else {
      // Internal state management (fallback)
      setInternalIsExpanded(!internalIsExpanded);
    }
  };

  return (
    <Card density="compact" className={`!p-3 ${className}`}>
      <div className={isExpanded ? "mb-4" : "mb-0"}>
        {/* Header with toggle button */}
        <button
          onClick={toggleExpanded}
          className={`flex items-center gap-2 w-full text-left group hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-accent-blue/20 rounded-md p-1 -m-1 ${
            isExpanded ? "mb-2" : "mb-0"
          }`}
          aria-expanded={isExpanded}
          aria-controls={`section-${title.replace(/\s+/g, "-").toLowerCase()}`}
          type="button"
        >
          {icon}
          <div className="flex-1 min-w-0">
            <h2 className="font-heading text-heading-sm text-text-primary">
              {title}
            </h2>
            {/* Preview text when collapsed */}
            {!isExpanded && previewText && (
              <p className="text-xs text-text-secondary mt-1 truncate">
                {previewText}
              </p>
            )}
          </div>
          <svg
            className={`w-4 h-4 text-text-secondary transition-transform duration-200 flex-shrink-0 ${
              isExpanded ? "rotate-90" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>

        {/* Content with smooth height animation */}
        <div
          id={`section-${title.replace(/\s+/g, "-").toLowerCase()}`}
          className="transition-all duration-300 ease-in-out overflow-hidden"
          style={{ height: isExpanded ? "auto" : 0 }}
        >
          <div ref={contentRef}>{children}</div>
        </div>
      </div>
    </Card>
  );
}
