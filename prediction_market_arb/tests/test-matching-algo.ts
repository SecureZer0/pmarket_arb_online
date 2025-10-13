import { matchAllMarkets, exportTopMatches } from '../src/matchingAlgo/matchAllMarkets.js';

async function testMatchingAlgo() {
  try {
    console.log('🧪 Testing hybrid matching algorithm...');
    
    const result = await matchAllMarkets();
    
    console.log(`✅ Success! Found ${result.totalCandidates} candidates`);
    console.log(`🎯 High confidence: ${result.highConfidence}`);
    console.log(`🎯 Medium confidence: ${result.mediumConfidence}`);
    console.log(`🎯 Low confidence: ${result.lowConfidence}`);
    
    if (result.candidates.length > 0) {
      console.log('\n📊 Top 3 matches:');
      result.candidates.slice(0, 3).forEach((match, index) => {
        console.log(`${index + 1}. Score: ${match.hybridScore.toFixed(3)} (${match.confidence})`);
        console.log(`   Kalshi: ${match.kalshiMarket.eventTitle} - ${match.kalshiMarket.yes_sub_title}`);
        console.log(`   Polymarket: ${match.polymarketMarket.question}`);
        console.log('');
      });
    }
    
    // Export top matches
    await exportTopMatches(result, result.totalCandidates);
    console.log(`💾 Exported ALL ${result.totalCandidates} matches to data-exports/matching/`);
    
  } catch (error) {
    console.error('❌ Error testing matching algorithm:', error);
  }
}

testMatchingAlgo();
