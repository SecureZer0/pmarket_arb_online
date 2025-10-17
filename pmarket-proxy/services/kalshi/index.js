// Kalshi connector: persistent WS with authentication and real market data
import WebSocket from 'ws'
const VERBOSE = process.env.VERBOSE_LOGS === 'true'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

let socket = null
let reconnectTimer = null
let subscribedTickers = []

// Load private key from file
function loadPrivateKeyFromFile(filePath) {
  try {
    const absolutePath = path.resolve(filePath)
    const privateKeyPem = fs.readFileSync(absolutePath, 'utf8')
    return privateKeyPem
  } catch (error) {
    console.error('[kalshi] Error loading private key:', error)
    return null
  }
}

// Sign text with private key using standard RSA-PSS padding
function signPssText(privateKeyPem, text) {
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(text)
  sign.end()
  
  const signature = sign.sign({
    key: privateKeyPem,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
  })
  
  return signature.toString('base64')
}

// Create authentication headers for Kalshi WebSocket
function createKalshiHeaders() {
  const timestamp = Date.now().toString()
  const method = 'GET'
  const path = '/trade-api/ws/v2'
  const msgString = timestamp + method + path
  
  const privateKeyPem = loadPrivateKeyFromFile(process.env.KALSHI_PRIVATE_KEY_PATH || './private-key-clean.pem')
  if (!privateKeyPem) {
    throw new Error('Failed to load private key')
  }
  
  const signature = signPssText(privateKeyPem, msgString)
  
  return {
    'KALSHI-ACCESS-KEY': process.env.KALSHI_API_KEY,
    'KALSHI-ACCESS-SIGNATURE': signature,
    'KALSHI-ACCESS-TIMESTAMP': timestamp,
  }
}

export async function initKalshi({ store, deferConnect = false }) {
  store.setConnectorStatus('kalshi', { connected: false, lastMessageMs: null })

  async function seedInitial() {
    // Skip REST API call for now - focus on WebSocket connection
    console.log('[kalshi] Skipping REST API seed - will rely on WebSocket data')
  }

  function scheduleReconnect(delayMs = 1000) {
    clearTimeout(reconnectTimer)
    reconnectTimer = setTimeout(connect, delayMs)
  }

  function connect() {
    const url = 'wss://api.elections.kalshi.com/trade-api/ws/v2' // Use the working URL
    const apiKey = process.env.KALSHI_API_KEY
    if (!apiKey) {
      console.warn('[kalshi] Missing KALSHI_API_KEY')
      return
    }
    
    try {
      // Create authentication headers
      const headers = createKalshiHeaders()
      if (VERBOSE) console.log('[kalshi] Connecting to WebSocket with authentication headers...')
      socket = new WebSocket(url, { headers })
    } catch (e) {
      console.error('[kalshi] WS creation failed', e)
      return scheduleReconnect(2000)
    }

    socket.on('open', () => {
      store.setConnectorStatus('kalshi', { connected: true })
      if (VERBOSE) console.log('[kalshi] WebSocket connected, subscribing to orderbooks...')
      
      // Subscribe to orderbook channels for specific market tickers
      const subscriptionMessage = {
        id: 1,
        cmd: 'subscribe',
        params: {
          channels: ['orderbook_snapshot', 'orderbook_delta'],
          market_tickers: subscribedTickers
        }
      }
      
      socket.send(JSON.stringify(subscriptionMessage))
      if (VERBOSE) console.log(`[kalshi] Sent subscription message for ${subscribedTickers.length} tickers:`, subscribedTickers.slice(0, 5))
    })

    socket.on('message', (data) => {
      store.setConnectorStatus('kalshi', { lastMessageMs: Date.now() })
      try {
        const raw = typeof data === 'string' ? JSON.parse(data) : JSON.parse(data.toString?.() || '{}')
        // Kalshi orderbook messages (per frontend types):
        // - Snapshot: { type: 'orderbook_snapshot', msg: { market_ticker, yes: [ [cents,size] ], no: [...] } }
        // - Delta:    { type: 'orderbook_delta', msg: { market_ticker, price, delta, side } }
        const type = raw?.type
        if (type === 'orderbook_snapshot' && raw?.msg) {
          const ticker = raw.msg.market_ticker
          const yes = Array.isArray(raw.msg.yes) ? raw.msg.yes : []
          const no = Array.isArray(raw.msg.no) ? raw.msg.no : []
          // Convert cents to decimal and invert to probability-like price (as in frontend helper)
          const asksFromNo = no.map(([cents, size]) => [Math.max(0, Math.min(1, 1 - (Number(cents) / 100))), Number(size)])
          const asksFromYes = yes.map(([cents, size]) => [Math.max(0, Math.min(1, 1 - (Number(cents) / 100))), Number(size)])
          
          // Store separate orderbooks for YES and NO outcomes
          // YES outcome: asksFromNo (people selling NO tokens = YES token asks)
          store.upsertAggregate(`${ticker}_yes`, {
            id: `${ticker}_yes`,
            symbol: `${ticker}_yes`,
            source: 'kalshi',
            lastUpdatedMs: Date.now(),
            orderbook: {
              bids: [],
              asks: asksFromNo,
              lastUpdatedMs: Date.now()
            }
          })
          
          // NO outcome: asksFromYes (people selling YES tokens = NO token asks)
          store.upsertAggregate(`${ticker}_no`, {
            id: `${ticker}_no`,
            symbol: `${ticker}_no`,
            source: 'kalshi',
            lastUpdatedMs: Date.now(),
            orderbook: {
              bids: [],
              asks: asksFromYes,
              lastUpdatedMs: Date.now()
            }
          })
          if (VERBOSE) console.log(`[kalshi] Updated orderbook for ${ticker} (YES: ${asksFromNo.length} asks, NO: ${asksFromYes.length} asks)`)
          
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
          if (VERBOSE) console.log(`[kalshi] Orderbook population progress: ~${estimatedTotal}/${totalMarkets} markets have data (sampled ${sampleSize})`)
          return
        }
        if (type === 'orderbook_delta' && raw?.msg) {
          // TEMPORARILY DISABLED: Focus on getting initial orderbook snapshots working first
          if (VERBOSE) console.log(`[kalshi] TEMPORARILY DISABLED: Delta update for ${raw.msg.market_ticker}`)
          return
        }
        // Other message types can be handled later
      } catch {}
    })

    socket.on('error', (err) => {
      console.error('[kalshi] WS error', err?.message || err)
    })

    socket.on('close', () => {
      store.setConnectorStatus('kalshi', { connected: false })
      scheduleReconnect(2000)
    })
  }

  await seedInitial()
  if (!deferConnect) connect()

  return {
    name: 'kalshi',
    setSubscribedTickers(tickers) {
      subscribedTickers = tickers
      console.log(`[kalshi] Set ${tickers.length} subscribed tickers`)
      
      // Connect if deferred and not connected yet
      if (!socket && deferConnect) {
        connect()
      }
      // Re-establish subscription with new tickers if WebSocket is connected
      if (socket && socket.readyState === WebSocket.OPEN) {
        const subscriptionMessage = {
          id: 1,
          cmd: 'subscribe',
          params: {
            channels: ['orderbook_snapshot', 'orderbook_delta'],
            market_tickers: subscribedTickers
          }
        }
        
        socket.send(JSON.stringify(subscriptionMessage))
        console.log(`[kalshi] Re-sent subscription message for ${subscribedTickers.length} tickers:`, subscribedTickers.slice(0, 5))
      }
    },
    async recycle() {
      try { socket?.close() } catch {}
      scheduleReconnect(100)
    }
  }
}

