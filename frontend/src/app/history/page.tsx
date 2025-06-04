"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useAnalysis } from "@/context/AnalysisContext";
import { useApiCall } from "@/context/AuthContext";
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

export default function History() {
  const { isAuthenticated, isLoading } = useAuthRedirect();
  const router = useRouter();
  const { setSections } = useAnalysis();
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

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const res = await apiCall(`/documents/`);

        if (!res.ok) {
          throw new Error(`Error retrieving documents: ${res.status}`);
        }

        const data = await res.json();

        if (data.error) {
          throw new Error(data.error);
        }

        const docs = data.documents || [];
        setDocuments(docs);
        setFilteredDocuments(docs);
      } catch (err) {
        console.error("Failed to fetch documents:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load document history"
        );
        toast.error("Failed to load document history");
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, [apiCall]);

  // Filter and sort documents
  useEffect(() => {
    const filtered = documents.filter((doc) =>
      doc.filename.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
      const res = await apiCall(`/documents/${documentId}`);

      if (!res.ok) {
        throw new Error(`Error retrieving document: ${res.status}`);
      }

      const document = await res.json();

      if (document.error) {
        throw new Error(document.error);
      }

      setSections(document.sections || []);
      router.push("/review");
      toast.success("Document loaded successfully!");
    } catch (err) {
      console.error("Failed to fetch document:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to load document"
      );
    }
  };

  const retryFetch = () => {
    setError(null);
    setLoading(true);
    // Re-trigger the fetch
    window.location.reload();
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
              Error Loading History
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
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-secondary flex items-center justify-center">
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
            Document History
          </h1>
          <p className="text-text-secondary mt-1">
            View and manage your analyzed legal documents
          </p>
        </div>
        <Button onClick={() => router.push("/")}>
          <Upload className="w-4 h-4 mr-2" />
          Upload New
        </Button>
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
            className="w-full pl-10 pr-4 py-2 bg-surface-secondary border border-border-primary rounded-lg text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent-purple/20 focus:border-accent-purple transition-colors"
          />
        </div>

        <div className="flex gap-2">
          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-3 py-2 bg-surface-secondary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-purple/20 focus:border-accent-purple transition-colors"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="name">Name A-Z</option>
          </select>

          {/* View Mode Toggle */}
          <div className="flex rounded-lg border border-border-primary overflow-hidden">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 transition-colors ${
                viewMode === "grid"
                  ? "bg-accent-purple text-white"
                  : "bg-surface-secondary text-text-secondary hover:text-text-primary"
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 transition-colors ${
                viewMode === "list"
                  ? "bg-accent-purple text-white"
                  : "bg-surface-secondary text-text-secondary hover:text-text-primary"
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
                <Button
                  variant="secondary"
                  onClick={() => handleViewDocument(doc.id)}
                  className="ml-4 group-hover:bg-accent-purple group-hover:text-white transition-colors"
                >
                  View Analysis
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* No Results */}
      {filteredDocuments.length === 0 && searchQuery && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-secondary flex items-center justify-center">
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
      <div className="mt-12 pt-8 border-t border-border-primary">
        <div className="flex items-center justify-center text-sm text-text-tertiary">
          <span>
            Showing {filteredDocuments.length} of {documents.length} document
            {documents.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
