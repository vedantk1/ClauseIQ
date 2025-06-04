"use client";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";

export default function About() {
  const { isAuthenticated, isLoading } = useAuthRedirect();

  // Auth loading check
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-purple"></div>
      </div>
    );
  }

  // Don't render if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">About ClauseIQ</h1>

      <div className="bg-bg-surface rounded-lg shadow-sm p-6 space-y-4">
        <section>
          <h2 className="text-lg font-medium mb-2">What is ClauseIQ?</h2>
          <p>
            ClauseIQ is a tool designed to help non-lawyers understand
            employment contracts by extracting important information and
            providing simple explanations. It uses natural language processing
            to analyze legal documents and present key points in plain language.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium mb-2">How It Works</h2>
          <ol className="list-decimal list-inside space-y-2 ml-2">
            <li>Upload your employment contract PDF</li>
            <li>Our system extracts and processes the text</li>
            <li>The document is split into logical sections</li>
            <li>Each section is analyzed and summarized</li>
            <li>Results are presented in an easy-to-understand format</li>
          </ol>
        </section>

        <div className="bg-bg-elevated border-l-4 border-accent-amber p-4 mt-6">
          <h3 className="text-accent-amber font-medium">Legal Disclaimer</h3>
          <p className="text-sm text-text-secondary mt-1">
            This tool is provided for informational purposes only and does not
            constitute legal advice. Always consult with a qualified legal
            professional before making decisions based on contract analysis. Our
            AI-based system attempts to highlight important clauses but may miss
            critical details or misinterpret complex legal language.
          </p>
        </div>
      </div>

      <div className="mt-8 text-sm text-gray-500 text-center">
        &copy; 2025 ClauseIQ Project • All Rights Reserved
      </div>
    </div>
  );
}
