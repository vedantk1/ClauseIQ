/**
 * Enhanced Card component with improved styling
 */

import React from "react";
import { HTMLAttributes } from "react";
import { VariantProps, cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "outlined" | "elevated";
  padding?: "none" | "sm" | "md" | "lg";
  rounded?: "none" | "sm" | "md" | "lg" | "xl";
}

const cardVariants = {
  default: "bg-white dark:bg-slate-900",
  outlined:
    "bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700",
  elevated:
    "bg-white dark:bg-slate-900 shadow-lg border border-gray-100 dark:border-slate-800",
};

const cardPadding = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

const cardRounded = {
  none: "",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
};

export const Card: React.FC<CardProps> = ({
  children,
  variant = "default",
  padding = "md",
  rounded = "md",
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        cardVariants[variant],
        cardPadding[padding],
        cardRounded[rounded],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<HTMLAttributes<HTMLDivElement>> = ({
  children,
  className,
  ...props
}) => (
  <div className={cn("mb-4", className)} {...props}>
    {children}
  </div>
);

export const CardTitle: React.FC<HTMLAttributes<HTMLHeadingElement>> = ({
  children,
  className,
  ...props
}) => (
  <h3
    className={cn(
      "text-lg font-semibold text-gray-900 dark:text-white",
      className
    )}
    {...props}
  >
    {children}
  </h3>
);

export const CardContent: React.FC<HTMLAttributes<HTMLDivElement>> = ({
  children,
  className,
  ...props
}) => (
  <div
    className={cn("text-gray-600 dark:text-slate-400", className)}
    {...props}
  >
    {children}
  </div>
);

export const CardFooter: React.FC<HTMLAttributes<HTMLDivElement>> = ({
  children,
  className,
  ...props
}) => (
  <div
    className={cn(
      "mt-4 pt-4 border-t border-gray-200 dark:border-slate-700",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

// Default export for convenience
export default Card;
