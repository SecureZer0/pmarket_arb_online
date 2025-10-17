'use client';

import { useState, useEffect, useRef } from 'react';
import { MarketMatch } from '../types/market';
import MarketMain from '../components/MarketMatcher/MarketMain';
import FloatingBottomBar from '../components/FloatingBottomBar';
// WebSocket imports removed - now using proxy server for all data
import { OrderBookProvider, getOrderBookDispatch } from '../contexts/OrderBookContext';
import { SettingsProvider, useSettings } from '../contexts/SettingsContext';
import { fetchMatchesFull } from '../services/proxy';
// ArbitrageProvider no longer needed - arbitrage data is now part of MarketMatch objects

function HomePageContent() {
  const [matches, setMatches] = useState<MarketMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // WebSocket state removed - now using proxy server for all data
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

  // WebSocket initialization removed - now using proxy server for all data

  // Refetch data when filter settings change
  useEffect(() => {
    // Only refetch if we have existing data and settings have changed
    if (matches.length > 0) {
      console.log('🔄 Filter settings changed, refetching data...');
      fetchMatches(filterSettings);
    }
  }, [filterSettings]);

  // Populate OrderBookContext when matches are loaded and context is ready
  useEffect(() => {
    if (matches.length > 0) {
      console.log('🔄 Matches loaded, attempting to populate OrderBookContext...');
      // Use setTimeout to ensure context is ready
      setTimeout(() => {
        populateOrderBookContext(matches);
      }, 100);
    }
  }, [matches]);

  // Function to populate OrderBookContext with data from proxy server
  const populateOrderBookContext = (marketMatches: MarketMatch[]) => {
    console.log('🔄 Starting populateOrderBookContext with', marketMatches.length, 'matches');
    console.log('🔍 Sample match data:', marketMatches[0]);
    const dispatch = getOrderBookDispatch();
    if (!dispatch) {
      console.warn('❌ OrderBook dispatch not available - context may not be ready yet');
      return;
    }
    console.log('✅ OrderBook dispatch is available, proceeding with population');

    let kalshiCount = 0;
    let polymarketCount = 0;

    marketMatches.forEach(match => {
      // Handle Kalshi orderbook data
      if (match.marketA?.orderbook && match.platform_a_name?.toLowerCase().includes('kalshi')) {
        const kalshiTicker = match.market_a_external_id;
        if (kalshiTicker) {
          // Check if we have separate YES/NO orderbooks
          if (match.marketA.yesOrderbook && match.marketA.noOrderbook) {
            // Use separate orderbooks (new format)
            const yesBids = (match.marketA.yesOrderbook.bids || []).map(([price, size]) => ({
              price: price,
              size: size,
              side: 'bid' as const
            }));
            const yesAsks = (match.marketA.yesOrderbook.asks || []).map(([price, size]) => ({
              price: price,
              size: size,
              side: 'ask' as const
            }));
            
            const noBids = (match.marketA.noOrderbook.bids || []).map(([price, size]) => ({
              price: price,
              size: size,
              side: 'bid' as const
            }));
            const noAsks = (match.marketA.noOrderbook.asks || []).map(([price, size]) => ({
              price: price,
              size: size,
              side: 'ask' as const
            }));
            
            // Dispatch Yes outcome orderbook
            const yesClobId = `${kalshiTicker}_yes`;
            console.log('🚀 Dispatching Kalshi Yes orderbook (separate):', {
              clobId: yesClobId,
              bidsCount: yesBids.length,
              asksCount: yesAsks.length,
              sampleAsks: yesAsks.slice(0, 3)
            });
            
            dispatch({
              type: 'SET_ORDER_BOOK',
              marketId: '',
              clobId: yesClobId,
              bids: yesBids,
              asks: yesAsks,
              timestamp: match.marketA.yesOrderbook.lastUpdatedMs || Date.now()
            });
            
            // Dispatch No outcome orderbook
            const noClobId = `${kalshiTicker}_no`;
            console.log('🚀 Dispatching Kalshi No orderbook (separate):', {
              clobId: noClobId,
              bidsCount: noBids.length,
              asksCount: noAsks.length,
              sampleAsks: noAsks.slice(0, 3)
            });
            
            dispatch({
              type: 'SET_ORDER_BOOK',
              marketId: '',
              clobId: noClobId,
              bids: noBids,
              asks: noAsks,
              timestamp: match.marketA.noOrderbook.lastUpdatedMs || Date.now()
            });
          } else {
            // Fallback to combined orderbook (old format)
            const bids = (match.marketA.orderbook.bids || []).map(([price, size]) => ({
              price: price,
              size: size,
              side: 'bid' as const
            }));
            const asks = (match.marketA.orderbook.asks || []).map(([price, size]) => ({
              price: price,
              size: size,
              side: 'ask' as const
            }));
            
            // Dispatch same data to both YES and NO (fallback)
            const yesClobId = `${kalshiTicker}_yes`;
            const noClobId = `${kalshiTicker}_no`;
            
            console.log('🚀 Dispatching Kalshi orderbooks (fallback - same data):', {
              yesClobId,
              noClobId,
              bidsCount: bids.length,
              asksCount: asks.length
            });
            
            dispatch({
              type: 'SET_ORDER_BOOK',
              marketId: '',
              clobId: yesClobId,
              bids: bids,
              asks: asks,
              timestamp: match.marketA.orderbook.lastUpdatedMs || Date.now()
            });
            
            dispatch({
              type: 'SET_ORDER_BOOK',
              marketId: '',
              clobId: noClobId,
              bids: bids,
              asks: asks,
              timestamp: match.marketA.orderbook.lastUpdatedMs || Date.now()
            });
          }
          
          kalshiCount++;
        }
      }

      // Handle Polymarket orderbook data
      if (match.marketB?.orderbook && match.platform_b_name?.toLowerCase().includes('polymarket')) {
        const clobTokenIds = match.market_b_platform_data?.clobTokenIds;
        if (clobTokenIds) {
          try {
            const tokenIds = typeof clobTokenIds === 'string' ? JSON.parse(clobTokenIds) : clobTokenIds;
            if (Array.isArray(tokenIds) && tokenIds.length >= 2) {
              // Check if we have separate YES/NO orderbooks
              if (match.marketB.yesOrderbook && match.marketB.noOrderbook) {
                // Use separate orderbooks (new format)
                const yesBids = (match.marketB.yesOrderbook.bids || []).map(([price, size]) => ({
                  price: price,
                  size: size,
                  side: 'bid' as const
                }));
                const yesAsks = (match.marketB.yesOrderbook.asks || []).map(([price, size]) => ({
                  price: price,
                  size: size,
                  side: 'ask' as const
                }));
                
                const noBids = (match.marketB.noOrderbook.bids || []).map(([price, size]) => ({
                  price: price,
                  size: size,
                  side: 'bid' as const
                }));
                const noAsks = (match.marketB.noOrderbook.asks || []).map(([price, size]) => ({
                  price: price,
                  size: size,
                  side: 'ask' as const
                }));

                // Dispatch Yes outcome (first token)
                console.log('🚀 Dispatching Polymarket Yes orderbook (separate):', {
                  clobId: tokenIds[0],
                  bidsCount: yesBids.length,
                  asksCount: yesAsks.length,
                  sampleAsks: yesAsks.slice(0, 3)
                });
                
                dispatch({
                  type: 'SET_ORDER_BOOK',
                  marketId: '',
                  clobId: tokenIds[0],
                  bids: yesBids,
                  asks: yesAsks,
                  timestamp: match.marketB.yesOrderbook.lastUpdatedMs || Date.now()
                });

                // Dispatch No outcome (second token)
                console.log('🚀 Dispatching Polymarket No orderbook (separate):', {
                  clobId: tokenIds[1],
                  bidsCount: noBids.length,
                  asksCount: noAsks.length,
                  sampleAsks: noAsks.slice(0, 3)
                });
                
                dispatch({
                  type: 'SET_ORDER_BOOK',
                  marketId: '',
                  clobId: tokenIds[1],
                  bids: noBids,
                  asks: noAsks,
                  timestamp: match.marketB.noOrderbook.lastUpdatedMs || Date.now()
                });
              } else {
                // Fallback to combined orderbook (old format)
                const bids = (match.marketB.orderbook.bids || []).map(([price, size]) => ({
                  price: price,
                  size: size,
                  side: 'bid' as const
                }));
                const asks = (match.marketB.orderbook.asks || []).map(([price, size]) => ({
                  price: price,
                  size: size,
                  side: 'ask' as const
                }));

                // Dispatch same data to both YES and NO (fallback)
                console.log('🚀 Dispatching Polymarket orderbooks (fallback - same data):', {
                  yesClobId: tokenIds[0],
                  noClobId: tokenIds[1],
                  bidsCount: bids.length,
                  asksCount: asks.length
                });

                dispatch({
                  type: 'SET_ORDER_BOOK',
                  marketId: '',
                  clobId: tokenIds[0],
                  bids: bids,
                  asks: asks,
                  timestamp: match.marketB.orderbook.lastUpdatedMs || Date.now()
                });
              }
              polymarketCount++;
            }
          } catch (error) {
            console.warn('Failed to parse Polymarket clobTokenIds:', error);
          }
        }
      }
    });

    console.log(`📊 Populated OrderBookContext: ${kalshiCount} Kalshi, ${polymarketCount} Polymarket orderbooks`);
    
    // Debug: Log some sample orderbook data
    if (kalshiCount > 0) {
      console.log('🔍 Sample Kalshi orderbook data:', {
        sampleMatch: marketMatches.find(m => m.marketA?.orderbook && m.platform_a_name?.toLowerCase().includes('kalshi')),
        totalKalshiMarkets: marketMatches.filter(m => m.platform_a_name?.toLowerCase().includes('kalshi')).length
      });
    }
  };

  const fetchMatches = async (filterSettings?: any) => {
    try {
      setLoading(true);
      console.log('🚀 Starting fetchMatches...');
      
      // Use proxy service to fetch matches with full orderbooks
      console.log('📡 Calling fetchMatchesFull...');
      const data = await fetchMatchesFull();
      console.log('✅ fetchMatchesFull completed:', data);
      
      if (data.success) {
        setMatches(data.data);
        
        // Don't populate context here - do it in useEffect after context is ready
        
        // Cache the data in localStorage
        localStorage.setItem('marketMatches', JSON.stringify(data.data));
        localStorage.setItem('marketMatchesTimestamp', Date.now().toString());
        
        console.log(`📊 Fetched ${data.data.length} market matches from proxy with full orderbooks`);
        console.log('Market matches cached in localStorage');
      } else {
        setError(data.error || 'Failed to fetch matches');
      }
    } catch (err) {
      setError('Network error occurred');
      console.error('Error fetching matches from proxy:', err);
    } finally {
      setLoading(false);
    }
  };

  // initializeWebSockets function removed - now using proxy server for all data

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

  // WebSocket cleanup removed - no direct WebSocket connections

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
