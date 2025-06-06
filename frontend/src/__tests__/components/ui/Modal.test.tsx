import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "../../../utils/test-utils";
import { Modal } from "../../../components/ui/Modal";

describe("Modal Component", () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    title: "Test Modal",
    children: <div>Modal content</div>,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders when open", () => {
    renderWithProviders(<Modal {...defaultProps} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Test Modal")).toBeInTheDocument();
    expect(screen.getByText("Modal content")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    renderWithProviders(<Modal {...defaultProps} isOpen={false} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("calls onClose when close button clicked", () => {
    const onClose = jest.fn();
    renderWithProviders(<Modal {...defaultProps} onClose={onClose} />);

    const closeButton = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when backdrop clicked", () => {
    const onClose = jest.fn();
    renderWithProviders(<Modal {...defaultProps} onClose={onClose} />);

    const backdrop = screen.getByTestId("modal-backdrop");
    fireEvent.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close when clicking modal content", () => {
    const onClose = jest.fn();
    renderWithProviders(<Modal {...defaultProps} onClose={onClose} />);

    const modalContent = screen.getByRole("dialog");
    fireEvent.click(modalContent);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes on Escape key press", () => {
    const onClose = jest.fn();
    renderWithProviders(<Modal {...defaultProps} onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close on Escape when closeOnEscapeKey is false", () => {
    const onClose = jest.fn();
    renderWithProviders(
      <Modal {...defaultProps} onClose={onClose} closeOnEscapeKey={false} />
    );

    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not close on backdrop click when closeOnOverlayClick is false", () => {
    const onClose = jest.fn();
    renderWithProviders(
      <Modal {...defaultProps} onClose={onClose} closeOnOverlayClick={false} />
    );

    const backdrop = screen.getByTestId("modal-backdrop");
    fireEvent.click(backdrop);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("applies different sizes correctly", () => {
    const { rerender } = renderWithProviders(
      <Modal {...defaultProps} size="sm" />
    );
    expect(screen.getByRole("dialog")).toHaveClass("max-w-md");

    rerender(<Modal {...defaultProps} size="lg" />);
    expect(screen.getByRole("dialog")).toHaveClass("max-w-2xl");

    rerender(<Modal {...defaultProps} size="xl" />);
    expect(screen.getByRole("dialog")).toHaveClass("max-w-4xl");
  });

  it("renders custom footer", () => {
    const footer = (
      <div>
        <button>Cancel</button>
        <button>Save</button>
      </div>
    );

    renderWithProviders(<Modal {...defaultProps} footer={footer} />);

    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(screen.getByText("Save")).toBeInTheDocument();
  });

  it("hides close button when showCloseButton is false", () => {
    renderWithProviders(<Modal {...defaultProps} showCloseButton={false} />);

    expect(
      screen.queryByRole("button", { name: /close/i })
    ).not.toBeInTheDocument();
  });

  it("applies custom className", () => {
    renderWithProviders(<Modal {...defaultProps} className="custom-modal" />);

    expect(screen.getByRole("dialog")).toHaveClass("custom-modal");
  });

  it("manages focus correctly", () => {
    renderWithProviders(<Modal {...defaultProps} />);

    const modal = screen.getByRole("dialog");
    expect(modal).toHaveFocus();
  });

  it("prevents body scroll when open", () => {
    renderWithProviders(<Modal {...defaultProps} />);

    expect(document.body).toHaveStyle("overflow: hidden");
  });

  it("restores body scroll when closed", () => {
    const { rerender } = renderWithProviders(<Modal {...defaultProps} />);

    rerender(<Modal {...defaultProps} isOpen={false} />);

    expect(document.body).not.toHaveStyle("overflow: hidden");
  });
});
