"use client";
import React, { useState, useMemo, useEffect } from "react";
import { Worker, Viewer, ScrollMode } from "@react-pdf-viewer/core";
import { zoomPlugin } from "@react-pdf-viewer/zoom";
import { pageNavigationPlugin } from "@react-pdf-viewer/page-navigation";
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/page-navigation/lib/styles/index.css";
import "../styles/pdf-viewer.css";

import Card from "./Card";
import Button from "./Button";
import config from "@/config/config";
import "../utils/pdfConsoleFilter";

interface ContinuousScrollPDFViewerProps {
  documentId: string;
  fileName?: string;
  className?: string;
}

export default function ContinuousScrollPDFViewer({
  documentId,
  fileName = "Document",
  className = "",
}: ContinuousScrollPDFViewerProps) {
  const [scale, setScale] = useState(1.0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<"single" | "continuous">("single");

  // Create zoom plugin instance
  const zoomPluginInstance = zoomPlugin();
  const { zoomTo } = zoomPluginInstance;

  // Create page navigation plugin instance
  const pageNavigationPluginInstance = pageNavigationPlugin();
  const { jumpToPage } = pageNavigationPluginInstance;

  // PDF URL with authentication
  const pdfUrl = useMemo(() => {
    const token = localStorage.getItem("access_token");
    const baseUrl = `${config.apiUrl}/api/v1/documents/${documentId}/pdf`;
    const finalUrl = token
      ? `${baseUrl}?token=${encodeURIComponent(token)}`
      : baseUrl;
    return finalUrl;
  }, [documentId]);

  // Handle document load
  const handleDocumentLoad = (e: { doc: { numPages: number } }) => {
    console.log("✅ [DEBUG] PDF LOADED:", {
      numPages: e.doc.numPages,
      currentViewMode: viewMode,
      currentPage: currentPage,
      scale: scale,
      viewerKey: `pdf-viewer-${viewMode}-${currentPage}`,
      timestamp: new Date().toISOString(),
      jumpToPageFunction:
        typeof jumpToPage === "function" ? "available" : "not available",
    });
    setNumPages(e.doc.numPages);
    setIsLoading(false);
    setError(null);
    // Set initial zoom level
    zoomTo(scale);
  };

  // Debug: Monitor state changes
  useEffect(() => {
    console.log("🔄 [DEBUG] ViewMode changed to:", viewMode);
  }, [viewMode]);

  useEffect(() => {
    console.log(
      "🔄 [DEBUG] CurrentPage changed to:",
      currentPage,
      "of",
      numPages
    );
  }, [currentPage, numPages]);

  useEffect(() => {
    console.log("🔄 [DEBUG] Scale changed to:", scale);
  }, [scale]);

  useEffect(() => {
    console.log("🖥️ [DEBUG] Viewer props changed:", {
      viewMode,
      scrollMode: viewMode === "single" ? "Page" : "Vertical",
      currentPage,
      initialPage: currentPage - 1,
      scale,
      numPages,
      jumpToPageAvailable: typeof jumpToPage === "function",
    });
  }, [viewMode, currentPage, scale, numPages, jumpToPage]); // Zoom controls
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

  // Page navigation controls
  const goToNextPage = () => {
    console.log("🔄 [DEBUG] goToNextPage called:", {
      currentPage,
      numPages,
      viewMode,
    });
    if (numPages && currentPage < numPages) {
      const newPage = currentPage + 1;
      console.log("📄 [DEBUG] Setting currentPage to:", newPage);
      setCurrentPage(newPage);
      // Use jumpToPage for proper navigation in single-page mode
      if (viewMode === "single") {
        console.log(
          "🎯 [DEBUG] Using jumpToPage for navigation to page:",
          newPage - 1
        );
        jumpToPage(newPage - 1); // jumpToPage uses 0-based indexing
      }
    } else {
      console.log(
        "🚫 [DEBUG] Cannot go to next page - at boundary or no pages"
      );
    }
  };

  const goToPrevPage = () => {
    console.log("🔄 [DEBUG] goToPrevPage called:", {
      currentPage,
      numPages,
      viewMode,
    });
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      console.log("📄 [DEBUG] Setting currentPage to:", newPage);
      setCurrentPage(newPage);
      // Use jumpToPage for proper navigation in single-page mode
      if (viewMode === "single") {
        console.log(
          "🎯 [DEBUG] Using jumpToPage for navigation to page:",
          newPage - 1
        );
        jumpToPage(newPage - 1); // jumpToPage uses 0-based indexing
      }
    } else {
      console.log("🚫 [DEBUG] Cannot go to previous page - already at page 1");
    }
  };

  // View mode toggle
  const toggleViewMode = () => {
    console.log("🔄 [DEBUG] toggleViewMode called, current mode:", viewMode);
    const newMode = viewMode === "single" ? "continuous" : "single";
    console.log("📄 [DEBUG] ViewMode changing from", viewMode, "to", newMode);
    setViewMode(newMode);
    if (viewMode === "continuous") {
      console.log(
        "📄 [DEBUG] Resetting to page 1 when switching to single mode"
      );
      setCurrentPage(1); // Reset to first page when switching to single mode
    }
  };

  // Show error state if there's an error
  if (error) {
    return (
      <Card
        className={`h-full flex flex-col shadow-lg rounded-lg border border-red-200 ${className}`}
      >
        <div className="flex items-center justify-center h-full p-8">
          <div className="text-center">
            <div className="text-red-600 text-lg font-semibold mb-2">
              Failed to Load PDF
            </div>
            <div className="text-slate-600 text-sm mb-4">{error}</div>
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
      className={`h-full flex flex-col shadow-lg rounded-lg border border-gray-200 ${className}`}
    >
      {/* Header with controls - ClauseIQ Professional Styling */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-slate-50 to-gray-50">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-slate-800">
            📄 {fileName}
          </h3>
          {numPages && (
            <span className="text-sm text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
              {numPages} pages
            </span>
          )}
        </div>

        {/* Controls Section - View Mode, Page Navigation & Zoom */}
        <div className="flex items-center gap-4">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-2">
            <Button
              onClick={toggleViewMode}
              size="sm"
              variant={viewMode === "single" ? "primary" : "secondary"}
              title={`Switch to ${
                viewMode === "single" ? "continuous" : "single-page"
              } view`}
            >
              {viewMode === "single" ? "📄" : "📜"}
            </Button>
            <span className="text-xs text-slate-500">
              {viewMode === "single" ? "Single" : "Scroll"}
            </span>
          </div>

          {/* Page Navigation (only in single-page mode) */}
          {viewMode === "single" && numPages && (
            <div className="flex items-center gap-2 border-l border-gray-300 pl-4">
              <Button
                onClick={goToPrevPage}
                size="sm"
                variant="secondary"
                disabled={currentPage <= 1}
              >
                ←
              </Button>
              <span className="text-sm text-slate-600 min-w-16 text-center font-medium">
                {currentPage} / {numPages}
              </span>
              <Button
                onClick={goToNextPage}
                size="sm"
                variant="secondary"
                disabled={currentPage >= numPages}
              >
                →
              </Button>
            </div>
          )}

          {/* Zoom Controls */}
          <div className="flex items-center gap-2 border-l border-gray-300 pl-4">
            <Button
              onClick={zoomOut}
              size="sm"
              variant="secondary"
              disabled={scale <= 0.5}
            >
              🔍−
            </Button>
            <span className="text-sm text-slate-600 min-w-12 text-center font-medium">
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
        </div>
      </div>

      {/* 🎯 CONTINUOUS SCROLL PDF VIEWER - ClauseIQ Professional Background */}
      <div
        className="flex-1 bg-slate-100 relative"
        style={{ height: "calc(100vh - 200px)" }}
      >
        {isLoading && (
          <div className="absolute inset-0 bg-slate-100 flex items-center justify-center z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <div className="text-sm text-slate-600 font-medium">
                Loading PDF...
              </div>
            </div>
          </div>
        )}
        <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
          <div style={{ height: "100%" }} className="pdf-viewer-container">
            <Viewer
              key={`pdf-viewer-${viewMode}-${currentPage}`} // Force re-render on view mode or page change
              fileUrl={pdfUrl}
              onDocumentLoad={handleDocumentLoad}
              plugins={[zoomPluginInstance, pageNavigationPluginInstance]}
              scrollMode={
                viewMode === "single" ? ScrollMode.Page : ScrollMode.Vertical
              }
              initialPage={currentPage - 1}
              defaultScale={scale}
            />
          </div>
        </Worker>
      </div>

      {/* Status Bar - ClauseIQ Professional Styling */}
      <div className="px-4 py-2 bg-slate-50 border-t border-gray-200 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-emerald-600">
            ✅ <span className="font-medium">Ready</span>
          </span>
          <span className="text-slate-400">•</span>
          <span>
            Mode:{" "}
            <span className="font-medium">
              {viewMode === "single" ? "Single Page" : "Continuous"}
            </span>
          </span>
          {viewMode === "single" && numPages && (
            <>
              <span className="text-slate-400">•</span>
              <span>
                Page:{" "}
                <span className="font-medium">
                  {currentPage} of {numPages}
                </span>
              </span>
            </>
          )}
          <span className="text-slate-400">•</span>
          <span>
            Scale:{" "}
            <span className="font-medium">{Math.round(scale * 100)}%</span>
          </span>
          <span className="text-slate-400">•</span>
          <span>ClauseIQ Legal AI</span>
        </div>
      </div>
    </Card>
  );
}
