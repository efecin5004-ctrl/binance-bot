import React, { useState } from 'react';

interface OrderBookDepthProps {
  symbol: string;
  orderBook: { bids: [number, number][]; asks: [number, number][] };
  recentTrades: any[];
  currentPrice: number;
}

export const OrderBookDepth: React.FC<OrderBookDepthProps> = ({
  symbol,
  orderBook,
  recentTrades,
  currentPrice
}) => {
  const [activeTab, setActiveTab] = useState<'book' | 'trades'>('book');

  // Compute depth max volume for percentage bars
  const asks = orderBook.asks.slice(0, 10);
  const bids = orderBook.bids.slice(0, 10);

  const maxAskVol = Math.max(...asks.map(a => a[1]), 1);
  const maxBidVol = Math.max(...bids.map(b => b[1]), 1);
  const maxVol = Math.max(maxAskVol, maxBidVol);

  const bestBid = bids[0] ? bids[0][0] : currentPrice;
  const bestAsk = asks[0] ? asks[0][0] : currentPrice;
  const spread = Math.max(0, bestAsk - bestBid);
  const spreadPercent = currentPrice > 0 ? (spread / currentPrice) * 100 : 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs flex flex-col h-full text-slate-800">
      {/* Header Tabs */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs">
        <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200">
          <button
            onClick={() => setActiveTab('book')}
            className={`px-3 py-1 rounded font-semibold transition ${
              activeTab === 'book' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Emir Defteri (L2)
          </button>
          <button
            onClick={() => setActiveTab('trades')}
            className={`px-3 py-1 rounded font-semibold transition ${
              activeTab === 'trades' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Canlı İşlemler
          </button>
        </div>

        <span className="text-[10px] text-slate-500 font-mono">
          Spread: ${spread.toFixed(2)} ({spreadPercent.toFixed(3)}%)
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 p-2 overflow-y-auto font-mono text-[11px]">
        {activeTab === 'book' ? (
          <div className="flex flex-col justify-between h-full space-y-1">
            {/* Asks (Sell Orders - Red) */}
            <div className="space-y-0.5">
              <div className="grid grid-cols-3 text-[10px] text-slate-400 px-1 pb-1 border-b border-slate-100 font-sans">
                <span>Fiyat (USDT)</span>
                <span className="text-right">Miktar</span>
                <span className="text-right">Toplam</span>
              </div>
              {asks.slice(0, 8).reverse().map(([price, qty], idx) => {
                const widthPercent = Math.min(100, (qty / maxVol) * 100);
                return (
                  <div key={idx} className="relative grid grid-cols-3 px-1 py-0.5 hover:bg-slate-50 rounded">
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-rose-50 pointer-events-none rounded"
                      style={{ width: `${widthPercent}%` }}
                    />
                    <span className="text-rose-600 font-bold z-10">${price.toFixed(2)}</span>
                    <span className="text-right text-slate-700 z-10">{qty.toFixed(4)}</span>
                    <span className="text-right text-slate-500 z-10">{(price * qty).toFixed(0)}</span>
                  </div>
                );
              })}
            </div>

            {/* Current Middle Price */}
            <div className="py-1.5 my-1 px-2 rounded bg-slate-50 border border-slate-200 flex items-center justify-between font-bold">
              <span className="text-xs text-slate-900">${currentPrice.toFixed(2)}</span>
              <span className="text-[10px] text-slate-500 font-normal">Son Fiyat</span>
            </div>

            {/* Bids (Buy Orders - Green) */}
            <div className="space-y-0.5">
              {bids.slice(0, 8).map(([price, qty], idx) => {
                const widthPercent = Math.min(100, (qty / maxVol) * 100);
                return (
                  <div key={idx} className="relative grid grid-cols-3 px-1 py-0.5 hover:bg-slate-50 rounded">
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-emerald-50 pointer-events-none rounded"
                      style={{ width: `${widthPercent}%` }}
                    />
                    <span className="text-emerald-600 font-bold z-10">${price.toFixed(2)}</span>
                    <span className="text-right text-slate-700 z-10">{qty.toFixed(4)}</span>
                    <span className="text-right text-slate-500 z-10">{(price * qty).toFixed(0)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Recent Trades Stream */
          <div className="space-y-1">
            <div className="grid grid-cols-3 text-[10px] text-slate-400 px-1 pb-1 border-b border-slate-100 font-sans">
              <span>Fiyat</span>
              <span className="text-right">Miktar</span>
              <span className="text-right">Zaman</span>
            </div>
            {recentTrades.slice(0, 15).map((trade, idx) => {
              const isSell = trade.isBuyerMaker;
              return (
                <div key={trade.id || idx} className="grid grid-cols-3 px-1 py-0.5 hover:bg-slate-50 rounded">
                  <span className={`font-semibold ${isSell ? 'text-rose-600' : 'text-emerald-600'}`}>
                    ${trade.price.toFixed(2)}
                  </span>
                  <span className="text-right text-slate-700">{trade.qty.toFixed(4)}</span>
                  <span className="text-right text-slate-500">
                    {new Date(trade.time).toLocaleTimeString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
