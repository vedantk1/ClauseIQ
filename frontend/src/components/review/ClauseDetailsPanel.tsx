"use client";
import React, { useState } from "react";
import Card from "@/components/Card";
import Button from "@/components/Button";
import TextInputModal from "@/components/TextInputModal";
import ConfirmationModal from "@/components/ConfirmationModal";
import { getRiskColor, getClauseTypeLabel } from "./clauseUtils";
import type { Clause } from "@clauseiq/shared-types";

interface Note {
  id: string;
  text: string;
  created_at?: string;
}

interface ClauseDetailsPanelProps {
  selectedClause: Clause | null;
  flaggedClauses: Set<string>;
  hasNotes: (clauseId: string) => boolean;
  getAllNotes: (clauseId: string) => Note[];
  getNotesCount: (clauseId: string) => number;
  onAddNote: (clause: Clause, noteText?: string) => void;
  onEditNote: (clause: Clause, noteId?: string, editedText?: string) => void;
  onDeleteNote: (clause: Clause, noteId?: string) => void;
  onFlagForReview: (clause: Clause, event?: React.MouseEvent) => void;
  onBack?: () => void; // Optional back navigation function
}

export default function ClauseDetailsPanel({
  selectedClause,
  flaggedClauses,
  hasNotes,
  getAllNotes,
  getNotesCount,
  onAddNote,
  onEditNote,
  onDeleteNote,
  onFlagForReview,
  onBack,
}: ClauseDetailsPanelProps) {
  // New state for notes drawer - keyed by clause ID to preserve context
  const [notesDrawerState, setNotesDrawerState] = useState<
    Record<string, boolean>
  >({});

  // State for custom note input modal
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  // State for delete confirmation modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<{
    clauseId: string;
    noteId: string;
  } | null>(null);

  // Helper to get/set drawer state for current clause
  const isNotesDrawerOpen = selectedClause?.id
    ? notesDrawerState[selectedClause.id] || false
    : false;
  const toggleNotesDrawer = () => {
    if (selectedClause?.id) {
      setNotesDrawerState((prev) => ({
        ...prev,
        [selectedClause.id!]: !prev[selectedClause.id!],
      }));
    }
  };

  // Custom note addition handler
  const handleAddNote = () => {
    setEditingNote(null); // Clear any editing state
    setIsNoteModalOpen(true);
  };

  // Custom note editing handler
  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    setIsNoteModalOpen(true);
  };

  // Custom delete confirmation handler
  const handleDeleteNote = (noteId: string) => {
    if (selectedClause?.id) {
      setNoteToDelete({ clauseId: selectedClause.id, noteId });
      setIsDeleteModalOpen(true);
    }
  };

  const confirmDeleteNote = () => {
    if (noteToDelete && selectedClause) {
      onDeleteNote(selectedClause, noteToDelete.noteId);
    }
    setIsDeleteModalOpen(false);
    setNoteToDelete(null);
  };

  const handleNoteSubmit = (noteText: string) => {
    if (selectedClause && noteText.trim()) {
      if (editingNote) {
        // Edit mode: pass the edited text to parent
        onEditNote(selectedClause, editingNote.id, noteText.trim());
      } else {
        // Add mode: pass the note text directly to the parent component
        onAddNote(selectedClause, noteText.trim());
      }
    }
    // Close modal and clear editing state
    setIsNoteModalOpen(false);
    setEditingNote(null);
  };

  // Key terms + highlighting removed per design decision (UI-only removal).

  // Risk-based left border removed for cleaner look.

  const cardSection =
    "rounded-lg border border-border-muted bg-bg-elevated p-4";

  // Clause Insights (fairness, negotiability, etc.) removed as they were hardcoded placeholders.

  if (!selectedClause) {
    return (
      <Card>
        <h2 className="font-heading text-heading-sm text-text-primary mb-4">
          Clause Details
        </h2>
        <div className="text-center py-12">
          <svg
            className="w-12 h-12 text-text-secondary mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-text-secondary">
            Select a clause to view detailed analysis
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      {/* Back Button + Title */}
      {onBack ? (
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={onBack}
            className="p-1 rounded-md hover:bg-bg-elevated transition-colors focus:outline-none focus:ring-2 focus:ring-accent-purple focus:ring-offset-2"
            aria-label="Back to clauses"
          >
            <svg
              className="w-4 h-4 text-text-secondary hover:text-accent-purple transition-colors"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h2 className="font-heading text-heading-sm text-text-primary">
            Clause Details
          </h2>
        </div>
      ) : (
        <h2 className="font-heading text-heading-sm text-text-primary mb-4">
          Clause Details
        </h2>
      )}

      <div className="space-y-5 pb-6">
        {/* bottom padding to not hide content behind sticky bar */}

        {/* Clause Header */}
        <div>
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <h3 className="font-medium text-text-primary">
                {selectedClause.heading ||
                  `${getClauseTypeLabel(selectedClause.clause_type)} Clause`}
              </h3>
            </div>
            <div
              className={`px-3 py-1 rounded-full text-sm font-medium border ${getRiskColor(
                selectedClause.risk_level
              )}`}
            >
              {selectedClause.risk_level
                ? selectedClause.risk_level.charAt(0).toUpperCase() +
                  selectedClause.risk_level.slice(1)
                : "Unknown"}{" "}
              Risk
            </div>
          </div>
          {/* Meta chips */}
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-text-secondary bg-bg-elevated px-2 py-1 rounded">
                {getClauseTypeLabel(selectedClause.clause_type)}
              </span>
              {typeof selectedClause.position_start === "number" && (
                <span
                  title="Clause position in document"
                  className="text-xs text-text-secondary bg-bg-elevated px-2 py-1 rounded border border-border-muted"
                >
                  Pos {selectedClause.position_start}
                  {typeof selectedClause.position_end === "number" &&
                    selectedClause.position_end !==
                      selectedClause.position_start && (
                      <>–{selectedClause.position_end}</>
                    )}
                </span>
              )}
            </div>
            {/* Status indicators moved to the right */}
            <div className="flex items-center gap-2">
              {selectedClause.id && flaggedClauses.has(selectedClause.id) && (
                <span className="text-xs bg-accent-rose/10 text-accent-rose px-2 py-1 rounded-full">
                  🚩 Flagged for Review
                </span>
              )}
              {selectedClause.id && hasNotes(selectedClause.id) && (
                <button
                  onClick={toggleNotesDrawer}
                  className="text-xs bg-accent-blue/10 text-accent-blue px-2 py-1 rounded-full border border-accent-blue/20 hover:bg-accent-blue/15 transition-colors cursor-pointer"
                  title="Click to view/edit notes"
                  aria-expanded={isNotesDrawerOpen}
                  aria-label={`${getNotesCount(selectedClause.id)} note${
                    getNotesCount(selectedClause.id) !== 1 ? "s" : ""
                  }, click to ${isNotesDrawerOpen ? "close" : "open"}`}
                >
                  📝 Has {getNotesCount(selectedClause.id)} Note
                  {getNotesCount(selectedClause.id) !== 1 ? "s" : ""}{" "}
                  {isNotesDrawerOpen ? "▲" : "▼"}
                </button>
              )}
            </div>
          </div>
          {/* Inline Actions (moved from sticky bar) */}
          <div className="flex items-center gap-2 mt-2">
            <Button size="sm" variant="secondary" onClick={handleAddNote}>
              Add Note
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={(event) => onFlagForReview(selectedClause, event)}
              title={
                flaggedClauses.has(selectedClause.id || "")
                  ? "Remove flag from this clause"
                  : "Flag this clause for legal review"
              }
            >
              {flaggedClauses.has(selectedClause.id || "") ? "Unflag" : "Flag"}
            </Button>
          </div>
        </div>

        {/* Notes Drawer - Only render when actually open */}
        {selectedClause.id &&
          hasNotes(selectedClause.id) &&
          isNotesDrawerOpen && (
            <div className="mb-4 animate-in slide-in-from-top-2 duration-200">
              <div className="bg-accent-blue/5 border border-accent-blue/20 rounded-lg p-4">
                {/* Notes Header with Add Button */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-accent-blue">
                      Notes
                    </span>
                    <button
                      onClick={handleAddNote}
                      className="flex items-center justify-center w-6 h-6 text-accent-blue hover:bg-accent-blue/10 rounded-full transition-colors"
                      title="Add note"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Notes List */}
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {getAllNotes(selectedClause.id).length > 0 ? (
                    getAllNotes(selectedClause.id)
                      .filter((note) => note && note.id && note.text)
                      .map((note) => {
                        if (!note || !note.id || !note.text) {
                          return null;
                        }

                        // Format date - relative if today, absolute otherwise
                        const noteDate = note.created_at
                          ? new Date(note.created_at)
                          : new Date();
                        const now = new Date();
                        const isToday =
                          noteDate.toDateString() === now.toDateString();
                        const formattedDate = isToday
                          ? `Today ${noteDate.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}`
                          : `${noteDate.toLocaleDateString()} ${noteDate.toLocaleTimeString(
                              [],
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}`;

                        return (
                          <div
                            key={note.id}
                            className="border border-border-muted rounded-lg p-2.5 bg-bg-elevated hover:shadow-sm transition-shadow group"
                          >
                            <div className="flex items-start justify-between mb-0.5">
                              <span className="text-xs text-text-secondary">
                                {formattedDate}
                              </span>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => handleEditNote(note)}
                                  className="p-1 hover:bg-accent-blue/10 rounded text-accent-blue transition-colors"
                                  title="Edit note"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => handleDeleteNote(note.id)}
                                  className="p-1 hover:bg-accent-rose/10 rounded text-accent-rose transition-colors"
                                  title="Delete note"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                            <div className="text-sm text-text-primary leading-relaxed">
                              {/* Truncate long notes to 3 lines */}
                              <div className="line-clamp-3">{note.text}</div>
                            </div>
                          </div>
                        );
                      })
                      .filter(Boolean)
                  ) : (
                    <div className="text-center py-6">
                      <div className="text-accent-blue text-2xl mb-2">✔️</div>
                      <p className="text-sm text-text-secondary mb-2">
                        No notes yet
                      </p>
                      <Button
                        size="sm"
                        variant="tertiary"
                        onClick={handleAddNote}
                        className="text-accent-blue hover:bg-accent-blue/10"
                      >
                        Add your first note
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        {/* Risk Assessment */}
        {selectedClause.risk_assessment && (
          <div className={cardSection}>
            <h4 className="font-medium text-text-primary mb-2 text-sm tracking-wide uppercase">
              Risk Assessment
            </h4>
            <p className="text-text-secondary text-sm leading-relaxed">
              {selectedClause.risk_assessment}
            </p>
          </div>
        )}

        {/* LLM Risk Reasoning */}
        {selectedClause.risk_reasoning && (
          <div className={cardSection}>
            <h4 className="font-medium text-text-primary mb-2 text-sm tracking-wide uppercase">
              Risk Reasoning
            </h4>
            <p className="text-text-secondary text-sm leading-relaxed whitespace-pre-line">
              {selectedClause.risk_reasoning}
            </p>
          </div>
        )}

        {/* Key Terms section removed */}

        {/* Relationships */}
        {selectedClause.relationships &&
          selectedClause.relationships.length > 0 && (
            <div className={cardSection}>
              <h4 className="font-medium text-text-primary mb-2 text-sm tracking-wide uppercase">
                Clause Relationships
              </h4>
              <ul className="space-y-1">
                {selectedClause.relationships.map(
                  (rel: string, idx: number) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-sm text-text-secondary"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-blue mt-2 flex-shrink-0"></span>
                      {rel}
                    </li>
                  )
                )}
              </ul>
            </div>
          )}

        {/* Key Points */}
        {selectedClause.key_points && selectedClause.key_points.length > 0 && (
          <div className={cardSection}>
            <h4 className="font-medium text-text-primary mb-2 text-sm tracking-wide uppercase">
              Key Points
            </h4>
            <ul className="space-y-1">
              {selectedClause.key_points.map((point: string, index: number) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-sm text-text-secondary"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-purple mt-2 flex-shrink-0"></span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendations */}
        {selectedClause.recommendations &&
          selectedClause.recommendations.length > 0 && (
            <div className={cardSection}>
              <h4 className="font-medium text-text-primary mb-2 text-sm tracking-wide uppercase">
                Recommendations
              </h4>
              <ul className="space-y-2">
                {selectedClause.recommendations.map(
                  (rec: string, index: number) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <span className="w-5 h-5 rounded-full bg-accent-green/20 text-accent-green flex items-center justify-center text-xs font-medium mt-0.5 flex-shrink-0">
                        ✓
                      </span>
                      <span className="text-text-secondary">{rec}</span>
                    </li>
                  )
                )}
              </ul>
            </div>
          )}

        {/* Industry Benchmark section removed (was placeholder/fabricated) */}

        {/* Clause Insights removed */}

        {/* Full Clause Text */}
        <div className={cardSection}>
          <div className="mb-2">
            <h4 className="font-medium text-text-primary text-sm tracking-wide uppercase mb-0">
              Full Text
            </h4>
          </div>
          <div className="rounded p-3 bg-bg-primary/40 max-h-56 overflow-y-auto text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
            {selectedClause.text}
          </div>
        </div>
      </div>

      {/* Former sticky action bar removed; actions now inline under header */}

      {/* Custom Note Input Modal */}
      <TextInputModal
        isOpen={isNoteModalOpen}
        onClose={() => {
          setIsNoteModalOpen(false);
          setEditingNote(null);
        }}
        onSubmit={handleNoteSubmit}
        title={editingNote ? "Edit note" : "Add a note for this clause"}
        placeholder={editingNote ? "Edit your note..." : "Enter your note..."}
        submitButtonText={editingNote ? "Save Changes" : "Add Note"}
        cancelButtonText="Cancel"
        initialValue={editingNote?.text || ""}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setNoteToDelete(null);
        }}
        onConfirm={confirmDeleteNote}
        title="Delete note?"
        message="Are you sure you want to delete this note? This action cannot be undone."
        confirmButtonText="Delete"
        cancelButtonText="Cancel"
        variant="danger"
      />
    </Card>
  );
}
