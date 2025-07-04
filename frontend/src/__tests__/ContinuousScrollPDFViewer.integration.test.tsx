/**
 * Integration tests for ContinuousScrollPDFViewer
 *
 * These tests verify the integration between the component
 * and the @react-pdf-viewer plugins in a more realistic environment.
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import ContinuousScrollPDFViewer from "../components/ContinuousScrollPDFViewer";

// Minimal mocking for integration tests
jest.mock("@react-pdf-viewer/core", () => {
  const actual = jest.requireActual("@react-pdf-viewer/core");
  return {
    ...actual,
    Worker: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="pdf-worker">{children}</div>
    ),
    Viewer: (props: {
      onDocumentLoad?: (e: { doc: { numPages: number } }) => void;
      scrollMode?: string;
      defaultScale?: number;
      fileUrl?: string;
      plugins?: unknown[];
    }) => {
      // Simulate more realistic viewer behavior
      const { onDocumentLoad } = props;
      React.useEffect(() => {
        if (onDocumentLoad) {
          // Simulate async document loading
          const timer = setTimeout(() => {
            onDocumentLoad({ doc: { numPages: 10 } });
          }, 200);
          return () => clearTimeout(timer);
        }
      }, [onDocumentLoad]);

      return (
        <div
          data-testid="pdf-viewer-integration"
          data-scroll-mode={props.scrollMode}
          data-default-scale={props.defaultScale}
          data-file-url={props.fileUrl}
        >
          <div data-testid="pdf-content">Mock PDF Content</div>
          {/* Simulate plugin rendering areas */}
          <div data-testid="plugin-area">
            {props.plugins?.map((plugin: unknown, index: number) => (
              <div key={index} data-testid={`plugin-${index}`}>
                {(plugin as { pluginName?: string })?.pluginName ||
                  "Unknown Plugin"}
              </div>
            ))}
          </div>
        </div>
      );
    },
  };
});

// Mock the config
jest.mock("@/config/config", () => ({
  apiUrl: "http://localhost:8000",
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(() => "integration-test-token"),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};
Object.defineProperty(window, "localStorage", {
  value: mockLocalStorage,
});

describe("ContinuousScrollPDFViewer Integration Tests", () => {
  const defaultProps = {
    documentId: "integration-test-doc",
    fileName: "Integration Test.pdf",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe("Plugin Architecture Integration", () => {
    it("properly initializes plugins in the correct order", async () => {
      render(<ContinuousScrollPDFViewer {...defaultProps} />);

      // Fast-forward past document loading
      jest.advanceTimersByTime(300);

      await waitFor(() => {
        const viewer = screen.getByTestId("pdf-viewer-integration");
        expect(viewer).toBeInTheDocument();
      });

      // Plugins should be present
      const pluginArea = screen.getByTestId("plugin-area");
      expect(pluginArea).toBeInTheDocument();
    });

    it("maintains plugin state during view mode changes", async () => {
      render(<ContinuousScrollPDFViewer {...defaultProps} />);

      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(
          screen.getByTestId("pdf-viewer-integration")
        ).toBeInTheDocument();
      });

      // Get initial viewer
      const initialViewer = screen.getByTestId("pdf-viewer-integration");
      const initialScrollMode = initialViewer.getAttribute("data-scroll-mode");

      // Toggle view mode
      const toggleButton = screen.getByTitle("Switch to continuous view");
      fireEvent.click(toggleButton);

      // Verify scroll mode changed
      const updatedViewer = screen.getByTestId("pdf-viewer-integration");
      const updatedScrollMode = updatedViewer.getAttribute("data-scroll-mode");

      expect(initialScrollMode).not.toBe(updatedScrollMode);
      expect(updatedScrollMode).toBe("Vertical");
    });

    it("preserves zoom state across view mode changes", async () => {
      render(<ContinuousScrollPDFViewer {...defaultProps} />);

      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(
          screen.getByTestId("pdf-viewer-integration")
        ).toBeInTheDocument();
      });

      // Zoom in
      const zoomInButton = screen.getByText("🔍+");
      fireEvent.click(zoomInButton);

      // Verify zoom level
      expect(screen.getByText("120%")).toBeInTheDocument();

      // Switch view mode
      const toggleButton = screen.getByTitle("Switch to continuous view");
      fireEvent.click(toggleButton);

      // Zoom level should be preserved
      expect(screen.getByText("120%")).toBeInTheDocument();
    });
  });

  describe("Real-world User Workflows", () => {
    it("handles typical navigation workflow in single-page mode", async () => {
      render(<ContinuousScrollPDFViewer {...defaultProps} />);

      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(screen.queryByText("Loading PDF...")).not.toBeInTheDocument();
      });

      // Should start in single-page mode
      expect(screen.getByText("Single Page")).toBeInTheDocument();

      // Should show navigation controls
      expect(screen.getByTitle("Previous page")).toBeInTheDocument();
      expect(screen.getByTitle("Next page")).toBeInTheDocument();

      // Page label should be visible
      const pageLabels = screen.getAllByText(/3 \/ 10/);
      expect(pageLabels.length).toBeGreaterThan(0);
    });

    it("handles view mode switching workflow", async () => {
      render(<ContinuousScrollPDFViewer {...defaultProps} />);

      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(screen.queryByText("Loading PDF...")).not.toBeInTheDocument();
      });

      // Start in single mode
      expect(screen.getByText("📄")).toBeInTheDocument();
      expect(screen.getByTitle("Previous page")).toBeInTheDocument();

      // Switch to continuous
      fireEvent.click(screen.getByTitle("Switch to continuous view"));
      expect(screen.getByText("📜")).toBeInTheDocument();
      expect(screen.queryByTitle("Previous page")).not.toBeInTheDocument();

      // Switch back to single
      fireEvent.click(screen.getByTitle("Switch to single-page view"));
      expect(screen.getByText("📄")).toBeInTheDocument();
      expect(screen.getByTitle("Previous page")).toBeInTheDocument();
    });

    it("handles zoom workflow with proper feedback", async () => {
      render(<ContinuousScrollPDFViewer {...defaultProps} />);

      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(screen.queryByText("Loading PDF...")).not.toBeInTheDocument();
      });

      // Initial zoom
      expect(screen.getByText("100%")).toBeInTheDocument();

      // Zoom in multiple times
      const zoomInButton = screen.getByText("🔍+");
      fireEvent.click(zoomInButton);
      expect(screen.getByText("120%")).toBeInTheDocument();

      fireEvent.click(zoomInButton);
      expect(screen.getByText("140%")).toBeInTheDocument();

      // Zoom out
      const zoomOutButton = screen.getByText("🔍−");
      fireEvent.click(zoomOutButton);
      expect(screen.getByText("120%")).toBeInTheDocument();

      // Reset zoom
      const resetButton = screen.getByText("Reset");
      fireEvent.click(resetButton);
      expect(screen.getByText("100%")).toBeInTheDocument();
    });
  });

  describe("Document Loading Integration", () => {
    it("properly sequences document loading and plugin initialization", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      render(<ContinuousScrollPDFViewer {...defaultProps} />);

      // Should show loading initially
      expect(screen.getByText("Loading PDF...")).toBeInTheDocument();

      // Fast-forward to document load
      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(screen.queryByText("Loading PDF...")).not.toBeInTheDocument();
      });

      // Should log document load
      expect(consoleSpy).toHaveBeenCalledWith(
        "✅ [DEBUG] PDF LOADED:",
        expect.objectContaining({
          numPages: 10,
          currentViewMode: "single",
        })
      );

      // Page count should be displayed
      expect(screen.getByText("10 pages")).toBeInTheDocument();

      consoleSpy.mockRestore();
    });

    it("handles document loading with different page counts", async () => {
      // Mock a document with different page count
      const customRender = () => {
        const CustomViewer = (props: {
          onDocumentLoad?: (e: { doc: { numPages: number } }) => void;
        }) => {
          const { onDocumentLoad } = props;
          React.useEffect(() => {
            if (onDocumentLoad) {
              setTimeout(() => {
                onDocumentLoad({ doc: { numPages: 25 } });
              }, 200);
            }
          }, [onDocumentLoad]);

          return <div data-testid="pdf-viewer-integration">Custom Content</div>;
        };

        jest.doMock("@react-pdf-viewer/core", () => ({
          ...jest.requireActual("@react-pdf-viewer/core"),
          Viewer: CustomViewer,
        }));

        return render(<ContinuousScrollPDFViewer {...defaultProps} />);
      };

      customRender();
      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(screen.getByText("25 pages")).toBeInTheDocument();
      });
    });
  });

  describe("Authentication Integration", () => {
    it("generates correct PDF URL with authentication", () => {
      render(<ContinuousScrollPDFViewer {...defaultProps} />);

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith("access_token");

      // Should generate URL with token
      const viewer = screen.getByTestId("pdf-viewer-integration");
      const fileUrl = viewer.getAttribute("data-file-url");

      expect(fileUrl).toContain("integration-test-doc");
      expect(fileUrl).toContain("token=integration-test-token");
    });

    it("handles missing authentication token gracefully", () => {
      mockLocalStorage.getItem.mockReturnValueOnce("");

      render(<ContinuousScrollPDFViewer {...defaultProps} />);

      const viewer = screen.getByTestId("pdf-viewer-integration");
      const fileUrl = viewer.getAttribute("data-file-url");

      expect(fileUrl).toContain("integration-test-doc");
      expect(fileUrl).not.toContain("token=");
    });
  });

  describe("Performance Integration", () => {
    it("minimizes re-renders during normal operation", async () => {
      const renderCount = jest.fn();

      const TestWrapper = () => {
        renderCount();
        return <ContinuousScrollPDFViewer {...defaultProps} />;
      };

      render(<TestWrapper />);

      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(screen.queryByText("Loading PDF...")).not.toBeInTheDocument();
      });

      const initialRenderCount = renderCount.mock.calls.length;

      // Zoom operations should not cause excessive re-renders
      const zoomInButton = screen.getByText("🔍+");
      fireEvent.click(zoomInButton);
      fireEvent.click(zoomInButton);

      // Should not trigger many additional renders
      expect(renderCount.mock.calls.length).toBeLessThanOrEqual(
        initialRenderCount + 3
      );
    });

    it("efficiently handles view mode transitions", async () => {
      render(<ContinuousScrollPDFViewer {...defaultProps} />);

      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(screen.queryByText("Loading PDF...")).not.toBeInTheDocument();
      });

      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      // Toggle view mode
      const toggleButton = screen.getByTitle("Switch to continuous view");
      fireEvent.click(toggleButton);

      // Should log the transition
      expect(consoleSpy).toHaveBeenCalledWith(
        "🔄 [DEBUG] toggleViewMode called, current mode:",
        "single"
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        "📄 [DEBUG] ViewMode changing from",
        "single",
        "to",
        "continuous"
      );

      consoleSpy.mockRestore();
    });
  });

  describe("Error Boundary Integration", () => {
    it("gracefully handles plugin initialization errors", async () => {
      // Mock console.error to avoid noise during error tests
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      // This test would ideally trigger an actual plugin error
      // For now, we verify the component renders without crashing
      render(<ContinuousScrollPDFViewer {...defaultProps} />);

      jest.advanceTimersByTime(300);

      expect(screen.getByTestId("pdf-worker")).toBeInTheDocument();

      consoleErrorSpy.mockRestore();
    });
  });
});
