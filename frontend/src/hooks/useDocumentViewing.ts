import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import config from '@/config/config';

/**
 * Hook for tracking document views and managing last viewed timestamps
 */
export function useDocumentViewing() {
  const router = useRouter();

  /**
   * Track that a document has been viewed by sending a request to the backend
   */
  const trackDocumentView = useCallback(async (documentId: string): Promise<boolean> => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        console.warn('No access token found for tracking document view');
        return false;
      }

      const response = await fetch(
        `${config.apiUrl}/api/v1/documents/${documentId}/view`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.error(`Failed to track document view: ${response.status}`);
        return false;
      }

      const result = await response.json();
      
      if (result.success) {
        console.log(`Document view tracked successfully for ${documentId}`);
        return true;
      } else {
        console.error('View tracking failed:', result.error);
        return false;
      }
    } catch (error) {
      console.error('Error tracking document view:', error);
      return false;
    }
  }, []);

  /**
   * Format a last viewed timestamp into a human-readable relative time
   */
  const formatLastViewed = useCallback((lastViewedTimestamp: string | null | undefined): string => {
    if (!lastViewedTimestamp) {
      return 'Never';
    }

    try {
      const lastViewed = new Date(lastViewedTimestamp);
      const now = new Date();
      
      // Validate the date
      if (isNaN(lastViewed.getTime())) {
        return 'Unknown';
      }
      
      const diffMs = now.getTime() - lastViewed.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      // If in the future (shouldn't happen), show "Just now"
      if (diffMs < 0) {
        return 'Just now';
      }

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
      if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
      
      return lastViewed.toLocaleDateString();
    } catch (error) {
      console.error('Error formatting last viewed timestamp:', error);
      return 'Unknown';
    }
  }, []);

  return {
    trackDocumentView,
    formatLastViewed,
  };
}