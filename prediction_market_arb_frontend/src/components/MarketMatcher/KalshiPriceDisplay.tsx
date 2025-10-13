import { useOrderBookByClobId } from '../../contexts/OrderBookContext';

interface KalshiPriceDisplayProps {
  ticker: string;
}

export default function KalshiPriceDisplay({ ticker }: KalshiPriceDisplayProps) {
  const yesClobId = `${ticker}_yes`;
  const noClobId = `${ticker}_no`;

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
