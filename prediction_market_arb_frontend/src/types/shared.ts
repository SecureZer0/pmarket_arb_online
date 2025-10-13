/**
 * Shared Types for the entire application
 * These types are used across WebSocket, Context, and Components
 */

export interface OrderBookLevel {
  price: number;
  size: number;
  side: 'bid' | 'ask';
}

export interface OrderBookSummary {
  price: string | number;
  size: string | number;
}
