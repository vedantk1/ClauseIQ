"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAnalysis } from "@/context/AnalysisContext";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import config from "@/config/config";
import Button from "@/components/Button";
import Card from "@/components/Card";
import clsx from "clsx";

export default function Home() {
  const { isAuthenticated } = useAuthRedirect();
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const {
    analyzeDocument,
    resetAnalysis,
    currentDocument,
    isLoading: analysisLoading,
  } = useAnalysis();

  // Monitor state changes for debugging
  useEffect(() => {
    console.log("🔄 [DEBUG] State change detected:", {
      hasLocalFile: !!file,
      localFileName: file?.name || null,
      hasAnalysisDocument: !!currentDocument.id,
      analysisFileName: currentDocument.filename || null,
      inputValue: fileInputRef.current?.value || null,
      inputDisabled: fileInputRef.current?.disabled || false,
      timestamp: new Date().toISOString(),
    });
  }, [file, currentDocument.id, currentDocument.filename]);

  // Monitor file input element specifically
  useEffect(() => {
    const inputElement = fileInputRef.current;
    if (inputElement) {
      const handleFocus = () => console.log("🎯 [DEBUG] File input focused");
      const handleClick = () =>
        console.log("🖱️ [DEBUG] File input clicked (event listener)");

      inputElement.addEventListener("focus", handleFocus);
      inputElement.addEventListener("click", handleClick);

      return () => {
        inputElement.removeEventListener("focus", handleFocus);
        inputElement.removeEventListener("click", handleClick);
      };
    }
  }, []);

  // Add effect to monitor when the component re-renders after remove
  useEffect(() => {
    if (!file && fileInputRef.current) {
      console.log("🔍 [DEBUG] No file state, checking input element:", {
        inputValue: fileInputRef.current.value,
        inputDisabled: fileInputRef.current.disabled,
        timestamp: new Date().toISOString(),
      });
    }
  }, [file]);

  // Helper function to test file input functionality
  const testFileInputState = () => {
    console.log("🧪 [DEBUG] File input state test:", {
      hasFileInputRef: !!fileInputRef.current,
      inputValue: fileInputRef.current?.value || "undefined",
      inputDisabled: fileInputRef.current?.disabled || false,
      inputAccept: fileInputRef.current?.accept || "undefined",
      inputType: fileInputRef.current?.type || "undefined",
      localFileState: file?.name || null,
      analysisState: currentDocument.filename || null,
      timestamp: new Date().toISOString(),
    });
  };

  // Expose test function to window for manual debugging
  useEffect(() => {
    if (typeof window !== "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).testFileInputState = testFileInputState;
      console.log(
        "🔧 [DEBUG] testFileInputState() exposed to window for debugging"
      );
    }
    return () => {
      if (typeof window !== "undefined") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (window as any).testFileInputState;
      }
    };
  }, [testFileInputState]);

  // State consistency check utility
  const checkStateConsistency = () => {
    const hasLocalFile = !!file;
    const hasAnalysisDocument = !!currentDocument.id;
    const hasAnalysisFilename = !!currentDocument.filename;

    console.log("🔍 [DEBUG] State consistency check:", {
      hasLocalFile,
      localFileName: file?.name || null,
      hasAnalysisDocument,
      hasAnalysisFilename,
      analysisFileName: currentDocument.filename || null,
      analysisDocumentId: currentDocument.id || null,
      timestamp: new Date().toISOString(),
    });

    // Only warn about problematic inconsistencies, not transitional states
    if (
      hasLocalFile &&
      hasAnalysisDocument &&
      hasAnalysisFilename &&
      file.name !== currentDocument.filename
    ) {
      console.warn("⚠️ [DEBUG] State inconsistency: File names don't match:", {
        localFileName: file.name,
        analysisFileName: currentDocument.filename,
      });
    }

    // This is only concerning if both states persist for a while
    if (hasLocalFile && hasAnalysisDocument && !hasAnalysisFilename) {
      console.warn(
        "⚠️ [DEBUG] Potential issue: Analysis document exists but has no filename"
      );
    }
  };

  const handleFileChange = (selectedFile: File | null) => {
    if (!selectedFile) return;

    console.log("🔍 [DEBUG] File selection started:", {
      fileName: selectedFile.name,
      fileSize: selectedFile.size,
      fileType: selectedFile.type,
      timestamp: new Date().toISOString(),
    });

    // Basic frontend validation
    if (selectedFile.size > config.maxFileSizeMB * 1024 * 1024) {
      console.error("❌ [DEBUG] File size validation failed:", {
        fileSize: selectedFile.size,
        maxSize: config.maxFileSizeMB * 1024 * 1024,
        fileName: selectedFile.name,
      });
      alert(`File is too large. Max size: ${config.maxFileSizeMB}MB`);
      return;
    }
    if (!selectedFile.name.toLowerCase().endsWith(".pdf")) {
      console.error("❌ [DEBUG] File type validation failed:", {
        fileName: selectedFile.name,
        fileType: selectedFile.type,
      });
      alert("Please upload a PDF file.");
      return;
    }

    console.log("✅ [DEBUG] File validation passed, setting file state");
    setFile(selectedFile);
  };

  const handleRemoveFile = () => {
    console.log("🗑️ [DEBUG] Remove file initiated:", {
      currentFile: file?.name,
      inputValue: fileInputRef.current?.value,
      timestamp: new Date().toISOString(),
    });

    resetAnalysis();
    setFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      console.log("🔄 [DEBUG] File input element reset");
    }

    console.log("✅ [DEBUG] File and analysis state cleared, input reset");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("📎 [DEBUG] File input change event:", {
      filesLength: e.target.files?.length || 0,
      firstFileName: e.target.files?.[0]?.name || null,
      inputDisabled: e.target.disabled,
      timestamp: new Date().toISOString(),
    });

    if (e.target.files && e.target.files.length > 0) {
      handleFileChange(e.target.files[0]);
    } else {
      console.warn("⚠️ [DEBUG] File input change event but no files selected");
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("📌 [DEBUG] Drag event:", {
      type: e.type,
      dragActive,
      timestamp: new Date().toISOString(),
    });

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

    console.log("📁 [DEBUG] Drop event:", {
      filesLength: e.dataTransfer.files?.length || 0,
      firstFileName: e.dataTransfer.files?.[0]?.name || null,
      timestamp: new Date().toISOString(),
    });

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    } else {
      console.warn("⚠️ [DEBUG] Drop event but no files found");
    }
  };

  const handleProcessDocument = async () => {
    if (!file) {
      console.error("❌ [DEBUG] Process document called without file");
      return;
    }

    console.log("🚀 [DEBUG] Document processing started:", {
      fileName: file.name,
      fileSize: file.size,
      timestamp: new Date().toISOString(),
    });

    if (!isAuthenticated) {
      console.log("🔒 [DEBUG] User not authenticated, redirecting to login");
      const toast = (await import("react-hot-toast")).toast;
      toast.error("Please sign in to analyze documents");
      router.push("/login");
      return;
    }

    try {
      console.log("📄 [DEBUG] Starting document analysis");
      await analyzeDocument(file);
      console.log(
        "✅ [DEBUG] Document analysis completed successfully, opening review in new tab"
      );
      const documentId = currentDocument.id;
      if (documentId) {
        window.open(`/review?documentId=${documentId}`, "_blank");
      } else {
        console.error("❌ [DEBUG] No document ID available after analysis");
        const toast = (await import("react-hot-toast")).toast;
        toast.error("Document processed but unable to open review page.");
      }
    } catch (error) {
      console.error("❌ [DEBUG] Document analysis failed:", {
        error: error instanceof Error ? error.message : error,
        fileName: file.name,
        timestamp: new Date().toISOString(),
      });
      const toast = (await import("react-hot-toast")).toast;
      toast.error("Failed to process document. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Hero Section - Two Column Layout */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 pt-24 pb-20">
          <div className="flex flex-col xl:flex-row xl:items-center gap-12 xl:gap-16">
            {/* Left Column - Content (60%) */}
            <div className="flex-1 xl:flex-[3]">
              <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-semibold text-text-primary mb-8 leading-tight">
              Understand any
              <span className="text-accent-purple"> contract</span>
              <br />
                in 60 seconds
            </h1>
              <div className="mb-10 max-w-2xl">
                <p className="text-xl text-text-secondary leading-relaxed mb-4">
                  Upload your legal document and get instant AI-powered analysis in plain English.
                </p>
                <p className="text-lg text-text-secondary/80 leading-relaxed">
                  Chat with your contract, identify risks, and make informed decisions.
                </p>
              </div>

              {/* Key Differentiators */}
              <div className="space-y-4 mb-12">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-accent-green/20 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <span className="text-text-primary font-medium">Chat with your document in natural language</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-accent-purple/20 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-accent-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <span className="text-text-primary font-medium">AI suggestions and rewrites</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-accent-amber/20 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-accent-amber" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <span className="text-text-primary font-medium">100% open source</span>
                </div>
              </div>

              {/* Social Proof */}
              <div className="grid grid-cols-3 gap-6 max-w-lg">
                <div className="text-center p-4 bg-accent-purple/5 border border-accent-purple/10 rounded-xl hover:bg-accent-purple/10 transition-all duration-300">
                  <div className="text-3xl font-bold text-accent-purple mb-2">10+</div>
                  <div className="text-sm text-text-secondary font-medium">Contract<br />Types</div>
                </div>
                <div className="text-center p-4 bg-accent-green/5 border border-accent-green/10 rounded-xl hover:bg-accent-green/10 transition-all duration-300">
                  <div className="text-3xl font-bold text-accent-green mb-2">&lt;1min</div>
                  <div className="text-sm text-text-secondary font-medium">Analysis<br />Time</div>
                </div>
                <div className="text-center p-4 bg-accent-amber/5 border border-accent-amber/10 rounded-xl hover:bg-accent-amber/10 transition-all duration-300">
                  <div className="text-3xl font-bold text-accent-amber mb-2">5+</div>
                  <div className="text-sm text-text-secondary font-medium">AI<br />Models</div>
                </div>
              </div>
            </div>

            {/* Right Column - Upload Widget (40%) */}
            <div className="flex-1 xl:flex-[2]">
              <Card className="p-8 shadow-xl border border-border-muted/50 bg-gradient-to-br from-bg-surface to-bg-elevated">
                <div className="text-center mb-8">
                  <h3 className="font-heading text-xl font-semibold text-text-primary mb-3">
                    Try it now
                  </h3>
                  <p className="text-text-secondary">
                    Upload your PDF contract
                  </p>
                </div>

                {/* Enhanced Upload Zone */}
              <div
                className={clsx(
                    "relative border-2 border-dashed rounded-xl p-10 text-center transition-all duration-300 cursor-pointer group",
                  dragActive || file
                      ? "border-accent-purple bg-gradient-to-br from-accent-purple/10 to-accent-purple/5 shadow-lg scale-[1.02]"
                      : "border-border-muted hover:border-accent-purple/60 hover:bg-gradient-to-br hover:from-accent-purple/5 hover:to-transparent hover:shadow-md hover:scale-[1.01]"
                )}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => {
                  if (fileInputRef.current && !analysisLoading) {
                    fileInputRef.current.click();
                  }
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleInputChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={analysisLoading}
                  />

                  {file ? (
                    <div className="space-y-3">
                      <div className="w-12 h-12 bg-accent-green/20 rounded-full flex items-center justify-center mx-auto">
                        <svg className="w-6 h-6 text-accent-green" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      </div>
                      <p className="font-semibold text-text-primary">{file.name}</p>
                      <p className="text-sm text-text-secondary">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="w-16 h-16 bg-accent-purple/10 rounded-full flex items-center justify-center mx-auto group-hover:bg-accent-purple/20 transition-all duration-300">
                        <svg className="w-8 h-8 text-accent-purple group-hover:scale-110 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      </div>
                      <div>
                        <p className="text-text-primary font-semibold text-lg">
                          Drop PDF or <span className="text-accent-purple group-hover:text-accent-purple/80 transition-colors">browse</span>
                        </p>
                        <p className="text-sm text-text-secondary mt-2">Max {config.maxFileSizeMB}MB • Secure & Private</p>
                      </div>
                    </div>
                  )}
              </div>

              {file && (
                  <div className="mt-6 space-y-4">
                  <Button
                    onClick={handleProcessDocument}
                    loading={analysisLoading}
                      size="md"
                      className="w-full"
                  >
                      {analysisLoading ? "Analyzing..." : "Analyze Contract"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleRemoveFile}
                    disabled={analysisLoading}
                      size="sm"
                      className="w-full"
                  >
                    Remove
                  </Button>
                </div>
              )}

                <div className="mt-6 space-y-4">
                  <div className="text-center">
                <p className="text-sm text-text-secondary">
                      🔒 Secure & private - documents deleted after analysis
                    </p>
                  </div>
                  
                  {/* Sample Contract Link */}
                  <div className="text-center">
                    <button className="text-sm text-accent-purple hover:text-accent-purple/80 transition-colors font-medium">
                      Try with sample contract →
                    </button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <div className="py-24 bg-bg-surface">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="font-heading text-4xl font-semibold text-text-primary mb-6">
              How ClauseIQ works
            </h2>
            <p className="text-xl text-text-secondary max-w-3xl mx-auto">
              Get professional legal analysis in three simple steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="w-20 h-20 bg-accent-purple/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl font-bold text-accent-purple">1</span>
              </div>
              <h3 className="font-heading text-xl font-semibold text-text-primary mb-4">
                Upload Contract
              </h3>
              <p className="text-text-secondary leading-relaxed">
                Drop your PDF contract and our AI instantly identifies the document type and structure
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-accent-green/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl font-bold text-accent-green">2</span>
              </div>
              <h3 className="font-heading text-xl font-semibold text-text-primary mb-4">
                AI Analysis
              </h3>
              <p className="text-text-secondary leading-relaxed">
                Advanced AI extracts clauses, assesses risks, and prepares your document for interactive chat
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-accent-amber/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl font-bold text-accent-amber">3</span>
              </div>
              <h3 className="font-heading text-xl font-semibold text-text-primary mb-4">
                Chat & Explore
              </h3>
              <p className="text-text-secondary leading-relaxed">
                Ask questions, navigate clauses, and get plain-English explanations of complex legal terms
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Feature Showcase */}
      <div className="py-24">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="font-heading text-4xl font-semibold text-text-primary mb-6">
                Chat with your contract like ChatGPT
              </h2>
              <p className="text-text-secondary mb-8 text-xl leading-relaxed">
                Ask any question about your contract in natural language. Get instant answers 
                with exact citations from your document.
              </p>
              
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-accent-green/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <svg className="w-4 h-4 text-accent-green" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-text-primary text-lg">"What's my notice period?"</p>
                    <p className="text-text-secondary mt-1">Get instant answers with source citations</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-accent-green/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <svg className="w-4 h-4 text-accent-green" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-text-primary text-lg">"Are there any concerning clauses?"</p>
                    <p className="text-text-secondary mt-1">AI highlights potential risks and red flags</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-accent-green/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <svg className="w-4 h-4 text-accent-green" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-text-primary text-lg">"Explain this clause in simple terms"</p>
                    <p className="text-text-secondary mt-1">Complex legal jargon translated to plain English</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:order-first">
              {/* Chat Interface Mockup */}
              <Card className="p-8 shadow-lg">
                <div className="space-y-6">
                  {/* User Message */}
                  <div className="flex justify-end">
                    <div className="bg-accent-purple text-white rounded-2xl px-6 py-3 max-w-xs">
                      <p className="text-sm">What happens if I want to leave this job?</p>
                    </div>
                  </div>
                  
                  {/* AI Response */}
                  <div className="flex justify-start">
                    <div className="bg-bg-elevated border border-border-muted rounded-2xl px-6 py-4 max-w-sm">
                      <p className="text-sm text-text-primary mb-3">
                        According to your contract, you need to provide <strong>30 days written notice</strong> before leaving. There's no penalty for resignation.
                      </p>
                      <div className="text-xs text-accent-purple">
                        📎 Source: Section 4.2 - Termination
                      </div>
                    </div>
                  </div>
                  
                  {/* User Message */}
                  <div className="flex justify-end">
                    <div className="bg-accent-purple text-white rounded-2xl px-6 py-3 max-w-xs">
                      <p className="text-sm">What about my benefits?</p>
                    </div>
                  </div>
                  
                  {/* Typing Indicator */}
                  <div className="flex justify-start">
                    <div className="bg-bg-elevated border border-border-muted rounded-2xl px-6 py-4">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-text-secondary rounded-full animate-pulse"></div>
                        <div className="w-2 h-2 bg-text-secondary rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                        <div className="w-2 h-2 bg-text-secondary rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                      </div>
                    </div>
                  </div>
              </div>
            </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Clause Navigator Feature */}
      <div className="py-24 bg-bg-surface">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="font-heading text-4xl font-semibold text-text-primary mb-6">
                Smart clause analysis & navigation
              </h2>
              <p className="text-text-secondary mb-8 text-xl leading-relaxed">
                Every clause automatically categorized and risk-assessed. Navigate your contract 
                with color-coded risk levels and smart filtering.
              </p>
              
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-4 h-4 bg-accent-rose rounded-full"></div>
                  <span className="text-text-primary font-semibold text-lg">High Risk Clauses</span>
                  <span className="text-text-secondary">- Review carefully</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-4 h-4 bg-accent-amber rounded-full"></div>
                  <span className="text-text-primary font-semibold text-lg">Medium Risk Clauses</span>
                  <span className="text-text-secondary">- Consider implications</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-4 h-4 bg-accent-green rounded-full"></div>
                  <span className="text-text-primary font-semibold text-lg">Low Risk Clauses</span>
                  <span className="text-text-secondary">- Generally favorable</span>
                </div>
              </div>
            </div>

            <div>
              {/* Clause Navigator Mockup */}
              <Card className="p-6 shadow-lg">
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-6">
                    <h4 className="font-semibold text-text-primary text-lg">Contract Clauses</h4>
                    <span className="text-text-secondary">12 found</span>
                  </div>
                  
                  <div className="p-4 bg-accent-rose/5 border border-accent-rose/20 rounded-xl">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-text-primary">Termination Clause</p>
                        <p className="text-sm text-text-secondary mt-2">Immediate dismissal for gross misconduct...</p>
                      </div>
                      <span className="px-3 py-1 bg-accent-rose text-white text-sm rounded-full font-medium">High</span>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-accent-amber/5 border border-accent-amber/20 rounded-xl">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-text-primary">Non-Compete Clause</p>
                        <p className="text-sm text-text-secondary mt-2">6-month restriction period...</p>
                      </div>
                      <span className="px-3 py-1 bg-accent-amber text-white text-sm rounded-full font-medium">Medium</span>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-accent-green/5 border border-accent-green/20 rounded-xl">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-text-primary">Salary Review</p>
                        <p className="text-sm text-text-secondary mt-2">Annual performance-based review...</p>
                      </div>
                      <span className="px-3 py-1 bg-accent-green text-white text-sm rounded-full font-medium">Low</span>
                    </div>
                  </div>
                  
                  <div className="text-center pt-4">
                    <button className="text-accent-purple hover:text-accent-purple/80 font-medium">
                      View all clauses →
                    </button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Contract Types Section */}
      <div className="py-24">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="font-heading text-4xl font-semibold text-text-primary mb-6">
              Built for real people and businesses
            </h2>
            <p className="text-xl text-text-secondary max-w-3xl mx-auto">
              Whether you're a small business owner, HR manager, or individual, ClauseIQ makes legal documents accessible
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-16">
            <Card density="compact" className="text-center p-8 h-full flex flex-col">
              <div className="w-16 h-16 bg-accent-blue/10 rounded-xl flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-accent-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="font-heading text-xl font-semibold text-text-primary mb-4">
                Small Business Owners
              </h3>
              <p className="text-text-secondary leading-relaxed flex-grow">
                Review vendor contracts, service agreements, and partnership deals with confidence
              </p>
            </Card>

            <Card density="compact" className="text-center p-8 h-full flex flex-col">
              <div className="w-16 h-16 bg-accent-purple/10 rounded-xl flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-accent-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="font-heading text-xl font-semibold text-text-primary mb-4">
                HR Teams
              </h3>
              <p className="text-text-secondary leading-relaxed flex-grow">
                Analyze employment contracts, NDAs, and consultant agreements for your team
              </p>
            </Card>

            <Card density="compact" className="text-center p-8 h-full flex flex-col">
              <div className="w-16 h-16 bg-accent-green/10 rounded-xl flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="font-heading text-xl font-semibold text-text-primary mb-4">
                Individuals
              </h3>
              <p className="text-text-secondary leading-relaxed flex-grow">
                Understand your employment contract, lease agreement, or any legal document
              </p>
            </Card>
          </div>

          {/* Contract Types */}
          <div className="text-center">
            <h3 className="font-heading text-2xl font-semibold text-text-primary mb-8">
              Supports 10+ contract types
            </h3>
            <div className="flex flex-wrap justify-center gap-4">
              {[
                'Employment', 'NDAs', 'Service Agreements', 'Leases', 
                'Purchase Agreements', 'Partnership', 'License', 'Consulting',
                'Contractor', 'Generic'
              ].map((type) => (
                <span key={type} className="px-4 py-2 bg-bg-elevated border border-border-muted rounded-full text-text-secondary font-medium">
                  {type}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Advanced AI Features Section */}
      <div className="py-24 bg-bg-surface">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="font-heading text-4xl font-semibold text-text-primary mb-6">
              Advanced AI capabilities
            </h2>
            <p className="text-xl text-text-secondary max-w-3xl mx-auto">
              Powered by cutting-edge AI that catches what humans miss and provides strategic insights for better decisions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-accent-rose/10 rounded-xl flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-accent-rose" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h4 className="font-semibold text-text-primary mb-3 text-lg">Finds Hidden Risks</h4>
              <p className="text-text-secondary leading-relaxed">Spots problematic clauses lawyers miss</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-accent-purple/10 rounded-xl flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-accent-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a4 4 0 118 0v4m-8 0h8m-8 0v9a2 2 0 002 2h4.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293H20a2 2 0 002-2V7m-8 0V3a4 4 0 118 0v4" />
                </svg>
              </div>
              <h4 className="font-semibold text-text-primary mb-3 text-lg">Deadline Extraction</h4>
              <p className="text-text-secondary leading-relaxed">Never miss critical dates again</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-accent-green/10 rounded-xl flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h4 className="font-semibold text-text-primary mb-3 text-lg">Compliance Checking</h4>
              <p className="text-text-secondary leading-relaxed">Highlights regulatory violations automatically</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-accent-amber/10 rounded-xl flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-accent-amber" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h4 className="font-semibold text-text-primary mb-3 text-lg">Negotiation Intel</h4>
              <p className="text-text-secondary leading-relaxed">Shows where you have leverage to improve terms</p>
            </div>
          </div>
        </div>
      </div>


    </div>
  );
}
