/**
 * Dropdown component with proper positioning and keyboard navigation
 */
"use client";

import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Check } from "lucide-react";

export interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export interface DropdownProps {
  options: DropdownOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  className?: string;
  label?: string;
  helperText?: string;
  searchable?: boolean;
}

const Dropdown: React.FC<DropdownProps> = ({
  options,
  value,
  onChange,
  placeholder = "Select an option",
  disabled = false,
  error = false,
  className,
  label,
  helperText,
  searchable = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((option) => option.value === value);

  // Filter options based on search term
  const filteredOptions = searchable
    ? options.filter((option) =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm("");
        setFocusedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;

    switch (event.key) {
      case "Enter":
      case " ":
        if (!isOpen) {
          setIsOpen(true);
        } else if (focusedIndex >= 0 && filteredOptions[focusedIndex]) {
          handleSelect(filteredOptions[focusedIndex].value);
        }
        event.preventDefault();
        break;
      case "Escape":
        setIsOpen(false);
        setSearchTerm("");
        setFocusedIndex(-1);
        break;
      case "ArrowDown":
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setFocusedIndex((prev) =>
            prev < filteredOptions.length - 1 ? prev + 1 : 0
          );
        }
        event.preventDefault();
        break;
      case "ArrowUp":
        if (isOpen) {
          setFocusedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredOptions.length - 1
          );
        }
        event.preventDefault();
        break;
    }
  };

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm("");
    setFocusedIndex(-1);
  };

  const baseStyles =
    "relative flex items-center justify-between w-full h-10 px-3 py-2 text-left bg-bg-surface border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-purple disabled:cursor-not-allowed disabled:opacity-50";

  const errorStyles = error
    ? "border-status-error focus:ring-status-error"
    : "border-border-muted";

  return (
    <div className={cn("relative w-full", className)} ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium text-text-primary mb-1">
          {label}
        </label>
      )}

      <button
        type="button"
        className={cn(baseStyles, errorStyles)}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span
          className={cn(
            selectedOption ? "text-text-primary" : "text-text-secondary"
          )}
        >
          {selectedOption ? (
            <span className="flex items-center gap-2">
              {selectedOption.icon}
              {selectedOption.label}
            </span>
          ) : (
            placeholder
          )}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-text-secondary transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-bg-surface border border-border-muted rounded-md shadow-lg max-h-60 overflow-auto">
          {searchable && (
            <div className="p-2">
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="w-full px-3 py-2 text-sm bg-surface-secondary border border-border-muted rounded-md focus:outline-none focus:ring-2 focus:ring-accent-purple"
              />
            </div>
          )}

          <div role="listbox">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-text-secondary">
                No options found
              </div>
            ) : (
              filteredOptions.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    "flex items-center justify-between w-full px-3 py-2 text-left text-sm transition-colors hover:bg-surface-secondary focus:bg-surface-secondary focus:outline-none",
                    option.disabled && "opacity-50 cursor-not-allowed",
                    focusedIndex === index && "bg-surface-secondary",
                    value === option.value && "bg-accent-purple/10"
                  )}
                  onClick={() => !option.disabled && handleSelect(option.value)}
                  disabled={option.disabled}
                  role="option"
                  aria-selected={value === option.value}
                >
                  <span className="flex items-center gap-2">
                    {option.icon}
                    {option.label}
                  </span>
                  {value === option.value && (
                    <Check className="h-4 w-4 text-accent-purple" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {helperText && (
        <p
          className={cn(
            "mt-1 text-sm",
            error ? "text-status-error" : "text-text-secondary"
          )}
        >
          {helperText}
        </p>
      )}
    </div>
  );
};

export { Dropdown };
export default Dropdown;
