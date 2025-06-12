// Custom hook for managing user interactions (notes and flags)
import { useState, useEffect, useCallback } from "react";
import {
  userInteractionService,
  UserInteraction,
} from "@/services/userInteraction";
import toast from "react-hot-toast";

export interface UseUserInteractionsResult {
  userNotes: Record<string, string>;
  flaggedClauses: Set<string>;
  isLoading: boolean;
  addNote: (clauseId: string, note: string) => Promise<void>;
  editNote: (clauseId: string, note: string) => Promise<void>;
  deleteNote: (clauseId: string) => Promise<void>;
  toggleFlag: (clauseId: string) => Promise<void>;
  loadInteractions: () => Promise<void>;
}

export function useUserInteractions(
  documentId: string | null
): UseUserInteractionsResult {
  const [userNotes, setUserNotes] = useState<Record<string, string>>({});
  const [flaggedClauses, setFlaggedClauses] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  // Convert API response to local state format
  const processInteractions = useCallback(
    (interactions: Record<string, UserInteraction>) => {
      const notes: Record<string, string> = {};
      const flags = new Set<string>();

      Object.entries(interactions).forEach(([clauseId, interaction]) => {
        if (interaction.note) {
          notes[clauseId] = interaction.note;
        }
        if (interaction.is_flagged) {
          flags.add(clauseId);
        }
      });

      setUserNotes(notes);
      setFlaggedClauses(flags);
    },
    []
  );

  // Load interactions from API
  const loadInteractions = useCallback(async () => {
    console.log(
      "🔄 [DEBUG] loadInteractions called with documentId:",
      documentId
    );

    if (!documentId) {
      console.log("⚠️ [DEBUG] No documentId provided, skipping API call");
      return;
    }

    setIsLoading(true);
    try {
      console.log(
        "📡 [DEBUG] Calling userInteractionService.getUserInteractions..."
      );
      const interactions = await userInteractionService.getUserInteractions(
        documentId
      );
      console.log("✅ [DEBUG] Received interactions:", interactions);
      processInteractions(interactions);
    } catch (error) {
      console.error("❌ [DEBUG] Failed to load user interactions:", error);
      toast.error("Failed to load your notes and flags");
    } finally {
      setIsLoading(false);
    }
  }, [documentId, processInteractions]);

  // Add a note
  const addNote = useCallback(
    async (clauseId: string, note: string) => {
      if (!documentId) return;

      try {
        const currentlyFlagged = flaggedClauses.has(clauseId);
        await userInteractionService.saveUserInteraction(documentId, clauseId, {
          note,
          is_flagged: currentlyFlagged, // Preserve existing flag status
        });

        // Update local state
        setUserNotes((prev) => ({
          ...prev,
          [clauseId]: note,
        }));

        toast.success("Note saved successfully");
      } catch (error) {
        console.error("Failed to save note:", error);
        toast.error("Failed to save note");
        throw error;
      }
    },
    [documentId, flaggedClauses]
  );

  // Edit a note
  const editNote = useCallback(
    async (clauseId: string, note: string) => {
      if (!documentId) return;

      try {
        const currentlyFlagged = flaggedClauses.has(clauseId);
        await userInteractionService.saveUserInteraction(documentId, clauseId, {
          note,
          is_flagged: currentlyFlagged, // Preserve existing flag status
        });

        // Update local state
        setUserNotes((prev) => ({
          ...prev,
          [clauseId]: note,
        }));

        toast.success("Note updated successfully");
      } catch (error) {
        console.error("Failed to update note:", error);
        toast.error("Failed to update note");
        throw error;
      }
    },
    [documentId, flaggedClauses]
  );

  // Delete a note
  const deleteNote = useCallback(
    async (clauseId: string) => {
      if (!documentId) return;

      try {
        const currentlyFlagged = flaggedClauses.has(clauseId);

        if (currentlyFlagged) {
          // If clause is flagged, just remove the note but keep the flag
          await userInteractionService.saveUserInteraction(
            documentId,
            clauseId,
            {
              note: undefined,
              is_flagged: true,
            }
          );
        } else {
          // If not flagged, delete the entire interaction
          await userInteractionService.deleteUserInteraction(
            documentId,
            clauseId
          );
        }

        // Update local state
        setUserNotes((prev) => {
          const updated = { ...prev };
          delete updated[clauseId];
          return updated;
        });

        toast.success("Note deleted successfully");
      } catch (error) {
        console.error("Failed to delete note:", error);
        toast.error("Failed to delete note");
        throw error;
      }
    },
    [documentId, flaggedClauses]
  );

  // Toggle flag status
  const toggleFlag = useCallback(
    async (clauseId: string) => {
      if (!documentId) return;

      const wasAlreadyFlagged = flaggedClauses.has(clauseId);
      const newFlagStatus = !wasAlreadyFlagged;

      try {
        const currentNote = userNotes[clauseId];

        if (!newFlagStatus && !currentNote) {
          // If unflagging and no note, delete the entire interaction
          await userInteractionService.deleteUserInteraction(
            documentId,
            clauseId
          );
        } else {
          // Save interaction with new flag status
          await userInteractionService.saveUserInteraction(
            documentId,
            clauseId,
            {
              note: currentNote,
              is_flagged: newFlagStatus,
            }
          );
        }

        // Update local state
        setFlaggedClauses((prev) => {
          const newSet = new Set(prev);
          if (newFlagStatus) {
            newSet.add(clauseId);
          } else {
            newSet.delete(clauseId);
          }
          return newSet;
        });

        toast.success(
          newFlagStatus ? "Clause flagged for review" : "Clause unflagged"
        );
      } catch (error) {
        console.error("Failed to toggle flag:", error);
        toast.error("Failed to update flag status");
        throw error;
      }
    },
    [documentId, flaggedClauses, userNotes]
  );

  // Load interactions when document changes
  useEffect(() => {
    if (documentId) {
      loadInteractions();
    } else {
      // Clear state when no document
      setUserNotes({});
      setFlaggedClauses(new Set());
    }
  }, [documentId, loadInteractions]);

  return {
    userNotes,
    flaggedClauses,
    isLoading,
    addNote,
    editNote,
    deleteNote,
    toggleFlag,
    loadInteractions,
  };
}
