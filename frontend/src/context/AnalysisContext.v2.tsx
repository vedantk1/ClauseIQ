/**
 * Enhanced AnalysisContext with improved state management
 */

"use client";
import React, { createContext, useContext, ReactNode } from "react";
import { useAppState } from "../store/appState";
import { apiClient, handleAPIError, handleAPISuccess } from "../lib/api";
import { Section, Clause, RiskSummary, Document } from "@clauseiq/shared-types";

interface AnalysisContextType {
  // State from store
  documents: Document[];
  currentDocument: {
    id: string | null;
    filename: string;
    sections: Section[];
    clauses: Clause[];
    summary: string;
    fullText: string;
    riskSummary: RiskSummary;
    selectedClause: Clause | null;
  };
  isLoading: boolean;
  error: string | null;

  // Actions
  analyzeDocument: (file: File) => Promise<void>;
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

  // Action implementations
  const analyzeDocument = async (file: File): Promise<void> => {
    try {
      dispatch({ type: "ANALYSIS_SET_LOADING", payload: true });
      dispatch({ type: "ANALYSIS_SET_ERROR", payload: null });

      const response = await apiClient.uploadFile<{
        id: string;
        filename: string;
        summary: string;
        clauses: Clause[];
        total_clauses: number;
        risk_summary: RiskSummary;
        full_text?: string;
      }>("/analyze-document/", file);

      if (response.success && response.data) {
        const { id, filename, summary, clauses, risk_summary, full_text } =
          response.data;

        // Add to documents list
        const newDocument: Document = {
          id,
          filename,
          upload_date: new Date().toISOString(),
          text: full_text || "",
          ai_full_summary: summary,
          sections: [],
          clauses,
          risk_summary: risk_summary,
          user_id: "", // Will be set by backend
        };

        dispatch({ type: "ANALYSIS_ADD_DOCUMENT", payload: newDocument });

        // Set as current document
        dispatch({
          type: "ANALYSIS_SET_CURRENT_DOCUMENT",
          payload: {
            id,
            filename,
            summary,
            clauses,
            riskSummary: risk_summary,
            fullText: full_text || "",
            sections: [], // Legacy support
            selectedClause: null,
          },
        });

        handleAPISuccess("Document analyzed successfully!");
      } else {
        const errorMessage =
          response.error?.message || "Failed to analyze document";
        dispatch({ type: "ANALYSIS_SET_ERROR", payload: errorMessage });
        handleAPIError(response, "Document analysis failed");
        throw new Error(errorMessage);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      dispatch({ type: "ANALYSIS_SET_ERROR", payload: errorMessage });
      throw error;
    } finally {
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
      }>("/analyze-clauses/", file);

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
      dispatch({ type: "ANALYSIS_SET_LOADING", payload: false });
    }
  };

  const loadDocuments = async (): Promise<void> => {
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
  };

  const loadDocument = async (documentId: string): Promise<void> => {
    try {
      dispatch({ type: "ANALYSIS_SET_LOADING", payload: true });

      const response = await apiClient.get<{
        id: string;
        filename: string;
        text: string;
        ai_full_summary: string;
        sections: Section[];
        clauses: Clause[];
        risk_summary: RiskSummary;
      }>(`/documents/${documentId}`);

      if (response.success && response.data) {
        const {
          id,
          filename,
          text,
          ai_full_summary,
          sections,
          clauses,
          risk_summary,
        } = response.data;

        dispatch({
          type: "ANALYSIS_SET_CURRENT_DOCUMENT",
          payload: {
            id,
            filename,
            fullText: text,
            summary: ai_full_summary,
            sections: sections || [],
            clauses: clauses || [],
            riskSummary: risk_summary || { high: 0, medium: 0, low: 0 },
            selectedClause: null,
          },
        });
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
    } finally {
      dispatch({ type: "ANALYSIS_SET_LOADING", payload: false });
    }
  };

  const setSelectedClause = (clause: Clause | null) => {
    dispatch({ type: "ANALYSIS_SET_SELECTED_CLAUSE", payload: clause });
  };

  const clearError = () => {
    dispatch({ type: "ANALYSIS_SET_ERROR", payload: null });
  };

  const resetAnalysis = () => {
    dispatch({ type: "ANALYSIS_RESET" });
  };

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
