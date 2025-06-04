"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAnalysis } from "@/context/AnalysisContext";
import { useApiCall } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import config from "@/config/config";
import Button from "@/components/Button";
import Card from "@/components/Card";
import clsx from "clsx";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const router = useRouter();
  const { setSections, setSummary, setFullText, setFileName } = useAnalysis();
  const apiCall = useApiCall();

  const handleFileChange = (selectedFile: File | null) => {
    if (!selectedFile) return;

    // Basic frontend validation
    if (selectedFile.size > config.maxFileSizeMB * 1024 * 1024) {
      alert(`File is too large. Max size: ${config.maxFileSizeMB}MB`);
      return;
    }
    if (!selectedFile.name.toLowerCase().endsWith(".pdf")) {
      alert("Please upload a PDF file.");
      return;
    }
    setFile(selectedFile);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileChange(e.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleProcessDocument = async () => {
    if (!file) return;
    setLoading(true);

    try {
      const toast = (await import("react-hot-toast")).toast;
      const loadingToast = toast.loading("Processing document...");

      const formData = new FormData();
      formData.append("file", file);

      const res = await apiCall(`/process-document/`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res
          .json()
          .catch(() => ({ detail: res.statusText }));
        toast.dismiss(loadingToast);
        toast.error(
          `Error: ${res.status} ${errorData.detail || "Failed to process"}`
        );
        throw new Error(
          `HTTP error! status: ${res.status}, details: ${errorData.detail}`
        );
      }

      interface ProcessResponse {
        id: string;
        filename: string;
        full_text: string;
        summary: string;
      }

      const data = (await res.json()) as ProcessResponse;

      // Store the results in context
      setFileName(data.filename);
      setFullText(data.full_text);
      setSummary(data.summary);
      setSections([]);

      toast.dismiss(loadingToast);
      toast.success("Document processed successfully!");

      router.push("/review");
    } catch (error) {
      console.error("Error during document processing:", error);
      const toast = (await import("react-hot-toast")).toast;
      toast.error("Failed to process document. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-bg-primary">
        {/* Hero Section */}
        <div className="relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 pt-20 pb-32">
            <div className="text-center">
              <h1 className="font-heading text-heading-lg sm:text-5xl lg:text-6xl font-semibold text-text-primary mb-6">
                Understand any
                <span className="text-accent-purple"> contract</span>
                <br />
                in minutes
              </h1>
              <p className="text-body-lg text-text-secondary max-w-2xl mx-auto mb-12">
                Upload your employment contract and get an AI-powered analysis
                in plain language. Identify risks, understand key terms, and
                make informed decisions.
              </p>
            </div>

            {/* Upload Section */}
            <div className="max-w-2xl mx-auto">
              <Card className="p-8">
                <div className="text-center mb-8">
                  <h2 className="font-heading text-heading-md text-text-primary mb-2">
                    Upload your contract
                  </h2>
                  <p className="text-text-secondary">
                    Drag and drop your PDF file here, or click to select
                  </p>
                </div>

                {/* Drag & Drop Zone */}
                <div
                  className={clsx(
                    "relative border-2 border-dashed rounded-lg p-12 text-center transition-all duration-200",
                    dragActive || file
                      ? "border-accent-purple bg-accent-purple/5"
                      : "border-border-muted hover:border-accent-purple/50 hover:bg-bg-elevated"
                  )}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleInputChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={loading}
                  />

                  <div className="space-y-4">
                    {file ? (
                      <div className="flex items-center justify-center space-x-3">
                        <svg
                          className="w-8 h-8 text-accent-purple"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <div>
                          <p className="font-medium text-text-primary">
                            {file.name}
                          </p>
                          <p className="text-sm text-text-secondary">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <svg
                          className="w-12 h-12 text-text-secondary mx-auto"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 48 48"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                          />
                        </svg>
                        <div>
                          <p className="text-text-primary font-medium">
                            Drop your PDF here, or{" "}
                            <span className="text-accent-purple">
                              click to browse
                            </span>
                          </p>
                          <p className="text-sm text-text-secondary mt-1">
                            Maximum file size: {config.maxFileSizeMB}MB
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {file && (
                  <div className="mt-8 flex flex-col sm:flex-row gap-4">
                    <Button
                      onClick={handleProcessDocument}
                      loading={loading}
                      size="lg"
                      className="flex-1"
                    >
                      {loading ? "Processing..." : "Analyze Contract"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setFile(null)}
                      disabled={loading}
                      size="lg"
                    >
                      Remove
                    </Button>
                  </div>
                )}

                <div className="mt-6 text-center">
                  <p className="text-sm text-text-secondary">
                    Your documents are processed securely and deleted after
                    analysis.
                  </p>
                </div>
              </Card>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="py-24 bg-bg-surface">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="font-heading text-heading-md text-text-primary mb-4">
                Why choose ClauseIQ?
              </h2>
              <p className="text-text-secondary max-w-2xl mx-auto">
                Powerful AI analysis tools designed to make legal documents
                accessible to everyone
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <Card density="compact" className="text-center">
                <div className="w-12 h-12 bg-accent-purple/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-6 h-6 text-accent-purple"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
                <h3 className="font-heading text-lg font-semibold text-text-primary mb-2">
                  Lightning Fast
                </h3>
                <p className="text-text-secondary">
                  Get comprehensive contract analysis in under 2 minutes
                </p>
              </Card>

              <Card density="compact" className="text-center">
                <div className="w-12 h-12 bg-accent-green/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-6 h-6 text-accent-green"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h3 className="font-heading text-lg font-semibold text-text-primary mb-2">
                  Plain Language
                </h3>
                <p className="text-text-secondary">
                  Complex legal terms explained in simple, understandable
                  language
                </p>
              </Card>

              <Card density="compact" className="text-center">
                <div className="w-12 h-12 bg-accent-amber/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-6 h-6 text-accent-amber"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
                <h3 className="font-heading text-lg font-semibold text-text-primary mb-2">
                  Secure & Private
                </h3>
                <p className="text-text-secondary">
                  Your documents are encrypted and automatically deleted after
                  processing
                </p>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
