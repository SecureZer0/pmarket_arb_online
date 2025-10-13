import { getPolymarketEvents } from './getPolymarketEvents.js';
import { batchInsertPolymarketMarkets } from './insertPolymarketMarkets.js';
import { logger } from '../../utils/logger.js';
import { PolymarketBatchResult } from '../../types/database/database.js';



export async function processPolymarketMarkets(): Promise<PolymarketBatchResult> {
  
  logger.info('🚀 Starting Polymarket processing...');
  const markets = await getPolymarketEvents(false);
  logger.info(`📊 Got ${markets.length} markets`);
  const result: PolymarketBatchResult = await batchInsertPolymarketMarkets(markets, 1000);
  logger.info(`New markets: ${result.newMarkets.length}, Existing markets: ${result.existingMarkets.length}`);

  logger.info('✅ Done!');
  return result;
}
