import { promises as fs } from 'fs';
import path from 'path';
import { logger } from '../../utils/logger.js';
import { NewMarket, KalshiBatchResult } from '../../types/database/database.js';
import { pool } from '../../predictionMarket_db.js';

/**
 * Extract individual markets from Kalshi events
 * Same logic as in matchingAlgo/matchAllMarkets.ts
 */
function extractMarketsFromEvents(events: any[]): any[] {
  const allMarkets: any[] = [];
  
  for (const event of events) {
    if (event.markets && Array.isArray(event.markets)) {
      event.markets.forEach((market: any) => {
        // Skip markets without a ticker (ID)
        if (!market.ticker) {
          logger.warn(`⚠️ Skipping market without ticker in event ${event.event_ticker}`);
          return;
        }
        
        allMarkets.push({
          ...market,
          eventTitle: event.title,
          eventSubTitle: event.sub_title,
          eventCategory: event.category,
          eventStartTime: event.start_time,
          eventEndTime: event.end_time,
          eventId: event.event_ticker,
          // Add URL construction
          url: `https://kalshi.com/events/${event.event_ticker}`,
          // Use market-specific times
          marketOpenTime: market.open_time,
          marketCloseTime: market.close_time,
          marketExpirationTime: market.expected_expiration_time,
          // Add additional fields needed by matching algorithm
          marketSubtitle: market.subtitle,
          marketCreatedAt: market.created_at || market.open_time,
          marketStartDate: market.start_date || market.open_time,
          marketUpdatedAt: market.updated_at || market.open_time
        });
      });
    }
  }
  
  return allMarkets;
}

/**
 * Prepare market data for database insertion using new schema
 */
function prepareMarketData(market: any): NewMarket {
  // Validate required fields
  if (!market.ticker) {
    throw new Error(`Market missing required ticker field: ${JSON.stringify(market, null, 2)}`);
  }
  
  // Combine event title + subtitle + market title for full context
  let mainTitle = '';
  if (market.eventTitle) mainTitle += market.eventTitle;
  if (market.eventSubTitle) mainTitle += (mainTitle ? ' - ' : '') + market.eventSubTitle;
  if (market.yes_sub_title) mainTitle += (mainTitle ? ' - ' : '') + market.yes_sub_title;
  
  // Fallback if no title was built
  if (!mainTitle) {
    mainTitle = market.no_sub_title || market.title || 'Unknown Market';
  }
  
  // Determine outcome type
  const outcomeType = market.yes_sub_title && market.no_sub_title ? 'binary' : 'categorical';
  
  // Prepare close condition (rules_primary + rules_secondary)
  let closeCondition = '';
  if (market.rules_primary) {
    closeCondition += market.rules_primary;
  }
  if (market.rules_secondary) {
    closeCondition += (closeCondition ? '\n\n' : '') + market.rules_secondary;
  }
  
  // Prepare platform data JSONB
  const platformData = {
    event_title: market.eventTitle,
    event_subtitle: market.eventSubTitle,
    event_category: market.eventCategory,
    yes_subtitle: market.yes_sub_title,
    no_subtitle: market.no_sub_title,
    event_start_time: market.eventStartTime,
    event_end_time: market.eventEndTime,
    parent_event_id: market.eventId,
    market_type: market.yes_sub_title && market.no_sub_title ? 'yes_no' : 'categorical',
    market_position: market.yes_sub_title ? 'yes' : market.no_sub_title ? 'no' : 'option',
    rules_primary: market.rules_primary,
    rules_secondary: market.rules_secondary,
    early_close_condition: market.early_close_condition,
    // Add market-specific times
    market_open_time: market.marketOpenTime,
    market_close_time: market.marketCloseTime,
    market_expiration_time: market.marketExpirationTime,
    // Add URL
    market_url: market.url,
    // Add additional fields needed by matching algorithm
    market_subtitle: market.marketSubtitle,
    market_created_at: market.marketCreatedAt,
    market_start_date: market.marketStartDate,
    market_updated_at: market.marketUpdatedAt
  };
  
  return {
    platform_id: 2, // Kalshi platform ID (you may need to get this from database)
    external_id: market.ticker, // Use ticker as the market ID
    title: mainTitle,
    url: market.url || null,
    outcome_type: outcomeType,
    start_time: market.marketOpenTime || null, // Use market open time
    end_time: market.marketCloseTime || null, // Use market close time
    close_condition: closeCondition || null,
    is_open: ['active', 'open'].includes(market.status), // Only active and open markets are considered open
    platform_data: platformData,
    volume: market.volume || null
  };
}

/**
 * Insert or update a single market in the database
 */
async function upsertMarket(market: NewMarket): Promise<void> {
  try {
    // Check if market already exists
    const existingMarket = await pool.query(
      'SELECT id FROM markets WHERE platform_id = $1 AND external_id = $2',
      [market.platform_id, market.external_id]
    );
    
    if (existingMarket.rows.length > 0) {
      // Update existing market
      await pool.query(`
        UPDATE markets 
        SET 
          title = $1,
          url = $2,
          outcome_type = $3,
          start_time = $4,
          end_time = $5,
          close_condition = $6,
          is_open = $7,
          platform_data = $8,
          volume = $9,
          updated_at = NOW()
        WHERE platform_id = $10 AND external_id = $11
      `, [
        market.title,
        market.url,
        market.outcome_type,
        market.start_time,
        market.end_time,
        market.close_condition,
        market.is_open,
        market.platform_data,
        market.volume,
        market.platform_id,
        market.external_id
      ]);
      
      logger.info(`🔄 Updated existing Kalshi market: ${market.external_id}`);
    } else {
      // Insert new market
      await pool.query(`
        INSERT INTO markets (
          platform_id, external_id, title, url, outcome_type, 
          start_time, end_time, close_condition, is_open, platform_data, volume
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        market.platform_id,
        market.external_id,
        market.title,
        market.url,
        market.outcome_type,
        market.start_time,
        market.end_time,
        market.close_condition,
        market.is_open,
        market.platform_data,
        market.volume
      ]);
      
      logger.info(`✅ Inserted new Kalshi market: ${market.external_id}`);
    }
  } catch (error) {
    logger.error(`❌ Error upserting market ${market.external_id}:`, error);
    throw error;
  }
}

/**
 * Reconcile markets that are open but no longer present in the latest fetch.
 * Marks them as closed (is_open = false).
 */
async function reconcileMissingMarkets(fetchedTickers: string[]): Promise<number> {
  if (!fetchedTickers || fetchedTickers.length === 0) {
    return 0;
  }
  const platformId = 2; // Kalshi
  const result = await pool.query(
    `UPDATE markets
     SET is_open = false, updated_at = NOW()
     WHERE platform_id = $1
       AND is_open = true
       AND external_id <> ALL($2::varchar[])`,
    [platformId, fetchedTickers]
  );
  return result.rowCount ?? 0;
}

/**
 * Main function to process Kalshi events and insert/update markets
 */
export async function insertKalshiMarkets(
  events: any[]
): Promise<{ inserted: number; updated: number; total: number }> {
  logger.info('🚀 Starting Kalshi markets insertion/update...');
  
  try {
    // Extract individual markets from events
    const allMarkets = extractMarketsFromEvents(events);
    logger.info(`📊 Extracted ${allMarkets.length} individual markets from ${events.length} events`);
    
    let inserted = 0;
    let updated = 0;
    
    // Process each market
    for (const market of allMarkets) {
      try {
        const marketData = prepareMarketData(market);
        
        // Check if market exists to track counts
        const existingMarket = await pool.query(
          'SELECT id FROM markets WHERE platform_id = $1 AND external_id = $2',
          [marketData.platform_id, marketData.external_id]
        );
        
        if (existingMarket.rows.length > 0) {
          updated++;
        } else {
          inserted++;
        }
        
        await upsertMarket(marketData);
      } catch (error) {
        logger.error(`❌ Error processing market ${market.id}:`, error);
        // Continue with other markets
      }
    }
    
    // Reconcile: mark markets not in the latest fetch as closed
    const fetchedTickers = allMarkets.map(m => m.ticker).filter(Boolean);
    const closedCount = await reconcileMissingMarkets(fetchedTickers);
    if (closedCount > 0) {
      logger.info(`🧹 Marked ${closedCount} markets as closed (missing from latest fetch)`);
    }
    
    const total = inserted + updated;
    logger.info(`✅ Kalshi markets processing complete!`);
    logger.info(`📊 Inserted: ${inserted}, Updated: ${updated}, Total: ${total}`);
    
    return { inserted, updated, total };
    
  } catch (error) {
    logger.error('❌ Error in Kalshi markets insertion:', error);
    throw error;
  }
}

/**
 * Get platform ID for Kalshi (helper function)
 */
export async function getKalshiPlatformId(): Promise<number> {
  try {
    const result = await pool.query(
      'SELECT id FROM platforms WHERE code = $1',
      ['kalshi']
    );
    
    if (result.rows.length === 0) {
      throw new Error('Kalshi platform not found in database');
    }
    
    return result.rows[0].id;
  } catch (error) {
    logger.error('❌ Error getting Kalshi platform ID:', error);
    throw error;
  }
}

/**
 * Batch insert/update for better performance
 */
export async function batchInsertKalshiMarkets(
  events: any[], 
  batchSize: number = 1000
): Promise<KalshiBatchResult> {
  logger.info('🚀 Starting batch Kalshi markets insertion/update...');
  
  try {
    const allMarkets = extractMarketsFromEvents(events);
    logger.info(`📊 Extracted ${allMarkets.length} individual markets from ${events.length} events`);
    
    let inserted = 0;
    let updated = 0;
    const newExternalIds: string[] = [];
    const existingExternalIds: string[] = [];
    const newMarkets: NewMarket[] = [];
    const existingMarkets: NewMarket[] = [];
    const externalIdToId: Record<string, number> = {};
    
    // Process in batches
    for (let i = 0; i < allMarkets.length; i += batchSize) {
      const batch = allMarkets.slice(i, i + batchSize);
      
      // Prepare batch data
      const batchData = batch.map(market => {
        try {
          return prepareMarketData(market);
        } catch (error) {
          logger.error(`❌ Error preparing market ${market.ticker}:`, error);
          return null;
        }
      }).filter(Boolean) as NewMarket[];
      
      if (batchData.length === 0) continue;
      
      // Batch upsert using ON CONFLICT
      try {
        // Index prepared data by external_id for quick lookup
        const byExternalId = new Map<string, NewMarket>();
        for (const m of batchData) byExternalId.set(m.external_id as string, m);

        const result = await pool.query(`
          INSERT INTO markets (
            platform_id, external_id, title, url, outcome_type, 
            start_time, end_time, close_condition, is_open, platform_data, volume
          ) 
          SELECT * FROM unnest($1::int[], $2::varchar[], $3::varchar[], $4::varchar[], $5::varchar[], $6::timestamptz[], $7::timestamptz[], $8::text[], $9::boolean[], $10::jsonb[], $11::numeric[])
          ON CONFLICT (platform_id, external_id) 
          DO UPDATE SET
            title = EXCLUDED.title,
            url = EXCLUDED.url,
            outcome_type = EXCLUDED.outcome_type,
            start_time = EXCLUDED.start_time,
            end_time = EXCLUDED.end_time,
            close_condition = EXCLUDED.close_condition,
            is_open = EXCLUDED.is_open,
            platform_data = EXCLUDED.platform_data,
            volume = EXCLUDED.volume,
            updated_at = NOW()
          RETURNING id, external_id, (xmax = 0) AS inserted
        `, [
          batchData.map(m => m!.platform_id),
          batchData.map(m => m!.external_id),
          batchData.map(m => m!.title),
          batchData.map(m => m!.url),
          batchData.map(m => m!.outcome_type),
          batchData.map(m => m!.start_time),
          batchData.map(m => m!.end_time),
          batchData.map(m => m!.close_condition),
          batchData.map(m => m!.is_open),
          batchData.map(m => m!.platform_data),
          batchData.map(m => m!.volume)
        ]);
        
        const batchInserted = result.rows.filter((r: any) => r.inserted === true).length;
        const batchUpdated = result.rows.length - batchInserted;
        inserted += batchInserted;
        updated += batchUpdated;

        // Tally arrays
        for (const row of result.rows as any[]) {
          const ext = row.external_id as string;
          const dbId = row.id as number;
          externalIdToId[ext] = dbId;
          const prepared = byExternalId.get(ext);
          if (row.inserted === true) {
            newExternalIds.push(ext);
            if (prepared) newMarkets.push(prepared);
          } else {
            existingExternalIds.push(ext);
            if (prepared) existingMarkets.push(prepared);
          }
        }
        
      } catch (error) {
        logger.error(`❌ Error in batch upsert:`, error);
        // Fallback to individual upserts for this batch
        for (const marketData of batchData) {
          if (marketData) {
            try {
              // Try update first
              const res = await pool.query(
                'UPDATE markets SET title = $1, url = $2, outcome_type = $3, start_time = $4, end_time = $5, close_condition = $6, is_open = $7, platform_data = $8, volume = $9, updated_at = NOW() WHERE platform_id = $10 AND external_id = $11 RETURNING id',
                [
                  marketData.title,
                  marketData.url,
                  marketData.outcome_type,
                  marketData.start_time,
                  marketData.end_time,
                  marketData.close_condition,
                  marketData.is_open,
                  marketData.platform_data,
                  marketData.volume,
                  marketData.platform_id,
                  marketData.external_id
                ]
              );
              if (res.rows.length > 0) {
                updated++;
                existingExternalIds.push(marketData.external_id as string);
                existingMarkets.push(marketData);
                const idRes = await pool.query('SELECT id FROM markets WHERE platform_id = $1 AND external_id = $2', [marketData.platform_id, marketData.external_id]);
                if (idRes.rows[0]?.id) externalIdToId[marketData.external_id as string] = idRes.rows[0].id as number;
              } else {
                await pool.query(
                  'INSERT INTO markets (platform_id, external_id, title, url, outcome_type, start_time, end_time, close_condition, is_open, platform_data, volume) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
                  [
                    marketData.platform_id,
                    marketData.external_id,
                    marketData.title,
                    marketData.url,
                    marketData.outcome_type,
                    marketData.start_time,
                    marketData.end_time,
                    marketData.close_condition,
                    marketData.is_open,
                    marketData.platform_data,
                    marketData.volume
                  ]
                );
                inserted++;
                newExternalIds.push(marketData.external_id as string);
                newMarkets.push(marketData);
                const idRes = await pool.query('SELECT id FROM markets WHERE platform_id = $1 AND external_id = $2', [marketData.platform_id, marketData.external_id]);
                if (idRes.rows[0]?.id) externalIdToId[marketData.external_id as string] = idRes.rows[0].id as number;
              }
            } catch (individualError) {
              logger.error(`❌ Error upserting market ${marketData.external_id}:`, individualError);
            }
          }
        }
      }
      
      logger.info(`📦 Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allMarkets.length / batchSize)} (${batchData.length} markets)`);
    }
    
    // Reconcile: mark markets not in the latest fetch as closed
    const fetchedTickers = allMarkets.map(m => m.ticker).filter(Boolean);
    const closedCount = await reconcileMissingMarkets(fetchedTickers);
    if (closedCount > 0) {
      logger.info(`🧹 Marked ${closedCount} markets as closed (missing from latest fetch)`);
    }
    
    const total = inserted + updated;
    logger.info(`✅ Batch Kalshi markets processing complete!`);
    logger.info(`📊 Inserted: ${inserted}, Updated: ${updated}, Total: ${total}`);
    
    // Filter to only include active markets for matching
    const activeNewMarkets = newMarkets.filter(market => market.is_open);
    const activeExistingMarkets = existingMarkets.filter(market => market.is_open);
    
    logger.info(`🔍 Filtered to active markets: ${activeNewMarkets.length} new, ${activeExistingMarkets.length} existing (from ${newMarkets.length} new, ${existingMarkets.length} existing total)`);
    
    return { 
      inserted, 
      updated, 
      total, 
      newExternalIds, 
      existingExternalIds, 
      newMarkets: activeNewMarkets, 
      existingMarkets: activeExistingMarkets, 
      externalIdToId 
    };
    
  } catch (error) {
    logger.error('❌ Error in batch Kalshi markets insertion:', error);
    throw error;
  }
}
