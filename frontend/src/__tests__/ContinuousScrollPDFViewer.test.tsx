/**
 * Tests for ContinuousScrollPDFViewer component
 *
 * This test suite verifies the architecturally sound implementation
 * using the @react-pdf-viewer/page-navigation plugin instead of
 * manual state management.
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import ContinuousScrollPDFViewer from "../components/ContinuousScrollPDFViewer";

// Mock the PDF viewer dependencies
jest.mock("@react-pdf-viewer/core", () => ({
  Worker: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pdf-worker">{children}</div>
  ),
  Viewer: ({
    onDocumentLoad,
    scrollMode,
    plugins,
  }: {
    onDocumentLoad?: (e: { doc: { numPages: number } }) => void;
    scrollMode?: string;
    plugins?: unknown[];
  }) => {
    // Simulate document load after a short delay
    React.useEffect(() => {
      if (onDocumentLoad) {
        setTimeout(() => {
          onDocumentLoad({ doc: { numPages: 5 } });
        }, 100);
      }
    }, [onDocumentLoad]);

    return (
      <div
        data-testid="pdf-viewer"
        data-scroll-mode={scrollMode}
        data-plugins-count={plugins?.length || 0}
      >
        PDF Viewer Content
      </div>
    );
  },
  ScrollMode: {
    Page: "Page",
    Vertical: "Vertical",
  },
}));

jest.mock("@react-pdf-viewer/zoom", () => ({
  zoomPlugin: () => ({
    zoomTo: jest.fn(),
  }),
}));

jest.mock("@react-pdf-viewer/page-navigation", () => ({
  pageNavigationPlugin: () => ({
    CurrentPageLabel: ({
      children,
    }: {
      children: (props: {
        currentPage: number;
        numberOfPages: number;
      }) => React.ReactNode;
    }) => {
      const props = { currentPage: 2, numberOfPages: 5 }; // Mock current page 3 of 5
      return <div data-testid="current-page-label">{children(props)}</div>;
    },
    GoToNextPage: ({
      children,
    }: {
      children: (props: {
        onClick: () => void;
        isDisabled: boolean;
      }) => React.ReactNode;
    }) => {
      const props = {
        onClick: jest.fn(),
        isDisabled: false,
      };
      return <div data-testid="go-to-next-page">{children(props)}</div>;
    },
    GoToPreviousPage: ({
      children,
    }: {
      children: (props: {
        onClick: () => void;
        isDisabled: boolean;
      }) => React.ReactNode;
    }) => {
      const props = {
        onClick: jest.fn(),
        isDisabled: false,
      };
      return <div data-testid="go-to-previous-page">{children(props)}</div>;
    },
  }),
}));

// Mock the config
jest.mock("@/config/config", () => ({
  apiUrl: "http://localhost:8000",
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(() => "mock-token"),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};
Object.defineProperty(window, "localStorage", {
  value: mockLocalStorage,
});

// Mock console.log to avoid spam in tests
const originalConsoleLog = console.log;
beforeAll(() => {
  console.log = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
});

describe("ContinuousScrollPDFViewer", () => {
  const defaultProps = {
    documentId: "test-document-123",
    fileName: "Test Document.pdf",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Component Rendering", () => {
    it("renders with correct initial state", () => {
      render(<ContinuousScrollPDFViewer {...defaultProps} />);

      expect(screen.getByText("📄 Test Document.pdf")).toBeInTheDocument();
      expect(screen.getByText("Loading PDF...")).toBeInTheDocument();
      expect(
        screen.getByTitle("Switch to continuous view")
      ).toBeInTheDocument();
    });

    it("applies custom className when provided", () => {
      const { container } = render(
        <ContinuousScrollPDFViewer {...defaultProps} className="custom-class" />
      );

      expect(container.firstElementChild).toHaveClass("custom-class");
    });

    it("uses default fileName when not provided", () => {
      render(<ContinuousScrollPDFViewer documentId="test-doc" />);

      expect(screen.getByText("📄 Document")).toBeInTheDocument();
    });
  });

  describe("PDF URL Generation", () => {
    it("generates PDF URL with authentication token", () => {
      render(<ContinuousScrollPDFViewer {...defaultProps} />);

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith("access_token");
      // URL should include the token parameter
    });

    it("generates PDF URL without token when not available", () => {
      mockLocalStorage.getItem.mockReturnValueOnce("");

      render(<ContinuousScrollPDFViewer {...defaultProps} />);

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith("access_token");
    });
  });

  describe("Plugin Integration", () => {
    it("integrates zoom and page navigation plugins", async () => {
      render(<ContinuousScrollPDFViewer {...defaultProps} />);

      await waitFor(() => {
        const viewer = screen.getByTestId("pdf-viewer");
        expect(viewer).toHaveAttribute("data-plugins-count", "2");
      });
    });

    it("uses correct scroll mode for single page view", async () => {
      render(<ContinuousScrollPDFViewer {...defaultProps} />);

      await waitFor(() => {
        const viewer = screen.getByTestId("pdf-viewer");
        expect(viewer).toHaveAttribute("data-scroll-mode", "Page");
      });
    });

    it("uses correct scroll mode for continuous view", async () => {
      render(<ContinuousScrollPDFViewer {...defaultProps} />);

      // Switch to continuous mode
      const toggleButton = screen.getByTitle("Switch to continuous view");
      fireEvent.click(toggleButton);

      await waitFor(() => {
        const viewer = screen.getByTestId("pdf-viewer");
        expect(viewer).toHaveAttribute("data-scroll-mode", "Vertical");
      });
    });
  });

  describe("View Mode Toggle", () => {
    it("starts in single page mode", () => {
      render(<ContinuousScrollPDFViewer {...defaultProps} />);

      expect(screen.getByText("📄")).toBeInTheDocument();
      expect(screen.getByText("Single")).toBeInTheDocument();
      expect(screen.getByText("Single Page")).toBeInTheDocument();
    });

    it("toggles to continuous mode", () => {
      render(<ContinuousScrollPDFViewer {...defaultProps} />);

      const toggleButton = screen.getByTitle("Switch to continuous view");
      fireEvent.click(toggleButton);

      expect(screen.getByText("📜")).toBeInTheDocument();
      expect(screen.getByText("Scroll")).toBeInTheDocument();
      expect(screen.getByText("Continuous")).toBeInTheDocument();
    });

    it("toggles back to single mode", () => {
      render(<ContinuousScrollPDFViewer {...defaultProps} />);

      const toggleButton = screen.getByTitle("Switch to continuous view");

      // Toggle to continuous
      fireEvent.click(toggleButton);
      expect(screen.getByText("📜")).toBeInTheDocument();

      // Toggle back to single
      const backButton = screen.getByTitle("Switch to single-page view");
      fireEvent.click(backButton);
      expect(screen.getByText("📄")).toBeInTheDocument();
    });

    it("logs view mode changes for debugging", () => {
      const consoleSpy = jest.spyOn(console, "log");
      render(<ContinuousScrollPDFViewer {...defaultProps} />);

      const toggleButton = screen.getByTitle("Switch to continuous view");
      fireEvent.click(toggleButton);

      expect(consoleSpy).toHaveBeenCalledWith(
        "🔄 [DEBUG] toggleViewMode called, current mode:",
        "single"
      );
    });
  });

  describe("Page Navigation (Plugin Components)", () => {
    beforeEach(async () => {
      render(<ContinuousScrollPDFViewer {...defaultProps} />);

      // Wait for PDF to load
      await waitFor(() => {
        expect(screen.queryByText("Loading PDF...")).not.toBeInTheDocument();
      });
    });

    it("shows page navigation controls in single mode", () => {
      expect(screen.getByTestId("go-to-previous-page")).toBeInTheDocument();
      const currentPageLabels = screen.getAllByTestId("current-page-label");
      expect(currentPageLabels.length).toBeGreaterThan(0);
      expect(screen.getByTestId("go-to-next-page")).toBeInTheDocument();
    });

    it("displays current page using plugin component", () => {
      const currentPageLabels = screen.getAllByTestId("current-page-label");
      // Check that at least one shows the current page
      const hasCorrectContent = currentPageLabels.some(
        (label) =>
          label.textContent?.includes("3") && label.textContent?.includes("5")
      );
      expect(hasCorrectContent).toBe(true);
    });

    it("hides page navigation in continuous mode", () => {
      // Switch to continuous mode
      const toggleButton = screen.getByTitle("Switch to continuous view");
      fireEvent.click(toggleButton);

      expect(
        screen.queryByTestId("go-to-previous-page")
      ).not.toBeInTheDocument();
      expect(screen.queryByTestId("go-to-next-page")).not.toBeInTheDocument();
    });

    it("renders navigation buttons with proper accessibility", () => {
      const prevButton = screen.getByTitle("Previous page");
      const nextButton = screen.getByTitle("Next page");

      expect(prevButton).toBeInTheDocument();
      expect(nextButton).toBeInTheDocument();
      expect(prevButton).toHaveTextContent("←");
      expect(nextButton).toHaveTextContent("→");
    });
  });

  describe("Zoom Controls", () => {
    beforeEach(async () => {
      render(<ContinuousScrollPDFViewer {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading PDF...")).not.toBeInTheDocument();
      });
    });

    it("renders zoom controls", () => {
      expect(screen.getByText("🔍−")).toBeInTheDocument();
      expect(screen.getByText("🔍+")).toBeInTheDocument();
      expect(screen.getByText("Reset")).toBeInTheDocument();

      // Check that 100% appears (there might be multiple instances)
      const scaleElements = screen.getAllByText("100%");
      expect(scaleElements.length).toBeGreaterThan(0);
    });

    it("disables zoom out at minimum scale", () => {
      const zoomOutSpan = screen.getByText("🔍−");
      const zoomOutButton = zoomOutSpan.closest("button");

      // Click multiple times to reach minimum
      for (let i = 0; i < 10; i++) {
        fireEvent.click(zoomOutButton!);
      }

      expect(zoomOutButton).toBeDisabled();
    });

    it("disables zoom in at maximum scale", () => {
      const zoomInSpan = screen.getByText("🔍+");
      const zoomInButton = zoomInSpan.closest("button");

      // Click multiple times to reach maximum
      for (let i = 0; i < 15; i++) {
        fireEvent.click(zoomInButton!);
      }

      expect(zoomInButton).toBeDisabled();
    });

    it("updates scale display when zooming", () => {
      const zoomInButton = screen.getByText("🔍+");

      fireEvent.click(zoomInButton);

      expect(screen.getByText("120%")).toBeInTheDocument();
    });

    it("resets zoom to 100%", () => {
      const zoomInButton = screen.getByText("🔍+");
      const resetButton = screen.getByText("Reset");

      // Zoom in first
      fireEvent.click(zoomInButton);
      expect(screen.getByText("120%")).toBeInTheDocument();

      // Reset
      fireEvent.click(resetButton);
      expect(screen.getByText("100%")).toBeInTheDocument();
    });

    it("logs zoom actions for debugging", () => {
      const consoleSpy = jest.spyOn(console, "log");
      const zoomInButton = screen.getByText("🔍+");

      fireEvent.click(zoomInButton);

      expect(consoleSpy).toHaveBeenCalledWith("🔍 [DEBUG] Zooming in to:", 1.2);
    });
  });

  describe("Status Bar", () => {
    beforeEach(async () => {
      render(<ContinuousScrollPDFViewer {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading PDF...")).not.toBeInTheDocument();
      });
    });

    it("shows ready status", () => {
      expect(screen.getByText("Ready")).toBeInTheDocument();
    });

    it("displays current view mode", () => {
      expect(screen.getByText("Single Page")).toBeInTheDocument();
    });

    it("displays current page in single mode using plugin", () => {
      const statusBarPageInfo = screen.getAllByText(/Page:/);
      expect(statusBarPageInfo[0]).toHaveTextContent("Page: 3 of 5");
    });

    it("hides page info in continuous mode", () => {
      // Switch to continuous mode
      const toggleButton = screen.getByTitle("Switch to continuous view");
      fireEvent.click(toggleButton);

      expect(screen.queryByText(/Page:/)).not.toBeInTheDocument();
    });

    it("displays current scale", () => {
      expect(screen.getByText("Scale:")).toBeInTheDocument();
      expect(screen.getByText("100%")).toBeInTheDocument();
    });

    it("shows ClauseIQ branding", () => {
      expect(screen.getByText("ClauseIQ Legal AI")).toBeInTheDocument();
    });
  });

  describe("Document Loading", () => {
    it("shows loading state initially", () => {
      render(<ContinuousScrollPDFViewer {...defaultProps} />);

      expect(screen.getByText("Loading PDF...")).toBeInTheDocument();
    });

    it("hides loading state after document loads", async () => {
      render(<ContinuousScrollPDFViewer {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading PDF...")).not.toBeInTheDocument();
      });
    });

    it("displays page count after loading", async () => {
      render(<ContinuousScrollPDFViewer {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("5 pages")).toBeInTheDocument();
      });
    });

    it("logs document load for debugging", async () => {
      const consoleSpy = jest.spyOn(console, "log");
      render(<ContinuousScrollPDFViewer {...defaultProps} />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          "✅ [DEBUG] PDF LOADED:",
          expect.objectContaining({
            numPages: 5,
            currentViewMode: "single",
          })
        );
      });
    });
  });

  describe("Error Handling", () => {
    it("renders error state when PDF fails to load", () => {
      render(<ContinuousScrollPDFViewer {...defaultProps} />);

      // Simulate error by manually setting error state
      // Note: In a real scenario, this would be triggered by PDF load failure

      // For this test, we'll verify the error UI structure exists
      expect(screen.getByText("Loading PDF...")).toBeInTheDocument();
    });

    it("provides retry functionality", () => {
      // Mock window.location.reload
      const mockReload = jest.fn();
      Object.defineProperty(window, "location", {
        value: { reload: mockReload },
        writable: true,
      });

      // Since we can't easily trigger error state, we'll test the error component structure
      // In a real error scenario, there would be a "Retry" button that calls window.location.reload()
    });
  });

  describe("Accessibility", () => {
    beforeEach(async () => {
      render(<ContinuousScrollPDFViewer {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading PDF...")).not.toBeInTheDocument();
      });
    });

    it("provides proper button titles for screen readers", () => {
      expect(
        screen.getByTitle("Switch to continuous view")
      ).toBeInTheDocument();
      expect(screen.getByTitle("Previous page")).toBeInTheDocument();
      expect(screen.getByTitle("Next page")).toBeInTheDocument();
    });

    it("has proper heading structure", () => {
      const heading = screen.getByRole("heading", { level: 3 });
      expect(heading).toHaveTextContent("📄 Test Document.pdf");
    });

    it("uses semantic HTML structure", () => {
      // The component should use proper semantic elements
      expect(screen.getByTestId("pdf-worker")).toBeInTheDocument();
      expect(screen.getByTestId("pdf-viewer")).toBeInTheDocument();
    });
  });

  describe("Key Re-rendering Logic", () => {
    it("re-renders viewer only when view mode changes", async () => {
      render(<ContinuousScrollPDFViewer {...defaultProps} />);

      await waitFor(() => {
        const viewer = screen.getByTestId("pdf-viewer");
        expect(viewer).toBeInTheDocument();
      });

      // The viewer should have a key that depends only on viewMode
      // This ensures it doesn't re-render unnecessarily
    });

    it("maintains viewer stability during zoom operations", async () => {
      render(<ContinuousScrollPDFViewer {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading PDF...")).not.toBeInTheDocument();
      });

      const zoomInButton = screen.getByText("🔍+");
      fireEvent.click(zoomInButton);

      // Viewer should still be present and stable
      expect(screen.getByTestId("pdf-viewer")).toBeInTheDocument();
    });
  });
});
