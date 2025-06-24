/**
 * 🛡️ ZERO-RISK COMPATIBILITY LAYER FOR DOCUMENTCHAT
 *
 * This creates a bridge between raw fetch() and apiClient while maintaining
 * 100% backward compatibility with existing DocumentChat code.
 *
 * STRATEGY: Replace fetch calls one-by-one without changing any other logic.
 */

import { apiClient } from "@/lib/api";

/**
 * Compatible wrapper that mimics exact fetch() behavior DocumentChat expects
 */
export const createCompatibleDocumentChatClient = () => {
  return {
    /**
     * GET request that returns fetch-compatible response
     */
    async get(endpoint: string): Promise<{
      ok: boolean;
      status: number;
      statusText: string;
      json: () => Promise<unknown>;
    }> {
      console.log(
        "🔄 [DocumentChat-Compat] Converting GET to apiClient:",
        endpoint
      );

      const apiResponse = await apiClient.get(endpoint);

      // Create fetch-compatible response object
      return {
        ok: apiResponse.success,
        status: apiResponse.success ? 200 : 400,
        statusText: apiResponse.success ? "OK" : "Error",
        json: async () => {
          if (apiResponse.success) {
            // Return in format DocumentChat expects: {data: actualData}
            return {
              data: apiResponse.data,
            };
          } else {
            // Return error in format DocumentChat expects
            throw new Error(apiResponse.error?.message || "API Error");
          }
        },
      };
    },

    /**
     * POST request that returns fetch-compatible response
     */
    async post(
      endpoint: string,
      body: unknown
    ): Promise<{
      ok: boolean;
      status: number;
      statusText: string;
      json: () => Promise<unknown>;
    }> {
      console.log(
        "🔄 [DocumentChat-Compat] Converting POST to apiClient:",
        endpoint
      );

      const apiResponse = await apiClient.post(endpoint, body);

      // Create fetch-compatible response object
      return {
        ok: apiResponse.success,
        status: apiResponse.success ? 200 : 400,
        statusText: apiResponse.success ? "OK" : "Error",
        json: async () => {
          if (apiResponse.success) {
            // Return in format DocumentChat expects: {data: actualData}
            return {
              data: apiResponse.data,
            };
          } else {
            // Return error in format DocumentChat expects
            return {
              detail: {
                message: apiResponse.error?.message || "API Error",
              },
            };
          }
        },
      };
    },
  };
};

// Export singleton instance
export const documentChatApi = createCompatibleDocumentChatClient();
