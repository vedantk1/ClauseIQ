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

      // Clear existing highlights
      clearHighlights();

      // Create and execute highlighting strategies
      const strategies = createHighlightStrategies(clause);
      let foundMatch = false;

      for (const strategy of strategies) {
        try {
          console.log(`Trying highlighting strategy: ${strategy.name}`);
          const searchTerms = strategy.execute(clause.text);
          console.log(`Search terms for ${strategy.name}:`, searchTerms);

          // Validate search terms
          if (!searchTerms || 
              (typeof searchTerms === 'string' && searchTerms.trim().length === 0) ||
              (Array.isArray(searchTerms) && searchTerms.length === 0)) {
            console.warn(`Invalid search terms for strategy ${strategy.name}`);
            continue;
          }

          // Execute the highlight and get match results
          try {
            console.log(`🔍 Executing highlight function for strategy: ${strategy.name}`);
            
            // Add timeout to prevent hanging
            const highlightPromise = highlightFunction(searchTerms);
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Highlight timeout')), 10000)
            );
            
            const matchResults = await Promise.race([highlightPromise, timeoutPromise]);
            console.log(`✅ Highlight function completed for strategy: ${strategy.name}`, matchResults);
            
            // Get actual match count from results if available
            let actualMatchCount = 1;
            if (matchResults && Array.isArray(matchResults)) {
              actualMatchCount = matchResults.length;
              console.log(`📊 Found ${actualMatchCount} matches from search results`);
            } else if (matchResults && typeof matchResults.length === 'number') {
              actualMatchCount = matchResults.length;
              console.log(`📊 Found ${actualMatchCount} matches from search results`);
            }

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
              const finalMatchCount = Math.max(actualMatchCount, domMatchCount);
              
              const result: HighlightResult = {
                found: true,
                strategy: strategy.name,
                searchTerms,
                matchCount: finalMatchCount
              };

              setHighlightResult(result);
              setTotalMatches(finalMatchCount);
              foundMatch = true;

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

              console.log(`✅ Successfully highlighted using strategy: ${strategy.name}`);
              break;
            } else {
              console.warn(`⚠️ No highlights in DOM despite successful search - trying with longer delay`);
              // Try longer delay for virtual list rendering
              await new Promise(resolve => setTimeout(resolve, timing.retryDelay));
              const retryHighlights = document.querySelectorAll('.rpv-search__highlight');
              console.log(`🔍 Retry DOM check: found ${retryHighlights.length} highlight elements`);
              
              if (retryHighlights.length > 0) {
                // Success on retry!
                const finalMatchCount = Math.max(actualMatchCount, retryHighlights.length);
                
                const result: HighlightResult = {
                  found: true,
                  strategy: strategy.name,
                  searchTerms,
                  matchCount: finalMatchCount
                };

                setHighlightResult(result);
                setTotalMatches(finalMatchCount);
                foundMatch = true;
                cacheResult(clause.id, result);

                // Jump to first match
                setTimeout(() => {
                  try {
                    jumpToMatch(1);
                    console.log(`✅ Successfully jumped to first match after retry`);
                  } catch (jumpError) {
                    console.warn(`⚠️ Jump to match failed after retry:`, jumpError);
                    jumpToNextMatch();
                  }
                }, timing.jumpDelay);

                console.log(`✅ Successfully highlighted using strategy: ${strategy.name} (after retry)`);
                break;
              } else {
                console.warn(`❌ Still no highlights in DOM - continuing to next strategy`);
                // Continue to next strategy rather than failing completely
                continue;
              }
            }
          } catch (highlightError) {
            console.error(`❌ Highlight function failed for strategy ${strategy.name}:`, highlightError);
            // Don't throw - try next strategy
            continue;
          }
        } catch (error) {
          console.warn(`Strategy ${strategy.name} failed:`, error);
          continue;
        }
      }

      // If no strategy worked, try PDF text-based matching as a last resort
      if (!foundMatch) {
        console.log('🔍 Trying PDF text-based matching...');
        try {
          // Extract actual PDF text
          const textElements = document.querySelectorAll('.rpv-core__text-layer span');
          const pdfText = Array.from(textElements).map(el => el.textContent || '').join(' ');
          
          if (pdfText.length > 0) {
            // Try to find the best matching phrases from the PDF text
            const clauseWords = clause.text.toLowerCase().split(/\s+/).filter(w => w.length > 3);
            const pdfWords = pdfText.toLowerCase().split(/\s+/);
            
            // Find sequences of words that match
            const matchingPhrases = [];
            for (let i = 0; i < clauseWords.length - 1; i++) {
              const phrase = `${clauseWords[i]} ${clauseWords[i + 1]}`;
              if (pdfText.toLowerCase().includes(phrase)) {
                matchingPhrases.push(phrase);
              }
            }
            
            // Try individual words if no phrases match
            if (matchingPhrases.length === 0) {
              for (const word of clauseWords.slice(0, 3)) {
                if (pdfText.toLowerCase().includes(word)) {
                  matchingPhrases.push(word);
                }
              }
            }
            
            if (matchingPhrases.length > 0) {
              console.log('🔍 Found matching phrases in PDF:', matchingPhrases);
              
              // Use the same Promise-based approach as strategies
              const matchResults = await highlightFunction(matchingPhrases);
              console.log('📊 PDF text matching results:', matchResults);
              
              // Wait for virtual list rendering based on view mode
              const timing = getTimingStrategy();
              await new Promise(resolve => setTimeout(resolve, timing.initialDelay));
              
              // Verify matches in DOM
              const highlightElements = document.querySelectorAll('.rpv-search__highlight');
              const domMatchCount = highlightElements.length;
              console.log(`🔍 PDF text matching DOM verification: found ${domMatchCount} highlight elements`);
              
              if (domMatchCount > 0) {
                const result: HighlightResult = {
                  found: true,
                  strategy: 'pdf_text_matching',
                  searchTerms: matchingPhrases,
                  matchCount: domMatchCount
                };
                
                setHighlightResult(result);
                setTotalMatches(domMatchCount);
                foundMatch = true;
                cacheResult(clause.id, result);
                
                // Jump to first match with timing
                setTimeout(() => {
                  try {
                    jumpToMatch(1);
                    console.log('✅ Successfully jumped to first match via PDF text matching');
                  } catch (jumpError) {
                    console.warn('⚠️ Jump to match failed, using fallback:', jumpError);
                    jumpToNextMatch();
                  }
                }, timing.jumpDelay);
                
                console.log('✅ Successfully highlighted using PDF text matching');
              } else {
                console.warn('❌ PDF text matching failed - no highlights in DOM');
              }
            }
          }
        } catch (error) {
          console.warn('PDF text-based matching failed:', error);
        }
      }

      // If still no match found
      if (!foundMatch) {
        const notFoundResult: HighlightResult = {
          found: false,
          strategy: 'none',
          searchTerms: clause.text,
          matchCount: 0
        };

        setHighlightResult(notFoundResult);
        console.warn('❌ No highlighting strategy succeeded for clause');
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
    getTimingStrategy, // Added getTimingStrategy to dependencies
    viewMode // Added viewMode to dependencies
  ]); // Removed dependencies that change on every render

  // Debounced execute highlighting
  const executeHighlighting = useCallback(async (clause: Clause | null) => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // If no clause, clear highlights
    if (!clause) {
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
          console.log('Skipping re-highlight for similar clause');
          return;
        }
      }
    }

    lastClauseRef.current = clause;

    // Debounce the execution
    debounceTimerRef.current = setTimeout(() => {
      executeHighlightingInternal(clause);
    }, debounceMs);
  }, [executeHighlightingInternal, clearHighlights, debounceMs]); // Stable dependencies

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