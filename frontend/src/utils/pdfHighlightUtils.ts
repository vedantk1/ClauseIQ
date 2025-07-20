/**
 * PDF Highlighting Utilities
 * 
 * Smart text matching and highlighting utilities for legal document clauses
 */

import type { Clause } from "@clauseiq/shared-types";

export interface HighlightStrategy {
  name: string;
  execute: (text: string) => string | string[];
  priority: number;
}

export interface HighlightResult {
  found: boolean;
  strategy: string;
  searchTerms: string | string[];
  matchCount?: number;
}

/**
 * Normalize text for better matching by removing extra whitespace,
 * line breaks, and standardizing punctuation
 */
export function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
    .replace(/\n/g, ' ') // Replace line breaks with spaces
    .replace(/[""]/g, '"') // Standardize quotes
    .replace(/['']/g, "'") // Standardize apostrophes
    .replace(/\u00A0/g, ' ') // Replace non-breaking spaces
    .trim();
}

/**
 * Extract key phrases from clause text for fallback matching
 */
export function extractKeyPhrases(text: string, maxPhrases: number = 3): string[] {
  const normalized = normalizeText(text);
  const sentences = normalized.split(/[.!?]+/).filter(s => s.trim().length > 10);
  
  if (sentences.length === 0) {
    // Fallback to word chunks if no sentences
    const words = normalized.split(/\s+/);
    const chunkSize = Math.min(8, Math.max(3, Math.floor(words.length / 3)));
    const phrases = [];
    
    for (let i = 0; i < words.length; i += chunkSize) {
      const phrase = words.slice(i, i + chunkSize).join(' ');
      if (phrase.length > 10) {
        phrases.push(phrase);
      }
    }
    
    return phrases.slice(0, maxPhrases);
  }
  
  // Use first and last sentences, plus middle if available
  const keyPhrases = [];
  
  if (sentences.length >= 1) {
    keyPhrases.push(sentences[0].trim());
  }
  
  if (sentences.length >= 3) {
    const middleIndex = Math.floor(sentences.length / 2);
    keyPhrases.push(sentences[middleIndex].trim());
  }
  
  if (sentences.length >= 2) {
    keyPhrases.push(sentences[sentences.length - 1].trim());
  }
  
  return keyPhrases
    .filter(phrase => phrase.length > 10)
    .slice(0, maxPhrases);
}

/**
 * Extract significant words from text (excluding common legal stop words)
 */
export function extractSignificantWords(text: string, maxWords: number = 5): string[] {
  const legalStopWords = new Set([
    'the', 'and', 'or', 'of', 'to', 'in', 'for', 'with', 'by', 'from',
    'shall', 'will', 'may', 'must', 'should', 'would', 'could', 'can',
    'party', 'parties', 'agreement', 'contract', 'clause', 'section',
    'hereby', 'herein', 'thereof', 'hereof', 'hereunder', 'whereas'
  ]);
  
  const words = normalizeText(text)
    .toLowerCase()
    .split(/\s+/)
    .filter(word => 
      word.length > 3 && 
      !legalStopWords.has(word) &&
      /^[a-zA-Z]+$/.test(word) // Only alphabetic words
    );
  
  // Count word frequency
  const wordCount = new Map<string, number>();
  words.forEach(word => {
    wordCount.set(word, (wordCount.get(word) || 0) + 1);
  });
  
  // Sort by frequency and return top words
  return Array.from(wordCount.entries())
    .sort(([,a], [,b]) => b - a)
    .slice(0, maxWords)
    .map(([word]) => word);
}

/**
 * Create highlighting strategies for a clause
 */
export function createHighlightStrategies(clause: Clause): HighlightStrategy[] {
  const strategies: HighlightStrategy[] = [];
  
  if (!clause.text) {
    return strategies;
  }
  
  const normalizedText = normalizeText(clause.text);
  
  // Strategy 1: Exact text match (highest priority) - use shorter portions
  strategies.push({
    name: 'exact_text',
    priority: 1,
    execute: () => {
      // For very long text, use the first meaningful sentence or phrase
      const sentences = normalizedText.split(/[.!?]+/).filter(s => s.trim().length > 10);
      if (sentences.length > 0) {
        // Use the first sentence, but limit to reasonable length
        const firstSentence = sentences[0].trim();
        return firstSentence.length > 100 ? firstSentence.substring(0, 100) : firstSentence;
      }
      // Fallback to first 100 characters
      return normalizedText.length > 100 ? normalizedText.substring(0, 100) : normalizedText;
    }
  });
  
  // Strategy 2: Distinctive phrases (numbers, dates, specific terms)
  strategies.push({
    name: 'distinctive_phrases',
    priority: 2,
    execute: () => {
      const phrases = [];
      
      // Look for dates (various formats)
      const dateMatches = normalizedText.match(/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2,4}/gi);
      if (dateMatches) {
        phrases.push(...dateMatches.slice(0, 2));
      }
      
      // Look for numbers with context
      const numberMatches = normalizedText.match(/\d+(?:\.\d+)?\s*(?:months?|years?|days?|weeks?|percent|%|dollars?|\$)/gi);
      if (numberMatches) {
        phrases.push(...numberMatches.slice(0, 2));
      }
      
      // Look for specific legal/business terms with context
      const termMatches = normalizedText.match(/(?:shall|will|must|may)\s+[^.]{10,50}/gi);
      if (termMatches) {
        phrases.push(...termMatches.slice(0, 2));
      }
      
      return phrases.length > 0 ? phrases : [normalizedText.substring(0, 50)];
    }
  });

  // Strategy 3: Clause heading if available
  if (clause.heading && clause.heading.trim().length > 5) {
    strategies.push({
      name: 'heading_match',
      priority: 3,
      execute: () => normalizeText(clause.heading!)
    });
  }
  
  // Strategy 4: Key phrases (first and last sentences)
  strategies.push({
    name: 'key_phrases',
    priority: 4,
    execute: () => extractKeyPhrases(normalizedText, 2)
  });
  
  // Strategy 5: First and last word chunks
  strategies.push({
    name: 'word_chunks',
    priority: 5,
    execute: () => {
      const words = normalizedText.split(/\s+/).filter(w => w.length > 2);
      if (words.length < 10) return words.slice(0, 5);
      
      const chunks = [];
      chunks.push(words.slice(0, 5).join(' '));
      chunks.push(words.slice(-5).join(' '));
      return chunks;
    }
  });
  
  // Strategy 6: Significant words (fallback)
  strategies.push({
    name: 'significant_words',
    priority: 6,
    execute: () => extractSignificantWords(normalizedText, 3)
  });

  // Strategy 7: Short phrases (last resort)
  strategies.push({
    name: 'short_phrases',
    priority: 7,
    execute: () => {
      const words = normalizedText.split(/\s+/).filter(w => w.length > 3);
      const phrases = [];
      
      // Try 2-word phrases
      for (let i = 0; i < Math.min(words.length - 1, 3); i++) {
        phrases.push(`${words[i]} ${words[i + 1]}`);
      }
      
      // If no phrases, try individual significant words
      if (phrases.length === 0) {
        return words.slice(0, 3);
      }
      
      return phrases;
    }
  });

  // Strategy 8: Single words (absolute fallback)
  strategies.push({
    name: 'single_words',
    priority: 8,
    execute: () => {
      const words = normalizedText.split(/\s+/)
        .filter(w => w.length > 4)
        .slice(0, 3);
      return words.length > 0 ? words : ['employment', 'agreement', 'contract'];
    }
  });
  
  return strategies.sort((a, b) => a.priority - b.priority);
}

/**
 * Get risk-based highlight color
 */
export function getRiskHighlightColor(riskLevel?: string): string {
  switch (riskLevel) {
    case 'high':
      return '#fee2e2'; // Light red background
    case 'medium':
      return '#fef3c7'; // Light yellow background
    case 'low':
      return '#dcfce7'; // Light green background
    default:
      return '#e0e7ff'; // Light blue background
  }
}

/**
 * Get risk-based border color
 */
export function getRiskBorderColor(riskLevel?: string): string {
  switch (riskLevel) {
    case 'high':
      return '#dc2626'; // Red border
    case 'medium':
      return '#d97706'; // Orange border
    case 'low':
      return '#16a34a'; // Green border
    default:
      return '#3b82f6'; // Blue border
  }
}

/**
 * Escape special regex characters for safe text searching
 */
export function escapeRegexChars(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Calculate text similarity score (0-1) using simple word overlap
 */
export function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = new Set(normalizeText(text1).toLowerCase().split(/\s+/));
  const words2 = new Set(normalizeText(text2).toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(word => words2.has(word)));
  const union = new Set([...words1, ...words2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
} 