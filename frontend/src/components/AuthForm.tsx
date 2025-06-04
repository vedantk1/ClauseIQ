"use client";
import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Button from "@/components/Button";

interface AuthFormProps {
  mode: "login" | "register";
  onToggleMode: () => void;
  onSuccess?: () => void;
}

export default function AuthForm({
  mode,
  onToggleMode,
  onSuccess,
}: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login, register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password, fullName);
      }
      onSuccess?.();
    } catch {
      // Error handling is done in the context with toast
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-bg-surface rounded-lg border border-border-muted p-8 shadow-lg">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-heading font-bold text-text-primary mb-2">
            {mode === "login" ? "Welcome Back" : "Create Account"}
          </h2>
          <p className="text-text-secondary">
            {mode === "login"
              ? "Sign in to your ClauseIQ account"
              : "Sign up to get started with ClauseIQ"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {mode === "register" && (
            <div>
              <label
                htmlFor="fullName"
                className="block text-sm font-medium text-text-primary mb-2"
              >
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full px-4 py-3 bg-bg-primary border border-border-muted rounded-lg focus:ring-2 focus:ring-accent-purple focus:border-accent-purple outline-none transition-colors text-text-primary placeholder-text-muted"
                placeholder="Enter your full name"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-text-primary mb-2"
            >
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-bg-primary border border-border-muted rounded-lg focus:ring-2 focus:ring-accent-purple focus:border-accent-purple outline-none transition-colors text-text-primary placeholder-text-muted"
              placeholder="Enter your email"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-text-primary mb-2"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 bg-bg-primary border border-border-muted rounded-lg focus:ring-2 focus:ring-accent-purple focus:border-accent-purple outline-none transition-colors text-text-primary placeholder-text-muted"
              placeholder="Enter your password"
            />
            {mode === "register" && (
              <p className="text-xs text-text-muted mt-1">
                Password must be at least 6 characters long
              </p>
            )}
          </div>

          {mode === "login" && (
            <div className="text-right">
              <a
                href="/forgot-password"
                className="text-sm text-accent-purple hover:text-accent-purple/80 font-medium transition-colors focus:outline-none focus:underline"
              >
                Forgot Password?
              </a>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={isLoading}
            className="w-full"
          >
            {isLoading
              ? "Please wait..."
              : mode === "login"
              ? "Sign In"
              : "Create Account"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-text-secondary">
            {mode === "login"
              ? "Don't have an account?"
              : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={onToggleMode}
              className="text-accent-purple hover:text-accent-purple/80 font-medium transition-colors focus:outline-none focus:underline"
            >
              {mode === "login" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
