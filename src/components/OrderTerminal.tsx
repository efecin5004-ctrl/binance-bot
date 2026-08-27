import React, { useState } from 'react';
import { DollarSign, Shield, Zap, Sliders, ArrowUpRight, ArrowDownRight, CheckCircle2 } from 'lucide-react';

interface OrderTerminalProps {
  symbol: string;
  currentPrice: number;
  paperBalance: number;
  tradingMode: string;
  onPlaceOrder: (params: any) => Promise<{ success: boolean; message?: string }>;
}

export const OrderTerminal: React.FC<OrderTerminalProps> = ({
  symbol,
  currentPrice,
  paperBalance,
  tradingMode,
  onPlaceOrder
}) => {
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT' | 'TWAP' | 'ICEBERG'>('MARKET');
  const [amountUsdt, setAmountUsdt] = useState<number>(200);
  const [limitPrice, setLimitPrice] = useState<number>(currentPrice || 50000);
  const [leverage, setLeverage] = useState<number>(1);
  const [enableSlTp, setEnableSlTp] = useState<boolean>(true);
  const [stopLossPercent, setStopLossPercent] = useState<number>(2.0);
  const [takeProfitPercent, setTakeProfitPercent] = useState<number>(4.0);
  
  // Algorithmic TWAP / Iceberg options
  const [twapParts, setTwapParts] = useState<number>(5);
  const [twapMinutes, setTwapMinutes] = useState<number>(10);
  const [icebergDisplayQty, setIcebergDisplayQty] = useState<number>(20);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sync limit price if not set
  React.useEffect(() => {
    if (limitPrice === 0 || limitPrice === 50000) {
      setLimitPrice(currentPrice);
    }
  }, [currentPrice]);

  const effectivePrice = orderType === 'LIMIT' ? limitPrice : currentPrice;
  const estimatedQuantity = effectivePrice > 0 ? (amountUsdt * leverage) / effectivePrice : 0;

  // Calculate Pre-Trade Risk & Reward in $
  const estimatedLossUsdt = (amountUsdt * leverage * stopLossPercent) / 100;
  const estimatedProfitUsdt = (amountUsdt * leverage * takeProfitPercent) / 100;
  const riskRewardRatio = stopLossPercent > 0 ? (takeProfitPercent / stopLossPercent).toFixed(2) : '0';

  const handlePercentageClick = (pct: number) => {
    const calculated = (paperBalance * pct) / 100;
    setAmountUsdt(Math.max(10, Math.round(calculated)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amountUsdt <= 0) return;

    setIsSubmitting(true);
    setFeedback(null);

    const res = await onPlaceOrder({
      symbol,
      side,
      type: orderType,
      amountUsdt,
      limitPrice: orderType === 'LIMIT' ? limitPrice : undefined,
      leverage,
      stopLossPercent: enableSlTp ? stopLossPercent : undefined,
      takeProfitPercent: enableSlTp ? takeProfitPercent : undefined,
      twapParts: orderType === 'TWAP' ? twapParts : undefined,
      twapMinutes: orderType === 'TWAP' ? twapMinutes : undefined
    });

    setIsSubmitting(false);
    if (res.success) {
      setFeedback({ type: 'success', text: 'Emir başarıyla iletildi!' });
      setTimeout(() => setFeedback(null), 3000);
    } else {
      setFeedback({ type: 'error', text: res.message || 'Emir iletilemedi' });
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs flex flex-col h-full text-slate-800">
      {/* Header */}
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Manuel & Akıllı Emir Terminali</span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">
          Bakiye: ${paperBalance.toFixed(2)} USDT
        </span>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-3.5 flex-1 overflow-y-auto text-xs">
        {/* BUY / SELL Direction Selector */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setSide('BUY')}
            className={`py-2 rounded-md font-bold text-xs flex items-center justify-center gap-1.5 transition ${
              side === 'BUY'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>AL / LONG</span>
          </button>
          <button
            type="button"
            onClick={() => setSide('SELL')}
            className={`py-2 rounded-md font-bold text-xs flex items-center justify-center gap-1.5 transition ${
              side === 'SELL'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowDownRight className="w-4 h-4" />
            <span>SAT / SHORT</span>
          </button>
        </div>

        {/* Order Type Tabs */}
        <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200 text-[11px]">
          {(['MARKET', 'LIMIT', 'TWAP', 'ICEBERG'] as const).map((ot) => (
            <button
              key={ot}
              type="button"
              onClick={() => setOrderType(ot)}
              className={`flex-1 py-1 rounded font-semibold transition ${
                orderType === ot ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {ot}
            </button>
          ))}
        </div>

        {/* Limit Price Input if Limit Order */}
        {orderType === 'LIMIT' && (
          <div>
            <label className="text-[11px] text-slate-500 mb-1 block">Limit Fiyat (USDT)</label>
            <input
              type="number"
              step="any"
              value={limitPrice}
              onChange={(e) => setLimitPrice(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-900 font-mono text-xs focus:bg-white focus:border-blue-500 outline-none"
            />
          </div>
        )}

        {/* Amount in USDT & Quick Percentage buttons */}
        <div>
          <div className="flex justify-between items-center mb-1 text-[11px]">
            <label className="text-slate-600">Pozisyon Tutarı (USDT)</label>
            <span className="text-slate-400 font-mono">
              ≈ {estimatedQuantity.toFixed(4)} {symbol.replace('USDT', '')}
            </span>
          </div>
          <input
            type="number"
            value={amountUsdt}
            onChange={(e) => setAmountUsdt(parseFloat(e.target.value) || 0)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-900 font-mono text-xs focus:bg-white focus:border-blue-500 outline-none"
            placeholder="100"
          />
          {/* Quick % buttons */}
          <div className="grid grid-cols-4 gap-1.5 mt-1.5">
            {[10, 25, 50, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => handlePercentageClick(pct)}
                className="py-1 rounded bg-slate-50 border border-slate-200 text-[10px] text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
              >
                %{pct}
              </button>
            ))}
          </div>
        </div>

        {/* Leverage Selector */}
        <div>
          <div className="flex justify-between items-center mb-1 text-[11px]">
            <label className="text-slate-600">Kaldıraç (Leverage)</label>
            <span className="font-bold text-blue-600">{leverage}x</span>
          </div>
          <div className="flex gap-1.5">
            {[1, 2, 3, 5, 10].map((lev) => (
              <button
                key={lev}
                type="button"
                onClick={() => setLeverage(lev)}
                className={`flex-1 py-1 rounded text-xs font-bold border transition ${
                  leverage === lev
                    ? 'bg-blue-50 text-blue-700 border-blue-300'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {lev}x
              </button>
            ))}
          </div>
        </div>

        {/* TWAP Specific Parameters */}
        {orderType === 'TWAP' && (
          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
            <span className="text-[10px] uppercase font-bold text-blue-700 tracking-wider">TWAP Algoritma Parametreleri</span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 block">Parça Sayısı</label>
                <input
                  type="number"
                  value={twapParts}
                  onChange={(e) => setTwapParts(parseInt(e.target.value) || 1)}
                  className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-slate-800 text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block">Toplam Süre (Dk)</label>
                <input
                  type="number"
                  value={twapMinutes}
                  onChange={(e) => setTwapMinutes(parseInt(e.target.value) || 1)}
                  className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-slate-800 text-xs font-mono"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Piyasa etkisini ve kaymayı (slippage) önlemek için her {Math.round((twapMinutes * 60) / twapParts)} saniyede bir ${(amountUsdt / twapParts).toFixed(2)} tutarında parça gönderilir.
            </p>
          </div>
        )}

        {/* Risk & Reward (SL / TP) Options */}
        <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={enableSlTp}
                onChange={(e) => setEnableSlTp(e.target.checked)}
                className="accent-blue-600 rounded"
              />
              <span className="text-[11px] font-semibold text-slate-800">Stop-Loss & Take-Profit Ekle</span>
            </label>
            <span className="text-[10px] text-slate-500 font-mono">R:R = 1:{riskRewardRatio}</span>
          </div>

          {enableSlTp && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label className="text-[10px] text-rose-600 block">Stop-Loss (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={stopLossPercent}
                  onChange={(e) => setStopLossPercent(parseFloat(e.target.value) || 0)}
                  className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-slate-800 text-xs font-mono"
                />
                <span className="text-[9px] text-slate-500 block mt-0.5 font-mono">
                  - ${estimatedLossUsdt.toFixed(2)}
                </span>
              </div>
              <div>
                <label className="text-[10px] text-emerald-600 block">Take-Profit (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={takeProfitPercent}
                  onChange={(e) => setTakeProfitPercent(parseFloat(e.target.value) || 0)}
                  className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-slate-800 text-xs font-mono"
                />
                <span className="text-[9px] text-slate-500 block mt-0.5 font-mono">
                  + ${estimatedProfitUsdt.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Feedback alert */}
        {feedback && (
          <div
            className={`p-2 rounded-lg text-xs font-semibold ${
              feedback.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {/* Submit Execution Button */}
        <button
          type="submit"
          disabled={isSubmitting || amountUsdt <= 0}
          className={`w-full py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider transition shadow-xs ${
            side === 'BUY'
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
              : 'bg-rose-600 hover:bg-rose-500 text-white'
          } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'active:scale-98'}`}
        >
          {isSubmitting
            ? 'İşleniyor...'
            : `${side === 'BUY' ? 'AL / LONG' : 'SAT / SHORT'} (${amountUsdt} USDT)`}
        </button>
      </form>
    </div>
  );
};
