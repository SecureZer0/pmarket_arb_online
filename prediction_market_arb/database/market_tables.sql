-- Migration script to recreate markets table with new schema
-- This script drops the existing markets table and creates a new one
--
-- IMPORTANT: When inserting market matches, ensure market_id_a < market_id_b
-- Use this pattern in your application code:
--   market_id_a = Math.min(market1_id, market2_id)
--   market_id_b = Math.max(market1_id, market2_id)


-- Create new markets table with updated schema
CREATE TABLE markets (
    id SERIAL PRIMARY KEY,
    platform_id INTEGER NOT NULL REFERENCES platforms(id),
    external_id VARCHAR(255) NOT NULL,
    title VARCHAR(500) NOT NULL,                    -- Main market title (unified field)
    url VARCHAR(1000),                              -- Market URL
    outcome_type VARCHAR(50),                       -- 'binary', 'categorical', 'scalar'
    start_time TIMESTAMPTZ,                         -- Market start time
    end_time TIMESTAMPTZ,                           -- Market end time
    close_condition TEXT,                           -- Close condition text
    is_open BOOLEAN NOT NULL DEFAULT true,          -- Market status
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- Record creation time
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- Record update time
    -- JSONB for platform-specific data
    platform_data JSONB,

    volume NUMERIC, -- Total Volume of the market

    
    -- Constraints
    CONSTRAINT markets_platform_external_unique UNIQUE (platform_id, external_id)
);

-- Create indexes for performance
CREATE INDEX idx_markets_platform_id ON markets(platform_id);
CREATE INDEX idx_markets_external_id ON markets(external_id);
CREATE INDEX idx_markets_title ON markets(title);
CREATE INDEX idx_markets_outcome_type ON markets(outcome_type);
CREATE INDEX idx_markets_start_time ON markets(start_time);
CREATE INDEX idx_markets_end_time ON markets(end_time);
CREATE INDEX idx_markets_is_open ON markets(is_open);
CREATE INDEX idx_markets_created_at ON markets(created_at);
CREATE INDEX idx_markets_updated_at ON markets(updated_at);

-- Create GIN index for JSONB queries
CREATE INDEX idx_markets_platform_data ON markets USING GIN (platform_data);

-- Create composite indexes for common queries
CREATE INDEX idx_markets_platform_open ON markets(platform_id, is_open);
CREATE INDEX idx_markets_outcome_open ON markets(outcome_type, is_open);
CREATE INDEX idx_markets_time_range ON markets(start_time, end_time);

-- Add comments for documentation
COMMENT ON TABLE markets IS 'Markets from all platforms with unified schema and platform-specific data in JSONB';
COMMENT ON COLUMN markets.title IS 'Main market title - unified field for both Kalshi and Polymarket';
COMMENT ON COLUMN markets.close_condition IS 'Close condition text - rules_primary/rules_secondary for Kalshi, description for Polymarket';
COMMENT ON COLUMN markets.platform_data IS 'JSONB containing platform-specific data like event context, subtitles, etc.';

-- Create trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_markets_updated_at 
    BEFORE UPDATE ON markets 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Recreate dependent tables with proper foreign keys
CREATE TABLE market_name_variants (
    id SERIAL PRIMARY KEY,
    market_id INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    name VARCHAR(500) NOT NULL,
    name_clean VARCHAR(400) NOT NULL,
    source VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_market_name_variants_market_id ON market_name_variants(market_id);
CREATE INDEX idx_market_name_variants_name_clean ON market_name_variants(name_clean);

CREATE TABLE market_embeddings (
    market_id INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    model VARCHAR(100) NOT NULL,
    embedding vector(1536), -- Adjust dimension as needed
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (market_id, model)
);

CREATE INDEX idx_market_embeddings_model ON market_embeddings(model);

CREATE TABLE market_matches (
    id SERIAL PRIMARY KEY,
    market_id_a INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    market_id_b INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    method VARCHAR(50) NOT NULL, -- 'exact', 'trigram', 'token', 'embedding', 'hybrid', 'manual'
    score NUMERIC(5,4) NOT NULL, -- [0.0000, 1.0000]
    status VARCHAR(20) NOT NULL DEFAULT 'proposed', -- 'proposed', 'confirmed', 'rejected'
    ai_status VARCHAR(20) NOT NULL DEFAULT 'proposed', -- mirrors status semantics
    user_status VARCHAR(20) NOT NULL DEFAULT 'proposed', -- mirrors status semantics
    is_inversed BOOLEAN NOT NULL DEFAULT false,
    close_condition_score NUMERIC(5,4),
    close_condition_ai_status VARCHAR(20) NOT NULL DEFAULT 'proposed',
    close_condition_user_status VARCHAR(20) NOT NULL DEFAULT 'proposed',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
        -- Ensure unique unordered pairs
    CONSTRAINT market_matches_unique_pair UNIQUE (market_id_a, market_id_b),
    -- Ensure market_id_a is always less than market_id_b for consistent ordering
    -- This prevents (A,B) and (B,A) duplicates by enforcing consistent ordering
    CONSTRAINT market_matches_ordered_pair CHECK (market_id_a < market_id_b)
);

CREATE INDEX idx_market_matches_market_a ON market_matches(market_id_a);
CREATE INDEX idx_market_matches_market_b ON market_matches(market_id_b);
CREATE INDEX idx_market_matches_status ON market_matches(status);
CREATE INDEX idx_market_matches_score ON market_matches(score);
CREATE INDEX idx_market_matches_method ON market_matches(method);
CREATE INDEX idx_market_matches_ai_status ON market_matches(ai_status);
CREATE INDEX idx_market_matches_user_status ON market_matches(user_status);
CREATE INDEX idx_market_matches_close_condition_user_status ON market_matches(close_condition_user_status);

-- Insert sample data for platforms if they don't exist
INSERT INTO platforms (code, name) VALUES 
    ('polymarket', 'Polymarket'),
    ('kalshi', 'Kalshi')
ON CONFLICT (code) DO NOTHING;

-- Grant permissions (adjust as needed)
-- GRANT ALL PRIVILEGES ON TABLE markets TO your_user;
-- GRANT ALL PRIVILEGES ON TABLE market_name_variants TO your_user;
-- GRANT ALL PRIVILEGES ON TABLE market_embeddings TO your_user;
-- GRANT ALL PRIVILEGES ON TABLE market_matches TO your_user;

-- Verify the new structure
\d markets;
