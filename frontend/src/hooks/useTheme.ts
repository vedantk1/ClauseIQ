/**
 * Theme management hook that integrates with the app state
 */
"use client";

import { useCallback, useEffect } from "react";
import { useAppState, useUIState } from "../store/appState";

export type Theme = "light" | "dark";

export const useTheme = () => {
  const { theme } = useUIState();
  const { dispatch } = useAppState();

  // Apply theme to document
  const applyTheme = useCallback((newTheme: Theme) => {
    document.documentElement.setAttribute("data-theme", newTheme);
  }, []);

  // Toggle between light and dark theme
  const toggleTheme = useCallback(() => {
    const newTheme: Theme = theme === "light" ? "dark" : "light";

    // Update state
    dispatch({ type: "UI_SET_THEME", payload: newTheme });

    // Apply to DOM
    applyTheme(newTheme);

    // Persist to localStorage
    localStorage.setItem("clauseiq-theme", newTheme);
  }, [theme, dispatch, applyTheme]);

  // Set specific theme
  const setTheme = useCallback(
    (newTheme: Theme) => {
      dispatch({ type: "UI_SET_THEME", payload: newTheme });
      applyTheme(newTheme);
      localStorage.setItem("clauseiq-theme", newTheme);
    },
    [dispatch, applyTheme]
  );

  // Initialize theme on mount
  useEffect(() => {
    // Check for saved theme preference
    const savedTheme = localStorage.getItem("clauseiq-theme") as Theme | null;

    // Check system preference
    const systemPrefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;

    // Determine initial theme
    const initialTheme: Theme =
      savedTheme || (systemPrefersDark ? "dark" : "light");

    // Set theme if different from current
    if (initialTheme !== theme) {
      dispatch({ type: "UI_SET_THEME", payload: initialTheme });
    }

    // Always apply to DOM
    applyTheme(initialTheme);
  }, [theme, dispatch, applyTheme]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      // Only auto-switch if no saved preference
      const savedTheme = localStorage.getItem("clauseiq-theme");
      if (!savedTheme) {
        const newTheme: Theme = e.matches ? "dark" : "light";
        dispatch({ type: "UI_SET_THEME", payload: newTheme });
        applyTheme(newTheme);
      }
    };

    mediaQuery.addEventListener("change", handleSystemThemeChange);
    return () =>
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
  }, [dispatch, applyTheme]);

  return {
    theme,
    toggleTheme,
    setTheme,
    isDark: theme === "dark",
    isLight: theme === "light",
  };
};
