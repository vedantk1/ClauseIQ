"use client";
import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import AuthForm from "@/components/AuthForm";

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function ProtectedRoute({
  children,
  fallback,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">
          <div className="w-8 h-8 bg-accent-purple rounded-full"></div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <AuthForm
          mode={authMode}
          onToggleMode={() =>
            setAuthMode(authMode === "login" ? "register" : "login")
          }
        />
      </div>
    );
  }

  return <>{children}</>;
}
