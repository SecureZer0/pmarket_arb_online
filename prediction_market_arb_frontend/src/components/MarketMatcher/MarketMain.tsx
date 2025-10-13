import { MarketMatch } from '../../types/market';
import MarketHeader from './MarketHeader';
import MarketRow from './MarketRow';

interface MarketMainProps {
  matches: MarketMatch[];
  setMatches: React.Dispatch<React.SetStateAction<MarketMatch[]>>;
  loading: boolean;
  error: string | null;
  sortBy: 'volume' | 'arbitrage_percent' | 'arbitrage_dollar' | null;
  onSort: (column: 'volume' | 'arbitrage') => void;
}

export default function MarketMain({ matches, setMatches, loading, error, sortBy, onSort }: MarketMainProps) {
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center ">
        <div className="text-xl text-gray-200">Loading market matches...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-red-400">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <MarketHeader 
        sortBy={sortBy}
        onSort={onSort}
      />
      
      {/* Main Content */}
      <div className="p-0">
        <div className="shadow-xl rounded-lg overflow-hidden ">
          <div className="overflow-x-auto min-w-[1200px]">
            <div className="divide-y divide-[#403F3D]">
              {matches.map((match, index) => (
                <MarketRow 
                  key={match.id} 
                  match={match} 
                  index={index} 
                  matches={matches}
                  setMatches={setMatches}
                />
              ))}
            </div>
          </div>
        </div>

        {matches.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-500">No market matches found</div>
          </div>
        )}

      </div>
    </div>
  );
}
