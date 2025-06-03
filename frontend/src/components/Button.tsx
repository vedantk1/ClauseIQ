"use client";
import React from "react";
import clsx from "clsx";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "tertiary" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  children: React.ReactNode;
}

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  const baseClasses = clsx(
    "relative inline-flex items-center justify-center font-medium rounded-md transition-all duration-150 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary",
    "active:transform active:translate-y-0.5 active:scale-98",
    "disabled:cursor-not-allowed disabled:opacity-50 disabled:transform-none",
    {
      // Variants
      "bg-accent-purple text-white hover:bg-purple-600 shadow-sm":
        variant === "primary",
      "bg-bg-surface text-text-primary border border-border-muted hover:bg-bg-elevated":
        variant === "secondary",
      "text-text-secondary hover:text-text-primary hover:bg-bg-elevated":
        variant === "tertiary",
      "bg-accent-rose text-white hover:bg-red-600 shadow-sm":
        variant === "danger",

      // Sizes
      "px-3 py-1.5 text-sm": size === "sm",
      "px-4 py-2 text-base": size === "md",
      "px-6 py-3 text-lg": size === "lg",
    }
  );

  return (
    <button
      className={clsx(baseClasses, className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <span className={clsx("flex items-center gap-2", loading && "opacity-0")}>
        {children}
      </span>
    </button>
  );
}
