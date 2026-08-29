import React, { useState, useEffect } from 'react';
import { Position, Order, SignalResult } from '../types/trading';
import { ArrowUpRight, ArrowDownRight, X, Clock, Download, Bot, User, Cpu, Zap, Sparkles, Activity, ShieldAlert, Timer, AlertCircle } from 'lucide-react';

interface PositionsAndOrdersProps {
  positions: Position[];
  orders: Order[];
  closedTrades: any[];
  signals?: SignalResult[];
  signalTimeoutMinutes?: number;
  onClosePosition: (id: string) => void;
  onCancelOrder: (id: string) => void;
}

export const PositionsAndOrders: React.FC<PositionsAndOrdersProps> = ({
  positions,
  orders,
  closedTrades,
  signals = [],
  signalTimeoutMinutes = 3,
  onClosePosition,
  onCancelOrder
}) => {
  const [activeTab, setActiveTab] = useState<'positions' | 'orders' | 'history' | 'signals'>('positions');
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  // Real-time ticking interval for live countdown TTL indicators
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const totalUnrealizedPnl = positions.reduce((acc, p) => acc + p.pnl, 0);
  const totalRealizedPnl = closedTrades.reduce((acc, t) => acc + t.pnl, 0);

  const exportHistoryCsv = () => {
    if (closedTrades.length === 0) return;
    const headers = ['ID,Symbol,Side,OpenedBy,EntryPrice,ExitPrice,Quantity,PnL_USDT,PnL_Percent,Fee_USDT,ExitTime'];
    const rows = closedTrades.map(t =>
      `"${t.id}","${t.symbol}","${t.side}","${t.openedBy || (t.botTriggered ? t.strategyName : 'Manuel')}","${t.entryPrice}",${t.exitPrice},${t.quantity},${t.pnl.toFixed(2)},${t.pnlPercent.toFixed(2)},${t.fee?.toFixed(4) || 0},"${new Date(t.exitTime).toISOString()}"`
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `binance_bot_trades_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs flex flex-col h-full text-slate-800">
      {/* Header Tabs */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs">
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200">
            <button
              onClick={() => setActiveTab('positions')}
              className={`px-3 py-1 rounded font-semibold transition flex items-center gap-1.5 ${
                activeTab === 'positions' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>Açık Pozisyonlar</span>
              <span className="px-1.5 py-0.2 rounded-full bg-blue-50 text-[10px] text-blue-600 font-mono font-bold">
                {positions.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-3 py-1 rounded font-semibold transition flex items-center gap-1.5 ${
                activeTab === 'orders' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>Bekleyen Emirler</span>
              <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-[10px] text-slate-700 font-mono">
                {orders.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1 rounded font-semibold transition flex items-center gap-1.5 ${
                activeTab === 'history' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>İşlem Geçmişi</span>
              <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-[10px] text-slate-700 font-mono">
                {closedTrades.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('signals')}
              className={`px-3 py-1 rounded font-semibold transition flex items-center gap-1.5 ${
                activeTab === 'signals' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-amber-500" />
              <span>Sinyal Akışı & Timeout</span>
              <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-[10px] text-amber-800 font-mono">
                {signals.length}
              </span>
            </button>
          </div>
        </div>

        {/* Quick Summary Pill */}
        <div className="flex items-center gap-3 text-[11px] font-mono">
          {activeTab === 'positions' && (
            <div>
              <span className="text-slate-500 mr-1">Toplam Anlık PnL:</span>
              <span className={`font-bold ${totalUnrealizedPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {totalUnrealizedPnl >= 0 ? '+' : ''}${totalUnrealizedPnl.toFixed(2)}
              </span>
            </div>
          )}
          {activeTab === 'history' && (
            <div className="flex items-center gap-3">
              <div>
                <span className="text-slate-500 mr-1">Gerçekleşen Toplam Kâr/Zarar:</span>
                <span className={`font-bold ${totalRealizedPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {totalRealizedPnl >= 0 ? '+' : ''}${totalRealizedPnl.toFixed(2)}
                </span>
              </div>
              <button
                onClick={exportHistoryCsv}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-[10px] transition font-sans font-medium"
                title="CSV Olarak İndir"
              >
                <Download className="w-3 h-3" />
                <span>CSV İndir</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-x-auto overflow-y-auto p-2">
        {/* POSITIONS TAB */}
        {activeTab === 'positions' && (
          positions.length === 0 ? (
            <div className="h-44 flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
              <Clock className="w-6 h-6 text-slate-300" />
              <p className="text-slate-600 font-medium">Şu anda açık aktif bir pozisyon bulunmuyor.</p>
              <p className="text-[11px] text-slate-400">Otomatik bot sinyalleri veya emir terminali üzerinden pozisyon açabilirsiniz.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 text-[10px] uppercase font-sans">
                  <th className="py-2 px-3">Sembol / Yön</th>
                  <th className="py-2 px-3">İşlem Kaynağı (Bot / Manuel)</th>
                  <th className="py-2 px-3">Büyüklük (USDT)</th>
                  <th className="py-2 px-3">Giriş Fiyatı</th>
                  <th className="py-2 px-3">Anlık Fiyat</th>
                  <th className="py-2 px-3">SL / TP</th>
                  <th className="py-2 px-3">Trailing / Breakeven</th>
                  <th className="py-2 px-3">PnL & ROE %</th>
                  <th className="py-2 px-3 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {positions.map((pos, idx) => {
                  const isLong = pos.side === 'LONG';
                  const isPnlPositive = pos.pnl >= 0;
                  const isBot = pos.botTriggered || Boolean(pos.strategyName);
                  const botName = pos.strategyName || pos.openedBy || 'Otomatik Strateji Botu';

                  return (
                    <tr key={pos.id ? `pos-${pos.id}-${idx}` : `pos-idx-${idx}`} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5 font-sans">
                          <span className="font-bold text-slate-900">{pos.symbol}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5 ${
                              isLong
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {isLong ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            {pos.side} {pos.leverage}x
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        {isBot ? (
                          <div className="flex flex-col gap-0.5">
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-800 text-[11px] font-bold shadow-2xs w-fit">
                              <Bot className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
                              <span>{botName}</span>
                            </div>
                            {pos.signalReason && (
                              <div className="text-[10px] text-slate-500 truncate max-w-[180px] pl-0.5 flex items-center gap-1" title={pos.signalReason}>
                                <Zap className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                                <span className="truncate">{pos.signalReason}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-medium w-fit">
                            <User className="w-3 h-3 text-slate-500" />
                            <span>{pos.openedBy || 'Manuel Emir'}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <div className="text-slate-900 font-bold">${(pos.initialMargin * pos.leverage).toFixed(2)}</div>
                        <div className="text-[10px] text-slate-500">{pos.quantity.toFixed(4)} adet</div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        ${pos.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        ${pos.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-[11px]">
                        <div>
                          <span className="text-rose-600">SL:</span> ${pos.stopLoss ? pos.stopLoss.toFixed(2) : '-'}
                        </div>
                        <div>
                          <span className="text-emerald-600">TP:</span> ${pos.takeProfit ? pos.takeProfit.toFixed(2) : '-'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-[10px] font-sans">
                        {pos.trailingStopActive && (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 mr-1 mb-0.5">
                            Trailing Aktif
                          </span>
                        )}
                        {pos.breakevenApplied && (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                            🛡️ Breakeven
                          </span>
                        )}
                        {!pos.trailingStopActive && !pos.breakevenApplied && (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-bold">
                        <div className={`text-sm ${isPnlPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isPnlPositive ? '+' : ''}${pos.pnl.toFixed(2)}
                        </div>
                        <div className={`text-[10px] ${isPnlPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                          ({isPnlPositive ? '+' : ''}{pos.pnlPercent.toFixed(2)}%)
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => onClosePosition(pos.id)}
                          className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-sans text-xs font-bold transition shadow-xs"
                        >
                          Piyasadan Kapat
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        )}

        {/* OPEN ORDERS TAB */}
        {activeTab === 'orders' && (
          orders.length === 0 ? (
            <div className="h-44 flex flex-col items-center justify-center text-slate-400 text-xs">
              <p className="text-slate-600 font-medium">Bekleyen açık limit veya algoritma emri yok.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 text-[10px] uppercase font-sans">
                  <th className="py-2 px-3">Sembol</th>
                  <th className="py-2 px-3">Tür / Yön</th>
                  <th className="py-2 px-3">Emir Kaynağı</th>
                  <th className="py-2 px-3">Limit Fiyat</th>
                  <th className="py-2 px-3">Miktar</th>
                  <th className="py-2 px-3">Tarih</th>
                  <th className="py-2 px-3 text-right">İptal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((ord, idx) => {
                  const isBot = ord.botTriggered || Boolean(ord.strategyName);
                  return (
                    <tr key={ord.id ? `ord-${ord.id}-${idx}` : `ord-idx-${idx}`} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-3 font-bold text-slate-900">{ord.symbol}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          ord.side === 'BUY' ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : 'text-rose-700 bg-rose-50 border border-rose-200'
                        }`}>
                          {ord.type} {ord.side}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        {isBot ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-bold">
                            <Bot className="w-3 h-3 text-indigo-500" />
                            {ord.strategyName || ord.openedBy || 'Bot Emri'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 text-[10px]">
                            <User className="w-3 h-3 text-slate-400" />
                            {ord.openedBy || 'Manuel Emir'}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-900 font-bold">${ord.price?.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-slate-600">{ord.quantity.toFixed(4)}</td>
                      <td className="py-2.5 px-3 text-slate-500 text-[10px]">
                        {new Date(ord.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => onCancelOrder(ord.id)}
                          className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-rose-600 border border-slate-200 transition"
                          title="Emri İptal Et"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        )}

        {/* TRADE HISTORY TAB */}
        {activeTab === 'history' && (
          closedTrades.length === 0 ? (
            <div className="h-44 flex flex-col items-center justify-center text-slate-400 text-xs">
              <p className="text-slate-600 font-medium">Tamamlanmış işlem geçmişi henüz bulunmuyor.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 text-[10px] uppercase font-sans">
                  <th className="py-2 px-3">Sembol</th>
                  <th className="py-2 px-3">Yön</th>
                  <th className="py-2 px-3">Kapatılan Bot / Kaynak</th>
                  <th className="py-2 px-3">Giriş / Çıkış</th>
                  <th className="py-2 px-3">Miktar</th>
                  <th className="py-2 px-3">Net PnL (USDT)</th>
                  <th className="py-2 px-3">ROE %</th>
                  <th className="py-2 px-3">Komisyon</th>
                  <th className="py-2 px-3 text-right">Çıkış Zamanı</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {closedTrades.map((trade, idx) => {
                  const isProfit = trade.pnl >= 0;
                  const isBot = trade.botTriggered || Boolean(trade.strategyName);
                  const botName = trade.strategyName || trade.openedBy || (isBot ? 'Strateji Botu' : 'Manuel İşlem');

                  return (
                    <tr key={trade.id ? `trade-${trade.id}-${idx}` : `trade-idx-${idx}`} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-3 font-bold text-slate-900">{trade.symbol}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          trade.side === 'LONG' ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : 'text-rose-700 bg-rose-50 border border-rose-200'
                        }`}>
                          {trade.side}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        {isBot ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-bold">
                            <Bot className="w-3 h-3 text-indigo-500" />
                            {botName}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 text-[10px]">
                            <User className="w-3 h-3 text-slate-400" />
                            {botName}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        ${trade.entryPrice.toFixed(2)} → ${trade.exitPrice.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{trade.quantity.toFixed(4)}</td>
                      <td className="py-2.5 px-3 font-bold">
                        <span className={isProfit ? 'text-emerald-600' : 'text-rose-600'}>
                          {isProfit ? '+' : ''}${trade.pnl.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold">
                        <span className={isProfit ? 'text-emerald-600' : 'text-rose-600'}>
                          {isProfit ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 text-[10px]">
                        ${trade.fee?.toFixed(4) || '0.00'}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-500 text-[10px]">
                        {new Date(trade.exitTime).toLocaleTimeString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        )}

        {/* SIGNALS STREAM TAB */}
        {activeTab === 'signals' && (
          signals.length === 0 ? (
            <div className="h-44 flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
              <Activity className="w-6 h-6 text-slate-300" />
              <p className="text-slate-600 font-medium">Henüz üretilen bir strateji sinyali bulunmuyor.</p>
              <p className="text-[11px] text-slate-400">Bot çalıştığında stratejiler mum grafiklerini tarayıp canlı sinyal üretecektir.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Header Stats Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded bg-amber-100 text-amber-800">
                    <Timer className="w-4 h-4" />
                  </span>
                  <div>
                    <span className="font-bold text-slate-900">Sinyal Zaman Aşımı (TTL): {signalTimeoutMinutes} Dakika</span>
                    <span className="text-[11px] text-slate-500 block">Süresi dolan eski sinyaller için bot otomatik alım yapmaz ve emri iptal sayar.</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold flex items-center gap-1">
                    <Zap className="w-3 h-3 text-emerald-600" />
                    {signals.filter(s => {
                      const ageMs = Math.abs(currentTime - (s.timestamp || currentTime));
                      return ageMs <= (signalTimeoutMinutes * 60 * 1000);
                    }).length} Aktif/Taze
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-bold flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    {signals.filter(s => {
                      const ageMs = Math.abs(currentTime - (s.timestamp || currentTime));
                      return ageMs > (signalTimeoutMinutes * 60 * 1000);
                    }).length} Süresi Dolan
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 text-[10px] uppercase font-sans">
                      <th className="py-2 px-3">Zaman</th>
                      <th className="py-2 px-3">Strateji Adı</th>
                      <th className="py-2 px-3">Sembol</th>
                      <th className="py-2 px-3">Sinyal Yönü</th>
                      <th className="py-2 px-3">Sinyal Fiyatı</th>
                      <th className="py-2 px-3">Güven Skoru</th>
                      <th className="py-2 px-3 min-w-[150px]">Kalan Süre (TTL Countdown)</th>
                      <th className="py-2 px-3">Durum</th>
                      <th className="py-2 px-3">Gerekçe / Filtre</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {signals.map((sig, idx) => {
                      const timeoutMs = (signalTimeoutMinutes || 3) * 60 * 1000;
                      const sigTime = sig.timestamp || currentTime;
                      const elapsedMs = Math.max(0, currentTime - sigTime);
                      const remainingMs = Math.max(0, timeoutMs - elapsedMs);
                      const isExpired = remainingMs <= 0;
                      const remainingSec = Math.ceil(remainingMs / 1000);
                      const minutesLeft = Math.floor(remainingSec / 60);
                      const secondsLeft = remainingSec % 60;
                      const formattedCountdown = `${String(minutesLeft).padStart(2, '0')}:${String(secondsLeft).padStart(2, '0')}`;
                      const ttlPercentage = Math.max(0, Math.min(100, (remainingMs / timeoutMs) * 100));

                      // Color coding based on remaining TTL
                      let ttlColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
                      let barColor = 'bg-emerald-500';
                      if (isExpired) {
                        ttlColor = 'text-slate-500 bg-slate-100 border-slate-200';
                        barColor = 'bg-slate-300';
                      } else if (ttlPercentage < 25) {
                        ttlColor = 'text-rose-700 bg-rose-50 border-rose-200 animate-pulse';
                        barColor = 'bg-rose-500';
                      } else if (ttlPercentage < 50) {
                        ttlColor = 'text-amber-700 bg-amber-50 border-amber-200';
                        barColor = 'bg-amber-500';
                      }

                      return (
                        <tr key={`sig-${sig.strategyId || ''}-${sig.symbol}-${sig.timestamp || idx}-${idx}`} className={`hover:bg-slate-50 transition ${isExpired ? 'opacity-75 bg-slate-50/50' : ''}`}>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                            {sig.timestamp ? new Date(sig.timestamp).toLocaleTimeString() : 'Anlık'}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900 font-sans">
                            {sig.strategyName || 'Algoritmik Strateji'}
                          </td>
                          <td className="py-2.5 px-3 font-bold">{sig.symbol}</td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              sig.type === 'BUY' ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : 'text-rose-700 bg-rose-50 border border-rose-200'
                            }`}>
                              {sig.type === 'BUY' ? 'AL (LONG)' : 'SAT (SHORT)'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">${sig.price?.toFixed(2)}</td>
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-blue-600">%{sig.confidence}</span>
                          </td>

                          {/* TTL COUNTDOWN & PROGRESS BAR */}
                          <td className="py-2.5 px-3">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-bold font-mono ${ttlColor}`}>
                                  <Timer className="w-3 h-3" />
                                  {isExpired ? '00:00' : formattedCountdown}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400">
                                  {isExpired ? 'Doldu' : `%${Math.round(ttlPercentage)}`}
                                </span>
                              </div>
                              {/* Progress bar */}
                              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200">
                                <div
                                  className={`h-full transition-all duration-300 ${barColor}`}
                                  style={{ width: `${ttlPercentage}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* STATUS */}
                          <td className="py-2.5 px-3">
                            {isExpired ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold">
                                <AlertCircle className="w-3 h-3 text-rose-500" />
                                Zaman Aşımı
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                                <Zap className="w-3 h-3 text-emerald-500" />
                                Canlı / Geçerli
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-3 text-slate-600 text-[11px] font-sans">
                            {sig.reasons && sig.reasons.length > 0 ? sig.reasons[0] : 'Teknik İndikatör Kırılımı'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};
