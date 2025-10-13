import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { OrderBookLevel, OrderBookSummary } from '../types/shared';
import { 
  OrderBookState, 
  OrderBookAction, 
  OrderBookContextValue, 
  MarketOrderBook,
  SetOrderBookParams 
} from '../types/orderbook';

// Re-export types that are used by other modules
export type { OrderBookAction };

// Global dispatch registration so non-React modules (e.g., websocket) can dispatch safely
let orderBookDispatchRef: React.Dispatch<OrderBookAction> | null = null;
export function registerOrderBookDispatch(dispatch: React.Dispatch<OrderBookAction>) {
  orderBookDispatchRef = dispatch;
}
export function getOrderBookDispatch(): React.Dispatch<OrderBookAction> | null {
  return orderBookDispatchRef;
}

const OrderBookContext = createContext<OrderBookContextValue | null>(null);

export const useOrderBook = () => {
  const context = useContext(OrderBookContext);
  if (!context) {
    throw new Error('useOrderBook must be used within OrderBookProvider');
  }
  return context;
};

function toLevels(levels: OrderBookSummary[], side: 'bid' | 'ask'): OrderBookLevel[] {
  return levels.map(l => ({
    price: typeof l.price === 'string' ? parseFloat(l.price) : l.price,
    size: typeof l.size === 'string' ? parseFloat(l.size) : l.size,
    side
  }));
}

const orderBookReducer = (state: OrderBookState, action: OrderBookAction): OrderBookState => {
  switch (action.type) {
    case 'SET_ORDER_BOOK': {
      const { clobId } = action;
      // Use clobId as the key since it equals asset_id and is unique
      const key = clobId;
      
      const bids = toLevels(action.bids, 'bid');
      const asks = toLevels(action.asks, 'ask');
      
      const newOrderBook = {
        bids: new Map(bids.map(bid => [bid.price, bid])),
        asks: new Map(asks.map(ask => [ask.price, ask])),
        lastUpdate: action.timestamp ?? Date.now()
      };
      
      const nextState = {
        ...state,
        orderBooks: {
          ...state.orderBooks,
          [key]: newOrderBook
        },
        lastUpdate: Date.now()
      };
      
      // DATA IN CONTEXT AFTER
      // console.log('DATA IN CONTEXT AFTER', {
      //   clobId,
      //   bidsCount: bids.length,
      //   asksCount: asks.length
      // });
      
      return nextState;
    }
    case 'UPDATE_ORDER_BOOK': {
      const key = action.clobId;
      const updatedOrderBook = {
        bids: new Map(action.bids.map((bid: OrderBookLevel) => [bid.price, bid])),
        asks: new Map(action.asks.map((ask: OrderBookLevel) => [ask.price, ask])),
        lastUpdate: Date.now()
      };
      
      return {
        ...state,
        orderBooks: {
          ...state.orderBooks,
          [key]: updatedOrderBook
        },
        lastUpdate: Date.now()
      };
    }
    case 'SET_CONNECTION_STATUS':
      console.log('🔌 SET_CONNECTION_STATUS:', action.isConnected);
      return { ...state, isConnected: action.isConnected };
    case 'CLEAR_ORDER_BOOKS':
      console.log('🗑️ CLEAR_ORDER_BOOKS - Clearing all orderbooks');
      return { ...state, orderBooks: {}, lastUpdate: Date.now() };
    default:
      return state;
  }
};

export const OrderBookProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(orderBookReducer, {
    orderBooks: {},
    isConnected: false,
    lastUpdate: 0
  });


  // Removed spammy orderbook logging
  // Register global dispatch reference
  registerOrderBookDispatch(dispatch);

  return (
    <OrderBookContext.Provider value={{ state, dispatch }}>
      {children}
    </OrderBookContext.Provider>
  );
};

// Action helpers (not auto-wired anywhere; call from your websocket handler)
export function setOrderBook(
  dispatch: React.Dispatch<OrderBookAction>,
  params: SetOrderBookParams
) {
  dispatch({ type: 'SET_ORDER_BOOK', ...params });
}

export function setConnectionStatus(
  dispatch: React.Dispatch<OrderBookAction>,
  isConnected: boolean
) {
  dispatch({ type: 'SET_CONNECTION_STATUS', isConnected });
}

export function clearOrderBooks(dispatch: React.Dispatch<OrderBookAction>) {
  dispatch({ type: 'CLEAR_ORDER_BOOKS' });
}

// Add a selector hook for getting orderbook by clobId
export function useOrderBookByClobId(clobId: string): MarketOrderBook | undefined {
  const { state } = useOrderBook();
  const orderbook = state.orderBooks[clobId];
  
  return orderbook;
}

// Helper function to get orderbook by clobId (for non-React contexts)
export function getOrderBookByClobId(clobId: string): MarketOrderBook | undefined {
  // This would need access to the current state
  // For now, return undefined - use the hook in React components
  return undefined;
}
