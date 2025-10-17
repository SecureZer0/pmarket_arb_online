import express from 'express'

export function healthRouter({ store }) {
  const router = express.Router()
  router.get('/', (req, res) => {
    const status = store.getStatus()
    
    // Check if we have populated orderbooks
    const index = store.getIndex()
    const totalMarkets = index.length
    
    // Sample a subset of markets to check for orderbook data
    const sampleSize = Math.min(50, totalMarkets)
    const sampleMarkets = index.slice(0, sampleSize)
    let marketsWithOrderbooks = 0
    
    for (const item of sampleMarkets) {
      const fullItem = store.getById(item.id, { depth: Number.MAX_SAFE_INTEGER })
      if (fullItem && fullItem.orderbook) {
        const hasBids = Array.isArray(fullItem.orderbook.bids) && fullItem.orderbook.bids.length > 0
        const hasAsks = Array.isArray(fullItem.orderbook.asks) && fullItem.orderbook.asks.length > 0
        if (hasBids || hasAsks) {
          marketsWithOrderbooks++
        }
      }
    }
    
    // Extrapolate the sample to estimate total populated markets
    const estimatedPopulated = totalMarkets > 0 ? Math.round((marketsWithOrderbooks / sampleSize) * totalMarkets) : 0
    
    const orderbookPopulationRate = totalMarkets > 0 ? (estimatedPopulated / totalMarkets) : 0
    const isHealthy = orderbookPopulationRate > 0.4 // At least 40% of markets should have orderbooks
    
    res.json({ 
      ok: isHealthy, 
      status,
      orderbooks: {
        total: totalMarkets,
        populated: estimatedPopulated,
        populationRate: Math.round(orderbookPopulationRate * 100) / 100,
        sampleChecked: sampleSize,
        samplePopulated: marketsWithOrderbooks
      }
    })
  })
  return router
}


