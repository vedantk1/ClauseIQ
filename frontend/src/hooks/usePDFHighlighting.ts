/**
 * Custom hook for PDF highlighting - always performs fresh searches
 */

import { useState, useCallback, useRef } from 'react';
import type { Clause } from '@shared/common_generated';
import { 
  createHighlightStrategies, 
  type HighlightResult,
  calculateTextSimilarity 
} from '@/utils/pdfHighlightUtils';

interface UsePDFHighlightingProps {
  highlightFunction: (terms: string | string[]) => Promise<any>; // highlight() returns Promise with results
  clearHighlights: () => void;
  jumpToMatch: (index: number) => void; // Takes 1-based index
  jumpToNextMatch: () => void;
  jumpToPreviousMatch: () => void;
  debounceMs?: number;
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
  viewMode = "continuous",
}: UsePDFHighlightingProps): UsePDFHighlightingReturn {
  const [isHighlighting, setIsHighlighting] = useState(false);
  const [highlightResult, setHighlightResult] = useState<HighlightResult | null>(null);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  
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

  // Execute highlighting - always fresh, no caching
  const executeHighlightingInternal = useCallback(async (clause: Clause) => {
    if (!clause.id || !clause.text) {
      return;
    }

    setIsHighlighting(true);
    setCurrentMatchIndex(0);
    setTotalMatches(0);

    try {
      // Always clear existing highlights before trying new search
      clearHighlights();
      
      // Small delay to ensure clear operation completes
      await new Promise(resolve => setTimeout(resolve, 100));

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
      
      // Look for a sequence of 5-8 words that appears in the PDF
      for (let i = 0; i < clauseWords.length - 4; i++) {
        const phrase = clauseWords.slice(i, i + 6).join(' ');
        const normalizedPhrase = phrase.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
        
        if (normalizedPdf.includes(normalizedPhrase)) {
          distinctivePhrase = phrase;
          console.log(`✅ Found distinctive phrase in PDF: "${distinctivePhrase}"`);
          break;
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
          
          // Set not found result
          const result: HighlightResult = {
            found: false,
            strategy: 'exact_clause_text',
            searchTerms: searchTerm,
            matchCount: 0
          };
          setHighlightResult(result);
        }
      } catch (error) {
        console.error(`❌ Error during highlighting:`, error);
        const result: HighlightResult = {
          found: false,
          strategy: 'exact_clause_text',
          searchTerms: searchTerm,
          matchCount: 0
        };
        setHighlightResult(result);
      }
    } catch (error) {
      console.error(`❌ Error in executeHighlightingInternal:`, error);
      const result: HighlightResult = {
        found: false,
        strategy: 'exact_clause_text',
        searchTerms: clause.text,
        matchCount: 0
      };
      setHighlightResult(result);
    } finally {
      setIsHighlighting(false);
    }
  }, [highlightFunction, clearHighlights, jumpToMatch, jumpToNextMatch, getTimingStrategy]);

  // Public interface for highlighting with debouncing
  const executeHighlighting = useCallback(async (clause: Clause | null) => {
    // Clear any existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!clause) {
      console.log('🧹 Clearing highlights - no clause selected');
      clearHighlights();
      setHighlightResult(null);
      setCurrentMatchIndex(0);
      setTotalMatches(0);
      lastClauseRef.current = null;
      return;
    }

    // Skip if same clause is already being processed
    if (lastClauseRef.current?.id === clause.id) {
      console.log('🔄 Skipping duplicate clause highlighting');
      return;
    }

    lastClauseRef.current = clause;

    // Debounce the highlighting operation
    debounceTimerRef.current = setTimeout(async () => {
      await executeHighlightingInternal(clause);
    }, debounceMs);
  }, [executeHighlightingInternal, clearHighlights, debounceMs]);

  // Navigation functions
  const goToNextMatch = useCallback(() => {
    if (totalMatches > 0) {
      const nextIndex = currentMatchIndex < totalMatches - 1 ? currentMatchIndex + 1 : 0;
      setCurrentMatchIndex(nextIndex);
      jumpToMatch(nextIndex + 1); // Convert to 1-based index
    }
  }, [currentMatchIndex, totalMatches, jumpToMatch]);

  const goToPreviousMatch = useCallback(() => {
    if (totalMatches > 0) {
      const prevIndex = currentMatchIndex > 0 ? currentMatchIndex - 1 : totalMatches - 1;
      setCurrentMatchIndex(prevIndex);
      jumpToMatch(prevIndex + 1); // Convert to 1-based index
    }
  }, [currentMatchIndex, totalMatches, jumpToMatch]);

  const clearCurrentHighlights = useCallback(() => {
    clearHighlights();
    setHighlightResult(null);
    setCurrentMatchIndex(0);
    setTotalMatches(0);
    lastClauseRef.current = null;
  }, [clearHighlights]);

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