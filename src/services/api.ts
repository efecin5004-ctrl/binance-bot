import { Kline, MarketTicker } from '../types/trading';

export async function getKlines(
  symbol: string = 'BTCUSDT',
  interval: string = '1h',
  limit: number = 200
): Promise<Kline[]> {
  try {
    const res = await fetch(`/api/binance/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
    if (!res.ok) throw new Error(`Binance API error: ${res.statusText}`);
    const data = await res.json();
    return data.klines || [];
  } catch (error) {
    console.error('Failed to get klines:', error);
    throw error;
  }
}

export async function get24hrTicker(symbol?: string): Promise<MarketTicker | MarketTicker[]> {
  try {
    const url = symbol ? `/api/binance/ticker?symbol=${symbol}` : `/api/binance/ticker`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to get ticker');
    const data = await res.json();
    if (Array.isArray(data)) {
      return data.map((d: any) => ({
        symbol: d.symbol,
        lastPrice: parseFloat(d.lastPrice),
        priceChangePercent: parseFloat(d.priceChangePercent),
        highPrice: parseFloat(d.highPrice),
        lowPrice: parseFloat(d.lowPrice),
        volume: parseFloat(d.volume),
        quoteVolume: parseFloat(d.quoteVolume)
      }));
    }
    return {
      symbol: data.symbol,
      lastPrice: parseFloat(data.lastPrice),
      priceChangePercent: parseFloat(data.priceChangePercent),
      highPrice: parseFloat(data.highPrice),
      lowPrice: parseFloat(data.lowPrice),
      volume: parseFloat(data.volume),
      quoteVolume: parseFloat(data.quoteVolume)
    };
  } catch (error) {
    console.error('Failed to get ticker:', error);
    throw error;
  }
}

export async function getOrderBookDepth(symbol: string = 'BTCUSDT', limit: number = 20) {
  try {
    const res = await fetch(`/api/binance/depth?symbol=${symbol}&limit=${limit}`);
    if (!res.ok) throw new Error('Failed to get depth');
    const data = await res.json();
    return {
      bids: (data.bids || []).map((b: [string, string]) => [parseFloat(b[0]), parseFloat(b[1])]),
      asks: (data.asks || []).map((a: [string, string]) => [parseFloat(a[0]), parseFloat(a[1])])
    };
  } catch (error) {
    console.error('Failed to get depth:', error);
    return { bids: [], asks: [] };
  }
}

export async function getRecentTrades(symbol: string = 'BTCUSDT', limit: number = 30) {
  try {
    const res = await fetch(`/api/binance/trades?symbol=${symbol}&limit=${limit}`);
    if (!res.ok) throw new Error('Failed to get trades');
    const data = await res.json();
    return data.map((t: any) => ({
      id: t.id,
      price: parseFloat(t.price),
      qty: parseFloat(t.qty),
      quoteQty: parseFloat(t.quoteQty),
      time: t.time,
      isBuyerMaker: t.isBuyerMaker // true: Sell, false: Buy
    }));
  } catch (error) {
    console.error('Failed to get trades:', error);
    return [];
  }
}

export async function testBinanceApiConnection(
  apiKey: string,
  apiSecret: string,
  isTestnet: boolean
) {
  const res = await fetch('/api/binance/test-connection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey, apiSecret, isTestnet })
  });
  return res.json();
}

export async function executeBinanceOrder(orderParams: {
  apiKey: string;
  apiSecret: string;
  isTestnet: boolean;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  quantity: number;
  price?: number;
  timeInForce?: string;
}) {
  const res = await fetch('/api/binance/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderParams)
  });
  return res.json();
}

export async function fetchAiMarketAnalysis(payload: {
  symbol: string;
  currentPrice: number;
  interval: string;
  indicators: any;
  recentCandles: any[];
}) {
  const res = await fetch('/api/ai/market-analysis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

export async function fetchAiQuantResearch(payload: {
  mode: 'GENERATE_HYPOTHESIS' | 'AUDIT_STRATEGY';
  strategy?: any;
  metrics?: any;
  family?: string;
}) {
  const res = await fetch('/api/ai/quant-research', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

/**
 * Fetches deep historical klines (e.g. 500-1000 candles) for institutional quant backtesting
 */
export async function getDeepHistoricalKlines(
  symbol: string = 'BTCUSDT',
  interval: string = '1h',
  limit: number = 1000
): Promise<Kline[]> {
  try {
    const res = await fetch(`/api/binance/klines?symbol=${symbol}&interval=${interval}&limit=${Math.min(limit, 1000)}`);
    if (!res.ok) throw new Error(`Binance API error: ${res.statusText}`);
    const data = await res.json();
    return data.klines || [];
  } catch (error) {
    console.error('Failed to get deep historical klines:', error);
    throw error;
  }
}

export async function sendTelegramNotification(
  botToken: string,
  chatId: string,
  message: string
) {
  const res = await fetch('/api/alerts/telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ botToken, chatId, message })
  });
  return res.json();
}

// ----------------------------------------------------
// 7/24 AUTONOMOUS SERVER ENGINE CLIENT API
// ----------------------------------------------------
export async function fetchServerBotState() {
  try {
    const res = await fetch('/api/bot/state');
    if (!res.ok) throw new Error('Failed to fetch server state');
    return await res.json();
  } catch (e) {
    console.error('Server bot state fetch error:', e);
    return null;
  }
}

export async function controlServerBot(action: 'START' | 'PAUSE' | 'EMERGENCY_STOP') {
  const res = await fetch('/api/bot/control', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action })
  });
  return res.json();
}

export async function syncServerBotConfig(partialConfig: any) {
  try {
    const res = await fetch('/api/bot/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partialConfig)
    });
    return await res.json();
  } catch (e) {
    console.error('Sync config error:', e);
    return null;
  }
}

export async function executeServerManualOrder(orderParams: {
  symbol: string;
  side: 'LONG' | 'SHORT';
  orderType: 'MARKET' | 'LIMIT';
  quantityUsdt: number;
  leverage: number;
  stopLoss?: number;
  takeProfit?: number;
}) {
  const res = await fetch('/api/bot/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderParams)
  });
  return res.json();
}

export async function closeServerPosition(positionId: string) {
  const res = await fetch('/api/bot/close-position', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ positionId })
  });
  return res.json();
}

export async function resetServerAccount(balance: number = 10000) {
  const res = await fetch('/api/bot/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ balance })
  });
  return res.json();
}

