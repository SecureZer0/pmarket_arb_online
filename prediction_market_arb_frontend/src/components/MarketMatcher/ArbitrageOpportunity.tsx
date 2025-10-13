import { useEffect } from 'react';
import { useOrderBookByClobId } from '../../contexts/OrderBookContext';
import { MarketMatch } from '../../types/market';
import { calculateArbitrageData } from '../../utils/arbitrageCalculator';

interface ArbitrageOpportunityProps {
  match: MarketMatch;
  onArbitrageUpdate?: (matchId: number, arbitrageData: {
    arbitrage_spread: number | null;
    arbitrage_profit_margin: number | null;
    is_arbitrage_opportunity: boolean;
    arbitrage_total_profit: number | null;
  }) => void;
}

interface ArbitrageData {
  kalshiYesPrice: number | null;
  polymarketNoPrice: number | null;
  arbitrageSpread: number | null;
  maxArbitrageAmount: number | null;
  kalshiYesLiquidity: number;
  polymarketNoLiquidity: number;
  isArbitrageOpportunity: boolean;
  totalProfit: number | null;
}

export default function ArbitrageOpportunity({ match, onArbitrageUpdate }: ArbitrageOpportunityProps) {
  // Get Kalshi Yes orderbook
  const kalshiYesClobId = match.platform_a_name?.toLowerCase().includes('kalshi') && match.market_a_external_id
    ? `${match.market_a_external_id}_yes`
    : null;
  const kalshiYesOrderbook = kalshiYesClobId ? useOrderBookByClobId(kalshiYesClobId) : null;

  // Get Kalshi No orderbook
  const kalshiNoClobId = match.platform_a_name?.toLowerCase().includes('kalshi') && match.market_a_external_id
    ? `${match.market_a_external_id}_no`
    : null;
  const kalshiNoOrderbook = kalshiNoClobId ? useOrderBookByClobId(kalshiNoClobId) : null;

  // Get Polymarket Yes orderbook
  const polymarketYesClobId = match.platform_b_name?.toLowerCase().includes('polymarket') && match.market_b_platform_data?.clobTokenIds
    ? (() => {
        try {
          const clobTokenIds = typeof match.market_b_platform_data.clobTokenIds === 'string'
            ? JSON.parse(match.market_b_platform_data.clobTokenIds)
            : match.market_b_platform_data.clobTokenIds;
          return Array.isArray(clobTokenIds) && clobTokenIds[0] ? clobTokenIds[0] : null;
        } catch {
          return null;
        }
      })()
    : null;
  const polymarketYesOrderbook = polymarketYesClobId ? useOrderBookByClobId(polymarketYesClobId) : null;

  // Get Polymarket No orderbook
  const polymarketNoClobId = match.platform_b_name?.toLowerCase().includes('polymarket') && match.market_b_platform_data?.clobTokenIds
    ? (() => {
        try {
          const clobTokenIds = typeof match.market_b_platform_data.clobTokenIds === 'string'
            ? JSON.parse(match.market_b_platform_data.clobTokenIds)
            : match.market_b_platform_data.clobTokenIds;
          return Array.isArray(clobTokenIds) && clobTokenIds[1] ? clobTokenIds[1] : null;
        } catch {
          return null;
        }
      })()
    : null;
  const polymarketNoOrderbook = polymarketNoClobId ? useOrderBookByClobId(polymarketNoClobId) : null;

  // Use the centralized arbitrage calculation - SINGLE SOURCE OF TRUTH
  const arbitrageCalculationResult = calculateArbitrageData(match, {
    kalshiYesOrderbook,
    kalshiNoOrderbook,
    polymarketYesOrderbook,
    polymarketNoOrderbook
  });

  // Convert to the format expected by this component
  const arbitrageData: ArbitrageData = {
    kalshiYesPrice: arbitrageCalculationResult.kalshiYesPrice,
    polymarketNoPrice: arbitrageCalculationResult.polymarketNoPrice,
    arbitrageSpread: arbitrageCalculationResult.arbitrageSpread,
    maxArbitrageAmount: arbitrageCalculationResult.maxArbitrageAmount,
    kalshiYesLiquidity: arbitrageCalculationResult.kalshiYesLiquidity,
    polymarketNoLiquidity: arbitrageCalculationResult.polymarketNoLiquidity,
    isArbitrageOpportunity: arbitrageCalculationResult.isArbitrageOpportunity,
    totalProfit: arbitrageCalculationResult.totalProfit
  };

  // Update parent component with arbitrage data whenever it changes
  useEffect(() => {
    if (onArbitrageUpdate) {
      const updateData = {
        arbitrage_spread: arbitrageData.arbitrageSpread,
        arbitrage_profit_margin: arbitrageData.arbitrageSpread ? arbitrageData.arbitrageSpread * 100 : null,
        is_arbitrage_opportunity: arbitrageData.isArbitrageOpportunity,
        arbitrage_total_profit: arbitrageData.totalProfit
      };
      
      // Only update if the data has actually changed
      const currentSpread = match.arbitrage_spread;
      const currentMargin = match.arbitrage_profit_margin;
      const currentOpportunity = match.is_arbitrage_opportunity;
      
      if (currentSpread !== updateData.arbitrage_spread || 
          currentMargin !== updateData.arbitrage_profit_margin || 
          currentOpportunity !== updateData.is_arbitrage_opportunity ||
          match.arbitrage_total_profit !== updateData.arbitrage_total_profit) {
        console.log(`Updating arbitrage for match ${match.id}: ${updateData.arbitrage_spread} (${(updateData.arbitrage_spread! * 100).toFixed(1)}%)`);
        onArbitrageUpdate(match.id, updateData);
      }
    }
  }, [arbitrageData.arbitrageSpread, arbitrageData.isArbitrageOpportunity, arbitrageData.totalProfit, match.id, onArbitrageUpdate, match.arbitrage_spread, match.arbitrage_profit_margin, match.is_arbitrage_opportunity, match.arbitrage_total_profit]);

  // Don't render if we don't have valid data for arbitrage calculations
  if (arbitrageData.arbitrageSpread === null) {
    return (
      <div className="w-[120px] text-right text-gray-500">
        <div className="text-xs">No data</div>
      </div>
    );
  }

  return (
    <div className="w-[120px] text-right">
        {arbitrageData.isArbitrageOpportunity ? (
          <div className="space-y-1">
            <div className="text-xs text-green-400 font-medium">
              ARBITRAGE!
            </div>
            <div className="text-xs text-green-300">
              +{(arbitrageData.arbitrageSpread! * 100).toFixed(1)}%
            </div>
            <div className="text-xs text-green-200 font-medium">
              ${arbitrageData.totalProfit?.toFixed(2) || '0'}
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="text-xs text-gray-500">
              No arb
            </div>
            <div className="text-xs text-gray-400">
              {(arbitrageData.arbitrageSpread! * 100).toFixed(1)}%
            </div>
            <div className="text-xs text-gray-400">
              ${arbitrageData.totalProfit?.toFixed(2) || '0'}
            </div>
          </div>
        )}
    </div>
  );
}
