export interface MarketMatch {
  id: number;
  method: string;
  score: number;
  status: string;
  ai_status: string;
  user_status: string;
  is_inversed: boolean;
  close_condition_score: number | null;
  close_condition_status: string;
  close_condition_ai_status: string;
  close_condition_user_status: string;
  notes: string | null;
  created_at: string;
  
  // Market IDs
  market_id_a: number;
  market_id_b: number;
  
  // Market A details
  market_a_title: string;
  market_a_platform_id: number;
  market_a_external_id: string;
  market_a_url: string | null;
  market_a_outcome_type: string;
  market_a_start_time: string | null;
  market_a_end_time: string | null;
  market_a_close_condition: string | null;
  market_a_is_open: boolean;
  market_a_platform_data: PlatformData | null;
  market_a_volume: number | string | null;
  platform_a_name: string;
  
  // Market B details
  market_b_title: string;
  market_b_platform_id: number;
  market_b_external_id: string;
  market_b_url: string | null;
  market_b_outcome_type: string;
  market_b_start_time: string | null;
  market_b_end_time: string | null;
  market_b_close_condition: string | null;
  market_b_is_open: boolean;
  market_b_platform_data: PlatformData | null;
  market_b_volume: number | string | null;
  platform_b_name: string;
  
  // Volume ranking data for sorting
  market_a_volume_rank: number;
  market_b_volume_rank: number;
  combined_volume_rank: number;
  
  // Arbitrage data for sorting (calculated and attached to the object)
  arbitrage_spread?: number | null;
  arbitrage_profit_margin?: number | null;
  is_arbitrage_opportunity?: boolean;
  arbitrage_total_profit?: number | null;
}

export interface PlatformData {
  // Kalshi-specific fields
  event_title?: string;
  event_subtitle?: string;
  event_category?: string;
  yes_subtitle?: string;
  no_subtitle?: string;
  event_start_time?: string;
  event_end_time?: string;
  parent_event_id?: string;
  market_type?: string;
  market_position?: string;
  rules_primary?: string;
  rules_secondary?: string;
  
  // Polymarket-specific fields
  question?: string;
  outcome?: string;
  description?: string;
  clobTokenIds?: string[];
  
  // Any other platform-specific fields
  [key: string]: any;
}


export interface Market {
  id: number;
  platform_id: number;
  external_id: string;
  title: string;
  url: string | null;
  outcome_type: string;
  start_time: string | null;
  end_time: string | null;
  close_condition: string | null;
  is_open: boolean;
  created_at: string;
  updated_at: string;
  volume: number | string | null;
  platform_data: PlatformData | null;
}

export interface Platform {
  id: number;
  code: string;
  name: string;
}
