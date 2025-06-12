// Custom hook for managing user interactions (notes and flags)
import { useState, useEffect, useCallback } from "react";
import {
  userInteractionService,
  UserInteraction,
  Note,
} from "@/services/userInteraction";
import toast from "react-hot-toast";

export interface UseUserInteractionsResult {
  userNotes: Record<string, Note[]>; // Changed to array of notes
  flaggedClauses: Set<string>;
  isLoading: boolean;
  addNote: (clauseId: string, note: string) => Promise<void>;
  editNote: (clauseId: string, noteId: string, note: string) => Promise<void>;
  deleteNote: (clauseId: string, noteId: string) => Promise<void>;
  toggleFlag: (clauseId: string) => Promise<void>;
  loadInteractions: () => Promise<void>;
  // Backward compatibility helpers
  getFirstNote: (clauseId: string) => string | undefined;
  hasNotes: (clauseId: string) => boolean;
  // New helper functions for multiple notes
  getAllNotes: (clauseId: string) => Note[];
  getNotesCount: (clauseId: string) => number;
}

export function useUserInteractions(
  documentId: string | null
): UseUserInteractionsResult {
  const [userNotes, setUserNotes] = useState<Record<string, Note[]>>({});
  const [flaggedClauses, setFlaggedClauses] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  // Convert API response to local state format
  const processInteractions = useCallback(
    (interactions: Record<string, UserInteraction>) => {
      const notes: Record<string, Note[]> = {};
      const flags = new Set<string>();

      Object.entries(interactions).forEach(([clauseId, interaction]) => {
        // Handle both new format (notes array) and old format (single note) for backward compatibility
        if (interaction.notes && Array.isArray(interaction.notes)) {
          if (interaction.notes.length > 0) {
            notes[clauseId] = interaction.notes;
          }
        } else if (
          "note" in interaction &&
          (interaction as UserInteraction & { note: string }).note
        ) {
          // Backward compatibility: convert single note to array
          const singleNote: Note = {
            id: `legacy-${Date.now()}`,
            text: (interaction as UserInteraction & { note: string }).note,
            created_at: interaction.created_at,
          };
          notes[clauseId] = [singleNote];
        }

        if (interaction.is_flagged) {
          flags.add(clauseId);
        }
      });

      setUserNotes(notes);
      setFlaggedClauses(flags);

      // Clean up any corrupted state - remove undefined values
      console.log("🧹 [DEBUG] Cleaning up corrupted state...");
      setUserNotes((prev) => {
        const cleaned: Record<string, Note[]> = {};
        let foundCorruption = false;

        Object.entries(prev).forEach(([clauseId, notesList]) => {
          if (notesList && Array.isArray(notesList)) {
            const validNotes = notesList.filter((note) => {
              const isValid = note && note.id && note.text;
              if (!isValid) {
                console.log("🧹 [DEBUG] Removing corrupted note:", note);
                foundCorruption = true;
              }
              return isValid;
            });

            if (validNotes.length > 0) {
              cleaned[clauseId] = validNotes;
            }
          }
        });

        if (foundCorruption) {
          console.log(
            "🧹 [DEBUG] Cleaned up corrupted state, before:",
            prev,
            "after:",
            cleaned
          );
        }

        return foundCorruption ? cleaned : prev;
      });
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
        const newNote = await userInteractionService.addNote(
          documentId,
          clauseId,
          note
        );

        // Update local state
        setUserNotes((prev) => ({
          ...prev,
          [clauseId]: [...(prev[clauseId] || []), newNote],
        }));

        toast.success("Note added successfully");
      } catch (error) {
        console.error("Failed to add note:", error);
        toast.error("Failed to add note");
        throw error;
      }
    },
    [documentId]
  );

  // Edit a note
  const editNote = useCallback(
    async (clauseId: string, noteId: string, note: string) => {
      if (!documentId) return;

      console.log("✏️ [DEBUG] editNote called:", {
        clauseId,
        noteId,
        note,
        documentId,
      });

      try {
        const updatedNote = await userInteractionService.updateNote(
          documentId,
          clauseId,
          noteId,
          note
        );

        console.log("✏️ [DEBUG] Received updated note from API:", updatedNote);
        console.log("✏️ [DEBUG] Updated note structure:", {
          hasId: !!updatedNote?.id,
          hasText: !!updatedNote?.text,
          hasCreatedAt: !!updatedNote?.created_at,
          noteId: updatedNote?.id,
          noteText: updatedNote?.text,
          fullObject: updatedNote,
        });

        // Check if API returned a valid note
        if (!updatedNote || !updatedNote.id) {
          console.error("✏️ [ERROR] API returned invalid note:", updatedNote);
          toast.error("Failed to update note - invalid response from server");
          return;
        }

        // Update local state using functional update to avoid stale closure
        setUserNotes((prev) => {
          const currentNotes = prev[clauseId] || [];
          console.log("✏️ [DEBUG] Current notes before update:", currentNotes);
          console.log("✏️ [DEBUG] Attempting to update note with ID:", noteId);

          const newNotes = { ...prev };
          if (newNotes[clauseId]) {
            const beforeMap = newNotes[clauseId];
            console.log("✏️ [DEBUG] Notes before map:", beforeMap);

            // Filter out any invalid notes and update the target note
            newNotes[clauseId] = newNotes[clauseId]
              .filter((n) => n && n.id) // Remove any invalid notes
              .map((n) => {
                const isMatch = n.id === noteId;
                console.log("✏️ [DEBUG] Note map check:", {
                  noteId: n?.id,
                  targetNoteId: noteId,
                  isMatch,
                  originalNote: n,
                  updatedNote: isMatch ? updatedNote : n,
                  willReplace: isMatch,
                });
                // Only replace if we have a valid updated note, otherwise keep the original
                return isMatch && updatedNote && updatedNote.id
                  ? updatedNote
                  : n;
              })
              .filter((n) => n && n.id); // Filter again after mapping to remove any undefined notes

            console.log("✏️ [DEBUG] Notes after map:", newNotes[clauseId]);
            console.log(
              "✏️ [DEBUG] Final notes length:",
              newNotes[clauseId].length
            );
          } else {
            console.log(
              "✏️ [DEBUG] ERROR: No notes array found for clauseId:",
              clauseId
            );
          }
          return newNotes;
        });

        toast.success("Note updated successfully");
      } catch (error) {
        console.error("Failed to update note:", error);
        toast.error("Failed to update note");
        throw error;
      }
    },
    [documentId]
  );

  // Delete a note
  const deleteNote = useCallback(
    async (clauseId: string, noteId: string) => {
      if (!documentId) return;

      // Guard against undefined or empty noteId
      if (!noteId || noteId === "undefined" || noteId === "null") {
        console.error("🗑️ [ERROR] Invalid noteId provided:", noteId);
        toast.error("Cannot delete note - invalid note ID");
        return;
      }

      console.log("🗑️ [DEBUG] deleteNote called:", {
        clauseId,
        noteId,
        noteIdType: typeof noteId,
        documentId,
      });

      try {
        await userInteractionService.deleteNote(documentId, clauseId, noteId);

        // Update local state using functional update to avoid stale closure
        setUserNotes((prev) => {
          const currentNotes = prev[clauseId] || [];
          console.log(
            "🗑️ [DEBUG] Current notes before deletion:",
            currentNotes
          );
          console.log("🗑️ [DEBUG] Attempting to delete note with ID:", noteId);

          const newNotes = { ...prev };
          if (newNotes[clauseId]) {
            const beforeFilter = newNotes[clauseId];
            console.log("🗑️ [DEBUG] Notes before filter:", beforeFilter);

            newNotes[clauseId] = newNotes[clauseId].filter((n) => {
              // Convert both IDs to strings for safe comparison
              const noteIdStr = String(n?.id || "");
              const targetNoteIdStr = String(noteId || "");
              const shouldKeep = n && n.id && noteIdStr !== targetNoteIdStr;

              console.log("🗑️ [DEBUG] Note filter check:", {
                noteId: n?.id,
                noteIdType: typeof n?.id,
                noteIdStr,
                targetNoteId: noteId,
                targetNoteIdType: typeof noteId,
                targetNoteIdStr,
                shouldKeep,
                strictComparison: n?.id === noteId,
                stringComparison: noteIdStr === targetNoteIdStr,
              });
              return shouldKeep;
            });

            console.log("🗑️ [DEBUG] Notes after filter:", newNotes[clauseId]);

            if (newNotes[clauseId].length === 0) {
              console.log("🗑️ [DEBUG] No notes left, deleting clause entry");
              delete newNotes[clauseId];
            }
          }
          return newNotes;
        });

        toast.success("Note deleted successfully");
      } catch (error) {
        console.error("Failed to delete note:", error);
        toast.error("Failed to delete note");
        throw error;
      }
    },
    [documentId]
  );

  // Toggle flag status
  const toggleFlag = useCallback(
    async (clauseId: string) => {
      if (!documentId) return;

      const wasAlreadyFlagged = flaggedClauses.has(clauseId);
      const newFlagStatus = !wasAlreadyFlagged;

      try {
        // Use functional update to get current notes
        let currentNotes: Note[] = [];
        setUserNotes((prev) => {
          currentNotes = prev[clauseId] || [];
          return prev; // No change, just getting current value
        });

        if (!newFlagStatus && (!currentNotes || currentNotes.length === 0)) {
          // If unflagging and no notes, delete the entire interaction
          await userInteractionService.deleteUserInteraction(
            documentId,
            clauseId
          );
        } else {
          // Save interaction with new flag status (backward compatibility with old API)
          const firstNote =
            currentNotes && currentNotes.length > 0
              ? currentNotes[0].text
              : undefined;
          await userInteractionService.saveUserInteraction(
            documentId,
            clauseId,
            {
              note: firstNote,
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
    [documentId, flaggedClauses]
  );

  // Helper functions for backward compatibility
  const getFirstNote = useCallback(
    (clauseId: string): string | undefined => {
      const notes = userNotes[clauseId];
      return notes && notes.length > 0 ? notes[0].text : undefined;
    },
    [userNotes]
  );

  const hasNotes = useCallback(
    (clauseId: string): boolean => {
      const notes = userNotes[clauseId];
      return notes ? notes.length > 0 : false;
    },
    [userNotes]
  );

  // New helper functions for multiple notes
  const getAllNotes = useCallback(
    (clauseId: string): Note[] => {
      return userNotes[clauseId] || [];
    },
    [userNotes]
  );

  const getNotesCount = useCallback(
    (clauseId: string): number => {
      const notes = userNotes[clauseId];
      return notes ? notes.length : 0;
    },
    [userNotes]
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
    getFirstNote,
    hasNotes,
    getAllNotes,
    getNotesCount,
  };
}
