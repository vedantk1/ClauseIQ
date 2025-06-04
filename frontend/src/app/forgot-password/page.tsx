"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/Button";
import { ArrowLeft, Mail, CheckCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(
        "http://localhost:8000/auth/forgot-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        }
      );

      if (response.ok) {
        setIsEmailSent(true);
      } else {
        const data = await response.json();
        setError(data.detail || "Something went wrong. Please try again.");
      }
    } catch (error) {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isEmailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md mx-auto">
          <div className="bg-bg-surface rounded-lg border border-border-muted p-8 shadow-lg text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-accent-green/10 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-accent-green" />
            </div>

            <h2 className="text-2xl font-heading font-bold text-text-primary mb-4">
              Check Your Email
            </h2>

            <p className="text-text-secondary mb-6">
              We've sent a password reset link to <strong>{email}</strong>.
              Please check your email and click the link to reset your password.
            </p>

            <div className="space-y-4">
              <p className="text-sm text-text-muted">
                Didn't receive the email? Check your spam folder or try again.
              </p>

              <Button
                variant="secondary"
                onClick={() => {
                  setIsEmailSent(false);
                  setEmail("");
                }}
                className="w-full"
              >
                <Mail className="w-4 h-4 mr-2" />
                Send Another Email
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
              Forgot Password
            </h2>
            <p className="text-text-secondary">
              Enter your email address and we'll send you a link to reset your
              password.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
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
                placeholder="Enter your email address"
                disabled={isLoading}
              />
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
              disabled={isLoading || !email.trim()}
              className="w-full"
            >
              {isLoading ? "Sending..." : "Send Reset Link"}
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
