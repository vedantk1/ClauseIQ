"use client";
import { useEffect, useRef, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext.v2";

export function useAuthRedirect() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const hasRedirected = useRef(false);
  const redirectAttempts = useRef(0);

  // List of paths that don't require authentication
  const publicPaths = useMemo(
    () => [
      "/login",
      "/register",
      "/",
      "/about",
      "/privacy",
      "/terms",
      "/help",
      "/reset-password",
      "/verify-email",
      "/pricing",
    ],
    []
  );

  // Check if current path is public
  const isPublicPath = useMemo(
    () =>
      publicPaths.some(
        (publicPath) =>
          pathname === publicPath || pathname.startsWith(`${publicPath}/`)
      ),
    [pathname, publicPaths]
  );

  useEffect(() => {
    console.log(
      "[AUTH REDIRECT DEBUG] useAuthRedirect - isLoading:",
      isLoading,
      "isAuthenticated:",
      isAuthenticated,
      "pathname:",
      pathname,
      "isPublicPath:",
      isPublicPath,
      "redirectAttempts:",
      redirectAttempts.current
    );

    // Don't redirect if still loading
    if (isLoading) {
      return;
    }

    // Don't redirect if on a public path
    if (isPublicPath) {
      // Reset redirect flags when on public paths
      hasRedirected.current = false;
      redirectAttempts.current = 0;
      return;
    }

    // Prevent excessive redirect attempts (max 3 attempts)
    if (redirectAttempts.current >= 3) {
      console.warn(
        "[AUTH REDIRECT DEBUG] Too many redirect attempts, stopping redirect cycle"
      );
      return;
    }

    // Only redirect if we're sure the user is not authenticated and haven't redirected yet
    if (!isAuthenticated && !hasRedirected.current) {
      console.log("[AUTH REDIRECT DEBUG] Redirecting to login...");
      hasRedirected.current = true;
      redirectAttempts.current += 1;
      router.push("/login");
    }

    // Reset redirect flags when user becomes authenticated
    if (isAuthenticated) {
      hasRedirected.current = false;
      redirectAttempts.current = 0;
    }
  }, [isAuthenticated, isLoading, router, pathname, isPublicPath]);

  return { isAuthenticated, isLoading };
}
