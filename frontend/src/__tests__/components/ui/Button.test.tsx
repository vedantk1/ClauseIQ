import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "../../../utils/test-utils";
import { Button } from "../../../components/ui/Button";

describe("Button Component", () => {
  it("renders with default props", () => {
    renderWithProviders(<Button>Click me</Button>);

    const button = screen.getByRole("button", { name: /click me/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass("bg-blue-600"); // Primary variant default
  });

  it("applies different variants correctly", () => {
    const { rerender } = renderWithProviders(
      <Button variant="secondary">Test</Button>
    );
    expect(screen.getByRole("button")).toHaveClass("bg-gray-600");

    rerender(<Button variant="danger">Test</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-red-600");

    rerender(<Button variant="outline">Test</Button>);
    expect(screen.getByRole("button")).toHaveClass("border-gray-300");
  });

  it("applies different sizes correctly", () => {
    const { rerender } = renderWithProviders(<Button size="sm">Test</Button>);
    expect(screen.getByRole("button")).toHaveClass("px-3", "py-1.5", "text-sm");

    rerender(<Button size="lg">Test</Button>);
    expect(screen.getByRole("button")).toHaveClass("px-6", "py-3", "text-lg");
  });

  it("handles disabled state", () => {
    renderWithProviders(<Button disabled>Disabled</Button>);

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveClass(
      "disabled:opacity-50",
      "disabled:pointer-events-none"
    );
  });

  it("shows loading state", () => {
    renderWithProviders(<Button isLoading>Loading</Button>);

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("handles click events", () => {
    const handleClick = jest.fn();
    renderWithProviders(<Button onClick={handleClick}>Click me</Button>);

    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("does not trigger click when disabled", () => {
    const handleClick = jest.fn();
    renderWithProviders(
      <Button onClick={handleClick} disabled>
        Disabled
      </Button>
    );

    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("does not trigger click when loading", () => {
    const handleClick = jest.fn();
    renderWithProviders(
      <Button onClick={handleClick} isLoading>
        Loading
      </Button>
    );

    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("applies custom className", () => {
    renderWithProviders(<Button className="custom-class">Test</Button>);

    expect(screen.getByRole("button")).toHaveClass("custom-class");
  });

  it("forwards ref correctly", () => {
    const ref = { current: null };
    renderWithProviders(<Button ref={ref}>Test</Button>);

    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it("supports full width variant", () => {
    renderWithProviders(<Button fullWidth>Full Width</Button>);

    expect(screen.getByRole("button")).toHaveClass("w-full");
  });
});
