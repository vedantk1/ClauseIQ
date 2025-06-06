"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext.v2";
import AuthForm from "@/components/AuthForm";

export default function LoginPage() {
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  // If authenticated, redirect to home
  useEffect(() => {
    if (isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, router]);

  const handleAuthSuccess = () => {
    router.push("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <AuthForm
        mode={authMode}
        onToggleMode={() =>
          setAuthMode(authMode === "login" ? "register" : "login")
        }
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}
