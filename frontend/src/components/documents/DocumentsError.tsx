/**
 * Error state component for documents page
 * Extracted from main documents page - handles error display and retry
 */

import Button from "@/components/Button";
import Card from "@/components/Card";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface DocumentsErrorProps {
  error: string;
  onRetry: () => void;
}

export const DocumentsError = ({ error, onRetry }: DocumentsErrorProps) => {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="p-8 max-w-md mx-auto text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-status-error/10 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-status-error" />
          </div>
          <h3 className="text-lg font-medium text-text-primary mb-2">
            Error Loading Documents
          </h3>
          <p className="text-text-secondary text-sm mb-6">{error}</p>
          <Button onClick={onRetry} className="w-full">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </Card>
      </div>
    </div>
  );
};
