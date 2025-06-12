/**
 * Testing utilities for ClauseIQ frontend components
 */
import React from "react";
import { render, RenderOptions } from "@testing-library/react";
import { ReactElement } from "react";
import { AppStateProvider } from "@/store/appState";
import { AuthProvider } from "@/context/AuthContext";
import { AnalysisProvider } from "@/context/AnalysisContext";

// Custom render function with all providers
interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
  initialState?: {
    auth?: {
      user?: {
        id: string;
        email: string;
        full_name?: string;
      };
      isAuthenticated?: boolean;
      isLoading?: boolean;
    };
    analysis?: {
      documents?: Array<{
        id: string;
        filename: string;
        upload_date: string;
      }>;
      currentDocument?: {
        id: string;
        filename: string;
      } | null;
      isLoading?: boolean;
      error?: string | null;
    };
  };
}

export function renderWithProviders(
  ui: ReactElement,
  options: CustomRenderOptions = {}
) {
  const { ...renderOptions } = options;

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <AppStateProvider>
        <AuthProvider>
          <AnalysisProvider>{children}</AnalysisProvider>
        </AuthProvider>
      </AppStateProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

// Mock API responses
export const mockApiResponses = {
  successResponse: <T>(data: T) => ({
    success: true,
    data,
    error: null,
    meta: null,
    correlation_id: "test-correlation-id",
  }),

  errorResponse: (code: string, message: string) => ({
    success: false,
    data: null,
    error: {
      code,
      message,
      details: null,
    },
    correlation_id: "test-correlation-id",
  }),

  paginatedResponse: <T>(items: T[], page = 1, pageSize = 10) => ({
    success: true,
    data: items,
    meta: {
      pagination: {
        page,
        page_size: pageSize,
        total_items: items.length,
        total_pages: Math.ceil(items.length / pageSize),
        has_next: page * pageSize < items.length,
        has_previous: page > 1,
      },
    },
    correlation_id: "test-correlation-id",
  }),
};

// Mock fetch implementation
export function mockFetch(response: unknown, status = 200) {
  return jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(response),
    text: jest.fn().mockResolvedValue(JSON.stringify(response)),
  });
}

// File upload mock helpers
export function createMockFile(
  name = "test.pdf",
  size = 1024,
  type = "application/pdf"
) {
  const file = new File(["test content"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

// Event helpers
export function createChangeEvent(value: string) {
  return {
    target: { value },
  } as React.ChangeEvent<HTMLInputElement>;
}

export function createFileChangeEvent(files: File[]) {
  return {
    target: { files },
  } as React.ChangeEvent<HTMLInputElement>;
}

// Wait for async operations
export function waitForLoadingToFinish() {
  return new Promise((resolve) => setTimeout(resolve, 100));
}

// Custom matchers
export const customMatchers = {
  toHaveLoadingState: (received: HTMLElement, expected: boolean) => {
    const hasLoading =
      received.querySelector('[data-testid="loading"]') !== null;
    const pass = hasLoading === expected;

    return {
      message: () =>
        `expected element ${pass ? "not " : ""}to have loading state`,
      pass,
    };
  },

  toHaveErrorMessage: (received: HTMLElement, message?: string) => {
    const errorElement = received.querySelector('[data-testid="error"]');
    const hasError = errorElement !== null;

    if (message && hasError) {
      const actualMessage = errorElement?.textContent;
      const pass = actualMessage?.includes(message) ?? false;
      return {
        message: () =>
          `expected error message "${actualMessage}" to contain "${message}"`,
        pass,
      };
    }

    return {
      message: () =>
        `expected element ${hasError ? "" : "not "}to have error message`,
      pass: hasError,
    };
  },
};

// Test data factories
export const testDataFactory = {
  createUser: (overrides = {}) => ({
    id: "test-user-id",
    email: "test@example.com",
    full_name: "Test User",
    created_at: new Date().toISOString(),
    ...overrides,
  }),

  createDocument: (overrides = {}) => ({
    id: "test-doc-id",
    filename: "test-document.pdf",
    upload_date: new Date().toISOString(),
    text: "Sample document text",
    ai_full_summary: "This is a test document summary",
    clauses: [],
    risk_summary: { high: 1, medium: 2, low: 3 },
    user_id: "test-user-id",
    ...overrides,
  }),

  createClause: (overrides = {}) => ({
    id: "test-clause-id",
    heading: "Test Clause",
    text: "This is a test clause text",
    clause_type: "general",
    risk_level: "medium",
    summary: "Test clause summary",
    risk_assessment: "Medium risk assessment",
    recommendations: ["Test recommendation"],
    key_points: ["Test key point"],
    position_start: 0,
    position_end: 100,
    ...overrides,
  }),

  createAnalyticsData: (overrides = {}) => ({
    totalDocuments: 10,
    documentsThisMonth: 3,
    riskyClausesCaught: 15,
    timeSavedHours: 25,
    avgRiskScore: 2.5,
    recentActivity: [],
    monthlyStats: [],
    riskBreakdown: { high: 5, medium: 7, low: 3 },
    ...overrides,
  }),
};

// Performance testing helpers
export function measureRenderTime(renderFn: () => void) {
  const start = performance.now();
  renderFn();
  const end = performance.now();
  return end - start;
}

// Accessibility testing helpers
export function checkAccessibility(element: HTMLElement) {
  const issues: string[] = [];

  // Check for alt text on images
  const images = element.querySelectorAll("img");
  images.forEach((img) => {
    if (!img.getAttribute("alt")) {
      issues.push("Image missing alt text");
    }
  });

  // Check for proper button labeling
  const buttons = element.querySelectorAll("button");
  buttons.forEach((button) => {
    if (!button.textContent?.trim() && !button.getAttribute("aria-label")) {
      issues.push("Button missing accessible label");
    }
  });

  // Check for form labels
  const inputs = element.querySelectorAll("input, textarea, select");
  inputs.forEach((input) => {
    const id = input.getAttribute("id");
    if (id) {
      const label = element.querySelector(`label[for="${id}"]`);
      if (!label && !input.getAttribute("aria-label")) {
        issues.push(`Input ${id} missing associated label`);
      }
    }
  });

  return issues;
}

// Re-export everything from testing-library
export * from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";
