import { render, screen } from "@testing-library/react";
import NavBar from "@/components/NavBar";

// Mock Next.js navigation hook
jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/"),
}));

describe("NavBar Component", () => {
  test("renders all navigation links", () => {
    render(<NavBar />);

    // Check for links that should be present (using getAllByText to handle duplicates for mobile/desktop)
    expect(screen.getAllByText("Upload")).toHaveLength(2); // Desktop + Mobile
    expect(screen.getAllByText("Review")).toHaveLength(2); // Desktop + Mobile
    expect(screen.getAllByText("History")).toHaveLength(2); // Desktop + Mobile
    expect(screen.getAllByText("Analytics")).toHaveLength(2); // Desktop + Mobile
    expect(screen.getAllByText("About")).toHaveLength(2); // Desktop + Mobile
    expect(screen.getByText("ClauseIQ")).toBeTruthy(); // Logo
  });

  test("renders navigation element", () => {
    render(<NavBar />);

    const nav = screen.getByRole("navigation");
    expect(nav).toBeTruthy();
  });

  test("renders correct number of links", () => {
    render(<NavBar />);

    const links = screen.getAllByRole("link");
    // Logo + 5 nav links * 2 (desktop + mobile) = 11 total links
    expect(links).toHaveLength(11);
  });
});
