const BASE = process.env.NEXT_PUBLIC_PROXY_BASE_URL || 'http://localhost:3001'

export async function fetchMarketsIndex() {
  const res = await fetch(`${BASE}/v1/markets/index`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`proxy index failed: ${res.status}`)
  return res.json()
}

export async function fetchMarkets(params?: { page?: number; pageSize?: number; depth?: number }) {
  const page = params?.page ?? 1
  const pageSize = params?.pageSize ?? 50
  const depth = params?.depth ?? 10
  const url = new URL(`${BASE}/v1/markets`)
  url.searchParams.set('page', String(page))
  url.searchParams.set('pageSize', String(pageSize))
  url.searchParams.set('depth', String(depth))
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`proxy markets failed: ${res.status}`)
  return res.json()
}

export async function fetchMarketById(id: string, params?: { depth?: number }) {
  const depth = params?.depth ?? 10
  const res = await fetch(`${BASE}/v1/markets/${encodeURIComponent(id)}?depth=${depth}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`proxy market ${id} failed: ${res.status}`)
  return res.json()
}

export async function fetchMatchesFull() {
  console.log('🌐 fetchMatchesFull: Making request to:', `${BASE}/v1/markets/matches-full`);
  const res = await fetch(`${BASE}/v1/markets/matches-full`, { cache: 'no-store' })
  console.log('🌐 fetchMatchesFull: Response status:', res.status, res.ok);
  if (!res.ok) throw new Error(`proxy matches-full failed: ${res.status}`)
  const data = await res.json();
  console.log('🌐 fetchMatchesFull: Response data:', data);
  return data;
}

