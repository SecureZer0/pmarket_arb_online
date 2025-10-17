import express from 'express'
import { Pool } from 'pg'

export function marketsRouter({ store }) {
  const router = express.Router()

  // Optional DB pool for market-matches endpoint
  const pool = new Pool({
    host: process.env.DATABASE_HOST_HETZNER,
    port: Number(process.env.DATABASE_PORT_HETZNER || 5432),
    user: process.env.DATABASE_USERNAME_HETZNER,
    password: process.env.DATABASE_PASSWORD_HETZNER,
    database: process.env.DATABASE_NAME_HETZNER_PREDICTION_MARKETS,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined
  })

  router.get('/index', (req, res) => {
    const index = store.getIndex()
    res.json(index)
  })

  router.get('/', (req, res) => {
    const page = parseInt(String(req.query.page || '1'), 10)
    const pageSize = parseInt(String(req.query.pageSize || '50'), 10)
    const depth = parseInt(String(req.query.depth || '10'), 10)
    const data = store.getPage({ page, pageSize, depth })
    res.json(data)
  })

  // DB-backed route: market-matches with all hiding options enabled + FULL orderbooks
  router.get('/matches-full', async (req, res) => {
    const client = await pool.connect()
    try {
      const whereConditions = [
        "mm.ai_status = 'confirmed'",
        `(
          CASE 
            WHEN platform_a.code = 'kalshi' THEN market_a.is_open
            WHEN platform_b.code = 'kalshi' THEN market_b.is_open
            ELSE market_a.is_open
          END
        ) IS TRUE`,
        `(
          CASE 
            WHEN platform_a.code = 'polymarket' THEN market_a.is_open
            WHEN platform_b.code = 'polymarket' THEN market_b.is_open
            ELSE market_b.is_open
          END
        ) IS TRUE`,
        "mm.ai_status != 'rejected'",
        "mm.close_condition_ai_status != 'rejected'",
        "mm.user_status != 'rejected'",
        "mm.close_condition_user_status != 'rejected'"
      ]
      const whereClause = whereConditions.join(' AND ')
      const query = `
        WITH kalshi_rankings AS (
          SELECT m.id, m.platform_id, m.volume,
                 ROW_NUMBER() OVER (ORDER BY COALESCE(m.volume, 0) DESC) as volume_rank
          FROM markets m JOIN platforms p ON m.platform_id = p.id
          WHERE p.code = 'kalshi' AND m.volume IS NOT NULL
        ),
        polymarket_rankings AS (
          SELECT m.id, m.platform_id, m.volume,
                 ROW_NUMBER() OVER (ORDER BY COALESCE(m.volume, 0) DESC) as volume_rank
          FROM markets m JOIN platforms p ON m.platform_id = p.id
          WHERE p.code = 'polymarket' AND m.volume IS NOT NULL
        ),
        volume_rankings AS (
          SELECT id, platform_id, volume, volume_rank FROM kalshi_rankings
          UNION ALL
          SELECT id, platform_id, volume, volume_rank FROM polymarket_rankings
        )
        SELECT 
          mm.id, mm.method, mm.score, mm.status, mm.ai_status, mm.user_status,
          mm.is_inversed, mm.close_condition_score, mm.close_condition_status,
          mm.close_condition_ai_status, mm.close_condition_user_status,
          mm.notes, mm.created_at, mm.market_id_a, mm.market_id_b,
          CASE WHEN platform_a.code = 'kalshi' THEN market_a.id
               WHEN platform_b.code = 'kalshi' THEN market_b.id
               ELSE market_a.id END as market_a_id,
          CASE WHEN platform_a.code = 'kalshi' THEN market_a.platform_id
               WHEN platform_b.code = 'kalshi' THEN market_b.platform_id
               ELSE market_a.platform_id END as market_a_platform_id,
          CASE WHEN platform_a.code = 'kalshi' THEN market_a.external_id
               WHEN platform_b.code = 'kalshi' THEN market_b.external_id
               ELSE market_a.external_id END as market_a_external_id,
          CASE WHEN platform_a.code = 'kalshi' THEN market_a.title
               WHEN platform_b.code = 'kalshi' THEN market_b.title
               ELSE market_a.title END as market_a_title,
          CASE WHEN platform_a.code = 'kalshi' THEN market_a.url
               WHEN platform_b.code = 'kalshi' THEN market_b.url
               ELSE market_a.url END as market_a_url,
          CASE WHEN platform_a.code = 'kalshi' THEN market_a.outcome_type
               WHEN platform_b.code = 'kalshi' THEN market_b.outcome_type
               ELSE market_a.outcome_type END as market_a_outcome_type,
          CASE WHEN platform_a.code = 'kalshi' THEN market_a.start_time
               WHEN platform_b.code = 'kalshi' THEN market_b.start_time
               ELSE market_a.start_time END as market_a_start_time,
          CASE WHEN platform_a.code = 'kalshi' THEN market_a.end_time
               WHEN platform_b.code = 'kalshi' THEN market_b.end_time
               ELSE market_a.end_time END as market_a_end_time,
          CASE WHEN platform_a.code = 'kalshi' THEN market_a.close_condition
               WHEN platform_b.code = 'kalshi' THEN market_b.close_condition
               ELSE market_a.close_condition END as market_a_close_condition,
          CASE WHEN platform_a.code = 'kalshi' THEN market_a.is_open
               WHEN platform_b.code = 'kalshi' THEN market_b.is_open
               ELSE market_a.is_open END as market_a_is_open,
          CASE WHEN platform_a.code = 'kalshi' THEN market_a.platform_data
               WHEN platform_b.code = 'kalshi' THEN market_b.platform_data
               ELSE market_a.platform_data END as market_a_platform_data,
          CASE WHEN platform_a.code = 'kalshi' THEN market_a.volume
               WHEN platform_b.code = 'kalshi' THEN market_b.volume
               ELSE market_a.volume END as market_a_volume,
          CASE WHEN platform_a.code = 'polymarket' THEN market_a.id
               WHEN platform_b.code = 'polymarket' THEN market_b.id
               ELSE market_b.id END as market_b_id,
          CASE WHEN platform_a.code = 'polymarket' THEN market_a.platform_id
               WHEN platform_b.code = 'polymarket' THEN market_b.platform_id
               ELSE market_b.platform_id END as market_b_platform_id,
          CASE WHEN platform_a.code = 'polymarket' THEN market_a.external_id
               WHEN platform_b.code = 'polymarket' THEN market_b.external_id
               ELSE market_b.external_id END as market_b_external_id,
          CASE WHEN platform_a.code = 'polymarket' THEN market_a.title
               WHEN platform_b.code = 'polymarket' THEN market_b.title
               ELSE market_b.title END as market_b_title,
          CASE WHEN platform_a.code = 'polymarket' THEN market_a.url
               WHEN platform_b.code = 'polymarket' THEN market_b.url
               ELSE market_b.url END as market_b_url,
          CASE WHEN platform_a.code = 'polymarket' THEN market_a.outcome_type
               WHEN platform_b.code = 'polymarket' THEN market_b.outcome_type
               ELSE market_b.outcome_type END as market_b_outcome_type,
          CASE WHEN platform_a.code = 'polymarket' THEN market_a.start_time
               WHEN platform_b.code = 'polymarket' THEN market_b.start_time
               ELSE market_b.start_time END as market_b_start_time,
          CASE WHEN platform_a.code = 'polymarket' THEN market_a.end_time
               WHEN platform_b.code = 'polymarket' THEN market_b.end_time
               ELSE market_b.end_time END as market_b_end_time,
          CASE WHEN platform_a.code = 'polymarket' THEN market_a.close_condition
               WHEN platform_b.code = 'polymarket' THEN market_b.close_condition
               ELSE market_b.close_condition END as market_b_close_condition,
          CASE WHEN platform_a.code = 'polymarket' THEN market_a.is_open
               WHEN platform_b.code = 'polymarket' THEN market_b.is_open
               ELSE market_b.is_open END as market_b_is_open,
          CASE WHEN platform_a.code = 'polymarket' THEN market_a.platform_data
               WHEN platform_b.code = 'polymarket' THEN market_b.platform_data
               ELSE market_b.platform_data END as market_b_platform_data,
          CASE WHEN platform_a.code = 'polymarket' THEN market_a.volume
               WHEN platform_b.code = 'polymarket' THEN market_b.volume
               ELSE market_b.volume END as market_b_volume,
          CASE WHEN platform_a.code = 'kalshi' THEN platform_a.name
               WHEN platform_b.code = 'kalshi' THEN platform_b.name
               ELSE platform_a.name END as platform_a_name,
          CASE WHEN platform_a.code = 'polymarket' THEN platform_a.name
               WHEN platform_b.code = 'polymarket' THEN platform_b.name
               ELSE platform_b.name END as platform_b_name,
          COALESCE(rank_a.volume_rank, 999999) as market_a_volume_rank,
          COALESCE(rank_b.volume_rank, 999999) as market_b_volume_rank,
          (COALESCE(rank_a.volume_rank, 999999) + COALESCE(rank_b.volume_rank, 999999)) as combined_volume_rank
        FROM market_matches mm
        LEFT JOIN markets market_a ON mm.market_id_a = market_a.id
        LEFT JOIN markets market_b ON mm.market_id_b = market_b.id
        LEFT JOIN platforms platform_a ON market_a.platform_id = platform_a.id
        LEFT JOIN platforms platform_b ON market_b.platform_id = platform_b.id
        LEFT JOIN volume_rankings rank_a ON (
          CASE 
            WHEN platform_a.code = 'kalshi' THEN market_a.id
            WHEN platform_b.code = 'kalshi' THEN market_b.id
            ELSE market_a.id
          END = rank_a.id
        )
        LEFT JOIN volume_rankings rank_b ON (
          CASE 
            WHEN platform_a.code = 'polymarket' THEN market_a.id
            WHEN platform_b.code = 'polymarket' THEN market_b.id
            ELSE market_b.id
          END = rank_b.id
        )
        WHERE ${whereClause}
        ORDER BY combined_volume_rank ASC, mm.created_at DESC
        LIMIT 100`;

      const result = await client.query(query)
      
      // If orderbooks are not populated enough, return 503 to signal retry
      const index = store.getIndex()
      const total = index.length
      let withBooks = 0
      const sample = Math.min(50, total)
      for (let i = 0; i < sample; i++) {
        const item = index[i]
        if (!item) continue
        const full = store.getById(item.id, { depth: Number.MAX_SAFE_INTEGER })
        const has = full && full.orderbook && ((Array.isArray(full.orderbook.bids) && full.orderbook.bids.length > 0) || (Array.isArray(full.orderbook.asks) && full.orderbook.asks.length > 0))
        if (has) withBooks++
      }
      const populatedRate = total > 0 ? (withBooks / sample) : 0
      if (populatedRate < 0.2) {
        return res.status(503).json({ success: false, error: 'orderbooks_warming_up', details: { total, sampleChecked: sample, samplePopulated: withBooks } })
      }
      
      // Embed FULL orderbooks for each match
      const enrichedMatches = result.rows.map(match => {
        const marketAId = match.market_a_external_id
        const marketBId = match.market_b_external_id
        
        // Get full orderbooks from store (no depth limit)
        let marketAOrderbook = store.getById(marketAId, { depth: Number.MAX_SAFE_INTEGER })
        let marketBOrderbook = store.getById(marketBId, { depth: Number.MAX_SAFE_INTEGER })
        
        // For Kalshi markets, we now store separate YES/NO orderbooks
        // Provide separate orderbooks for YES and NO outcomes
        let marketAYesOrderbook = null
        let marketANoOrderbook = null
        let marketBYesOrderbook = null
        let marketBNoOrderbook = null

        if (match.platform_a_name?.toLowerCase().includes('kalshi')) {
          const yesOrderbook = store.getById(`${marketAId}_yes`, { depth: Number.MAX_SAFE_INTEGER })
          const noOrderbook = store.getById(`${marketAId}_no`, { depth: Number.MAX_SAFE_INTEGER })

          marketAYesOrderbook = yesOrderbook?.orderbook || { bids: [], asks: [], lastUpdatedMs: null }
          marketANoOrderbook = noOrderbook?.orderbook || { bids: [], asks: [], lastUpdatedMs: null }

          // For backward compatibility, also provide the combined orderbook
          const combinedAsks = [
            ...(marketAYesOrderbook.asks || []),
            ...(marketANoOrderbook.asks || [])
          ]

          marketAOrderbook = {
            orderbook: {
              bids: [],
              asks: combinedAsks,
              lastUpdatedMs: Math.max(
                marketAYesOrderbook.lastUpdatedMs || 0,
                marketANoOrderbook.lastUpdatedMs || 0
              )
            }
          }
        }

        if (match.platform_b_name?.toLowerCase().includes('polymarket')) {
          const clobTokenIds = match.market_b_platform_data?.clobTokenIds
          if (clobTokenIds) {
            const tokenIds = typeof clobTokenIds === 'string' ? JSON.parse(clobTokenIds) : clobTokenIds
            if (Array.isArray(tokenIds) && tokenIds.length >= 2) {
              const yesClobId = tokenIds[0]
              const noClobId = tokenIds[1]
              
              // Convert hex clobIds to decimal for consistent storage lookup
              const yesDecimalId = yesClobId.startsWith('0x') ? BigInt(yesClobId).toString() : yesClobId
              const noDecimalId = noClobId.startsWith('0x') ? BigInt(noClobId).toString() : noClobId
              
              // Polymarket stores data by token ID directly (no _yes or _no suffix)
              const yesOrderbook = store.getById(yesDecimalId, { depth: Number.MAX_SAFE_INTEGER })
              const noOrderbook = store.getById(noDecimalId, { depth: Number.MAX_SAFE_INTEGER })

              marketBYesOrderbook = yesOrderbook?.orderbook || { bids: [], asks: [], lastUpdatedMs: null }
              marketBNoOrderbook = noOrderbook?.orderbook || { bids: [], asks: [], lastUpdatedMs: null }

              // For backward compatibility, also provide the combined orderbook
              const combinedBids = [
                ...(marketBYesOrderbook.bids || []),
                ...(marketBNoOrderbook.bids || [])
              ]
              const combinedAsks = [
                ...(marketBYesOrderbook.asks || []),
                ...(marketBNoOrderbook.asks || [])
              ]

              marketBOrderbook = {
                orderbook: {
                  bids: combinedBids,
                  asks: combinedAsks,
                  lastUpdatedMs: Math.max(
                    marketBYesOrderbook.lastUpdatedMs || 0,
                    marketBNoOrderbook.lastUpdatedMs || 0
                  )
                }
              }
            }
          }
        }
        
        return {
          ...match,
          marketA: {
            id: marketAId,
            title: match.market_a_title,
            platform: match.platform_a_name,
            orderbook: marketAOrderbook?.orderbook || { bids: [], asks: [], lastUpdatedMs: null },
            // Add separate YES/NO orderbooks for Kalshi
            ...(marketAYesOrderbook && marketANoOrderbook ? {
              yesOrderbook: marketAYesOrderbook,
              noOrderbook: marketANoOrderbook
            } : {})
          },
          marketB: {
            id: marketBId,
            title: match.market_b_title,
            platform: match.platform_b_name,
            orderbook: marketBOrderbook?.orderbook || { bids: [], asks: [], lastUpdatedMs: null },
            // Add separate YES/NO orderbooks for Polymarket
            ...(marketBYesOrderbook && marketBNoOrderbook ? {
              yesOrderbook: marketBYesOrderbook,
              noOrderbook: marketBNoOrderbook
            } : {})
          }
        }
      })
      
      res.json({ success: true, data: enrichedMatches, count: enrichedMatches.length })
    } catch (e) {
      console.error('[markets/matches-full] error', e)
      res.status(500).json({ success: false, error: 'db_error', details: e?.message || String(e) })
    } finally {
      client.release()
    }
  })

  // DB-backed route: market-matches with all hiding options enabled
  router.get('/matches', async (req, res) => {
    const client = await pool.connect()
    try {
      const whereConditions = [
        "mm.ai_status = 'confirmed'",
        `(
          CASE 
            WHEN platform_a.code = 'kalshi' THEN market_a.is_open
            WHEN platform_b.code = 'kalshi' THEN market_b.is_open
            ELSE market_a.is_open
          END
        ) IS TRUE`,
        `(
          CASE 
            WHEN platform_a.code = 'polymarket' THEN market_a.is_open
            WHEN platform_b.code = 'polymarket' THEN market_b.is_open
            ELSE market_b.is_open
          END
        ) IS TRUE`,
        "mm.ai_status != 'rejected'",
        "mm.close_condition_ai_status != 'rejected'",
        "mm.user_status != 'rejected'",
        "mm.close_condition_user_status != 'rejected'"
      ]
      const whereClause = whereConditions.join(' AND ')
      const query = `
        WITH kalshi_rankings AS (
          SELECT m.id, m.platform_id, m.volume,
                 ROW_NUMBER() OVER (ORDER BY COALESCE(m.volume, 0) DESC) as volume_rank
          FROM markets m JOIN platforms p ON m.platform_id = p.id
          WHERE p.code = 'kalshi' AND m.volume IS NOT NULL
        ),
        polymarket_rankings AS (
          SELECT m.id, m.platform_id, m.volume,
                 ROW_NUMBER() OVER (ORDER BY COALESCE(m.volume, 0) DESC) as volume_rank
          FROM markets m JOIN platforms p ON m.platform_id = p.id
          WHERE p.code = 'polymarket' AND m.volume IS NOT NULL
        ),
        volume_rankings AS (
          SELECT id, platform_id, volume, volume_rank FROM kalshi_rankings
          UNION ALL
          SELECT id, platform_id, volume, volume_rank FROM polymarket_rankings
        )
        SELECT 
          mm.id, mm.method, mm.score, mm.status, mm.ai_status, mm.user_status,
          mm.is_inversed, mm.close_condition_score, mm.close_condition_status,
          mm.close_condition_ai_status, mm.close_condition_user_status,
          mm.notes, mm.created_at, mm.market_id_a, mm.market_id_b,
          CASE WHEN platform_a.code = 'kalshi' THEN market_a.id
               WHEN platform_b.code = 'kalshi' THEN market_b.id
               ELSE market_a.id END as market_a_id,
          CASE WHEN platform_a.code = 'kalshi' THEN market_a.platform_id
               WHEN platform_b.code = 'kalshi' THEN market_b.platform_id
               ELSE market_a.platform_id END as market_a_platform_id,
          CASE WHEN platform_a.code = 'kalshi' THEN market_a.external_id
               WHEN platform_b.code = 'kalshi' THEN market_b.external_id
               ELSE market_a.external_id END as market_a_external_id,
          CASE WHEN platform_a.code = 'kalshi' THEN market_a.title
               WHEN platform_b.code = 'kalshi' THEN market_b.title
               ELSE market_a.title END as market_a_title,
          CASE WHEN platform_a.code = 'kalshi' THEN market_a.url
               WHEN platform_b.code = 'kalshi' THEN market_b.url
               ELSE market_a.url END as market_a_url,
          CASE WHEN platform_a.code = 'kalshi' THEN market_a.outcome_type
               WHEN platform_b.code = 'kalshi' THEN market_b.outcome_type
               ELSE market_a.outcome_type END as market_a_outcome_type,
          CASE WHEN platform_a.code = 'kalshi' THEN market_a.start_time
               WHEN platform_b.code = 'kalshi' THEN market_b.start_time
               ELSE market_a.start_time END as market_a_start_time,
          CASE WHEN platform_a.code = 'kalshi' THEN market_a.end_time
               WHEN platform_b.code = 'kalshi' THEN market_b.end_time
               ELSE market_a.end_time END as market_a_end_time,
          CASE WHEN platform_a.code = 'kalshi' THEN market_a.close_condition
               WHEN platform_b.code = 'kalshi' THEN market_b.close_condition
               ELSE market_a.close_condition END as market_a_close_condition,
          CASE WHEN platform_a.code = 'kalshi' THEN market_a.is_open
               WHEN platform_b.code = 'kalshi' THEN market_b.is_open
               ELSE market_a.is_open END as market_a_is_open,
          CASE WHEN platform_a.code = 'kalshi' THEN market_a.platform_data
               WHEN platform_b.code = 'kalshi' THEN market_b.platform_data
               ELSE market_a.platform_data END as market_a_platform_data,
          CASE WHEN platform_a.code = 'kalshi' THEN market_a.volume
               WHEN platform_b.code = 'kalshi' THEN market_b.volume
               ELSE market_a.volume END as market_a_volume,
          CASE WHEN platform_a.code = 'polymarket' THEN market_a.id
               WHEN platform_b.code = 'polymarket' THEN market_b.id
               ELSE market_b.id END as market_b_id,
          CASE WHEN platform_a.code = 'polymarket' THEN market_a.platform_id
               WHEN platform_b.code = 'polymarket' THEN market_b.platform_id
               ELSE market_b.platform_id END as market_b_platform_id,
          CASE WHEN platform_a.code = 'polymarket' THEN market_a.external_id
               WHEN platform_b.code = 'polymarket' THEN market_b.external_id
               ELSE market_b.external_id END as market_b_external_id,
          CASE WHEN platform_a.code = 'polymarket' THEN market_a.title
               WHEN platform_b.code = 'polymarket' THEN market_b.title
               ELSE market_b.title END as market_b_title,
          CASE WHEN platform_a.code = 'polymarket' THEN market_a.url
               WHEN platform_b.code = 'polymarket' THEN market_b.url
               ELSE market_b.url END as market_b_url,
          CASE WHEN platform_a.code = 'polymarket' THEN market_a.outcome_type
               WHEN platform_b.code = 'polymarket' THEN market_b.outcome_type
               ELSE market_b.outcome_type END as market_b_outcome_type,
          CASE WHEN platform_a.code = 'polymarket' THEN market_a.start_time
               WHEN platform_b.code = 'polymarket' THEN market_b.start_time
               ELSE market_b.start_time END as market_b_start_time,
          CASE WHEN platform_a.code = 'polymarket' THEN market_a.end_time
               WHEN platform_b.code = 'polymarket' THEN market_b.end_time
               ELSE market_b.end_time END as market_b_end_time,
          CASE WHEN platform_a.code = 'polymarket' THEN market_a.close_condition
               WHEN platform_b.code = 'polymarket' THEN market_b.close_condition
               ELSE market_b.close_condition END as market_b_close_condition,
          CASE WHEN platform_a.code = 'polymarket' THEN market_a.is_open
               WHEN platform_b.code = 'polymarket' THEN market_b.is_open
               ELSE market_b.is_open END as market_b_is_open,
          CASE WHEN platform_a.code = 'polymarket' THEN market_a.platform_data
               WHEN platform_b.code = 'polymarket' THEN market_b.platform_data
               ELSE market_b.platform_data END as market_b_platform_data,
          CASE WHEN platform_a.code = 'polymarket' THEN market_a.volume
               WHEN platform_b.code = 'polymarket' THEN market_b.volume
               ELSE market_b.volume END as market_b_volume,
          CASE WHEN platform_a.code = 'kalshi' THEN platform_a.name
               WHEN platform_b.code = 'kalshi' THEN platform_b.name
               ELSE platform_a.name END as platform_a_name,
          CASE WHEN platform_a.code = 'polymarket' THEN platform_a.name
               WHEN platform_b.code = 'polymarket' THEN platform_b.name
               ELSE platform_b.name END as platform_b_name,
          COALESCE(rank_a.volume_rank, 999999) as market_a_volume_rank,
          COALESCE(rank_b.volume_rank, 999999) as market_b_volume_rank,
          (COALESCE(rank_a.volume_rank, 999999) + COALESCE(rank_b.volume_rank, 999999)) as combined_volume_rank
        FROM market_matches mm
        LEFT JOIN markets market_a ON mm.market_id_a = market_a.id
        LEFT JOIN markets market_b ON mm.market_id_b = market_b.id
        LEFT JOIN platforms platform_a ON market_a.platform_id = platform_a.id
        LEFT JOIN platforms platform_b ON market_b.platform_id = platform_b.id
        LEFT JOIN volume_rankings rank_a ON (
          CASE 
            WHEN platform_a.code = 'kalshi' THEN market_a.id
            WHEN platform_b.code = 'kalshi' THEN market_b.id
            ELSE market_a.id
          END = rank_a.id
        )
        LEFT JOIN volume_rankings rank_b ON (
          CASE 
            WHEN platform_a.code = 'polymarket' THEN market_a.id
            WHEN platform_b.code = 'polymarket' THEN market_b.id
            ELSE market_b.id
          END = rank_b.id
        )
        WHERE ${whereClause}
        ORDER BY combined_volume_rank ASC, mm.created_at DESC
        LIMIT 100`;

      const result = await client.query(query)
      res.json({ success: true, data: result.rows, count: result.rows.length })
    } catch (e) {
      console.error('[markets/matches] error', e)
      res.status(500).json({ success: false, error: 'db_error', details: e?.message || String(e) })
    } finally {
      client.release()
    }
  })

  router.get('/:id', (req, res) => {
    const depth = parseInt(String(req.query.depth || '10'), 10)
    const item = store.getById(req.params.id, { depth })
    if (!item) return res.status(404).json({ error: 'not_found' })
    res.json(item)
  })


  return router
}

