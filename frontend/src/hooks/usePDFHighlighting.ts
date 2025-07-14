/**
 * Custom hook for PDF highlighting with performance optimizations
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Clause } from '@shared/common_generated';
import { 
  createHighlightStrategies, 
  type HighlightResult,
  calculateTextSimilarity 
} from '@/utils/pdfHighlightUtils';

interface HighlightCache {
  clauseId: string;
  result: HighlightResult;
  timestamp: number;
}

interface UsePDFHighlightingProps {
  highlightFunction: (terms: string | string[]) => Promise<any>; // highlight() returns Promise with results
  clearHighlights: () => void;
  jumpToMatch: (index: number) => void; // Takes 1-based index
  jumpToNextMatch: () => void;
  jumpToPreviousMatch: () => void;
  debounceMs?: number;
  cacheTimeout?: number; // Cache timeout in milliseconds
  viewMode?: "single" | "continuous"; // Handle different scroll modes
}

interface UsePDFHighlightingReturn {
  isHighlighting: boolean;
  highlightResult: HighlightResult | null;
  currentMatchIndex: number;
  totalMatches: number;
  executeHighlighting: (clause: Clause | null) => Promise<void>;
  goToNextMatch: () => void;
  goToPreviousMatch: () => void;
  clearCurrentHighlights: () => void;
}

export function usePDFHighlighting({
  highlightFunction,
  clearHighlights,
  jumpToMatch,
  jumpToNextMatch,
  jumpToPreviousMatch,
  debounceMs = 500,
  cacheTimeout = 5 * 60 * 1000, // 5 minutes
  viewMode = "continuous",
}: UsePDFHighlightingProps): UsePDFHighlightingReturn {
  const [isHighlighting, setIsHighlighting] = useState(false);
  const [highlightResult, setHighlightResult] = useState<HighlightResult | null>(null);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  
  // Cache for successful highlights
  const cacheRef = useRef<Map<string, HighlightCache>>(new Map());
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastClauseRef = useRef<Clause | null>(null);

  // Get timing strategy based on view mode
  const getTimingStrategy = useCallback(() => {
    if (viewMode === "single") {
      return {
        // Single page mode: faster rendering, shorter delays
        initialDelay: 200,
        retryDelay: 500,
        jumpDelay: 100,
        name: "single-page"
      };
    } else {
      return {
        // Continuous mode: virtual scrolling, needs longer delays
        initialDelay: 500,
        retryDelay: 1000,
        jumpDelay: 200,
        name: "continuous-scroll"
      };
    }
  }, [viewMode]);

  // Clean expired cache entries
  const cleanCache = useCallback(() => {
    const now = Date.now();
    const cache = cacheRef.current;
    
    for (const [key, entry] of cache.entries()) {
      if (now - entry.timestamp > cacheTimeout) {
        cache.delete(key);
      }
    }
  }, [cacheTimeout]);

  // Get cached result if available and not expired
  const getCachedResult = useCallback((clauseId: string): HighlightResult | null => {
    const cache = cacheRef.current;
    const entry = cache.get(clauseId);
    
    if (entry && Date.now() - entry.timestamp < cacheTimeout) {
      return entry.result;
    }
    
    return null;
  }, [cacheTimeout]);

  // Cache a successful result
  const cacheResult = useCallback((clauseId: string, result: HighlightResult) => {
    if (result.found) {
      cacheRef.current.set(clauseId, {
        clauseId,
        result,
        timestamp: Date.now()
      });
    }
  }, []);

  // Execute highlighting with strategies and caching
  const executeHighlightingInternal = useCallback(async (clause: Clause) => {
    if (!clause.id || !clause.text) {
      return;
    }

    setIsHighlighting(true);
    setCurrentMatchIndex(0);
    setTotalMatches(0);

    try {
      // Check cache first
      const cachedResult = getCachedResult(clause.id);
      if (cachedResult) {
        console.log(`✅ Using cached highlight result for clause ${clause.id}`);
        setHighlightResult(cachedResult);
        setTotalMatches(cachedResult.matchCount || 1);
        
        // Apply cached highlighting
        if (cachedResult.found) {
          await highlightFunction(cachedResult.searchTerms);
          // Wait for virtual list rendering based on view mode
          const timing = getTimingStrategy();
          await new Promise(resolve => setTimeout(resolve, timing.initialDelay));
          
          // Jump to first match with proper timing
          setTimeout(() => {
            try {
              jumpToMatch(1); // Jump to first match (1-based index)
              console.log('✅ Successfully jumped to first cached match');
            } catch (jumpError) {
              console.warn('⚠️ Cached jump to match failed, using fallback:', jumpError);
              jumpToNextMatch();
            }
          }, timing.jumpDelay);
        }
        
        setIsHighlighting(false);
        return;
      }

      // Clear existing highlights before trying new search
      clearHighlights();

      // Use the exact clause text as search term - simple and clean
      const searchTerm = clause.text.trim();
      console.log(`🔍 Searching for exact clause text: "${searchTerm.substring(0, 100)}..."`);

      // DEBUG: Let's see what the PDF actually contains vs our clause text
      const textElements = document.querySelectorAll('.rpv-core__text-layer span');
      const pdfText = Array.from(textElements).map(el => el.textContent || '').join(' ');
      console.log(`📄 PDF text (first 500 chars): "${pdfText.substring(0, 500)}"`);
      
      // Compare normalized versions
      const normalizedClause = searchTerm.toLowerCase().replace(/\s+/g, ' ').replace(/[^\w\s]/g, '').trim();
      const normalizedPdf = pdfText.toLowerCase().replace(/\s+/g, ' ').replace(/[^\w\s]/g, '').trim();
      
      console.log(`🔍 Normalized clause: "${normalizedClause.substring(0, 100)}..."`);
      console.log(`📄 Does PDF contain normalized clause?`, normalizedPdf.includes(normalizedClause.substring(0, 50)));
      
      // Try to find a distinctive phrase from the clause that exists in PDF
      const clauseWords = searchTerm.split(/\s+/);
      let distinctivePhrase = '';
      
      // Look for longer sequences first (10-15 words), then shorter ones
      const searchLengths = [15, 12, 10, 8, 6]; // Try longer phrases first
      
      for (const length of searchLengths) {
        if (distinctivePhrase) break; // Stop once we find something
        
        for (let i = 0; i <= clauseWords.length - length; i++) {
          const phrase = clauseWords.slice(i, i + length).join(' ');
          const normalizedPhrase = phrase.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
          
          if (normalizedPdf.includes(normalizedPhrase)) {
            distinctivePhrase = phrase;
            console.log(`✅ Found ${length}-word distinctive phrase in PDF: "${distinctivePhrase}"`);
            break;
          }
        }
      }
      
      // If we couldn't find a long phrase, try the first half of the clause
      if (!distinctivePhrase && clauseWords.length > 10) {
        const firstHalf = clauseWords.slice(0, Math.floor(clauseWords.length / 2)).join(' ');
        const normalizedFirstHalf = firstHalf.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
        
        if (normalizedPdf.includes(normalizedFirstHalf)) {
          distinctivePhrase = firstHalf;
          console.log(`✅ Found first half of clause in PDF: "${distinctivePhrase}"`);
        }
      }
      
      const actualSearchTerm = distinctivePhrase || searchTerm;
      console.log(`🎯 Using search term: "${actualSearchTerm}"`);

      try {
        // Execute the highlight with the best search term we can find
        const matchResults = await highlightFunction(actualSearchTerm);
        console.log(`✅ Highlight function completed with exact text`, matchResults);
        
        // Get timing strategy for current view mode
        const timing = getTimingStrategy();
        console.log(`⏱️ Using ${timing.name} timing strategy`);

        // Wait for DOM update with view mode-specific timing
        await new Promise(resolve => setTimeout(resolve, timing.initialDelay));
        
        // Verify matches are actually in DOM
        const highlightElements = document.querySelectorAll('.rpv-search__highlight');
        const domMatchCount = highlightElements.length;
        console.log(`🔍 DOM verification: found ${domMatchCount} highlight elements`);
        
        // If we have highlights in DOM, we succeeded!
        if (domMatchCount > 0) {
          const result: HighlightResult = {
            found: true,
            strategy: 'exact_clause_text',
            searchTerms: searchTerm,
            matchCount: domMatchCount
          };

          setHighlightResult(result);
          setTotalMatches(domMatchCount);

          // Cache the successful result
          cacheResult(clause.id, result);

          // Jump to first match with proper timing for view mode
          console.log(`🎯 Jumping to first match with ${timing.name} timing...`);
          setTimeout(() => {
            try {
              jumpToMatch(1); // Jump to first match (1-based index)
              console.log(`✅ Successfully jumped to first match`);
            } catch (jumpError) {
              console.warn(`⚠️ Jump to match failed:`, jumpError);
              // Fallback to jumpToNextMatch if jumpToMatch fails
              try {
                jumpToNextMatch();
                console.log(`✅ Fallback jumpToNextMatch succeeded`);
              } catch (fallbackError) {
                console.error(`❌ Both jump methods failed:`, fallbackError);
              }
            }
          }, timing.jumpDelay);

          console.log(`✅ Successfully highlighted exact clause text`);
        } else {
          console.warn(`❌ No highlights found for exact clause text`);
          
          // No fallback - just report not found
          const notFoundResult: HighlightResult = {
            found: false,
            strategy: 'exact_clause_text_failed',
            searchTerms: searchTerm,
            matchCount: 0
          };
          setHighlightResult(notFoundResult);
          console.warn('❌ Exact clause text not found in PDF');
        }
      } catch (highlightError) {
        console.error(`❌ Highlight function failed:`, highlightError);
        const errorResult: HighlightResult = {
          found: false,
          strategy: 'error',
          searchTerms: clause.text,
          matchCount: 0
        };
        setHighlightResult(errorResult);
      }
    } catch (error) {
      console.error('Error in highlighting execution:', error);
      setHighlightResult({
        found: false,
        strategy: 'error',
        searchTerms: clause.text || '',
        matchCount: 0
      });
    } finally {
      setIsHighlighting(false);
    }
  }, [
    getCachedResult,
    cacheResult,
    highlightFunction,
    clearHighlights,
    jumpToMatch,
    jumpToNextMatch,
    getTimingStrategy,
    viewMode
  ]);

  // Debounced execute highlighting
  const executeHighlighting = useCallback(async (clause: Clause | null) => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // If no clause, clear highlights immediately
    if (!clause) {
      console.log('🧹 Clearing highlights - no clause selected');
      clearHighlights();
      setHighlightResult(null);
      setCurrentMatchIndex(0);
      setTotalMatches(0);
      lastClauseRef.current = null;
      return;
    }

    // Check if it's the same clause to avoid unnecessary re-highlighting
    const lastClause = lastClauseRef.current;
    if (lastClause && lastClause.id === clause.id) {
      // Same clause, check if text is similar enough
      if (lastClause.text && clause.text) {
        const similarity = calculateTextSimilarity(lastClause.text, clause.text);
        if (similarity > 0.95) {
          console.log('⏭️ Skipping re-highlight for same clause');
          return;
        }
      }
    }

    // Different clause - clear old highlights before processing new one
    if (lastClause && lastClause.id !== clause.id) {
      console.log('🧹 Clearing highlights - switching to different clause');
      clearHighlights();
      // Small delay to ensure highlights are cleared before new search
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    lastClauseRef.current = clause;

    // Debounce the execution
    debounceTimerRef.current = setTimeout(() => {
      executeHighlightingInternal(clause);
    }, debounceMs);
  }, [executeHighlightingInternal, clearHighlights, debounceMs]);

  // Navigation functions
  const goToNextMatch = useCallback(() => {
    const timing = getTimingStrategy();
    
    if (totalMatches > 1) {
      setCurrentMatchIndex((prev) => {
        const next = prev < totalMatches - 1 ? prev + 1 : 0;
        // Jump to the specific match (1-based index)
        setTimeout(() => {
          try {
            jumpToMatch(next + 1); // Convert 0-based to 1-based
            console.log(`🎯 Jumped to match ${next + 1} of ${totalMatches}`);
          } catch (error) {
            console.warn('⚠️ jumpToMatch failed, using jumpToNextMatch:', error);
            jumpToNextMatch();
          }
        }, timing.jumpDelay); // Use view mode-specific delay
        return next;
      });
    } else {
      // Single match or no specific match tracking - use default navigation
      jumpToNextMatch();
    }
  }, [totalMatches, jumpToMatch, jumpToNextMatch, getTimingStrategy]);

  const goToPreviousMatch = useCallback(() => {
    const timing = getTimingStrategy();
    
    if (totalMatches > 1) {
      setCurrentMatchIndex((prev) => {
        const previous = prev > 0 ? prev - 1 : totalMatches - 1;
        // Jump to the specific match (1-based index)
        setTimeout(() => {
          try {
            jumpToMatch(previous + 1); // Convert 0-based to 1-based
            console.log(`🎯 Jumped to match ${previous + 1} of ${totalMatches}`);
          } catch (error) {
            console.warn('⚠️ jumpToMatch failed, using jumpToPreviousMatch:', error);
            jumpToPreviousMatch();
          }
        }, timing.jumpDelay); // Use view mode-specific delay
        return previous;
      });
    } else {
      // Single match or no specific match tracking - use default navigation
      jumpToPreviousMatch();
    }
  }, [totalMatches, jumpToMatch, jumpToPreviousMatch, getTimingStrategy]);

  const clearCurrentHighlights = useCallback(() => {
    clearHighlights();
    setHighlightResult(null);
    setCurrentMatchIndex(0);
    setTotalMatches(0);
  }, [clearHighlights]); // Stable dependencies

  // Clean cache periodically
  useEffect(() => {
    const interval = setInterval(cleanCache, cacheTimeout / 2);
    return () => clearInterval(interval);
  }, [cleanCache, cacheTimeout]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    isHighlighting,
    highlightResult,
    currentMatchIndex,
    totalMatches,
    executeHighlighting,
    goToNextMatch,
    goToPreviousMatch,
    clearCurrentHighlights,
  };
} 