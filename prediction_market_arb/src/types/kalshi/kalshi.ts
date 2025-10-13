export interface KalshiMarket {
  ticker: string;
  event_ticker: string;
  market_type: string;
  title: string;
  subtitle: string;
  yes_sub_title: string;
  no_sub_title: string;
  open_time: string; // ISO date
  close_time: string; // ISO date
  expected_expiration_time: string; // ISO date
  expiration_time: string; // ISO date
  latest_expiration_time: string; // ISO date
  settlement_timer_seconds: number;
  status: string;
  response_price_units: string;
  notional_value: number;
  notional_value_dollars: number[];
  tick_size: number;
  yes_bid: number;
  yes_bid_dollars: number[];
  yes_ask: number;
  yes_ask_dollars: number[];
  no_bid: number;
  no_ask: number;
  no_bid_dollars: number[];
  no_ask_dollars: number[];
  last_price: number;
  last_price_dollars: number[];
  previous_yes_bid: number;
  previous_yes_bid_dollars: number[];
  previous_yes_ask: number;
  previous_yes_ask_dollars: number[];
  previous_price: number;
  previous_price_dollars: number[];
  volume: number;
  volume_24h: number;
  liquidity: number;
  liquidity_dollars: number[];
  open_interest: number;
  result: string;
  can_close_early: boolean;
  expiration_value: string;
  category: string;
  risk_limit_cents: number;
  rules_primary: string;
  rules_secondary: string;
  settlement_value: number;
  settlement_value_dollars: string;
  yes_topbook_liquidity_dollars: number[];
  no_topbook_liquidity_dollars: number[];
  early_close_condition: string;
}

export interface KalshiEvent {
  category: string;
  collateral_return_type: string;
  event_ticker: string;
  markets: KalshiMarket[];
  mutually_exclusive: boolean;
  price_level_structure: string;
  series_ticker: string;
  strike_date: any;
  strike_period: string;
  sub_title: string;
  title: string;
}

export interface KalshiMarketsResponse {
  cursor?: string;
  markets: KalshiMarket[];
}

export interface KalshiEventsResponse {
  cursor?: string;
  events: KalshiEvent[];
}

export interface KalshiMarketFilters {
  event_ticker?: string;
  series_ticker?: string;
  max_close_ts?: number;
  min_close_ts?: number;
  status?: string; // Comma-separated list: 'unopened', 'open', 'closed', 'settled'
  tickers?: string; // Comma-separated list of market tickers
}
