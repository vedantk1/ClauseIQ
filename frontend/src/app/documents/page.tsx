"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useAnalysis } from "@/context/AnalysisContext.v2";
import { useApiCall } from "@/lib/apiUtils";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import toast from "react-hot-toast";
import Button from "@/components/Button";
import Card from "@/components/Card";
import Skeleton from "@/components/Skeleton";
import {
  FileText,
  Calendar,
  Layers3,
  ArrowRight,
  Upload,
  Grid3X3,
  List,
  Search,
  Clock,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Trash2,
  ChevronDown,
  X,
} from "lucide-react";

interface DocumentItem {
  id: string;
  filename: string;
  upload_date: string;
  sections: Array<{
    heading: string;
    text: string;
    summary?: string;
  }>;
}

type ViewMode = "grid" | "list";
type SortOption = "newest" | "oldest" | "name";

export default function Documents() {
  const { isAuthenticated, isLoading } = useAuthRedirect();
  const router = useRouter();
  const { loadDocument } = useAnalysis();
  const apiCall = useApiCall();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<DocumentItem[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDeleteAllDialogOpen, setIsDeleteAllDialogOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const res = await apiCall(`/documents/`);

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(
            `Error retrieving documents: ${res.status} - ${errorText}`
          );
        }

        const data = (await res.json()) as {
          error?: string;
          documents?: DocumentItem[];
        };

        if (data.error) {
          throw new Error(data.error);
        }

        const docs = data.documents || [];
        setDocuments(docs);
      } catch (err) {
        console.error("Failed to fetch documents:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load documents"
        );
        toast.error("Failed to load documents");
      } finally {
        setLoading(false);
      }
    };

    if (!isLoading) {
      fetchDocuments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isAuthenticated]); // Intentionally omitting apiCall to prevent infinite loop

  // Filter and sort documents
  useEffect(() => {
    const filtered = documents.filter((doc) => {
      return doc.filename.toLowerCase().includes(searchQuery.toLowerCase());
    });

    // Sort documents
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return (
            new Date(b.upload_date).getTime() -
            new Date(a.upload_date).getTime()
          );
        case "oldest":
          return (
            new Date(a.upload_date).getTime() -
            new Date(b.upload_date).getTime()
          );
        case "name":
          return a.filename.localeCompare(b.filename);
        default:
          return 0;
      }
    });

    setFilteredDocuments(filtered);
  }, [documents, searchQuery, sortBy]);

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Invalid date";
    }
  };

  const getRelativeTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - date.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
      return `${Math.ceil(diffDays / 30)} months ago`;
    } catch {
      return "Unknown";
    }
  };

  const handleViewDocument = async (documentId: string) => {
    try {
      // Use the v2 AnalysisContext loadDocument method
      await loadDocument(documentId);
      router.push("/review");
      toast.success("Document loaded successfully!");
    } catch (err) {
      console.error("Failed to fetch document:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to load document"
      );
    }
  };

  const retryFetch = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await apiCall(`/documents/`);

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(
          `Error retrieving documents: ${res.status} - ${errorText}`
        );
      }

      const data = (await res.json()) as {
        error?: string;
        documents?: DocumentItem[];
      };

      if (data.error) {
        throw new Error(data.error);
      }

      const docs = data.documents || [];
      setDocuments(docs);
    } catch (err) {
      console.error("Failed to fetch documents:", err);
      setError(err instanceof Error ? err.message : "Failed to load documents");
      toast.error("Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDocument = async (
    documentId: string,
    documentName: string
  ) => {
    // Using window.confirm is okay for individual document deletion
    // A modal dialog would be better UX but that's beyond the scope of this fix
    if (
      !window.confirm(
        `Are you sure you want to delete "${documentName}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      const res = await apiCall(`/documents/${documentId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(
          `Error deleting document: ${res.status} - ${errorText}`
        );
      }

      // Remove the document from the local state
      setDocuments((prevDocs) =>
        prevDocs.filter((doc) => doc.id !== documentId)
      );
      setFilteredDocuments((prevDocs) =>
        prevDocs.filter((doc) => doc.id !== documentId)
      );

      toast.success("Document deleted successfully!");
    } catch (err) {
      console.error("Failed to delete document:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to delete document"
      );
    }
  };

  const handleDeleteAllDocuments = async () => {
    // Close the dialog
    setIsDeleteAllDialogOpen(false);

    try {
      const res = await apiCall(`/documents`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(
          `Error deleting documents: ${res.status} - ${errorText}`
        );
      }

      const result = (await res.json()) as { message?: string };

      // Clear all documents from the local state
      setDocuments([]);
      setFilteredDocuments([]);

      toast.success(result.message || "All documents deleted successfully!");
    } catch (err) {
      console.error("Failed to delete all documents:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to delete all documents"
      );
    }
  };

  // Auth loading check
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-purple"></div>
      </div>
    );
  }

  // Don't render if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  // Loading State
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="space-y-2">
            <Skeleton variant="rect" className="h-8 w-48" />
            <Skeleton variant="rect" className="h-4 w-64" />
          </div>
          <Skeleton variant="rect" className="h-10 w-32" />
        </div>

        {/* Controls Skeleton */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <Skeleton variant="rect" className="h-10 flex-1 max-w-md" />
          <div className="flex gap-2">
            <Skeleton variant="rect" className="h-10 w-24" />
            <Skeleton variant="rect" className="h-10 w-20" />
          </div>
        </div>

        {/* Documents Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Skeleton variant="rect" className="h-10 w-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton variant="rect" className="h-4 w-3/4" />
                    <Skeleton variant="rect" className="h-3 w-1/2" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Skeleton variant="rect" className="h-3 w-full" />
                  <Skeleton variant="rect" className="h-3 w-2/3" />
                </div>
                <Skeleton variant="rect" className="h-9 w-full" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
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
            <Button onClick={retryFetch} className="w-full">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  // Empty State
  if (documents.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="p-8 max-w-md mx-auto text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-bg-elevated flex items-center justify-center">
              <FileText className="w-8 h-8 text-text-tertiary" />
            </div>
            <h3 className="text-lg font-medium text-text-primary mb-2">
              No Documents Found
            </h3>
            <p className="text-text-secondary text-sm mb-6">
              You haven&apos;t uploaded any documents yet. Upload your first
              legal document to get started.
            </p>
            <Button onClick={() => router.push("/")} className="w-full">
              <Upload className="w-4 h-4 mr-2" />
              Upload Document
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  // Main Content
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
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
          {documents.length > 0 && (
            <Button
              variant="danger"
              onClick={() => setIsDeleteAllDialogOpen(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete All
            </Button>
          )}
          <Button onClick={() => router.push("/")}>
            <Upload className="w-4 h-4 mr-2" />
            Upload New
          </Button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-bg-elevated border border-border-muted rounded-lg text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent-purple/20 focus:border-accent-purple transition-colors"
          />
        </div>

        <div className="flex gap-2">
          {/* Sort Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="px-3 py-2 bg-bg-elevated border border-border-muted rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-purple/20 focus:border-accent-purple transition-colors hover:bg-bg-elevated/80 flex items-center gap-2 min-w-[140px] justify-between"
            >
              <span>
                {sortBy === "newest" && "Newest First"}
                {sortBy === "oldest" && "Oldest First"}
                {sortBy === "name" && "Name A-Z"}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-text-tertiary transition-transform ${
                  isDropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            {isDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-full bg-bg-elevated border border-border-muted rounded-lg shadow-lg z-10">
                <button
                  onClick={() => {
                    setSortBy("newest");
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-text-primary hover:bg-bg-surface transition-colors first:rounded-t-lg ${
                    sortBy === "newest"
                      ? "bg-accent-purple/10 text-accent-purple"
                      : ""
                  }`}
                >
                  Newest First
                </button>
                <button
                  onClick={() => {
                    setSortBy("oldest");
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-text-primary hover:bg-bg-surface transition-colors ${
                    sortBy === "oldest"
                      ? "bg-accent-purple/10 text-accent-purple"
                      : ""
                  }`}
                >
                  Oldest First
                </button>
                <button
                  onClick={() => {
                    setSortBy("name");
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-text-primary hover:bg-bg-surface transition-colors last:rounded-b-lg ${
                    sortBy === "name"
                      ? "bg-accent-purple/10 text-accent-purple"
                      : ""
                  }`}
                >
                  Name A-Z
                </button>
              </div>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="flex rounded-lg border border-border-muted overflow-hidden">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 transition-colors ${
                viewMode === "grid"
                  ? "bg-accent-purple text-white"
                  : "bg-bg-elevated text-text-secondary hover:text-text-primary"
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 transition-colors ${
                viewMode === "list"
                  ? "bg-accent-purple text-white"
                  : "bg-bg-elevated text-text-secondary hover:text-text-primary"
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Results Count */}
      {searchQuery && (
        <div className="mb-6">
          <p className="text-text-secondary text-sm">
            {filteredDocuments.length} document
            {filteredDocuments.length !== 1 ? "s" : ""} found
            {searchQuery && ` for "${searchQuery}"`}
          </p>
        </div>
      )}

      {/* Documents */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDocuments.map((doc) => (
            <Card
              key={doc.id}
              className="p-6 hover:bg-surface-secondary/50 transition-colors group"
            >
              <div className="space-y-4">
                {/* Document Header */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent-purple/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-accent-purple" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-text-primary truncate group-hover:text-accent-purple transition-colors">
                      {doc.filename}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-text-tertiary">
                      <Clock className="w-3 h-3" />
                      <span>{getRelativeTime(doc.upload_date)}</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDocument(doc.id, doc.filename);
                    }}
                    className="p-2 rounded-lg hover:bg-status-error/10 text-text-tertiary hover:text-status-error transition-colors"
                    title="Delete document"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Document Stats */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-secondary">Sections</span>
                    <span className="text-text-primary font-medium">
                      {doc.sections?.length || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-secondary">Analyzed</span>
                    <div className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-status-success" />
                      <span className="text-status-success font-medium">
                        Complete
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <Button
                  variant="secondary"
                  onClick={() => handleViewDocument(doc.id)}
                  className="w-full group-hover:bg-accent-purple group-hover:text-white transition-colors"
                >
                  View Analysis
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDocuments.map((doc) => (
            <Card
              key={doc.id}
              className="p-4 hover:bg-surface-secondary/50 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-accent-purple/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-accent-purple" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-text-primary truncate group-hover:text-accent-purple transition-colors">
                      {doc.filename}
                    </h3>
                    <div className="flex items-center gap-4 mt-1 text-sm text-text-secondary">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(doc.upload_date)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Layers3 className="w-3 h-3" />
                        <span>{doc.sections?.length || 0} sections</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-status-success" />
                        <span className="text-status-success">Complete</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDocument(doc.id, doc.filename);
                    }}
                    className="p-2 rounded-lg hover:bg-status-error/10 text-text-tertiary hover:text-status-error transition-colors"
                    title="Delete document"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <Button
                    variant="secondary"
                    onClick={() => handleViewDocument(doc.id)}
                    className="group-hover:bg-accent-purple group-hover:text-white transition-colors"
                  >
                    View Analysis
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* No Results */}
      {filteredDocuments.length === 0 && searchQuery && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-bg-elevated flex items-center justify-center">
            <Search className="w-8 h-8 text-text-tertiary" />
          </div>
          <h3 className="text-lg font-medium text-text-primary mb-2">
            No documents found
          </h3>
          <p className="text-text-secondary">
            Try adjusting your search terms or clear the search to see all
            documents.
          </p>
          <Button
            variant="secondary"
            onClick={() => setSearchQuery("")}
            className="mt-4"
          >
            Clear Search
          </Button>
        </div>
      )}

      {/* Footer Stats */}
      <div className="mt-12 pt-8 border-t border-border-muted">
        <div className="flex items-center justify-center text-sm text-text-tertiary">
          <span>
            Showing {filteredDocuments.length} of {documents.length} document
            {documents.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Delete All Confirmation Dialog */}
      {isDeleteAllDialogOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-sm w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-text-primary">
                Confirm Deletion
              </h3>
              <button
                onClick={() => setIsDeleteAllDialogOpen(false)}
                className="p-2 rounded-full hover:bg-bg-muted transition-colors"
                title="Close"
              >
                <X className="w-5 h-5 text-text-tertiary" />
              </button>
            </div>
            <p className="text-text-secondary mb-4">
              Are you sure you want to delete all documents? This action cannot
              be undone.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={handleDeleteAllDocuments}
                className="flex-1"
                variant="danger"
              >
                Delete All
              </Button>
              <Button
                onClick={() => setIsDeleteAllDialogOpen(false)}
                className="flex-1"
                variant="secondary"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
