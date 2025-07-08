"use client";
import React from "react";
import DocumentChat from "@/components/DocumentChat";

interface ChatContentProps {
  documentId: string;
}

export default function ChatContent({ documentId }: ChatContentProps) {
  return (
    <div className="h-full flex flex-col">
      {/* Header - fixed */}
      <div className="p-4 border-b border-border-muted flex-shrink-0">
        <h2 className="font-heading text-heading-sm text-text-primary">
          Ask Questions About Your Contract
        </h2>
      </div>
      
      {/* Chat area - flexible with scrolling */}
      <div className="flex-1 min-h-0 p-4">
        <DocumentChat documentId={documentId} />
      </div>
    </div>
  );
}
