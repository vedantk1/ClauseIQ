// API service for user interactions (notes and flags)
import config from "@/config/config";

export interface UserInteraction {
  clause_id: string;
  user_id: string;
  note?: string;
  is_flagged: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserInteractionRequest {
  note?: string;
  is_flagged: boolean;
}

export interface UserInteractionsResponse {
  interactions: Record<string, UserInteraction>;
}

class UserInteractionService {
  private async getAuthHeaders(): Promise<HeadersInit> {
    const token = localStorage.getItem("access_token");
    return {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    };
  }

  /**
   * Get all user interactions for a document
   */
  async getUserInteractions(
    documentId: string
  ): Promise<Record<string, UserInteraction>> {
    console.log(
      "🔍 [DEBUG] getUserInteractions called with documentId:",
      documentId
    );

    if (!documentId) {
      console.error("❌ [DEBUG] No documentId provided");
      throw new Error("Document ID is required");
    }

    try {
      const url = `${config.apiUrl}/api/v1/analysis/documents/${documentId}/interactions`;
      console.log("📡 [DEBUG] Making request to:", url);

      const headers = await this.getAuthHeaders();
      console.log("🔐 [DEBUG] Request headers:", headers);

      const response = await fetch(url, {
        method: "GET",
        headers,
      });

      console.log("📥 [DEBUG] Response status:", response.status);
      console.log(
        "📥 [DEBUG] Response headers:",
        Object.fromEntries(response.headers.entries())
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ [DEBUG] Error response body:", errorText);
        throw new Error(
          `Failed to fetch user interactions: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const data = await response.json();
      console.log("✅ [DEBUG] Response data:", data);
      return data.data?.interactions || {};
    } catch (error) {
      console.error("❌ [DEBUG] Error fetching user interactions:", error);
      throw error;
    }
  }

  /**
   * Save or update user interaction for a specific clause
   */
  async saveUserInteraction(
    documentId: string,
    clauseId: string,
    interaction: UserInteractionRequest
  ): Promise<UserInteraction> {
    try {
      const response = await fetch(
        `${config.apiUrl}/api/v1/analysis/documents/${documentId}/interactions/${clauseId}`,
        {
          method: "PUT",
          headers: await this.getAuthHeaders(),
          body: JSON.stringify(interaction),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to save user interaction: ${response.statusText}`
        );
      }

      const data = await response.json();
      return data.data?.interaction;
    } catch (error) {
      console.error("Error saving user interaction:", error);
      throw error;
    }
  }

  /**
   * Delete user interaction for a specific clause
   */
  async deleteUserInteraction(
    documentId: string,
    clauseId: string
  ): Promise<void> {
    try {
      const response = await fetch(
        `${config.apiUrl}/api/v1/analysis/documents/${documentId}/interactions/${clauseId}`,
        {
          method: "DELETE",
          headers: await this.getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to delete user interaction: ${response.statusText}`
        );
      }
    } catch (error) {
      console.error("Error deleting user interaction:", error);
      throw error;
    }
  }

  /**
   * Helper method to save only a note
   */
  async saveNote(
    documentId: string,
    clauseId: string,
    note: string
  ): Promise<UserInteraction> {
    return this.saveUserInteraction(documentId, clauseId, {
      note,
      is_flagged: false, // Will be overridden by backend if already flagged
    });
  }

  /**
   * Helper method to save only a flag status
   */
  async saveFlag(
    documentId: string,
    clauseId: string,
    isFlagged: boolean
  ): Promise<UserInteraction> {
    return this.saveUserInteraction(documentId, clauseId, {
      is_flagged: isFlagged,
    });
  }
}

export const userInteractionService = new UserInteractionService();
