/**
 * Bulk selection toolbar component for documents page
 * Extracted from main documents page - handles bulk selection controls
 */

import Button from "@/components/Button";
import Card from "@/components/Card";
import { Trash2 } from "lucide-react";

interface BulkSelectionToolbarProps {
  isSelectMode: boolean;
  selectedDocuments: Set<string>;
  filteredDocumentsLength: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBulkDelete: () => void;
}

export const BulkSelectionToolbar = ({
  isSelectMode,
  selectedDocuments,
  filteredDocumentsLength,
  onSelectAll,
  onClearSelection,
  onBulkDelete,
}: BulkSelectionToolbarProps) => {
  if (!isSelectMode) return null;

  return (
    <div className="mb-6">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={
                  selectedDocuments.size === filteredDocumentsLength &&
                  filteredDocumentsLength > 0
                }
                onChange={(e) => {
                  if (e.target.checked) {
                    onSelectAll();
                  } else {
                    onClearSelection();
                  }
                }}
                className="w-4 h-4 text-accent-purple focus:ring-accent-purple border-border-muted rounded"
              />
              <span className="text-sm text-text-secondary">
                {selectedDocuments.size > 0
                  ? `${selectedDocuments.size} of ${filteredDocumentsLength} selected`
                  : "Select all"}
              </span>
            </div>
            {selectedDocuments.size > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={onClearSelection}
                  size="sm"
                >
                  Clear Selection
                </Button>
                <Button variant="danger" onClick={onBulkDelete} size="sm">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Selected ({selectedDocuments.size})
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};
