// Kalshi WebSocket Types
export interface KalshiWebSocketResponse {
  type: string;
  sid: number;
  seq: number;
  msg: any;
}

export interface KalshiOrderBookSnapshot {
  type: 'orderbook_snapshot';
  sid: number;
  seq: number;
  msg: {
    market_ticker: string;
    yes: Array<[number, number]>; // [price, size]
    no: Array<[number, number]>;  // [price, size]
  };
}

export interface KalshiOrderBookDelta {
  type: 'orderbook_delta';
  sid: number;
  seq: number;
  msg: {
    market_ticker: string;
    price: number;
    delta: number;
    side: 'yes' | 'no';
  };
}

export type KalshiOrderBookMessage = KalshiOrderBookSnapshot | KalshiOrderBookDelta;

export interface KalshiMarketMessage {
  type: 'market';
  market_ticker: string;
  status: string;
  [key: string]: any;
}

export interface KalshiTradeMessage {
  type: 'trade';
  market_ticker: string;
  outcome: 'Yes' | 'No';
  price: number;
  size: number;
  timestamp: number;
}

export interface KalshiWebSocketEventHandlers {
  onConnect?: () => void;
  onDisconnect?: (code: number, reason: string) => void;
  onError?: (error: Error) => void;
  onMessage?: (message: KalshiWebSocketResponse) => void;
  onOrderBookUpdate?: (message: KalshiOrderBookMessage) => void;
  onMarketUpdate?: (message: KalshiMarketMessage) => void;
  onTradeUpdate?: (message: KalshiTradeMessage) => void;
}

// Type guards
export function isKalshiOrderBookSnapshot(message: any): message is KalshiOrderBookSnapshot {
  return message && message.type === 'orderbook_snapshot' && message.msg;
}

export function isKalshiOrderBookDelta(message: any): message is KalshiOrderBookDelta {
  return message && message.type === 'orderbook_delta' && message.msg;
}

export function isKalshiOrderBookMessage(message: any): message is KalshiOrderBookMessage {
  return isKalshiOrderBookSnapshot(message) || isKalshiOrderBookDelta(message);
}

export function isKalshiMarketMessage(message: any): message is KalshiMarketMessage {
  return message && message.type === 'market';
}

export function isKalshiTradeMessage(message: any): message is KalshiTradeMessage {
  return message && message.type === 'trade';
}

// Helper function to parse Kalshi orderbook snapshot into OrderBookContext format
export function parseKalshiOrderBookSnapshot(message: KalshiOrderBookSnapshot): {
  yesBids: Array<{ price: number; size: number; side: 'bid' }>;
  yesAsks: Array<{ price: number; size: number; side: 'ask' }>;
  noBids: Array<{ price: number; size: number; side: 'bid' }>;
  noAsks: Array<{ price: number; size: number; side: 'ask' }>;
} {
  // Convert price arrays to orderbook format
  // Kalshi prices are in cents (0-100), we need to convert to decimal (0-1)
  
  // Add null checks for the arrays
  const yesArray = message.msg.yes || [];
  const noArray = message.msg.no || [];
  
  // DEBUG: Log the raw arrays to understand the structure
  console.log('🔍 PARSING FUNCTION - Raw arrays:', {
    ticker: message.msg.market_ticker,
    yesArray: yesArray, // These are NO token asks
    noArray: noArray,   // These are YES token asks
    yesArrayLength: yesArray.length,
    noArrayLength: noArray.length,
    fullMessage: message.msg
  });
  
  // Kalshi data structure: [price_in_cents, size] pairs
  // IMPORTANT: The yes/no arrays contain ASK orders, but they're mapped differently:
  // - "yes" array contains ASK orders for the NO token (people selling NO tokens)
  // - "no" array contains ASK orders for the YES token (people selling YES tokens)
  // Kalshi doesn't provide bid orders in the orderbook snapshot
  
  // Sort by price (ascending for asks - lowest ask first)
  const sortedYes = yesArray.sort((a, b) => a[0] - b[0]);
  const sortedNo = noArray.sort((a, b) => a[0] - b[0]);
  
  // Map the data correctly:
  // - yesArray (NO token asks) -> noAsks
  // - noArray (YES token asks) -> yesAsks
  // Convert ask prices to market probabilities (inverse)
  const yesAsks = sortedNo.map(([price, size]) => ({
    price: 1 - (price / 100), // Convert cents to decimal, then invert to market probability
    size: size,
    side: 'ask' as const
  }));

  const noAsks = sortedYes.map(([price, size]) => ({
    price: 1 - (price / 100), // Convert cents to decimal, then invert to market probability
    size: size,
    side: 'ask' as const
  }));

  // Kalshi doesn't provide bid orders in the snapshot, so we create empty arrays
  const yesBids: Array<{ price: number; size: number; side: 'bid' }> = [];
  const noBids: Array<{ price: number; size: number; side: 'bid' }> = [];

  return { yesBids, yesAsks, noBids, noAsks };
}
