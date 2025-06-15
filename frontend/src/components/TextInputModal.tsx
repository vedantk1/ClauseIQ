"use client";
import React, { useState, useEffect, useRef } from "react";
import Button from "./Button";

interface TextInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (text: string) => void;
  title: string;
  placeholder?: string;
  initialValue?: string;
  submitButtonText?: string;
  cancelButtonText?: string;
}

export default function TextInputModal({
  isOpen,
  onClose,
  onSubmit,
  title,
  placeholder = "Enter text...",
  initialValue = "",
  submitButtonText = "Submit",
  cancelButtonText = "Cancel",
}: TextInputModalProps) {
  const [text, setText] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset text when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setText(initialValue);
      // Focus input after modal animation
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, initialValue]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  const handleSubmit = () => {
    if (text.trim()) {
      onSubmit(text.trim());
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && text.trim()) {
      handleSubmit();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-bg-surface border border-border-muted rounded-lg shadow-2xl w-full max-w-md mx-4 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border-muted">
          <h3 className="font-medium text-text-primary text-lg">{title}</h3>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full px-3 py-2 text-sm bg-bg-elevated border border-border-muted rounded-md text-text-primary placeholder-text-secondary focus:ring-2 focus:ring-accent-purple focus:border-transparent transition-all duration-200"
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border-muted flex justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={onClose}>
            {cancelButtonText}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={!text.trim()}
          >
            {submitButtonText}
          </Button>
        </div>
      </div>
    </div>
  );
}
