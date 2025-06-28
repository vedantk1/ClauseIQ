/**
 * PDF System Manager
 *
 * A singleton system-level manager that handles:
 * - PDF.js worker configuration (once, globally)
 * - Resource lifecycle management
 * - Centralized error handling
 * - Memory leak prevention
 * - React StrictMode compatibility
 *
 * This is the foundation for all PDF operations in the application.
 */

// Use dynamic imports for PDF.js to avoid Next.js module resolution issues
let pdfjs: typeof import("pdfjs-dist") | null = null;

interface PDFResource {
  id: string;
  url: string;
  blob: Blob;
  createdAt: number;
  lastAccessed: number;
}

class PDFSystemManager {
  private static instance: PDFSystemManager | null = null;
  private isInitialized = false;
  private resources: Map<string, PDFResource> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  // Resource cleanup settings
  private readonly MAX_RESOURCES = 10;
  private readonly CLEANUP_INTERVAL = 30000; // 30 seconds
  private readonly RESOURCE_TTL = 300000; // 5 minutes

  private constructor() {
    // Don't initialize in constructor to avoid SSR issues
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): PDFSystemManager {
    if (!PDFSystemManager.instance) {
      PDFSystemManager.instance = new PDFSystemManager();
    }
    return PDFSystemManager.instance;
  }

  /**
   * Initialize the PDF.js worker system once
   */
  async initialize(): Promise<void> {
    if (this.isInitialized || typeof window === "undefined") {
      return;
    }

    try {
      // Dynamic import of PDF.js to avoid Next.js module resolution issues
      if (!pdfjs) {
        console.log(
          "🔧 PDF System Manager: Dynamically importing pdfjs-dist..."
        );
        pdfjs = await import("pdfjs-dist");
      }

      // Configure PDF.js worker with multiple fallback strategies
      const workerStrategies = [
        // Strategy 1: Use local worker file if available
        "/pdf-worker/pdf.worker.min.mjs",
        // Strategy 2: Use CDN with exact version matching
        `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`,
        // Strategy 3: Use latest CDN version as fallback
        "https://unpkg.com/pdfjs-dist/build/pdf.worker.min.mjs",
      ];

      let workerConfigured = false;
      for (const workerSrc of workerStrategies) {
        try {
          pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
          console.log(
            `🔧 PDF System Manager: Configured PDF.js worker v${pdfjs.version} with: ${workerSrc}`
          );
          workerConfigured = true;
          break;
        } catch (error) {
          console.warn(
            `PDF System Manager: Worker strategy failed: ${workerSrc}`,
            error
          );
        }
      }

      if (!workerConfigured) {
        throw new Error("All worker configuration strategies failed");
      }

      // Start automatic resource cleanup
      this.startCleanupInterval();

      this.isInitialized = true;
      console.log("✅ PDF System Manager: Successfully initialized");
    } catch (error) {
      console.error("PDF System Manager: Failed to initialize:", error);
      throw new Error("PDF system initialization failed");
    }
  }

  /**
   * Ensure the system is initialized before any operation
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Create a PDF resource from blob data
   */
  async createResource(resourceId: string, blob: Blob): Promise<string> {
    await this.ensureInitialized();

    // Clean up existing resource with same ID
    this.destroyResource(resourceId);

    const url = URL.createObjectURL(blob);
    const resource: PDFResource = {
      id: resourceId,
      url,
      blob,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
    };

    this.resources.set(resourceId, resource);

    console.log(
      `📄 PDF System Manager: Created resource ${resourceId} (${this.resources.size}/${this.MAX_RESOURCES})`
    );

    // Trigger cleanup if we exceed max resources
    if (this.resources.size > this.MAX_RESOURCES) {
      this.cleanupOldResources();
    }

    return url;
  }

  /**
   * Access a PDF resource (updates last accessed time)
   */
  accessResource(resourceId: string): string | null {
    const resource = this.resources.get(resourceId);
    if (!resource) {
      console.warn(`PDF System Manager: Resource ${resourceId} not found`);
      return null;
    }

    resource.lastAccessed = Date.now();
    console.log(`🔍 PDF System Manager: Accessed resource ${resourceId}`);
    return resource.url;
  }

  /**
   * Destroy a specific PDF resource
   */
  destroyResource(resourceId: string): void {
    const resource = this.resources.get(resourceId);
    if (resource) {
      URL.revokeObjectURL(resource.url);
      this.resources.delete(resourceId);
      console.log(`🗑️ PDF System Manager: Destroyed resource ${resourceId}`);
    }
  }

  /**
   * Clean up old or excess resources
   */
  private cleanupOldResources(): void {
    const now = Date.now();
    const resourcesToDelete: string[] = [];

    // Find expired resources
    for (const [id, resource] of this.resources) {
      if (now - resource.lastAccessed > this.RESOURCE_TTL) {
        resourcesToDelete.push(id);
      }
    }

    // If we still have too many, remove oldest accessed
    if (this.resources.size - resourcesToDelete.length > this.MAX_RESOURCES) {
      const sortedResources = Array.from(this.resources.entries())
        .filter(([id]) => !resourcesToDelete.includes(id))
        .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);

      const excessCount =
        this.resources.size - resourcesToDelete.length - this.MAX_RESOURCES;
      for (let i = 0; i < excessCount; i++) {
        resourcesToDelete.push(sortedResources[i][0]);
      }
    }

    // Clean up selected resources
    resourcesToDelete.forEach((id) => this.destroyResource(id));

    if (resourcesToDelete.length > 0) {
      console.log(
        `🧹 PDF System Manager: Cleaned up ${resourcesToDelete.length} old resources`
      );
    }
  }

  /**
   * Start automatic resource cleanup interval
   */
  private startCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupOldResources();
    }, this.CLEANUP_INTERVAL);

    console.log(
      `🔄 PDF System Manager: Started cleanup interval (${this.CLEANUP_INTERVAL}ms)`
    );
  }

  /**
   * Stop automatic cleanup and destroy all resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Clean up all resources
    for (const [id] of this.resources) {
      this.destroyResource(id);
    }

    this.isInitialized = false;
    console.log(
      "🔥 PDF System Manager: Destroyed all resources and stopped cleanup"
    );
  }

  /**
   * Get system status for debugging
   */
  getStatus(): {
    initialized: boolean;
    resourceCount: number;
    resources: Array<{
      id: string;
      age: number;
      lastAccessed: number;
    }>;
  } {
    const now = Date.now();
    return {
      initialized: this.isInitialized,
      resourceCount: this.resources.size,
      resources: Array.from(this.resources.entries()).map(([id, resource]) => ({
        id,
        age: now - resource.createdAt,
        lastAccessed: now - resource.lastAccessed,
      })),
    };
  }
}

// Export singleton instance
export const pdfSystemManager = PDFSystemManager.getInstance();

// Export types for external use
export type { PDFResource };
