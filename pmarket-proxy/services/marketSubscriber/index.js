// Market Subscriber: Fetches market identifiers from database and sets up WebSocket subscriptions
import { Pool } from 'pg'

export async function initMarketSubscriber({ kalshi, polymarket }) {
  const pool = new Pool({
    host: process.env.DATABASE_HOST_HETZNER,
    port: Number(process.env.DATABASE_PORT_HETZNER || 5432),
    user: process.env.DATABASE_USERNAME_HETZNER,
    password: process.env.DATABASE_PASSWORD_HETZNER,
    database: process.env.DATABASE_NAME_HETZNER_PREDICTION_MARKETS,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined
  })

  async function fetchMarketIdentifiers() {
    const client = await pool.connect()
    try {
      console.log('[marketSubscriber] Fetching matched market identifiers (LIMIT 100)...')
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
          CASE WHEN platform_a.code = 'kalshi' THEN market_a.external_id
               WHEN platform_b.code = 'kalshi' THEN market_b.external_id
               ELSE market_a.external_id END as market_a_external_id,
          CASE WHEN platform_a.code = 'polymarket' THEN market_a.platform_data
               WHEN platform_b.code = 'polymarket' THEN market_b.platform_data
               ELSE market_b.platform_data END as market_b_platform_data,
          CASE WHEN platform_a.code = 'polymarket' THEN market_a.external_id
               WHEN platform_b.code = 'polymarket' THEN market_b.external_id
               ELSE market_b.external_id END as market_b_external_id,
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
        WHERE mm.ai_status = 'confirmed'
          AND mm.ai_status != 'rejected'
          AND mm.close_condition_ai_status != 'rejected'
          AND mm.user_status != 'rejected'
          AND mm.close_condition_user_status != 'rejected'
        ORDER BY combined_volume_rank ASC, mm.created_at DESC
        LIMIT 250
      `
      const result = await client.query(query)

      const kalshiTickers = result.rows
        .map(row => row.market_a_external_id)
        .filter(ticker => ticker && ticker.trim() !== '')
        .filter((ticker, index, array) => array.indexOf(ticker) === index)

      const polymarketClobIds = []
      const clobIdToMarketIdMap = new Map()

      for (const row of result.rows) {
        const marketExternalId = row.market_b_external_id
        let platformData = row.market_b_platform_data
        if (!platformData) continue
        // platform_data could be stored as JSON or stringified JSON
        if (typeof platformData === 'string') {
          try {
            platformData = JSON.parse(platformData)
          } catch (e) {
            // ignore malformed
            continue
          }
        }
        let clobTokenIds = platformData?.clobTokenIds
        if (typeof clobTokenIds === 'string') {
          try {
            clobTokenIds = JSON.parse(clobTokenIds)
          } catch (e) {
            continue
          }
        }
        if (Array.isArray(clobTokenIds)) {
          for (const id of clobTokenIds) {
            const clobId = id.toString()
            if (!polymarketClobIds.includes(clobId)) {
              polymarketClobIds.push(clobId)
            }
            clobIdToMarketIdMap.set(clobId, marketExternalId)
          }
        }
      }

      console.log(`[marketSubscriber] Found ${kalshiTickers.length} matched Kalshi tickers and ${polymarketClobIds.length} Polymarket assetIds`)
      console.log(`[marketSubscriber] Mapping size: ${clobIdToMarketIdMap.size}`)
      console.log('[marketSubscriber] Sample Kalshi:', kalshiTickers.slice(0, 5))
      console.log('[marketSubscriber] Sample Polymarket assetIds:', polymarketClobIds.slice(0, 3))

      return { kalshiTickers, polymarketClobIds, clobIdToMarketIdMap }
      
    } catch (error) {
      console.error('[marketSubscriber] Error fetching market identifiers:', error)
      return { kalshiTickers: [], polymarketClobIds: [] }
    } finally {
      client.release()
    }
  }

  async function setupSubscriptions() {
    const { kalshiTickers, polymarketClobIds, clobIdToMarketIdMap } = await fetchMarketIdentifiers()
    
    // Set up Kalshi subscriptions
    if (kalshiTickers.length > 0) {
      kalshi.setSubscribedTickers(kalshiTickers)
    }
    
    // Set up Polymarket subscriptions
    if (polymarketClobIds.length > 0) {
      polymarket.setSubscribedClobIds(polymarketClobIds)
      polymarket.setClobIdToMarketIdMap(clobIdToMarketIdMap)
    }
    
    return { kalshiTickers, polymarketClobIds, clobIdToMarketIdMap }
  }

  // Initial setup
  await setupSubscriptions()

  return {
    name: 'marketSubscriber',
    async refreshSubscriptions() {
      return await setupSubscriptions()
    }
  }
}
