/**
 * Enhanced AnalysisContext with improved state management
 */

"use client";
import React, { createContext, useContext, ReactNode, useCallback, useRef } from "react";
import { useAppState } from "../store/appState";
import { apiClient, handleAPIError, handleAPISuccess } from "../lib/api";
import type { Clause, RiskSummary, Document } from "@shared/common_generated";
import { ContractType } from "@shared/common";

// Type for AI structured summary data
export interface StructuredSummary {
  overview?: string;
  key_parties?: string[];
  important_dates?: string[];
  major_obligations?: string[];
  risk_highlights?: string[];
  key_insights?: string[];
  [key: string]: string | string[] | undefined; // Allow additional fields
}

interface AnalysisContextType {
  // State from store
  documents: Document[];
  currentDocument: {
    id: string | null;
    filename: string;
    clauses: Clause[];
    summary: string;
    structuredSummary: StructuredSummary | null;
    fullText: string;
    riskSummary: RiskSummary;
    selectedClause: Clause | null;
    contract_type?: string;
  };
  isLoading: boolean;
  error: string | null;

  // Actions
  analyzeDocument: (file: File) => Promise<string | null>;
  analyzeClauses: (file: File) => Promise<void>;
  loadDocuments: () => Promise<void>;
  loadDocument: (documentId: string) => Promise<void>;
  setSelectedClause: (clause: Clause | null) => void;
  clearError: () => void;
  resetAnalysis: () => void;
}

const AnalysisContext = createContext<AnalysisContextType | undefined>(
  undefined
);

export const AnalysisProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { state, dispatch } = useAppState();
  const analysisState = state.analysis;
  
  // API call deduplication to prevent duplicate requests
  const activeRequests = useRef<Map<string, Promise<void>>>(new Map());

  // Action implementations
  const analyzeDocument = async (file: File): Promise<string | null> => {
    console.log("🔄 [DEBUG] Starting document analysis:", {
        fileName: file.name,
      fileSizeMB: (file.size / 1024 / 1024).toFixed(2),
      });

    try {
      dispatch({ type: "ANALYSIS_SET_LOADING", payload: true });
      dispatch({ type: "ANALYSIS_SET_ERROR", payload: null });

      console.log("🔄 [DEBUG] Making API call to /analysis/analyze/...");

      const response = await apiClient.uploadFile<{
        id: string;
        filename: string;
        summary: string;
        ai_structured_summary?: StructuredSummary;
        clauses: Clause[];
        total_clauses: number;
        risk_summary: RiskSummary;
        full_text?: string;
        contract_type?: string;
      }>("/analysis/analyze/", file);

      console.log("🔄 [DEBUG] API call completed:", response.success ? "success" : "failed");

      if (response.success && response.data) {
        const {
          id,
          filename,
          summary,
          ai_structured_summary,
          clauses,
          risk_summary,
          full_text,
          contract_type,
        } = response.data;

        // Add to documents list
        const newDocument: Document = {
          id,
          filename,
          upload_date: new Date().toISOString(),
          contract_type: contract_type as ContractType | null,
          text: full_text || "",
          ai_full_summary: summary,
          ai_structured_summary: ai_structured_summary || null,
          clauses,
          risk_summary: risk_summary,
          user_id: "", // Will be set by backend
          user_interactions: null,
        };

        dispatch({ type: "ANALYSIS_ADD_DOCUMENT", payload: newDocument });

        // Set as current document
        dispatch({
          type: "ANALYSIS_SET_CURRENT_DOCUMENT",
          payload: {
            id,
            filename,
            contract_type,
            summary,
            structuredSummary: ai_structured_summary || null,
            clauses,
            riskSummary: risk_summary,
            fullText: full_text || "",
            selectedClause: null,
          },
        });

        console.log("✅ [DEBUG] Document analysis completed:", {
          documentId: id,
          fileName: filename,
          clausesCount: clauses.length,
        });

        handleAPISuccess("Document analyzed successfully!");
        return id; // Return the document ID
      } else {
        const errorMessage =
          response.error?.message || "Failed to analyze document";
        console.error("❌ [DEBUG] Document analysis API error:", {
          success: response.success,
          error: errorMessage,
          errorDetails: response.error,
          correlationId: response.correlation_id,
          fileName: file.name,
          timestamp: new Date().toISOString(),
        });
        dispatch({ type: "ANALYSIS_SET_ERROR", payload: errorMessage });
        handleAPIError(response, "Document analysis failed");
        throw new Error(errorMessage);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      console.error("❌ [DEBUG] Document analysis exception:", {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        fileName: file.name,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        timestamp: new Date().toISOString(),
      });
      dispatch({ type: "ANALYSIS_SET_ERROR", payload: errorMessage });
      throw error;
    } finally {
      console.log("🔄 [DEBUG] Document analysis loading state cleared");
      dispatch({ type: "ANALYSIS_SET_LOADING", payload: false });
    }
  };

  const analyzeClauses = async (file: File): Promise<void> => {
    try {
      dispatch({ type: "ANALYSIS_SET_LOADING", payload: true });
      dispatch({ type: "ANALYSIS_SET_ERROR", payload: null });

      const response = await apiClient.uploadFile<{
        clauses: Clause[];
        total_clauses: number;
        risk_summary: RiskSummary;
        document_id: string;
      }>("/analysis/analyze-clauses/", file);

      if (response.success && response.data) {
        const { clauses, risk_summary, document_id } = response.data;

        // Update current document with clause analysis
        dispatch({
          type: "ANALYSIS_UPDATE_CURRENT_DOCUMENT",
          payload: {
            id: document_id,
            filename: file.name,
            clauses,
            riskSummary: risk_summary,
            selectedClause: null,
          },
        });

        handleAPISuccess("Clauses analyzed successfully!");
      } else {
        const errorMessage =
          response.error?.message || "Failed to analyze clauses";
        dispatch({ type: "ANALYSIS_SET_ERROR", payload: errorMessage });
        handleAPIError(response, "Clause analysis failed");
        throw new Error(errorMessage);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      dispatch({ type: "ANALYSIS_SET_ERROR", payload: errorMessage });
      throw error;
    } finally {
      console.log("🔄 [DEBUG] analyzeDocument FINALLY block - setting loading to false");
      dispatch({ type: "ANALYSIS_SET_LOADING", payload: false });
      console.log("🔄 [DEBUG] analyzeDocument COMPLETED (finally block)");
    }
  };

  const loadDocuments = useCallback(async (): Promise<void> => {
    try {
      dispatch({ type: "ANALYSIS_SET_LOADING", payload: true });

      const response = await apiClient.get<Document[]>("/documents/");

      if (response.success && response.data) {
        dispatch({ type: "ANALYSIS_SET_DOCUMENTS", payload: response.data });
      } else {
        handleAPIError(response, "Failed to load documents");
      }
    } catch (error) {
      console.error("Failed to load documents:", error);
    } finally {
      dispatch({ type: "ANALYSIS_SET_LOADING", payload: false });
    }
  }, [dispatch]);

  const loadDocument = useCallback(async (documentId: string): Promise<void> => {
    // Skip if already loading this document or document already loaded
    if (analysisState.currentDocument.id === documentId) {
      console.log(`📄 Document ${documentId} already loaded, skipping`);
      return;
    }

    // Check for existing active request to prevent duplicates
    const requestKey = `load-document-${documentId}`;
    const existingRequest = activeRequests.current.get(requestKey);
    if (existingRequest) {
      console.log(`🔄 Document ${documentId} already being loaded, waiting for existing request`);
      return existingRequest;
    }

    // Create new request and store it for deduplication
    const loadRequest = async (): Promise<void> => {
      try {
        dispatch({ type: "ANALYSIS_SET_LOADING", payload: true });

        console.log(`📄 Loading document ${documentId} for review page`);

        const response = await apiClient.get<{
          id: string;
          filename: string;
          contract_type?: string;
          text: string;
          ai_full_summary: string;
          ai_structured_summary?: StructuredSummary;
          clauses: Clause[];
          risk_summary: RiskSummary;
        }>(`/documents/${documentId}`);

        if (response.success && response.data) {
          const {
            id,
            filename,
            contract_type,
            text,
            ai_full_summary,
            ai_structured_summary,
            clauses,
            risk_summary,
          } = response.data;

          dispatch({
            type: "ANALYSIS_SET_CURRENT_DOCUMENT",
            payload: {
              id,
              filename,
              contract_type,
              fullText: text,
              summary: ai_full_summary,
              structuredSummary: ai_structured_summary || null,
              clauses: clauses || [],
              riskSummary: risk_summary || { high: 0, medium: 0, low: 0 },
              selectedClause: null,
            },
          });

          console.log(`✅ Document ${documentId} loaded successfully`);
        } else {
          const errorMessage =
            response.error?.message || "Failed to load document";
          dispatch({ type: "ANALYSIS_SET_ERROR", payload: errorMessage });
          handleAPIError(response, "Failed to load document");
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        dispatch({ type: "ANALYSIS_SET_ERROR", payload: errorMessage });
        throw error;
      } finally {
        dispatch({ type: "ANALYSIS_SET_LOADING", payload: false });
        // Clean up the active request
        activeRequests.current.delete(requestKey);
      }
    };

    // Store and execute the request
    const promise = loadRequest();
    activeRequests.current.set(requestKey, promise);
    
    return promise;
  }, [analysisState.currentDocument.id, dispatch]);

  const setSelectedClause = useCallback((clause: Clause | null) => {
    dispatch({ type: "ANALYSIS_SET_SELECTED_CLAUSE", payload: clause });
  }, [dispatch]);

  const clearError = useCallback(() => {
    dispatch({ type: "ANALYSIS_SET_ERROR", payload: null });
  }, [dispatch]);

  const resetAnalysis = useCallback(() => {
    console.log("🔄 [DEBUG] Analysis state reset initiated:", {
      timestamp: new Date().toISOString(),
    });
    dispatch({ type: "ANALYSIS_RESET" });
    console.log("✅ [DEBUG] Analysis state reset completed");
  }, [dispatch]);

  const contextValue: AnalysisContextType = {
    // State from store
    documents: analysisState.documents,
    currentDocument: analysisState.currentDocument,
    isLoading: analysisState.isLoading,
    error: analysisState.error,

    // Actions
    analyzeDocument,
    analyzeClauses,
    loadDocuments,
    loadDocument,
    setSelectedClause,
    clearError,
    resetAnalysis,
  };

  return (
    <AnalysisContext.Provider value={contextValue}>
      {children}
    </AnalysisContext.Provider>
  );
};

export const useAnalysis = () => {
  const context = useContext(AnalysisContext);
  if (context === undefined) {
    throw new Error("useAnalysis must be used within an AnalysisProvider");
  }
  return context;
};
