import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../../utils/test-utils";
import { Input } from "../../../components/ui/Input";

describe("Input Component", () => {
  it("renders with default props", () => {
    renderWithProviders(<Input placeholder="Enter text" />);

    const input = screen.getByPlaceholderText("Enter text");
    expect(input).toBeInTheDocument();
    expect(input).toHaveClass("border-gray-300");
  });

  it("handles value changes", () => {
    const handleChange = jest.fn();
    renderWithProviders(<Input value="" onChange={handleChange} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "test input" } });

    expect(handleChange).toHaveBeenCalledWith("test input");
  });

  it("shows validation error state", () => {
    renderWithProviders(<Input error="This field is required" />);

    const input = screen.getByRole("textbox");
    expect(input).toHaveClass("border-red-500");
    expect(screen.getByText("This field is required")).toBeInTheDocument();
  });

  it("shows success state", () => {
    renderWithProviders(<Input success />);

    const input = screen.getByRole("textbox");
    expect(input).toHaveClass("border-green-500");
  });

  it("handles disabled state", () => {
    renderWithProviders(<Input disabled />);

    const input = screen.getByRole("textbox");
    expect(input).toBeDisabled();
    expect(input).toHaveClass("bg-gray-100");
  });

  it("renders with label", () => {
    renderWithProviders(<Input label="Email Address" />);

    expect(screen.getByText("Email Address")).toBeInTheDocument();
    expect(screen.getByLabelText("Email Address")).toBeInTheDocument();
  });

  it("renders with help text", () => {
    renderWithProviders(<Input helpText="Enter your email address" />);

    expect(screen.getByText("Enter your email address")).toBeInTheDocument();
  });

  it("shows required indicator", () => {
    renderWithProviders(<Input label="Required Field" required />);

    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("handles different input types", () => {
    const { rerender } = renderWithProviders(<Input type="email" />);
    expect(screen.getByRole("textbox")).toHaveAttribute("type", "email");

    rerender(<Input type="password" />);
    expect(screen.getByDisplayValue("")).toHaveAttribute("type", "password");

    rerender(<Input type="number" />);
    expect(screen.getByRole("spinbutton")).toHaveAttribute("type", "number");
  });

  it("applies different sizes", () => {
    const { rerender } = renderWithProviders(<Input size="sm" />);
    expect(screen.getByRole("textbox")).toHaveClass(
      "px-3",
      "py-1.5",
      "text-sm"
    );

    rerender(<Input size="lg" />);
    expect(screen.getByRole("textbox")).toHaveClass("px-4", "py-3", "text-lg");
  });

  it("forwards ref correctly", () => {
    const ref = { current: null };
    renderWithProviders(<Input ref={ref} />);

    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it("validates on blur when validation function provided", async () => {
    const validate = jest.fn().mockReturnValue("Invalid input");
    renderWithProviders(<Input validate={validate} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "test" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(validate).toHaveBeenCalledWith("test");
      expect(screen.getByText("Invalid input")).toBeInTheDocument();
    });
  });

  it("clears validation error when input becomes valid", async () => {
    const validate = jest
      .fn()
      .mockReturnValueOnce("Invalid input")
      .mockReturnValueOnce(null);

    renderWithProviders(<Input validate={validate} />);

    const input = screen.getByRole("textbox");

    // First invalid input
    fireEvent.change(input, { target: { value: "invalid" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(screen.getByText("Invalid input")).toBeInTheDocument();
    });

    // Then valid input
    fireEvent.change(input, { target: { value: "valid" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(screen.queryByText("Invalid input")).not.toBeInTheDocument();
    });
  });
});
