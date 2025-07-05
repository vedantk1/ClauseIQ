"use client";
import React, { useState, useRef, useEffect } from "react";
import Card from "./Card";

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  className?: string;
}

export default function CollapsibleSection({
  title,
  icon,
  children,
  defaultExpanded = true,
  className = "",
}: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [height, setHeight] = useState<number | undefined>(
    defaultExpanded ? undefined : 0
  );
  const contentRef = useRef<HTMLDivElement>(null);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  useEffect(() => {
    if (contentRef.current) {
      if (isExpanded) {
        setHeight(contentRef.current.scrollHeight);
      } else {
        setHeight(0);
      }
    }
  }, [isExpanded]);

  return (
    <Card className={className}>
      <div className="mb-6">
        {/* Header with toggle button */}
        <button
          onClick={toggleExpanded}
          className="flex items-center gap-2 mb-3 w-full text-left group hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-accent-blue/20 rounded-md p-1 -m-1"
          aria-expanded={isExpanded}
          aria-controls={`section-${title.replace(/\s+/g, "-").toLowerCase()}`}
          type="button"
        >
          {icon}
          <h2 className="font-heading text-heading-sm text-text-primary flex-1">
            {title}
          </h2>
          <svg
            className={`w-4 h-4 text-text-secondary transition-transform duration-200 ${
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
          style={{ height }}
        >
          <div ref={contentRef}>{children}</div>
        </div>
      </div>
    </Card>
  );
}
