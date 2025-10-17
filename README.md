## Project Integration Plan: Proxy-Centric Aggregation (No Cache)

This guide describes the step-by-step plan to move all market + orderbook data aggregation into `kalshi-proxy/` and have the frontend (`prediction_market_arb_frontend/`) fetch a complete, combined view from the proxy. We will:

- Persist Kalshi and Polymarket websocket connections inside the proxy
- Handle live price/orderbook update messages to keep in-proxy snapshots up to date
- Periodically recycle connections (every 12–24 hours) to ensure parity with the exchanges
- Expose simple REST endpoints for the frontend to consume
- Skip server-side caching for now (the proxy maintains in-memory snapshots only)


### 0) Current Repos

- Proxy service: `kalshi-proxy/`
- Backend library / services: `prediction_market_arb/` (for reference/utilities if useful)
- Frontend: `prediction_market_arb_frontend/`


### 1) Goals and Non-Goals

- Goal: Centralize all data acquisition (markets + orderbooks) in `kalshi-proxy/`
- Goal: Maintain persistent websockets to Kalshi and Polymarket; apply incoming updates to in-memory snapshots
- Goal: Recycle (close + reopen) websocket connections on a schedule (12–24 hours) and on error to realign with source of truth
- Goal: Provide frontend with a single, simple API returning combined market + orderbook objects (paginated)
- Non-Goal (for now): Implement a distributed cache/ETag system. We will keep snapshots in memory only.


### 2) High-Level Architecture (Target)

- `kalshi-proxy/` (Node/Express) manages:
  - Startup fetch for market metadata (Kalshi + Polymarket)
  - Persistent websocket connections to receive orderbook/price updates
  - In-memory snapshots: one per market, containing metadata + current orderbook
  - Scheduled reconciliation cycle (every 12–24h): full refresh + socket recycle
  - REST API for the frontend

- `prediction_market_arb_frontend/` consumes:
  - `GET /v1/markets/index` for lightweight listing/index
  - `GET /v1/markets` for paginated combined market objects
  - `GET /v1/markets/:id` for on-demand detail


### 3) Implementation Steps (Proxy)

All paths below are relative to `kalshi-proxy/`.

1. Add dependencies (if not already present):
   - `npm i express ws axios p-queue compression helmet` (or similar)

2. Create structure:
   - `services/kalshi/` – connection manager + message handlers for Kalshi WS and REST fetch for initial markets
   - `services/polymarket/` – same as above for Polymarket
   - `services/aggregator/` – merges market metadata + orderbook into an in-memory snapshot per market
   - `services/recycler/` – schedules periodic close/reopen cycles and full resync
   - `routes/` – Express route handlers for the API surface
   - `types/` – shared types for Market, Orderbook, Aggregate

3. In-memory store (skip external cache for now):
   - A `Map<string, MarketAggregate>` keyed by a canonical market ID/symbol
   - `MarketAggregate` shape:
     - `id`, `source` (kalshi|polymarket), `metadata`
     - `orderbook` (top-of-book to configurable depth)
     - `lastUpdatedMs`

4. Startup sequence in `server.js`:
   - Load config (API keys, WS URLs)
   - Fetch initial market directories from both sources (HTTP)
   - Initialize `aggregator` with empty snapshots
   - Establish persistent WS connections for Kalshi and Polymarket
   - Subscribe to all relevant market channels (batched if needed)
   - Apply incoming update messages to the in-memory store
   - Start recycler schedule (cron-like interval) for 12–24h resync

5. Message handling (both Kalshi + Polymarket):
   - Normalize incoming updates to a common internal shape
   - Update only the changed parts of the snapshot (e.g., top levels, lastUpdatedMs)
   - Guard against out-of-order updates by tracking sequence or timestamps if provided
   - On WS error/close, attempt reconnect with exponential backoff; on reconnect, resubscribe

6. Scheduled recycle (integrity assurance):
   - Every 12–24 hours:
     - Gracefully close existing WS connections
     - Re-open new WS connections and re-subscribe to all markets
     - Perform a fresh HTTP snapshot fetch of orderbooks/markets to re-seed
     - Diff and reconcile snapshots to ensure parity

7. API routes (Express):
   - `GET /v1/healthz` – returns process up, WS status summary (connected, last message time)
   - `GET /v1/markets/index` – returns array of `{ id, symbol, source, lastUpdatedMs }`
   - `GET /v1/markets` – query: `page`, `pageSize`, `depth`
     - Returns paginated `MarketAggregate[]`
     - `depth` limits orderbook levels returned (default 10)
   - `GET /v1/markets/:id` – returns single `MarketAggregate` (with optional `depth`)

8. Middleware and limits:
   - `compression()` and `helmet()`
   - JSON body limits appropriate to expected payloads
   - Keep endpoints read-only (GET only) for now


### 4) Implementation Steps (Frontend)

All paths below are relative to `prediction_market_arb_frontend/`.

1. Create a service in `src/services/arbitrageService.ts` (or reuse existing):
   - Add functions for:
     - `fetchMarketsIndex()` -> `GET {PROXY_URL}/v1/markets/index`
     - `fetchMarkets({ page, pageSize, depth })` -> `GET {PROXY_URL}/v1/markets`
     - `fetchMarketById(id, { depth })` -> `GET {PROXY_URL}/v1/markets/:id`

2. UI integration:
   - On initial load, fetch `/v1/markets/index` to render list placeholders quickly
   - Then fetch `/v1/markets?page=1&pageSize=50&depth=10` (adjust to UX)
   - For detail views, call `/v1/markets/:id` lazily
   - Use list virtualization for 500+ items (e.g., `react-virtualized` or similar)

3. Remove any direct Kalshi/Polymarket connectivity from the frontend; the proxy is the only data source.


### 5) Configuration

In `kalshi-proxy/.env` (see `env.example`):
- `PORT=...`
- `KALSHI_API_KEY=...`
- `KALSHI_API_SECRET=...`
- `KALSHI_WS_URL=wss://...`
- `KALSHI_HTTP_BASE=https://...`
- `POLYMARKET_WS_URL=wss://...`
- `POLYMARKET_HTTP_BASE=https://...`
- `RECYCLER_INTERVAL_HOURS=12` (or 24)

In `prediction_market_arb_frontend/.env.local`:
- `NEXT_PUBLIC_PROXY_BASE_URL=http://localhost:PORT` (or deployed URL)


### 6) Performance Notes (No Cache Mode)

- Persist WS connections to minimize overhead; batch subscriptions where the API allows
- Limit orderbook depth in responses (`depth` param) to keep payloads smaller
- Use pagination on `/v1/markets` to avoid returning 500 full objects at once
- Consider streaming large responses (NDJSON) later if needed (optional)


### 7) Testing Locally

1. Proxy:
   - `cd kalshi-proxy`
   - Configure `.env`
   - `npm install`
   - `npm start` (or `npm run dev`)
   - Verify `GET /v1/healthz` shows connected sockets and recent message timestamps

2. Frontend:
   - `cd prediction_market_arb_frontend`
   - Configure `.env.local` with `NEXT_PUBLIC_PROXY_BASE_URL`
   - `npm install`
   - `npm run dev`
   - Open the app, verify index renders, then paginated data loads from proxy


### 8) Deployment & Ops

- Run `kalshi-proxy` as a long-lived service (PM2, systemd, or container orchestration)
- Expose health checks for liveness/readiness
- Log key events: WS connect/disconnect, resubscribe counts, message rates, recycler runs
- Set proper timeouts and backoff on reconnects
- Optional (later): metrics endpoint for dashboards (message throughput, snapshot latency)


### 9) Future Enhancements (Optional)

- Add ETags/If-None-Match and response compression tuning
- Introduce Redis-backed cache for horizontal scaling beyond a single instance
- SSE or WebSocket relay to push diffs to the frontend
- Snapshot persistence across restarts (disk/Redis) to improve cold-start latency


### Acceptance Criteria

- Frontend no longer directly connects to Kalshi/Polymarket; only calls the proxy
- Proxy maintains persistent sockets, applies updates, and serves combined objects
- Recycler successfully closes and reopens WS connections on schedule and after errors
- Frontend can list 500 markets and load details via proxy endpoints with acceptable latency


