import { render, screen } from "@testing-library/react";
import NavBar from "@/components/NavBar";

// Mock Next.js navigation hook
jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
}));

describe("NavBar Component", () => {
  const { usePathname } = require("next/navigation");

  beforeEach(() => {
    usePathname.mockReturnValue("/");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("renders all navigation links", () => {
    render(<NavBar />);

    expect(screen.getByRole("link", { name: "Upload" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Results" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "History" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "About" })).toBeInTheDocument();
  });

  test("highlights active page link", () => {
    usePathname.mockReturnValue("/history");
    render(<NavBar />);

    const historyLink = screen.getByRole("link", { name: "History" });
    const uploadLink = screen.getByRole("link", { name: "Upload" });

    // History link should be highlighted (have font-semibold class)
    expect(historyLink).toHaveClass("font-semibold", "text-white");

    // Upload link should not be highlighted
    expect(uploadLink).not.toHaveClass("font-semibold");
  });

  test("applies correct href attributes", () => {
    render(<NavBar />);

    expect(screen.getByRole("link", { name: "Upload" })).toHaveAttribute(
      "href",
      "/"
    );
    expect(screen.getByRole("link", { name: "Results" })).toHaveAttribute(
      "href",
      "/results"
    );
    expect(screen.getByRole("link", { name: "History" })).toHaveAttribute(
      "href",
      "/history"
    );
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute(
      "href",
      "/about"
    );
  });

  test("has proper navigation structure", () => {
    render(<NavBar />);

    const nav = screen.getByRole("navigation");
    expect(nav).toBeInTheDocument();
    expect(nav).toHaveClass("bg-gray-800", "text-gray-100");

    const list = screen.getByRole("list");
    expect(list).toBeInTheDocument();
    expect(list).toHaveClass("flex", "gap-6", "px-6", "py-3");
  });

  test("applies hover styles to all links", () => {
    render(<NavBar />);

    const links = screen.getAllByRole("link");
    links.forEach((link) => {
      expect(link).toHaveClass("hover:text-white");
    });
  });
});
