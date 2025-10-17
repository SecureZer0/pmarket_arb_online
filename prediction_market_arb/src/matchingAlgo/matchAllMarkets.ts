import { promises as fs } from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';
import { 
  calculateTrigramSimilarity, 
  calculateJaccardSimilarity, 
  calculateVectorSimilarity,
  calculateHybridScore,
  determineConfidence 
} from './matchingAlgorithms.js';
import { saveMatchesToDb } from './saveMatches.js';

// Types for our matching data
export interface MatchingCandidate {
  kalshiMarket: any;
  polymarketMarket: any;
  trigramScore: number;
  jaccardScore: number;
  vectorScore: number;
  hybridScore: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface MatchingResult {
  candidates: MatchingCandidate[];
  totalCandidates: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
}

// Configuration for matching thresholds
const MATCHING_CONFIG = {
  trigramThreshold: 0.3,
  jaccardThreshold: 0.2,
  vectorThreshold: 0.4,
  hybridThreshold: 0.5,
};

/**
 * Main function to run the matching algorithm on full in-memory arrays
 */
export async function matchAllMarkets(kalshiMarkets: any[] = [], polymarketMarkets: any[] = []): Promise<MatchingResult> {
  logger.info('🚀 Starting full market matching algorithm...');
  
  try {
    if (!Array.isArray(kalshiMarkets) || !Array.isArray(polymarketMarkets)) {
      throw new Error('kalshiMarkets and polymarketMarkets must be arrays');
    }
    
    logger.info(`📊 Loaded ${kalshiMarkets.length} Kalshi markets`);
    logger.info(`📊 Loaded ${polymarketMarkets.length} Polymarket markets`);
    
    // Step 1: Run hybrid matching for the full arrays
    const allCandidates = await findMatches(kalshiMarkets, polymarketMarkets);
    logger.info(`🔍 Found ${allCandidates.length} total candidates`);
    
    // Step 2: Score and rank all candidates
    const scoredCandidates = await scoreCandidates(allCandidates);
    
    // Step 3: Filter and categorize results
    const filteredResults = filterResults(scoredCandidates);
    
    // Step 4: Generate summary
    const result = generateSummary(filteredResults);
    
    logger.info(`✅ Matching complete! Found ${result.totalCandidates} candidates`);
    logger.info(`🎯 High confidence: ${result.highConfidence}`);
    logger.info(`🎯 Medium confidence: ${result.mediumConfidence}`);
    logger.info(`🎯 Low confidence: ${result.lowConfidence}`);
    
    // Persist matches
    await saveMatchesToDb(result);
    return result;
    
  } catch (error) {
    logger.error('❌ Error in matching algorithm:', error);
    throw error;
  }
}

// No internal fetching helpers: data must be provided by caller.

/**
 * Find potential matches between Kalshi and Polymarket data using efficient pre-filtering
 */
async function findMatches(kalshiMarkets: any[], polymarketMarkets: any[]): Promise<any[]> {
  logger.info('🔍 Finding potential matches with efficient pre-filtering...');
  
  const candidates: any[] = [];

  // We already receive market-level arrays from processors
  const allKalshiMarkets: any[] = kalshiMarkets;
  logger.info(`📊 Received ${allKalshiMarkets.length} Kalshi markets for matching`);
  
  // Create keyword index for faster matching
  const keywordIndex = createKeywordIndex(allKalshiMarkets, polymarketMarkets);
  
  // Use the index to find potential matches
  for (const kalshiMarket of allKalshiMarkets) {
    const potentialMatches = findPotentialMatches(kalshiMarket, polymarketMarkets, keywordIndex);
    
    for (const polymarketMarket of potentialMatches) {
      // Extract text fields for comparison
      const kalshiTexts = extractKalshiMarketTexts(kalshiMarket);
      const polymarketTexts = extractPolymarketTexts(polymarketMarket);
      
      // Quick similarity check before detailed scoring
      if (quickSimilarityCheck(kalshiTexts, polymarketTexts)) {
        candidates.push({
          kalshiMarket,
          polymarketMarket,
          kalshiTexts,
          polymarketTexts
        });
      }
    }
  }
  
  logger.info(`🔍 Found ${candidates.length} potential candidates after pre-filtering`);
  return candidates;
}

/**
 * Create a keyword index for faster matching
 */
function createKeywordIndex(kalshiMarkets: any[], polymarketMarkets: any[]): Map<string, Set<number>> {
  const index = new Map<string, Set<number>>();
  
  // Index Polymarket markets by keywords
  polymarketMarkets.forEach((market, idx) => {
    const question = market.platform_data?.question || '';
    const title = market.title || '';
    const keywords = extractKeywords(`${question} ${title}`);
    keywords.forEach(keyword => {
      if (!index.has(keyword)) {
        index.set(keyword, new Set());
      }
      index.get(keyword)!.add(idx);
    });
  });
  
  return index;
}

/**
 * Extract meaningful keywords from text
 */
function extractKeywords(text: string): string[] {
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3) // Only words longer than 3 chars
    .filter(word => !['will', 'the', 'and', 'for', 'with', 'that', 'this', 'have', 'been', 'from'].includes(word));
  
  return [...new Set(words)]; // Remove duplicates
}

/**
 * Find potential matches using keyword index
 */
function findPotentialMatches(kalshiMarket: any, polymarketMarkets: any[], keywordIndex: Map<string, Set<number>>): any[] {
  const kPd = kalshiMarket.platform_data || {};
  const kalshiText = `${kalshiMarket.title || ''} ${kPd.event_title || ''} ${kPd.yes_subtitle || ''} ${kPd.no_subtitle || ''} ${kPd.market_subtitle || ''}`.toLowerCase();
  const keywords = extractKeywords(kalshiText);
  
  const candidateIndices = new Set<number>();
  
  // Find markets that share keywords
  keywords.forEach(keyword => {
    if (keywordIndex.has(keyword)) {
      keywordIndex.get(keyword)!.forEach(idx => candidateIndices.add(idx));
    }
  });
  
  // Return only markets with at least 2 keyword matches
  return Array.from(candidateIndices)
    .filter(idx => {
      const p = polymarketMarkets[idx];
      const polymarketText = `${p.platform_data?.question || ''} ${p.title || ''}`.toLowerCase();
      const sharedKeywords = keywords.filter(k => polymarketText.includes(k));
      return sharedKeywords.length >= 2;
    })
    .map(idx => polymarketMarkets[idx]);
}

/**
 * Quick similarity check before detailed scoring
 */
function quickSimilarityCheck(kalshiTexts: string[], polymarketTexts: string[]): boolean {
  const kalshiWords = new Set(kalshiTexts.flatMap(text => text.split(/\s+/)));
  const polymarketWords = new Set(polymarketTexts.flatMap(text => text.split(/\s+/)));
  
  const intersection = new Set([...kalshiWords].filter(x => polymarketWords.has(x)));
  return intersection.size >= 3; // At least 3 words in common
}

/**
 * Extract all relevant text fields from Kalshi market (individual market level)
 */
function extractKalshiMarketTexts(market: any): string[] {
  const texts: string[] = [];
  
  const pd = market.platform_data || {};
  if (market.title) texts.push(market.title.toLowerCase());
  if (pd.yes_subtitle) texts.push(String(pd.yes_subtitle).toLowerCase());
  if (pd.no_subtitle) texts.push(String(pd.no_subtitle).toLowerCase());
  if (pd.market_subtitle) texts.push(String(pd.market_subtitle).toLowerCase());
  if (pd.event_title) texts.push(String(pd.event_title).toLowerCase());
  if (pd.event_subtitle) texts.push(String(pd.event_subtitle).toLowerCase());
  
  return texts.filter(text => text.length > 0);
}

/**
 * Extract all relevant text fields from Polymarket market
 */
function extractPolymarketTexts(market: any): string[] {
  const texts: string[] = [];
  
  const pd = market.platform_data || {};
  if (pd.question) texts.push(String(pd.question).toLowerCase());
  if (market.title) texts.push(market.title.toLowerCase());
  
  return texts.filter(text => text.length > 0);
}

/**
 * Score candidates using hybrid approach
 */
async function scoreCandidates(candidates: any[]): Promise<MatchingCandidate[]> {
  logger.info('📊 Scoring candidates with hybrid algorithm...');
  
  const scoredCandidates: MatchingCandidate[] = [];
  
      for (const candidate of candidates) {
      const trigramScore = calculateTrigramSimilarity(candidate.kalshiTexts, candidate.polymarketTexts);
      const jaccardScore = calculateJaccardSimilarity(candidate.kalshiTexts, candidate.polymarketTexts);
      const vectorScore = await calculateVectorSimilarity(candidate.kalshiTexts, candidate.polymarketTexts);
      
      const hybridScore = calculateHybridScore(trigramScore, jaccardScore, vectorScore);
      
      scoredCandidates.push({
        kalshiMarket: candidate.kalshiMarket,
        polymarketMarket: candidate.polymarketMarket,
        trigramScore,
        jaccardScore,
        vectorScore,
        hybridScore,
        confidence: determineConfidence(hybridScore)
      });
    }
  
  // Sort by hybrid score descending
  scoredCandidates.sort((a, b) => b.hybridScore - a.hybridScore);
  
  return scoredCandidates;
}

/**
 * Filter results based on thresholds
 */
function filterResults(candidates: MatchingCandidate[]): MatchingCandidate[] {
  return candidates.filter(candidate => 
    candidate.hybridScore >= MATCHING_CONFIG.hybridThreshold
  );
}

/**
 * Generate summary statistics
 */
function generateSummary(candidates: MatchingCandidate[]): MatchingResult {
  const highConfidence = candidates.filter(c => c.confidence === 'high').length;
  const mediumConfidence = candidates.filter(c => c.confidence === 'medium').length;
  const lowConfidence = candidates.filter(c => c.confidence === 'low').length;
  
  return {
    candidates,
    totalCandidates: candidates.length,
    highConfidence,
    mediumConfidence,
    lowConfidence
  };
}

/**
 * Export top matches for AI review
 */
export async function exportTopMatches(result: MatchingResult, limit: number = 0): Promise<void> {
  const topMatches = limit > 0 ? result.candidates.slice(0, limit) : result.candidates;
  
  const exportData = {
    exportTimestamp: new Date().toISOString(),
    totalExported: topMatches.length,
    algorithm: 'Hybrid (Trigram + Jaccard + Vector)',
    thresholds: MATCHING_CONFIG,
          matches: topMatches.map(match => ({
        hybridScore: match.hybridScore,
        confidence: match.confidence,
        kalshi: {
          title: match.kalshiMarket.title,
          eventTitle: match.kalshiMarket.platform_data?.event_title,
          eventSubTitle: match.kalshiMarket.platform_data?.event_subtitle,
          yesSubTitle: match.kalshiMarket.platform_data?.yes_subtitle,
          noSubTitle: match.kalshiMarket.platform_data?.no_subtitle
        },
        polymarket: {
          question: match.polymarketMarket.platform_data?.question,
          title: match.polymarketMarket.title
        }
      }))
  };
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const exportDir = path.join(process.cwd(), 'data-exports', 'matching', timestamp);
  await fs.mkdir(exportDir, { recursive: true });
  
  const filePath = path.join(exportDir, 'top-matches.json');
  await fs.writeFile(filePath, JSON.stringify(exportData, null, 2), 'utf8');
  
  logger.info(`💾 Exported top ${topMatches.length} matches to ${filePath}`);
}

// No direct CLI execution here; the caller must provide data explicitly.
