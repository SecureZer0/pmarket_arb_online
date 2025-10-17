import { logger } from './utils/logger.js';
import { processPolymarketMarkets } from './services/polymarketSimple/processPolymarket.js';
import { processKalshiMarkets } from './services/kalshiSimple/processKalshi.js';
import { matchAllMarkets } from './matchingAlgo/matchAllMarkets.js';
import { matchNewMarkets } from './matchingAlgo/matchNewMarkets.js';
import { matchCloseConditions } from './matchingAlgo/closeConditionMatching.js';
import { KalshiBatchResult, PolymarketBatchResult } from './types/database/database.js';
// Orchestration is done inline here; no external orchestrator.
// No fetching inside matchers; we'll build inputs from processed results

export async function processAndMatch(matchAll: boolean = false): Promise<{
  kalshi: KalshiBatchResult;
  polymarket: PolymarketBatchResult;
  matching: any;
  closeConditionMatching: any;
}> {
  logger.info('🚀 Processing markets (Polymarket & Kalshi) and running matching...');

  const [polymarket, kalshi] = await Promise.all([
    processPolymarketMarkets(),
    processKalshiMarkets()
  ]);

  logger.info(`📊 Polymarket — new: ${polymarket.newMarkets.length}, existing: ${polymarket.existingMarkets.length}`);
  logger.info(`📊 Kalshi — new: ${kalshi.newMarkets.length}, existing: ${kalshi.existingMarkets.length}`);

  let matching;
  if (matchAll) {
    logger.info('🔗 Running full all-vs-all matching...');
    // Build in-memory inputs: use the prepared market records from processors
    // For matcher, we need Kalshi markets and Polymarket markets arrays
    const kalshiMarkets = [...kalshi.newMarkets, ...kalshi.existingMarkets];
    const polyMarkets = [...polymarket.newMarkets, ...polymarket.existingMarkets];
    matching = await matchAllMarkets(kalshiMarkets as any[], polyMarkets as any[]);
  } else {
    logger.info('🔗 Running new-market matching (new Polymarket vs all Kalshi, and new Kalshi vs all Polymarket)...');
    const newKalshi = kalshi.newMarkets;
    const allKalshi = [...kalshi.newMarkets, ...kalshi.existingMarkets];
    const newPoly = polymarket.newMarkets;
    const allPoly = [...polymarket.newMarkets, ...polymarket.existingMarkets];
    matching = await matchNewMarkets(newKalshi as any[], allKalshi as any[], newPoly as any[], allPoly as any[]);
  }

  logger.info('✅ Main matching complete.');

  // Always run close condition matching after regular matching is finished
  logger.info('🔍 Running close condition matching on newly created matches...');
  const closeConditionMatching = await matchCloseConditions();
  logger.info('✅ Close condition matching complete.');

  logger.info('✅ All processing and matching complete.');

  return { kalshi, polymarket, matching, closeConditionMatching };
}

// Optional: allow running from CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const allFlag = process.argv.includes('--all');
  const run = processAndMatch(allFlag);
  
  run.then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}


