// Kalshi WebSocket implementation
import {
  KalshiWebSocketResponse,
  KalshiOrderBookMessage,
  KalshiOrderBookSnapshot,
  KalshiOrderBookDelta,
  KalshiMarketMessage,
  KalshiTradeMessage,
  KalshiWebSocketEventHandlers,
  isKalshiOrderBookMessage,
  isKalshiOrderBookSnapshot,
  isKalshiOrderBookDelta,
  isKalshiMarketMessage,
  isKalshiTradeMessage,
  parseKalshiOrderBookSnapshot
} from '../types/kalshi-websocket';
import { getOrderBookDispatch } from '../contexts/OrderBookContext';

// Kalshi WebSocket configuration (via proxy server)
const KALSHI_WS_URL = 'ws://localhost:3001';

interface KalshiSubscriptionMessage {
  id: number;
  cmd: 'subscribe';
  params: {
    channels: string[];
    market_tickers?: string[];
  };
}


// Global state
let ws: WebSocket | null = null;
let orderbooks = new Map<string, any>();
let pingInterval: NodeJS.Timeout | null = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectInterval = 5000;
let eventHandlers: KalshiWebSocketEventHandlers | undefined;
let verbose = false;
let subscribedTickers: string[] = [];
let commandId = 1;



// Simple state - no batching
const MAX_TICKERS = 500;
let allTickers: string[] = [];

/**
 * Initialize Kalshi WebSocket connection
 */
export function initKalshiWebSocket(
  tickers: string[],
  eventHandlersParam?: KalshiWebSocketEventHandlers,
  verboseParam: boolean = false
): void {
  // No need to check credentials - the proxy handles authentication
  eventHandlers = eventHandlersParam;
  verbose = verboseParam;
  
  // Limit to max 500 tickers
  allTickers = tickers.slice(0, MAX_TICKERS);
  subscribedTickers = allTickers;
  
  if (tickers.length > MAX_TICKERS) {
    console.log(`⚠️ Limited to first ${MAX_TICKERS} tickers (was ${tickers.length})`);
  }
  
  // Try without API key first to test connection
  console.log(`🔌 Attempting to connect to: ${KALSHI_WS_URL}`);
  ws = new WebSocket(KALSHI_WS_URL);

  console.log(`🔌 Kalshi WebSocket initialized with ${allTickers.length} tickers`);
  
  setupEventHandlers();
}

/**
 * Setup WebSocket event handlers
 */
function setupEventHandlers(): void {
  if (!ws) return;
  
  ws.addEventListener('message', onMessage);
  ws.addEventListener('error', onError);
  ws.addEventListener('close', onClose);
  ws.addEventListener('open', onOpen);
}

/**
 * Handle incoming WebSocket messages
 */
function onMessage(event: MessageEvent): void {
  try {
    // Handle both string and Blob data
    if (event.data instanceof Blob) {
      // Convert Blob to text asynchronously
      event.data.text().then((text: string) => {
        try {
          const message = JSON.parse(text);
          
          if (verbose) {
            console.log('📨 Kalshi message received:', message);
          }
          
          // Handle different message types
          if (isKalshiOrderBookMessage(message)) {
            handleOrderBookMessage(message);
          // } else if (isKalshiMarketMessage(message)) {
          //   handleMarketMessage(message);
          // } else if (isKalshiTradeMessage(message)) {
          //   handleTradeMessage(message);
          } else if (message.type === 'subscribed') {
            handleSubscriptionSuccess(message);
          } else if (message.type === 'error') {
            handleSubscriptionError(message);
          } else {
            if (verbose) {
              // console.log('📨 Unknown Kalshi message type:', message);
            }
          }
          
          // Call the general message handler
          if (eventHandlers?.onMessage) {
            eventHandlers.onMessage(message);
          }
        } catch (parseError) {
          console.error('❌ Error parsing Kalshi message:', parseError);
        }
      }).catch((error: Error) => {
        console.error('❌ Error converting Blob to text:', error);
      });
      return;
    }
    
    const message = JSON.parse(event.data);
    
    if (verbose) {
      console.log('📨 Kalshi message received:', message);
    }
    
    // Handle different message types
    if (isKalshiOrderBookMessage(message)) {
      handleOrderBookMessage(message);
    } else if (isKalshiMarketMessage(message)) {
      handleMarketMessage(message);
    } else if (isKalshiTradeMessage(message)) {
      handleTradeMessage(message);
    } else if (message.type === 'subscribed') {
      handleSubscriptionSuccess(message);
    } else if (message.type === 'error') {
      handleSubscriptionError(message);
    }
    
    // Call the general message handler
    if (eventHandlers?.onMessage) {
      eventHandlers.onMessage(message);
    }
    
  } catch (error) {
    console.error('❌ Error processing Kalshi message:', error);
  }
}

/**
 * Handle orderbook message
 */
function handleOrderBookMessage(message: KalshiOrderBookMessage): void {
  try {
    const ticker = message.msg.market_ticker;

    
    
    if (isKalshiOrderBookSnapshot(message)) {
      // RAW DATA FROM WEBSOCKET


        console.log('RAW DATA FROM WEBSOCKET', {
          ticker,
          type: message.type,
          yes: message.msg.yes,
          no: message.msg.no
        });

      
      
      // Handle snapshot
      const { yesBids, yesAsks, noBids, noAsks } = parseKalshiOrderBookSnapshot(message);
      
      // PARSED DATA BEFORE CONTEXT
      console.log('PARSED DATA BEFORE CONTEXT', {
        ticker,
        yesBids,
        yesAsks,
        noBids,
        noAsks
      });
      
      // Dispatch Yes outcome orderbook to OrderBookContext
      const dispatch = getOrderBookDispatch();
      if (dispatch) {
        // Create clobId for Yes outcome (ticker + '_yes')
        const yesClobId = `${ticker}_yes`;
        
        dispatch({
          type: 'SET_ORDER_BOOK',
          marketId: '', // Not needed since we're using clobId as the key
          clobId: yesClobId,
          bids: yesBids,
          asks: yesAsks,
          timestamp: Date.now()
        });
        
        // Create clobId for No outcome (ticker + '_no')
        const noClobId = `${ticker}_no`;
        
        dispatch({
          type: 'SET_ORDER_BOOK',
          marketId: '', // Not needed since we're using clobId as the key
          clobId: noClobId,
          bids: noBids,
          asks: noAsks,
          timestamp: Date.now()
        });
      }
      
      // Store in local orderbooks map
      orderbooks.set(ticker, {
        yes: { bids: yesBids, asks: yesAsks },
        no: { bids: noBids, asks: noAsks },
        timestamp: Date.now()
      });
      
    } else if (isKalshiOrderBookDelta(message)) {
      // Handle delta updates
      const { price, delta, side } = message.msg;
      const marketPrice = 1 - (price / 100); // Convert cents to decimal, then invert to market probability
      
      // Update local orderbook
      const existingOrderbook = orderbooks.get(ticker);
      if (existingOrderbook) {
        const outcomeData = side === 'yes' ? existingOrderbook.yes : existingOrderbook.no;
        
        // Since Kalshi only provides ASK orders, delta updates should be applied to asks
        const priceIndex = outcomeData.asks.findIndex((ask: any) => ask.price === marketPrice);
        if (priceIndex !== -1) {
          outcomeData.asks[priceIndex].size += delta;
          if (outcomeData.asks[priceIndex].size <= 0) {
            outcomeData.asks.splice(priceIndex, 1);
          }
        } else if (delta > 0) {
          outcomeData.asks.push({
            price: marketPrice,
            size: delta,
            side: 'ask'
          });
        }
        
        // Re-sort asks (lowest first)
        outcomeData.asks.sort((a: any, b: any) => a.price - b.price);
        
        // Dispatch updated orderbook to OrderBookContext NEEDS FIXING
        // const dispatch = getOrderBookDispatch();
        // if (dispatch) {
        //   const clobId = `${ticker}_${side}`;
          
        //   dispatch({
        //     type: 'UPDATE_ORDER_BOOK',
        //     marketId: '',
        //     clobId: clobId,
        //     bids: outcomeData.bids,
        //     asks: outcomeData.asks
        //   });
        // }
      }
    }
    
    if (eventHandlers?.onOrderBookUpdate) {
      eventHandlers.onOrderBookUpdate(message);
    }
    
  } catch (error) {
    console.error('❌ Error handling Kalshi orderbook message:', error);
  }
}

/**
 * Handle market message
 */
function handleMarketMessage(message: KalshiMarketMessage): void {
  if (verbose) {
    console.log('📈 Kalshi market update:', message.market_ticker, message.status);
  }
  
  if (eventHandlers?.onMarketUpdate) {
    eventHandlers.onMarketUpdate(message);
  }
}

/**
 * Handle trade message
 */
function handleTradeMessage(message: KalshiTradeMessage): void {
  if (verbose) {
    console.log('💰 Kalshi trade:', message.market_ticker, message.outcome, message.price, message.size);
  }
  
  if (eventHandlers?.onTradeUpdate) {
    eventHandlers.onTradeUpdate(message);
  }
}

/**
 * Handle authentication success
 */
// Elections endpoint authenticates via API key in the handshake; no explicit auth messages

/**
 * Handle subscription success
 */
function handleSubscriptionSuccess(message: any): void {
  console.log('✅ Kalshi subscription successful:', message);
}

/**
 * Handle subscription error
 */
function handleSubscriptionError(message: any): void {
  console.error('❌ Kalshi subscription failed:', message);
}


/**
 * Subscribe to orderbook updates
 */
function subscribeToOrderBooks(): void {
  if (!ws) return;
  
  const subscriptionMessage: KalshiSubscriptionMessage = {
    id: commandId++,
    cmd: 'subscribe',
    params: {
      channels: ['orderbook_snapshot', 'orderbook_delta'],
      market_tickers: subscribedTickers
    }
  };
  
  console.log(`📡 Subscribing to ${subscribedTickers.length} Kalshi tickers`);
  ws.send(JSON.stringify(subscriptionMessage));
}

/**
 * Handle WebSocket open
 */
function onOpen(): void {
  console.log('🔌 Kalshi WebSocket connection opened successfully!');
  reconnectAttempts = 0;
  
  // Update connection status in OrderBookContext
  const dispatch = getOrderBookDispatch();
  if (dispatch) {
    dispatch({ type: 'SET_CONNECTION_STATUS', isConnected: true });
  }
  
  // Elections API doesn't require authentication - subscribe directly
  subscribeToOrderBooks();
  
  // Start ping interval
  pingInterval = setInterval(() => {
    if (ws && ws.readyState === 1) { // WebSocket.OPEN = 1
      ws.send(JSON.stringify({ type: 'ping' }));
    }
  }, 30000); // Kalshi recommends 30 second pings
  
  if (eventHandlers?.onConnect) {
    eventHandlers.onConnect();
  }
}

/**
 * Handle WebSocket error
 */
function onError(event: Event): void {
  console.error('❌ Kalshi WebSocket error:', event);
  console.error('❌ WebSocket readyState:', ws?.readyState);
  console.error('❌ WebSocket URL:', ws?.url);
  
  // Update connection status in OrderBookContext
  const dispatch = getOrderBookDispatch();
  if (dispatch) {
    dispatch({ type: 'SET_CONNECTION_STATUS', isConnected: false });
  }
  
  if (eventHandlers?.onError) {
    eventHandlers.onError(new Error('Kalshi WebSocket error'));
  }
  
  attemptReconnect();
}

/**
 * Handle WebSocket close
 */
function onClose(event: CloseEvent): void {
  console.log('🔌 Kalshi WebSocket closed:', event.code, event.reason);
  
  // Update connection status in OrderBookContext
  const dispatch = getOrderBookDispatch();
  if (dispatch) {
    dispatch({ type: 'SET_CONNECTION_STATUS', isConnected: false });
  }
  
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
  
  if (eventHandlers?.onDisconnect) {
    eventHandlers.onDisconnect(event.code, event.reason);
  }
  
  attemptReconnect();
}

/**
 * Attempt to reconnect
 */
function attemptReconnect(): void {
  if (reconnectAttempts < maxReconnectAttempts) {
    reconnectAttempts++;
    console.log(`🔄 Attempting to reconnect Kalshi WebSocket (${reconnectAttempts}/${maxReconnectAttempts})...`);
    
    // Don't clear orderbooks on reconnect - keep existing data from both Kalshi and Polymarket
    
    setTimeout(() => {
      if (ws) {
        ws = new WebSocket(KALSHI_WS_URL);
        setupEventHandlers();
      }
    }, reconnectInterval);
  } else {
    console.error('❌ Max Kalshi reconnection attempts reached');
  }
}

/**
 * Close the WebSocket
 */
export function closeKalshiWebSocket(): void {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
  
  // Clear orderbooks in OrderBookContext
  const dispatch = getOrderBookDispatch();
  if (dispatch) {
    dispatch({ type: 'CLEAR_ORDER_BOOKS' });
  }
}

/**
 * Get WebSocket status
 */
export function getKalshiWebSocketStatus() {
  return {
    isConnected: ws ? ws.readyState === 1 : false, // WebSocket.OPEN = 1
    subscribedTickers,
    reconnectAttempts,
    orderbooksCount: orderbooks.size,
    totalTickers: allTickers.length
  };
}

/**
 * Factory function to create WebSocket connections
 */
export function createKalshiWebSocket(
  tickers: string[],
  eventHandlersParam?: KalshiWebSocketEventHandlers,
  verboseParam: boolean = false
): void {
  initKalshiWebSocket(tickers, eventHandlersParam, verboseParam);
}

// Export constants
export { KALSHI_WS_URL };
export type { KalshiSubscriptionMessage };
