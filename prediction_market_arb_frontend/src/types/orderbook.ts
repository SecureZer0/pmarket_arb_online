/**
 * OrderBook Context Types
 * Types specific to the OrderBookContext and related functionality
 */

import { OrderBookLevel, OrderBookSummary } from './shared';

// ============================================================================
// STATE INTERFACES
// ============================================================================

export interface MarketOrderBook {
  bids: Map<number, OrderBookLevel>;
  asks: Map<number, OrderBookLevel>;
  lastUpdate: number;
}

export interface OrderBookState {
  orderBooks: Record<string, MarketOrderBook>;
  isConnected: boolean;
  lastUpdate: number;
}

// ============================================================================
// ACTION TYPES
// ============================================================================

export type OrderBookAction = 
  | { type: 'SET_ORDER_BOOK'; marketId: string; clobId: string; bids: OrderBookSummary[]; asks: OrderBookSummary[]; timestamp?: number }
  | { type: 'UPDATE_ORDER_BOOK'; marketId: string; clobId: string; bids: OrderBookLevel[]; asks: OrderBookLevel[] }
  | { type: 'SET_CONNECTION_STATUS'; isConnected: boolean }
  | { type: 'CLEAR_ORDER_BOOKS' };

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface SetOrderBookParams {
  marketId: string;
  clobId: string;
  bids: OrderBookSummary[];
  asks: OrderBookSummary[];
  timestamp?: number;
}

export interface UpdateOrderBookParams {
  marketId: string;
  clobId: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
}

// ============================================================================
// CONTEXT VALUE TYPE
// ============================================================================

export interface OrderBookContextValue {
  state: OrderBookState;
  dispatch: React.Dispatch<OrderBookAction>;
}
