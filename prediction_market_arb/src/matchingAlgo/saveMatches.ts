import { pool } from '../predictionMarket_db.js';
import { logger } from '../utils/logger.js';
import { MatchingResult } from './matchAllMarkets.js';

function statusFromConfidence(conf: 'high' | 'medium' | 'low'): 'confirmed' | 'proposed' | 'rejected' {
  if (conf === 'high') return 'confirmed';
  if (conf === 'medium') return 'proposed';
  return 'proposed';
}

export async function saveMatchesToDb(result: MatchingResult, batchSize: number = 1000): Promise<number> {
  // Collect unique external ids for both platforms to resolve ids in bulk
  const kalshiExternalsSet = new Set<string>();
  const polyExternalsSet = new Set<string>();
  for (const c of result.candidates) {
    const kExt = String(c.kalshiMarket?.external_id || c.kalshiMarket?.ticker || '');
    const pExt = String(c.polymarketMarket?.external_id || c.polymarketMarket?.id || '');
    if (kExt) kalshiExternalsSet.add(kExt);
    if (pExt) polyExternalsSet.add(pExt);
  }

  const kalshiExternals = Array.from(kalshiExternalsSet);
  const polyExternals = Array.from(polyExternalsSet);

  // Resolve ids in two queries
  const [kalshiRows, polyRows] = await Promise.all([
    kalshiExternals.length > 0
      ? pool.query('SELECT id, external_id FROM markets WHERE platform_id = $1 AND external_id = ANY($2)', [2, kalshiExternals])
      : Promise.resolve({ rows: [] as any[] } as any),
    polyExternals.length > 0
      ? pool.query('SELECT id, external_id FROM markets WHERE platform_id = $1 AND external_id = ANY($2)', [1, polyExternals])
      : Promise.resolve({ rows: [] as any[] } as any)
  ]);

  const kalshiIdMap = new Map<string, number>();
  for (const r of kalshiRows.rows) kalshiIdMap.set(r.external_id as string, r.id as number);
  const polyIdMap = new Map<string, number>();
  for (const r of polyRows.rows) polyIdMap.set(r.external_id as string, r.id as number);

  // Prepare arrays for batch insert
  const aIds: number[] = [];
  const bIds: number[] = [];
  const methods: string[] = [];
  const scores: number[] = [];
  const statuses: string[] = [];

  for (const c of result.candidates) {
    const kExt = String(c.kalshiMarket?.external_id || c.kalshiMarket?.ticker || '');
    const pExt = String(c.polymarketMarket?.external_id || c.polymarketMarket?.id || '');
    const kId = kalshiIdMap.get(kExt);
    const pId = polyIdMap.get(pExt);
    if (!kId || !pId) continue;
    const a = Math.min(kId, pId);
    const b = Math.max(kId, pId);
    aIds.push(a);
    bIds.push(b);
    methods.push('hybrid');
    scores.push(c.hybridScore);
    statuses.push(statusFromConfidence(c.confidence));
  }

  let saved = 0;
  for (let i = 0; i < aIds.length; i += batchSize) {
    const aBatch = aIds.slice(i, i + batchSize);
    const bBatch = bIds.slice(i, i + batchSize);
    const mBatch = methods.slice(i, i + batchSize);
    const sBatch = scores.slice(i, i + batchSize);
    const stBatch = statuses.slice(i, i + batchSize);
    if (aBatch.length === 0) continue;
    try {
      const res = await pool.query(
        `INSERT INTO market_matches (market_id_a, market_id_b, method, score, status)
         SELECT * FROM unnest($1::int[], $2::int[], $3::varchar[], $4::numeric[], $5::varchar[])
         ON CONFLICT (market_id_a, market_id_b)
         DO UPDATE SET method = EXCLUDED.method, score = EXCLUDED.score, status = EXCLUDED.status
         RETURNING id`,
        [aBatch, bBatch, mBatch, sBatch, stBatch]
      );
      saved += res.rows.length;
    } catch (e) {
      logger.error('❌ Batch insert into market_matches failed', e);
    }
  }

  logger.info(`✅ Saved ${saved} matches to market_matches.`);
  return saved;
}


