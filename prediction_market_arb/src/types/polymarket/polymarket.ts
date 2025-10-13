/**
 * Polymarket Market Data Types
 * Based on actual API response structure
 */

export interface PolymarketMarket {
  id: string;
  question: string;
  conditionId: string;
  slug: string;
  description: string;
  endDate: string;
  startDate: string;
  image: string;
  icon: string;
  active: boolean;
  closed: boolean;
  archived: boolean;
  acceptingOrders: boolean;
  acceptingOrdersTimestamp: string;
  volume: string;
  volumeNum: number;
  liquidity: string;
  liquidityNum: number;
  volume24hr: number;
  volume1wk: number;
  volume1mo: number;
  volume1yr: number;
  outcomes: string; // JSON string
  outcomePrices: string; // JSON string
  lastTradePrice: number;
  bestBid: number;
  bestAsk: number;
  spread: number;
  competitive: number;
  enableOrderBook: boolean;
  orderMinSize: number;
  orderPriceMinTickSize: number;
  negRisk: boolean;
  negRiskMarketID: string;
  negRiskRequestID: string;
  events: PolymarketEvent[];
  clobRewards: PolymarketClobReward[];
  rewardsMinSize: number;
  rewardsMaxSpread: number;
  createdAt: string;
  updatedAt: string;
  new: boolean;
  featured: boolean;
  restricted: boolean;
  approved: boolean;
  ready: boolean;
  funded: boolean;
  cyom: boolean;
  pagerDutyNotificationEnabled: boolean;
  automaticallyActive: boolean;
  clearBookOnStart: boolean;
  pendingDeployment: boolean;
  deploying: boolean;
  rfqEnabled: boolean;
  holdingRewardsEnabled: boolean;
  feesEnabled: boolean;
}

export interface PolymarketEvent {
  id: string;
  ticker: string;
  slug: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  image: string;
  icon: string;
  active: boolean;
  closed: boolean;
  archived: boolean;
  liquidity: number;
  volume: number;
  volume24hr: number;
  volume1wk: number;
  volume1mo: number;
  volume1yr: number;
  negRisk: boolean;
  negRiskMarketID: string;
}

export interface PolymarketClobReward {
  id: string;
  conditionId: string;
  assetAddress: string;
  rewardsAmount: number;
  rewardsDailyRate: number;
  startDate: string;
  endDate: string;
}

export interface PolymarketToken {
  token_id: string;
  outcome: string;
  price: number;
  winner: boolean;
}

export interface PolymarketRewards {
  rates: number | null;
  min_size: number;
  max_spread: number;
}

export interface OrderBookLevel {
  price: number;
  size: number;
  side: 'buy' | 'sell';
}

export interface PolymarketOrder {
  order_id: string;
  market_id: string;
  outcome_id: string;
  side: 'buy' | 'sell';
  size: number;
  price: number;
  status: 'open' | 'filled' | 'cancelled' | 'expired';
  created_at: string;
  updated_at?: string;
  filled_at?: string;
  user_id?: string;
  remaining_size?: number;
  filled_size?: number;
}

export interface PolymarketTrade {
  trade_id: string;
  market_id: string;
  outcome_id: string;
  side: 'buy' | 'sell';
  size: number;
  price: number;
  timestamp: string;
  order_id?: string;
  user_id?: string;
  fee?: number;
  fee_currency?: string;
}

export interface PolymarketPosition {
  market_id: string;
  outcome_id: string;
  size: number; // positive for long, negative for short
  avg_price: number;
  unrealized_pnl: number;
  realized_pnl?: number;
  last_updated: string;
}

export interface WebSocketMessage {
  type: string;
  channel: string;
  data: any;
  timestamp: string;
  sequence?: number;
}

export interface WebSocketSubscription {
  type: 'subscribe' | 'unsubscribe';
  channel: string;
  params?: Record<string, any>;
}

export interface WebSocketPing {
  type: 'ping';
  timestamp: number;
}

export interface WebSocketPong {
  type: 'pong';
  timestamp: number;
}

export interface MarketDataUpdate {
  condition_id: string;
  tokens: PolymarketToken[];
  last_updated: string;
}

export interface TradeUpdate {
  trade: PolymarketTrade;
  market_id: string;
}

export interface OrderUpdate {
  order: PolymarketOrder;
  market_id: string;
}

// API Response types
export interface ApiResponse<T> {
  data: T;
  status: 'success' | 'error';
  message?: string;
  timestamp: string;
}

// Polymarket API specific response wrapper
export interface PolymarketApiResponse<T> {
  data: T;
}

export interface MarketsResponse extends PolymarketApiResponse<PolymarketMarket[]> {}
export interface MarketResponse extends PolymarketApiResponse<PolymarketMarket> {}
export interface TradesResponse extends PolymarketApiResponse<PolymarketTrade[]> {}
export interface OrdersResponse extends PolymarketApiResponse<PolymarketOrder[]> {}

// WebSocket Event types
export interface WebSocketEvents {
  connected: () => void;
  disconnected: (data: { code: number; reason: string }) => void;
  error: (error: Error) => void;
  message: (message: WebSocketMessage) => void;
  market_data: (data: MarketDataUpdate) => void;
  trade: (data: TradeUpdate) => void;
  order_update: (data: OrderUpdate) => void;
  subscription_confirmed: (message: WebSocketMessage) => void;
  pong: () => void;
  max_reconnect_attempts_reached: () => void;
}

// Service status types
export interface WebSocketStatus {
  isConnected: boolean;
  reconnectAttempts: number;
  subscriptions: string[];
  readyState: number | null;
}

export interface MarketDataServiceStatus {
  isInitialized: boolean;
  isConnected: boolean;
  marketsCount: number;
  ordersCount: number;
  tradesCount: number;
  wsStatus: WebSocketStatus;
}

// Configuration types
export interface PolymarketConfig {
  API_BASE_URL: string;
  WS_URL: string;
  ENDPOINTS: {
    MARKETS: string;
    ORDERS: string;
    POSITIONS: string;
    TRADES: string;
  };
  WS_MESSAGE_TYPES: {
    SUBSCRIBE: string;
    UNSUBSCRIBE: string;
    PING: string;
    PONG: string;
  };
  CHANNELS: {
    MARKETS: string;
    ORDERS: string;
    TRADES: string;
    POSITIONS: string;
  };
  CONNECTION: {
    RECONNECT_INTERVAL: number;
    MAX_RECONNECT_ATTEMPTS: number;
    HEARTBEAT_INTERVAL: number;
    CONNECTION_TIMEOUT: number;
  };
}
