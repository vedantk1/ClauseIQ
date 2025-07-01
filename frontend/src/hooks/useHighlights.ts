/**
 * Highlights Hook
 *
 * A React hook that provides:
 * - CRUD operations for PDF highlights
 * - Loading states and error handling
 * - Automatic refresh on document change
 * - Integration with authentication
 *
 * This hook integrates with the backend highlight service for persistent storage.
 */

"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { Highlight, HighlightArea } from "@clauseiq/shared-types";
import config from "@/config/config";

interface UseHighlightsOptions {
  documentId: string;
  enabled?: boolean;
}

interface UseHighlightsReturn {
  highlights: Highlight[];
  isLoading: boolean;
  error: string | null;
  createHighlight: (
    content: string,
    comment: string,
    areas: HighlightArea[]
  ) => Promise<Highlight | null>;
  updateHighlight: (
    highlightId: string,
    updates: { comment?: string; aiRewrite?: string }
  ) => Promise<boolean>;
  deleteHighlight: (highlightId: string) => Promise<boolean>;
  refreshHighlights: () => void;
  // 🤖 AI-powered functions
  analyzeHighlight: (
    highlightId: string,
    model?: string
  ) => Promise<HighlightAnalysis>;
  generateAIRewrite: (
    highlightId: string,
    goal?: string,
    model?: string
  ) => Promise<HighlightRewrite>;
  getDocumentAIInsights: () => Promise<DocumentAIInsights>;
}

// 🤖 AI Analysis types
interface HighlightAnalysis {
  summary: string;
  key_insights: string[];
  risk_level: "low" | "medium" | "high";
  legal_significance: string;
  recommended_action: string;
}

interface HighlightRewrite {
  original_text: string;
  rewritten_text: string;
  improvement_summary: string;
  clarity_score: number;
}

interface DocumentAIInsights {
  summary: string;
  risk_distribution: Record<string, number>;
  recommendations: string[];
  high_risk_percentage: number;
}

export function useHighlights({
  documentId,
  enabled = true,
}: UseHighlightsOptions): UseHighlightsReturn {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Get auth token from localStorage (following existing pattern)
  const getAuthToken = useCallback(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("access_token");
  }, []);

  // Create auth headers
  const getAuthHeaders = useCallback(() => {
    const token = getAuthToken();
    return {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }, [getAuthToken]);

  // Fetch highlights from backend
  const fetchHighlights = useCallback(async () => {
    if (!enabled || !documentId) {
      // Reset to empty state if disabled or no document
      setHighlights([]);
      setError(null);
      return;
    }

    // Abort any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${config.apiUrl}/api/v1/highlights/documents/${documentId}/highlights`,
        {
          method: "GET",
          headers: getAuthHeaders(),
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch highlights: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success && data.data) {
        setHighlights(data.data.highlights || []);
      } else {
        setHighlights([]);
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name !== "AbortError") {
        console.error("Failed to fetch highlights:", error);
        setError(error.message || "Failed to load highlights");
        setHighlights([]);
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [enabled, documentId, getAuthHeaders]);

  // Create a new highlight
  const createHighlight = useCallback(
    async (
      content: string,
      comment: string,
      areas: HighlightArea[]
    ): Promise<Highlight | null> => {
      if (!documentId) return null;

      try {
        const response = await fetch(
          `${config.apiUrl}/api/v1/highlights/documents/${documentId}/highlights`,
          {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({
              content,
              comment,
              areas,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to create highlight: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.success && data.data?.highlight) {
          const newHighlight = data.data.highlight;
          setHighlights((prev) => [...prev, newHighlight]);
          return newHighlight;
        }

        return null;
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to create highlight";
        console.error("Failed to create highlight:", error);
        setError(errorMessage);
        return null;
      }
    },
    [documentId, getAuthHeaders]
  );

  // Update an existing highlight
  const updateHighlight = useCallback(
    async (
      highlightId: string,
      updates: { comment?: string; aiRewrite?: string }
    ): Promise<boolean> => {
      if (!documentId) return false;

      try {
        const response = await fetch(
          `${config.apiUrl}/api/v1/highlights/documents/${documentId}/highlights/${highlightId}`,
          {
            method: "PUT",
            headers: getAuthHeaders(),
            body: JSON.stringify(updates),
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to update highlight: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.success && data.data?.highlight) {
          const updatedHighlight = data.data.highlight;
          setHighlights((prev) =>
            prev.map((h) => (h.id === highlightId ? updatedHighlight : h))
          );
          return true;
        }

        return false;
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to update highlight";
        console.error("Failed to update highlight:", error);
        setError(errorMessage);
        return false;
      }
    },
    [documentId, getAuthHeaders]
  );

  // Delete a highlight
  const deleteHighlight = useCallback(
    async (highlightId: string): Promise<boolean> => {
      if (!documentId) return false;

      try {
        const response = await fetch(
          `${config.apiUrl}/api/v1/highlights/documents/${documentId}/highlights/${highlightId}`,
          {
            method: "DELETE",
            headers: getAuthHeaders(),
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to delete highlight: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.success) {
          setHighlights((prev) => prev.filter((h) => h.id !== highlightId));
          return true;
        }

        return false;
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to delete highlight";
        console.error("Failed to delete highlight:", error);
        setError(errorMessage);
        return false;
      }
    },
    [documentId, getAuthHeaders]
  );

  // Refresh highlights (useful for external triggers)
  const refreshHighlights = useCallback(() => {
    fetchHighlights();
  }, [fetchHighlights]);

  // 🤖 AI Analysis function
  const analyzeHighlight = useCallback(
    async (highlightId: string, model?: string): Promise<HighlightAnalysis> => {
      try {
        const url = `${config.apiUrl}/api/v1/highlights/documents/${documentId}/highlights/${highlightId}/analyze`;
        const params = new URLSearchParams();
        if (model) params.append("model", model);

        const response = await fetch(`${url}?${params}`, {
          method: "POST",
          headers: getAuthHeaders(),
        });

        if (!response.ok) {
          throw new Error(
            `Failed to analyze highlight: ${response.statusText}`
          );
        }

        const data = await response.json();
        if (data.success && data.data?.analysis) {
          return data.data.analysis;
        }

        throw new Error("Invalid analysis response");
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to analyze highlight";
        console.error("AI analysis error:", error);
        throw new Error(errorMessage);
      }
    },
    [documentId, getAuthHeaders]
  );

  // 🤖 AI Rewrite function
  const generateAIRewrite = useCallback(
    async (
      highlightId: string,
      goal: string = "clarity",
      model?: string
    ): Promise<HighlightRewrite> => {
      try {
        const url = `${config.apiUrl}/api/v1/highlights/documents/${documentId}/highlights/${highlightId}/rewrite`;
        const params = new URLSearchParams();
        params.append("rewrite_goal", goal);
        if (model) params.append("model", model);

        const response = await fetch(`${url}?${params}`, {
          method: "POST",
          headers: getAuthHeaders(),
        });

        if (!response.ok) {
          throw new Error(`Failed to generate rewrite: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.success && data.data?.rewrite) {
          // Update local state with the new AI rewrite
          setHighlights((prev) =>
            prev.map((h) =>
              h.id === highlightId
                ? { ...h, aiRewrite: data.data.rewrite.rewritten_text }
                : h
            )
          );
          return data.data.rewrite;
        }

        throw new Error("Invalid rewrite response");
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to generate rewrite";
        console.error("AI rewrite error:", error);
        throw new Error(errorMessage);
      }
    },
    [documentId, getAuthHeaders]
  );

  // 🤖 Document AI Insights function
  const getDocumentAIInsights =
    useCallback(async (): Promise<DocumentAIInsights> => {
      try {
        const url = `${config.apiUrl}/api/v1/highlights/documents/${documentId}/highlights/ai-insights`;
        const response = await fetch(url, {
          method: "GET",
          headers: getAuthHeaders(),
        });

        if (!response.ok) {
          throw new Error(`Failed to get AI insights: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.success && data.data?.insights) {
          return data.data.insights;
        }

        throw new Error("Invalid insights response");
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to get AI insights";
        console.error("AI insights error:", error);
        throw new Error(errorMessage);
      }
    }, [documentId, getAuthHeaders]);

  // Auto-fetch on mount and when documentId changes
  useEffect(() => {
    fetchHighlights();

    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchHighlights]);

  return {
    highlights: highlights || [],
    isLoading,
    error,
    createHighlight,
    updateHighlight,
    deleteHighlight,
    refreshHighlights,
    analyzeHighlight,
    generateAIRewrite,
    getDocumentAIInsights,
  };
}
