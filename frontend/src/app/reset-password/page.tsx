"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Button from "@/components/Button";
import { ArrowLeft, CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react";

function ResetPasswordForm() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [token, setToken] = useState("");

  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tokenParam = searchParams.get("token");
    if (!tokenParam) {
      setError("Invalid reset link. Please request a new password reset.");
    } else {
      setToken(tokenParam);
    }
  }, [searchParams]);

  const validatePassword = (password: string) => {
    if (password.length < 8) {
      return "Password must be at least 8 characters long";
    }
    if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(password)) {
      return "Password must contain both letters and numbers";
    }
    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    // Validate passwords
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      setIsLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    if (!token) {
      setError("Invalid reset link. Please request a new password reset.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(
        "http://localhost:8000/auth/reset-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token: token,
            new_password: newPassword,
          }),
        }
      );

      if (response.ok) {
        setIsSuccess(true);
      } else {
        const data = await response.json();
        setError(data.detail || "Failed to reset password. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md mx-auto">
          <div className="bg-bg-surface rounded-lg border border-border-muted p-8 shadow-lg text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-accent-green/10 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-accent-green" />
            </div>

            <h2 className="text-2xl font-heading font-bold text-text-primary mb-4">
              Password Reset Successful
            </h2>

            <p className="text-text-secondary mb-6">
              Your password has been successfully reset. You can now sign in
              with your new password.
            </p>

            <Button onClick={() => router.push("/login")} className="w-full">
              Sign In Now
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md mx-auto">
          <div className="bg-bg-surface rounded-lg border border-border-muted p-8 shadow-lg text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-accent-rose/10 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-accent-rose" />
            </div>

            <h2 className="text-2xl font-heading font-bold text-text-primary mb-4">
              Invalid Reset Link
            </h2>

            <p className="text-text-secondary mb-6">
              This password reset link is invalid or has expired. Please request
              a new password reset.
            </p>

            <div className="space-y-3">
              <Button
                onClick={() => router.push("/forgot-password")}
                className="w-full"
              >
                Request New Reset Link
              </Button>

              <Link
                href="/login"
                className="inline-flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md mx-auto">
        <div className="bg-bg-surface rounded-lg border border-border-muted p-8 shadow-lg">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-heading font-bold text-text-primary mb-2">
              Reset Your Password
            </h2>
            <p className="text-text-secondary">
              Enter your new password below.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="newPassword"
                className="block text-sm font-medium text-text-primary mb-2"
              >
                New Password
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-4 py-3 pr-12 bg-bg-primary border border-border-muted rounded-lg focus:ring-2 focus:ring-accent-purple focus:border-accent-purple outline-none transition-colors text-text-primary placeholder-text-muted"
                  placeholder="Enter your new password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              <p className="text-xs text-text-muted mt-1">
                Password must be at least 8 characters and contain letters and
                numbers
              </p>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-text-primary mb-2"
              >
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-4 py-3 pr-12 bg-bg-primary border border-border-muted rounded-lg focus:ring-2 focus:ring-accent-purple focus:border-accent-purple outline-none transition-colors text-text-primary placeholder-text-muted"
                  placeholder="Confirm your new password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-accent-rose/10 border border-accent-rose/20">
                <p className="text-sm text-accent-rose">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={
                isLoading || !newPassword.trim() || !confirmPassword.trim()
              }
              className="w-full"
            >
              {isLoading ? "Resetting..." : "Reset Password"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="inline-flex items-center text-text-secondary hover:text-text-primary transition-colors focus:outline-none focus:underline"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md mx-auto">
        <div className="bg-bg-surface rounded-lg border border-border-muted p-8 shadow-lg text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-purple mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading...</p>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
