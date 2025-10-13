# New Markets Table Schema Overview

## 🎯 What Changed

The markets table has been completely redesigned to handle both Kalshi and Polymarket data efficiently while maintaining a clean, readable structure.

## 📊 New Table Structure

### Core Fields (9 columns)
```sql
CREATE TABLE markets (
    id SERIAL PRIMARY KEY,
    platform_id INTEGER NOT NULL REFERENCES platforms(id),
    external_id VARCHAR(255) NOT NULL,
    title VARCHAR(500) NOT NULL,                    -- Unified main market title
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
    
    -- Constraints
    CONSTRAINT markets_platform_external_unique UNIQUE (platform_id, external_id)
);
```

## 🔄 Data Mapping

### Kalshi Markets
- **`title`**: Main market title (e.g., "Trump wins")
- **`close_condition`**: `rules_primary` + `rules_secondary`
- **`platform_data`**: All event context, subtitles, categories, etc.

### Polymarket Markets  
- **`title`**: Main market question (e.g., "Will Trump win the 2024 presidential election?")
- **`close_condition`**: Market description
- **`platform_data`**: Question details, outcome type, etc.

## 💾 JSONB Structure

### Kalshi Platform Data
```json
{
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
  "rules_primary": "If Mark Carney is the first leader...",
  "rules_secondary": "An announcement that a leader will leave..."
}
```

### Polymarket Platform Data
```json
{
  "question": "Will Trump win the 2024 presidential election?",
  "outcome": "binary",
  "description": "This market will resolve based on..."
}
```

## 🚀 Benefits

### ✅ Clean Core Table
- **9 columns** instead of 16+
- **Unified `title` field** for both platforms
- **Fast queries** on essential fields
- **Easy to read** and understand

### ✅ Flexible JSONB
- **Platform-specific data** without schema changes
- **Queryable** when needed
- **No NULL columns** cluttering the table
- **Future-proof** for new platforms

### ✅ Performance
- **Indexed core fields** for fast queries
- **GIN index** on JSONB for complex queries
- **Composite indexes** for common query patterns

## 🔍 Query Examples

### Fast Queries on Core Fields
```sql
-- Find all binary markets
SELECT * FROM markets WHERE outcome_type = 'binary';

-- Find open markets ending soon
SELECT * FROM markets 
WHERE is_open = true AND end_time < '2024-12-31T23:59:59Z';

-- Find markets by title similarity
SELECT * FROM markets WHERE title ILIKE '%Trump%';
```

### Flexible Queries on JSONB
```sql
-- Find Kalshi markets by event category
SELECT * FROM markets 
WHERE platform_id = 2 
  AND platform_data->>'event_category' = 'politics';

-- Find markets with specific event titles
SELECT * FROM markets 
WHERE platform_data->>'event_title' ILIKE '%election%';

-- Complex platform-specific queries
SELECT * FROM markets 
WHERE platform_data->>'market_type' = 'yes_no'
  AND platform_data->>'market_position' = 'yes';
```

## 📁 Files

- **`migrate_markets_table.sql`** - Main migration script
- **`sample_data_insertion.sql`** - Example data insertion
- **`SCHEMA_OVERVIEW.md`** - This documentation

## 🎯 Next Steps

1. **Run the migration script** to recreate the table
2. **Update your ingestion functions** to use the new schema
3. **Test with sample data** to verify everything works
4. **Update matching algorithms** to use the new `title` field

## ⚠️ Important Notes

- **Backup your data** before running the migration
- **Update your TypeScript types** to match the new schema
- **Test thoroughly** with both Kalshi and Polymarket data
- **Consider data migration** if you have existing data
