/**
 * ClauseIQ PDF Console Warning Suppression
 *
 * Suppresses the harmless PDF.js --scale-factor CSS variable warning
 * that doesn't affect functionality but creates console noise.
 *
 * This follows the recommendation from the React PDF evaluation docs.
 */

// Only apply in production to keep development debugging intact
if (process.env.NODE_ENV === "production") {
  const originalError = console.error;
  console.error = (message: unknown, ...args: unknown[]) => {
    // Suppress the PDF.js scale factor warning
    if (typeof message === "string" && message.includes("--scale-factor")) {
      return;
    }
    // Allow all other console errors
    originalError(message, ...args);
  };

  // Also suppress any PDF.js warnings about CSS variables
  const originalWarn = console.warn;
  console.warn = (message: unknown, ...args: unknown[]) => {
    if (typeof message === "string" && message.includes("--scale-factor")) {
      return;
    }
    originalWarn(message, ...args);
  };
}

export {};
