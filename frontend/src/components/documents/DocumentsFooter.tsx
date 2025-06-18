/**
 * Documents footer with stats
 * Extracted from main documents page
 */

interface DocumentsFooterProps {
  filteredCount: number;
  totalCount: number;
}

export const DocumentsFooter = ({
  filteredCount,
  totalCount,
}: DocumentsFooterProps) => {
  return (
    <div className="mt-12 pt-8 border-t border-border-muted">
      <div className="flex items-center justify-center text-sm text-text-tertiary">
        <span>
          Showing {filteredCount} of {totalCount} document
          {totalCount !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
};
