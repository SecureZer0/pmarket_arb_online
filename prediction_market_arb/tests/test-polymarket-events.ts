import { getPolymarketEvents } from '../src/services/polymarketSimple/getPolymarketEvents.js';

async function testPolymarketEvents() {
  try {
    console.log('🧪 Testing Polymarket events fetch...');
    const markets = await getPolymarketEvents(true); // Don't save to file for testing
    console.log(`✅ Success! Fetched ${markets.length} Polymarket markets`);
    
    if (markets.length > 0) {
      const firstMarket = markets[0];
      if (firstMarket) {
        console.log('📊 First market:', firstMarket.question);
        console.log('💰 Volume:', firstMarket.volume);
        console.log('💧 Liquidity:', firstMarket.liquidity);
      }
    }
  } catch (error) {
    console.error('❌ Error testing Polymarket events:', error);
  }
}

testPolymarketEvents();
