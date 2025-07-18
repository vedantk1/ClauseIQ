/**
 * PDF.js Worker Setup for Next.js 15 + Turbopack Compatibility
 * 
 * This utility properly configures PDF.js workers to work with Next.js 15
 * and resolves common CORS, module resolution, and build issues.
 */

let pdfJsWorkerSetup = false;

export function setupPDFWorker() {
  // Only setup once to avoid multiple worker configurations
  if (pdfJsWorkerSetup) {
    return;
  }

  try {
    // Dynamic import to avoid SSR issues
    if (typeof window !== 'undefined') {
      // Use CDN with CORS support and .mjs extension for Next.js 15 compatibility
      // This approach is recommended by the PDF.js community for Next.js projects
      const workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.mjs`;
      
      // Configure PDF.js worker URL using global assignment
      // This method works with both development and production builds
      const windowAny = window as any;
      const globalAny = globalThis as any;
      
      if ('pdfjs-dist' in window || globalAny.pdfjsLib) {
        // If pdfjs is already loaded
        const pdfjs = windowAny.pdfjsLib || globalAny.pdfjsLib;
        if (pdfjs && pdfjs.GlobalWorkerOptions) {
          pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
        }
      } else {
        // Set up for when pdfjs loads
        windowAny.pdfjsWorkerSrc = workerSrc;
      }

      console.log('📄 PDF.js worker configured successfully:', workerSrc);
      pdfJsWorkerSetup = true;
    }
  } catch (error) {
    console.error('❌ Failed to setup PDF.js worker:', error);
    // Fallback: Set a flag to retry later
    pdfJsWorkerSetup = false;
  }
}

/**
 * Get the appropriate PDF.js worker URL for the current environment
 */
export function getPDFWorkerUrl(): string {
  const version = '3.11.174'; // Match the version in package.json
  
  if (process.env.NODE_ENV === 'production') {
    // Use CDN for production for better performance and reliability
    return `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.mjs`;
  } else {
    // Use CDN for development as well to avoid build issues
    return `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.mjs`;
  }
}

/**
 * Initialize PDF.js with proper worker configuration
 * Call this before using any PDF.js functionality
 */
export async function initializePDFJS() {
  if (typeof window === 'undefined') {
    return; // Skip on server-side
  }

  try {
    // Setup worker first
    setupPDFWorker();

    // Dynamic import of PDF.js to avoid SSR issues
    const pdfjs = await import('@react-pdf-viewer/core');
    
    // Additional configuration if needed
    console.log('✅ PDF.js initialized successfully');
    
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize PDF.js:', error);
    return false;
  }
} 