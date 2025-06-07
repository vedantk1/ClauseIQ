import Home from "@/app/page";
import { renderWithProviders } from "@/utils/test-utils";

// Mock the router
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

// Mock config
jest.mock("@/config/config", () => ({
  apiUrl: "http://localhost:8000",
  maxFileSizeMB: 10,
}));

// Mock the EnhancedTestUpload component
jest.mock("@/components/EnhancedTestUpload", () => {
  return function MockEnhancedTestUpload() {
    return (
      <div data-testid="enhanced-test-upload">
        Enhanced Test Upload Component
      </div>
    );
  };
});

describe("Home Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  test("renders home page without crashing", () => {
    const { container } = renderWithProviders(<Home />);
    expect(container).toBeTruthy();
  });

  test("component has the proper structure", () => {
    const { container } = renderWithProviders(<Home />);
    // Check that the container has content
    expect(container.firstChild).toBeTruthy();
  });
});
