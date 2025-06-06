import { screen, fireEvent, waitFor } from "@testing-library/react";
import {
  renderWithProviders,
  mockApiResponses,
  mockFetch,
} from "../../utils/test-utils";
import { useAuth } from "../../context/AuthContext.v2";
import { act } from "react";

// Test component to interact with AuthContext
function TestComponent() {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();

  const checkAuth = async () => {
    // This function exists in test for compatibility but isn't needed in v2
    // as auth state is managed automatically
  };

  const handleLogin = async () => {
    try {
      await login("test@example.com", "password");
    } catch (error) {
      // Login errors are handled by AuthContext and don't need to be re-thrown
    }
  };

  return (
    <div>
      <div data-testid="auth-status">
        {isLoading
          ? "Loading"
          : isAuthenticated
          ? "Authenticated"
          : "Not Authenticated"}
      </div>
      <div data-testid="user-info">
        {user ? `User: ${user.email}` : "No user"}
      </div>
      <button onClick={handleLogin}>Login</button>
      <button onClick={logout}>Logout</button>
      <button onClick={checkAuth}>Check Auth</button>
    </div>
  );
}

describe("AuthContext.v2", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    localStorage.clear();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("initializes with unauthenticated state", () => {
    renderWithProviders(<TestComponent />);

    expect(screen.getByTestId("auth-status")).toHaveTextContent(
      "Not Authenticated"
    );
    expect(screen.getByTestId("user-info")).toHaveTextContent("No user");
  });

  it("handles successful login", async () => {
    const mockUser = { id: "1", email: "test@example.com", name: "Test User" };
    global.fetch = mockFetch(
      mockApiResponses.successResponse({
        user: mockUser,
        access_token: "fake-access-token",
        refresh_token: "fake-refresh-token",
      })
    );

    renderWithProviders(<TestComponent />);

    const loginButton = screen.getByText("Login");

    await act(async () => {
      fireEvent.click(loginButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId("auth-status")).toHaveTextContent(
        "Authenticated"
      );
      expect(screen.getByTestId("user-info")).toHaveTextContent(
        "User: test@example.com"
      );
    });

    expect(localStorage.getItem("access_token")).toBe("fake-access-token");
    expect(localStorage.getItem("refresh_token")).toBe("fake-refresh-token");
  });

  it("handles login failure", async () => {
    global.fetch = mockFetch(
      mockApiResponses.errorResponse(
        "INVALID_CREDENTIALS",
        "Invalid email or password"
      ),
      401
    );

    renderWithProviders(<TestComponent />);

    const loginButton = screen.getByText("Login");

    await act(async () => {
      fireEvent.click(loginButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId("auth-status")).toHaveTextContent(
        "Not Authenticated"
      );
      expect(screen.getByTestId("user-info")).toHaveTextContent("No user");
    });

    expect(localStorage.getItem("access_token")).toBeNull();
    expect(localStorage.getItem("refresh_token")).toBeNull();
  });

  it("handles logout", async () => {
    // First login
    const mockUser = { id: "1", email: "test@example.com", name: "Test User" };
    global.fetch = mockFetch(
      mockApiResponses.successResponse({
        user: mockUser,
        access_token: "fake-access-token",
        refresh_token: "fake-refresh-token",
      })
    );

    renderWithProviders(<TestComponent />);

    await act(async () => {
      fireEvent.click(screen.getByText("Login"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("auth-status")).toHaveTextContent(
        "Authenticated"
      );
    });

    // Then logout
    await act(async () => {
      fireEvent.click(screen.getByText("Logout"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("auth-status")).toHaveTextContent(
        "Not Authenticated"
      );
      expect(screen.getByTestId("user-info")).toHaveTextContent("No user");
    });

    expect(localStorage.getItem("access_token")).toBeNull();
    expect(localStorage.getItem("refresh_token")).toBeNull();
  });

  it("restores authentication from localStorage", async () => {
    const mockUser = { id: "1", email: "test@example.com", name: "Test User" };
    localStorage.setItem("access_token", "existing-access-token");
    localStorage.setItem("refresh_token", "existing-refresh-token");

    global.fetch = mockFetch(mockApiResponses.successResponse(mockUser));

    renderWithProviders(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByTestId("auth-status")).toHaveTextContent(
        "Authenticated"
      );
      expect(screen.getByTestId("user-info")).toHaveTextContent(
        "User: test@example.com"
      );
    });
  });

  it("handles token validation failure", async () => {
    localStorage.setItem("access_token", "invalid-access-token");
    localStorage.setItem("refresh_token", "invalid-refresh-token");

    global.fetch = mockFetch(
      mockApiResponses.errorResponse("INVALID_TOKEN", "Token is invalid"),
      401
    );

    renderWithProviders(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByTestId("auth-status")).toHaveTextContent(
        "Not Authenticated"
      );
      expect(screen.getByTestId("user-info")).toHaveTextContent("No user");
    });

    expect(localStorage.getItem("access_token")).toBeNull();
    expect(localStorage.getItem("refresh_token")).toBeNull();
  });

  it("handles network errors gracefully", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));

    renderWithProviders(<TestComponent />);

    try {
      await act(async () => {
        fireEvent.click(screen.getByText("Login"));
      });
    } catch {
      // Login is expected to throw an error on network failure
    }

    await waitFor(() => {
      expect(screen.getByTestId("auth-status")).toHaveTextContent(
        "Not Authenticated"
      );
    });
  });

  it("shows loading state during authentication", async () => {
    // Mock a delayed response
    global.fetch = jest.fn().mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: () =>
                  Promise.resolve(
                    mockApiResponses.successResponse({
                      user: { id: "1", email: "test@example.com" },
                      access_token: "fake-access-token",
                      refresh_token: "fake-refresh-token",
                    })
                  ),
              }),
            100
          )
        )
    );

    renderWithProviders(<TestComponent />);

    act(() => {
      fireEvent.click(screen.getByText("Login"));
    });

    // Should show loading state
    expect(screen.getByTestId("auth-status")).toHaveTextContent("Loading");

    await waitFor(() => {
      expect(screen.getByTestId("auth-status")).toHaveTextContent(
        "Authenticated"
      );
    });
  });
});
