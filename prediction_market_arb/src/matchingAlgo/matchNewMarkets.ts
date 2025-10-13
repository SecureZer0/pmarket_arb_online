import { logger } from '../utils/logger.js';
import { matchAllMarkets, MatchingResult } from './matchAllMarkets.js';

// Types for new market matching
export interface NewMarketSummary {
  newVsOld: MatchingResult;
  oldVsNew: MatchingResult;
  newVsNew: MatchingResult;
  totalCandidates: number;
}

/**
 * Match only new markets against existing ones using in-memory arrays
 */
export async function matchNewMarkets(
  newKalshi: any[],
  allKalshi: any[],
  newPolymarket: any[],
  allPolymarket: any[]
): Promise<NewMarketSummary> {
  logger.info('🚀 Starting new market matching (in-memory)...');

  // new Kalshi vs all Polymarket
  const newVsOld: MatchingResult = await matchAllMarkets(newKalshi, allPolymarket);
  // all Kalshi vs new Polymarket
  const oldVsNew: MatchingResult = await matchAllMarkets(allKalshi, newPolymarket);
  // new Kalshi vs new Polymarket
  const newVsNew: MatchingResult = await matchAllMarkets(newKalshi, newPolymarket);

  const totalCandidates = newVsOld.totalCandidates + oldVsNew.totalCandidates + newVsNew.totalCandidates;

  logger.info(`✅ New-market matching complete. Total candidates: ${totalCandidates}`);
  logger.info(`🔄 New Kalshi vs All Polymarket: ${newVsOld.totalCandidates}`);
  logger.info(`🔄 All Kalshi vs New Polymarket: ${oldVsNew.totalCandidates}`);
  logger.info(`🆕 New vs New: ${newVsNew.totalCandidates}`);

  return { newVsOld, oldVsNew, newVsNew, totalCandidates };
}
