/**
 * Empty state component for documents page
 * Extracted from main documents page - displays when no documents exist
 */

import Button from "@/components/Button";
import Card from "@/components/Card";
import { FileText, Upload } from "lucide-react";

interface DocumentsEmptyProps {
  onUpload: () => void;
}

export const DocumentsEmpty = ({ onUpload }: DocumentsEmptyProps) => {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="p-8 max-w-lg mx-auto text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-accent-purple/10 flex items-center justify-center">
            <FileText className="w-10 h-10 text-accent-purple" />
          </div>
          <h3 className="text-xl font-medium text-text-primary mb-3">
            Ready to analyze your legal documents?
          </h3>
          <p className="text-text-secondary text-sm mb-6 leading-relaxed">
            Upload your first legal document to get started with AI-powered
            contract analysis. ClauseIQ will automatically identify contract
            types, extract key clauses, and provide detailed insights to help
            you understand your agreements better.
          </p>
          <div className="space-y-3">
            <Button onClick={onUpload} className="w-full">
              <Upload className="w-4 h-4 mr-2" />
              Upload Your First Document
            </Button>
            <p className="text-xs text-text-tertiary">
              Supported formats: PDF, DOC, DOCX • Maximum file size: 10MB
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};
