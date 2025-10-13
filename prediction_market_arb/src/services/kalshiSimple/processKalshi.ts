import { getKalshiEvents } from './getKalshiEvents.js';
import { batchInsertKalshiMarkets } from './insertKalshiMarkets.js';
import { logger } from '../../utils/logger.js';
import { KalshiBatchResult } from '../../types/database/database.js';

export async function processKalshiMarkets(): Promise<KalshiBatchResult> {
  logger.info('🚀 Starting Kalshi processing...');
  
  // Step 1: Get events
  const events = await getKalshiEvents(false);
  logger.info(`📊 Got ${events.length} events`);
  
  // Step 2: Insert markets (batch processing for 37k markets)
  const result: KalshiBatchResult = await batchInsertKalshiMarkets(events, 1000);
  logger.info(`New markets: ${result.newMarkets.length}, Existing markets: ${result.existingMarkets.length}`);
  
  logger.info('✅ Done!');
  return result;
}
