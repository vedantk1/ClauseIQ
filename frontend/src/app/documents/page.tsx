"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAnalysis } from "@/context/AnalysisContext";
import { useApiCall } from "@/lib/apiUtils";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import toast from "react-hot-toast";
import Button from "@/components/Button";
import Card from "@/components/Card";
import Skeleton from "@/components/Skeleton";
import {
  FileText,
  Calendar,
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
  contract_type?: string;
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
  const [selectedContractType, setSelectedContractType] = useState<string>("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDeleteAllDialogOpen, setIsDeleteAllDialogOpen] = useState(false);
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(
    new Set()
  );
  const [isSelectMode, setIsSelectMode] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  // Bulk selection functions
  const selectAllDocuments = useCallback(() => {
    const allIds = new Set(filteredDocuments.map((doc) => doc.id));
    setSelectedDocuments(allIds);
  }, [filteredDocuments]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Focus search when pressing '/'
      if (
        event.key === "/" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        // Only if we're not in an input/textarea
        if (
          document.activeElement?.tagName !== "INPUT" &&
          document.activeElement?.tagName !== "TEXTAREA"
        ) {
          event.preventDefault();
          searchInputRef.current?.focus();
        }
      }

      // Escape key to exit select mode or clear search
      if (event.key === "Escape") {
        if (isSelectMode) {
          setIsSelectMode(false);
          setSelectedDocuments(new Set());
        } else if (searchQuery) {
          setSearchQuery("");
          searchInputRef.current?.blur();
        }
      }

      // Ctrl/Cmd + A to select all in select mode
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key === "a" &&
        isSelectMode
      ) {
        event.preventDefault();
        selectAllDocuments();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isSelectMode, searchQuery, selectAllDocuments]);

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

  // Simple text highlighting utility
  const highlightSearchText = (
    text: string,
    searchQuery: string
  ): React.ReactNode => {
    if (!searchQuery.trim() || !text) return text;

    const query = searchQuery.trim();
    const regex = new RegExp(
      `(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
      "gi"
    );
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark
          key={index}
          className="bg-accent-purple/20 text-accent-purple px-1 rounded"
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // Filter and sort documents
  useEffect(() => {
    const filtered = documents.filter((doc) => {
      // Contract type filter
      const matchesType =
        !selectedContractType || doc.contract_type === selectedContractType;

      // Enhanced search filter with partial word matching
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const searchableFields = [
          doc.filename || "",
          formatContractType(doc.contract_type),
        ];

        // Create searchable text and individual words
        const searchableText = searchableFields.join(" ").toLowerCase();
        const searchableWords = searchableText.split(/\s+/);

        // Check if query matches any part of the searchable content
        const queryMatches =
          searchableText.includes(query) || // Exact phrase match
          searchableWords.some((word) => word.startsWith(query)) || // Word starts with query
          searchableWords.some(
            (word) => word.includes(query) && query.length >= 3
          ); // Partial match for 3+ chars

        if (!queryMatches) return false;
      }

      return matchesType;
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
  }, [documents, searchQuery, sortBy, selectedContractType]);

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

  const formatContractType = (contractType?: string) => {
    if (!contractType) return "Unknown Type";

    // Convert snake_case to Title Case
    return contractType
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  const getContractTypeColor = (contractType?: string) => {
    const colors: Record<string, string> = {
      employment: "bg-blue-500/20 text-blue-300 border-blue-500/30",
      nda: "bg-purple-500/20 text-purple-300 border-purple-500/30",
      service_agreement: "bg-green-500/20 text-green-300 border-green-500/30",
      lease: "bg-orange-500/20 text-orange-300 border-orange-500/30",
      purchase: "bg-red-500/20 text-red-300 border-red-500/30",
      partnership: "bg-pink-500/20 text-pink-300 border-pink-500/30",
      license: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
      consulting: "bg-teal-500/20 text-teal-300 border-teal-500/30",
      contractor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
      other: "bg-gray-500/20 text-gray-300 border-gray-500/30",
    };

    return colors[contractType || "other"] || colors.other;
  };

  const getAvailableContractTypes = () => {
    const types = new Set(
      documents.map((doc) => doc.contract_type).filter(Boolean)
    );
    return Array.from(types).sort();
  };

  const handleViewDocument = async (documentId: string) => {
    try {
      setLoadingDocId(documentId);
      // Use the AnalysisContext loadDocument method
      await loadDocument(documentId);
      router.push("/review");
      toast.success("Document loaded successfully!");
    } catch (err) {
      console.error("Failed to fetch document:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to load document"
      );
    } finally {
      setLoadingDocId(null);
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
      setDeletingDocId(documentId);
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
    } finally {
      setDeletingDocId(null);
    }
  };

  const handleDeleteAllDocuments = async () => {
    // Close the dialog
    setIsDeleteAllDialogOpen(false);

    try {
      setDeletingAll(true);
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
    } finally {
      setDeletingAll(false);
    }
  };

  // Bulk selection functions
  const toggleSelectMode = () => {
    setIsSelectMode(!isSelectMode);
    setSelectedDocuments(new Set());
  };

  const toggleDocumentSelection = (documentId: string) => {
    const newSelected = new Set(selectedDocuments);
    if (newSelected.has(documentId)) {
      newSelected.delete(documentId);
    } else {
      newSelected.add(documentId);
    }
    setSelectedDocuments(newSelected);
  };

  const clearSelection = () => {
    setSelectedDocuments(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedDocuments.size === 0) return;

    const selectedCount = selectedDocuments.size;
    if (
      !window.confirm(
        `Are you sure you want to delete ${selectedCount} selected document${
          selectedCount > 1 ? "s" : ""
        }? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      const deletePromises = Array.from(selectedDocuments).map(
        async (docId) => {
          const res = await apiCall(`/documents/${docId}`, {
            method: "DELETE",
          });
          if (!res.ok) {
            const errorText = await res.text();
            throw new Error(
              `Error deleting document ${docId}: ${res.status} - ${errorText}`
            );
          }
        }
      );

      await Promise.all(deletePromises);

      // Remove deleted documents from local state
      setDocuments((prev) =>
        prev.filter((doc) => !selectedDocuments.has(doc.id))
      );
      setFilteredDocuments((prev) =>
        prev.filter((doc) => !selectedDocuments.has(doc.id))
      );

      // Clear selection and exit select mode
      setSelectedDocuments(new Set());
      setIsSelectMode(false);

      toast.success(
        `${selectedCount} document${
          selectedCount > 1 ? "s" : ""
        } deleted successfully!`
      );
    } catch (err) {
      console.error("Failed to delete documents:", err);
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to delete selected documents"
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
              <Button onClick={() => router.push("/")} className="w-full">
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
            <>
              <Button
                variant="secondary"
                onClick={toggleSelectMode}
                className="text-text-secondary hover:text-accent-purple hover:border-accent-purple/20 hover:bg-accent-purple/5 transition-all"
              >
                {isSelectMode ? "Cancel Select" : "Select"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setIsDeleteAllDialogOpen(true)}
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

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search documents... (try contract type, filename, etc.)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setSearchQuery("");
                e.currentTarget.blur();
              }
            }}
            className="w-full pl-10 pr-10 py-2 bg-bg-elevated border border-border-muted rounded-lg text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent-purple/20 focus:border-accent-purple transition-colors"
          />
          {/* Search indicator */}
          {searchQuery && (
            <div className="absolute right-10 top-1/2 transform -translate-y-1/2 flex items-center">
              <span className="text-xs text-accent-purple bg-accent-purple/10 px-2 py-0.5 rounded-full">
                {filteredDocuments.length} found
              </span>
            </div>
          )}
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-bg-surface transition-colors"
              title="Clear search"
            >
              <X className="w-3 h-3 text-text-tertiary" />
            </button>
          )}
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

      {/* Bulk Selection Toolbar */}
      {isSelectMode && (
        <div className="mb-6">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={
                      selectedDocuments.size === filteredDocuments.length &&
                      filteredDocuments.length > 0
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        selectAllDocuments();
                      } else {
                        clearSelection();
                      }
                    }}
                    className="w-4 h-4 text-accent-purple focus:ring-accent-purple border-border-muted rounded"
                  />
                  <span className="text-sm text-text-secondary">
                    {selectedDocuments.size > 0
                      ? `${selectedDocuments.size} of ${filteredDocuments.length} selected`
                      : "Select all"}
                  </span>
                </div>
                {selectedDocuments.size > 0 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={clearSelection}
                      size="sm"
                    >
                      Clear Selection
                    </Button>
                    <Button
                      variant="danger"
                      onClick={handleBulkDelete}
                      size="sm"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Selected ({selectedDocuments.size})
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Quick Filter Chips */}
      {documents.length > 0 && getAvailableContractTypes().length > 1 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-text-secondary font-medium">
              Filter by type:
            </span>
            <button
              onClick={() => setSelectedContractType("")}
              className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                !selectedContractType
                  ? "bg-accent-purple/20 text-accent-purple border-accent-purple/30"
                  : "bg-bg-elevated text-text-secondary border-border-muted hover:bg-bg-surface"
              }`}
            >
              All ({documents.length})
            </button>
            {getAvailableContractTypes().map((type) => {
              const count = documents.filter(
                (doc) => doc.contract_type === type
              ).length;
              return (
                <button
                  key={type}
                  onClick={() =>
                    setSelectedContractType(
                      selectedContractType === type ? "" : type || ""
                    )
                  }
                  className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                    selectedContractType === type
                      ? getContractTypeColor(type)
                      : "bg-bg-elevated text-text-secondary border-border-muted hover:bg-bg-surface"
                  }`}
                  title={`Filter by ${formatContractType(type)} contracts`}
                >
                  {formatContractType(type)} ({count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Results Count */}
      {(searchQuery || selectedContractType) && (
        <div className="mb-6">
          <p className="text-text-secondary text-sm">
            {filteredDocuments.length} document
            {filteredDocuments.length !== 1 ? "s" : ""} found
            {searchQuery && ` matching "${searchQuery}"`}
            {selectedContractType &&
              ` of type "${formatContractType(selectedContractType)}"`}
            {(searchQuery || selectedContractType) &&
              ` out of ${documents.length} total`}
          </p>
        </div>
      )}

      {/* Documents */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDocuments.map((doc) => (
            <div
              key={doc.id}
              onClick={() => !isSelectMode && handleViewDocument(doc.id)}
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
                          checked={selectedDocuments.has(doc.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleDocumentSelection(doc.id);
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
                        <span>{getRelativeTime(doc.upload_date)}</span>
                      </div>
                    </div>
                    {!isSelectMode && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDocument(doc.id, doc.filename);
                        }}
                        disabled={deletingDocId === doc.id}
                        className="p-2 rounded-lg hover:bg-status-error/10 text-text-tertiary hover:text-status-error transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Delete document"
                        aria-label={`Delete ${doc.filename}`}
                      >
                        {deletingDocId === doc.id ? (
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
                        handleViewDocument(doc.id);
                      }}
                      disabled={loadingDocId === doc.id}
                      className="w-full group-hover:bg-accent-purple group-hover:text-white group-hover:border-accent-purple transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loadingDocId === doc.id ? (
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
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDocuments.map((doc) => (
            <div
              key={doc.id}
              onClick={() => !isSelectMode && handleViewDocument(doc.id)}
              className={`${!isSelectMode ? "cursor-pointer" : ""}`}
            >
              <Card className="p-4 hover:bg-surface-secondary/50 transition-all duration-200 group border border-white/6 hover:border-white/12">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {isSelectMode && (
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedDocuments.has(doc.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleDocumentSelection(doc.id);
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
                            handleDeleteDocument(doc.id, doc.filename);
                          }}
                          disabled={deletingDocId === doc.id}
                          className="p-2 rounded-lg hover:bg-status-error/10 text-text-tertiary hover:text-status-error transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Delete document"
                          aria-label={`Delete ${doc.filename}`}
                        >
                          {deletingDocId === doc.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                        <Button
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDocument(doc.id);
                          }}
                          disabled={loadingDocId === doc.id}
                          className="group-hover:bg-accent-purple group-hover:text-white group-hover:border-accent-purple transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {loadingDocId === doc.id ? (
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
          ))}
        </div>
      )}

      {/* No Results */}
      {filteredDocuments.length === 0 &&
        (searchQuery || selectedContractType) && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-bg-elevated flex items-center justify-center">
              <Search className="w-8 h-8 text-text-tertiary" />
            </div>
            <h3 className="text-lg font-medium text-text-primary mb-2">
              No documents found
            </h3>
            <p className="text-text-secondary mb-4">
              {searchQuery && selectedContractType
                ? `No "${formatContractType(
                    selectedContractType
                  )}" documents match "${searchQuery}"`
                : searchQuery
                ? `No documents match "${searchQuery}"`
                : selectedContractType
                ? `No "${formatContractType(
                    selectedContractType
                  )}" documents found`
                : "No documents match your current filters"}
            </p>
            {searchQuery && (
              <p className="text-xs text-text-secondary/70 mb-4">
                Try searching for partial words like &quot;employ&quot; for
                employment contracts, or &quot;non&quot; for non-compete
                agreements
              </p>
            )}
            <div className="flex gap-2 justify-center">
              {searchQuery && (
                <Button variant="secondary" onClick={() => setSearchQuery("")}>
                  Clear Search
                </Button>
              )}
              {selectedContractType && (
                <Button
                  variant="secondary"
                  onClick={() => setSelectedContractType("")}
                >
                  Clear Filter
                </Button>
              )}
            </div>
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
