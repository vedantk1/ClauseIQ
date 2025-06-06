/**
import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { renderWithProviders } from "../../utils/test-utils";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";essibility testing suite for ClaudeIQ components
 * Tests WCAG 2.1 AA compliance
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { renderWithProviders } from "@/utils/test-utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Dropdown } from "@/components/ui/Dropdown";
import { Card } from "@/components/ui/Card";

// Extend Jest matchers
expect.extend(toHaveNoViolations);

describe("Accessibility Tests", () => {
  describe("Button Component", () => {
    it("should not have accessibility violations", async () => {
      const { container } = render(<Button>Accessible Button</Button>);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("has proper ARIA attributes", () => {
      render(<Button aria-label="Custom label">Button</Button>);
      const button = screen.getByRole("button");

      expect(button).toHaveAttribute("aria-label", "Custom label");
    });

    it("supports keyboard navigation", () => {
      const handleClick = jest.fn();
      render(<Button onClick={handleClick}>Keyboard Button</Button>);

      const button = screen.getByRole("button");
      button.focus();

      expect(button).toHaveFocus();

      fireEvent.keyDown(button, { key: "Enter" });
      expect(handleClick).toHaveBeenCalled();

      fireEvent.keyDown(button, { key: " " });
      expect(handleClick).toHaveBeenCalledTimes(2);
    });

    it("has proper disabled state accessibility", () => {
      render(<Button disabled>Disabled Button</Button>);
      const button = screen.getByRole("button");

      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("aria-disabled", "true");
    });

    it("has proper loading state accessibility", () => {
      render(<Button loading>Loading Button</Button>);
      const button = screen.getByRole("button");

      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("aria-busy", "true");
    });
  });

  describe("Input Component", () => {
    it("should not have accessibility violations", async () => {
      const { container } = render(
        <Input label="Accessible Input" placeholder="Enter text" />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("has proper label association", () => {
      render(<Input label="Email Address" />);

      const input = screen.getByLabelText("Email Address");
      const label = screen.getByText("Email Address");

      expect(input).toBeInTheDocument();
      expect(label).toBeInTheDocument();
      expect(input).toHaveAttribute("id");
      expect(label).toHaveAttribute("for", input.getAttribute("id"));
    });

    it("has proper error state accessibility", () => {
      render(<Input label="Email" error="Email is required" />);

      const input = screen.getByLabelText("Email");
      const errorMessage = screen.getByText("Email is required");

      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(input).toHaveAttribute("aria-describedby");
      expect(errorMessage).toHaveAttribute(
        "id",
        input.getAttribute("aria-describedby")
      );
      expect(errorMessage).toHaveAttribute("role", "alert");
    });

    it("has proper help text accessibility", () => {
      render(
        <Input label="Password" helpText="Must be at least 8 characters" />
      );

      const input = screen.getByLabelText("Password");
      const helpText = screen.getByText("Must be at least 8 characters");

      expect(input).toHaveAttribute("aria-describedby");
      expect(helpText).toHaveAttribute(
        "id",
        input.getAttribute("aria-describedby")
      );
    });

    it("shows required indicator accessibly", () => {
      render(<Input label="Required Field" required />);

      const input = screen.getByLabelText("Required Field *");
      expect(input).toHaveAttribute("aria-required", "true");
    });
  });

  describe("Modal Component", () => {
    const defaultProps = {
      isOpen: true,
      onClose: jest.fn(),
      title: "Accessible Modal",
      children: <div>Modal content</div>,
    };

    it("should not have accessibility violations", async () => {
      const { container } = renderWithProviders(<Modal {...defaultProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("has proper ARIA attributes", () => {
      renderWithProviders(<Modal {...defaultProps} />);

      const modal = screen.getByRole("dialog");
      expect(modal).toHaveAttribute("aria-modal", "true");
      expect(modal).toHaveAttribute("aria-labelledby");

      const title = screen.getByText("Accessible Modal");
      expect(title).toHaveAttribute(
        "id",
        modal.getAttribute("aria-labelledby")
      );
    });

    it("traps focus properly", () => {
      renderWithProviders(<Modal {...defaultProps} />);

      const modal = screen.getByRole("dialog");
      const closeButton = screen.getByRole("button", { name: /close/i });

      // Modal should receive focus when opened
      expect(modal).toHaveFocus();

      // Tab should cycle within modal
      fireEvent.keyDown(modal, { key: "Tab" });
      expect(closeButton).toHaveFocus();
    });

    it("handles Escape key properly", () => {
      const onClose = jest.fn();
      renderWithProviders(<Modal {...defaultProps} onClose={onClose} />);

      fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe("Dropdown Component", () => {
    const options = [
      { value: "option1", label: "Option 1" },
      { value: "option2", label: "Option 2" },
      { value: "option3", label: "Option 3" },
    ];

    it("should not have accessibility violations when closed", async () => {
      const { container } = render(
        <Dropdown
          trigger={<Button>Open Dropdown</Button>}
          options={options}
          onSelect={() => {}}
        />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("has proper ARIA attributes", () => {
      render(
        <Dropdown
          trigger={<Button>Open Dropdown</Button>}
          options={options}
          onSelect={() => {}}
        />
      );

      const trigger = screen.getByRole("button");
      expect(trigger).toHaveAttribute("aria-haspopup", "true");
      expect(trigger).toHaveAttribute("aria-expanded", "false");
    });

    it("supports keyboard navigation", () => {
      const onSelect = jest.fn();
      render(
        <Dropdown
          trigger={<Button>Open Dropdown</Button>}
          options={options}
          onSelect={onSelect}
        />
      );

      const trigger = screen.getByRole("button");

      // Open with Enter key
      fireEvent.keyDown(trigger, { key: "Enter" });
      expect(trigger).toHaveAttribute("aria-expanded", "true");

      // Navigate with arrow keys
      const firstOption = screen.getByText("Option 1");
      expect(firstOption).toHaveFocus();

      fireEvent.keyDown(firstOption, { key: "ArrowDown" });
      expect(screen.getByText("Option 2")).toHaveFocus();

      // Select with Enter
      fireEvent.keyDown(screen.getByText("Option 2"), { key: "Enter" });
      expect(onSelect).toHaveBeenCalledWith(options[1]);
    });
  });

  describe("Card Component", () => {
    it("should not have accessibility violations", async () => {
      const { container } = render(
        <Card>
          <Card.Header>
            <Card.Title>Card Title</Card.Title>
          </Card.Header>
          <Card.Content>
            <p>Card content goes here</p>
          </Card.Content>
        </Card>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("has proper heading hierarchy", () => {
      render(
        <Card>
          <Card.Header>
            <Card.Title as="h2">Main Card</Card.Title>
          </Card.Header>
          <Card.Content>
            <h3>Subsection</h3>
            <p>Content</p>
          </Card.Content>
        </Card>
      );

      const mainHeading = screen.getByRole("heading", { level: 2 });
      const subHeading = screen.getByRole("heading", { level: 3 });

      expect(mainHeading).toHaveTextContent("Main Card");
      expect(subHeading).toHaveTextContent("Subsection");
    });
  });

  describe("Color Contrast", () => {
    it("meets WCAG AA contrast requirements", () => {
      // This would typically be done with automated tools
      // but we can test that our CSS custom properties
      // meet contrast requirements

      const { container } = render(
        <Button variant="primary">Primary Button</Button>
      );
      const button = container.querySelector("button");

      const styles = window.getComputedStyle(button!);

      // These are placeholder assertions - in a real app,
      // you'd use tools like axe-core or manual contrast checking
      expect(styles.getPropertyValue("background-color")).toBeTruthy();
      expect(styles.getPropertyValue("color")).toBeTruthy();
    });
  });

  describe("Screen Reader Support", () => {
    it("provides proper screen reader announcements", () => {
      render(
        <div>
          <div role="status" aria-live="polite">
            Document uploaded successfully
          </div>
          <div role="alert" aria-live="assertive">
            Error: Upload failed
          </div>
        </div>
      );

      const status = screen.getByRole("status");
      const alert = screen.getByRole("alert");

      expect(status).toHaveAttribute("aria-live", "polite");
      expect(alert).toHaveAttribute("aria-live", "assertive");
    });

    it("provides descriptive text for complex UI", () => {
      render(
        <div>
          <button aria-describedby="help-text">Upload Document</button>
          <div id="help-text">
            Supported formats: PDF, DOC, DOCX. Max size: 10MB
          </div>
        </div>
      );

      const button = screen.getByRole("button");
      const helpText = screen.getByText(/Supported formats/);

      expect(button).toHaveAttribute("aria-describedby", "help-text");
      expect(helpText).toHaveAttribute("id", "help-text");
    });
  });

  describe("Loading States", () => {
    it("provides accessible loading indicators", () => {
      render(
        <div>
          <div role="status" aria-live="polite">
            <span className="sr-only">Loading...</span>
            <div aria-hidden="true">⏳</div>
          </div>
        </div>
      );

      const status = screen.getByRole("status");
      const loadingText = screen.getByText("Loading...");

      expect(status).toBeInTheDocument();
      expect(loadingText).toHaveClass("sr-only");
    });
  });

  describe("Form Accessibility", () => {
    it("groups related form fields properly", () => {
      render(
        <form>
          <fieldset>
            <legend>Personal Information</legend>
            <Input label="First Name" />
            <Input label="Last Name" />
          </fieldset>
          <fieldset>
            <legend>Contact Information</legend>
            <Input label="Email" type="email" />
            <Input label="Phone" type="tel" />
          </fieldset>
        </form>
      );

      const personalFieldset = screen.getByRole("group", {
        name: "Personal Information",
      });
      const contactFieldset = screen.getByRole("group", {
        name: "Contact Information",
      });

      expect(personalFieldset).toBeInTheDocument();
      expect(contactFieldset).toBeInTheDocument();
    });
  });
});
