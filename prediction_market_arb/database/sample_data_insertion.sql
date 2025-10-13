-- Sample data insertion for the new markets table structure
-- This shows how to insert both Kalshi and Polymarket data

-- First, ensure platforms exist
INSERT INTO platforms (code, name) VALUES 
    ('polymarket', 'Polymarket'),
    ('kalshi', 'Kalshi')
ON CONFLICT (code) DO NOTHING;

-- Sample Kalshi market insertion
INSERT INTO markets (
    platform_id,
    external_id,
    title,
    url,
    outcome_type,
    start_time,
    end_time,
    close_condition,
    is_open,
    platform_data
) VALUES (
    (SELECT id FROM platforms WHERE code = 'kalshi'),
    'yes_123',
    'Trump wins',  -- Main market title (unified field)
    'https://kalshi.com/markets/yes_123',
    'binary',
    '2024-01-01T00:00:00Z',
    '2024-11-05T23:59:59Z',
    'If Mark Carney is the first leader among the above to leave office, then the market resolves to Yes.', -- Close condition
    true,
    '{
        "event_title": "Will Trump win 2024?",
        "event_subtitle": "Presidential election outcome",
        "event_category": "politics",
        "yes_subtitle": "Trump wins",
        "no_subtitle": "Trump loses",
        "event_start_time": "2024-01-01T00:00:00Z",
        "event_end_time": "2024-11-05T23:59:59Z",
        "parent_event_id": "event_456",
        "market_type": "yes_no",
        "market_position": "yes",
        "rules_primary": "If Mark Carney is the first leader among the above to leave office, then the market resolves to Yes.",
        "rules_secondary": "An announcement that a leader will leave their position is not sufficient to resolve the Payout Criterion; the individual must actually leave and no longer hold the title."
    }'::jsonb
);

-- Sample Polymarket market insertion
INSERT INTO markets (
    platform_id,
    external_id,
    title,
    url,
    outcome_type,
    start_time,
    end_time,
    close_condition,
    is_open,
    platform_data
) VALUES (
    (SELECT id FROM platforms WHERE code = 'polymarket'),
    'will-trump-win-2024',
    'Will Trump win the 2024 presidential election?',  -- Main market title (unified field)
    'https://polymarket.com/markets/will-trump-win-2024',
    'binary',
    '2024-01-01T00:00:00Z',
    '2024-11-05T23:59:59Z',
    'This market will resolve based on the official results of the 2024 US presidential election.', -- Close condition
    true,
    '{
        "question": "Will Trump win the 2024 presidential election?",
        "outcome": "binary",
        "description": "This market will resolve based on the official results of the 2024 US presidential election."
    }'::jsonb
);

-- Query examples to verify the new structure

-- 1. Find all binary markets
SELECT 
    id,
    platform_id,
    title,
    outcome_type,
    close_condition
FROM markets 
WHERE outcome_type = 'binary';

-- 2. Find Kalshi markets with specific event category
SELECT 
    id,
    title,
    platform_data->>'event_category' as event_category,
    platform_data->>'event_title' as event_title
FROM markets 
WHERE platform_id = (SELECT id FROM platforms WHERE code = 'kalshi')
  AND platform_data->>'event_category' = 'politics';

-- 3. Find markets by title similarity
SELECT 
    id,
    title,
    platform_id,
    close_condition
FROM markets 
WHERE title ILIKE '%Trump%';

-- 4. Find markets with specific close conditions
SELECT 
    id,
    title,
    close_condition,
    platform_data->>'rules_primary' as kalshi_rules
FROM markets 
WHERE close_condition ILIKE '%leave office%';

-- 5. Count markets by platform
SELECT 
    p.name as platform,
    COUNT(*) as market_count
FROM markets m
JOIN platforms p ON m.platform_id = p.id
GROUP BY p.name;

-- 6. Show JSONB structure for a specific market
SELECT 
    id,
    title,
    platform_data
FROM markets 
WHERE external_id = 'yes_123';
