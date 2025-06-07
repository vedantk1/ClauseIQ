/**
 * Centralized state management using React Context and Reducers
 */
"use client";

import React, { createContext, useContext, useReducer, ReactNode } from "react";
import {
  User,
  UserPreferences,
  AvailableModel,
  Document,
  Section,
  Clause,
  RiskSummary,
} from "@clauseiq/shared-types";

// State interfaces
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  preferences: UserPreferences | null;
  availableModels: AvailableModel[];
  tokens: {
    accessToken: string | null;
    refreshToken: string | null;
  };
}

export interface AnalysisState {
  documents: Document[];
  currentDocument: {
    id: string | null;
    filename: string;
    sections: Section[];
    clauses: Clause[];
    summary: string;
    fullText: string;
    riskSummary: RiskSummary;
    selectedClause: Clause | null;
  };
  isLoading: boolean;
  error: string | null;
}

export interface AppState {
  auth: AuthState;
  analysis: AnalysisState;
  ui: {
    sidebarOpen: boolean;
    theme: "light" | "dark";
    notifications: Array<{
      id: string;
      type: "info" | "success" | "warning" | "error";
      message: string;
      timestamp: number;
    }>;
  };
}

// Action types
export type AuthAction =
  | { type: "AUTH_SET_LOADING"; payload: boolean }
  | {
      type: "AUTH_LOGIN_SUCCESS";
      payload: {
        user: User;
        tokens: { accessToken: string; refreshToken: string };
      };
    }
  | { type: "AUTH_LOGOUT" }
  | { type: "AUTH_SET_PREFERENCES"; payload: UserPreferences }
  | { type: "AUTH_SET_AVAILABLE_MODELS"; payload: AvailableModel[] }
  | { type: "AUTH_UPDATE_USER"; payload: Partial<User> }
  | { type: "AUTH_REFRESH_TOKEN"; payload: string };

export type AnalysisAction =
  | { type: "ANALYSIS_SET_LOADING"; payload: boolean }
  | { type: "ANALYSIS_SET_ERROR"; payload: string | null }
  | { type: "ANALYSIS_SET_DOCUMENTS"; payload: Document[] }
  | { type: "ANALYSIS_ADD_DOCUMENT"; payload: Document }
  | {
      type: "ANALYSIS_SET_CURRENT_DOCUMENT";
      payload: Partial<AnalysisState["currentDocument"]>;
    }
  | {
      type: "ANALYSIS_UPDATE_CURRENT_DOCUMENT";
      payload: Partial<AnalysisState["currentDocument"]>;
    }
  | { type: "ANALYSIS_SET_SELECTED_CLAUSE"; payload: Clause | null }
  | { type: "ANALYSIS_RESET" };

export type UIAction =
  | { type: "UI_TOGGLE_SIDEBAR" }
  | { type: "UI_SET_THEME"; payload: "light" | "dark" }
  | { type: "UI_ADD_NOTIFICATION"; payload: { type: string; message: string } }
  | { type: "UI_REMOVE_NOTIFICATION"; payload: string };

export type AppAction = AuthAction | AnalysisAction | UIAction;

// Initial states
const initialAuthState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  preferences: null,
  availableModels: [],
  tokens: {
    accessToken: null,
    refreshToken: null,
  },
};

const initialAnalysisState: AnalysisState = {
  documents: [],
  currentDocument: {
    id: null,
    filename: "",
    sections: [],
    clauses: [],
    summary: "",
    fullText: "",
    riskSummary: { high: 0, medium: 0, low: 0 },
    selectedClause: null,
  },
  isLoading: false,
  error: null,
};

const initialAppState: AppState = {
  auth: initialAuthState,
  analysis: initialAnalysisState,
  ui: {
    sidebarOpen: false,
    theme: "light",
    notifications: [],
  },
};

// Reducers
const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case "AUTH_SET_LOADING":
      return { ...state, isLoading: action.payload };

    case "AUTH_LOGIN_SUCCESS":
      return {
        ...state,
        user: action.payload.user,
        isAuthenticated: true,
        isLoading: false,
        tokens: action.payload.tokens,
      };

    case "AUTH_LOGOUT":
      return {
        ...initialAuthState,
        isLoading: false,
      };

    case "AUTH_SET_PREFERENCES":
      return { ...state, preferences: action.payload };

    case "AUTH_SET_AVAILABLE_MODELS":
      return { ...state, availableModels: action.payload };

    case "AUTH_UPDATE_USER":
      return {
        ...state,
        user: state.user ? { ...state.user, ...action.payload } : null,
      };

    case "AUTH_REFRESH_TOKEN":
      return {
        ...state,
        tokens: { ...state.tokens, accessToken: action.payload },
      };

    default:
      return state;
  }
};

const analysisReducer = (
  state: AnalysisState,
  action: AnalysisAction
): AnalysisState => {
  console.log("🔄 [DEBUG] Analysis reducer action:", {
    type: action.type,
    payload: action.type.includes("DOCUMENT")
      ? "payload" in action &&
        typeof action.payload === "object" &&
        action.payload !== null &&
        "filename" in action.payload
        ? action.payload.filename
        : "payload" in action &&
          typeof action.payload === "object" &&
          action.payload !== null &&
          "id" in action.payload
        ? action.payload.id
        : "N/A"
      : action.type === "ANALYSIS_RESET"
      ? "RESET"
      : "payload" in action
      ? action.payload
      : "N/A",
    timestamp: new Date().toISOString(),
  });

  switch (action.type) {
    case "ANALYSIS_SET_LOADING":
      return { ...state, isLoading: action.payload };

    case "ANALYSIS_SET_ERROR":
      return { ...state, error: action.payload };

    case "ANALYSIS_SET_DOCUMENTS":
      return { ...state, documents: action.payload };

    case "ANALYSIS_ADD_DOCUMENT":
      return {
        ...state,
        documents: [action.payload, ...state.documents],
      };

    case "ANALYSIS_SET_CURRENT_DOCUMENT":
      return {
        ...state,
        currentDocument: { ...state.currentDocument, ...action.payload },
      };

    case "ANALYSIS_UPDATE_CURRENT_DOCUMENT":
      return {
        ...state,
        currentDocument: { ...state.currentDocument, ...action.payload },
      };

    case "ANALYSIS_SET_SELECTED_CLAUSE":
      return {
        ...state,
        currentDocument: {
          ...state.currentDocument,
          selectedClause: action.payload,
        },
      };

    case "ANALYSIS_RESET":
      console.log("🔄 [DEBUG] Analysis state being reset to initial state");
      return initialAnalysisState;

    default:
      return state;
  }
};

const uiReducer = (state: AppState["ui"], action: UIAction): AppState["ui"] => {
  switch (action.type) {
    case "UI_TOGGLE_SIDEBAR":
      return { ...state, sidebarOpen: !state.sidebarOpen };

    case "UI_SET_THEME":
      return { ...state, theme: action.payload };

    case "UI_ADD_NOTIFICATION":
      return {
        ...state,
        notifications: [
          ...state.notifications,
          {
            id: Math.random().toString(36).substr(2, 9),
            type: action.payload.type as
              | "info"
              | "success"
              | "warning"
              | "error",
            message: action.payload.message,
            timestamp: Date.now(),
          },
        ],
      };

    case "UI_REMOVE_NOTIFICATION":
      return {
        ...state,
        notifications: state.notifications.filter(
          (n) => n.id !== action.payload
        ),
      };

    default:
      return state;
  }
};

const appReducer = (state: AppState, action: AppAction): AppState => {
  // Route actions to appropriate reducers
  if (action.type.startsWith("AUTH_")) {
    return { ...state, auth: authReducer(state.auth, action as AuthAction) };
  }

  if (action.type.startsWith("ANALYSIS_")) {
    return {
      ...state,
      analysis: analysisReducer(state.analysis, action as AnalysisAction),
    };
  }

  if (action.type.startsWith("UI_")) {
    return { ...state, ui: uiReducer(state.ui, action as UIAction) };
  }

  return state;
};

// Context
const AppStateContext = createContext<
  | {
      state: AppState;
      dispatch: React.Dispatch<AppAction>;
    }
  | undefined
>(undefined);

// Provider component
export const AppStateProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(appReducer, initialAppState);

  return (
    <AppStateContext.Provider value={{ state, dispatch }}>
      {children}
    </AppStateContext.Provider>
  );
};

// Hook to use the app state
export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (context === undefined) {
    throw new Error("useAppState must be used within an AppStateProvider");
  }
  return context;
};

// Selector hooks for specific state slices
export const useAuthState = () => {
  const { state } = useAppState();
  return state.auth;
};

export const useAnalysisState = () => {
  const { state } = useAppState();
  return state.analysis;
};

export const useUIState = () => {
  const { state } = useAppState();
  return state.ui;
};
