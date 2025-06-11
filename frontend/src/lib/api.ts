/**
 * Centralized API client with standardized response handling
 */

import { toast } from "react-hot-toast";

// API Response types based on backend standardization
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  meta?: Record<string, any>;
  correlation_id?: string;
}

export interface PaginationMeta {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

class APIClient {
  private baseURL: string;
  private authTokenProvider?: () => string | null;
  private refreshTokenProvider?: () => Promise<void>;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  setAuthTokenProvider(provider: () => string | null) {
    this.authTokenProvider = provider;
  }

  setRefreshTokenProvider(provider: () => Promise<void>) {
    this.refreshTokenProvider = provider;
  }

  private getAuthToken(): string | null {
    return this.authTokenProvider ? this.authTokenProvider() : null;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<APIResponse<T>> {
    const requestId = Math.random().toString(36).substr(2, 9);
    const url = `${this.baseURL}${endpoint}`;
    const token = this.getAuthToken();

    console.log(`🔵 [APIClient-${requestId}] Starting request:`, {
      endpoint,
      url,
      method: options.method || "GET",
      hasToken: !!token,
      hasBody: !!options.body,
      timestamp: new Date().toISOString(),
    });

    // Prepare headers
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    // Set content type for non-FormData requests
    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    // Add auth token if available
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
      console.log(
        `🔑 [APIClient-${requestId}] Added auth token (${token.substring(
          0,
          10
        )}...)`
      );
    } else {
      console.log(`⚠️ [APIClient-${requestId}] No auth token available`);
    }

    console.log(`📤 [APIClient-${requestId}] Making fetch request:`, {
      url,
      method: options.method || "GET",
      headers: {
        ...headers,
        Authorization: headers.Authorization ? "[HIDDEN]" : undefined,
      },
      bodyType: options.body ? typeof options.body : "none",
    });

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      console.log(`📥 [APIClient-${requestId}] Fetch response received:`, {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
      });

      // Handle token refresh for 401 errors
      if (response.status === 401 && token && this.refreshTokenProvider) {
        console.log(
          `🔄 [APIClient-${requestId}] 401 error, attempting token refresh`
        );
        try {
          console.log(`⏳ [APIClient-${requestId}] Starting token refresh`);
          await this.refreshTokenProvider();
          const newToken = this.getAuthToken();

          console.log(
            `🔍 [APIClient-${requestId}] After refresh, token exists:`,
            !!newToken
          );

          if (newToken) {
            console.log(
              `🔑 [APIClient-${requestId}] Using new token for retry`
            );
            headers["Authorization"] = `Bearer ${newToken}`;

            console.log(
              `🔁 [APIClient-${requestId}] Retrying request with new token`
            );
            const retryResponse = await fetch(url, {
              ...options,
              headers,
            });

            console.log(`📥 [APIClient-${requestId}] Retry response:`, {
              status: retryResponse.status,
              ok: retryResponse.ok,
              statusText: retryResponse.statusText,
            });

            return this.parseResponse<T>(retryResponse);
          } else {
            console.warn(
              `⚠️ [APIClient-${requestId}] Refresh succeeded but no new token received`
            );
          }
        } catch (refreshError) {
          console.error(`❌ [APIClient-${requestId}] Token refresh failed:`, {
            error: refreshError,
            message:
              refreshError instanceof Error
                ? refreshError.message
                : "Unknown error",
            stack:
              refreshError instanceof Error ? refreshError.stack : undefined,
          });
          throw new Error("Session expired. Please login again.");
        }
      }

      console.log(
        `✅ [APIClient-${requestId}] Request successful, parsing response`
      );
      return this.parseResponse<T>(response);
    } catch (error) {
      console.error(`❌ [APIClient-${requestId}] API request failed:`, {
        error,
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        url,
        method: options.method || "GET",
      });
      return {
        success: false,
        error: {
          code: "NETWORK_ERROR",
          message:
            error instanceof Error ? error.message : "Network error occurred",
        },
      };
    }
  }

  private async parseResponse<T>(response: Response): Promise<APIResponse<T>> {
    const responseId = Math.random().toString(36).substr(2, 9);
    console.log(`🔍 [APIClient-Parse-${responseId}] Parsing response:`, {
      status: response.status,
      url: response.url,
      contentType: response.headers.get("content-type"),
      statusText: response.statusText,
    });

    try {
      const data = await response.json();

      console.log(`📄 [APIClient-Parse-${responseId}] Parsed response data:`, {
        hasSuccess: typeof data.success === "boolean",
        hasData: !!data,
        hasError: !!data.error,
        responseKeys: Object.keys(data),
      });

      // Check if response follows our standardized format
      if (typeof data.success === "boolean") {
        console.log(
          `✅ [APIClient-Parse-${responseId}] Using standardized response format`
        );
        return data as APIResponse<T>;
      }

      // Legacy response format - wrap in standardized format
      if (response.ok) {
        console.log(
          `✅ [APIClient-Parse-${responseId}] Using legacy success response format`
        );
        return {
          success: true,
          data: data as T,
        };
      } else {
        console.log(
          `❌ [APIClient-Parse-${responseId}] Using legacy error response format`,
          {
            status: response.status,
            statusText: response.statusText,
            errorMessage: data.detail || data.message,
          }
        );
        return {
          success: false,
          error: {
            code: `HTTP_${response.status}`,
            message: data.detail || data.message || response.statusText,
            details: data,
          },
        };
      }
    } catch (parseError) {
      console.error(
        `❌ [APIClient-Parse-${responseId}] Failed to parse JSON response:`,
        {
          error: parseError,
          message:
            parseError instanceof Error
              ? parseError.message
              : "Unknown parse error",
          url: response.url,
          status: response.status,
          statusText: response.statusText,
        }
      );

      // Try to get the raw text to help with debugging
      try {
        response.text().then((text) => {
          console.error(
            `📄 [APIClient-Parse-${responseId}] Raw response that failed to parse:`,
            text.substring(0, 500) + (text.length > 500 ? "..." : "")
          );
        });
      } catch (e) {
        console.error(
          `❌ [APIClient-Parse-${responseId}] Could not get raw text:`,
          e
        );
      }

      return {
        success: false,
        error: {
          code: "PARSE_ERROR",
          message: "Failed to parse response",
          details: {
            parseError:
              parseError instanceof Error
                ? parseError.message
                : "Unknown error",
            status: response.status,
            statusText: response.statusText,
          },
        },
      };
    }
  }

  // HTTP Methods
  async get<T>(
    endpoint: string,
    params?: Record<string, string>
  ): Promise<APIResponse<T>> {
    const url = params
      ? `${endpoint}?${new URLSearchParams(params).toString()}`
      : endpoint;

    return this.request<T>(url, { method: "GET" });
  }

  async post<T>(endpoint: string, data?: any): Promise<APIResponse<T>> {
    const body = data instanceof FormData ? data : JSON.stringify(data);
    return this.request<T>(endpoint, { method: "POST", body });
  }

  async put<T>(endpoint: string, data?: any): Promise<APIResponse<T>> {
    const body = data instanceof FormData ? data : JSON.stringify(data);
    return this.request<T>(endpoint, { method: "PUT", body });
  }

  async patch<T>(endpoint: string, data?: any): Promise<APIResponse<T>> {
    const body = data instanceof FormData ? data : JSON.stringify(data);
    return this.request<T>(endpoint, { method: "PATCH", body });
  }

  async delete<T>(endpoint: string): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, { method: "DELETE" });
  }

  // File upload helper
  async uploadFile<T>(
    endpoint: string,
    file: File,
    additionalData?: Record<string, any>
  ): Promise<APIResponse<T>> {
    const formData = new FormData();
    formData.append("file", file);

    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(
          key,
          typeof value === "string" ? value : JSON.stringify(value)
        );
      });
    }

    return this.post<T>(endpoint, formData);
  }
}

// Create and configure the main API client
export const apiClient = new APIClient(
  `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1`
);

// Error handling utilities
export const handleAPIError = (
  response: APIResponse<any>,
  customMessage?: string
) => {
  if (!response.success && response.error) {
    const message =
      customMessage || response.error.message || "An error occurred";
    // Defer toast to avoid state update during render
    setTimeout(() => {
      toast.error(message);
    }, 0);
    console.error("API Error:", response.error);
  }
};

export const handleAPISuccess = (message?: string) => {
  if (message) {
    // Defer toast to avoid state update during render
    setTimeout(() => {
      toast.success(message);
    }, 0);
  }
};

export default apiClient;
