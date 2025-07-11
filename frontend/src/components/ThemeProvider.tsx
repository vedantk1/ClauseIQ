/**
 * Theme provider component that handles theme initialization
 */
"use client";

import { useEffect } from "react";
import { useTheme } from "../hooks/useTheme";

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme } = useTheme();

  // Apply theme to document element on theme change
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);

    // Also set class for backward compatibility if needed
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.add("light");
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  return <>{children}</>;
}
