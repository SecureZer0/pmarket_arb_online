// Use browser's built-in WebSocket API
import {
  PolymarketWebSocketResponse,
  PolymarketMarketMessage,
  PolymarketBookMessage,
  PolymarketPriceChangeMessage,
  PolymarketTickSizeChangeMessage,
  PolymarketOrderBook,
  PolymarketWebSocketEventHandlers,
  isPolymarketMarketMessage,
  isPolymarketBookMessage,
  isPolymarketPriceChangeMessage,
  isPolymarketTickSizeChangeMessage,
  parsePolymarketBookMessage
} from '../types/polymarket-websocket';
import { getOrderBookDispatch } from '../contexts/OrderBookContext';

const MARKET_CHANNEL = "market";

interface WebSocketSubscriptionMessage {
  assets_ids: string[];
  type: string;
  initial_dump?: boolean;
}

// Global state
let ws: WebSocket | null = null;
let orderbooks = new Map<string, PolymarketOrderBook>();
let pingInterval: NodeJS.Timeout | null = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectInterval = 5000;
let eventHandlers: PolymarketWebSocketEventHandlers | undefined;
let verbose = false;
let channelType = "";
let url = "";
let data: string[] = [];

// Simple state - no batching
const MAX_CLOB_IDS = 500;
let allClobIds: string[] = [];

/**
 * Initialize websocket connection
 */
export function initPolymarketWebSocket(
  dataParam: string[],
  eventHandlersParam?: PolymarketWebSocketEventHandlers,
  verboseParam: boolean = false
): void {
  channelType = MARKET_CHANNEL;
  url = "wss://ws-subscriptions-clob.polymarket.com";
  data = dataParam;
  eventHandlers = eventHandlersParam;
  verbose = verboseParam;
  
  // Limit to max 500 clobIds
  allClobIds = dataParam.slice(0, MAX_CLOB_IDS);
  
  if (dataParam.length > MAX_CLOB_IDS) {
    console.log(`⚠️ Limited to first ${MAX_CLOB_IDS} clobIds (was ${dataParam.length})`);
  }
  
  // Clear existing orderbooks in OrderBookContext when initializing new connection
  // const dispatch = getOrderBookDispatch();
  // if (dispatch) {
  //   dispatch({ type: 'CLEAR_ORDER_BOOKS' });
  // }
  
  const fullUrl = `${url}/ws/${channelType}`;
  ws = new WebSocket(fullUrl);

  console.log(`WebSocket initialized with ${allClobIds.length} clobIds`);
  
  setupEventHandlers();
}

/**
 * Setup websocket event handlers
 */
function setupEventHandlers(): void {
  if (!ws) return;
  
  ws.addEventListener('message', onMessage);
  ws.addEventListener('error', onError);
  ws.addEventListener('close', onClose);
  ws.addEventListener('open', onOpen);
}


/**
 * Handle incoming websocket messages
 */
function onMessage(event: MessageEvent): void {
  try {
    const message = event.data;
    
    // Parse the message
    const parsedMessage = parseMessage(message);
    
    if (parsedMessage && isPolymarketMarketMessage(parsedMessage)) {
      handleMarketMessage(parsedMessage);
    } else if (Array.isArray(parsedMessage) && parsedMessage.length > 0) {
      // Array of messages - process each one
      parsedMessage.forEach((msg: any) => {
        if (isPolymarketMarketMessage(msg)) {
          handleMarketMessage(msg);
        }
      });
    } else if (Array.isArray(parsedMessage) && parsedMessage.length === 0) {
      // Empty array response (initial connection)
      console.log('📭 Received empty array response - connection confirmed');
    }
    
    // Call the general message handler
    if (eventHandlers?.onMessage && parsedMessage) {
      eventHandlers.onMessage(parsedMessage);
    }
    
  } catch (error) {
    console.error('Error processing message:', error);
  }
}

/**
 * Parse websocket message
 */
function parseMessage(message: string): PolymarketWebSocketResponse | null {
  try {
    if (message === 'PONG') {
      return null; // Ignore PONG messages
    }
    return JSON.parse(message);
  } catch (error) {
    console.error('Failed to parse message:', error);
    return null;
  }
}

/**
 * Handle market message
 */
function handleMarketMessage(message: PolymarketMarketMessage): void {
  switch (message.event_type) {
    case 'book':
      handleBookMessage(message as PolymarketBookMessage);
      break;
    // case 'price_change':
    //   handlePriceChangeMessage(message as PolymarketPriceChangeMessage);
    //   break;
    // case 'tick_size_change':
    //   handleTickSizeChangeMessage(message as PolymarketTickSizeChangeMessage);
    //   break;
    default: {
      // Silently ignore unhandled event types (like price_change)
      // We only handle 'book' events for now
    }
  }
}

/**
 * Handle book message
 */
function handleBookMessage(message: PolymarketBookMessage): void {
  try {
    // Parse the raw message data directly for OrderBookContext
    const bids = message.bids.map(bid => ({
      price: bid.price,
      size: bid.size
    }));
    
    const asks = message.asks.map(ask => ({
      price: ask.price,
      size: ask.size
    }));
    
    // Dispatch to OrderBookContext first (using raw data)
    const dispatch = getOrderBookDispatch();
    if (dispatch) {
      dispatch({
        type: 'SET_ORDER_BOOK',
        marketId: '', // Not needed since we're using clobId as the key
        clobId: message.asset_id, // This is the clobId
        bids: bids,
        asks: asks,
        timestamp: message.timestamp ? parseInt(message.timestamp) : undefined
      });
    }
    
    // Then parse for internal storage (using parsed data with side field)
    const orderbook = parsePolymarketBookMessage(message);
    const key = message.asset_id;
    orderbooks.set(key, orderbook);
    
    // Log progress every 50 orderbooks
    if (orderbooks.size % 50 === 0) {
      console.log(`📊 Orderbooks received: ${orderbooks.size} / ${allClobIds.length} (${Math.round((orderbooks.size / allClobIds.length) * 100)}%)`);
    }
    
    // Removed spammy batch logging
    
    
    if (eventHandlers?.onBookUpdate) {
      eventHandlers.onBookUpdate(message);
    }
    
  } catch (error) {
    console.error('Error handling book message:', error);
  }
}

/**
 * Handle price change message
 */
function handlePriceChangeMessage(message: PolymarketPriceChangeMessage): void {
  try {
    // Process each price change in the message
    message.price_changes.forEach(change => {
      const key = change.asset_id; // Use asset_id as the key since it equals clobId
      const orderbook = orderbooks.get(key);
      
      if (orderbook) {
        // Update the orderbook with this price change
        if (change.side === 'BUY') {
          updateOrderBookLevel(orderbook.bids, parseFloat(change.price), parseFloat(change.size));
        } else {
          updateOrderBookLevel(orderbook.asks, parseFloat(change.price), parseFloat(change.size));
        }
        
        orderbook.hash = change.hash;
        orderbook.lastUpdate = Date.now();
        
        if (verbose) {
          console.log('Price change applied to orderbook for', key);
        }
        
        // Dispatch updated orderbook to OrderBookContext
        const dispatch = getOrderBookDispatch();
        if (dispatch) {
          // For UPDATE_ORDER_BOOK, we need to include the side field
          const bids = orderbook.bids.map(bid => ({
            price: bid.price,
            size: bid.size,
            side: bid.side
          }));
          
          const asks = orderbook.asks.map(ask => ({
            price: ask.price,
            size: ask.size,
            side: ask.side
          }));
          
          dispatch({
            type: 'UPDATE_ORDER_BOOK',
            marketId: '', // Not needed since we're using clobId as the key
            clobId: change.asset_id, // This is the clobId
            bids: bids,
            asks: asks
          });
        
          if (verbose) {
            console.log('✅ Dispatched price change update to OrderBookContext:', change.asset_id);
          }
        }
      }
    });
    
    if (eventHandlers?.onPriceChange) {
      eventHandlers.onPriceChange(message);
    }
    
  } catch (error) {
    console.error('Error handling price change message:', error);
  }
}

/**
 * Handle tick size change message
 */
function handleTickSizeChangeMessage(message: PolymarketTickSizeChangeMessage): void {
  if (verbose) {
    console.log('Tick size changed for', message.asset_id, 'from', message.old_tick_size, 'to', message.new_tick_size);
  }
  
  if (eventHandlers?.onTickSizeChange) {
    eventHandlers.onTickSizeChange(message);
  }
}

/**
 * Update order book level
 */
function updateOrderBookLevel(levels: any[], price: number, size: number): void {
  const existingIndex = levels.findIndex(level => level.price === price);
  
  if (size === 0) {
    // Remove the price level if size is 0
    if (existingIndex !== -1) {
      levels.splice(existingIndex, 1);
    }
  } else {
    if (existingIndex !== -1) {
      // Update existing level
      levels[existingIndex].size = size;
    } else {
      // Add new level
      levels.push({ price, size, side: levels === orderbooks.values().next().value?.bids ? 'bid' : 'ask' });
    }
    
    // Re-sort the levels
    if (levels === orderbooks.values().next().value?.bids) {
      levels.sort((a, b) => b.price - a.price); // Bids: highest first
    } else {
      levels.sort((a, b) => a.price - b.price); // Asks: lowest first
    }
  }
}

/**
 * Handle websocket error
 */
function onError(event: Event): void {
  console.error('WebSocket error:', event);
  
  // Update connection status in OrderBookContext
  const dispatch = getOrderBookDispatch();
  if (dispatch) {
    dispatch({ type: 'SET_CONNECTION_STATUS', isConnected: false });
  }
  
  if (eventHandlers?.onError) {
    eventHandlers.onError(new Error('WebSocket error'));
  }
  
  attemptReconnect();
}

/**
 * Handle websocket close
 */
function onClose(event: CloseEvent): void {
  console.log('WebSocket closed:', event.code, event.reason);
  
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
 * Handle websocket open
 */
function onOpen(): void {
  console.log(`WebSocket ${channelType} connection opened`);
  reconnectAttempts = 0;
  
  // Update connection status in OrderBookContext
  const dispatch = getOrderBookDispatch();
  if (dispatch) {
    dispatch({ type: 'SET_CONNECTION_STATUS', isConnected: true });
  }
  
  // Send single subscription for all clobIds
  console.log(`🚀 Subscribing to ${allClobIds.length} clobIds`);
  
  const subscriptionMessage: WebSocketSubscriptionMessage = {
    assets_ids: allClobIds,
    type: MARKET_CHANNEL,
    initial_dump: true
  };
  
  console.log(`📡 Sending subscription for ${allClobIds.length} clobIds (initial_dump: true)`);
  if (ws) {
    ws.send(JSON.stringify(subscriptionMessage));
  }
  
  // Start ping interval
  pingInterval = setInterval(() => {
    if (ws && ws.readyState === 1) { // WebSocket.OPEN = 1
      ws.send('PING');
    }
  }, 10000);
  
  if (eventHandlers?.onConnect) {
    eventHandlers.onConnect();
  }
}

/**
 * Attempt to reconnect
 */
function attemptReconnect(): void {
  if (reconnectAttempts < maxReconnectAttempts) {
    reconnectAttempts++;
    console.log(`Attempting to reconnect (${reconnectAttempts}/${maxReconnectAttempts})...`);
    
    // Reset state for reconnection
    
    // Don't clear orderbooks on reconnect - keep existing data
    
    setTimeout(() => {
      if (ws) {
        ws = new WebSocket(`${url}/ws/${channelType}`);
        setupEventHandlers();
      }
    }, reconnectInterval);
  } else {
    console.error('Max reconnection attempts reached');
  }
}

/**
 * Run the websocket
 */
export function runPolymarketWebSocket(): void {
  if (ws) {
    ws.addEventListener('open', () => {
      console.log(`WebSocket ${channelType} is running`);
    });
  }
}

/**
 * Close the websocket
 */
export function closePolymarketWebSocket(): void {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
  
  // Don't clear orderbooks when closing - keep existing data
}

/**
 * Get websocket status
 */
export function getWebSocketStatus() {
  return {
    isConnected: ws ? ws.readyState === 1 : false, // WebSocket.OPEN = 1
    channel: channelType,
    subscribedAssets: data,
    reconnectAttempts,
    orderbooksCount: orderbooks.size,
    totalClobIds: allClobIds.length
  };
}

/**
 * Factory function to create websocket connections
 */
export function createPolymarketWebSocket(
  dataParam: string[],
  eventHandlersParam?: PolymarketWebSocketEventHandlers,
  verboseParam: boolean = false
): void {
  initPolymarketWebSocket(dataParam, eventHandlersParam, verboseParam);
}

// Export constants
export { MARKET_CHANNEL };
export type { WebSocketSubscriptionMessage };
