import { useState, useEffect } from 'react';
import { useOrderBookByClobId } from '../../contexts/OrderBookContext';

interface PolymarketPriceDisplayProps {
  clobId?: string; // Single Polymarket clobId (asset_id)
  clobTokenIds?: string | string[]; // Alternative: clobTokenIds array or JSON string
  index?: number; // Deprecated when clobTokenIds present; kept for backward compatibility
}

export default function PolymarketPriceDisplay({ 
  clobId, 
  clobTokenIds, 
  index = 0 
}: PolymarketPriceDisplayProps) {
  // Prefer pair display when clobTokenIds provided
  let yesClobId: string | null = null;
  let noClobId: string | null = null;

  if (clobTokenIds) {
    let parsedClobTokenIds: string[];
    if (typeof clobTokenIds === 'string') {
      try {
        parsedClobTokenIds = JSON.parse(clobTokenIds);
      } catch (parseError) {
        console.error('Failed to parse clobTokenIds:', parseError);
        return (
            <div className="text-[14px] leading-[14px] text-[#EEEDED] w-[60px] text-right">
            <div className="text-gray-500">Invalid format</div>
          </div>
        );
      }
    } else if (Array.isArray(clobTokenIds)) {
      parsedClobTokenIds = clobTokenIds;
    } else {
      console.error('Invalid clobTokenIds format:', clobTokenIds);
      return (
        <div className="text-[14px] leading-[14px] text-[#EEEDED] w-[60px] text-right">
          <div className="text-gray-500">Invalid format</div>
        </div>
      );
    }

    if (parsedClobTokenIds.length >= 2) {
      yesClobId = parsedClobTokenIds[0];
      noClobId = parsedClobTokenIds[1];
    } else {
      console.error('Need at least two clobTokenIds for pair display:', parsedClobTokenIds);
      return (
        <div className="text-[14px] leading-[14px] text-[#EEEDED] w-[60px] text-right">
          <div className="text-gray-500">Insufficient tokens</div>
        </div>
      );
    }
  } else if (clobId) {
    // Fallback: show a single orderbook's bid/ask as a pair
    yesClobId = clobId;
    noClobId = clobId;
  } else {
    return (
      <div className="text-[14px] leading-[14px] text-[#EEEDED] w-[60px] text-right">
        <div className="text-gray-500">No clobId</div>
      </div>
    );
  }

  const yesOrderbook = useOrderBookByClobId(yesClobId);
  const noOrderbook = useOrderBookByClobId(noClobId);

  const yesBestAsk = yesOrderbook?.asks && yesOrderbook.asks.size > 0 
    ? Math.min(...Array.from(yesOrderbook.asks.keys()))
    : null;
  const noBestAsk = noOrderbook?.asks && noOrderbook.asks.size > 0 
    ? Math.min(...Array.from(noOrderbook.asks.keys()))
    : null;

  if (!yesOrderbook || !noOrderbook) {
    return (
      <div className="text-[14px] leading-[14px] text-[#EEEDED] w-[60px] text-right">
        <div className="text-gray-500">Fetching..</div>
      </div>
    );
  }

  const yesCents = yesBestAsk !== null ? Math.round(yesBestAsk * 100) : '—';
  const noCents = noBestAsk !== null ? Math.round(noBestAsk * 100) : '—';

  return (
    <div className="text-[14px] leading-[14px] font-normal text-[#EEEDED] w-[60px] text-left">
      <div>
        <span className="text-[#1EBF7D]">{yesCents}¢</span>
        <span className="text-[#403F3D] font-light mx-[2px]">/</span>
        <span className="text-[#FF6467]">{noCents}¢</span>
      </div>
    </div>
  );
}
