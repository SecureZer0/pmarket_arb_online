import { getKalshiEvents } from '../src/services/kalshiSimple/getKalshiEvents.js';

async function testKalshiEvents() {
  try {
    console.log('🧪 Testing Kalshi events fetch...');
    const events = await getKalshiEvents(true); // Don't save to file for testing
    console.log(`✅ Success! Fetched ${events.length} Kalshi events`);
    
    if (events.length > 0) {
      const firstEvent = events[0];
      if (firstEvent) {
        console.log('📊 First event:', firstEvent.title);
        console.log('🏷️  Category:', firstEvent.category);
        console.log('📈 Markets count:', firstEvent.markets.length);
      }
    }
  } catch (error) {
    console.error('❌ Error testing Kalshi events:', error);
  }
}

testKalshiEvents();
