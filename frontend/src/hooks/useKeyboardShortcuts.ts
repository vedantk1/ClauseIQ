/**
 * Custom hook for managing keyboard shortcuts
 * Extracted from documents page to separate keyboard interaction concerns
 */

import { useEffect } from "react";

interface UseKeyboardShortcutsProps {
  enabled?: boolean;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  isSelectMode: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  setIsSelectMode: (mode: boolean) => void;
  setSelectedDocuments: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectAllDocuments: () => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable
  );
}

export const useKeyboardShortcuts = ({
  enabled = true,
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
      if (!enabled) return;
      // Preserve native text/field shortcuts, including contenteditable descendants.
      const editing = isEditableTarget(event.target) || isEditableTarget(document.activeElement);
      // Focus search when pressing '/'
      if (
        event.key === "/" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        if (!editing) {
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
        isSelectMode &&
        !editing
      ) {
        event.preventDefault();
        selectAllDocuments();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    enabled,
    isSelectMode,
    searchQuery,
    selectAllDocuments,
    searchInputRef,
    setSearchQuery,
    setIsSelectMode,
    setSelectedDocuments,
  ]);
};
