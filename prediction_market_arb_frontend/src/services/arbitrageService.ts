import { MarketMatch } from '../types/market';
import { calculateArbitrageSpread } from '../utils/arbitrageCalculator';

export interface ArbitrageUpdate {
  arbitrage_spread: number | null;
  arbitrage_profit_margin: number | null;
  is_arbitrage_opportunity: boolean;
}

/**
 * Centralized arbitrage calculation service
 * This should be the single source of truth for arbitrage calculations
 */
export class ArbitrageService {
  /**
   * Calculate arbitrage data for a market match using orderbook data
   */
  static calculateArbitrageData(
    match: MarketMatch,
    orderbooks: {
      kalshiYesOrderbook?: any;
      kalshiNoOrderbook?: any;
      polymarketYesOrderbook?: any;
      polymarketNoOrderbook?: any;
    }
  ): ArbitrageUpdate {
    const arbitrageSpread = calculateArbitrageSpread(match, orderbooks);
    
    return {
      arbitrage_spread: arbitrageSpread,
      arbitrage_profit_margin: arbitrageSpread ? arbitrageSpread * 100 : null,
      is_arbitrage_opportunity: arbitrageSpread !== null && arbitrageSpread > 0.01 // 1% minimum spread
    };
  }

  /**
   * Update a MarketMatch object with arbitrage data
   */
  static updateMatchWithArbitrageData(match: MarketMatch, arbitrageData: ArbitrageUpdate): MarketMatch {
    return {
      ...match,
      arbitrage_spread: arbitrageData.arbitrage_spread,
      arbitrage_profit_margin: arbitrageData.arbitrage_profit_margin,
      is_arbitrage_opportunity: arbitrageData.is_arbitrage_opportunity
    };
  }

  /**
   * Check if a market match has valid arbitrage data
   */
  static hasValidArbitrageData(match: MarketMatch): boolean {
    return match.arbitrage_spread !== null && match.arbitrage_spread !== undefined;
  }

  /**
   * Check if a market match represents an arbitrage opportunity
   */
  static isArbitrageOpportunity(match: MarketMatch): boolean {
    return match.is_arbitrage_opportunity === true;
  }
}
