interface MarketHeaderProps {
  sortBy: 'volume' | 'arbitrage_percent' | 'arbitrage_dollar' | null;
  onSort: (column: 'volume' | 'arbitrage') => void;
}

export default function MarketHeader({ sortBy, onSort }: MarketHeaderProps) {
  return (
    <div className="!z-10 border-b border-[#403F3D] text-[#A1A1A1] pl-[22px] pt-[12px] pb-[8px]">
      <div className="flex justify-between items-center text-[14px] text-medium">
        {/* Left: Markets column */}
        <div className="min-w-[400px] max-w-[900px] mr-6">Markets</div>

        {/* Right: columns aligned with row: Correlations | Volume | Yes / No | Potential Arb */}
        <div className="flex items-center pr-[22px]">
          <div className="w-[186px] text-right mr-0">Correlations</div>
          <div 
            className="min-w-[152px] text-right cursor-pointer hover:text-white transition-colors flex items-center justify-end gap-1"
            onClick={() => onSort('volume')}
          >
            Volume
            {sortBy === 'volume' && (
              <span className="text-xs">↓</span>
            )}
          </div>
          <div className="w-[1px] h-[20px] bg-[#403F3D] mx-[18px]"></div>
          <div className="w-[60px] text-left">Yes / No</div>
          <div 
            className="w-[120px] text-right ml-2 cursor-pointer hover:text-white transition-colors flex items-center justify-end gap-1"
            onClick={() => onSort('arbitrage')}
          >
            Potential Arb
            {sortBy === 'arbitrage_percent' && (
              <span className="text-xs">%</span>
            )}
            {sortBy === 'arbitrage_dollar' && (
              <span className="text-xs">$</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
