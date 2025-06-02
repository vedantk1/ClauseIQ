import { render, screen } from "@testing-library/react";
import NavBar from "@/components/NavBar";

// Mock Next.js navigation hook
jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/"),
}));

describe("NavBar Component", () => {
  test("renders all navigation links", () => {
    render(<NavBar />);

    expect(screen.getByText("Upload")).toBeTruthy();
    expect(screen.getByText("Results")).toBeTruthy();
    expect(screen.getByText("History")).toBeTruthy();
    expect(screen.getByText("About")).toBeTruthy();
  });

  test("renders navigation element", () => {
    render(<NavBar />);

    const nav = screen.getByRole("navigation");
    expect(nav).toBeTruthy();
  });

  test("renders correct number of links", () => {
    render(<NavBar />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(4);
  });
});
