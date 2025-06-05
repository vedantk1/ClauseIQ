"use client";
import React, { createContext, useContext, useState, useEffect } from "react";
import { toast } from "react-hot-toast";
// Import shared types
import {
  User,
  UserPreferences,
  AvailableModel,
} from "../../../shared/types/common";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  preferences: UserPreferences | null;
  availableModels: AvailableModel[];
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    fullName: string
  ) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  updatePreferences: (preferences: UserPreferences) => Promise<void>;
  updateProfile: (fullName: string) => Promise<void>;
  loadPreferences: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = "http://localhost:8000";

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);

  console.log(
    "[AUTH CONTEXT DEBUG] AuthProvider render - user:",
    user,
    "isLoading:",
    isLoading
  );

  // Token management
  const getAccessToken = () => {
    const token = localStorage.getItem("access_token");
    console.log(
      "[AUTH CONTEXT DEBUG] getAccessToken called, token exists:",
      !!token
    );
    return token;
  };
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

  // Load preferences and available models
  const loadPreferences = async () => {
    const accessToken = getAccessToken();
    if (!accessToken) return;

    try {
      // Load user preferences with retry logic for rate limiting
      try {
        const prefsResponse = await fetch(`${API_BASE_URL}/auth/preferences`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        });

        if (prefsResponse.ok) {
          const prefsData = await prefsResponse.json();
          setPreferences({ preferred_model: prefsData.preferred_model });
        } else if (prefsResponse.status === 429) {
          console.warn(
            "Rate limited while loading preferences, will retry later"
          );
          // Don't throw error for rate limits, just log and continue
        }
      } catch (error) {
        console.warn("Error loading preferences:", error);
      }

      // Load available models with retry logic for rate limiting
      try {
        const modelsResponse = await fetch(
          `${API_BASE_URL}/auth/available-models`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (modelsResponse.ok) {
          const modelsData = await modelsResponse.json();
          setAvailableModels(modelsData.models || []);
        } else if (modelsResponse.status === 429) {
          console.warn("Rate limited while loading models, will retry later");
          // Don't throw error for rate limits, just log and continue
        }
      } catch (error) {
        console.warn("Error loading models:", error);
      }
    } catch (error) {
      console.error("Failed to load preferences:", error);
    }
  };

  // Update user preferences
  const updatePreferences = async (newPreferences: UserPreferences) => {
    try {
      const response = await apiCall("/auth/preferences", {
        method: "PUT",
        body: JSON.stringify(newPreferences),
      });

      if (response.ok) {
        setPreferences(newPreferences);
        toast.success("Preferences updated successfully!");
      } else {
        const error = await response.json();
        throw new Error(error.detail || "Failed to update preferences");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update preferences"
      );
      throw error;
    }
  };

  // Update user profile
  const updateProfile = async (fullName: string) => {
    try {
      const response = await apiCall("/auth/profile", {
        method: "PUT",
        body: JSON.stringify({ full_name: fullName }),
      });

      if (response.ok) {
        const result = await response.json();
        // Update user state with new full_name
        setUser((prev) =>
          prev ? { ...prev, full_name: result.full_name } : null
        );
        toast.success("Profile updated successfully!");
      } else {
        const error = await response.json();
        throw new Error(error.detail || "Failed to update profile");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update profile"
      );
      throw error;
    }
  };

  // Load user from token on app start
  useEffect(() => {
    console.log("[AUTH CONTEXT DEBUG] useEffect triggered for loading user");

    const loadUser = async () => {
      console.log("[AUTH CONTEXT DEBUG] loadUser called");
      const accessToken = getAccessToken();

      if (!accessToken) {
        console.log(
          "[AUTH CONTEXT DEBUG] No access token found, setting isLoading to false"
        );
        setIsLoading(false);
        return;
      }

      console.log(
        "[AUTH CONTEXT DEBUG] Access token found, attempting to load user"
      );

      try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        console.log(
          "[AUTH CONTEXT DEBUG] /auth/me response status:",
          response.status
        );

        if (response.ok) {
          const userData = await response.json();
          console.log("[AUTH CONTEXT DEBUG] User data loaded:", userData);
          setUser(userData);

          // Load preferences directly without using apiCall to avoid circular dependency
          try {
            const prefsResponse = await fetch(
              `${API_BASE_URL}/auth/preferences`,
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                },
              }
            );
            if (prefsResponse.ok) {
              const prefsData = await prefsResponse.json();
              setPreferences({ preferred_model: prefsData.preferred_model });
            }

            const modelsResponse = await fetch(
              `${API_BASE_URL}/auth/available-models`,
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                },
              }
            );
            if (modelsResponse.ok) {
              const modelsData = await modelsResponse.json();
              setAvailableModels(modelsData.models || []);
            }
          } catch (error) {
            console.error(
              "[AUTH CONTEXT DEBUG] Failed to load preferences:",
              error
            );
          }
        } else {
          console.log("[AUTH CONTEXT DEBUG] /auth/me failed, clearing tokens");
          clearTokens();
        }
      } catch (error) {
        console.error("[AUTH CONTEXT DEBUG] Error loading user:", error);
        clearTokens();
      } finally {
        console.log("[AUTH CONTEXT DEBUG] Setting isLoading to false");
        setIsLoading(false);
      }
    };

    loadUser();
  }, []); // Remove dependency to prevent circular dependency

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
        await loadPreferences();
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
        await loadPreferences();
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
    setPreferences(null);
    setAvailableModels([]);
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
    preferences,
    availableModels,
    login,
    register,
    logout,
    refreshToken,
    updatePreferences,
    loadPreferences,
    updateProfile,
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
    console.log("[API CALL DEBUG] Making API call to:", url);
    const accessToken = localStorage.getItem("access_token");
    console.log("[API CALL DEBUG] Access token exists:", !!accessToken);

    // Prepare headers - don't set Content-Type for FormData (let browser set it)
    const headers: Record<string, string> = {};
    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    console.log("[API CALL DEBUG] Request headers:", headers);

    const response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    console.log("[API CALL DEBUG] Response status:", response.status);

    // If token expired, try to refresh
    if (response.status === 401 && accessToken) {
      console.log("[API CALL DEBUG] 401 error, attempting token refresh");
      try {
        await refreshToken();
        const newAccessToken = localStorage.getItem("access_token");
        console.log(
          "[API CALL DEBUG] Token refresh successful, new token exists:",
          !!newAccessToken
        );

        // Prepare headers for retry
        const retryHeaders: Record<string, string> = {};
        if (!(options.body instanceof FormData)) {
          retryHeaders["Content-Type"] = "application/json";
        }
        if (newAccessToken) {
          retryHeaders["Authorization"] = `Bearer ${newAccessToken}`;
        }

        console.log("[API CALL DEBUG] Retrying request with new token");
        // Retry the original request with new token
        const retryResponse = await fetch(`${API_BASE_URL}${url}`, {
          ...options,
          headers: {
            ...retryHeaders,
            ...options.headers,
          },
        });

        console.log(
          "[API CALL DEBUG] Retry response status:",
          retryResponse.status
        );
        return retryResponse;
      } catch (error) {
        console.error("[API CALL DEBUG] Token refresh failed:", error);
        // Refresh failed, logout user
        logout();
        throw new Error("Session expired. Please login again.");
      }
    }

    return response;
  };
};
