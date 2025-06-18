/**
 * Custom hook for managing keyboard shortcuts
 * Extracted from documents page to separate keyboard interaction concerns
 */

import { useEffect } from "react";

interface UseKeyboardShortcutsProps {
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  isSelectMode: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  setIsSelectMode: (mode: boolean) => void;
  setSelectedDocuments: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectAllDocuments: () => void;
}

export const useKeyboardShortcuts = ({
  searchInputRef,
  isSelectMode,
  searchQuery,
  setSearchQuery,
  setIsSelectMode,
  setSelectedDocuments,
  selectAllDocuments,
}: UseKeyboardShortcutsProps) => {
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
  }, [
    isSelectMode,
    searchQuery,
    selectAllDocuments,
    searchInputRef,
    setSearchQuery,
    setIsSelectMode,
    setSelectedDocuments,
  ]);
};
