"use client";
import React from "react";
import Card from "@/components/Card";
import DocumentChat from "@/components/DocumentChat";

interface ChatContentProps {
  documentId: string;
}

export default function ChatContent({ documentId }: ChatContentProps) {
  return (
    <div className="h-full overflow-hidden">
      <div className="h-full p-3">
        <Card className="h-full flex flex-col">
          <h2 className="font-heading text-heading-sm text-text-primary mb-4">
            Ask Questions About Your Contract
          </h2>
          <div className="flex-1 min-h-0">
            <DocumentChat documentId={documentId} />
          </div>
        </Card>
      </div>
    </div>
  );
}
