import React, { useEffect, useState } from 'react';
import { MarketMatch } from '../../../../types/market';
import { useOrderBookByClobId } from '../../../../contexts/OrderBookContext';
import { calculateArbitrageData } from '../../../../utils/arbitrageCalculator';

interface Props {
  match: MarketMatch;
}

// Embed the ArbitrageModal content inline by rendering it "open" and preventing the overlay
export default function ArbitragePanel({ match }: Props) {
  interface DetailedArbitrageData {
    kalshiYesPrice: number | null;
    polymarketNoPrice: number | null;
    kalshiNoPrice: number | null;
    polymarketYesPrice: number | null;
    arbitrageSpread: number | null;
    maxArbitrageAmount: number | null;
    kalshiYesLiquidity: number;
    polymarketNoLiquidity: number;
    kalshiNoLiquidity: number;
    polymarketYesLiquidity: number;
    isArbitrageOpportunity: boolean;
    totalCost: number | null;
    potentialProfit: number | null;
    profitMargin: number | null;
    kalshiYesPolymarketNoDepth: { amount: number; avgPrice: number; totalProfit: number };
    polymarketYesKalshiNoDepth: { amount: number; avgPrice: number; totalProfit: number };
    polymarketNoKalshiYesDepth: { amount: number; avgPrice: number; totalProfit: number };
    kalshiNoPolymarketYesDepth: { amount: number; avgPrice: number; totalProfit: number };
  }

  // Resolve clob ids
  const kalshiYesClobId = match.platform_a_name?.toLowerCase().includes('kalshi') && match.market_a_external_id
    ? `${match.market_a_external_id}_yes`
    : null;
  const kalshiNoClobId = match.platform_a_name?.toLowerCase().includes('kalshi') && match.market_a_external_id
    ? `${match.market_a_external_id}_no`
    : null;
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

  const kalshiYesOrderbook = kalshiYesClobId ? useOrderBookByClobId(kalshiYesClobId) : null;
  const kalshiNoOrderbook = kalshiNoClobId ? useOrderBookByClobId(kalshiNoClobId) : null;
  const polymarketYesOrderbook = polymarketYesClobId ? useOrderBookByClobId(polymarketYesClobId) : null;
  const polymarketNoOrderbook = polymarketNoClobId ? useOrderBookByClobId(polymarketNoClobId) : null;

  // Calculate arbitrage data immediately instead of in useEffect
  const arbitrageCalculationResult = calculateArbitrageData(match, {
    kalshiYesOrderbook,
    kalshiNoOrderbook,
    polymarketYesOrderbook,
    polymarketNoOrderbook
  });

  // Convert to the format expected by this component
  const arbitrageData: DetailedArbitrageData = {
    kalshiYesPrice: arbitrageCalculationResult.kalshiYesPrice,
    polymarketNoPrice: arbitrageCalculationResult.polymarketNoPrice,
    kalshiNoPrice: arbitrageCalculationResult.kalshiNoPrice,
    polymarketYesPrice: arbitrageCalculationResult.polymarketYesPrice,
    arbitrageSpread: arbitrageCalculationResult.arbitrageSpread,
    maxArbitrageAmount: arbitrageCalculationResult.maxArbitrageAmount,
    kalshiYesLiquidity: arbitrageCalculationResult.kalshiYesLiquidity,
    polymarketNoLiquidity: arbitrageCalculationResult.polymarketNoLiquidity,
    kalshiNoLiquidity: arbitrageCalculationResult.kalshiNoLiquidity,
    polymarketYesLiquidity: arbitrageCalculationResult.polymarketYesLiquidity,
    isArbitrageOpportunity: arbitrageCalculationResult.isArbitrageOpportunity,
    totalCost: arbitrageCalculationResult.totalCost,
    potentialProfit: arbitrageCalculationResult.potentialProfit,
    profitMargin: arbitrageCalculationResult.profitMargin,
    kalshiYesPolymarketNoDepth: arbitrageCalculationResult.kalshiYesPolymarketNoDepth,
    polymarketYesKalshiNoDepth: arbitrageCalculationResult.polymarketYesKalshiNoDepth,
    polymarketNoKalshiYesDepth: arbitrageCalculationResult.polymarketNoKalshiYesDepth,
    kalshiNoPolymarketYesDepth: arbitrageCalculationResult.kalshiNoPolymarketYesDepth
  };

  // Don't render if we don't have valid data for arbitrage calculations
  if (arbitrageData.arbitrageSpread === null) {
    return (
      <div className="p-4 text-[#A1A1A1] text-sm">No valid arbitrage data available</div>
    );
  }

  const isKalshiYesPolymarketNo = arbitrageData.arbitrageSpread === 1.0 - ((arbitrageData.kalshiYesPrice ?? 0) + (arbitrageData.polymarketNoPrice ?? 0));
  const isPolymarketYesKalshiNo = arbitrageData.arbitrageSpread === 1.0 - ((arbitrageData.polymarketYesPrice ?? 0) + (arbitrageData.kalshiNoPrice ?? 0));

  return (
    <div className="p-4">
      <div className="space-y-4">
        {/* Arbitrage Opportunity and Arbitrage Rules - Side by Side */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Arbitrage Opportunity */}
          <div className="flex-1 border-r-1 border-[#EEEDED]/30">
            <div className=" text-[16px] leading-[16px] font-semibold text-[#EEEDED] mb-4">Arbitrage Available!</div>
            {arbitrageData.isArbitrageOpportunity ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-[#737372] mb-1">Spread</div>
                    <div className="text-green-400 font-mono text-sm">+{(arbitrageData.arbitrageSpread! * 100).toFixed(2)}%</div>
                  </div>
                  <div>
                    <div className="text-[#737372] mb-1">Potential Profit</div>
                    <div className="text-green-400 font-mono text-sm">${arbitrageData.potentialProfit?.toFixed(2) || 'N/A'} ({arbitrageData.profitMargin?.toFixed(2) || 'N/A'}%)</div>
                  </div>
                  <div>
                    <div className="text-[#737372] mb-1">Max Investment</div>
                    <div className="text-[#EEEDED] font-mono text-sm">${(() => {
                      const maxAmount = arbitrageData.maxArbitrageAmount || 0;
                      let totalInvestment = 0;
                      
                      if (isKalshiYesPolymarketNo) {
                        totalInvestment = maxAmount * (arbitrageData.kalshiYesPrice || 0) + maxAmount * (arbitrageData.polymarketNoPrice || 0);
                      } else if (isPolymarketYesKalshiNo) {
                        totalInvestment = maxAmount * (arbitrageData.polymarketYesPrice || 0) + maxAmount * (arbitrageData.kalshiNoPrice || 0);
                      }
                      
                      return totalInvestment.toFixed(2);
                    })()}</div>
                  </div>
                  <div>
                    <div className="text-[#737372] mb-1">Est. APR</div>
                    <div className="text-green-400 font-mono text-sm">{(() => {
                      // Get the market end date (use the later of the two markets)
                      const kalshiEndDate = match.market_a_end_time ? new Date(match.market_a_end_time) : null;
                      const polymarketEndDate = match.market_b_end_time ? new Date(match.market_b_end_time) : null;
                      
                      let endDate = null;
                      if (kalshiEndDate && polymarketEndDate) {
                        endDate = kalshiEndDate > polymarketEndDate ? kalshiEndDate : polymarketEndDate;
                      } else if (kalshiEndDate) {
                        endDate = kalshiEndDate;
                      } else if (polymarketEndDate) {
                        endDate = polymarketEndDate;
                      }
                      
                      if (!endDate || !arbitrageData.profitMargin) return 'N/A';
                      
                      const today = new Date();
                      const daysToExpiry = Math.max(1, Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
                      const annualizedReturn = (arbitrageData.profitMargin / 100) * (365 / daysToExpiry) * 100;
                      
                      return `${annualizedReturn.toFixed(1)}%`;
                    })()}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs mt-3">
                  <div>
                    <div className="text-[#737372] mb-1">Kalshi Maturity</div>
                    <div className="text-[#EEEDED] font-mono text-sm">{match.market_a_end_time ? new Date(match.market_a_end_time).toLocaleDateString() : 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-[#737372] mb-1">Poly Maturity</div>
                    <div className="text-[#EEEDED] font-mono text-sm">{match.market_b_end_time ? new Date(match.market_b_end_time).toLocaleDateString() : 'N/A'}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#737372] rounded-full"></div>
                  <span className="text-[#737372] text-sm">No Arbitrage</span>
                </div>
                <div className="text-xs text-[#737372]">Spread: {(arbitrageData.arbitrageSpread! * 100).toFixed(2)}%</div>
              </div>
            )}
          </div>

          {/* Vertical Line Divider */}
          {/* <div className="hidden lg:block border-l-2 border-[#EEEDED]/60 h-full"></div> */}

          {/* Liquidity Analysis */}
          <div className="flex-1">
            {/* <div className="text-sm font-semibold text-[#EEEDED] mb-4">Liquidity Analysis</div> */}
            <div className="space-y-2 text-xs">
              <div className="text-[#737372]">
                <span className="text-sm font-semibold text-[#EEEDED] mb-4">Available Liquidity:</span>
              </div>
              <div className="ml-2 space-y-1">
                <div className="text-[#EEEDED]">
                  {isKalshiYesPolymarketNo ? 'Kalshi Yes' : 'Polymarket Yes'}: {isKalshiYesPolymarketNo ? arbitrageData.kalshiYesPolymarketNoDepth.amount.toLocaleString() : arbitrageData.polymarketYesKalshiNoDepth.amount.toLocaleString()} available
                </div>
                <div className="text-[#EEEDED]">
                  {isKalshiYesPolymarketNo ? 'Polymarket No' : 'Kalshi No'}: {isKalshiYesPolymarketNo ? arbitrageData.polymarketNoKalshiYesDepth.amount.toLocaleString() : arbitrageData.kalshiNoPolymarketYesDepth.amount.toLocaleString()} available
                </div>
                <div className="text-yellow-400">
                  {isKalshiYesPolymarketNo 
                    ? (arbitrageData.kalshiYesPolymarketNoDepth.amount <= arbitrageData.polymarketNoKalshiYesDepth.amount
                        ? `Kalshi Yes is constraining (${arbitrageData.kalshiYesPolymarketNoDepth.amount.toLocaleString()} ≤ ${arbitrageData.polymarketNoKalshiYesDepth.amount.toLocaleString()})`
                        : `Polymarket No is constraining (${arbitrageData.polymarketNoKalshiYesDepth.amount.toLocaleString()} ≤ ${arbitrageData.kalshiYesPolymarketNoDepth.amount.toLocaleString()})`)
                    : (arbitrageData.polymarketYesKalshiNoDepth.amount <= arbitrageData.kalshiNoPolymarketYesDepth.amount
                        ? `Polymarket Yes is constraining (${arbitrageData.polymarketYesKalshiNoDepth.amount.toLocaleString()} ≤ ${arbitrageData.kalshiNoPolymarketYesDepth.amount.toLocaleString()})`
                        : `Kalshi No is constraining (${arbitrageData.kalshiNoPolymarketYesDepth.amount.toLocaleString()} ≤ ${arbitrageData.polymarketYesKalshiNoDepth.amount.toLocaleString()})`)
                  }
                </div>
              </div>
              
              {/* Profit Analysis */}
              <div className="mt-3 pt-2 border-t border-[#EEEDED]/20">
                <div className="text-sm font-semibold text-[#EEEDED] mb-2">
                  Profit Analysis
                </div>
                <div className="ml-2 space-y-1">
                  <div className="text-[#EEEDED]">
                    Naive profit (best prices): ${(() => {
                      const totalCost = isKalshiYesPolymarketNo 
                        ? (arbitrageData.kalshiYesPrice! + arbitrageData.polymarketNoPrice!)
                        : (arbitrageData.polymarketYesPrice! + arbitrageData.kalshiNoPrice!);
                      const profitPerUnit = 1.0 - totalCost;
                      const naiveProfit = profitPerUnit * (arbitrageData.maxArbitrageAmount || 0);
                      return naiveProfit.toFixed(2);
                    })()}
                  </div>
                  <div className="text-green-400">
                    Actual profit (with price progression): ${arbitrageData.potentialProfit?.toFixed(2) || '0.00'}
                  </div>
                  <div className="text-orange-400">
                    Degradation: {(() => {
                      const totalCost = isKalshiYesPolymarketNo 
                        ? (arbitrageData.kalshiYesPrice! + arbitrageData.polymarketNoPrice!)
                        : (arbitrageData.polymarketYesPrice! + arbitrageData.kalshiNoPrice!);
                      const profitPerUnit = 1.0 - totalCost;
                      const naiveProfit = profitPerUnit * (arbitrageData.maxArbitrageAmount || 0);
                      const actualProfit = arbitrageData.potentialProfit || 0;
                      return naiveProfit > 0 ? (((naiveProfit - actualProfit) / naiveProfit) * 100).toFixed(1) : '0.0';
                    })()}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Line Divider */}
        <div className="border-t border-[#EEEDED]/30"></div>

        {/* Strategy and Calculations */}
        <div>
          {/* <div className="text-sm font-semibold text-[#EEEDED] mb-4">Arbitrage Calculations</div> */}
          <div className="text-xs space-y-2">
            {isKalshiYesPolymarketNo ? (
              <CalcBlock
                directionLabel="Kalshi Yes + Polymarket No"
                priceA={arbitrageData.kalshiYesPrice!}
                priceB={arbitrageData.polymarketNoPrice!}
                accentClass="text-green-400"
                maxUnits={arbitrageData.maxArbitrageAmount || 0}
                depthData={arbitrageData.kalshiYesPolymarketNoDepth}
                otherDepthData={arbitrageData.polymarketNoKalshiYesDepth}
                tokenA="Kalshi Yes"
                tokenB="Polymarket No"
              />
            ) : isPolymarketYesKalshiNo ? (
              <CalcBlock
                directionLabel="Polymarket Yes + Kalshi No"
                priceA={arbitrageData.polymarketYesPrice!}
                priceB={arbitrageData.kalshiNoPrice!}
                accentClass="text-blue-400"
                maxUnits={arbitrageData.maxArbitrageAmount || 0}
                depthData={arbitrageData.polymarketYesKalshiNoDepth}
                otherDepthData={arbitrageData.kalshiNoPolymarketYesDepth}
                tokenA="Polymarket Yes"
                tokenB="Kalshi No"
              />
            ) : (
              <div className="text-[#737372]">No profitable arbitrage direction found</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CalcBlock({ 
  directionLabel, 
  priceA, 
  priceB, 
  accentClass, 
  maxUnits, 
  depthData, 
  otherDepthData,
  tokenA, 
  tokenB 
}: { 
  directionLabel: string; 
  priceA: number; 
  priceB: number; 
  accentClass: string; 
  maxUnits: number;
  depthData: { amount: number; avgPrice: number; totalProfit: number };
  otherDepthData: { amount: number; avgPrice: number; totalProfit: number };
  tokenA: string;
  tokenB: string;
}) {
  const totalCost = priceA + priceB;
  const profitPerUnit = 1.0 - totalCost;
  
  // Use the actual profit from depth data, not the naive calculation
  // The actual profit accounts for price progression through the orderbook
  const actualProfit = depthData.amount <= otherDepthData.amount 
    ? depthData.totalProfit 
    : otherDepthData.totalProfit;
  
  // For display purposes, we still want to show the naive calculation for comparison
  const naiveProfit = profitPerUnit * maxUnits;
  
  // Calculate how much of each token to purchase
  const tokenAAmount = maxUnits;
  const tokenBAmount = maxUnits;
  const tokenACost = tokenAAmount * priceA;
  const tokenBCost = tokenBAmount * priceB;
  
  return (
    <div className="space-y-1">
      {/* <div className="text-[#737372]"><span className="font-medium text-[#EEEDED]">Direction:</span> {directionLabel}</div> */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Step 1 */}
        <div className="bg-transparent border border-[#EEEDED]/30 rounded p-2 space-y-2">
          <div className="text-[#737372]"><span className="font-medium text-[#EEEDED]">Step 1:</span> {directionLabel} cost</div>
          <div className="text-[#EEEDED] font-mono ml-2">${priceA.toFixed(3)} + ${priceB.toFixed(3)}</div>
          <div className="text-[#EEEDED] font-mono ml-2">= <span className={accentClass}>${totalCost.toFixed(3)}</span></div>
        </div>
        
        {/* Step 2 */}
        <div className="bg-transparent border border-[#EEEDED]/30 rounded p-2 space-y-2">
          <div className="text-[#737372]"><span className="font-medium text-[#EEEDED]">Step 2:</span> Check arbitrage condition</div>
          <div className="text-[#EEEDED] font-mono ml-2">${totalCost.toFixed(3)} {'<'} $1.000 = <span className={totalCost < 1.0 ? 'text-green-400' : 'text-red-400'}>{totalCost < 1.0 ? 'TRUE ✓' : 'FALSE ✗'}</span></div>
          <div className="text-[#EEEDED] font-mono ml-2">Profit per unit: $1.000 - ${totalCost.toFixed(3)} = <span className={accentClass}>${profitPerUnit.toFixed(3)} ({(profitPerUnit * 100).toFixed(2)}%)</span></div>
        </div>
        
        {/* Step 3 */}
        <div className="bg-transparent border border-[#EEEDED]/30 rounded p-2 space-y-2">
          <div className="text-[#737372]"><span className="font-medium text-[#EEEDED]">Step 3:</span> Calculate profit</div>
          <div className="text-[#EEEDED] font-mono ml-2">Max units: ${maxUnits.toFixed(0)}</div>
          <div className="text-[#EEEDED] font-mono ml-2">Best price profit per unit: ${profitPerUnit.toFixed(3)}</div>
          <div className="text-[#EEEDED] font-mono ml-2">Actual total profit (with price progression): <span className={accentClass}>${actualProfit.toFixed(2)}</span></div>
        </div>
        
        {/* Step 4 */}
        <div className="bg-transparent border border-[#EEEDED]/30 rounded p-2 space-y-2">
          <div className="text-[#737372]"><span className="font-medium text-[#EEEDED]">Step 4:</span> Purchase Instructions</div>
          <div className="text-[#EEEDED] font-mono ml-2">Buy {parseInt(tokenAAmount.toFixed(0)).toLocaleString()} {tokenA.replace('Yes', '$YES').replace('No', '$NO')} for <span className={accentClass}>${parseInt(tokenACost.toFixed(0)).toLocaleString()}</span></div>
          <div className="text-[#EEEDED] font-mono ml-2">Buy {parseInt(tokenBAmount.toFixed(0)).toLocaleString()} {tokenB.replace('Yes', '$YES').replace('No', '$NO')} for <span className={accentClass}>${parseInt(tokenBCost.toFixed(0)).toLocaleString()}</span></div>
          <div className="text-[#EEEDED] font-mono ml-2">Cost <span className={accentClass}>${(() => {
            const totalCost = tokenACost + tokenBCost;
            return totalCost >= 1000 ? `${(totalCost / 1000).toFixed(0)}K` : totalCost.toFixed(2);
          })()}</span> | Profit <span className="text-green-400">${(() => {
            return actualProfit >= 1000 ? `${(actualProfit / 1000).toFixed(0)}K` : actualProfit.toFixed(2);
          })()}</span></div>
        </div>
      </div>
    </div>
  );
}


