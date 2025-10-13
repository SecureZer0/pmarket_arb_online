/**
 * database.ts — Core DB row & insert types for market matching (PostgreSQL)
 *
 * Scope: matching only (no live quotes / arbitrage here).
 * Source of truth: the SQL schema you created in `prediction_markets`.
 *
 * Conventions:
 * - All timestamps are ISO strings from TIMESTAMPTZ in UTC (e.g., "2025-08-31T07:56:31Z").
 * - NUMERIC columns are represented as string | number.
 *   - If you use node-postgres defaults, NUMERIC arrives as string. Keep string to avoid precision loss.
 *   - If you register parsers or use a decimal library, you can narrow to number/Decimal.
 * - "Row" = shape returned from DB; "New*" = minimal fields to insert.
 * - For matching, the critical fields are: platform_id, external_id, title, outcome_type, start_time/end_time.
 */

export type UUID = string;
export type PlatformCode = "polymarket" | "kalshi";

/** Outcome type must match across platforms for reliable pairs. */
export type OutcomeType = "binary" | "categorical" | "scalar";

/** How a match was produced — stored in market_matches.method */
export type MatchMethod = "exact" | "trigram" | "token" | "embedding" | "hybrid" | "manual";

/** Lifecycle status for a proposed pairwise match. */
export type MatchStatus = "proposed" | "confirmed" | "rejected";

/** Dimension for the embedding model you choose (1536 for text-embedding-3-small). */
export const EMBEDDING_DIM = 1536;

/* ---------------------------------- */
/*                Tables              */
/* ---------------------------------- */

/**
 * platforms
 * - Small lookup for supported venues.
 * - Seeded with ('polymarket','Polymarket') and ('kalshi','Kalshi').
 */
export interface PlatformRow {
  id: number;
  code: PlatformCode;
  name: string;
}

export interface NewPlatform {
  code: PlatformCode;
  name: string;
}

/**
 * markets
 * - One row per platform market.
 * - `title` is the unified main market title used for matching across platforms.
 * - `close_condition` contains platform-specific close rules (rules_primary/rules_secondary for Kalshi, description for Polymarket).
 * - `platform_data` contains all platform-specific data in JSONB format.
 * - `outcome_type` should be set if known; mismatch is a strong negative in matching.
 * - `start_time`/`end_time` help reject false matches by timeframe.
 */
export interface MarketRow {
  id: number;
  platform_id: number;
  external_id: string; // native platform id/slug
  title: string;       // unified main market title for matching
  url: string | null;
  outcome_type: OutcomeType | null;
  start_time: string | null; // TIMESTAMPTZ → ISO UTC
  end_time: string | null;   // TIMESTAMPTZ → ISO UTC
  close_condition: string | null; // Close condition text
  is_open: boolean;  // Market is open, not archived, not closed, and accepting orders
  created_at: string; // ISO
  updated_at: string; // ISO
  volume: number | string | null; // Market volume
  
  // JSONB for platform-specific data
  platform_data: {
    // Kalshi-specific fields
    event_title?: string;          // "Will Trump win 2024?"
    event_subtitle?: string;       // "Presidential election outcome"
    event_category?: string;       // "politics"
    yes_subtitle?: string;         // "Trump wins"
    no_subtitle?: string;          // "Trump loses"
    event_start_time?: string;     // Event start time
    event_end_time?: string;       // Event end time
    parent_event_id?: string;      // Kalshi event ID
    market_type?: string;          // "yes_no", "categorical"
    market_position?: string;      // "yes", "no", "option_1"
    rules_primary?: string;        // Primary close condition rules
    rules_secondary?: string;      // Secondary close condition rules
    
    // Polymarket-specific fields
    question?: string;             // "Will Trump win the 2024 presidential election?"
    outcome?: string;              // "binary"
    description?: string;          // Market description (close condition)
    clobTokenIds?: string[];      // Asset IDs for websocket subscription
    
    // Any other platform-specific fields
    [key: string]: any;
  } | null;
}

export interface NewMarket {
  platform_id: number;
  external_id: string;
  title: string;
  url?: string | null;
  outcome_type?: OutcomeType | null;
  start_time?: string | null; // ISO
  end_time?: string | null;   // ISO
  close_condition?: string | null;
  is_open?: boolean;  // Market is open, not archived, not closed, and accepting orders
  platform_data?: any; // JSONB platform-specific data
  volume?: number | string | null; // Market volume
}

/**
 * market_name_variants (optional)
 * - Alternative strings that refer to the same market (aliases, abbreviations).
 * - Improves recall for title-based matching; not required if you jump straight to embeddings.
 */
export interface MarketNameVariantRow {
  id: number;
  market_id: number;
  name: string;
  name_clean: string; // normalized like title_clean
  source: string | null; // 'title' | 'alias' | 'derived' | etc.
  created_at: string;    // ISO
}

export interface NewMarketNameVariant {
  market_id: number;
  name: string;
  name_clean: string;
  source?: string | null;
}

/**
 * market_embeddings (optional, requires pgvector)
 * - One vector per market (meaning of title_clean).
 * - Use HNSW index and cosine (or L2) for nearest-neighbor candidate generation.
 */
export interface MarketEmbeddingRow {
  market_id: number;
  model: string;       // e.g., 'text-embedding-3-small'
  embedding: number[]; // length = EMBEDDING_DIM
  created_at: string;  // ISO
}

export interface NewMarketEmbedding {
  market_id: number;
  model: string;
  embedding: number[]; // must match model dimension
}

/**
 * market_matches
 * - Pairwise links between markets across platforms.
 * - UNIQUE on unordered pair (A,B) so you can safely upsert with LEAST/GREATEST.
 * - Write with status='proposed', then elevate to 'confirmed' or 'rejected'.
 * - `score` is your hybrid confidence in [0,1].
 */
export interface MarketMatchRow {
  id: number;
  market_id_a: number;
  market_id_b: number;
  method: MatchMethod;
  score: number | string; // NUMERIC
  status: MatchStatus;
  ai_status: MatchStatus;       // mirrors status semantics
  user_status: MatchStatus;     // mirrors status semantics
  is_inversed: boolean;         // true if outcomes are inversed
  close_condition_score: number | string | null; // NUMERIC
  close_condition_ai_status: MatchStatus;        // AI judgment of close-condition alignment
  notes: string | null;
  created_at: string;        // ISO
}

export interface NewMarketMatch {
  market_id_a: number;
  market_id_b: number;
  method: MatchMethod;
  score: number | string;
  status?: MatchStatus; // default 'proposed'
  ai_status?: MatchStatus;       // default 'proposed'
  user_status?: MatchStatus;     // default 'proposed'
  is_inversed?: boolean;         // default false
  close_condition_score?: number | string | null;
  close_condition_ai_status?: MatchStatus; // default 'proposed'
  notes?: string | null;
}

/**
 * topics (optional; recommended once you add >2 platforms)
 * - Canonical “question” nodes. Multiple markets (from many platforms) can link to a topic.
 * - Simplifies N-way grouping and downstream analytics.
 */
export interface TopicRow {
  id: number;
  canonical_question: string;
  canonical_clean: string;
  category: string | null;
  timeframe: string | null; // PostgreSQL TSRANGE serialized (e.g., "[2025-01-01 00:00:00+00,2025-12-31 23:59:59+00]")
  created_at: string;       // ISO
}

export interface NewTopic {
  canonical_question: string;
  canonical_clean: string;
  category?: string | null;
  timeframe?: string | null;
}

/**
 * topic_links (optional)
 * - Connects a platform market to a canonical topic with a confidence score.
 * - Useful if you want to pivot from “pairwise” to “topic-centric” matching later.
 */
export interface TopicLinkRow {
  market_id: number;
  topic_id: number;
  confidence: number | string; // NUMERIC
  method: string;              // e.g., 'trigram' | 'embedding' | 'hybrid'
  verified: boolean;
  created_at: string;          // ISO
}

export interface NewTopicLink {
  market_id: number;
  topic_id: number;
  confidence: number | string;
  method: string;
  verified?: boolean;
}

/**
 * polymarket_raw (optional)
 * - Store raw platform payloads for audit/debug.
 * - Do not base your matcher directly on this table; ingest into `markets` with normalization.
 */
export interface PolymarketRawRow {
  external_id: string;
  raw: unknown;   // JSONB
  ingested_at: string; // ISO
}

export interface NewPolymarketRaw {
  external_id: string;
  raw: unknown;
}

/* ---------------------------------- */
/*         Matching Pipeline Types    */
/* ---------------------------------- */

/**
 * Candidate pair emitted by your candidate-generation SQL (trigram and/or embeddings),
 * enriched in code for scoring.
 */
export interface CandidatePair {
  market_a_id: number;
  market_b_id: number;

  // Titles for token-based features; keep raw for explainability.
  title_a: string;
  title_b: string;

  // Optional description to help AI adjudication.
  description_a?: string | null;
  description_b?: string | null;

  // Signals from DB
  trigram_sim?: number;       // similarity(a.title_clean, b.title_clean) in [0,1]
  e_dist?: number;            // cosine or L2 distance from pgvector NN query (smaller = closer)

  // Time features (ISO) to compute bonuses/filters
  a_end?: string | null;
  b_end?: string | null;

  // Outcome type match check
  a_outcome_type?: OutcomeType | null;
  b_outcome_type?: OutcomeType | null;
}

/**
 * Output of your hybrid scorer before writing to market_matches.
 */
export interface ScoredPair extends CandidatePair {
  method: MatchMethod; // typically 'hybrid' for blended score
  score: number;       // [0,1]
  status: MatchStatus; // 'proposed' | 'confirmed' | 'rejected'
}

/**
 * Output of batch insertion/update of Polymarket markets
 */
export type PolymarketBatchResult = {
  inserted: number;
  updated: number;
  total: number;
  newExternalIds: string[];
  existingExternalIds: string[];
  newMarkets: NewMarket[];
  existingMarkets: NewMarket[];
  externalIdToId?: Record<string, number>;
};

/**
 * Output of batch insertion/update of Kalshi markets
 */
export type KalshiBatchResult = {
  inserted: number;
  updated: number;
  total: number;
  newExternalIds: string[];
  existingExternalIds: string[];
  newMarkets: NewMarket[];
  existingMarkets: NewMarket[];
  externalIdToId?: Record<string, number>;
};

/* ---------------------------------- */
/*           Helper Notes             */
/* ---------------------------------- */

/**
 * Normalization guidance (for title_clean / name_clean):
 * - lowercase
 * - strip punctuation & extra whitespace
 * - standardize numbers/units (e.g., "$1T" -> "1 trillion usd", "10%" -> "10 percent")
 * - standardize dates to ISO "YYYY-MM-DD"
 * - map synonyms ("u.s." -> "us", "btc" <-> "bitcoin") via a small dictionary
 * - remove stopwords ("will","the","be","by","on","of","in")
 *
 * Matching flow (high level):
 * 1) Generate candidates in SQL using trigram (%) and (optionally) pgvector NN.
 * 2) Compute hybrid score in code: e.g., 0.55*trigram + 0.35*embedding_sim + 0.10*token_jaccard + date bonus.
 * 3) Upsert into market_matches with:
 *    - status='confirmed' for score >= T_high
 *    - status='proposed' for T_mid <= score < T_high (to send to AI adjudication)
 *    - status='rejected' for score < T_low
 * 4) (Optional) After confirmation, create a Topic and link both markets via topic_links.
 *
 * Pair de-dup:
 * - Use the UNIQUE index on (LEAST(market_id_a,market_id_b), GREATEST(...)) to avoid (A,B) vs (B,A) duplicates.
 *
 * Timezone:
 * - Store and compare times in UTC. If you display locally, convert via the client.
 */
