"use client";
import React, { useState, useMemo } from "react";
import {
  Worker,
  Viewer,
  ScrollMode,
  PageChangeEvent,
} from "@react-pdf-viewer/core";
import { zoomPlugin } from "@react-pdf-viewer/zoom";
import { pageNavigationPlugin } from "@react-pdf-viewer/page-navigation";
import { searchPlugin } from "@react-pdf-viewer/search";
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/page-navigation/lib/styles/index.css";
import "@react-pdf-viewer/search/lib/styles/index.css";
import "../styles/pdf-viewer.css";

import Card from "./Card";
import Button from "./Button";
import DropdownMenu from "./DropdownMenu";
import config from "@/config/config";
import "../utils/pdfConsoleFilter";

interface ContinuousScrollPDFViewerProps {
  documentId: string;
  fileName?: string;
  className?: string;
  // Text to highlight in the PDF
  highlightText?: string;
  // Optional dropdown menu props
  dropdownMenuItems?: Array<{
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    variant?: "default" | "danger";
  }>;
}

export default function ContinuousScrollPDFViewer({
  documentId,
  fileName = "Document",
  className = "",
  highlightText,
  dropdownMenuItems,
}: ContinuousScrollPDFViewerProps) {
  const [scale, setScale] = useState(1.0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"single" | "continuous">(
    "continuous"
  );
  const [currentPage, setCurrentPage] = useState(0);

  // Create plugin instances
  const zoomPluginInstance = zoomPlugin();
  const { zoomTo } = zoomPluginInstance;

  const pageNavigationPluginInstance = pageNavigationPlugin();
  const { GoToPreviousPage, GoToNextPage, CurrentPageLabel } =
    pageNavigationPluginInstance;

  const searchPluginInstance = searchPlugin();
  const { highlight } = searchPluginInstance;

  // PDF URL with authentication - fixed dependency array
  const pdfUrl = useMemo(() => {
    const token = localStorage.getItem("access_token");
    const baseUrl = `${config.apiUrl}/api/v1/documents/${documentId}/pdf`;
    const finalUrl = token
      ? `${baseUrl}?token=${encodeURIComponent(token)}`
      : baseUrl;
    return finalUrl;
  }, [documentId]);

  // Toggle view mode function
  const toggleViewMode = () => {
    setViewMode((prev) => (prev === "single" ? "continuous" : "single"));
  };

  // Handle document load
  const handleDocumentLoad = (e: { doc: { numPages: number } }) => {
    setNumPages(e.doc.numPages);
    setIsLoading(false);
    setError(null);

    // Set initial zoom level
    zoomTo(scale);
  };

  // Handle highlighting when text is provided
  React.useEffect(() => {
    if (highlightText && !isLoading) {
      // Small delay to ensure PDF is fully loaded
      const timer = setTimeout(() => {
        try {
          // Try exact text first
          highlight(highlightText);
        } catch {
          console.warn("Failed to highlight exact text, trying keywords...");
          // Fallback: extract first and last few words
          const words = highlightText.trim().split(/\s+/);
          if (words.length > 6) {
            const keywords = [...words.slice(0, 3), ...words.slice(-3)];
            highlight(keywords);
          } else {
            highlight(words);
          }
        }
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [highlightText, isLoading, highlight]);

  // Handle page change - sync with library's internal state
  const handlePageChange = (e: PageChangeEvent) => {
    setCurrentPage(e.currentPage);
  };

  // Debug: Monitor state changes
  // Zoom controls
  const zoomIn = () => {
    const newScale = Math.min(scale + 0.2, 3.0);
    setScale(newScale);
    zoomTo(newScale);
  };

  const zoomOut = () => {
    const newScale = Math.max(scale - 0.2, 0.5);
    setScale(newScale);
    zoomTo(newScale);
  };

  const resetZoom = () => {
    setScale(1.0);
    zoomTo(1.0);
  };

  // Show error state if there's an error
  if (error) {
    return (
      <Card
        className={`flex flex-col shadow-lg rounded-lg border border-accent-rose/20 ${className}`}
      >
        <div className="flex items-center justify-center h-full p-8">
          <div className="text-center">
            <div className="text-accent-rose text-lg font-semibold mb-2">
              Failed to Load PDF
            </div>
            <div className="text-text-secondary text-sm mb-4">{error}</div>
            <Button
              onClick={() => window.location.reload()}
              size="sm"
              variant="secondary"
            >
              Retry
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className={`h-full flex flex-col shadow-lg border border-border-muted !p-0 ${className}`}
      rounded={false}
    >
      {/* Header with controls - ClauseIQ Professional Styling */}
      <div className="flex items-center justify-between p-4 border-b border-border-muted bg-gradient-to-r from-bg-surface to-bg-elevated">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-text-primary">
            📄 {fileName}
          </h3>
          {numPages && (
            <span className="text-sm text-text-secondary bg-bg-elevated px-2 py-1 rounded-md">
              {numPages} pages
            </span>
          )}
        </div>

        {/* Controls Section - View Mode Toggle, Page Navigation & Zoom */}
        <div className="flex items-center gap-4">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-2">
            <Button
              onClick={toggleViewMode}
              size="sm"
              variant="secondary"
              title={
                viewMode === "single"
                  ? "Switch to continuous view"
                  : "Switch to single-page view"
              }
            >
              {viewMode === "single" ? "📄" : "📜"}{" "}
              {viewMode === "single" ? "Single" : "Scroll"}
            </Button>
          </div>

          {/* Page Navigation - Only show in single mode */}
          {viewMode === "single" && numPages && (
            <div className="flex items-center gap-2 border-l border-border-muted pl-4">
              <GoToPreviousPage>
                {(props) => (
                  <Button
                    onClick={props.onClick}
                    size="sm"
                    variant="secondary"
                    disabled={props.isDisabled}
                    title="Previous page"
                  >
                    ←
                  </Button>
                )}
              </GoToPreviousPage>

              <CurrentPageLabel>
                {(props) => (
                  <span className="text-sm text-text-secondary min-w-16 text-center font-medium">
                    {props.currentPage + 1} / {props.numberOfPages}
                  </span>
                )}
              </CurrentPageLabel>

              <GoToNextPage>
                {(props) => (
                  <Button
                    onClick={props.onClick}
                    size="sm"
                    variant="secondary"
                    disabled={props.isDisabled}
                    title="Next page"
                  >
                    →
                  </Button>
                )}
              </GoToNextPage>
            </div>
          )}

          {/* Zoom Controls */}
          <div className="flex items-center gap-2 border-l border-border-muted pl-4">
            <Button
              onClick={zoomOut}
              size="sm"
              variant="secondary"
              disabled={scale <= 0.5}
            >
              🔍−
            </Button>
            <span className="text-sm text-text-secondary min-w-12 text-center font-medium">
              {Math.round(scale * 100)}%
            </span>
            <Button
              onClick={zoomIn}
              size="sm"
              variant="secondary"
              disabled={scale >= 3.0}
            >
              🔍+
            </Button>
            <Button onClick={resetZoom} size="sm" variant="secondary">
              Reset
            </Button>
          </div>

          {/* Document Actions Menu */}
          {dropdownMenuItems && dropdownMenuItems.length > 0 && (
            <div className="flex items-center border-l border-border-muted pl-4">
              <DropdownMenu
                align="right"
                triggerVariant="default"
                trigger={
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                    />
                  </svg>
                }
                items={dropdownMenuItems}
              />
            </div>
          )}
        </div>
      </div>

      {/* 🎯 CONTINUOUS SCROLL PDF VIEWER - ClauseIQ Professional Background */}
      <div
        className="flex-1 bg-bg-surface relative min-h-0 overflow-auto"
        style={{ height: "calc(100vh - 70px)" }}
      >
        {isLoading && (
          <div className="absolute inset-0 bg-bg-surface flex items-center justify-center z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-purple mx-auto mb-2"></div>
              <div className="text-sm text-text-secondary font-medium">
                Loading PDF...
              </div>
            </div>
          </div>
        )}
        <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
          <div style={{ height: "100%" }} className="pdf-viewer-container">
            <Viewer
              fileUrl={pdfUrl}
              onDocumentLoad={handleDocumentLoad}
              onPageChange={handlePageChange}
              plugins={[
                zoomPluginInstance,
                pageNavigationPluginInstance,
                searchPluginInstance,
              ]}
              scrollMode={
                viewMode === "single" ? ScrollMode.Page : ScrollMode.Vertical
              }
              initialPage={0}
              key={`pdf-viewer-${viewMode}`}
            />
          </div>
        </Worker>
      </div>
    </Card>
  );
}
