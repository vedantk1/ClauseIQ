/**
 * Document utility functions
 * Extracted from documents page - these are pure functions with no side effects
 */

import React from "react";
import type { ContractTypeColorMap } from "@/types/documents";

/**
 * Format date string to human-readable format
 * EXACTLY as extracted from the original component
 */
export const formatDate = (dateString: string) => {
  try {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Invalid date";
  }
};

/**
 * Get relative time description (e.g., "2 days ago", "Yesterday")
 * EXACTLY as extracted from the original component
 */
export const getRelativeTime = (dateString: string) => {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
    return `${Math.ceil(diffDays / 30)} months ago`;
  } catch {
    return "Unknown";
  }
};

/**
 * Format contract type from snake_case to Title Case
 * EXACTLY as extracted from the original component
 */
export const formatContractType = (contractType?: string) => {
  if (!contractType) return "Unknown Type";

  // Convert snake_case to Title Case
  return contractType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

/**
 * Get contract type color classes
 * EXACTLY as extracted from the original component
 */
export const getContractTypeColor = (contractType?: string) => {
  const colors: ContractTypeColorMap = {
    employment: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    nda: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    service_agreement: "bg-green-500/20 text-green-300 border-green-500/30",
    lease: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    purchase: "bg-red-500/20 text-red-300 border-red-500/30",
    partnership: "bg-pink-500/20 text-pink-300 border-pink-500/30",
    license: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
    consulting: "bg-teal-500/20 text-teal-300 border-teal-500/30",
    contractor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    other: "bg-gray-500/20 text-gray-300 border-gray-500/30",
  };

  return colors[contractType || "other"] || colors.other;
};

/**
 * Highlight search text within a string
 * EXACTLY as extracted from the original component
 */
export const highlightSearchText = (
  text: string,
  searchQuery: string
): React.ReactNode => {
  if (!searchQuery.trim() || !text) return text;

  const query = searchQuery.trim();
  const regex = new RegExp(
    `(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
    "gi"
  );
  const parts = text.split(regex);

  return parts.map((part, index) =>
    regex.test(part)
      ? React.createElement(
          "mark",
          {
            key: index,
            className: "bg-accent-purple/20 text-accent-purple px-1 rounded",
          },
          part
        )
      : part
  );
};
