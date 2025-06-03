"use client";
import React from "react";
import clsx from "clsx";

interface SkeletonProps {
  variant?: "rect" | "line" | "paragraph";
  className?: string;
  lines?: number; // For paragraph variant
  width?: string;
  height?: string;
}

export default function Skeleton({
  variant = "rect",
  className,
  lines = 3,
  width,
  height,
}: SkeletonProps) {
  const baseClasses =
    "bg-bg-elevated rounded animate-pulse relative overflow-hidden";

  const shimmerClasses =
    "absolute inset-0 bg-gradient-to-r from-transparent via-text-secondary/10 to-transparent animate-shimmer";

  if (variant === "paragraph") {
    return (
      <div className={clsx("space-y-2", className)}>
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={clsx(
              baseClasses,
              "h-4",
              index === lines - 1 ? "w-3/4" : "w-full"
            )}
            style={{ width, height }}
          >
            <div className={shimmerClasses} />
          </div>
        ))}
      </div>
    );
  }

  const variantClasses = {
    rect: "h-32 w-full",
    line: "h-4 w-full",
  };

  return (
    <div
      className={clsx(baseClasses, variantClasses[variant], className)}
      style={{ width, height }}
    >
      <div className={shimmerClasses} />
    </div>
  );
}
