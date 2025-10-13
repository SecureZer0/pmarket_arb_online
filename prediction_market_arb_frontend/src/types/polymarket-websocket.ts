/**
 * Polymarket WebSocket Types
 * Based on official documentation: https://docs.polymarket.com/developers/CLOB/websocket/market-channel
 */

import { OrderBookLevel } from './shared';

// ============================================================================
// SUBSCRIPTION MESSAGES (What we send TO the websocket)
// ============================================================================

export interface PolymarketWebSocketSubscription {
  assets_ids: string[];  // Array of asset IDs (token IDs) to subscribe to
  type: 'market';        // Channel type - always 'market' for market data
}

export interface PolymarketWebSocketUserSubscription {
  markets: string[];     // Array of condition IDs for user data
  type: 'user';          // Channel type - always 'user' for user data
  auth: {
    apiKey: string;
    secret: string;
    passphrase: string;
  };
}

// ============================================================================
// MARKET CHANNEL MESSAGES (What we receive FROM the websocket)
// ============================================================================

// Base interface for all market channel messages
export interface PolymarketWebSocketMessage {
  event_type: PolymarketEventType;
  asset_id: string;      // Asset ID (token ID)
  market: string;        // Condition ID of the market
  timestamp: string;     // Unix timestamp in milliseconds
}

// All possible event types
export type PolymarketEventType = 
  | 'book'              // Full orderbook snapshot
  | 'price_change'      // Price level changes
  | 'tick_size_change'; // Tick size changes

// ============================================================================
// BOOK MESSAGE (Full orderbook snapshot)
// ============================================================================

export interface PolymarketBookMessage extends PolymarketWebSocketMessage {
  event_type: 'book';
  hash: string;          // Hash summary of the orderbook content
  bids: OrderSummary[];  // Buy side orderbook levels
  asks: OrderSummary[];  // Sell side orderbook levels
}

export interface OrderSummary {
  price: string;         // Price level (as string)
  size: string;          // Aggregate size available at that price level
}

// ============================================================================
// PRICE CHANGE MESSAGE (Orderbook updates)
// ============================================================================

export interface PolymarketPriceChangeMessage {
  event_type: 'price_change';
  market: string;        // Condition ID of the market
  price_changes: PriceChange[];
  timestamp: string;     // Unix timestamp in milliseconds
}

export interface PriceChange {
  asset_id: string;      // Asset ID (token ID)
  price: string;         // Price level affected
  size: string;          // New aggregate size for the price level
  side: 'BUY' | 'SELL'; // Side of the orderbook
  hash: string;          // Hash summary of the change
  best_bid: string;      // Best bid price
  best_ask: string;      // Best ask price
}

// ============================================================================
// TICK SIZE CHANGE MESSAGE
// ============================================================================

export interface PolymarketTickSizeChangeMessage extends PolymarketWebSocketMessage {
  event_type: 'tick_size_change';
  old_tick_size: string; // Previous minimum tick size
  new_tick_size: string; // Current minimum tick size
  side: 'BUY' | 'SELL';  // Side affected (buy/sell)
}

// ============================================================================
// USER CHANNEL MESSAGES (What we receive for user data)
// ============================================================================

export interface PolymarketUserWebSocketMessage {
  event_type: string;
  data: any;             // User-specific data structure
  timestamp: string;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

// Union type for all possible market channel messages
export type PolymarketMarketMessage = 
  | PolymarketBookMessage
  | PolymarketPriceChangeMessage
  | PolymarketTickSizeChangeMessage;

// Union type for all possible websocket messages
export type PolymarketWebSocketResponse = 
  | PolymarketMarketMessage
  | PolymarketUserWebSocketMessage
  | string[];            // Empty array response (initial connection)

// ============================================================================
// WEBSOCKET CONNECTION TYPES
// ============================================================================

export interface PolymarketWebSocketConfig {
  url: string;
  channels: {
    market: string;
    user: string;
  };
  reconnectInterval: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
}

export interface PolymarketWebSocketStatus {
  isConnected: boolean;
  channel: 'market' | 'user' | null;
  subscribedAssets: string[];
  lastMessageTime: number;
  reconnectAttempts: number;
}

// ============================================================================
// ORDERBOOK DATA STRUCTURE
// ============================================================================

export interface PolymarketOrderBook {
  assetId: string;
  marketId: string;
  timestamp: number;
  hash: string;
  bids: OrderBookLevel[];  // Sorted by price (highest first)
  asks: OrderBookLevel[];  // Sorted by price (lowest first)
  lastUpdate: number;
}

// ============================================================================
// WEBSOCKET EVENT HANDLERS
// ============================================================================

export interface PolymarketWebSocketEventHandlers {
  onBookUpdate?: (message: PolymarketBookMessage) => void;
  onPriceChange?: (message: PolymarketPriceChangeMessage) => void;
  onTickSizeChange?: (message: PolymarketTickSizeChangeMessage) => void;
  onUserData?: (message: PolymarketUserWebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: (code: number, reason: string) => void;
  onError?: (error: Error) => void;
  onMessage?: (message: PolymarketWebSocketResponse) => void;
}

// ============================================================================
// WEBSOCKET SUBSCRIPTION MANAGEMENT
// ============================================================================

export interface PolymarketWebSocketSubscription {
  assetIds: string[];
  marketIds: string[];
  isActive: boolean;
  subscribedAt: number;
  lastMessageAt: number;
}

// ============================================================================
// WEBSOCKET MESSAGE PARSING
// ============================================================================

export function isPolymarketBookMessage(message: any): message is PolymarketBookMessage {
  return message && message.event_type === 'book';
}

export function isPolymarketPriceChangeMessage(message: any): message is PolymarketPriceChangeMessage {
  return message && message.event_type === 'price_change';
}

export function isPolymarketTickSizeChangeMessage(message: any): message is PolymarketTickSizeChangeMessage {
  return message && message.event_type === 'tick_size_change';
}

export function isPolymarketMarketMessage(message: any): message is PolymarketMarketMessage {
  return message && (
    isPolymarketBookMessage(message) ||
    isPolymarketPriceChangeMessage(message) ||
    isPolymarketTickSizeChangeMessage(message)
  );
}

// ============================================================================
// ORDERBOOK PARSING UTILITIES
// ============================================================================

export function parseOrderBookLevels(levels: OrderSummary[], side: 'bid' | 'ask'): OrderBookLevel[] {
  return levels.map(level => ({
    price: parseFloat(level.price),
    size: parseFloat(level.size),
    side
  })).sort((a, b) => {
    // Bids: highest price first, Asks: lowest price first
    return side === 'bid' ? b.price - a.price : a.price - b.price;
  });
}

export function parsePolymarketBookMessage(message: PolymarketBookMessage): PolymarketOrderBook {
  return {
    assetId: message.asset_id,
    marketId: message.market,
    timestamp: parseInt(message.timestamp),
    hash: message.hash,
    bids: parseOrderBookLevels(message.bids, 'bid'),
    asks: parseOrderBookLevels(message.asks, 'ask'),
    lastUpdate: Date.now()
  };
}
