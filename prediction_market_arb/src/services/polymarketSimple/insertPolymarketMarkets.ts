import { logger } from '../../utils/logger.js';
import { pool } from '../../predictionMarket_db.js';
import { NewMarket, OutcomeType } from '../../types/database/database.js';

/**
 * Extract individual Polymarket markets (pass-through but normalized)
 */
function extractMarkets(markets: any[]): any[] {
  return (markets || []).map((m: any) => ({ ...m }));
}

/**
 * Prepare market data for database insertion using new schema
 */
function prepareMarketData(market: any): NewMarket {
  if (!market || !market.id) {
    throw new Error('Polymarket market missing id');
  }

  // Build unified title: question + group item context when available
  let unifiedTitle = '';
  if (market.question) unifiedTitle += market.question;
  if (market.groupItemTitle) unifiedTitle += (unifiedTitle ? ' - ' : '') + market.groupItemTitle;
  if (!unifiedTitle) unifiedTitle = market.title || 'Unknown Market';

  // Outcome type
  let outcomeType: OutcomeType = 'categorical';
  try {
    const outcomes = typeof market.outcomes === 'string' ? JSON.parse(market.outcomes) : market.outcomes;
    if (Array.isArray(outcomes) && outcomes.length === 2 && outcomes.includes('Yes') && outcomes.includes('No')) {
      outcomeType = 'binary';
    }
  } catch {
    // keep default
  }

  // URL from slug
  const url = market.slug ? `https://polymarket.com/market/${market.slug}` : null;

  // Open status
  const isOpen = Boolean(market.active) && !Boolean(market.closed);

  // Platform JSON
  const platformData = {
    question: market.question,
    title: market.title,
    slug: market.slug,
    description: market.description,
    outcomes: market.outcomes,
    created_at: market.createdAt,
    updated_at: market.updatedAt,
    start_date: market.startDate,
    end_date: market.endDate,
    image: market.image,
    icon: market.icon,
    group_item_title: market.groupItemTitle,
    group_item_threshold: market.groupItemThreshold,
    restricted: market.restricted,
    active: market.active,
    closed: market.closed,
    clobTokenIds: market.clobTokenIds
  };

  return {
    platform_id: 1, // Polymarket
    external_id: String(market.id),
    title: unifiedTitle,
    url,
    outcome_type: outcomeType,
    start_time: market.startDate || null,
    end_time: market.endDate || null,
    close_condition: market.description || null,
    is_open: isOpen,
    platform_data: platformData,
    volume: market.volumeNum || null
  };
}

async function upsertMarket(market: NewMarket): Promise<'inserted' | 'updated'> {
  const exists = await pool.query(
    'SELECT id FROM markets WHERE platform_id = $1 AND external_id = $2',
    [market.platform_id, market.external_id]
  );

  if (exists.rows.length > 0) {
    await pool.query(
      `UPDATE markets SET
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
      WHERE platform_id = $10 AND external_id = $11`,
      [
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
      ]
    );
    return 'updated';
  } else {
    await pool.query(
      `INSERT INTO markets (
        platform_id, external_id, title, url, outcome_type,
        start_time, end_time, close_condition, is_open, platform_data, volume
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
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
      ]
    );
    return 'inserted';
  }
}

async function reconcileMissingMarkets(fetchedIds: string[]): Promise<number> {
  if (!fetchedIds || fetchedIds.length === 0) return 0;
  const platformId = 1; // Polymarket
  const res = await pool.query(
    `UPDATE markets
     SET is_open = false, updated_at = NOW()
     WHERE platform_id = $1
       AND is_open = true
       AND external_id <> ALL($2::varchar[])`,
    [platformId, fetchedIds]
  );
  return res.rowCount ?? 0;
}

export async function batchInsertPolymarketMarkets(
  markets: any[],
  batchSize: number = 1000
): Promise<{ inserted: number; updated: number; total: number; newExternalIds: string[]; existingExternalIds: string[]; newMarkets: NewMarket[]; existingMarkets: NewMarket[]; externalIdToId: Record<string, number> }> {
  logger.info('🚀 Starting batch Polymarket markets insertion/update...');

  const allMarkets = extractMarkets(markets);
  logger.info(`📊 Received ${allMarkets.length} Polymarket markets`);

  let inserted = 0;
  let updated = 0;
  const newExternalIds: string[] = [];
  const existingExternalIds: string[] = [];
  const newMarkets: NewMarket[] = [];
  const existingMarkets: NewMarket[] = [];
  const externalIdToId: Record<string, number> = {};

  for (let i = 0; i < allMarkets.length; i += batchSize) {
    const batch = allMarkets.slice(i, i + batchSize);

    const batchData = batch.map((m: any) => {
      try { return prepareMarketData(m); } catch (e) { logger.error('❌ Map error:', e); return null; }
    }).filter(Boolean) as NewMarket[];

    if (batchData.length === 0) continue;

    // Index prepared data by external_id for quick lookup
    const byExternalId = new Map<string, NewMarket>();
    for (const m of batchData) byExternalId.set(m.external_id as string, m);

    try {
      const result = await pool.query(
        `INSERT INTO markets (
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
        RETURNING id, external_id, (xmax = 0) AS inserted`,
        [
          batchData.map(m => m.platform_id),
          batchData.map(m => m.external_id),
          batchData.map(m => m.title),
          batchData.map(m => m.url),
          batchData.map(m => m.outcome_type),
          batchData.map(m => m.start_time),
          batchData.map(m => m.end_time),
          batchData.map(m => m.close_condition),
          batchData.map(m => m.is_open),
          batchData.map(m => m.platform_data),
          batchData.map(m => m.volume)
        ]
      );
      const bInserted = result.rows.filter((r: any) => r.inserted === true).length;
      const bUpdated = result.rows.length - bInserted;
      inserted += bInserted;
      updated += bUpdated;
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
    } catch (err) {
      logger.error('❌ Batch upsert failed, falling back to single upserts', err);
      for (const m of batchData) {
        try {
          const status = await upsertMarket(m);
          if (status === 'inserted') {
            inserted++;
            newExternalIds.push(m.external_id as string);
            newMarkets.push(m);
          } else {
            updated++;
            existingExternalIds.push(m.external_id as string);
            existingMarkets.push(m);
          }
          // fetch id for this external id
          const idRes = await pool.query('SELECT id FROM markets WHERE platform_id = $1 AND external_id = $2', [m.platform_id, m.external_id]);
          if (idRes.rows[0]?.id) externalIdToId[m.external_id as string] = idRes.rows[0].id as number;
        } catch (e) {
          logger.error(`❌ Upsert failed for ${m.external_id}`, e);
        }
      }
    }

    logger.info(`📦 Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allMarkets.length / batchSize)} (${batchData.length} markets)`);
  }

  // reconcile
  const fetchedIds = allMarkets.map((m: any) => String(m.id)).filter(Boolean);
  const closedCount = await reconcileMissingMarkets(fetchedIds);
  if (closedCount > 0) {
    logger.info(`🧹 Marked ${closedCount} Polymarket markets as closed (missing from latest fetch)`);
  }

  const total = inserted + updated;
  logger.info(`✅ Batch Polymarket processing complete. Inserted: ${inserted}, Updated: ${updated}, Total: ${total}`);
  
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
}
