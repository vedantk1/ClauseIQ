/**
 * Enhanced AnalysisContext with improved state management
 */

"use client";
import React, { createContext, useContext, ReactNode, useCallback, useRef } from "react";
import { useAppState } from "../store/appState";
import { apiClient, handleAPIError, handleAPISuccess } from "../lib/api";
import type { Clause, RiskSummary, Document, ContractType } from "@clauseiq/shared-types";

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

  // Helper function to poll job completion
  const pollJobCompletion = async (jobId: string, isSample: boolean): Promise<string | null> => {
    const statusEndpoint = isSample ? `/async/jobs/${jobId}/status-public` : `/async/jobs/${jobId}/status`;
    const resultEndpoint = isSample ? `/async/jobs/${jobId}/result-public` : `/async/jobs/${jobId}/result`;
    
    console.log(`🔄 [DEBUG] Starting job polling for ${jobId}...`);
    
    // Poll every 2 seconds, max 5 minutes
    const maxAttempts = 150; // 5 minutes
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      try {
        console.log(`📊 [DEBUG] Polling attempt ${attempts + 1}/${maxAttempts} for job ${jobId}`);
        
        const statusResponse = await apiClient.get<{
          job_id: string;
          status: string;
          progress?: {
            stage: string;
            percentage: number;
            message: string;
          };
          error_message?: string;
          estimated_completion_seconds?: number;
        }>(statusEndpoint);

        if (!statusResponse.success || !statusResponse.data) {
          console.error("❌ [DEBUG] Failed to get job status:", statusResponse.error?.message);
          throw new Error(statusResponse.error?.message || "Failed to check job status");
        }

        const { status, progress, error_message, estimated_completion_seconds } = statusResponse.data;
        
        // Log progress updates
        if (progress) {
          console.log(`📋 [DEBUG] Job ${jobId} progress: ${progress.stage} (${progress.percentage}%) - ${progress.message}`);
        }
        
        console.log(`📊 [DEBUG] Job ${jobId} status: ${status}, estimated remaining: ${estimated_completion_seconds}s`);

        if (status === "completed") {
          console.log(`✅ [DEBUG] Job ${jobId} completed! Fetching results...`);
          
          // Get the results
          const resultResponse = await apiClient.get<{
            job_id: string;
            status: string;
            result?: {
              document_id: string;
              filename: string;
              summary: string;
              ai_structured_summary?: StructuredSummary;
              clauses: Clause[];
              total_clauses: number;
              risk_summary: RiskSummary;
              full_text: string;
              contract_type: string;
            };
          }>(resultEndpoint);

          if (!resultResponse.success || !resultResponse.data?.result) {
            console.error("❌ [DEBUG] Failed to get job results:", resultResponse.error?.message);
            throw new Error(resultResponse.error?.message || "Failed to get analysis results");
          }

          const result = resultResponse.data.result;
          console.log(`🎉 [DEBUG] Analysis results received for document: ${result.document_id}`);

          // Add to documents list and set as current
          const newDocument: Document = {
            id: result.document_id,
            filename: result.filename,
            upload_date: new Date().toISOString(),
            contract_type: result.contract_type as ContractType | null,
            text: result.full_text,
            ai_full_summary: result.summary,
            ai_structured_summary: result.ai_structured_summary || null,
            clauses: result.clauses,
            risk_summary: result.risk_summary,
            user_id: "", // Will be set by backend
            user_interactions: null,
          };

          dispatch({ type: "ANALYSIS_ADD_DOCUMENT", payload: newDocument });

          // Set as current document
          dispatch({
            type: "ANALYSIS_SET_CURRENT_DOCUMENT",
            payload: {
              id: result.document_id,
              filename: result.filename,
              contract_type: result.contract_type,
              summary: result.summary,
              structuredSummary: result.ai_structured_summary || null,
              clauses: result.clauses,
              riskSummary: result.risk_summary,
              fullText: result.full_text,
              selectedClause: null,
            },
          });

          return result.document_id;
          
        } else if (status === "failed") {
          console.error(`❌ [DEBUG] Job ${jobId} failed:`, error_message);
          throw new Error(error_message || "Document analysis failed");
          
        } else if (status === "cancelled") {
          console.error(`❌ [DEBUG] Job ${jobId} was cancelled`);
          throw new Error("Document analysis was cancelled");
        }
        
        // Still processing, wait and try again
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        attempts++;
        
      } catch (error) {
        console.error(`❌ [DEBUG] Error polling job ${jobId}:`, error);
        throw error;
      }
    }
    
    // Timeout
    console.error(`⏰ [DEBUG] Job ${jobId} polling timeout after ${maxAttempts} attempts`);
    throw new Error("Analysis job timed out. Please try again.");
  };

  // Action implementations - Updated for async job pattern
  const analyzeDocument = async (file: File): Promise<string | null> => {
    console.log("🔄 [DEBUG] Starting async document analysis:", {
        fileName: file.name,
      fileSizeMB: (file.size / 1024 / 1024).toFixed(2),
      });

    try {
      dispatch({ type: "ANALYSIS_SET_LOADING", payload: true });
      dispatch({ type: "ANALYSIS_SET_ERROR", payload: null });

      // Check if this is a sample contract
      const isSampleContract = file.name === 'sample-contract.pdf';
      const startEndpoint = isSampleContract ? "/async/jobs/analysis/start-sample" : "/async/jobs/analysis/start";
      
      console.log(`🔄 [DEBUG] Starting analysis job via ${startEndpoint}...`);

      // Step 1: Start the analysis job
      const startResponse = await apiClient.uploadFile<{
        job_id: string;
        status: string;
        job_type: string;
        created_at: string;
        estimated_completion_seconds?: number;
      }>(startEndpoint, file);

      if (!startResponse.success || !startResponse.data) {
        const errorMessage = startResponse.error?.message || "Failed to start analysis job";
        console.error("❌ [DEBUG] Job start failed:", errorMessage);
        dispatch({ type: "ANALYSIS_SET_ERROR", payload: errorMessage });
        handleAPIError(startResponse, "Failed to start document analysis");
        throw new Error(errorMessage);
      }

      const { job_id, estimated_completion_seconds } = startResponse.data;
      console.log(`🚀 [DEBUG] Analysis job started: ${job_id}, estimated: ${estimated_completion_seconds}s`);

      // Step 2: Poll for job completion
      const documentId = await pollJobCompletion(job_id, isSampleContract);
      
      if (documentId) {
        handleAPISuccess("Document analyzed successfully!");
        return documentId;
      } else {
        throw new Error("Analysis completed but no document ID returned");
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
