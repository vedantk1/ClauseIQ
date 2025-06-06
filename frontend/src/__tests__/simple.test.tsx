/**
 * Simple test to verify Jest configuration
 */
import { render, screen } from "@testing-library/react";

// Simple component for testing
function TestComponent() {
  return <div>Hello Test</div>;
}

describe("Simple Test", () => {
  it("renders a basic component", () => {
    render(<TestComponent />);
    expect(screen.getByText("Hello Test")).toBeInTheDocument();
  });

  it("basic math works", () => {
    expect(2 + 2).toBe(4);
  });
});
