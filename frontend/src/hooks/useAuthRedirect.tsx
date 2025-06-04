"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export function useAuthRedirect() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log(
      "[AUTH REDIRECT DEBUG] useAuthRedirect - isLoading:",
      isLoading,
      "isAuthenticated:",
      isAuthenticated
    );

    // Only redirect if we're sure the user is not authenticated and not still loading
    if (!isLoading && !isAuthenticated) {
      console.log("[AUTH REDIRECT DEBUG] Redirecting to login...");
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  return { isAuthenticated, isLoading };
}
