"use client";
import React, { useState, useMemo } from "react";
import { Worker, Viewer, ScrollMode } from "@react-pdf-viewer/core";
import "@react-pdf-viewer/core/lib/styles/index.css";

import Card from "./Card";
import Button from "./Button";
import config from "@/config/config";

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

  // PDF URL with authentication
  const pdfUrl = useMemo(() => {
    const token = localStorage.getItem("access_token");
    
    // 🔥 EMERGENCY TEST: Use the document ID that we KNOW works
    const workingDocId = "06162a2d-f8d8-4b53-85eb-7657f9e18cdd";
    const currentDocId = documentId;
    const testDocId = workingDocId; // Force use working doc
    
    console.log("🔥 EMERGENCY TEST:");
    console.log("  Current doc ID:", currentDocId);
    console.log("  Working doc ID:", workingDocId);
    console.log("  Using doc ID:", testDocId);
    
    const baseUrl = `${config.apiUrl}/api/v1/documents/${testDocId}/pdf`;
    const finalUrl = token ? `${baseUrl}?token=${encodeURIComponent(token)}` : baseUrl;
    console.log("🔍 PDF URL:", finalUrl);
    return finalUrl;
  }, [documentId]);

  // Handle document load
  const handleDocumentLoad = (e: { doc: { numPages: number } }) => {
    console.log("✅ PDF LOADED:", e.doc.numPages, "pages");
    alert("🎉 PDF LOADED: " + e.doc.numPages + " pages!");
    setNumPages(e.doc.numPages);
    setIsLoading(false);
    setError(null);
  };

  // Handle document load error
  const handleDocumentLoadError = (error: { message?: string }) => {
    console.error("❌ PDF LOAD ERROR:", error);
    alert("💥 PDF FAILED: " + (error.message || "Unknown error"));
    setError(`Failed to load PDF: ${error.message || 'Unknown error'}`);
    setIsLoading(false);
  };

  // Zoom controls
  const zoomIn = () => setScale(prev => Math.min(prev + 0.2, 3.0));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5));
  const resetZoom = () => setScale(1.0);

  // 🔥 EMERGENCY: REMOVE ALL CONDITIONAL RENDERING
  console.log("🔥 Component state - isLoading:", isLoading, "error:", error, "numPages:", numPages);

  return (
    <Card className={`h-full flex flex-col ${className}`}>
      {/* Header with controls */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-800">📄 {fileName}</h3>
          {numPages && (
            <span className="text-sm text-gray-500">({numPages} pages)</span>
          )}
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-2">
          <Button onClick={zoomOut} size="sm" variant="secondary" disabled={scale <= 0.5}>
            🔍−
          </Button>
          <span className="text-sm text-gray-600 min-w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button onClick={zoomIn} size="sm" variant="secondary" disabled={scale >= 3.0}>
            🔍+
          </Button>
          <Button onClick={resetZoom} size="sm" variant="secondary">
            Reset
          </Button>
        </div>
      </div>

      {/* 🎯 CONTINUOUS SCROLL PDF VIEWER */}
      <div className="flex-1 bg-gray-100" style={{ height: 'calc(100vh - 200px)' }}>
        <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
          <div style={{ height: '100%' }}>
            <Viewer
              fileUrl={pdfUrl}
              onDocumentLoad={handleDocumentLoad}
              onDocumentLoadError={handleDocumentLoadError}
            />
          </div>
        </Worker>
      </div>

      {/* Status Bar */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-600">
        ✅ Continuous scroll enabled • Scale: {Math.round(scale * 100)}%
      </div>
    </Card>
  );
}