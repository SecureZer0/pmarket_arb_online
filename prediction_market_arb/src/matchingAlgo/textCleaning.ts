/**
 * Enhanced text cleaning functions for better matching
 */

/**
 * Clean and normalize text for comparison
 */
export function cleanText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')           // Remove punctuation
    .replace(/\s+/g, ' ')               // Normalize whitespace
    .trim();
}

/**
 * Normalize dates (2025, 25, twenty-five → same)
 */
export function normalizeDates(text: string): string {
  return text
    .replace(/\b2025\b/g, '2025')
    .replace(/\b25\b/g, '2025')
    .replace(/\btwenty.?five\b/g, '2025')
    .replace(/\btwentyfive\b/g, '2025');
}

/**
 * Normalize numbers (1st, first, 1 → same)
 */
export function normalizeNumbers(text: string): string {
  return text
    .replace(/\b1st\b/g, '1')
    .replace(/\bfirst\b/g, '1')
    .replace(/\b2nd\b/g, '2')
    .replace(/\bsecond\b/g, '2')
    .replace(/\b3rd\b/g, '3')
    .replace(/\bthird\b/g, '3');
}

/**
 * Expand common abbreviations
 */
export function expandAbbreviations(text: string): string {
  return text
    .replace(/\bus\b/g, 'united states')
    .replace(/\buk\b/g, 'united kingdom')
    .replace(/\bceo\b/g, 'chief executive officer')
    .replace(/\bai\b/g, 'artificial intelligence')
    .replace(/\bnyc\b/g, 'new york city');
}

/**
 * Comprehensive text cleaning pipeline
 */
export function cleanTextForMatching(text: string): string {
  return cleanText(
    normalizeDates(
      normalizeNumbers(
        expandAbbreviations(text)
      )
    )
  );
}

