"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useAnalysis } from "@/context/AnalysisContext";
import toast from "react-hot-toast";
import config from "@/config/config";

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

export default function History() {
  const router = useRouter();
  const { setSections } = useAnalysis();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const res = await fetch(`${config.apiUrl}/documents/`);

        if (!res.ok) {
          throw new Error(`Error retrieving documents: ${res.status}`);
        }

        const data = await res.json();

        if (data.error) {
          throw new Error(data.error);
        }

        setDocuments(data.documents || []);
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
  }, []);

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

  const handleViewDocument = async (documentId: string) => {
    try {
      const res = await fetch(`${config.apiUrl}/documents/${documentId}`);

      if (!res.ok) {
        throw new Error(`Error retrieving document: ${res.status}`);
      }

      const document = await res.json();

      if (document.error) {
        throw new Error(document.error);
      }

      setSections(document.sections || []);
      router.push("/results");
      toast.success("Document loaded successfully!");
    } catch (err) {
      console.error("Failed to fetch document:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to load document"
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading document history...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-md mx-auto">
          <h3 className="text-red-800 font-medium">Error Loading History</h3>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 max-w-md mx-auto">
          <h3 className="text-gray-800 font-medium mb-2">No Documents Found</h3>
          <p className="text-gray-600 text-sm mb-4">
            You haven&apos;t uploaded any documents yet.
          </p>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Upload a Document
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Document History</h1>
        <button
          onClick={() => router.push("/")}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          Upload New Document
        </button>
      </div>

      <div className="grid gap-4">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="font-medium text-gray-900 mb-1">
                  {doc.filename}
                </h3>
                <p className="text-sm text-gray-500 mb-2">
                  Uploaded: {formatDate(doc.upload_date)}
                </p>
                <p className="text-sm text-gray-600">
                  {doc.sections?.length || 0} sections found
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleViewDocument(doc.id)}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  View Analysis
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center text-sm text-gray-500 mt-8">
        Showing {documents.length} document{documents.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
