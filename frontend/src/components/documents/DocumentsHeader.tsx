/**
 * Header component for documents page
 * Extracted from main documents page - handles title and action buttons
 */

import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import { Upload, RefreshCw, Trash2 } from "lucide-react";

interface DocumentsHeaderProps {
  documentsCount: number;
  isSelectMode: boolean;
  deletingAll: boolean;
  onToggleSelectMode: () => void;
  onDeleteAll: () => void;
}

export const DocumentsHeader = ({
  documentsCount,
  isSelectMode,
  deletingAll,
  onToggleSelectMode,
  onDeleteAll,
}: DocumentsHeaderProps) => {
  const router = useRouter();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary font-space-grotesk">
          Documents
        </h1>
        <p className="text-text-secondary mt-1">
          View and manage your analyzed legal documents
        </p>
      </div>
      <div className="flex gap-2">
        {documentsCount > 0 && (
          <>
            <Button
              variant="secondary"
              onClick={onToggleSelectMode}
              className="text-text-secondary hover:text-accent-purple hover:border-accent-purple/20 hover:bg-accent-purple/5 transition-all"
            >
              {isSelectMode ? "Cancel Select" : "Select"}
            </Button>
            <Button
              variant="secondary"
              onClick={onDeleteAll}
              disabled={deletingAll}
              className="text-text-secondary hover:text-status-error hover:border-status-error/20 hover:bg-status-error/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deletingAll ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete All
                </>
              )}
            </Button>
          </>
        )}
        <Button onClick={() => router.push("/")}>
          <Upload className="w-4 h-4 mr-2" />
          Upload New
        </Button>
      </div>
    </div>
  );
};
