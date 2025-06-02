"use client";
import { useAnalysis } from "@/context/AnalysisContext";
import { useRouter } from "next/navigation";

export default function Results() {
  const { summary, fullText, fileName, sections } = useAnalysis();
  const router = useRouter();

  if (!summary && !fileName && (!sections || sections.length === 0)) {
    return (
      <div className="min-h-[calc(100vh-10rem)] flex flex-col items-center justify-center space-y-4 p-4">
        <p className="text-center text-gray-600 dark:text-gray-400">
          No analysis results found. Please upload a document first.
        </p>
        <button
          onClick={() => router.push("/")}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Upload a Document
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">
          Analysis Results for:{" "}
          <span className="text-blue-600 dark:text-blue-400">
            {fileName || "Uploaded Document"}
          </span>
        </h1>
        <button
          onClick={() => router.push("/")}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          Upload Another Document
        </button>
      </div>

      {/* Displaying the full document summary */}
      {summary && (
        <div className="border rounded-lg overflow-hidden bg-white dark:bg-gray-800 shadow-md">
          <div className="bg-gray-100 dark:bg-gray-700 px-4 py-3 border-b dark:border-gray-600">
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">
              Document Summary
            </h2>
          </div>
          <div className="p-4 md:p-6">
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {summary}
            </p>
          </div>
        </div>
      )}

      {/* Displaying a preview of the extracted text */}
      {fullText && (
        <div className="border rounded-lg overflow-hidden bg-white dark:bg-gray-800 shadow-md mt-6">
          <div className="bg-gray-100 dark:bg-gray-700 px-4 py-3 border-b dark:border-gray-600">
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">
              Extracted Text Preview
            </h2>
          </div>
          <div className="p-4 md:p-6">
            <pre className="whitespace-pre-wrap bg-gray-50 dark:bg-gray-750 border dark:border-gray-650 p-4 rounded text-sm text-gray-800 dark:text-gray-200 max-h-[40vh] overflow-auto">
              {fullText}
            </pre>
          </div>
        </div>
      )}

      {/* Fallback or alternative display if sections are present from an old flow (optional) */}
      {!summary && sections && sections.length > 0 && (
        <div className="border rounded-lg overflow-hidden bg-white dark:bg-gray-800 shadow-md mt-6">
          <div className="bg-gray-100 dark:bg-gray-700 px-4 py-3 border-b dark:border-gray-600">
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">
              Sectional Analysis (Legacy)
            </h2>
          </div>
          <div className="p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Displaying legacy section-based analysis. The new flow provides a
              whole document summary.
            </p>
            {/* You can re-add the section display logic here if needed for backward compatibility */}
            {sections.map((section, idx) => (
              <div
                key={idx}
                className="mt-4 p-3 border rounded dark:border-gray-700"
              >
                <h3 className="font-medium text-gray-800 dark:text-gray-200">
                  {section.heading}
                </h3>
                {section.summary && (
                  <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                    Summary: {section.summary}
                  </p>
                )}
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Text: {section.text.substring(0, 100)}...
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
