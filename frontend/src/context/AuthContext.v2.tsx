/**
 * Enhanced AuthContext with improved state management and error handling
 */

"use client";
import React, { createContext, useContext, useEffect, ReactNode } from "react";
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
  logout: () => void;
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

  // Configure API client with auth providers
  React.useEffect(() => {
    apiClient.setAuthTokenProvider(() => authState.tokens.accessToken);
    apiClient.setRefreshTokenProvider(refreshToken);
  }, [authState.tokens.accessToken]);

  // Initialize auth state from localStorage
  React.useEffect(() => {
    const initializeAuth = async () => {
      try {
        const accessToken = localStorage.getItem("access_token");
        const refreshToken = localStorage.getItem("refresh_token");

        if (accessToken) {
          dispatch({
            type: "AUTH_REFRESH_TOKEN",
            payload: accessToken,
          });

          // Verify token and load user data
          const response = await apiClient.get<User>("/auth/profile");

          if (response.success && response.data) {
            dispatch({
              type: "AUTH_LOGIN_SUCCESS",
              payload: {
                user: response.data,
                tokens: { accessToken, refreshToken: refreshToken || "" },
              },
            });

            // Load preferences and models in parallel
            await Promise.all([loadPreferences(), loadAvailableModels()]);
          } else {
            // Invalid token, clear storage
            clearTokens();
          }
        }
      } catch (error) {
        console.error("Auth initialization failed:", error);
        clearTokens();
      } finally {
        dispatch({ type: "AUTH_SET_LOADING", payload: false });
      }
    };

    initializeAuth();
  }, []);

  // Token management
  const setTokens = (accessToken: string, refreshToken: string) => {
    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("refresh_token", refreshToken);
    dispatch({
      type: "AUTH_LOGIN_SUCCESS",
      payload: {
        user: authState.user!,
        tokens: { accessToken, refreshToken },
      },
    });
  };

  const clearTokens = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    dispatch({ type: "AUTH_LOGOUT" });
  };

  // Auth actions
  const login = async (email: string, password: string): Promise<void> => {
    const loginId = Math.random().toString(36).substr(2, 9);
    console.log(`🔑 [AUTH-${loginId}] Starting login process:`, {
      email,
      hasPassword: !!password,
      timestamp: new Date().toISOString(),
    });

    try {
      console.log(`⏳ [AUTH-${loginId}] Setting loading state to true`);
      dispatch({ type: "AUTH_SET_LOADING", payload: true });

      console.log(`📤 [AUTH-${loginId}] Making login API call`);
      const response = await apiClient.post<{
        access_token: string;
        refresh_token: string;
        user: User;
      }>("/auth/login", { email, password });

      console.log(`📥 [AUTH-${loginId}] Login API response:`, {
        success: response.success,
        hasData: !!response.data,
        hasError: !!response.error,
        errorCode: response.error?.code,
        errorMessage: response.error?.message,
      });

      if (response.success && response.data) {
        const { access_token, refresh_token, user } = response.data;

        console.log(
          `✅ [AUTH-${loginId}] Login successful, storing tokens and user data`
        );

        // Store tokens
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
        // Load additional data
        await Promise.all([loadPreferences(), loadAvailableModels()]);

        console.log(
          `🎉 [AUTH-${loginId}] Login process completed successfully`
        );
        handleAPISuccess("Login successful!");
      } else {
        console.log(`❌ [AUTH-${loginId}] Login failed - API returned error`);
        handleAPIError(response, "Login failed");
        throw new Error(response.error?.message || "Login failed");
      }
    } catch (error) {
      console.error(`💥 [AUTH-${loginId}] Login error:`, {
        error,
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });

      console.log(
        `🔄 [AUTH-${loginId}] Setting loading state to false due to error`
      );
      dispatch({ type: "AUTH_SET_LOADING", payload: false });
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

  const logout = () => {
    clearTokens();
    // Reset analysis state when logging out
    dispatch({ type: "ANALYSIS_RESET" });
    toast.success("Logged out successfully");
  };

  const refreshToken = async (): Promise<void> => {
    const refreshTokenValue = localStorage.getItem("refresh_token");
    if (!refreshTokenValue) {
      throw new Error("No refresh token available");
    }

    try {
      const response = await apiClient.post<{
        access_token: string;
        refresh_token: string;
      }>("/auth/refresh", { refresh_token: refreshTokenValue });

      if (response.success && response.data) {
        const { access_token, refresh_token } = response.data;
        localStorage.setItem("access_token", access_token);
        localStorage.setItem("refresh_token", refresh_token);

        dispatch({ type: "AUTH_REFRESH_TOKEN", payload: access_token });
      } else {
        throw new Error("Token refresh failed");
      }
    } catch (error) {
      clearTokens();
      throw error;
    }
  };

  const loadPreferences = async (): Promise<void> => {
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
  };

  const loadAvailableModels = async (): Promise<void> => {
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
