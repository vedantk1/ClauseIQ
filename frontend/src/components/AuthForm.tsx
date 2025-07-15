"use client";
import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button, Input } from "@/components/ui";
import Card from "@/components/Card";
import { Mail, Lock, User } from "lucide-react";

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

    // Generate unique ID for tracking this auth attempt
    const authAttemptId = Math.random().toString(36).substr(2, 9);
    console.log(`🔑 [AuthForm-${authAttemptId}] Submit clicked:`, {
      mode,
      email,
      hasPassword: !!password,
      hasFullName: !!fullName,
      timestamp: new Date().toISOString(),
    });

    setIsLoading(true);
    console.log(`⏳ [AuthForm-${authAttemptId}] Setting loading state to true`);

    try {
      console.log(`🔄 [AuthForm-${authAttemptId}] Attempting ${mode}...`);
      if (mode === "login") {
        console.log(`📤 [AuthForm-${authAttemptId}] Calling login function`);
        await login(email, password);
        console.log(
          `✅ [AuthForm-${authAttemptId}] Login function returned successfully`
        );
      } else {
        console.log(`📤 [AuthForm-${authAttemptId}] Calling register function`);
        await register(email, password, fullName);
        console.log(
          `✅ [AuthForm-${authAttemptId}] Register function returned successfully`
        );
      }
      console.log(
        `🎯 [AuthForm-${authAttemptId}] Auth successful, calling onSuccess callback`
      );
      onSuccess?.();
    } catch (error) {
      console.error(`❌ [AuthForm-${authAttemptId}] Auth attempt failed:`, {
        error,
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Error handling is done in the context with toast
    } finally {
      console.log(
        `🔄 [AuthForm-${authAttemptId}] Setting loading state to false`
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <Card className="p-8">
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
            <Input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(value) => setFullName(value)}
              required
              label="Full Name"
              placeholder="Enter your full name"
              leftIcon={<User className="h-4 w-4" />}
              size="lg"
            />
          )}

          <Input
            id="email"
            type="email"
            value={email}
            onChange={(value) => setEmail(value)}
            required
            label="Email Address"
            placeholder="Enter your email"
            leftIcon={<Mail className="h-4 w-4" />}
            size="lg"
          />

          <Input
            id="password"
            type="password"
            value={password}
            onChange={(value) => setPassword(value)}
            required
            minLength={6}
            label="Password"
            placeholder="Enter your password"
            leftIcon={<Lock className="h-4 w-4" />}
            size="lg"
            helpText={
              mode === "register"
                ? "Password must be at least 6 characters long"
                : undefined
            }
          />

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
            isLoading={isLoading}
            className="w-full"
          >
            {mode === "login" ? "Sign In" : "Create Account"}
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
      </Card>
    </div>
  );
}
