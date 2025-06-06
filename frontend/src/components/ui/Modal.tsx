/**
 * Modal component with overlay and focus management
 */
"use client";

import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";
import { X } from "lucide-react";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  closeOnOverlayClick?: boolean;
  closeOnEscapeKey?: boolean;
  showCloseButton?: boolean;
  className?: string;
  footer?: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  title,
  size = "md",
  closeOnOverlayClick = true,
  closeOnEscapeKey = true,
  showCloseButton = true,
  className,
  footer,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (closeOnEscapeKey && event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscapeKey);
      // Prevent body scroll
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscapeKey);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose, closeOnEscapeKey]);

  // Handle overlay click
  const handleOverlayClick = (event: React.MouseEvent) => {
    if (closeOnOverlayClick && event.target === overlayRef.current) {
      onClose();
    }
  };

  // Focus management
  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    full: "max-w-full mx-4",
  };

  const modalContent = (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={handleOverlayClick}
      data-testid="modal-backdrop"
    >
      <div
        ref={modalRef}
        className={cn(
          "relative w-full bg-bg-surface rounded-lg border border-border-muted shadow-lg focus:outline-none",
          sizeClasses[size],
          className
        )}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
      >
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-6 border-b border-border-muted">
            {title && (
              <h2
                id="modal-title"
                className="text-lg font-semibold text-text-primary"
              >
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-1 text-text-secondary hover:text-text-primary transition-colors rounded-md hover:bg-surface-secondary"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
        <div className={cn("p-6", (title || showCloseButton) && "pt-0")}>
          {children}
        </div>
        {footer && (
          <div className="flex items-center justify-end gap-3 p-6 border-t border-border-muted">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  // Render modal in portal
  return createPortal(modalContent, document.body);
};

export { Modal };
export default Modal;
