import { pool } from '../predictionMarket_db.js';
import { logger } from '../utils/logger.js';
import { 
  calculateTrigramSimilarity, 
  calculateJaccardSimilarity, 
  calculateVectorSimilarity,
  calculateHybridScore,
  determineConfidence 
} from './matchingAlgorithms.js';

// Types for close condition matching
export interface CloseConditionMatch {
  matchId: number;
  marketIdA: number;
  marketIdB: number;
  kalshiCloseCondition: string;
  polymarketCloseCondition: string;
  trigramScore: number;
  jaccardScore: number;
  vectorScore: number;
  hybridScore: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface CloseConditionMatchingResult {
  processedMatches: number;
  updatedMatches: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
}

// Configuration for close condition matching thresholds
const CLOSE_CONDITION_CONFIG = {
  trigramThreshold: 0.2,
  jaccardThreshold: 0.15,
  vectorThreshold: 0.3,
  hybridThreshold: 0.4,
};

/**
 * Main function to run close condition matching on existing market matches
 * Only processes matches that don't already have a close_condition_score
 */
export async function matchCloseConditions(): Promise<CloseConditionMatchingResult> {
  logger.info('🔍 Starting close condition matching algorithm...');
  
  try {
    // Step 1: Get existing matches without close_condition_score
    const matchesToProcess = await getMatchesWithoutCloseConditionScore();
    
    if (matchesToProcess.length === 0) {
      logger.info('✅ No matches found that need close condition scoring');
      return {
        processedMatches: 0,
        updatedMatches: 0,
        highConfidence: 0,
        mediumConfidence: 0,
        lowConfidence: 0
      };
    }
    
    logger.info(`📊 Found ${matchesToProcess.length} matches to process for close condition scoring`);
    
    // Step 2: Extract close condition texts and score them
    const closeConditionMatches = await processCloseConditions(matchesToProcess);
    
    // Step 3: Update database with close condition scores
    const updateResult = await updateCloseConditionScores(closeConditionMatches);
    
    // Step 4: Generate summary
    const result = generateCloseConditionSummary(closeConditionMatches, updateResult);
    
    logger.info(`✅ Close condition matching complete!`);
    logger.info(`📊 Processed: ${result.processedMatches} matches`);
    logger.info(`💾 Updated: ${result.updatedMatches} matches`);
    logger.info(`🎯 High confidence: ${result.highConfidence}`);
    logger.info(`🎯 Medium confidence: ${result.mediumConfidence}`);
    logger.info(`🎯 Low confidence: ${result.lowConfidence}`);
    
    return result;
    
  } catch (error) {
    logger.error('❌ Error in close condition matching algorithm:', error);
    throw error;
  }
}

/**
 * Get existing market matches that don't have close_condition_score
 */
async function getMatchesWithoutCloseConditionScore(): Promise<any[]> {
  const query = `
    SELECT 
      mm.id,
      mm.market_id_a,
      mm.market_id_b,
      mm.score as original_score,
      ma.title as market_a_title,
      mb.title as market_b_title,
      ma.platform_data as market_a_platform_data,
      mb.platform_data as market_b_platform_data,
      ma.close_condition as market_a_close_condition,
      mb.close_condition as market_b_close_condition,
      pa.code as platform_a_code,
      pb.code as platform_b_code
    FROM market_matches mm
    JOIN markets ma ON mm.market_id_a = ma.id
    JOIN markets mb ON mm.market_id_b = mb.id
    JOIN platforms pa ON ma.platform_id = pa.id
    JOIN platforms pb ON mb.platform_id = pb.id
    WHERE mm.close_condition_score IS NULL
      AND ma.is_open = true
      AND mb.is_open = true
    ORDER BY mm.id
  `;
  
  const result = await pool.query(query);
  return result.rows;
}

/**
 * Process close conditions for all matches
 */
async function processCloseConditions(matches: any[]): Promise<CloseConditionMatch[]> {
  logger.info('📊 Processing close conditions with hybrid algorithm...');
  
  const closeConditionMatches: CloseConditionMatch[] = [];
  
  for (const match of matches) {
    try {
      // Extract close condition texts
      const kalshiCloseCondition = extractKalshiCloseCondition(match);
      const polymarketCloseCondition = extractPolymarketCloseCondition(match);
      
      // Skip if either close condition is missing or empty
      if (!kalshiCloseCondition || !polymarketCloseCondition) {
        logger.debug(`Skipping match ${match.id}: missing close conditions`);
        continue;
      }
      
      // Convert to arrays for compatibility with existing algorithms
      const kalshiTexts = [kalshiCloseCondition];
      const polymarketTexts = [polymarketCloseCondition];
      
      // Calculate similarity scores
      const trigramScore = calculateTrigramSimilarity(kalshiTexts, polymarketTexts);
      const jaccardScore = calculateJaccardSimilarity(kalshiTexts, polymarketTexts);
      const vectorScore = await calculateVectorSimilarity(kalshiTexts, polymarketTexts);
      
      const hybridScore = calculateHybridScore(trigramScore, jaccardScore, vectorScore);
      
      closeConditionMatches.push({
        matchId: match.id,
        marketIdA: match.market_id_a,
        marketIdB: match.market_id_b,
        kalshiCloseCondition,
        polymarketCloseCondition,
        trigramScore,
        jaccardScore,
        vectorScore,
        hybridScore,
        confidence: determineConfidence(hybridScore)
      });
      
    } catch (error) {
      logger.error(`Error processing close condition for match ${match.id}:`, error);
      continue;
    }
  }
  
  // Sort by hybrid score descending
  closeConditionMatches.sort((a, b) => b.hybridScore - a.hybridScore);
  
  return closeConditionMatches;
}

/**
 * Extract Kalshi close condition text
 */
function extractKalshiCloseCondition(match: any): string | null {
  // Determine which market is Kalshi (platform_id = 2)
  const isMarketAKalshi = match.platform_a_code === 'kalshi';
  const kalshiMarket = isMarketAKalshi ? match : match;
  const kalshiPlatformData = isMarketAKalshi ? match.market_a_platform_data : match.market_b_platform_data;
  const kalshiCloseCondition = isMarketAKalshi ? match.market_a_close_condition : match.market_b_close_condition;
  
  // Try to get close condition from multiple sources
  let closeConditionText = '';
  
  // First, try the close_condition field
  if (kalshiCloseCondition) {
    closeConditionText = kalshiCloseCondition;
  }
  
  // If not available, try platform_data fields
  if (!closeConditionText && kalshiPlatformData) {
    if (kalshiPlatformData.rules_primary) {
      closeConditionText = kalshiPlatformData.rules_primary;
    } else if (kalshiPlatformData.rules_secondary) {
      closeConditionText = kalshiPlatformData.rules_secondary;
    }
  }
  
  return closeConditionText.trim() || null;
}

/**
 * Extract Polymarket close condition text
 */
function extractPolymarketCloseCondition(match: any): string | null {
  // Determine which market is Polymarket (platform_id = 1)
  const isMarketAPolymarket = match.platform_a_code === 'polymarket';
  const polymarketMarket = isMarketAPolymarket ? match : match;
  const polymarketPlatformData = isMarketAPolymarket ? match.market_a_platform_data : match.market_b_platform_data;
  const polymarketCloseCondition = isMarketAPolymarket ? match.market_a_close_condition : match.market_b_close_condition;
  
  // Try to get close condition from multiple sources
  let closeConditionText = '';
  
  // First, try the close_condition field
  if (polymarketCloseCondition) {
    closeConditionText = polymarketCloseCondition;
  }
  
  // If not available, try platform_data fields
  if (!closeConditionText && polymarketPlatformData) {
    if (polymarketPlatformData.description) {
      closeConditionText = polymarketPlatformData.description;
    } else if (polymarketPlatformData.question) {
      closeConditionText = polymarketPlatformData.question;
    }
  }
  
  return closeConditionText.trim() || null;
}

/**
 * Update database with close condition scores
 */
async function updateCloseConditionScores(closeConditionMatches: CloseConditionMatch[]): Promise<number> {
  logger.info('💾 Updating close condition scores in database...');
  
  if (closeConditionMatches.length === 0) {
    return 0;
  }
  
  // Prepare batch update data
  const matchIds: number[] = [];
  const scores: number[] = [];
  
  for (const match of closeConditionMatches) {
    matchIds.push(match.matchId);
    scores.push(match.hybridScore);
  }
  
  // Batch update - ONLY update the score, don't touch AI status
  const query = `
    UPDATE market_matches 
    SET 
      close_condition_score = data.score
    FROM unnest($1::int[], $2::numeric[]) AS data(id, score)
    WHERE market_matches.id = data.id
    RETURNING market_matches.id
  `;
  
  const result = await pool.query(query, [matchIds, scores]);
  
  logger.info(`✅ Updated ${result.rows.length} close condition scores`);
  return result.rows.length;
}

/**
 * Generate summary statistics for close condition matching
 */
function generateCloseConditionSummary(
  closeConditionMatches: CloseConditionMatch[], 
  updatedCount: number
): CloseConditionMatchingResult {
  const highConfidence = closeConditionMatches.filter(m => m.confidence === 'high').length;
  const mediumConfidence = closeConditionMatches.filter(m => m.confidence === 'medium').length;
  const lowConfidence = closeConditionMatches.filter(m => m.confidence === 'low').length;
  
  return {
    processedMatches: closeConditionMatches.length,
    updatedMatches: updatedCount,
    highConfidence,
    mediumConfidence,
    lowConfidence
  };
}

/**
 * Export close condition matches for review
 */
export async function exportCloseConditionMatches(limit: number = 50): Promise<void> {
  const query = `
    SELECT 
      mm.id,
      mm.close_condition_score,
      mm.close_condition_ai_status,
      ma.title as market_a_title,
      mb.title as market_b_title,
      ma.close_condition as market_a_close_condition,
      mb.close_condition as market_b_close_condition,
      pa.code as platform_a_code,
      pb.code as platform_b_code
    FROM market_matches mm
    JOIN markets ma ON mm.market_id_a = ma.id
    JOIN markets mb ON mm.market_id_b = mb.id
    JOIN platforms pa ON ma.platform_id = pa.id
    JOIN platforms pb ON mb.platform_id = pb.id
    WHERE mm.close_condition_score IS NOT NULL
    ORDER BY mm.close_condition_score DESC
    LIMIT $1
  `;
  
  const result = await pool.query(query, [limit]);
  
  const exportData = {
    exportTimestamp: new Date().toISOString(),
    totalExported: result.rows.length,
    algorithm: 'Close Condition Hybrid (Trigram + Jaccard + Vector)',
    thresholds: CLOSE_CONDITION_CONFIG,
    matches: result.rows.map(row => ({
      matchId: row.id,
      closeConditionScore: row.close_condition_score,
      aiStatus: row.close_condition_ai_status,
      kalshi: {
        title: row.platform_a_code === 'kalshi' ? row.market_a_title : row.market_b_title,
        closeCondition: row.platform_a_code === 'kalshi' ? row.market_a_close_condition : row.market_b_close_condition
      },
      polymarket: {
        title: row.platform_a_code === 'polymarket' ? row.market_a_title : row.market_b_title,
        closeCondition: row.platform_a_code === 'polymarket' ? row.market_a_close_condition : row.market_b_close_condition
      }
    }))
  };
  
  const { promises: fs } = await import('fs');
  const path = await import('path');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const exportDir = path.join(process.cwd(), 'data-exports', 'close-condition-matching', timestamp);
  await fs.mkdir(exportDir, { recursive: true });
  
  const filePath = path.join(exportDir, 'close-condition-matches.json');
  await fs.writeFile(filePath, JSON.stringify(exportData, null, 2), 'utf8');
  
  logger.info(`💾 Exported top ${result.rows.length} close condition matches to ${filePath}`);
}
