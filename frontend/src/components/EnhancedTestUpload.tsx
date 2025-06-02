"use client";
import { useState, ChangeEvent } from "react";
import toast from "react-hot-toast";
import config from "@/config/config";

// Configuration constants
const MAX_FILE_SIZE_MB = config.maxFileSizeMB;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_FILE_TYPES = [".pdf"];
const API_URL = config.apiUrl;

// File validation function
const validateFile = (file: File): { isValid: boolean; error?: string } => {
  // Check file size
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      isValid: false,
      error: `File too large. Maximum size allowed: ${MAX_FILE_SIZE_MB}MB. Your file: ${(
        file.size /
        1024 /
        1024
      ).toFixed(2)}MB`,
    };
  }

  // Check file type
  const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();
  if (!ALLOWED_FILE_TYPES.includes(fileExtension)) {
    return {
      isValid: false,
      error: `File type not supported. Allowed types: ${ALLOWED_FILE_TYPES.join(
        ", "
      )}`,
    };
  }

  return { isValid: true };
};

export default function TestUpload() {
  const [response, setResponse] = useState<Record<string, unknown> | null>(
    null
  );
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileProcessing = async (selectedFile: File) => {
    setIsProcessing(true);
    const loadingToast = toast.loading(
      "Processing file with both endpoints..."
    );

    const fileInfoForResponse = {
      name: selectedFile.name, // Use selectedFile argument
      type: selectedFile.type, // Use selectedFile argument
      size: `${(selectedFile.size / 1024).toFixed(2)} KB`, // Use selectedFile argument
    };

    try {
      setResponse({
        status: "processing",
        fileInfo: fileInfoForResponse,
      });

      let extractTextData: Record<string, unknown> = { error: "Not processed" };
      let extractTextStatus: number = 0;
      let extractTextOk = false;
      let analyzeData: Record<string, unknown> = { error: "Not processed" };
      let analyzeStatus: number = 0;
      let analyzeOk = false;

      // FormData for the first request
      const formDataExtract = new FormData();
      formDataExtract.append("file", selectedFile); // Use selectedFile argument

      try {
        const extractTextRes = await fetch(`${API_URL}/extract-text/`, {
          method: "POST",
          body: formDataExtract,
        });
        extractTextData = await extractTextRes.json();
        extractTextStatus = extractTextRes.status;
        extractTextOk = extractTextRes.ok;
        if (!extractTextOk) {
          toast.error(
            `Extract-text error (${extractTextStatus}): ${
              (extractTextData.detail ||
                extractTextData.error ||
                "Unknown error") as string
            }`
          );
        }
      } catch (fetchError) {
        console.error("Error fetching /extract-text/:", fetchError);
        toast.error("Failed to fetch from /extract-text/");
        extractTextData = {
          error: "Fetch failed",
          message:
            fetchError instanceof Error
              ? fetchError.message
              : String(fetchError),
        };
      }

      // FormData for the second request
      const formDataAnalyze = new FormData();
      formDataAnalyze.append("file", selectedFile); // Use selectedFile argument

      try {
        const analyzeRes = await fetch(`${API_URL}/analyze/`, {
          method: "POST",
          body: formDataAnalyze,
        });
        analyzeData = await analyzeRes.json();
        analyzeStatus = analyzeRes.status;
        analyzeOk = analyzeRes.ok;
        if (!analyzeOk) {
          toast.error(
            `Analyze error (${analyzeStatus}): ${
              (analyzeData.detail ||
                analyzeData.error ||
                "Unknown error") as string
            }`
          );
        }
      } catch (fetchError) {
        console.error("Error fetching /analyze/:", fetchError);
        toast.error("Failed to fetch from /analyze/");
        analyzeData = {
          error: "Fetch failed",
          message:
            fetchError instanceof Error
              ? fetchError.message
              : String(fetchError),
        };
      }

      setResponse({
        fileInfo: fileInfoForResponse,
        extractTextResult: {
          status: extractTextStatus,
          ok: extractTextOk,
          data: extractTextData,
        },
        analyzeResult: {
          status: analyzeStatus,
          ok: analyzeOk,
          data: analyzeData,
        },
      });

      if (extractTextOk && analyzeOk) {
        toast.success("File processed successfully by both endpoints!");
      } else if (extractTextOk || analyzeOk) {
        toast.custom(
          (t) => (
            <div
              className={`${
                t.visible ? "animate-enter" : "animate-leave"
              } max-w-md w-full bg-amber-100 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
            >
              <div className="flex-1 w-0 p-4">
                <div className="flex items-start">
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-medium text-amber-800">
                      Partial Success
                    </p>
                    <p className="mt-1 text-sm text-amber-700">
                      File processed, but one endpoint reported an error. Check
                      response details.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex border-l border-amber-200">
                <button
                  onClick={() => toast.dismiss(t.id)}
                  className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-amber-600 hover:text-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  Close
                </button>
              </div>
            </div>
          ),
          { id: "partial-success-toast" }
        );
      } else {
        toast.error(
          "Both endpoints failed to process the file. Check response details."
        );
      }
    } catch (error) {
      console.error("Error in handleFileProcessing:", error);
      toast.error("An unexpected error occurred. Check console.");
      setResponse({
        error: true,
        message: String(error),
        fileInfo: fileInfoForResponse,
      });
    } finally {
      toast.dismiss(loadingToast);
      setIsProcessing(false);
    }
  };

  const onFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    // New handler
    const currentFile = e.target.files?.[0];
    if (currentFile) {
      // Validate file before processing
      const validation = validateFile(currentFile);
      if (!validation.isValid) {
        toast.error(validation.error || "File validation failed");
        e.target.value = ""; // Reset input
        return;
      }

      await handleFileProcessing(currentFile);
    }
    // Reset file input to allow selecting the same file again
    e.target.value = "";
  };

  return (
    <div className="p-4 border rounded-lg bg-gray-50 mb-6">
      <h2 className="text-lg font-medium mb-2">Enhanced PDF Test Tool</h2>

      {/* Changed from form to div, removed onSubmit and handleSubmit */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept=".pdf"
            onChange={onFileChange}
            disabled={isProcessing}
            className="border p-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {isProcessing && (
            <span className="text-sm text-blue-600 animate-pulse">
              Processing...
            </span>
          )}
        </div>
      </div>

      {response && (
        <div className="mt-4 border-t pt-4">
          <h3 className="font-medium">Server Response:</h3>
          <pre className="mt-2 p-3 bg-gray-200 rounded text-xs overflow-x-auto max-h-60 overflow-y-auto">
            {JSON.stringify(response, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
