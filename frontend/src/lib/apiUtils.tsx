"use client";

import { apiClient } from "@/lib/api";

/**
 * Legacy compatibility hook to replace useApiCall from AuthContext v1
 * This creates a fetch-like interface using the new APIClient
 */
export const useApiCall = () => {
  return async (endpoint: string, options: RequestInit = {}) => {
    const requestId = Math.random().toString(36).substr(2, 9);
    console.log(`🔵 [API-${requestId}] Starting request:`, {
      endpoint,
      method: options.method || "GET",
      hasBody: !!options.body,
      timestamp: new Date().toISOString(),
    });

    try {
      const method = (options.method || "GET").toUpperCase();
      let apiResponse;

      // Parse body data
      let data;
      if (options.body) {
        console.log(`🔍 [API-${requestId}] Parsing body:`, {
          bodyType: typeof options.body,
          isFormData: options.body instanceof FormData,
        });

        if (options.body instanceof FormData) {
          data = options.body;
        } else if (typeof options.body === "string") {
          try {
            data = JSON.parse(options.body);
            console.log(`✅ [API-${requestId}] Parsed JSON body:`, data);
          } catch {
            data = options.body;
            console.log(`⚠️ [API-${requestId}] Using raw string body`);
          }
        } else {
          data = options.body;
          console.log(`📝 [API-${requestId}] Using direct body:`, data);
        }
      }

      console.log(
        `🚀 [API-${requestId}] Making ${method} request to ${endpoint}`
      );

      // Call appropriate method on apiClient
      switch (method) {
        case "GET":
          console.log(`📥 [API-${requestId}] Calling apiClient.get()`);
          apiResponse = await apiClient.get(endpoint);
          break;
        case "POST":
          console.log(
            `📤 [API-${requestId}] Calling apiClient.post() with data:`,
            data
          );
          apiResponse = await apiClient.post(endpoint, data);
          break;
        case "PUT":
          console.log(
            `📝 [API-${requestId}] Calling apiClient.put() with data:`,
            data
          );
          apiResponse = await apiClient.put(endpoint, data);
          break;
        case "PATCH":
          console.log(
            `🔧 [API-${requestId}] Calling apiClient.patch() with data:`,
            data
          );
          apiResponse = await apiClient.patch(endpoint, data);
          break;
        case "DELETE":
          console.log(`🗑️ [API-${requestId}] Calling apiClient.delete()`);
          apiResponse = await apiClient.delete(endpoint);
          break;
        default:
          throw new Error(`Unsupported HTTP method: ${method}`);
      }

      console.log(`✅ [API-${requestId}] API response received:`, {
        success: apiResponse.success,
        hasData: !!apiResponse.data,
        hasError: !!apiResponse.error,
        errorCode: apiResponse.error?.code,
        errorMessage: apiResponse.error?.message,
      });

      console.log(`✅ [API-${requestId}] API response received:`, {
        success: apiResponse.success,
        hasData: !!apiResponse.data,
        hasError: !!apiResponse.error,
        errorCode: apiResponse.error?.code,
        errorMessage: apiResponse.error?.message,
      });

      // Convert APIResponse back to fetch-like response for backwards compatibility
      const fetchResponse = {
        ok: apiResponse.success,
        status: apiResponse.success ? 200 : 400,
        statusText: apiResponse.success ? "OK" : "Error",
        json: async () => {
          console.log(`📋 [API-${requestId}] Converting to JSON response`);
          if (apiResponse.success) {
            console.log(
              `✅ [API-${requestId}] Returning success data:`,
              apiResponse.data
            );
            return apiResponse.data;
          } else {
            console.log(
              `❌ [API-${requestId}] Throwing error:`,
              apiResponse.error?.message
            );
            throw new Error(apiResponse.error?.message || "API Error");
          }
        },
        text: async () => {
          console.log(`📄 [API-${requestId}] Converting to text response`);
          if (apiResponse.success) {
            return JSON.stringify(apiResponse.data);
          } else {
            return apiResponse.error?.message || "API Error";
          }
        },
      };

      console.log(`🏁 [API-${requestId}] Request completed successfully`);
      return fetchResponse;
      console.log(`🏁 [API-${requestId}] Request completed successfully`);
      return fetchResponse;
    } catch (error) {
      console.error(`❌ [API-${requestId}] API call error:`, {
        error,
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        endpoint,
        method: options.method || "GET",
      });
      throw error;
    }
  };
};
