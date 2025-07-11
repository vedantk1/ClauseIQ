"use client";
import React from "react";
import clsx from "clsx";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  density?: "standard" | "compact";
  status?: "success" | "warning" | "danger" | "info";
  statusLabel?: string;
  rounded?: boolean;
}

export default function Card({
  children,
  className,
  density = "standard",
  status,
  statusLabel,
  rounded = true,
}: CardProps) {
  const cardClasses = clsx(
    "bg-bg-surface border border-border-muted shadow-card overflow-hidden",
    "transition-shadow duration-200 hover:shadow-card-lg",
    {
      "rounded-lg": rounded,
      "p-6 lg:p-8": density === "standard",
      "p-4 lg:p-6": density === "compact",
    },
    className
  );

  const statusClasses = {
    success: "bg-accent-green text-white",
    warning: "bg-accent-amber text-white",
    danger: "bg-accent-rose text-white",
    info: "bg-accent-purple text-white",
  };

  return (
    <div className="relative">
      {status && statusLabel && (
        <div
          className={clsx(
            "absolute top-3 left-3 z-10 px-2 py-1 text-xs font-medium rounded-md",
            statusClasses[status]
          )}
        >
          {statusLabel}
        </div>
      )}
      <div className={cardClasses}>{children}</div>
    </div>
  );
}
