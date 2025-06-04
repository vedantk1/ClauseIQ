"use client";
import React, { createContext, useContext, useState, useEffect } from "react";
import { toast } from "react-hot-toast";

interface User {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    fullName: string
  ) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = "http://localhost:8000";

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Token management
  const getAccessToken = () => localStorage.getItem("access_token");
  const getRefreshToken = () => localStorage.getItem("refresh_token");

  const setTokens = (accessToken: string, refreshToken: string) => {
    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("refresh_token", refreshToken);
  };

  const clearTokens = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
  };

  // API helper with automatic token refresh
  const apiCall = async (url: string, options: RequestInit = {}) => {
    const accessToken = getAccessToken();

    // Prepare headers - don't set Content-Type for FormData (let browser set it)
    const headers: Record<string, string> = {};
    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    // If token expired, try to refresh
    if (response.status === 401 && accessToken) {
      try {
        await refreshToken();
        const newAccessToken = getAccessToken();

        // Prepare headers for retry
        const retryHeaders: Record<string, string> = {};
        if (!(options.body instanceof FormData)) {
          retryHeaders["Content-Type"] = "application/json";
        }
        if (newAccessToken) {
          retryHeaders["Authorization"] = `Bearer ${newAccessToken}`;
        }

        // Retry the original request with new token
        const retryResponse = await fetch(`${API_BASE_URL}${url}`, {
          ...options,
          headers: {
            ...retryHeaders,
            ...options.headers,
          },
        });

        return retryResponse;
      } catch {
        // Refresh failed, logout user
        logout();
        throw new Error("Session expired. Please login again.");
      }
    }

    return response;
  };

  // Load user from token on app start
  useEffect(() => {
    const loadUser = async () => {
      const accessToken = getAccessToken();
      if (!accessToken) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        } else {
          clearTokens();
        }
      } catch {
        clearTokens();
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Login failed");
      }

      const { access_token, refresh_token } = await response.json();
      setTokens(access_token, refresh_token);

      // Get user info
      const userResponse = await apiCall("/auth/me");
      if (userResponse.ok) {
        const userData = await userResponse.json();
        setUser(userData);
        toast.success("Login successful!");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed");
      throw error;
    }
  };

  const register = async (
    email: string,
    password: string,
    fullName: string
  ) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          full_name: fullName,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Registration failed");
      }

      const { access_token, refresh_token } = await response.json();
      setTokens(access_token, refresh_token);

      // Get user info
      const userResponse = await apiCall("/auth/me");
      if (userResponse.ok) {
        const userData = await userResponse.json();
        setUser(userData);
        toast.success("Registration successful!");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Registration failed"
      );
      throw error;
    }
  };

  const logout = () => {
    clearTokens();
    setUser(null);
    toast.success("Logged out successfully");
  };

  const refreshToken = async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      throw new Error("No refresh token available");
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        throw new Error("Token refresh failed");
      }

      const { access_token } = await response.json();
      localStorage.setItem("access_token", access_token);
    } catch (error) {
      clearTokens();
      setUser(null);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    register,
    logout,
    refreshToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

// Export API helper for use in other components
export const useApiCall = () => {
  const { refreshToken, logout } = useAuth();

  return async (url: string, options: RequestInit = {}) => {
    const accessToken = localStorage.getItem("access_token");

    // Prepare headers - don't set Content-Type for FormData (let browser set it)
    const headers: Record<string, string> = {};
    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    // If token expired, try to refresh
    if (response.status === 401 && accessToken) {
      try {
        await refreshToken();
        const newAccessToken = localStorage.getItem("access_token");

        // Prepare headers for retry
        const retryHeaders: Record<string, string> = {};
        if (!(options.body instanceof FormData)) {
          retryHeaders["Content-Type"] = "application/json";
        }
        if (newAccessToken) {
          retryHeaders["Authorization"] = `Bearer ${newAccessToken}`;
        }

        // Retry the original request with new token
        const retryResponse = await fetch(`${API_BASE_URL}${url}`, {
          ...options,
          headers: {
            ...retryHeaders,
            ...options.headers,
          },
        });

        return retryResponse;
      } catch {
        // Refresh failed, logout user
        logout();
        throw new Error("Session expired. Please login again.");
      }
    }

    return response;
  };
};
