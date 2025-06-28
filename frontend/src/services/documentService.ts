/**
 * 🔧 DOCUMENT SERVICE LAYER
 *
 * Responsibilities:
 * 1. Document API operations
 * 2. Error handling and transformation
 * 3. Business logic encapsulation
 * 4. Request lifecycle management
 *
 * Architectural Benefits:
 * - Centralized API logic
 * - Consistent error handling
 * - Testable business logic
 * - Clean separation from UI
 */

import apiClient from "@/lib/api";

export interface Document {
  id: string;
  filename: string;
  clauses: Array<Record<string, unknown>>;
  summary: string;
  structuredSummary: Record<string, unknown>;
  fullText: string;
  riskSummary: Record<string, unknown>;
  selectedClause: Record<string, unknown> | null;
  contract_type: string;
  [key: string]: unknown;
}

export interface DocumentLoadResult {
  success: boolean;
  document?: Document;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface DocumentDeleteResult {
  success: boolean;
  error?: {
    code: string;
    message: string;
  };
}

export interface PDFDownloadResult {
  success: boolean;
  blob?: Blob;
  filename?: string;
  error?: {
    code: string;
    message: string;
  };
}

class DocumentService {
  /**
   * Load document with proper error handling
   */
  async loadDocument(documentId: string): Promise<DocumentLoadResult> {
    try {
      console.log(`📄 [DocumentService] Loading document ${documentId}`);

      const response = await apiClient.get<Document>(
        `/documents/${documentId}`
      );

      if (response.success && response.data) {
        console.log(
          `✅ [DocumentService] Document ${documentId} loaded successfully`
        );
        return {
          success: true,
          document: response.data as Document,
        };
      } else {
        console.error(
          `❌ [DocumentService] Document load failed:`,
          response.error
        );
        return {
          success: false,
          error: {
            code: response.error?.code || "LOAD_FAILED",
            message: response.error?.message || "Failed to load document",
            details: response.error?.details,
          },
        };
      }
    } catch (error) {
      console.error(
        `❌ [DocumentService] Unexpected error loading document ${documentId}:`,
        error
      );
      return {
        success: false,
        error: {
          code: "UNEXPECTED_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "An unexpected error occurred",
          details: error instanceof Error ? { stack: error.stack } : { error },
        },
      };
    }
  }

  /**
   * Delete document with proper error handling
   */
  async deleteDocument(documentId: string): Promise<DocumentDeleteResult> {
    try {
      console.log(`🗑️ [DocumentService] Deleting document ${documentId}`);

      const response = await apiClient.delete(`/documents/${documentId}`);

      if (response.success) {
        console.log(
          `✅ [DocumentService] Document ${documentId} deleted successfully`
        );
        return { success: true };
      } else {
        console.error(
          `❌ [DocumentService] Document delete failed:`,
          response.error
        );
        return {
          success: false,
          error: {
            code: response.error?.code || "DELETE_FAILED",
            message: response.error?.message || "Failed to delete document",
          },
        };
      }
    } catch (error) {
      console.error(
        `❌ [DocumentService] Unexpected error deleting document ${documentId}:`,
        error
      );
      return {
        success: false,
        error: {
          code: "UNEXPECTED_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "An unexpected error occurred",
        },
      };
    }
  }

  /**
   * Download PDF report with streaming support
   */
  async downloadPDFReport(
    documentId: string,
    filename: string
  ): Promise<PDFDownloadResult> {
    try {
      console.log(
        `📄 [DocumentService] Downloading PDF report for ${documentId}`
      );

      const token = localStorage.getItem("access_token");
      if (!token) {
        return {
          success: false,
          error: {
            code: "AUTH_REQUIRED",
            message: "Authentication required",
          },
        };
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(
        `${apiUrl}/api/v1/reports/documents/${documentId}/pdf`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        return {
          success: false,
          error: {
            code: "DOWNLOAD_FAILED",
            message: `Failed to generate PDF: ${response.status}`,
          },
        };
      }

      const blob = await response.blob();
      const cleanFileName = (filename || "document").replace(".pdf", "");

      console.log(
        `✅ [DocumentService] PDF report downloaded for ${documentId}`
      );
      return {
        success: true,
        blob,
        filename: `${cleanFileName}_analysis_report.pdf`,
      };
    } catch (error) {
      console.error(
        `❌ [DocumentService] Error downloading PDF report:`,
        error
      );
      return {
        success: false,
        error: {
          code: "UNEXPECTED_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to download PDF report",
        },
      };
    }
  }

  /**
   * Download original PDF
   */
  async downloadOriginalPDF(
    documentId: string,
    filename?: string
  ): Promise<PDFDownloadResult> {
    try {
      console.log(
        `📄 [DocumentService] Downloading original PDF for ${documentId}`
      );

      const token = localStorage.getItem("access_token");
      if (!token) {
        return {
          success: false,
          error: {
            code: "AUTH_REQUIRED",
            message: "Authentication required",
          },
        };
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(
        `${apiUrl}/api/v1/documents/${documentId}/pdf`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          return {
            success: false,
            error: {
              code: "PDF_NOT_FOUND",
              message: "Original PDF file not available for this document",
            },
          };
        }
        return {
          success: false,
          error: {
            code: "DOWNLOAD_FAILED",
            message: `Failed to download PDF: ${response.status}`,
          },
        };
      }

      const blob = await response.blob();

      console.log(
        `✅ [DocumentService] Original PDF downloaded for ${documentId}`
      );
      return {
        success: true,
        blob,
        filename: filename || "document.pdf",
      };
    } catch (error) {
      console.error(
        `❌ [DocumentService] Error downloading original PDF:`,
        error
      );
      return {
        success: false,
        error: {
          code: "UNEXPECTED_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to download original PDF",
        },
      };
    }
  }
}

// Export singleton instance
export const documentService = new DocumentService();
export default documentService;
