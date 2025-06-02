import { render, screen } from "@testing-library/react";
import TestUpload from "@/components/EnhancedTestUpload";

// Mock the config
jest.mock("@/config/config", () => ({
  maxFileSizeMB: 10,
  apiUrl: "http://localhost:8000",
}));

describe("EnhancedTestUpload Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("renders upload component correctly", () => {
    render(<TestUpload />);

    // Use basic assertions that should work
    const heading = screen.getByText("Enhanced PDF Test Tool");
    expect(heading).toBeTruthy();

    const fileInput = screen.getByDisplayValue("");
    expect(fileInput).toBeTruthy();
    expect(fileInput.getAttribute("type")).toBe("file");
    expect(fileInput.getAttribute("accept")).toBe(".pdf");
  });

  test("component renders without crashing", () => {
    const { container } = render(<TestUpload />);
    expect(container).toBeTruthy();
  });
});
