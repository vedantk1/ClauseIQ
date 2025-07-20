/**
 * Toast notification component that integrates with our centralized state management
 */
"use client";

import React, { useEffect } from "react";
import { cn } from "../../lib/utils";
import { useUIState, useAppState } from "../../store/appState";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";

const Toast = () => {
  const { notifications } = useUIState();
  const { dispatch } = useAppState();

  // Auto-remove notifications after 5 seconds
  useEffect(() => {
    notifications.forEach((notification) => {
      const timer = setTimeout(() => {
        dispatch({ type: "UI_REMOVE_NOTIFICATION", payload: notification.id });
      }, 5000);

      return () => clearTimeout(timer);
    });
  }, [notifications, dispatch]);

  const removeNotification = (id: string) => {
    dispatch({ type: "UI_REMOVE_NOTIFICATION", payload: id });
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle className="h-5 w-5" />;
      case "error":
        return <AlertCircle className="h-5 w-5" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5" />;
      case "info":
      default:
        return <Info className="h-5 w-5" />;
    }
  };

  const getTypeStyles = (type: string) => {
    switch (type) {
      case "success":
        return "bg-green-50 border-green-200 text-green-800";
      case "error":
        return "bg-red-50 border-red-200 text-red-800";
      case "warning":
        return "bg-yellow-50 border-yellow-200 text-yellow-800";
      case "info":
      default:
        return "bg-blue-50 border-blue-200 text-blue-800";
    }
  };

  const getIconStyles = (type: string) => {
    switch (type) {
      case "success":
        return "text-green-400";
      case "error":
        return "text-red-400";
      case "warning":
        return "text-yellow-400";
      case "info":
      default:
        return "text-blue-400";
    }
  };

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={cn(
            "flex items-start gap-3 p-4 rounded-lg border shadow-lg backdrop-blur-sm transition-all duration-300 ease-in-out transform",
            "animate-in slide-in-from-right-full",
            getTypeStyles(notification.type)
          )}
          style={{ maxWidth: "400px" }}
        >
          <div
            className={cn("flex-shrink-0", getIconStyles(notification.type))}
          >
            {getIcon(notification.type)}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{notification.message}</p>
          </div>

          <button
            onClick={() => removeNotification(notification.id)}
            className="flex-shrink-0 p-1 hover:bg-black/10 rounded-md transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

// Hook to add notifications
export const useNotification = () => {
  const { dispatch } = useAppState();

  const addNotification = (
    type: "info" | "success" | "warning" | "error",
    message: string
  ) => {
    dispatch({
      type: "UI_ADD_NOTIFICATION",
      payload: { type, message },
    });
  };

  return {
    success: (message: string) => addNotification("success", message),
    error: (message: string) => addNotification("error", message),
    warning: (message: string) => addNotification("warning", message),
    info: (message: string) => addNotification("info", message),
  };
};

export { Toast };
export default Toast;
