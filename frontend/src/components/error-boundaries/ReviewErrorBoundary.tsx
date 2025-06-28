/**
 * 🛡️ ERROR BOUNDARY LAYER
 *
 * Responsibilities:
 * 1. Catch and contain React errors
 * 2. Provide fallback UI for error states
 * 3. Log errors for monitoring
 * 4. Prevent cascade failures
 *
 * Architectural Benefits:
 * - Fault isolation
 * - Graceful degradation
 * - Error telemetry
 * - User experience protection
 */

"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import Card from "@/components/Card";
import Button from "@/components/Button";

interface Props {
  children: ReactNode;
  documentId: string;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ReviewErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error for monitoring and debugging
    console.error("🚨 Review Error Boundary caught an error:", {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      documentId: this.props.documentId,
      timestamp: new Date().toISOString(),
      userAgent:
        typeof window !== "undefined" ? window.navigator.userAgent : "server",
    });

    // In production, you'd send this to your error monitoring service
    // Example: Sentry.captureException(error, { extra: errorInfo });

    this.setState({
      hasError: true,
      error,
      errorInfo,
    });
  }

  private handleRetry = () => {
    // Reset error state to retry rendering
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  private handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-bg-primary flex items-center justify-center p-6">
          <Card className="text-center max-w-lg mx-auto">
            <div className="mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <h2 className="font-heading text-heading-sm text-text-primary mb-2">
                Something went wrong
              </h2>
              <p className="text-text-secondary mb-4">
                We encountered an error while loading your document review. Our
                team has been notified.
              </p>

              {/* Show error details in development */}
              {process.env.NODE_ENV === "development" && this.state.error && (
                <div className="text-left bg-red-50 border border-red-200 rounded-md p-4 mb-4">
                  <p className="text-sm font-medium text-red-800 mb-2">
                    Error Details (Development Only):
                  </p>
                  <code className="text-xs text-red-700 block whitespace-pre-wrap">
                    {this.state.error.message}
                  </code>
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-center">
              <Button variant="secondary" onClick={this.handleRetry}>
                Try Again
              </Button>
              <Button variant="primary" onClick={this.handleGoHome}>
                Go Home
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ReviewErrorBoundary;
