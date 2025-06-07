"use client";
import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { LoadingSpinner } from "./ui/LoadingStates";

const publicRoutes = ["/login", "/register"];

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  redirectTo?: string;
}

export default function AuthGuard({
  children,
  fallback,
  redirectTo = "/login",
}: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const lastAuthState = useRef(isAuthenticated);

  useEffect(() => {
    // Don't redirect while loading or during logout process
    const logoutInProgress =
      localStorage.getItem("logout_in_progress") === "true";
    if (isLoading || logoutInProgress) return;

    const isPublicRoute = publicRoutes.includes(pathname);

    // Track if user just logged out
    const justLoggedOut =
      lastAuthState.current === true && isAuthenticated === false;
    lastAuthState.current = isAuthenticated;

    // If not authenticated and trying to access protected route
    if (!isAuthenticated && !isPublicRoute) {
      router.push(redirectTo);
      return;
    }

    // If authenticated and trying to access login/register, redirect to home
    // BUT don't redirect if user just logged out (give them time to reach login page)
    if (isAuthenticated && isPublicRoute && !justLoggedOut) {
      router.push("/");
      return;
    }
  }, [isAuthenticated, isLoading, pathname, router, redirectTo]);

  // Show loading while determining auth state
  if (isLoading) {
    return (
      fallback || (
        <div className="min-h-screen flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      )
    );
  }

  // Show children for authenticated users on protected routes or all users on public routes
  const isPublicRoute = publicRoutes.includes(pathname);
  if (isAuthenticated || isPublicRoute) {
    return <>{children}</>;
  }

  // Fallback for unauthenticated users on protected routes
  return (
    fallback || (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  );
}
