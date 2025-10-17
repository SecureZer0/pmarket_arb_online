// Polymarket connector: persistent WS with basic lifecycle and status wiring.
import WebSocket from 'ws'
const VERBOSE = process.env.VERBOSE_LOGS === 'true'

let socket = null
let reconnectTimer = null
  let subscribedClobIds = []
  let clobIdToMarketIdMap = new Map()

export async function initPolymarket({ store, deferConnect = false }) {
  store.setConnectorStatus('polymarket', { connected: false, lastMessageMs: null })

  async function seedInitial() {
    const base = process.env.POLYMARKET_HTTP_BASE
    if (!base) return
    try {
      // Placeholder: adjust to real Polymarket endpoint
      const res = await fetch(base)
      void (await res.text())
    } catch (e) {
      console.warn('[polymarket] initial fetch failed:', e?.message || e)
    }
    const demoId = 'polymarket-demo-1'
    store.upsertAggregate(demoId, {
      id: demoId,
      symbol: 'POLY.DEMO',
      source: 'polymarket',
      metadata: { name: 'Polymarket Demo Market' },
      orderbook: { bids: [[0.40, 120]], asks: [[0.60, 120]], lastUpdatedMs: Date.now() },
      lastUpdatedMs: Date.now()
    })
  }

  function scheduleReconnect(delayMs = 1000) {
    clearTimeout(reconnectTimer)
    reconnectTimer = setTimeout(connect, delayMs)
  }

  function connect() {
    // Polymarket WebSocket URL (from frontend reference)
    const url = 'wss://ws-subscriptions-clob.polymarket.com/ws/market'
    if (!url) return console.warn('[polymarket] WebSocket URL not configured')
    
    try {
      socket = new WebSocket(url)
      if (VERBOSE) console.log('[polymarket] Connecting to WebSocket...')
    } catch (e) {
      console.error('[polymarket] WS creation failed', e)
      return scheduleReconnect(2000)
    }

    socket.on('open', () => {
      store.setConnectorStatus('polymarket', { connected: true })
      if (VERBOSE) console.log('[polymarket] WebSocket connected, subscribing to markets...')
      
      // Subscribe to market channels using Polymarket format
      const subscriptionMessage = {
        assets_ids: subscribedClobIds, // Use real clobIds from database
        type: "market",
        initial_dump: true
      }
      
      socket.send(JSON.stringify(subscriptionMessage))
      if (VERBOSE) console.log(`[polymarket] Sent subscription message for ${subscribedClobIds.length} clobIds:`, subscribedClobIds.slice(0, 3))
    })

    socket.on('message', (data) => {
      store.setConnectorStatus('polymarket', { lastMessageMs: Date.now() })
      try {
        const message = typeof data === 'string' ? data : data.toString()
        
        // Handle PONG messages
        if (message === 'PONG') {
          return
        }
        
        const parsedMessage = JSON.parse(message)
        
        // Handle array of messages
        if (Array.isArray(parsedMessage)) {
          if (parsedMessage.length === 0) {
            if (VERBOSE) console.log('[polymarket] Received empty array response - connection confirmed')
            return
          }
          // Process each message in the array
          parsedMessage.forEach(msg => handlePolymarketMessage(msg))
          return
        }
        
        // Handle single message
        handlePolymarketMessage(parsedMessage)
        
      } catch (error) {
        console.error('[polymarket] Error parsing message:', error)
      }
    })
    
    function handlePolymarketMessage(raw) {
      if (!raw || typeof raw !== 'object') return
      
      // Handle book messages (full orderbook snapshots)
      if (raw.event_type === 'book') {
        const assetId = raw.asset_id
        const marketId = raw.market
        const bids = Array.isArray(raw.bids) ? raw.bids.map(l => [Number(l.price), Number(l.size)]) : []
        const asks = Array.isArray(raw.asks) ? raw.asks.map(l => [Number(l.price), Number(l.size)]) : []
        
        // Sort bids (highest first) and asks (lowest first)
        bids.sort((a, b) => b[0] - a[0])
        asks.sort((a, b) => a[0] - b[0])
        
        // Convert hex assetId to decimal for consistent storage
        const decimalAssetId = assetId.startsWith('0x') ? BigInt(assetId).toString() : assetId
        
        // Polymarket sends separate WebSocket messages for each token (YES and NO)
        // Each message contains the orderbook data for that specific token
        // We should store the data AS-IS for whichever token this message is for
        // The token suffix (_yes or _no) will be determined in the routes when we look up the data
        
        // Store the orderbook data for this specific token ID
        store.upsertAggregate(decimalAssetId, {
          id: decimalAssetId,
          symbol: decimalAssetId,
          source: 'polymarket',
          metadata: { marketId, hash: raw.hash, originalAssetId: assetId },
          lastUpdatedMs: Date.now(),
          orderbook: { bids, asks, lastUpdatedMs: Date.now() }
        })

        // Also store by marketId for the matches-full endpoint (use NO as default)
        const mappedMarketId = clobIdToMarketIdMap.get(decimalAssetId) || marketId
        store.upsertAggregate(mappedMarketId, {
          id: mappedMarketId,
          symbol: mappedMarketId,
          source: 'polymarket',
          metadata: { assetId, hash: raw.hash },
          lastUpdatedMs: Date.now(),
          orderbook: { bids, asks, lastUpdatedMs: Date.now() }
        })

        if (VERBOSE) console.log(`[polymarket] Updated orderbook for ${assetId} (market: ${marketId}): ${bids.length} bids, ${asks.length} asks`)
        
        // Log orderbook population progress - check actual stored data
        const totalMarkets = store.getIndex().length
        let marketsWithData = 0
        const sampleSize = Math.min(20, totalMarkets)
        for (let i = 0; i < sampleSize; i++) {
          const item = store.getIndex()[i]
          if (item) {
            const fullItem = store.getById(item.id, { depth: Number.MAX_SAFE_INTEGER })
            if (fullItem && fullItem.orderbook && 
                ((fullItem.orderbook.bids && fullItem.orderbook.bids.length > 0) || 
                 (fullItem.orderbook.asks && fullItem.orderbook.asks.length > 0))) {
              marketsWithData++
            }
          }
        }
        const estimatedTotal = Math.round((marketsWithData / sampleSize) * totalMarkets)
        if (VERBOSE) console.log(`[polymarket] Orderbook population progress: ~${estimatedTotal}/${totalMarkets} markets have data (sampled ${sampleSize})`)
        return
      }
      
      // Handle price change messages (incremental updates)
      if (raw.event_type === 'price_change') {
        // TEMPORARILY DISABLED: Focus on getting initial orderbook snapshots working first
        if (VERBOSE) console.log(`[polymarket] TEMPORARILY DISABLED: Price change update for ${raw.market}`)
        return
      }
    }

    socket.on('error', (err) => {
      console.error('[polymarket] WS error', err?.message || err)
    })

    socket.on('close', () => {
      store.setConnectorStatus('polymarket', { connected: false })
      scheduleReconnect(2000)
    })
  }

  await seedInitial()
  if (!deferConnect) connect()

  return {
    name: 'polymarket',
    setSubscribedClobIds(clobIds) {
      subscribedClobIds = clobIds
      console.log(`[polymarket] Set ${clobIds.length} subscribed clobIds`)
      if (!socket && deferConnect) {
        connect()
      }
    },
    setClobIdToMarketIdMap(mapping) {
      clobIdToMarketIdMap = mapping
      console.log(`[polymarket] Set mapping for ${mapping.size} clobId->marketId pairs`)
    },
    async recycle() {
      try { socket?.close() } catch {}
      scheduleReconnect(100)
    }
  }
}

