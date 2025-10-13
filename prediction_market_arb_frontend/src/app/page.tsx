'use client';

import { useState, useEffect, useRef } from 'react';
import { MarketMatch } from '../types/market';
import MarketMain from '../components/MarketMatcher/MarketMain';
import FloatingBottomBar from '../components/FloatingBottomBar';
import { initPolymarketWebSocket, closePolymarketWebSocket } from '../websockets/polymarket';
import { initKalshiWebSocket, closeKalshiWebSocket } from '../websockets/kalshi';
import { OrderBookProvider } from '../contexts/OrderBookContext';
import { SettingsProvider, useSettings } from '../contexts/SettingsContext';
// ArbitrageProvider no longer needed - arbitrage data is now part of MarketMatch objects

function HomePageContent() {
  const [matches, setMatches] = useState<MarketMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [websocketInitialized, setWebsocketInitialized] = useState(false);
  const [kalshiWebsocketInitialized, setKalshiWebsocketInitialized] = useState(false);
  const { filterSettings } = useSettings();
  
  
  // No pagination - just show top 250 markets
  const [sortedMarkets, setSortedMarkets] = useState<MarketMatch[]>([]);
  
  // Sorting state - now supports three states for arbitrage: null, 'arbitrage_percent', 'arbitrage_dollar'
  const [sortBy, setSortBy] = useState<'volume' | 'arbitrage_percent' | 'arbitrage_dollar' | null>(null);
  
 console.log(matches[0])

  // Arbitrage sorting enabled


  useEffect(() => {
    // Try to load from localStorage first
    const cachedMatches = localStorage.getItem('marketMatches');
    const cachedTimestamp = localStorage.getItem('marketMatchesTimestamp');
    
    if (cachedMatches && cachedTimestamp) {
      const age = Date.now() - parseInt(cachedTimestamp);
      // const maxAge = 12 * 60 * 60 * 1000; // 12 hours cache
      const maxAge = 1; // 12 hours cache
      
      if (age < maxAge) {
        try {
          const parsed = JSON.parse(cachedMatches);
          setMatches(parsed);
          setLoading(false);
          return; // Use cached data
        } catch (e) {
          console.log('Failed to parse cached matches, fetching fresh data');
        }
      }
    }
    
    // Fetch fresh data if no cache or cache expired
    // Use saved filter settings if available
    const savedSettings = localStorage.getItem('filterSettings');
    let settingsToUse = undefined;
    if (savedSettings) {
      try {
        settingsToUse = JSON.parse(savedSettings);
        console.log('🔄 Using saved filter settings on initial load:', settingsToUse);
      } catch (error) {
        console.error('Failed to parse saved filter settings:', error);
      }
    }
    
    fetchMatches(settingsToUse);
  }, []);

  // Sorting function
  const sortMarkets = (markets: MarketMatch[]): MarketMatch[] => {
    if (!sortBy) return markets;
    
    console.log(`sortMarkets called with sortBy: ${sortBy}, markets count: ${markets.length}`);
    
    return [...markets].sort((a, b) => {
      // Sort by the selected criteria
      let comparison = 0;
      
      if (sortBy === 'volume') {
        const aVolume = (typeof a.market_a_volume === 'string' ? parseFloat(a.market_a_volume) : a.market_a_volume) || 0;
        const bVolume = (typeof b.market_a_volume === 'string' ? parseFloat(b.market_a_volume) : b.market_a_volume) || 0;
        const aVolumeB = (typeof a.market_b_volume === 'string' ? parseFloat(a.market_b_volume) : a.market_b_volume) || 0;
        const bVolumeB = (typeof b.market_b_volume === 'string' ? parseFloat(b.market_b_volume) : b.market_b_volume) || 0;
        
        const aCombinedVolume = aVolume + aVolumeB;
        const bCombinedVolume = bVolume + bVolumeB;
        
        comparison = bCombinedVolume - aCombinedVolume; // Biggest first for volume
      } else if (sortBy === 'arbitrage_percent') {
        // Sort by arbitrage_spread percentage, biggest positive first
        const aArbSpread = a.arbitrage_spread || 0;
        const bArbSpread = b.arbitrage_spread || 0;
        
        comparison = bArbSpread - aArbSpread; // Biggest first
      } else if (sortBy === 'arbitrage_dollar') {
        // Sort by actual profit dollar amount, biggest first
        const aProfit = a.arbitrage_total_profit || 0;
        const bProfit = b.arbitrage_total_profit || 0;
        
        comparison = bProfit - aProfit; // Biggest first
      }
      
      return comparison;
    });
  };

  // Update sortedMarkets when matches change - API already returns top 250 by volume
  useEffect(() => {
    if (matches.length > 0) {
      // Only reset to default volume sorting if no custom sort is active
      if (!sortBy) {
        setSortedMarkets(matches);
        console.log(`📊 Showing ${matches.length} markets from API (already sorted by volume)`);
      } else {
        // If we have a custom sort active, re-apply it to the new matches
        const sorted = sortMarkets(matches);
        setSortedMarkets(sorted);
        console.log(`📊 Re-applied ${sortBy} sorting to ${matches.length} markets`);
      }
    }
  }, [matches, sortBy]);

  // Update arbitrage data ref when context changes (no re-render trigger)
  // useEffect(() => {
  //   arbitrageDataRef.current = arbitrageData;
  // }, [arbitrageData]);

  // Initialize WebSockets once when matches are first loaded
  useEffect(() => {
    if (matches.length > 0 && !websocketInitialized && !kalshiWebsocketInitialized) {
      console.log('🔄 Initializing WebSockets on first load');
      initializeWebSockets(matches);
    }
  }, [matches, websocketInitialized, kalshiWebsocketInitialized]);

  // Refetch data when filter settings change
  useEffect(() => {
    // Only refetch if we have existing data and settings have changed
    if (matches.length > 0) {
      console.log('🔄 Filter settings changed, refetching data...');
      fetchMatches(filterSettings);
    }
  }, [filterSettings]);

  const fetchMatches = async (filterSettings?: any) => {
    try {
      setLoading(true);
      const url = new URL('/api/market-matches', window.location.origin);
      
      // Add filter parameters to URL if provided
      if (filterSettings) {
        if (filterSettings.hideAiRejectedMarkets) {
          url.searchParams.append('hideAiRejectedMarkets', 'true');
        }
        if (filterSettings.hideAiRejectedCloseConditions) {
          url.searchParams.append('hideAiRejectedCloseConditions', 'true');
        }
        if (filterSettings.hideUserRejectedMarkets) {
          url.searchParams.append('hideUserRejectedMarkets', 'true');
        }
        if (filterSettings.hideUserRejectedCloseConditions) {
          url.searchParams.append('hideUserRejectedCloseConditions', 'true');
        }
      }
      
      const response = await fetch(url.toString());
      const data = await response.json();
      
      if (data.success) {
        setMatches(data.data);
        
        // Cache the data in localStorage
        localStorage.setItem('marketMatches', JSON.stringify(data.data));
        localStorage.setItem('marketMatchesTimestamp', Date.now().toString());
        
        console.log(`📊 Fetched ${data.data.length} market matches from API`);
        console.log('Market matches cached in localStorage');
      } else {
        setError(data.error || 'Failed to fetch matches');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const initializeWebSockets = (marketMatches: MarketMatch[]) => {
    try {
      // Extract clobTokenIds from current page markets only
      const allClobIds: string[] = [];
      const allKalshiTickers: string[] = [];
      
      marketMatches.forEach((match) => {
        // Check if market B is Polymarket and has clobTokenIds
        if (match.platform_b_name?.toLowerCase().includes('polymarket') && 
            match.market_b_platform_data?.clobTokenIds) {
          
          let clobTokenIds = match.market_b_platform_data.clobTokenIds;
          
          // Handle case where clobTokenIds might be a JSON string
          if (typeof clobTokenIds === 'string') {
            try {
              clobTokenIds = JSON.parse(clobTokenIds);
            } catch (parseError) {
              console.error('❌ Failed to parse clobTokenIds JSON:', parseError);
              return; // Skip this match if parsing fails
            }
          }
          
          if (Array.isArray(clobTokenIds)) {
            // Convert to numbers if they're numeric strings, otherwise keep as strings
            clobTokenIds.forEach((id) => {
              const clobId = id.toString();
              
              if (!allClobIds.includes(clobId)) {
                allClobIds.push(clobId);
              }
            });
          }
        }

        // Check if market A is Kalshi and has external_id (ticker)
        if (match.platform_a_name?.toLowerCase().includes('kalshi') && 
            match.market_a_external_id) {
          
          const ticker = match.market_a_external_id;
          
          if (!allKalshiTickers.includes(ticker)) {
            allKalshiTickers.push(ticker);
          }
        }
      });

      // Initialize Polymarket WebSocket
      if (allClobIds.length > 0) {
        console.log(`🔌 Initializing Polymarket WebSocket with ${allClobIds.length} clobIds for top 250 markets`);
        initPolymarketWebSocket(allClobIds, undefined, false); // verbose = false to reduce logging
        setWebsocketInitialized(true);
        console.log('✅ Polymarket WebSocket initialized successfully');
      } else {
        console.log('⚠️ No Polymarket clobTokenIds found, skipping WebSocket initialization');
      }

      // Initialize Kalshi WebSocket
      if (allKalshiTickers.length > 0) {
        console.log(`🔌 Initializing Kalshi WebSocket with ${allKalshiTickers.length} tickers for top 250 markets`);
        initKalshiWebSocket(allKalshiTickers, undefined, false); // verbose = false to reduce logging
        setKalshiWebsocketInitialized(true);
        console.log('✅ Kalshi WebSocket initialized successfully');
      } else {
        console.log('⚠️ No Kalshi tickers found, skipping WebSocket initialization');
      }
    } catch (err) {
      console.error('❌ Error initializing WebSockets:', err);
    }
  };

  // No pagination - removed changePage function

  const handleSort = (column: 'volume' | 'arbitrage') => {
    console.log(`Sorting by ${column}`);
    
    if (column === 'volume') {
      if (sortBy === 'volume') {
        // If clicking volume when already sorted by volume, turn off sorting
        setSortBy(null);
        // Re-apply the default volume sorting (top 250)
        const sortedByVolume = [...matches].sort((a, b) => {
          const aVolume = (typeof a.market_a_volume === 'string' ? parseFloat(a.market_a_volume) : a.market_a_volume) || 0;
          const bVolume = (typeof b.market_a_volume === 'string' ? parseFloat(b.market_a_volume) : b.market_a_volume) || 0;
          const aVolumeB = (typeof a.market_b_volume === 'string' ? parseFloat(a.market_b_volume) : a.market_b_volume) || 0;
          const bVolumeB = (typeof b.market_b_volume === 'string' ? parseFloat(b.market_b_volume) : b.market_b_volume) || 0;
          
          const aCombinedVolume = aVolume + aVolumeB;
          const bCombinedVolume = bVolume + bVolumeB;
          
          return bCombinedVolume - aCombinedVolume;
        });
        setSortedMarkets(sortedByVolume);
      } else {
        // Set volume sorting
        setSortBy('volume');
      }
    } else if (column === 'arbitrage') {
      // Cycle through: null -> arbitrage_percent -> arbitrage_dollar -> null
      if (sortBy === null) {
        setSortBy('arbitrage_percent');
      } else if (sortBy === 'arbitrage_percent') {
        setSortBy('arbitrage_dollar');
      } else if (sortBy === 'arbitrage_dollar') {
        setSortBy(null);
        // Re-apply the default volume sorting (top 250)
        const sortedByVolume = [...matches].sort((a, b) => {
          const aVolume = (typeof a.market_a_volume === 'string' ? parseFloat(a.market_a_volume) : a.market_a_volume) || 0;
          const bVolume = (typeof b.market_a_volume === 'string' ? parseFloat(b.market_a_volume) : b.market_a_volume) || 0;
          const aVolumeB = (typeof a.market_b_volume === 'string' ? parseFloat(a.market_b_volume) : a.market_b_volume) || 0;
          const bVolumeB = (typeof b.market_b_volume === 'string' ? parseFloat(b.market_b_volume) : b.market_b_volume) || 0;
          
          const aCombinedVolume = aVolume + aVolumeB;
          const bCombinedVolume = bVolume + bVolumeB;
          
          return bCombinedVolume - aCombinedVolume;
        });
        setSortedMarkets(sortedByVolume);
      }
    }
  };

  // Cleanup WebSockets on unmount
  useEffect(() => {
    return () => {
      // Polymarket WebSocket cleanup
      if (websocketInitialized) {
        closePolymarketWebSocket();
        console.log('🔌 Polymarket WebSocket closed');
      }
      if (kalshiWebsocketInitialized) {
        closeKalshiWebSocket();
        console.log('🔌 Kalshi WebSocket closed');
      }
    };
  }, [websocketInitialized, kalshiWebsocketInitialized]);

  // console.log(`📊 Total matches: ${matches.length}, Showing top 250 by volume`);

  const handleRefresh = () => {
    console.log('🔄 Manual refresh triggered');
    fetchMatches(filterSettings);
  };

  return (
    <OrderBookProvider>
      <div className="min-h-screen">
          <FloatingBottomBar onRefresh={handleRefresh} />
          <MarketMain 
            matches={sortedMarkets} 
            setMatches={(newMatchesOrFunction) => {
              setMatches(newMatchesOrFunction);
              // Also update sortedMarkets to keep them in sync
              setSortedMarkets(prevSorted => {
                // Get the actual new matches array
                const newMatches = typeof newMatchesOrFunction === 'function' 
                  ? newMatchesOrFunction(prevSorted) 
                  : newMatchesOrFunction;
                
                // Update the matches in the current sorted order
                const updatedSorted = prevSorted.map(sortedMatch => {
                  const updatedMatch = newMatches.find(m => m.id === sortedMatch.id);
                  return updatedMatch || sortedMatch;
                });
                
                // Re-apply the current sorting to preserve the sort order
                return sortMarkets(updatedSorted);
              });
            }}
            loading={loading} 
            error={error}
            sortBy={sortBy}
            onSort={handleSort}
          />
      </div>
    </OrderBookProvider>
  );
}

export default function HomePage() {
  return (
    <SettingsProvider>
      <HomePageContent />
    </SettingsProvider>
  );
}
