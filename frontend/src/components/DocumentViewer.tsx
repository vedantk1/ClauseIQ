"use client";
import React, { useState } from "react";
import Card from "./Card";
import Button from "./Button";

interface DocumentViewerProps {
  documentId: string;
  fileName?: string;
  onClose: () => void;
  className?: string;
}

export default function DocumentViewer({
  documentId,
  fileName,
  onClose,
  className = "",
}: DocumentViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string>("");

  // Generate authenticated PDF URL
  React.useEffect(() => {
    if (!documentId) return;

    const generatePdfUrl = () => {
      const accessToken = localStorage.getItem("access_token");
      const baseUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

      if (accessToken) {
        // For iframe, we'll use a URL that includes auth as a parameter
        // This is a temporary solution - ideally we'd set up a proxy or use blob URLs
        setPdfUrl(
          `${baseUrl}/api/v1/documents/${documentId}/pdf?token=${accessToken}`
        );
      } else {
        setError("Authentication required to view document");
      }
    };

    generatePdfUrl();
  }, [documentId]);

  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setError("Failed to load document");
  };

  return (
    <Card className={`h-full flex flex-col ${className}`}>
      {/* Header */}
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

      {/* PDF Viewer Content */}
      <div className="flex-1 relative bg-gray-50">
        {error ? (
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
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-text-secondary">{error}</p>
            </div>
          </div>
        ) : (
          <>
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-purple mx-auto mb-2"></div>
                  <p className="text-sm text-text-secondary">
                    Loading document...
                  </p>
                </div>
              </div>
            )}

            {/* Embedded PDF */}
            <iframe
              src={pdfUrl}
              className="w-full h-full border-0"
              title={`PDF Viewer - ${fileName || "Document"}`}
              onLoad={handleLoad}
              onError={handleError}
              style={{ minHeight: "600px" }}
            />
          </>
        )}
      </div>

      {/* Footer with helpful info */}
      <div className="p-3 border-t border-border-light bg-bg-secondary">
        <p className="text-xs text-text-tertiary text-center">
          Use your browser&apos;s PDF controls to zoom, navigate, and search
        </p>
      </div>
    </Card>
  );
}
