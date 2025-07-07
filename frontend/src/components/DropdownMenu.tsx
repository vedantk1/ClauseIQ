"use client";
import React, { useState, useRef, useEffect } from "react";
import clsx from "clsx";

interface DropdownMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "danger";
}

interface DropdownMenuProps {
  trigger: React.ReactNode;
  items: DropdownMenuItem[];
  align?: "left" | "right";
  className?: string;
  triggerClassName?: string;
  triggerVariant?: "default" | "ghost" | "outline";
}

export default function DropdownMenu({
  trigger,
  items,
  align = "right",
  className,
  triggerClassName,
  triggerVariant = "default",
}: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const handleItemClick = (item: DropdownMenuItem) => {
    if (!item.disabled) {
      item.onClick();
      setIsOpen(false);
    }
  };

  const handleKeyDown = (
    event: React.KeyboardEvent,
    item: DropdownMenuItem
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleItemClick(item);
    }
  };

  const getTriggerClasses = () => {
    const baseClasses = "px-4 py-2 rounded-md transition-colors border";

    const variantClasses = {
      default:
        "bg-bg-surface text-text-primary hover:bg-bg-elevated border-border-muted",
      ghost: "hover:bg-bg-elevated border-transparent",
      outline: "hover:bg-bg-elevated border-border-muted",
    };

    return clsx(baseClasses, variantClasses[triggerVariant], triggerClassName);
  };

  return (
    <div className={clsx("relative", className)}>
      {/* Trigger */}
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className={getTriggerClasses()}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="More actions"
      >
        {trigger}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className={clsx(
            "absolute top-full mt-1 w-48 bg-bg-surface border border-border-muted rounded-md shadow-lg z-50",
            align === "right" ? "right-0" : "left-0"
          )}
          role="menu"
          aria-orientation="vertical"
        >
          <div className="py-1">
            {items.map((item, index) => (
              <button
                key={index}
                onClick={() => handleItemClick(item)}
                onKeyDown={(e) => handleKeyDown(e, item)}
                disabled={item.disabled}
                className={clsx(
                  "w-full px-4 py-2 text-left text-sm flex items-center gap-3 transition-colors",
                  "hover:bg-bg-elevated focus:bg-bg-elevated focus:outline-none",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  item.variant === "danger"
                    ? "text-red-600 hover:text-red-700"
                    : "text-text-primary"
                )}
                role="menuitem"
                tabIndex={0}
              >
                {item.icon && (
                  <span className="flex-shrink-0">{item.icon}</span>
                )}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
