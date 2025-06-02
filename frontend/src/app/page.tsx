"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAnalysis } from "@/context/AnalysisContext";
import config from "@/config/config";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState(""); // Will store the summary now
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setSections, setSummary, setFullText, setFileName } = useAnalysis(); // Added setSummary, setFullText, setFileName

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      // Basic frontend validation (optional, as backend also validates)
      if (selectedFile.size > config.maxFileSizeMB * 1024 * 1024) {
        alert(`File is too large. Max size: ${config.maxFileSizeMB}MB`);
        setFile(null);
        e.target.value = ""; // Reset file input
        return;
      }
      if (!selectedFile.name.toLowerCase().endsWith(".pdf")) {
        alert("Please upload a PDF file.");
        setFile(null);
        e.target.value = ""; // Reset file input
        return;
      }
      setFile(selectedFile);
      setText(""); // Clear previous summary/text if a new file is selected
    }
  };

  const handleProcessDocument = async () => {
    if (!file) return;
    setLoading(true);
    setText("");

    try {
      const toast = (await import("react-hot-toast")).toast;
      const loadingToast = toast.loading("Processing document...");

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${config.apiUrl}/process-document/`, {
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
        full_text: string; // Snippet or full text based on backend
        summary: string;
      }

      const data = (await res.json()) as ProcessResponse;

      // Store the results in context
      setFileName(data.filename);
      setFullText(data.full_text); // Or fetch full text separately if backend sends snippet
      setSummary(data.summary);
      setSections([]); // Clear sections if not used by this flow, or adapt as needed

      toast.dismiss(loadingToast);
      toast.success("Document processed successfully!");

      router.push("/results"); // Navigate to results page to display summary
    } catch (error) {
      console.error("Error during document processing:", error);
      setText("An error occurred while processing the file. Please try again.");
      const toast = (await import("react-hot-toast")).toast;
      toast.error("Failed to process document. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-6">
      <div className="w-full max-w-xl rounded-xl shadow-lg bg-white dark:bg-gray-800 p-8">
        <h1 className="text-xl font-semibold mb-6 text-gray-800 dark:text-gray-200">
          Upload Employment Contract (PDF) for Summary
        </h1>

        {/* EnhancedTestUpload can be kept for debugging or removed */}
        {/* <EnhancedTestUpload /> */}

        <div className="flex flex-col gap-4">
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            className="file:mr-4 file:py-2 file:px-4
                       file:rounded file:border-0
                       file:text-sm file:font-semibold
                       file:bg-blue-600 file:text-white
                       hover:file:bg-blue-700
                       dark:file:bg-blue-500 dark:hover:file:bg-blue-600
                       text-gray-700 dark:text-gray-200"
          />

          <button
            onClick={handleProcessDocument} // Changed from form submit to direct button click
            disabled={!file || loading}
            className="py-2 px-4 rounded bg-blue-600 hover:bg-blue-700
                       disabled:bg-blue-300 text-white font-medium"
          >
            {loading ? "Processing…" : "Process Document"}
          </button>
        </div>

        {/* Displaying summary or status text, can be removed if results page handles all display */}
        {text && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">
              Status / Summary Preview
            </h2>
            <pre className="whitespace-pre-wrap bg-gray-100 dark:bg-gray-700 p-4 rounded text-sm text-gray-800 dark:text-gray-100 max-h-96 overflow-auto">
              {text}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
