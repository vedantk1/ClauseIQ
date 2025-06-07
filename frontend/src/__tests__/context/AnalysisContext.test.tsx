import { screen, fireEvent, waitFor } from "@testing-library/react";
import {
  renderWithProviders,
  mockApiResponses,
  mockFetch,
  createMockFile,
} from "../../utils/test-utils";
import { useAnalysis } from "../../context/AnalysisContext";
import { act } from "react";

// Test component to interact with AnalysisContext
function TestComponent() {
  const {
    documents,
    currentDocument,
    isLoading,
    error,
    analyzeDocument,
    analyzeClauses,
    loadDocuments,
    loadDocument,
    setSelectedClause,
    clearError,
    resetAnalysis,
  } = useAnalysis();

  return (
    <div>
      <div data-testid="loading-status">
        {isLoading ? "Loading" : "Not Loading"}
      </div>
      <div data-testid="error-status">{error || "No Error"}</div>
      <div data-testid="documents-count">Documents: {documents.length}</div>
      <div data-testid="current-document">
        Current: {currentDocument?.filename || "None"}
      </div>

      <input
        type="file"
        data-testid="file-input"
        onChange={(e) =>
          e.target.files?.[0] && analyzeDocument(e.target.files[0])
        }
      />
      <input
        type="file"
        data-testid="clause-file-input"
        onChange={(e) =>
          e.target.files?.[0] && analyzeClauses(e.target.files[0])
        }
      />
      <button onClick={() => loadDocument("doc-1")}>Load Document</button>
      <button onClick={loadDocuments}>Load Documents</button>
      <button
        onClick={() =>
          setSelectedClause({
            id: "clause-1",
            text: "Test clause",
            type: "liability",
            risk_level: "medium",
          } as any)
        }
      >
        Set Selected Clause
      </button>
      <button onClick={clearError}>Clear Error</button>
      <button onClick={resetAnalysis}>Reset Analysis</button>
    </div>
  );
}

describe("AnalysisContext", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("initializes with empty state", () => {
    renderWithProviders(<TestComponent />);

    expect(screen.getByTestId("loading-status")).toHaveTextContent(
      "Not Loading"
    );
    expect(screen.getByTestId("error-status")).toHaveTextContent("No Error");
    expect(screen.getByTestId("documents-count")).toHaveTextContent(
      "Documents: 0"
    );
    expect(screen.getByTestId("current-document")).toHaveTextContent(
      "Current: None"
    );
  });

  it("handles successful document analysis", async () => {
    const mockResponse = {
      id: "doc-1",
      filename: "test.pdf",
      summary: "Document summary",
      clauses: [
        {
          id: "clause-1",
          text: "Test clause",
          type: "liability",
          risk_level: "medium",
        },
      ],
      total_clauses: 1,
      risk_summary: { high: 0, medium: 1, low: 0 },
      full_text: "Document content",
    };

    global.fetch = mockFetch(mockApiResponses.successResponse(mockResponse));

    renderWithProviders(<TestComponent />);

    const fileInput = screen.getByTestId("file-input");
    const file = createMockFile("test.pdf");

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    await waitFor(() => {
      expect(screen.getByTestId("documents-count")).toHaveTextContent(
        "Documents: 1"
      );
      expect(screen.getByTestId("current-document")).toHaveTextContent(
        "Current: test.pdf"
      );
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/v1/analyze-document/",
      expect.objectContaining({
        method: "POST",
        body: expect.any(FormData),
      })
    );
  });

  it("handles document analysis failure", async () => {
    global.fetch = mockFetch(
      mockApiResponses.errorResponse(
        "ANALYSIS_FAILED",
        "Document analysis failed"
      ),
      400
    );

    renderWithProviders(<TestComponent />);

    const fileInput = screen.getByTestId("file-input");
    const file = createMockFile("test.pdf");

    try {
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });
    } catch {
      // Analysis is expected to throw an error on failure
    }

    await waitFor(() => {
      expect(screen.getByTestId("error-status")).toHaveTextContent(
        "Document analysis failed"
      );
      expect(screen.getByTestId("documents-count")).toHaveTextContent(
        "Documents: 0"
      );
    });
  });

  it("handles successful document analysis", async () => {
    const mockAnalysis = {
      id: "analysis-1",
      document_id: "doc-1",
      clauses: [{ id: "clause-1", text: "Test clause", type: "liability" }],
      status: "completed",
    };

    global.fetch = mockFetch(mockApiResponses.successResponse(mockAnalysis));

    renderWithProviders(<TestComponent />);

    await act(async () => {
      fireEvent.click(screen.getByText("Analyze Document"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("loading-status")).toHaveTextContent(
        "Not Loading"
      );
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/v1/documents/doc-1/analyze",
      expect.objectContaining({
        method: "POST",
      })
    );
  });

  it("handles document analysis failure", async () => {
    global.fetch = mockFetch(
      mockApiResponses.errorResponse("ANALYSIS_FAILED", "Analysis failed"),
      500
    );

    renderWithProviders(<TestComponent />);

    await act(async () => {
      fireEvent.click(screen.getByText("Analyze Document"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("error-status")).toHaveTextContent(
        "Analysis failed"
      );
    });
  });

  it("fetches documents successfully", async () => {
    const mockDocuments = [
      {
        id: "doc-1",
        name: "document1.pdf",
        upload_date: "2023-01-01T00:00:00Z",
        file_size: 1024,
        status: "analyzed",
      },
      {
        id: "doc-2",
        name: "document2.pdf",
        upload_date: "2023-01-02T00:00:00Z",
        file_size: 2048,
        status: "uploaded",
      },
    ];

    global.fetch = mockFetch(mockApiResponses.paginatedResponse(mockDocuments));

    renderWithProviders(<TestComponent />);

    await act(async () => {
      fireEvent.click(screen.getByText("Fetch Documents"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("documents-count")).toHaveTextContent(
        "Documents: 2"
      );
    });
  });

  it("handles fetch documents failure", async () => {
    global.fetch = mockFetch(
      mockApiResponses.errorResponse(
        "FETCH_FAILED",
        "Failed to fetch documents"
      ),
      500
    );

    renderWithProviders(<TestComponent />);

    await act(async () => {
      fireEvent.click(screen.getByText("Fetch Documents"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("error-status")).toHaveTextContent(
        "Failed to fetch documents"
      );
    });
  });

  it("sets current document", () => {
    renderWithProviders(<TestComponent />);

    act(() => {
      fireEvent.click(screen.getByText("Set Current Document"));
    });

    expect(screen.getByTestId("current-document")).toHaveTextContent(
      "Current: Test Doc"
    );
  });

  it("clears error state", async () => {
    global.fetch = mockFetch(
      mockApiResponses.errorResponse("TEST_ERROR", "Test error"),
      400
    );

    renderWithProviders(<TestComponent />);

    // First trigger an error
    await act(async () => {
      fireEvent.click(screen.getByText("Analyze Document"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("error-status")).toHaveTextContent(
        "Test error"
      );
    });

    // Then clear the error
    act(() => {
      fireEvent.click(screen.getByText("Clear Error"));
    });

    expect(screen.getByTestId("error-status")).toHaveTextContent("No Error");
  });

  it("shows loading state during operations", async () => {
    // Mock a delayed response
    global.fetch = jest.fn().mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: () =>
                  Promise.resolve(mockApiResponses.successResponse({})),
              }),
            100
          )
        )
    );

    renderWithProviders(<TestComponent />);

    act(() => {
      fireEvent.click(screen.getByText("Analyze Document"));
    });

    // Should show loading state
    expect(screen.getByTestId("loading-status")).toHaveTextContent("Loading");

    await waitFor(() => {
      expect(screen.getByTestId("loading-status")).toHaveTextContent(
        "Not Loading"
      );
    });
  });

  it("handles network errors gracefully", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));

    renderWithProviders(<TestComponent />);

    await act(async () => {
      fireEvent.click(screen.getByText("Fetch Documents"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("error-status")).toHaveTextContent(
        "Network error"
      );
    });
  });
});
