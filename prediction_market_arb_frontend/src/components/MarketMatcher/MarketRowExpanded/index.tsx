import { useState, useEffect } from 'react';
import { MarketMatch } from '../../../types/market';
import DetailsView from './parts/DetailsView';
import OrderBookView from './parts/OrderBookView';
import ArbitragePanel from './parts/ArbitragePanel';
import { useOrderBookByClobId } from '../../../contexts/OrderBookContext';
import { calculateArbitrageData } from '../../../utils/arbitrageCalculator';

interface MarketRowExpandedProps {
  match: MarketMatch;
}

type TabKey = 'details' | 'orderbook' | 'arbitrage';

export const MarketRowExpanded: React.FC<MarketRowExpandedProps> = ({ match }) => {
  // Resolve clob ids at the top level
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

  // Call hooks at the top level
  const kalshiYesOrderbook = kalshiYesClobId ? useOrderBookByClobId(kalshiYesClobId) : null;
  const kalshiNoOrderbook = kalshiNoClobId ? useOrderBookByClobId(kalshiNoClobId) : null;
  const polymarketYesOrderbook = polymarketYesClobId ? useOrderBookByClobId(polymarketYesClobId) : null;
  const polymarketNoOrderbook = polymarketNoClobId ? useOrderBookByClobId(polymarketNoClobId) : null;

  // Check for arbitrage opportunity immediately to determine initial tab
  const arbitrageResult = calculateArbitrageData(match, {
    kalshiYesOrderbook,
    kalshiNoOrderbook,
    polymarketYesOrderbook,
    polymarketNoOrderbook
  });

  const hasArbitrage = arbitrageResult.isArbitrageOpportunity && arbitrageResult.arbitrageSpread !== null;
  
  // Initialize with arbitrage tab if opportunity exists, otherwise details
  const [activeTab, setActiveTab] = useState<TabKey>(hasArbitrage ? 'arbitrage' : 'details');

  return (
    <div className="px-[22px] pb-[16px]">
      {/* Tabs header - moved above container */}
      <div className="flex items-center gap-2 mb-0 ml-2">
        <TabButton label="Details" isActive={activeTab === 'details'} onClick={() => setActiveTab('details')} />
        <TabButton label="Order Book" isActive={activeTab === 'orderbook'} onClick={() => setActiveTab('orderbook')} />
        <TabButton label="Arbitrage" isActive={activeTab === 'arbitrage'} onClick={() => setActiveTab('arbitrage')} />
      </div>

      {/* Container */}
      <div className="border border-[#403F3D] rounded-md">
        {/* Body */}
        {activeTab === 'details' && (
          <DetailsView match={match} />
        )}
        {activeTab === 'orderbook' && (
          <OrderBookView match={match} />
        )}
        {activeTab === 'arbitrage' && (
          <ArbitragePanel match={match} />
        )}
      </div>
    </div>
  );
};

function TabButton({ label, isActive, onClick }: { label: string; isActive: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-sm px-3 py-2 relative transition-colors ${
        isActive
          ? 'text-[#EEEDED]'
          : 'text-[#A1A1A1] hover:text-[#EEEDED]'
      }`}
    >
      {label}
      {/* Underline that gets bolder when active */}
      <div 
        className={`absolute bottom-0 left-0 right-0 h-0.5 transition-all duration-200 ${
          isActive 
            ? 'bg-[#EEEDED] h-1' 
            : 'bg-[#403F3D] hover:bg-[#EEEDED]/50'
        }`}
      />
    </button>
  );
}

export default MarketRowExpanded;


