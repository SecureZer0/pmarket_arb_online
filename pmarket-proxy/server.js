import express from 'express'
import compression from 'compression'
import helmet from 'helmet'
import dotenv from 'dotenv'
import cors from 'cors'
import { marketsRouter } from './routes/markets.js'
import { healthRouter } from './routes/health.js'
import { memoryStore } from './store/memoryStore.js'
import { initKalshi } from './services/kalshi/index.js'
import { initPolymarket } from './services/polymarket/index.js'
import { initAggregator } from './services/aggregator/index.js'
import { initRecycler } from './services/recycler/index.js'
import { initMarketSubscriber } from './services/marketSubscriber/index.js'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PROXY_PORT || 3001

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}))
app.use(helmet())
app.use(compression())
app.use(express.json())

// Initialize store
const store = memoryStore()

// Initialize connectors
const connectors = {
  kalshi: null,
  polymarket: null
}

// Initialize services
async function start() {
  try {
    console.log('[server] Starting pmarket-proxy server...')
    
    // Initialize connectors
    // Defer WS connect until after we fetch DB identifiers
    connectors.kalshi = await initKalshi({ store, deferConnect: true })
    connectors.polymarket = await initPolymarket({ store, deferConnect: true })
    
    // Initialize aggregator
    await initAggregator({ store })
    
    // Initialize recycler
    initRecycler({ store, connectors })
    
    // Initialize market subscriber
    await initMarketSubscriber({ 
      kalshi: connectors.kalshi, 
      polymarket: connectors.polymarket 
    })
    
    // Wait for orderbooks to populate (20 seconds as suggested)
    if (process.env.VERBOSE_LOGS === 'true') console.log('[server] Waiting 20 seconds for orderbooks to populate...')
    
    // Show progress every 5 seconds during the wait
    const progressInterval = setInterval(() => {
      const index = store.getIndex()
      const totalMarkets = index.length
      const marketsWithData = index.filter(item => 
        item.orderbook && (item.orderbook.bids?.length > 0 || item.orderbook.asks?.length > 0)
      ).length
      const populationRate = totalMarkets > 0 ? (marketsWithData / totalMarkets) : 0
      if (process.env.VERBOSE_LOGS === 'true') console.log(`[server] Orderbook population progress: ${marketsWithData}/${totalMarkets} markets (${Math.round(populationRate * 100)}%)`)
    }, 5000)
    
    await new Promise(resolve => setTimeout(resolve, 20000))
    clearInterval(progressInterval)
    
    // Final status check
    const finalIndex = store.getIndex()
    const finalTotal = finalIndex.length
    const finalPopulated = finalIndex.filter(item => 
      item.orderbook && (item.orderbook.bids?.length > 0 || item.orderbook.asks?.length > 0)
    ).length
    const finalRate = finalTotal > 0 ? (finalPopulated / finalTotal) : 0
    if (process.env.VERBOSE_LOGS === 'true') console.log(`[server] Orderbook population wait period completed: ${finalPopulated}/${finalTotal} markets (${Math.round(finalRate * 100)}%)`)
    
    // Setup routes
    app.use('/health', healthRouter({ store }))
    app.use('/markets', marketsRouter({ store }))
    app.use('/v1/markets', marketsRouter({ store }))
    
    // Root route
    app.get('/', (req, res) => {
      res.json({ 
        message: 'pmarket-proxy server running',
        version: '0.1.0',
        endpoints: ['/health', '/markets']
      })
    })
    
    // Start server
    app.listen(PORT, () => {
      console.log(`[server] pmarket-proxy running on port ${PORT}`)
      console.log(`[server] Health check: http://localhost:${PORT}/health`)
      console.log(`[server] Markets API: http://localhost:${PORT}/markets`)
    })
    
  } catch (error) {
    console.error('[server] Failed to start:', error)
    process.exit(1)
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('[server] Shutting down gracefully...')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('[server] Shutting down gracefully...')
  process.exit(0)
})

// Start the server
start()
