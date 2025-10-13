import { processKalshiMarkets } from '../src/services/kalshiSimple/processKalshi.js';
import { logger } from '../src/utils/logger.js';

async function testKalshiInsert() {
  logger.info('🧪 Testing processKalshi.ts...');
  
  try {
    const result = await processKalshiMarkets();
    
    logger.info(`✅ Test completed! Inserted: ${result.inserted}, Updated: ${result.updated}, Total: ${result.total}`);
    
  } catch (error) {
    logger.error('❌ Test failed:', error);
    throw error;
  }
}

testKalshiInsert()
  .then(() => {
    logger.info('✅ Kalshi insert test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('❌ Kalshi insert test failed:', error);
    process.exit(1);
  });