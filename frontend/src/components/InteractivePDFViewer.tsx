"use client";
import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  PdfHighlighter,
  PdfLoader,
  Highlight,
  Popup,
  AreaHighlight,
  Tip,
} from "react-pdf-highlighter";
import type {
  IHighlight,
  NewHighlight,
  Content,
  ScaledPosition,
} from "react-pdf-highlighter";
import Button from "./Button";
import Card from "./Card";

// Import required CSS files for react-pdf-highlighter
import "react-pdf-highlighter/dist/style/pdf_viewer.css";
import "react-pdf-highlighter/dist/style/PdfHighlighter.css";
import "react-pdf-highlighter/dist/style/Highlight.css";
import "react-pdf-highlighter/dist/style/AreaHighlight.css";
import "react-pdf-highlighter/dist/style/Tip.css";
import "react-pdf-highlighter/dist/style/MouseSelection.css";

interface InteractivePDFViewerProps {
  documentId: string;
  fileName?: string;
  onClose: () => void;
  className?: string;
}

// Generate unique IDs for highlights
const getNextId = () => String(Math.random()).slice(2);

// AI-ready highlight popup component
const HighlightPopup = ({
  comment,
}: {
  comment?: { text: string; emoji?: string };
}) => {
  if (!comment?.text) return null;

  return (
    <div className="highlight-popup bg-white border border-gray-300 rounded-lg p-3 shadow-lg max-w-xs">
      <div className="text-sm space-y-2">
        <div className="flex items-start gap-2">
          {comment.emoji && <span className="text-lg">{comment.emoji}</span>}
          <span className="flex-1">{comment.text}</span>
        </div>

        {/* Future AI analysis section */}
        <div className="border-t pt-2 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span>Ready for AI analysis</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function InteractivePDFViewer({
  documentId,
  fileName,
  onClose,
  className = "",
}: InteractivePDFViewerProps) {
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [highlights, setHighlights] = useState<IHighlight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ref for scroll functionality
  const scrollViewerTo = useRef<(highlight: IHighlight) => void>(() => {});

  // Fetch PDF blob with authentication
  const fetchPdfBlob = useCallback(async () => {
    if (!documentId) {
      setError("No document ID provided");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const accessToken = localStorage.getItem("access_token");
      if (!accessToken) {
        throw new Error("Authentication required");
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(
        `${apiUrl}/api/v1/documents/${documentId}/pdf`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("PDF file not found for this document");
        }
        throw new Error(`Failed to fetch PDF: ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setIsLoading(false);
    } catch (err) {
      console.error("Error fetching PDF:", err);
      setError(err instanceof Error ? err.message : "Failed to load PDF");
      setIsLoading(false);
    }
  }, [documentId]);

  // Load PDF on component mount
  useEffect(() => {
    if (documentId) {
      fetchPdfBlob();
    }
  }, [documentId, fetchPdfBlob]);

  // Cleanup URL on unmount
  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  // Add new highlight with AI future-proofing
  const addHighlight = useCallback((highlight: NewHighlight) => {
    console.log("🎯 Adding highlight for AI analysis:", highlight);

    // Future AI hook point: This is where we'll trigger AI analysis
    // analyzeClauseWithAI(highlight.content, highlight.position);

    setHighlights((prev) => [{ ...highlight, id: getNextId() }, ...prev]);
  }, []);

  // Update existing highlight - future AI editing foundation
  const updateHighlight = useCallback(
    (
      highlightId: string,
      position: Partial<ScaledPosition>,
      content: Partial<Content>
    ) => {
      console.log(
        "🔄 Updating highlight for AI features:",
        highlightId,
        position,
        content
      );

      // Future AI hook point: This is where we'll update AI analysis
      // updateAIAnalysis(highlightId, content, position);

      setHighlights((prev) =>
        prev.map((h) => {
          if (h.id === highlightId) {
            return {
              ...h,
              position: { ...h.position, ...position },
              content: { ...h.content, ...content },
            };
          }
          return h;
        })
      );
    },
    []
  );

  // Handle click events on highlights - CRITICAL for AI interactions
  const handleHighlightClick = useCallback((highlight: IHighlight) => {
    console.log(
      "🎯 Highlight clicked - future AI analysis trigger:",
      highlight
    );

    // Future AI hook point: This is where we'll show AI analysis popup
    // showAIAnalysisPopup(highlight);

    scrollViewerTo.current(highlight);
  }, []);

  // Clear all highlights
  const clearHighlights = useCallback(() => {
    setHighlights([]);
  }, []);

  if (error) {
    return (
      <Card className={`h-full flex flex-col ${className}`}>
        <div className="flex items-center justify-between p-4 border-b border-border-light">
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-text-secondary"
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
            <span className="text-sm font-medium text-text-primary truncate">
              {fileName || "Document"}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="p-1"
            aria-label="Close document viewer"
          >
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </Button>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md mx-auto p-6">
            <svg
              className="w-16 h-16 text-red-400 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              Unable to load PDF
            </h3>
            <p className="text-text-secondary mb-4">{error}</p>
            <Button onClick={fetchPdfBlob} variant="secondary" size="sm">
              Try Again
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`h-full flex flex-col ${className}`}>
      {/* Header with controls */}
      <div className="flex items-center justify-between p-4 border-b border-border-light bg-bg-secondary">
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-text-secondary"
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
          <span className="text-sm font-medium text-text-primary truncate">
            {fileName || "Document"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Highlighting controls */}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearHighlights}
            className="p-1 text-xs"
            title="Clear all highlights"
            disabled={highlights.length === 0}
          >
            Clear
          </Button>

          <span className="text-xs text-text-secondary px-1">
            {highlights.length} highlights
          </span>

          <div className="w-px h-4 bg-border-light mx-2" />

          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="p-1"
            aria-label="Close document viewer"
          >
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </Button>
        </div>
      </div>

      {/* PDF Content */}
      <div className="flex-1 relative overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-purple mx-auto mb-2"></div>
              <p className="text-sm text-text-secondary">Loading document...</p>
            </div>
          </div>
        ) : pdfUrl ? (
          <PdfLoader
            url={pdfUrl}
            beforeLoad={
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent-purple"></div>
              </div>
            }
          >
            {(pdfDocument) => (
              <PdfHighlighter
                pdfDocument={pdfDocument}
                enableAreaSelection={(event) => event.altKey}
                onScrollChange={() => {}}
                scrollRef={(scrollTo) => {
                  scrollViewerTo.current = scrollTo;
                }}
                onSelectionFinished={(
                  position,
                  content,
                  hideTipAndSelection,
                  transformSelection
                ) => {
                  console.log("🎯 Text selected for AI analysis:", {
                    position,
                    content,
                  });

                  return (
                    <Tip
                      onOpen={transformSelection}
                      onConfirm={(comment) => {
                        console.log(
                          "✨ Adding highlight for future AI features:",
                          comment
                        );
                        addHighlight({
                          content,
                          position,
                          comment: comment || {
                            text: "AI Analysis Ready",
                            emoji: "🤖",
                          },
                        });
                        hideTipAndSelection();
                      }}
                    />
                  );
                }}
                highlightTransform={(
                  highlight,
                  index,
                  setTip,
                  hideTip,
                  viewportToScaled,
                  screenshot,
                  isScrolledTo
                ) => {
                  const isTextHighlight = !highlight.content?.image;

                  const component = isTextHighlight ? (
                    <Highlight
                      isScrolledTo={isScrolledTo}
                      position={highlight.position}
                      comment={highlight.comment}
                    />
                  ) : (
                    <AreaHighlight
                      isScrolledTo={isScrolledTo}
                      highlight={highlight}
                      onChange={(boundingRect) => {
                        updateHighlight(
                          highlight.id,
                          { boundingRect: viewportToScaled(boundingRect) },
                          { image: screenshot(boundingRect) }
                        );
                      }}
                    />
                  );

                  return (
                    <Popup
                      popupContent={
                        <HighlightPopup comment={highlight.comment} />
                      }
                      onMouseOver={(popupContent) =>
                        setTip(highlight, () => popupContent)
                      }
                      onMouseOut={hideTip}
                      key={index}
                    >
                      <div
                        onClick={() => handleHighlightClick(highlight)}
                        className="cursor-pointer"
                        title="Click for AI analysis"
                      >
                        {component}
                      </div>
                    </Popup>
                  );
                }}
                highlights={highlights}
              />
            )}
          </PdfLoader>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <svg
                className="w-12 h-12 text-text-secondary mx-auto mb-3"
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
              <p className="text-text-secondary">No document selected</p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
