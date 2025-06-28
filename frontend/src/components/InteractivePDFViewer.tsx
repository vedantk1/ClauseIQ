/**
 * 🔥 ULTIMATE INTERACTIVE PDF VIEWER 🔥
 *
 * Built on @react-pdf-viewer - Modern, Turbopack-compatible, AI-ready beast!
 * Integrates seamlessly with our rock-solid foundation architecture.
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import { Worker, Viewer, SpecialZoomLevel } from "@react-pdf-viewer/core";
import {
  highlightPlugin,
  type RenderHighlightContentProps,
} from "@react-pdf-viewer/highlight";
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/highlight/lib/styles/index.css";

import { usePDFResource } from "../hooks/usePDFResource";
import Button from "./Button";
import Card from "./Card";

// 🎨 Create dynamic CSS styles for PDF.js scaling
const createPdfViewerStyles = (scaleFactor: number) => `
  :root {
    --scale-factor: ${scaleFactor};
  }
  .rpv-core__viewer {
    --scale-factor: ${scaleFactor};
    height: 100% !important;
    min-height: 500px;
  }
  .rpv-core__text-layer {
    --scale-factor: ${scaleFactor};
  }
  .rpv-core__annotation-layer {
    --scale-factor: ${scaleFactor};
  }
  .rpv-core__canvas-layer {
    --scale-factor: ${scaleFactor};
  }
  .rpv-core__page {
    --scale-factor: ${scaleFactor};
    margin-bottom: 16px !important;
  }
  .rpv-core__inner-pages {
    --scale-factor: ${scaleFactor};
    min-height: 100%;
    padding: 16px;
  }
  .rpv-core__doc {
    --scale-factor: ${scaleFactor};
    height: 100% !important;
  }
  .rpv-core__inner-page {
    --scale-factor: ${scaleFactor};
  }
  .rpv-core__page-layer {
    --scale-factor: ${scaleFactor};
  }
  /* Additional selectors to ensure coverage */
  .rpv-core__text-layer-render {
    --scale-factor: ${scaleFactor};
  }
  .rpv-core__annotation-layer-render {
    --scale-factor: ${scaleFactor};
  }
`;

// 🎨 Function to update PDF viewer styles
const updatePdfViewerStyles = (scaleFactor: number) => {
  if (typeof document === "undefined") return;

  let styleElement = document.getElementById(
    "pdf-viewer-styles"
  ) as HTMLStyleElement;
  if (!styleElement) {
    styleElement = document.createElement("style");
    styleElement.id = "pdf-viewer-styles";
    document.head.appendChild(styleElement);
  }

  styleElement.textContent = createPdfViewerStyles(scaleFactor);
};

// 🎯 CRITICAL: Global CSS variable will be set in useEffect to avoid SSR hydration mismatch

// 🎨 Separate component for highlight content to avoid hook issues
const HighlightContentForm: React.FC<{
  props: RenderHighlightContentProps;
  onAddHighlight: (content: string, comment: string, position: unknown) => void;
}> = ({ props, onAddHighlight }) => {
  const [comment, setComment] = useState("");
  const { cancel } = props;

  const handleSubmit = () => {
    if (comment.trim()) {
      // Extract the selection data and add highlight
      const selection =
        (props as RenderHighlightContentProps & { selectedText?: string })
          .selectedText || "";
      onAddHighlight(
        selection,
        comment.trim(),
        (props as RenderHighlightContentProps & { selectionRegion?: unknown })
          .selectionRegion
      );
      setComment("");
      // Call toggle if it exists
      const toggleableProps = props as RenderHighlightContentProps & {
        toggle?: () => void;
      };
      if (toggleableProps.toggle) {
        toggleableProps.toggle();
      }
    }
  };

  return (
    <div
      style={{
        background: "white",
        border: "1px solid #ccc",
        borderRadius: "8px",
        padding: "16px",
        minWidth: "300px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      }}
    >
      <div
        style={{ marginBottom: "12px", fontSize: "14px", fontWeight: "600" }}
      >
        💭 Add your insight:
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="What's interesting about this text? (Future AI will analyze this!)"
        style={{
          width: "100%",
          height: "80px",
          padding: "8px",
          border: "1px solid #ddd",
          borderRadius: "4px",
          fontSize: "14px",
          resize: "vertical",
        }}
        autoFocus
      />
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginTop: "12px",
          justifyContent: "flex-end",
        }}
      >
        <Button onClick={cancel} variant="secondary" size="sm">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="primary"
          size="sm"
          disabled={!comment.trim()}
        >
          🎯 Highlight
        </Button>
      </div>
    </div>
  );
};

interface InteractivePDFViewerProps {
  documentId: string;
  fileName?: string;
  onClose?: () => void;
  className?: string;
}

interface Highlight {
  id: string;
  content: string;
  comment: string;
  position: unknown;
  createdAt: number;
}

const InteractivePDFViewer: React.FC<InteractivePDFViewerProps> = ({
  documentId,
  fileName = "Document",
  onClose,
  className = "",
}) => {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [currentScale, setCurrentScale] = useState(1);
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  // 🎯 CRITICAL: Initialize global CSS variable on client side only to prevent SSR hydration mismatch
  useEffect(() => {
    // Set initial global CSS variable immediately on component mount (client-side only)
    document.documentElement.style.setProperty("--scale-factor", "1");
    updatePdfViewerStyles(1);
    console.log(
      "🎯 CRITICAL: Set initial --scale-factor=1 globally on client mount"
    );
  }, []); // Empty dependency array = runs once on mount

  // 🎯 CRITICAL: Set CSS variable immediately when container is created
  const setPdfContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) {
        pdfContainerRef.current = node;
        // Set CSS variable immediately on container and document root
        node.style.setProperty("--scale-factor", currentScale.toString());
        document.documentElement.style.setProperty(
          "--scale-factor",
          currentScale.toString()
        );
        console.log(
          "🎯 CRITICAL: Set --scale-factor immediately on container creation:",
          currentScale
        );
      }
    },
    [currentScale]
  );

  // 🎯 Set CSS variable directly on DOM elements for PDF.js
  const setScaleFactorOnDOMElements = useCallback((scaleFactor: number) => {
    if (!pdfContainerRef.current) return;

    // Set on the main container
    pdfContainerRef.current.style.setProperty(
      "--scale-factor",
      scaleFactor.toString()
    );

    // Find and set on PDF.js internal containers
    const pdfViewerElements = pdfContainerRef.current.querySelectorAll(
      ".rpv-core__viewer, .rpv-core__doc, .rpv-core__inner-pages, .rpv-core__page, .rpv-core__text-layer, .rpv-core__annotation-layer, .rpv-core__canvas-layer"
    );

    pdfViewerElements.forEach((element) => {
      (element as HTMLElement).style.setProperty(
        "--scale-factor",
        scaleFactor.toString()
      );
    });

    console.log(
      "🎯 Set --scale-factor",
      scaleFactor,
      "on",
      pdfViewerElements.length + 1,
      "DOM elements"
    );
  }, []);

  // 🎨 CRITICAL: Update CSS styles whenever scale changes - GLOBAL FIRST
  useEffect(() => {
    // MOST IMPORTANT: Set globally on document root FIRST
    document.documentElement.style.setProperty(
      "--scale-factor",
      currentScale.toString()
    );

    // Update dynamic styles
    updatePdfViewerStyles(currentScale);

    // Set on DOM elements
    setScaleFactorOnDOMElements(currentScale);

    console.log(
      "🎯 CRITICAL: Scale factor updated globally and locally:",
      currentScale
    );
  }, [currentScale, setScaleFactorOnDOMElements]);

  // 🎯 Set up MutationObserver to catch dynamically added PDF.js elements
  useEffect(() => {
    if (!pdfContainerRef.current) return;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;
            // Check if this is a PDF.js element that needs the CSS variable
            if (
              element.classList.contains("rpv-core__viewer") ||
              element.classList.contains("rpv-core__doc") ||
              element.classList.contains("rpv-core__inner-pages") ||
              element.classList.contains("rpv-core__page") ||
              element.classList.contains("rpv-core__text-layer") ||
              element.classList.contains("rpv-core__annotation-layer") ||
              element.classList.contains("rpv-core__canvas-layer")
            ) {
              element.style.setProperty(
                "--scale-factor",
                currentScale.toString()
              );
              console.log(
                "🔄 CRITICAL: Set --scale-factor on newly added PDF.js element:",
                element.className
              );
            }

            // Also check children
            const pdfElements = element.querySelectorAll(
              ".rpv-core__viewer, .rpv-core__doc, .rpv-core__inner-pages, .rpv-core__page, .rpv-core__text-layer, .rpv-core__annotation-layer, .rpv-core__canvas-layer"
            );
            pdfElements.forEach((pdfElement) => {
              (pdfElement as HTMLElement).style.setProperty(
                "--scale-factor",
                currentScale.toString()
              );
            });
          }
        });
      });
    });

    observer.observe(pdfContainerRef.current, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
    };
  }, [currentScale]);

  // 🎯 Use our rock-solid PDF resource hook
  const { pdfUrl, isLoading, error, retry } = usePDFResource({
    documentId,
    enabled: true,
  });

  // 🎯 CRITICAL: Set up CSS variable on initial PDF load - BEFORE PDF.js renders
  useEffect(() => {
    if (pdfUrl) {
      // CRITICAL: Set global scale factor BEFORE PDF.js renders
      document.documentElement.style.setProperty(
        "--scale-factor",
        currentScale.toString()
      );

      if (pdfContainerRef.current) {
        pdfContainerRef.current.style.setProperty(
          "--scale-factor",
          currentScale.toString()
        );

        // Set initial scale factor and wait for PDF.js to render
        const checkAndSetScaleFactor = () => {
          setScaleFactorOnDOMElements(currentScale);

          // Re-check after a short delay in case PDF.js elements are still being created
          setTimeout(() => {
            setScaleFactorOnDOMElements(currentScale);
          }, 100);
        };

        // Initial setup
        checkAndSetScaleFactor();

        // Also set up a periodic check for the first few seconds after PDF loads
        const intervalId = setInterval(() => {
          setScaleFactorOnDOMElements(currentScale);
        }, 500);

        setTimeout(() => {
          clearInterval(intervalId);
        }, 3000);

        return () => {
          clearInterval(intervalId);
        };
      }
    }
  }, [pdfUrl, setScaleFactorOnDOMElements, currentScale]);

  // 🎨 Highlight management - AI-ready architecture
  const addHighlight = useCallback(
    (content: string, comment: string, position: unknown) => {
      const newHighlight: Highlight = {
        id: `highlight-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`,
        content,
        comment,
        position,
        createdAt: Date.now(),
      };

      setHighlights((prev) => [...prev, newHighlight]);

      console.log("🎯 NEW HIGHLIGHT CREATED:", {
        id: newHighlight.id,
        content: content.substring(0, 50) + "...",
        comment,
        coordinates: position,
      });
    },
    []
  );

  // 🎨 Highlight plugin setup
  const highlightPluginInstance = highlightPlugin({
    renderHighlightTarget: () => (
      <div
        style={{
          background: "#FFD700",
          opacity: 0.4,
          mixBlendMode: "multiply",
        }}
      />
    ),
    renderHighlightContent: (props: RenderHighlightContentProps) => (
      <HighlightContentForm props={props} onAddHighlight={addHighlight} />
    ),
  });

  // 🚀 Loading state
  if (isLoading) {
    return (
      <Card className={`h-96 flex items-center justify-center ${className}`}>
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-blue mx-auto"></div>
          <p className="text-text-secondary">📄 Loading your document...</p>
        </div>
      </Card>
    );
  }

  // 🚨 Error state
  if (error) {
    return (
      <Card className={`h-96 flex items-center justify-center ${className}`}>
        <div className="text-center space-y-4">
          <div className="text-4xl">❌</div>
          <p className="text-text-secondary">
            Failed to load document: {error}
          </p>
          <Button onClick={retry} variant="primary">
            🔄 Retry
          </Button>
        </div>
      </Card>
    );
  }

  // 🚨 Invalid PDF URL state - CRITICAL guard to prevent isSameUrl error
  if (!pdfUrl || typeof pdfUrl !== "string" || pdfUrl.trim() === "") {
    return (
      <Card className={`h-96 flex items-center justify-center ${className}`}>
        <div className="text-center space-y-4">
          <div className="text-4xl">⚠️</div>
          <p className="text-text-secondary">
            Invalid PDF URL - cannot load document
          </p>
          <p className="text-xs text-text-muted">
            URL received: {pdfUrl ? `"${pdfUrl}"` : "null/undefined"}
          </p>
          <Button onClick={retry} variant="primary">
            🔄 Retry Loading
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`h-full flex flex-col ${className}`}>
      {/* 📋 Header */}
      <div className="flex items-center justify-between p-4 border-b border-border-light">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-text-primary">
            🔥 {fileName}
          </span>
          {highlights.length > 0 && (
            <span className="bg-accent-purple text-white text-xs px-2 py-1 rounded-full">
              {highlights.length} highlights
            </span>
          )}
        </div>

        {onClose && (
          <Button
            onClick={onClose}
            variant="secondary"
            size="sm"
            className="ml-2"
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
        )}
      </div>

      {/* 🚀 THE ULTIMATE PDF VIEWER */}
      <div
        ref={setPdfContainerRef}
        className="flex-1 relative"
        style={
          {
            "--scale-factor": currentScale.toString(),
          } as React.CSSProperties
        }
      >
        <Worker workerUrl="/pdf.worker.min.js">
          <div
            style={
              {
                height: "100%",
                width: "100%",
                "--scale-factor": currentScale.toString(),
              } as React.CSSProperties
            }
            data-scale-factor={currentScale}
          >
            <Viewer
              fileUrl={pdfUrl!}
              plugins={[highlightPluginInstance]}
              defaultScale={SpecialZoomLevel.PageFit}
              theme="auto"
              onZoom={(e) => {
                console.log(
                  "🔍 PDF Scale changing from",
                  currentScale,
                  "to",
                  e.scale
                );

                // CRITICAL: Set global CSS variable IMMEDIATELY
                document.documentElement.style.setProperty(
                  "--scale-factor",
                  e.scale.toString()
                );

                setCurrentScale(e.scale);

                // Also update styles and DOM elements immediately for faster response
                updatePdfViewerStyles(e.scale);

                // Use setTimeout to ensure DOM updates after React renders
                setTimeout(() => {
                  setScaleFactorOnDOMElements(e.scale);
                }, 0);

                console.log("✅ PDF Scale updated:", e.scale);
              }}
            />
          </div>
        </Worker>
      </div>

      {/* 📊 Highlights sidebar (future enhancement) */}
      {highlights.length > 0 && (
        <div className="border-t border-border-light p-4 bg-bg-secondary">
          <p className="text-sm text-text-secondary mb-2">
            💎 {highlights.length} insights ready for AI analysis
          </p>
          <div className="flex gap-2 overflow-x-auto">
            {highlights.slice(0, 3).map((highlight, idx) => (
              <div
                key={highlight.id}
                className="bg-accent-purple/10 text-accent-purple text-xs px-2 py-1 rounded whitespace-nowrap"
              >
                #{idx + 1}: {highlight.comment.substring(0, 20)}...
              </div>
            ))}
            {highlights.length > 3 && (
              <div className="text-xs text-text-muted px-2 py-1">
                +{highlights.length - 3} more
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
};

export default InteractivePDFViewer;
