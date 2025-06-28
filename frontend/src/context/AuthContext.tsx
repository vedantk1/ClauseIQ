/**
 * Enhanced AuthContext with improved state management and error handling
 */

"use client";
import React, { createContext, useContext, ReactNode } from "react";
import { toast } from "react-hot-toast";
import { User, UserPreferences, AvailableModel } from "@clauseiq/shared-types";
import { useAppState } from "../store/appState";
import { apiClient, handleAPIError, handleAPISuccess } from "../lib/api";

interface AuthContextType {
  // State (from store)
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  preferences: UserPreferences | null;
  availableModels: AvailableModel[];

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    fullName: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  updatePreferences: (preferences: UserPreferences) => Promise<void>;
  updateProfile: (fullName: string) => Promise<void>;
  loadPreferences: () => Promise<void>;
  loadAvailableModels: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { state, dispatch } = useAppState();
  const authState = state.auth;

  // Token management (define only once)
  const clearTokens = React.useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    dispatch({ type: "AUTH_LOGOUT" });
  }, [dispatch]);

  const refreshToken = React.useCallback(async (): Promise<void> => {
    console.log("[AUTH REFRESH] Starting token refresh");
    const refreshTokenValue = localStorage.getItem("refresh_token");
    if (!refreshTokenValue) {
      console.log("[AUTH REFRESH] No refresh token available");
      throw new Error("No refresh token available");
    }
    try {
      const response = await apiClient.post<{
        access_token: string;
        refresh_token: string;
      }>("/auth/refresh", { refresh_token: refreshTokenValue });

      if (response.success && response.data) {
        const { access_token, refresh_token } = response.data;
        console.log(
          "[AUTH REFRESH] Token refresh successful, updating storage"
        );
        localStorage.setItem("access_token", access_token);
        localStorage.setItem("refresh_token", refresh_token);
        dispatch({ type: "AUTH_REFRESH_TOKEN", payload: access_token });
      } else {
        console.log("[AUTH REFRESH] Token refresh failed:", response.error);
        throw new Error("Token refresh failed");
      }
    } catch (error) {
      console.error("[AUTH REFRESH] Token refresh error:", error);
      clearTokens();
      throw error;
    }
  }, [dispatch, clearTokens]);

  // Configure API client with auth providers - run only once
  React.useEffect(() => {
    console.log("[AUTH CONFIG] Setting up API client auth providers");

    apiClient.setAuthTokenProvider(() => {
      // Always prioritize localStorage for consistency
      const localStorageToken = localStorage.getItem("access_token");
      return localStorageToken;
    });

    apiClient.setRefreshTokenProvider(refreshToken);
  }, [refreshToken]); // Only depend on refreshToken function

  const loadPreferences = React.useCallback(async (): Promise<void> => {
    try {
      const response = await apiClient.get<UserPreferences>(
        "/auth/preferences"
      );

      if (response.success && response.data) {
        dispatch({ type: "AUTH_SET_PREFERENCES", payload: response.data });
      }
    } catch (error) {
      console.warn("Failed to load preferences:", error);
    }
  }, [dispatch]);

  const loadAvailableModels = React.useCallback(async (): Promise<void> => {
    try {
      const response = await apiClient.get<{ models: AvailableModel[] }>(
        "/auth/available-models"
      );

      if (response.success && response.data) {
        dispatch({
          type: "AUTH_SET_AVAILABLE_MODELS",
          payload: response.data.models,
        });
      }
    } catch (error) {
      console.warn("Failed to load available models:", error);
    }
  }, [dispatch]);

  // Initialize auth state from localStorage - run only once on mount
  React.useEffect(() => {
    const initializeAuth = async () => {
      console.log("[AUTH INIT] Starting auth initialization");
      try {
        const accessToken = localStorage.getItem("access_token");
        const refreshTokenValue = localStorage.getItem("refresh_token");

        if (accessToken) {
          console.log("[AUTH INIT] Found existing token, verifying...");
          dispatch({
            type: "AUTH_REFRESH_TOKEN",
            payload: accessToken,
          });

          // Verify token and load user data
          try {
            const response = await apiClient.get<User>("/auth/me");

            if (response.success && response.data) {
              console.log("[AUTH INIT] Token valid, user authenticated");
              dispatch({
                type: "AUTH_LOGIN_SUCCESS",
                payload: {
                  user: response.data,
                  tokens: {
                    accessToken,
                    refreshToken: refreshTokenValue || "",
                  },
                },
              });

              // Load additional data
              try {
                await Promise.all([loadPreferences(), loadAvailableModels()]);
              } catch (prefError) {
                console.warn(
                  "[AUTH INIT] Failed to load preferences/models:",
                  prefError
                );
                // Don't fail auth init if preferences fail
              }
            } else {
              console.log("[AUTH INIT] Token invalid, clearing auth state");
              clearTokens();
            }
          } catch (profileError) {
            console.error(
              "[AUTH INIT] Profile verification failed:",
              profileError
            );

            // If we get a network error, don't clear tokens - might be temporary
            // If we get auth error (401/403), clear tokens
            if (profileError instanceof Error) {
              const errorMessage = profileError.message.toLowerCase();
              if (
                errorMessage.includes("401") ||
                errorMessage.includes("403") ||
                errorMessage.includes("unauthorized")
              ) {
                console.log("[AUTH INIT] Auth error detected, clearing tokens");
                clearTokens();
              } else {
                console.log(
                  "[AUTH INIT] Network error, keeping tokens for retry"
                );
                // Just set loading to false and let user try manually
                dispatch({ type: "AUTH_SET_LOADING", payload: false });
              }
            } else {
              // Unknown error, clear tokens to be safe
              clearTokens();
            }
          }
        } else {
          console.log("[AUTH INIT] No token found, starting unauthenticated");
          dispatch({ type: "AUTH_SET_LOADING", payload: false });
        }
      } catch (error) {
        console.error("[AUTH INIT] Initialization failed:", error);
        clearTokens();
      } finally {
        // Ensure loading is false
        dispatch({ type: "AUTH_SET_LOADING", payload: false });
      }
    };

    initializeAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount - ignore deps warning

  // Auth actions
  const login = async (email: string, password: string): Promise<void> => {
    const loginId = Math.random().toString(36).substr(2, 9);
    console.log(`🔑 [AUTH-${loginId}] Starting login process:`, {
      email,
      hasPassword: !!password,
      timestamp: new Date().toISOString(),
    });

    let timeoutHandle: NodeJS.Timeout | null = null;
    try {
      console.log(`⏳ [AUTH-${loginId}] Setting loading state to true`);
      dispatch({ type: "AUTH_SET_LOADING", payload: true });

      // Warn if API call takes too long
      timeoutHandle = setTimeout(() => {
        console.warn(
          `⏰ [AUTH-${loginId}] Login API call taking longer than 5 seconds...`
        );
      }, 5000);

      console.log(`📤 [AUTH-${loginId}] Making login API call`);
      const response = await apiClient.post<{
        access_token: string;
        refresh_token: string;
        user: User;
      }>("/auth/login", { email, password });

      if (timeoutHandle) clearTimeout(timeoutHandle);
      console.log(`📥 [AUTH-${loginId}] Login API response:`, response);

      if (response.success && response.data) {
        const { access_token, refresh_token, user } = response.data;
        console.log(
          `✅ [AUTH-${loginId}] Login successful, storing tokens and user data`
        );
        localStorage.setItem("access_token", access_token);
        localStorage.setItem("refresh_token", refresh_token);
        console.log(`📝 [AUTH-${loginId}] Dispatching login success action`);
        dispatch({
          type: "AUTH_LOGIN_SUCCESS",
          payload: {
            user,
            tokens: { accessToken: access_token, refreshToken: refresh_token },
          },
        });
        console.log(
          `🔄 [AUTH-${loginId}] Loading additional user data (preferences and models)`
        );
        await Promise.all([loadPreferences(), loadAvailableModels()]);
        console.log(
          `🎉 [AUTH-${loginId}] Login process completed successfully`
        );
        handleAPISuccess("Login successful!");
      } else {
        console.log(
          `❌ [AUTH-${loginId}] Login failed - API returned error`,
          response
        );
        handleAPIError(response, "Login failed");
        throw new Error(response.error?.message || "Login failed");
      }
    } catch (error) {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      console.error(`💥 [AUTH-${loginId}] Login error:`, error);
      dispatch({ type: "AUTH_SET_LOADING", payload: false });
      // Optionally, show a toast for network errors
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Unknown login error");
      }
      throw error;
    }
  };

  const register = async (
    email: string,
    password: string,
    fullName: string
  ): Promise<void> => {
    try {
      dispatch({ type: "AUTH_SET_LOADING", payload: true });

      const response = await apiClient.post<{
        access_token: string;
        refresh_token: string;
        user: User;
      }>("/auth/register", { email, password, full_name: fullName });

      if (response.success && response.data) {
        const { access_token, refresh_token, user } = response.data;

        // Store tokens
        localStorage.setItem("access_token", access_token);
        localStorage.setItem("refresh_token", refresh_token);

        dispatch({
          type: "AUTH_LOGIN_SUCCESS",
          payload: {
            user,
            tokens: { accessToken: access_token, refreshToken: refresh_token },
          },
        });

        // Load additional data
        await Promise.all([loadPreferences(), loadAvailableModels()]);

        handleAPISuccess("Registration successful!");
      } else {
        handleAPIError(response, "Registration failed");
        throw new Error(response.error?.message || "Registration failed");
      }
    } catch (error) {
      dispatch({ type: "AUTH_SET_LOADING", payload: false });
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Call backend logout endpoint to invalidate token
      await apiClient.post("/auth/logout");
    } catch (error) {
      console.warn(
        "Backend logout failed, proceeding with local logout:",
        error
      );
    } finally {
      // Always clear local state regardless of backend call result
      clearTokens();
      // Reset analysis state when logging out
      dispatch({ type: "ANALYSIS_RESET" });
      toast.success("Logged out successfully");
    }
  };

  const updatePreferences = async (
    newPreferences: UserPreferences
  ): Promise<void> => {
    try {
      const response = await apiClient.put<UserPreferences>(
        "/auth/preferences",
        newPreferences
      );

      if (response.success) {
        dispatch({ type: "AUTH_SET_PREFERENCES", payload: newPreferences });
        handleAPISuccess("Preferences updated successfully!");
      } else {
        handleAPIError(response, "Failed to update preferences");
        throw new Error(
          response.error?.message || "Failed to update preferences"
        );
      }
    } catch (error) {
      throw error;
    }
  };

  const updateProfile = async (fullName: string): Promise<void> => {
    try {
      const response = await apiClient.put<User>("/auth/profile", {
        full_name: fullName,
      });

      if (response.success && response.data) {
        dispatch({ type: "AUTH_UPDATE_USER", payload: response.data });
        handleAPISuccess("Profile updated successfully!");
      } else {
        handleAPIError(response, "Failed to update profile");
        throw new Error(response.error?.message || "Failed to update profile");
      }
    } catch (error) {
      throw error;
    }
  };

  const contextValue: AuthContextType = {
    // State from store
    user: authState.user,
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
    preferences: authState.preferences,
    availableModels: authState.availableModels,

    // Actions
    login,
    register,
    logout,
    refreshToken,
    updatePreferences,
    updateProfile,
    loadPreferences,
    loadAvailableModels,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
