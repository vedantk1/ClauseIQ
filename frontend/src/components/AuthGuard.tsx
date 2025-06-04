"use client";
// DEPRECATED: This component is no longer used.
// We now use page-level authentication with the useAuthRedirect hook.
import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const publicRoutes = ["/login", "/register"];

export default function AuthGuard_DEPRECATED({
  children,
}: {
  children: React.ReactNode;
}) {
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
      router.push("/login");
      return;
    }

    // If authenticated and trying to access login/register, redirect to home
    // BUT don't redirect if user just logged out (give them time to reach login page)
    if (isAuthenticated && isPublicRoute && !justLoggedOut) {
      router.push("/");
      return;
    }
  }, [isAuthenticated, isLoading, pathname, router]);

  // Show loading while determining auth state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-purple"></div>
      </div>
    );
  }

  return <>{children}</>;
}
