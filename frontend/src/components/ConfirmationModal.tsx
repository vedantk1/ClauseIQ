"use client";
import React, { useEffect } from "react";
import Button from "./Button";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
  variant?: "danger" | "primary";
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmButtonText = "Confirm",
  cancelButtonText = "Cancel",
  variant = "primary",
}: ConfirmationModalProps) {
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

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-bg-primary border border-border-subtle rounded-xl shadow-2xl max-w-md w-full animate-in fade-in-0 zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <h2 className="text-lg font-semibold text-text-primary mb-2">
            {title}
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            {message}
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3 justify-end">
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            className="min-w-[80px]"
          >
            {cancelButtonText}
          </Button>
          <Button
            variant={variant === "danger" ? "danger" : "primary"}
            size="sm"
            onClick={handleConfirm}
            className="min-w-[80px]"
          >
            {confirmButtonText}
          </Button>
        </div>
      </div>
    </div>
  );
}
