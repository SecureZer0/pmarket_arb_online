import { matchCloseConditions, exportCloseConditionMatches } from '../src/matchingAlgo/closeConditionMatching.js';
import { logger } from '../src/utils/logger.js';

/**
 * Test script for close condition matching
 * This script tests the close condition matching algorithm independently
 */
async function testCloseConditionMatching() {
  logger.info('🧪 Starting close condition matching test...');
  
  try {
    // Test the main close condition matching function
    const result = await matchCloseConditions();
    
    logger.info('📊 Close condition matching results:');
    logger.info(`  - Processed matches: ${result.processedMatches}`);
    logger.info(`  - Updated matches: ${result.updatedMatches}`);
    logger.info(`  - High confidence: ${result.highConfidence}`);
    logger.info(`  - Medium confidence: ${result.mediumConfidence}`);
    logger.info(`  - Low confidence: ${result.lowConfidence}`);
    
    // If we have results, export them for review
    if (result.updatedMatches > 0) {
      logger.info('📤 Exporting close condition matches for review...');
      await exportCloseConditionMatches(20);
    }
    
    logger.info('✅ Close condition matching test completed successfully!');
    
  } catch (error) {
    logger.error('❌ Close condition matching test failed:', error);
    throw error;
  }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testCloseConditionMatching()
    .then(() => {
      logger.info('🎉 Test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 Test failed:', error);
      process.exit(1);
    });
}

export { testCloseConditionMatching };
