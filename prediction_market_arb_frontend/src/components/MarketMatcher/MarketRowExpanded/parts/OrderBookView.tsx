import React, { useMemo } from 'react';
import { MarketMatch } from '../../../../types/market';
import { useOrderBookByClobId } from '../../../../contexts/OrderBookContext';

interface Props {
  match: MarketMatch;
}

export default function OrderBookView({ match }: Props) {
  // Resolve clob ids similar to ArbitrageModal
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

  const kalshiYes = kalshiYesClobId ? useOrderBookByClobId(kalshiYesClobId) : null;
  const kalshiNo = kalshiNoClobId ? useOrderBookByClobId(kalshiNoClobId) : null;
  const polyYes = polymarketYesClobId ? useOrderBookByClobId(polymarketYesClobId) : null;
  const polyNo = polymarketNoClobId ? useOrderBookByClobId(polymarketNoClobId) : null;

  return (
    <div className="p-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <OrderBookCard title="Kalshi - Yes" orderbook={kalshiYes} accent="#4ade80" />
        <OrderBookCard title="Polymarket - Yes" orderbook={polyYes} accent="#60a5fa" />
        <OrderBookCard title="Kalshi - No" orderbook={kalshiNo} accent="#4ade80" />
        <OrderBookCard title="Polymarket - No" orderbook={polyNo} accent="#60a5fa" />
      </div>
    </div>
  );
}

function OrderBookCard({ title, orderbook, accent }: { title: string; orderbook: any; accent: string }) {
  const asks = useMemo(() => normalizeSide(orderbook?.asks, true), [orderbook]);
  const bids = useMemo(() => normalizeSide(orderbook?.bids, false), [orderbook]);

  return (
    <div className="border border-[#403F3D] rounded-md">
      <div className="px-3 py-2 border-b border-[#403F3D] text-xs" style={{ color: accent }}>
        {title}
      </div>
      <div className="grid grid-cols-2 gap-0 text-[11px]">
        <div className="p-3">
          <div className="text-[#A1A1A1] mb-2">Asks</div>
          <OBTable rows={asks} />
        </div>
        <div className="p-3 border-l border-[#403F3D]">
          <div className="text-[#A1A1A1] mb-2">Bids</div>
          <OBTable rows={bids} />
        </div>
      </div>
    </div>
  );
}

function OBTable({ rows }: { rows: Array<{ price: number; size: number }> }) {
  return (
    <div className="border border-[#403F3D] rounded">
      <div className="grid grid-cols-2 text-[#A1A1A1] border-b border-[#403F3D]">
        <div className="px-2 py-1">Price</div>
        <div className="px-2 py-1 text-right">Size</div>
      </div>
      <div className="max-h-56 overflow-auto scrollbar-thin">
        {rows.length === 0 && (
          <div className="px-2 py-2 text-[#696969]">No data</div>
        )}
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-2 border-b border-[#403F3D] last:border-b-0">
            <div className="px-2 py-1 text-[#EEEDED]">${r.price.toFixed(3)}</div>
            <div className="px-2 py-1 text-right text-[#EEEDED]">{formatAmount(r.size)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function normalizeSide(mapLike: Map<number, any> | undefined, asc: boolean) {
  if (!mapLike) return [] as Array<{ price: number; size: number }>;
  const entries = Array.from(mapLike.entries()) as [number, any][];
  entries.sort(([a], [b]) => (asc ? a - b : b - a));
  return entries.slice(0, 40).map(([price, level]) => ({ price, size: level.size }));
}

function formatAmount(n: number) {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}


