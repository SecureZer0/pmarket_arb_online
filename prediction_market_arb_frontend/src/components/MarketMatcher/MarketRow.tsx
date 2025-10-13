import { useState, useCallback } from 'react';
import { MarketMatch } from '../../types/market';
import { AiOutlineOpenAI } from "react-icons/ai";
import { AiOutlineCheckCircle, AiOutlineCloseCircle, AiOutlineClockCircle } from "react-icons/ai";
import { VscSettings } from "react-icons/vsc";
import { MarketRowExpanded } from './MarketRowExpanded';
import { BiUser } from "react-icons/bi";
import PolymarketPriceDisplay from './PolymarketPriceDisplay';
import KalshiPriceDisplay from './KalshiPriceDisplay';
import StatusTooltip from './StatusTooltip';
import ArbitrageOpportunity from './ArbitrageOpportunity';
import UserStatusButtons from './UserStatusButtons';
import { useSettings } from '../../contexts/SettingsContext';

interface MarketRowProps {
  match: MarketMatch;
  index: number;
  matches: MarketMatch[];
  setMatches: React.Dispatch<React.SetStateAction<MarketMatch[]>>;
}

export default function MarketRow({ match, index, matches, setMatches }: MarketRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { editMode } = useSettings();


  // Stable callback to prevent infinite loops
  const handleArbitrageUpdate = useCallback((matchId: number, arbitrageData: {
    arbitrage_spread: number | null;
    arbitrage_profit_margin: number | null;
    is_arbitrage_opportunity: boolean;
    arbitrage_total_profit: number | null;
  }) => {
    setMatches(prevMatches => 
      prevMatches.map(m => 
        m.id === matchId 
          ? { ...m, ...arbitrageData }
          : m
      )
    );
  }, [setMatches]);

  const handleStatusUpdate = async (matchId: number, field: 'user_status' | 'close_condition_user_status', status: 'confirmed' | 'rejected') => {
    try {
      const response = await fetch('/api/update-status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          matchId,
          field,
          status,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      const result = await response.json();
      if (result.success) {
        // Update local state instead of refreshing the page
        setMatches(prevMatches => 
          prevMatches.map(m => 
            m.id === matchId 
              ? { ...m, [field]: status }
              : m
          )
        );
        
        // Also update localStorage cache
        const updatedMatches = matches.map(m => 
          m.id === matchId 
            ? { ...m, [field]: status }
            : m
        );
        localStorage.setItem('marketMatches', JSON.stringify(updatedMatches));
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status. Please try again.');
    }
  };

  return (
    <div className="w-full">
      <div
        className="flex justify-between items-center  transition-opacity cursor-pointer"
        onClick={() => setIsOpen((v) => !v)}
      >
        {/* Index column */}
        
        <div className="p-[22px] flex-shrink-1 overflow-clip mr-6 min-w-[400px] max-w-[900px] flex items-center gap-0">

        <div className="mr-[7px] !h-[28px] !max-h-[28px]  !min-w-[18px] !w-[18px] flex items-center justify-center" data-index={index}>
          <div className="h-[35px] w-full border-t border-l border-b border-[#EEEDED]/60 rounded-tl-md rounded-bl-md" />
        </div>
          <div className="text-[16px] leading-[16px] gap-[17px]  text-[#EEEDED] max-w-full flex flex-col ">
            <div className="font-medium text-[#EEEDED] max-w-full flex items-center gap-2">
              <div className="text-truncate whitespace-nowrap overflow-hidden max-w-full min-w-0">
                {match.market_a_title}
              </div>
              {(() => {
                const a = match.platform_a_name?.toLowerCase() || '';
                const label = a.includes('kalshi') ? 'K' : a.includes('poly') ? 'P' : '';
                return label ? (
                  <span className="bg-transparent text-[#EEEDED] border-[0.5px] border-[#EEEDED] font-light text-[9px] leading-[9px] px-[4px] py-[3px] rounded">
                    {label}
                  </span>
                ) : null;
              })()}
            </div>
            <div className="font-medium text-[#EEEDED] max-w-full flex items-center gap-2">
              <div className="text-truncate whitespace-nowrap overflow-hidden max-w-full min-w-0">
                {match.market_b_title}
              </div>
              {(() => {
                const b = match.platform_b_name?.toLowerCase() || '';
                const label = b.includes('kalshi') ? 'K' : b.includes('poly') ? 'P' : '';
                return label ? (
                  <span className="bg-transparent text-[#EEEDED] border-[0.5px] border-[#EEEDED] font-light text-[9px] leading-[9px] px-[4px] py-[3px] rounded">
                    {label}
                  </span>
                ) : null;
              })()}
            </div>
          </div>
        </div>

        {/* Volume column */}
        

        {/* Right column: icon sections stacked + price display */}
        <div className="flex gap-2 items-center pr-[22px]">

          <div className='flex gap-1 items-center justify-center'>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-0 w-[186px] mr-2">
              <div className="text-[14px] leading-[14px] font-normal text-[#737372] min-w-[84px]">Markets:</div>
              <div className="flex gap-3 items-center">
                <StatusTooltip 
                  title="Algorithmic" 
                  status={match.score < 0.5 ? 'rejected' : match.score <= 0.6 ? 'proposed' : 'confirmed'}
                  score={match.score}
                  position={index === 0 ? 'bottom' : undefined}
                >
                  <VscSettings color={getStatusColor(match.score < 0.5 ? 'rejected' : match.score <= 0.6 ? 'proposed' : 'confirmed', match.score, false)} 
                  size={24} />
                </StatusTooltip>
                <StatusTooltip 
                  title="AI" 
                  status={match.ai_status}
                  position={index === 0 ? 'bottom' : undefined}
                >
                  <AiOutlineOpenAI color={getStatusColor(match.ai_status, null, false)} size={24} />
                </StatusTooltip>
                <StatusTooltip 
                  title="User" 
                  status={match.user_status}
                  position={index === 0 ? 'bottom' : undefined}
                >
                  <BiUser color={getStatusColor(match.user_status, null, true)} size={26} />
                </StatusTooltip>
              </div>
            </div>
            <div className="flex items-center gap-0 w-[186px]">
              <div className="text-[14px] font-normal text-[#737372] min-w-[84px]">Condition:</div>
              <div className="flex gap-3 items-center">
                <StatusTooltip 
                  title="Algorithmic" 
                  status={match.close_condition_score === null || match.close_condition_score === undefined ? 'proposed' : match.close_condition_score <= 0.25 ? 'rejected' : match.close_condition_score <= 0.6 ? 'proposed' : 'confirmed'}
                  score={match.close_condition_score}
                  position={index === 0 ? 'bottom' : undefined}
                >
                  <VscSettings color={getStatusColor(match.close_condition_score === null || match.close_condition_score === undefined ? 'proposed' : match.close_condition_score <= 0.25 ? 'rejected' : match.close_condition_score <= 0.6 ? 'proposed' : 'confirmed', match.close_condition_score, false)} size={24} />
                </StatusTooltip>
                <StatusTooltip 
                  title="AI" 
                  status={match.close_condition_ai_status}
                  position={index === 0 ? 'bottom' : undefined}
                >
                  <AiOutlineOpenAI color={getStatusColor(match.close_condition_ai_status, null, false)} size={24} />
                </StatusTooltip>
                <StatusTooltip 
                  title="User" 
                  status={match.close_condition_user_status}
                  position={index === 0 ? 'bottom' : undefined}
                >
                  <BiUser color={getStatusColor(match.close_condition_user_status, null, true)} size={24} />
                </StatusTooltip>
              </div>
            </div>

            
          </div>

          {editMode && (
            <UserStatusButtons 
              match={match} 
              onStatusUpdate={handleStatusUpdate}
            />
          )}
          </div>

          <div className="flex ">

          <div className="flex items-center">
            <div className="flex flex-col gap-[14px] min-w-[60px] text-[14px] leading-[14px] text-[#C9C9C9] text-right">
              <div className="whitespace-nowrap text-[#696969]">Kalshi:</div>
              <div className="whitespace-nowrap text-[#696969]">Poly:</div>
            </div>
            <div className="flex flex-col gap-[14px] ml-[12px] min-w-[60px] text-[14px] leading-[14px] text-white text-right">
              <div className="whitespace-nowrap">${formatVolume(match.market_a_volume)}</div>
              <div className="whitespace-nowrap">${formatVolume(match.market_b_volume)}</div>
            </div>
          </div>

          <div className="w-[1px] h-[51px] bg-[#403F3D] ml-[18px]"></div>

          {/* Display price pairs vertically, no labels */}
          <div className=" flex flex-col items-end gap-[14px] ml-[18px] h-[42px] my-auto">
            {match.platform_a_name?.toLowerCase().includes('kalshi') && 
             match.market_a_external_id ? (
              <KalshiPriceDisplay ticker={match.market_a_external_id} />
            ) : (
              <div className="text-[14px] text-[#EEEDED] w-[60px] text-right">
                <div className="text-gray-500">No data</div>
              </div>
            )}

            {match.platform_b_name?.toLowerCase().includes('polymarket') && 
             match.market_b_platform_data?.clobTokenIds ? (
              <PolymarketPriceDisplay clobTokenIds={match.market_b_platform_data.clobTokenIds} />
            ) : (
              <div className="text-[14px] text-[#EEEDED] w-[60px] text-right">
                <div className="text-gray-500">No data</div>
              </div>
            )}
          </div>

          </div>

          {/* User Status Buttons - Only show in edit mode */}
          

          {/* Arbitrage Opportunity Display */}
          <ArbitrageOpportunity 
            match={match} 
            onArbitrageUpdate={handleArbitrageUpdate}
          />

          {/* Debug: Show stored arbitrage data used for sorting */}
          {/* <div className="w-[120px] text-right text-yellow-400 border border-yellow-400 rounded p-1 ml-2">
            <div className="text-xs font-bold">DEBUG:</div>
            <div className="text-xs">
              {match.arbitrage_spread !== null && match.arbitrage_spread !== undefined
                ? `${(match.arbitrage_spread * 100).toFixed(1)}%`
                : 'No data'
              }
            </div>
            <div className="text-xs text-yellow-300">
              Stored value
            </div>
          </div> */}

        </div>
      </div>

      {isOpen && (
        <MarketRowExpanded
          match={match}
        />
      )}
    </div>
  );
}
function formatVolume(value: number | string | null | undefined) {
  if (value === null || value === undefined) return '—';
  const num = typeof value === 'string' ? Number(value) : value;
  if (typeof num !== 'number' || Number.isNaN(num)) return String(value);
  const abs = Math.abs(num);
  const format3Digits = (n: number) => {
    const absN = Math.abs(n);
    if (absN < 10) return n.toFixed(2);      // X.XX
    if (absN < 100) return n.toFixed(1);     // XX.X
    return Math.round(n).toString();         // XXX
  };
  const withSuffix = (n: number, suffix: string) => `${format3Digits(n)}${suffix}`;
  if (abs >= 1_000_000_000) return withSuffix(num / 1_000_000_000, 'B');
  if (abs >= 1_000_000) return withSuffix(num / 1_000_000, 'M');
  if (abs >= 1_000) return withSuffix(num / 1_000, 'K');
  return format3Digits(num);
}

function getStatusColor(status: string, score?: number | null, isUserStatus?: boolean) {
  const baseStatus = status.toLowerCase();
  switch (baseStatus) {
    case 'confirmed':
      return '#4ade80'; // green-400
    case 'rejected':
      return '#f87171'; // red-400
    case 'proposed':
      // For user status, always grey
      if (isUserStatus) {
        return '#EEEDED';
      }
      // For algorithmic/AI status, orange if has score, grey if no score
      return (score !== null && score !== undefined && !isNaN(Number(score))) ? '#fb923c' : '#EEEDED'; // orange-400 or grey
    default:
      return 'pink';
  }
}
