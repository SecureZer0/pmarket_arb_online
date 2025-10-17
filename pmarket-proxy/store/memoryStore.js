export function memoryStore() {
  const aggregates = new Map()
  const status = {
    kalshi: { connected: false, lastMessageMs: null },
    polymarket: { connected: false, lastMessageMs: null }
  }

  function toDepth(orderbook, depth) {
    if (!orderbook) return orderbook
    const trim = (arr) => Array.isArray(arr) ? arr.slice(0, depth) : arr
    return {
      bids: trim(orderbook.bids),
      asks: trim(orderbook.asks),
      lastUpdatedMs: orderbook.lastUpdatedMs
    }
  }

  return {
    getStatus() { return status },
    setConnectorStatus(key, value) { status[key] = { ...status[key], ...value } },
    upsertAggregate(id, aggregate) { aggregates.set(id, { ...aggregates.get(id), ...aggregate }) },
    getIndex() {
      return Array.from(aggregates.values()).map(a => ({ id: a.id, symbol: a.symbol, source: a.source, lastUpdatedMs: a.lastUpdatedMs }))
    },
    getPage({ page, pageSize, depth }) {
      const list = Array.from(aggregates.values())
      const start = (page - 1) * pageSize
      const end = start + pageSize
      const items = list.slice(start, end).map(a => ({ ...a, orderbook: toDepth(a.orderbook, depth) }))
      return { page, pageSize, total: list.length, items }
    },
    getById(id, { depth }) {
      const a = aggregates.get(id)
      if (!a) return null
      return { ...a, orderbook: toDepth(a.orderbook, depth) }
    }
  }
}


