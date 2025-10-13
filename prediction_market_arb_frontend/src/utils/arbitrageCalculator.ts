import { MarketMatch } from '../types/market';

export interface ArbitrageCalculationResult {
  // Basic arbitrage data
  arbitrageSpread: number | null;
  isArbitrageOpportunity: boolean;
  
  // Individual prices
  kalshiYesPrice: number | null;
  kalshiNoPrice: number | null;
  polymarketYesPrice: number | null;
  polymarketNoPrice: number | null;
  
  // Liquidity data
  maxArbitrageAmount: number | null;
  totalProfit: number | null;
  kalshiYesLiquidity: number;
  kalshiNoLiquidity: number;
  polymarketYesLiquidity: number;
  polymarketNoLiquidity: number;
  
  // Detailed depth calculations
  kalshiYesPolymarketNoDepth: { amount: number; avgPrice: number; totalProfit: number };
  polymarketYesKalshiNoDepth: { amount: number; avgPrice: number; totalProfit: number };
  
  // Additional depth calculations for the other side of each arbitrage direction
  polymarketNoKalshiYesDepth: { amount: number; avgPrice: number; totalProfit: number };
  kalshiNoPolymarketYesDepth: { amount: number; avgPrice: number; totalProfit: number };
  
  // Cost and profit calculations
  totalCost: number | null;
  potentialProfit: number | null;
  profitMargin: number | null;
}

// SINGLE SOURCE OF TRUTH for all arbitrage calculations
export function calculateArbitrageData(match: MarketMatch, orderbooks: {
  kalshiYesOrderbook?: any;
  kalshiNoOrderbook?: any;
  polymarketYesOrderbook?: any;
  polymarketNoOrderbook?: any;
}): ArbitrageCalculationResult {
  const { kalshiYesOrderbook, kalshiNoOrderbook, polymarketYesOrderbook, polymarketNoOrderbook } = orderbooks;

  // Helper function to validate if data is sufficient for arbitrage calculations
  const isValidPrice = (price: number | null): boolean => {
    return price !== null && price > 0 && price < 1.0; // Valid price range for prediction markets
  };

  // Get best ask prices
  const kalshiYesPrice = kalshiYesOrderbook?.asks && kalshiYesOrderbook.asks.size > 0
    ? Math.min(...Array.from(kalshiYesOrderbook.asks.keys()) as number[])
    : null;

  const kalshiNoPrice = kalshiNoOrderbook?.asks && kalshiNoOrderbook.asks.size > 0
    ? Math.min(...Array.from(kalshiNoOrderbook.asks.keys()) as number[])
    : null;

  const polymarketYesPrice = polymarketYesOrderbook?.asks && polymarketYesOrderbook.asks.size > 0
    ? Math.min(...Array.from(polymarketYesOrderbook.asks.keys()) as number[])
    : null;

  const polymarketNoPrice = polymarketNoOrderbook?.asks && polymarketNoOrderbook.asks.size > 0
    ? Math.min(...Array.from(polymarketNoOrderbook.asks.keys()) as number[])
    : null;

  // ULTRA-STRICT VALIDATION: We need ALL FOUR prices (both sides of both markets) before calculating ANY arbitrage
  const hasKalshiYesData = isValidPrice(kalshiYesPrice);
  const hasKalshiNoData = isValidPrice(kalshiNoPrice);
  const hasPolymarketYesData = isValidPrice(polymarketYesPrice);
  const hasPolymarketNoData = isValidPrice(polymarketNoPrice);
  
  // We need ALL FOUR prices to be valid before we can calculate arbitrage
  const hasAllRequiredData = hasKalshiYesData && hasKalshiNoData && hasPolymarketYesData && hasPolymarketNoData;
  
  // If we don't have complete data for ALL FOUR prices, return null values
  if (!hasAllRequiredData) {
    console.log(`ARBITRAGE CALCULATOR: Missing data - Kalshi Yes: ${kalshiYesPrice}, Kalshi No: ${kalshiNoPrice}, Polymarket Yes: ${polymarketYesPrice}, Polymarket No: ${polymarketNoPrice}`);
    return {
      arbitrageSpread: null,
      isArbitrageOpportunity: false,
      kalshiYesPrice,
      kalshiNoPrice,
      polymarketYesPrice,
      polymarketNoPrice,
      maxArbitrageAmount: null,
      totalProfit: null,
      kalshiYesLiquidity: 0,
      kalshiNoLiquidity: 0,
      polymarketYesLiquidity: 0,
      polymarketNoLiquidity: 0,
      kalshiYesPolymarketNoDepth: { amount: 0, avgPrice: 0, totalProfit: 0 },
      polymarketYesKalshiNoDepth: { amount: 0, avgPrice: 0, totalProfit: 0 },
      polymarketNoKalshiYesDepth: { amount: 0, avgPrice: 0, totalProfit: 0 },
      kalshiNoPolymarketYesDepth: { amount: 0, avgPrice: 0, totalProfit: 0 },
      totalCost: null,
      potentialProfit: null,
      profitMargin: null
    };
  }
  
  // Now we can safely calculate both arbitrage directions
  const hasValidKalshiYesPolymarketNo = hasKalshiYesData && hasPolymarketNoData;
  const hasValidPolymarketYesKalshiNo = hasPolymarketYesData && hasKalshiNoData;

  // Calculate arbitrage spread - check both directions and pick the profitable one
  const kalshiYesPolymarketNo = hasValidKalshiYesPolymarketNo
    ? 1.0 - (kalshiYesPrice! + polymarketNoPrice!)  // Profit = 1.0 - total cost
    : null;
  
  const polymarketYesKalshiNo = hasValidPolymarketYesKalshiNo
    ? 1.0 - (polymarketYesPrice! + kalshiNoPrice!)  // Profit = 1.0 - total cost
    : null;

  // Choose the best arbitrage direction (most profitable, even if negative)
  const arbitrageSpread = (() => {
    // If both directions are available, choose the better one (higher spread, even if negative)
    if (kalshiYesPolymarketNo !== null && polymarketYesKalshiNo !== null) {
      return Math.max(kalshiYesPolymarketNo, polymarketYesKalshiNo);
    }
    // If only one direction is available, use that one
    if (kalshiYesPolymarketNo !== null) return kalshiYesPolymarketNo;
    if (polymarketYesKalshiNo !== null) return polymarketYesKalshiNo;
    return null; // Only return null if no data is available
  })();

  // Calculate liquidity depth until arbitrage spread disappears
  const calculateLiquidityDepth = (orderbook: any, startPrice: number | null, otherPrice: number | null): { amount: number, avgPrice: number, totalProfit: number } => {
    if (!startPrice || !orderbook?.asks || !otherPrice) return { amount: 0, avgPrice: startPrice || 0, totalProfit: 0 };
    
    const entries = Array.from(orderbook.asks.entries()) as [number, any][];
    const sortedEntries = entries.sort(([a], [b]) => a - b); // Sort by price ascending
    
    let totalAmount = 0;
    let weightedPriceSum = 0;
    let totalProfit = 0;
    
    for (const [price, level] of sortedEntries) {
      // Check if this price level would still be profitable
      const combinedCost = price + otherPrice;
      if (combinedCost >= 1.0) break; // Stop when spread disappears
      
      // Take all available liquidity at this price level
      const amountAtThisLevel = level.size;
      totalAmount += amountAtThisLevel;
      weightedPriceSum += amountAtThisLevel * price;
      
      // Calculate actual profit for this price level
      const profitPerUnit = 1.0 - combinedCost;
      const profitAtThisLevel = profitPerUnit * amountAtThisLevel;
      totalProfit += profitAtThisLevel;
    }
    
    const avgPrice = totalAmount > 0 ? weightedPriceSum / totalAmount : startPrice;
    return { amount: totalAmount, avgPrice, totalProfit };
  };

  // Calculate liquidity depth for both arbitrage directions
  const kalshiYesPolymarketNoDepth = calculateLiquidityDepth(kalshiYesOrderbook, kalshiYesPrice, polymarketNoPrice);
  const polymarketYesKalshiNoDepth = calculateLiquidityDepth(polymarketYesOrderbook, polymarketYesPrice, kalshiNoPrice);

  // Calculate liquidity depth for the OTHER side of each arbitrage direction
  const polymarketNoKalshiYesDepth = calculateLiquidityDepth(polymarketNoOrderbook, polymarketNoPrice, kalshiYesPrice);
  const kalshiNoPolymarketYesDepth = calculateLiquidityDepth(kalshiNoOrderbook, kalshiNoPrice, polymarketYesPrice);

  // Helper function to calculate profit for a constrained amount
  const calculateConstrainedProfit = (orderbook: any, startPrice: number | null, otherPrice: number | null, maxAmount: number): number => {
    if (!startPrice || !orderbook?.asks || !otherPrice) return 0;
    
    const entries = Array.from(orderbook.asks.entries()) as [number, any][];
    const sortedEntries = entries.sort(([a], [b]) => a - b); // Sort by price ascending
    
    let totalProfit = 0;
    let remainingAmount = maxAmount;
    
    for (const [price, level] of sortedEntries) {
      if (remainingAmount <= 0) break;
      
      // Check if this price level would still be profitable
      const combinedCost = price + otherPrice;
      if (combinedCost >= 1.0) break; // Stop when spread disappears
      
      // Take up to the remaining amount at this price level
      const amountAtThisLevel = Math.min(level.size, remainingAmount);
      remainingAmount -= amountAtThisLevel;
      
      // Calculate actual profit for this price level
      const profitPerUnit = 1.0 - combinedCost;
      const profitAtThisLevel = profitPerUnit * amountAtThisLevel;
      totalProfit += profitAtThisLevel;
    }
    
    return totalProfit;
  };

  // Determine which arbitrage direction is being used (even if not profitable)
  const isKalshiYesPolymarketNo = arbitrageSpread !== null && arbitrageSpread === kalshiYesPolymarketNo;
  const isPolymarketYesKalshiNo = arbitrageSpread !== null && arbitrageSpread === polymarketYesKalshiNo;
  
  // Use true liquidity depth calculation (even for negative spreads)
  // The max arbitrage amount is limited by the LEAST available liquidity on either side
  const maxArbitrageAmount = arbitrageSpread !== null
    ? isKalshiYesPolymarketNo 
      ? Math.min(kalshiYesPolymarketNoDepth.amount, polymarketNoKalshiYesDepth.amount)
      : Math.min(polymarketYesKalshiNoDepth.amount, kalshiNoPolymarketYesDepth.amount)
    : null;

  // Calculate total profit/loss using the ACTUAL profits from orderbook progression
  // This accounts for the fact that as you buy more tokens, you pay higher prices and get less profit per unit
  const totalProfit = arbitrageSpread !== null && maxArbitrageAmount
    ? isKalshiYesPolymarketNo 
      ? (() => {
          // If Kalshi Yes is the constraint, use its actual profit calculation
          const isKalshiYesConstraining = kalshiYesPolymarketNoDepth.amount <= polymarketNoKalshiYesDepth.amount;
          if (isKalshiYesConstraining) {
            return kalshiYesPolymarketNoDepth.totalProfit;
          } else {
            // If Polymarket No is the constraint, calculate profit up to the constrained amount
            return calculateConstrainedProfit(polymarketNoOrderbook, polymarketNoPrice, kalshiYesPrice, maxArbitrageAmount);
          }
        })()
      : (() => {
          // If Polymarket Yes is the constraint, use its actual profit calculation
          const isPolymarketYesConstraining = polymarketYesKalshiNoDepth.amount <= kalshiNoPolymarketYesDepth.amount;
          if (isPolymarketYesConstraining) {
            return polymarketYesKalshiNoDepth.totalProfit;
          } else {
            // If Kalshi No is the constraint, calculate profit up to the constrained amount
            return calculateConstrainedProfit(kalshiNoOrderbook, kalshiNoPrice, polymarketYesPrice, maxArbitrageAmount);
          }
        })()
    : null;

  // Legacy single-price liquidity (for backward compatibility)
  const getLiquidityAtPrice = (orderbook: any, price: number | null): number => {
    if (!price || !orderbook?.asks) return 0;
    const entries = Array.from(orderbook.asks.entries()) as [number, any][];
    return entries
      .filter(([p]) => p === price)
      .reduce((sum, [, level]) => sum + level.size, 0);
  };

  const kalshiYesLiquidity = getLiquidityAtPrice(kalshiYesOrderbook, kalshiYesPrice);
  const kalshiNoLiquidity = getLiquidityAtPrice(kalshiNoOrderbook, kalshiNoPrice);
  const polymarketYesLiquidity = getLiquidityAtPrice(polymarketYesOrderbook, polymarketYesPrice);
  const polymarketNoLiquidity = getLiquidityAtPrice(polymarketNoOrderbook, polymarketNoPrice);

  // Calculate costs and profits based on the profitable direction using average prices from depth
  // Use the average prices from the side that's actually constraining the arbitrage
  const totalCost = maxArbitrageAmount
    ? isKalshiYesPolymarketNo
      ? (() => {
          // If Kalshi Yes is the constraint, use its average price; otherwise use Polymarket No's average price
          const isKalshiYesConstraining = kalshiYesPolymarketNoDepth.amount <= polymarketNoKalshiYesDepth.amount;
          const kalshiYesAvgPrice = isKalshiYesConstraining ? kalshiYesPolymarketNoDepth.avgPrice : kalshiYesPrice!;
          const polymarketNoAvgPrice = isKalshiYesConstraining ? polymarketNoPrice! : polymarketNoKalshiYesDepth.avgPrice;
          return (kalshiYesAvgPrice + polymarketNoAvgPrice) * maxArbitrageAmount;
        })()
      : (() => {
          // If Polymarket Yes is the constraint, use its average price; otherwise use Kalshi No's average price
          const isPolymarketYesConstraining = polymarketYesKalshiNoDepth.amount <= kalshiNoPolymarketYesDepth.amount;
          const polymarketYesAvgPrice = isPolymarketYesConstraining ? polymarketYesKalshiNoDepth.avgPrice : polymarketYesPrice!;
          const kalshiNoAvgPrice = isPolymarketYesConstraining ? kalshiNoPrice! : kalshiNoPolymarketYesDepth.avgPrice;
          return (polymarketYesAvgPrice + kalshiNoAvgPrice) * maxArbitrageAmount;
        })()
    : null;

  const potentialProfit = totalProfit; // Now using the actual calculated profit that accounts for price progression

  const profitMargin = totalCost && potentialProfit
    ? (potentialProfit / totalCost) * 100
    : null;

  const isArbitrageOpportunity = arbitrageSpread !== null && arbitrageSpread > 0.001; // 0.1% minimum spread

  return {
    arbitrageSpread,
    isArbitrageOpportunity,
    kalshiYesPrice,
    kalshiNoPrice,
    polymarketYesPrice,
    polymarketNoPrice,
    maxArbitrageAmount,
    totalProfit,
    kalshiYesLiquidity,
    kalshiNoLiquidity,
    polymarketYesLiquidity,
    polymarketNoLiquidity,
    kalshiYesPolymarketNoDepth,
    polymarketYesKalshiNoDepth,
    polymarketNoKalshiYesDepth,
    kalshiNoPolymarketYesDepth,
    totalCost,
    potentialProfit,
    profitMargin
  };
}

// Backward compatibility function for simple arbitrage spread only
export function calculateArbitrageSpread(match: MarketMatch, orderbooks: {
  kalshiYesOrderbook?: any;
  kalshiNoOrderbook?: any;
  polymarketYesOrderbook?: any;
  polymarketNoOrderbook?: any;
}): number | null {
  return calculateArbitrageData(match, orderbooks).arbitrageSpread;
}
