/**
 * Individual document card component
 * Extracted from main documents page - handles single document display and interactions
 */

import Button from "@/components/Button";
import Card from "@/components/Card";
import {
  FileText,
  Clock,
  CheckCircle,
  RefreshCw,
  Trash2,
  Calendar,
} from "lucide-react";
import type { DocumentItem } from "@/types/documents";
import {
  formatDate,
  formatContractType,
  getContractTypeColor,
  highlightSearchText,
} from "@/utils/documentUtils";

interface DocumentCardProps {
  document: DocumentItem;
  searchQuery: string;
  isSelectMode: boolean;
  isSelected: boolean;
  isLoading: boolean;
  isDeleting: boolean;
  viewMode: "grid" | "list";
  onDocumentClick: () => void;
  onToggleSelection: () => void;
  onDelete: () => void;
  onView: () => void;
}

export const DocumentCard = ({
  document: doc,
  searchQuery,
  isSelectMode,
  isSelected,
  isLoading,
  isDeleting,
  viewMode,
  onDocumentClick,
  onToggleSelection,
  onDelete,
  onView,
}: DocumentCardProps) => {
  if (viewMode === "grid") {
    return (
      <div
        onClick={() => !isSelectMode && onDocumentClick()}
        className={`${!isSelectMode ? "cursor-pointer" : ""}`}
      >
        <Card className="p-6 hover:bg-surface-secondary/50 transition-all duration-200 group border border-white/6 hover:border-white/12 hover:shadow-lg">
          <div className="space-y-5">
            {/* Document Header */}
            <div className="flex items-start gap-3">
              {isSelectMode && (
                <div className="flex items-center pt-1">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      e.stopPropagation();
                      onToggleSelection();
                    }}
                    className="w-4 h-4 text-accent-purple focus:ring-accent-purple border-border-muted rounded"
                  />
                </div>
              )}
              <div className="w-10 h-10 rounded-lg bg-accent-purple/10 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-accent-purple" />
              </div>
              <div className="flex-1 min-w-0">
                <h3
                  className="font-medium text-text-primary truncate group-hover:text-accent-purple transition-colors"
                  title={doc.filename}
                >
                  {highlightSearchText(doc.filename, searchQuery)}
                </h3>
                <div className="flex items-center gap-2 mt-1 text-xs text-text-tertiary">
                  <Clock className="w-3 h-3" />
                  <span>{formatDate(doc.upload_date)}</span>
                </div>
              </div>
              {!isSelectMode && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  disabled={isDeleting}
                  className="p-2 rounded-lg hover:bg-status-error/10 text-text-tertiary hover:text-status-error transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Delete document"
                  aria-label={`Delete ${doc.filename}`}
                >
                  {isDeleting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>

            {/* Document Stats */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">Type</span>
                <span
                  className={`px-2 py-1 text-xs rounded-full border ${getContractTypeColor(
                    doc.contract_type
                  )}`}
                  title={`Contract type: ${formatContractType(
                    doc.contract_type
                  )}`}
                >
                  {highlightSearchText(
                    formatContractType(doc.contract_type),
                    searchQuery
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">Status</span>
                <div className="flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-status-success" />
                  <span className="text-status-success font-medium">
                    Complete
                  </span>
                </div>
              </div>
            </div>

            {/* Action Button */}
            {!isSelectMode && (
              <Button
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  onView();
                }}
                disabled={isLoading}
                className="w-full group-hover:bg-accent-purple group-hover:text-white group-hover:border-accent-purple transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "View Analysis →"
                )}
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // List view
  return (
    <div
      onClick={() => !isSelectMode && onDocumentClick()}
      className={`${!isSelectMode ? "cursor-pointer" : ""}`}
    >
      <Card className="p-4 hover:bg-surface-secondary/50 transition-all duration-200 group border border-white/6 hover:border-white/12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {isSelectMode && (
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => {
                    e.stopPropagation();
                    onToggleSelection();
                  }}
                  className="w-4 h-4 text-accent-purple focus:ring-accent-purple border-border-muted rounded"
                />
              </div>
            )}
            <div className="w-10 h-10 rounded-lg bg-accent-purple/10 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-accent-purple" />
            </div>
            <div className="flex-1 min-w-0">
              <h3
                className="font-medium text-text-primary truncate group-hover:text-accent-purple transition-colors"
                title={doc.filename}
              >
                {highlightSearchText(doc.filename, searchQuery)}
              </h3>
              <div className="flex items-center gap-4 mt-1 text-sm text-text-secondary">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>{formatDate(doc.upload_date)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-status-success" />
                  <span className="text-status-success">Complete</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-4">
            {!isSelectMode && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  disabled={isDeleting}
                  className="p-2 rounded-lg hover:bg-status-error/10 text-text-tertiary hover:text-status-error transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Delete document"
                  aria-label={`Delete ${doc.filename}`}
                >
                  {isDeleting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
                <Button
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onView();
                  }}
                  disabled={isLoading}
                  className="group-hover:bg-accent-purple group-hover:text-white group-hover:border-accent-purple transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "View Analysis →"
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};
