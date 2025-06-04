"use client";
import React from "react";
import { useAnalysis } from "@/context/AnalysisContext";
import { useRouter } from "next/navigation";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/Tabs";
import Card from "@/components/Card";
import Button from "@/components/Button";

export default function ReviewWorkspace() {
  const { isAuthenticated, isLoading } = useAuthRedirect();
  const { summary, fullText, fileName, sections } = useAnalysis();
  const router = useRouter();

  // Show loading while checking authentication
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

  if (!summary && !fileName && (!sections || sections.length === 0)) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center p-6">
        <Card className="text-center max-w-md mx-auto">
          <div className="mb-6">
            <svg
              className="w-16 h-16 text-text-secondary mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h2 className="font-heading text-heading-sm text-text-primary mb-2">
              No document to review
            </h2>
            <p className="text-text-secondary">
              Upload a contract to start your analysis and see detailed insights
              here.
            </p>
          </div>
          <Button onClick={() => router.push("/")}>Upload a Document</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="font-heading text-heading-md text-text-primary mb-2">
              Contract Review
            </h1>
            <div className="flex items-center gap-3">
              <span className="text-text-secondary">
                {fileName || "Uploaded Document"}
              </span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-accent-green rounded-full"></div>
                <span className="text-sm text-accent-green font-medium">
                  Analyzed
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => router.push("/")}>
              Upload Another
            </Button>
            <Button variant="secondary">Export Analysis</Button>
          </div>
        </div>

        {/* Tabs Navigation */}
        <Tabs defaultValue="summary">
          <TabsList className="mb-6">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="clauses">Clauses</TabsTrigger>
            <TabsTrigger value="risks">Risks & Suggestions</TabsTrigger>
            <TabsTrigger value="chat">Ask Questions</TabsTrigger>
          </TabsList>

          {/* Summary Tab */}
          <TabsContent value="summary">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <div className="mb-6">
                    <h2 className="font-heading text-heading-sm text-text-primary mb-3">
                      AI Summary
                    </h2>
                    <div className="prose prose-invert max-w-none">
                      <p className="text-text-secondary leading-relaxed">
                        {summary ||
                          "No summary available. The document analysis may still be processing."}
                      </p>
                    </div>
                  </div>
                </Card>

                {fullText && (
                  <Card>
                    <div className="mb-4">
                      <h3 className="font-heading text-lg text-text-primary mb-3">
                        Document Preview
                      </h3>
                      <div className="bg-bg-elevated rounded-lg p-4 max-h-96 overflow-y-auto">
                        <pre className="text-sm text-text-secondary whitespace-pre-wrap font-sans">
                          {fullText.substring(0, 1000)}
                          {fullText.length > 1000 && "..."}
                        </pre>
                      </div>
                    </div>
                  </Card>
                )}
              </div>

              {/* Metrics Sidebar */}
              <div className="space-y-6">
                <Card density="compact">
                  <h3 className="font-heading text-lg text-text-primary mb-4">
                    Key Metrics
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-text-secondary">
                        Document Length
                      </span>
                      <span className="text-text-primary font-medium">
                        {fullText
                          ? `${Math.ceil(fullText.length / 1000)}k chars`
                          : "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Jurisdiction</span>
                      <span className="text-text-primary font-medium">
                        To be detected
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Contract Type</span>
                      <span className="text-text-primary font-medium">
                        Employment
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Risk Level</span>
                      <span className="text-accent-amber font-medium">
                        Medium
                      </span>
                    </div>
                  </div>
                </Card>

                <Card density="compact">
                  <h3 className="font-heading text-lg text-text-primary mb-4">
                    Quick Actions
                  </h3>
                  <div className="space-y-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full justify-start"
                    >
                      <svg
                        className="w-4 h-4 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      Download PDF Report
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full justify-start"
                    >
                      <svg
                        className="w-4 h-4 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
                        />
                      </svg>
                      Share Analysis
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Clauses Tab */}
          <TabsContent value="clauses">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <h2 className="font-heading text-heading-sm text-text-primary mb-4">
                  Clause Navigator
                </h2>
                <div className="space-y-3">
                  {sections?.length > 0 ? (
                    sections.map((section, index) => (
                      <div
                        key={index}
                        className="p-3 rounded-lg bg-bg-elevated hover:bg-bg-elevated/80 cursor-pointer transition-colors"
                      >
                        <h3 className="font-medium text-text-primary mb-1">
                          {section.heading}
                        </h3>
                        <p className="text-sm text-text-secondary">
                          {section.text.substring(0, 100)}...
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-text-secondary">
                        No clauses extracted yet. This feature is coming soon.
                      </p>
                    </div>
                  )}
                </div>
              </Card>

              <Card>
                <h2 className="font-heading text-heading-sm text-text-primary mb-4">
                  Clause Details
                </h2>
                <div className="text-center py-12">
                  <svg
                    className="w-12 h-12 text-text-secondary mx-auto mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p className="text-text-secondary">
                    Select a clause to view detailed analysis
                  </p>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Risks Tab */}
          <TabsContent value="risks">
            <div className="space-y-6">
              <Card>
                <h2 className="font-heading text-heading-sm text-text-primary mb-6">
                  Risk Assessment
                </h2>
                <div className="space-y-4">
                  <div className="border-l-4 border-accent-rose bg-accent-rose/5 p-4 rounded-r-lg">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-accent-rose rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-white text-sm font-medium">
                          !
                        </span>
                      </div>
                      <div>
                        <h3 className="font-medium text-text-primary mb-1">
                          High Risk: Non-Compete Clause
                        </h3>
                        <p className="text-text-secondary text-sm mb-3">
                          The non-compete clause may be overly restrictive and
                          could limit your future career opportunities.
                        </p>
                        <Button size="sm" variant="tertiary">
                          Generate Rewrite Suggestion
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="border-l-4 border-accent-amber bg-accent-amber/5 p-4 rounded-r-lg">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-accent-amber rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-white text-sm font-medium">
                          ⚠
                        </span>
                      </div>
                      <div>
                        <h3 className="font-medium text-text-primary mb-1">
                          Medium Risk: Termination Terms
                        </h3>
                        <p className="text-text-secondary text-sm mb-3">
                          Notice period requirements may favor the employer.
                          Consider negotiating mutual terms.
                        </p>
                        <Button size="sm" variant="tertiary">
                          View Suggestions
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="text-center py-8">
                    <p className="text-text-secondary">
                      Advanced risk analysis is being developed. More insights
                      coming soon.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Chat Tab */}
          <TabsContent value="chat">
            <Card>
              <h2 className="font-heading text-heading-sm text-text-primary mb-6">
                Ask Questions About Your Contract
              </h2>
              <div className="space-y-4">
                <div className="bg-bg-elevated rounded-lg p-4 min-h-96">
                  <div className="text-center py-12">
                    <svg
                      className="w-12 h-12 text-text-secondary mx-auto mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                    <p className="text-text-secondary mb-4">
                      Chat with your contract feature coming soon
                    </p>
                    <p className="text-sm text-text-secondary">
                      Ask questions like &ldquo;What happens if I want to
                      quit?&rdquo; or &ldquo;Are there any unusual
                      clauses?&rdquo;
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Ask a question about your contract..."
                    className="flex-1 px-4 py-2 bg-bg-elevated border border-border-muted rounded-lg text-text-primary placeholder-text-secondary focus:ring-2 focus:ring-accent-purple focus:border-transparent"
                    disabled
                  />
                  <Button disabled>Send</Button>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
