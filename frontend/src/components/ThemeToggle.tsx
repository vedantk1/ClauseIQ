/**
 * Theme toggle component with smooth animation
 */
"use client";

import React from "react";
import { useTheme } from "../hooks/useTheme";
import Button from "./Button";

interface ThemeToggleProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export default function ThemeToggle({
  className = "",
  size = "md",
  showLabel = false,
}: ThemeToggleProps) {
  const { toggleTheme, isDark, isLight } = useTheme();

  const sizeClasses = {
    sm: "w-8 h-8 text-sm",
    md: "w-10 h-10 text-base",
    lg: "w-12 h-12 text-lg",
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showLabel && (
        <span className="text-sm text-text-secondary">
          {isDark ? "Dark" : "Light"}
        </span>
      )}
      <Button
        onClick={toggleTheme}
        variant="ghost"
        size="sm"
        className={`${sizeClasses[size]} p-2 rounded-lg transition-all duration-300 hover:bg-bg-elevated focus:ring-2 focus:ring-accent-purple focus:ring-offset-2 focus:ring-offset-bg-surface`}
        title={`Switch to ${isDark ? "light" : "dark"} mode`}
        aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      >
        <div className="relative">
          {/* Sun icon for light mode */}
          <svg
            className={`absolute inset-0 w-full h-full transition-all duration-300 ${
              isLight
                ? "opacity-100 rotate-0 scale-100"
                : "opacity-0 rotate-180 scale-50"
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="5" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>

          {/* Moon icon for dark mode */}
          <svg
            className={`absolute inset-0 w-full h-full transition-all duration-300 ${
              isDark
                ? "opacity-100 rotate-0 scale-100"
                : "opacity-0 -rotate-180 scale-50"
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        </div>
      </Button>
    </div>
  );
}
