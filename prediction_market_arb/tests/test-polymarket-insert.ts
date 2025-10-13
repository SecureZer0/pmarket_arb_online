import { processPolymarketMarkets } from '../src/services/polymarketSimple/processPolymarket.js';
import { logger } from '../src/utils/logger.js';

async function testPolymarketInsert() {
  logger.info('🧪 Testing processPolymarket.ts...');
  
  try {
    const result = await processPolymarketMarkets();
    
    logger.info(`✅ Test completed! Inserted: ${result.inserted}, Updated: ${result.updated}, Total: ${result.total}`);
    
  } catch (error) {
    logger.error('❌ Test failed:', error);
    throw error;
  }
}

testPolymarketInsert()
  .then(() => {
    logger.info('✅ Polymarket insert test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('❌ Polymarket insert test failed:', error);
    process.exit(1);
  });


