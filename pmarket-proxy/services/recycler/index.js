export function initRecycler({ store, connectors }) {
  const hours = Number(process.env.RECYCLER_INTERVAL_HOURS || 12)
  const intervalMs = Math.max(1, hours) * 60 * 60 * 1000
  setInterval(async () => {
    console.log('[recycler] recycling connectors')
    const list = Object.values(connectors || {})
    for (const c of list) {
      try { await c.recycle?.() } catch (e) { console.error('[recycler] recycle failed', c?.name, e) }
    }
  }, intervalMs)
}


