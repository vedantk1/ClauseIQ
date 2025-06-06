/**
 * Enhanced Jest setup with comprehensive mocking and testing utilities
 */
import "@testing-library/jest-dom";

// Global test environment setup
beforeEach(() => {
  // Clear localStorage before each test
  localStorage.clear();
  sessionStorage.clear();
  
  // Reset all mocks
  jest.clearAllMocks();
});

// Mock Next.js router with enhanced functionality
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockRefresh = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter() {
    return {
      push: mockPush,
      replace: mockReplace,
      prefetch: jest.fn(),
      back: mockBack,
      forward: jest.fn(),
      refresh: mockRefresh,
    };
  },
  useSearchParams() {
    return new URLSearchParams();
  },
  usePathname() {
    return "/";
  },
}));

// Mock fetch for API testing
global.fetch = jest.fn();

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {
    return null;
  }
  disconnect() {
    return null;
  }
  unobserve() {
    return null;
  }
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  observe() {
    return null;
  }
  disconnect() {
    return null;
  }
  unobserve() {
    return null;
  }
};

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Global test utilities
global.testUtils = {
  // Router mock functions for assertions
  router: {
    mockPush,
    mockReplace,
    mockBack,
    mockRefresh,
  },
  
  // Common test data
  mockUser: {
    id: "test-user-id",
    email: "test@example.com",
    full_name: "Test User",
    created_at: "2024-01-01T00:00:00Z",
  },
  
  mockDocument: {
    id: "test-doc-id",
    filename: "test-document.pdf",
    upload_date: "2024-01-01T00:00:00Z",
    text: "Sample document text",
    ai_full_summary: "This is a test document summary",
    sections: [],
    clauses: [],
    risk_summary: { high: 1, medium: 2, low: 3 },
    user_id: "test-user-id",
  },
  
  mockClause: {
    id: "test-clause-id",
    heading: "Test Clause",
    text: "This is a test clause text",
    clause_type: "general",
    risk_level: "medium",
    summary: "Test clause summary",
    risk_assessment: "Medium risk assessment",
    recommendations: ["Test recommendation"],
    key_points: ["Test key point"],
  },
};

// Console warning/error suppression for cleaner test output
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === "string" &&
      (args[0].includes("Warning: ReactDOM.render is deprecated") ||
        args[0].includes("Warning: React.createFactory() is deprecated"))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };

  console.warn = (...args) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("componentWillReceiveProps has been renamed")
    ) {
      return;
    }
    originalWarn.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});
