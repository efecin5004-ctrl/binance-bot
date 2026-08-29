import React, { useState } from 'react';
import {
  Activity,
  ShieldAlert,
  Play,
  Pause,
  AlertTriangle,
  Cpu,
  Radio,
  Settings,
  FileText,
  DollarSign,
  Zap,
  TrendingUp,
  RefreshCw,
  BarChart3,
  Sparkles,
  Shield,
  Cloud,
  CloudCheck,
  CloudOff
} from 'lucide-react';
import { MarketTicker } from '../types/trading';

interface HeaderProps {
  activeTab: 'terminal' | 'strategies' | 'risk' | 'backtest' | 'ai';
  setActiveTab: (tab: 'terminal' | 'strategies' | 'risk' | 'backtest' | 'ai') => void;
  symbol: string;
  onSelectSymbol: (sym: string) => void;
  ticker: MarketTicker | null;
  botStatus: 'RUNNING' | 'PAUSED' | 'EMERGENCY_STOPPED';
  onToggleBotStatus: () => void;
  onTriggerKillSwitch: () => void;
  tradingMode: 'PAPER' | 'LIVE_TESTNET' | 'LIVE_MAINNET';
  onSetTradingMode: (mode: 'PAPER' | 'LIVE_TESTNET' | 'LIVE_MAINNET') => void;
  paperBalance: number;
  openPositionsCount: number;
  totalUnrealizedPnl: number;
  latencyMs: number;
  onOpenSettings: () => void;
  onOpenLogs: () => void;
  onRefreshMarket: () => void;
  logsCount: number;
  cloudSyncStatus?: 'CONNECTED' | 'SYNCING' | 'OFFLINE';
}

const QUICK_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'AVAXUSDT', 'NEARUSDT'];

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  symbol,
  onSelectSymbol,
  ticker,
  botStatus,
  onToggleBotStatus,
  onTriggerKillSwitch,
  tradingMode,
  onSetTradingMode,
  paperBalance,
  openPositionsCount,
  totalUnrealizedPnl,
  latencyMs,
  onOpenSettings,
  onOpenLogs,
  onRefreshMarket,
  logsCount,
  cloudSyncStatus = 'CONNECTED'
}) => {
  const [showKillConfirm, setShowKillConfirm] = useState(false);
  const isPositive = (ticker?.priceChangePercent || 0) >= 0;

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      {/* Top Main Bar */}
      <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100">
        {/* Left: Brand, Quick Symbol Switcher & Live Price */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 pr-2 border-r border-slate-200">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-slate-900 tracking-tight text-sm">BINANCE</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">QUANT BOT</span>
              </div>
              <p className="text-[10px] text-slate-500 font-mono">Algoritmik Ticaret Terminali</p>
            </div>
          </div>

          {/* VPS SQLite Database Sync Pill */}
          <button 
            onClick={onOpenSettings}
            title="VPS Yerel SQLite Veritabanı: Sıfır maliyetle VPS diskinizde çalışan ilişkisel veritabanı (trades, positions, bot_state). Tıklayarak veritabanı yedeğini indirebilirsiniz."
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition cursor-pointer"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
            <span>VPS SQLite DB (Ücretsiz & Yerel)</span>
          </button>

          {/* 7/24 Server Daemon Pill */}
          <div 
            title="Ubuntu Sunucu 7/24 Otonom Motor: Tarayıcı veya bilgisayar kapalıyken dahi VPS arka planında kesintisiz alım/satım yapar."
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200"
          >
            <Cpu className="w-3 h-3 text-indigo-600" />
            <span>7/24 Sunucu Botu: AKTİF</span>
          </div>

          {/* Symbol Select */}
          <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-lg border border-slate-200">
            <select
              value={symbol}
              onChange={(e) => onSelectSymbol(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 px-2 py-1 outline-none cursor-pointer font-mono"
            >
              {QUICK_SYMBOLS.map((s) => (
                <option key={s} value={s} className="bg-white text-slate-800">
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Live 24h Ticker Quick Stats */}
          {ticker && (
            <div className="hidden lg:flex items-center gap-4 text-xs font-mono pl-2">
              <div>
                <span className="text-slate-400 text-[10px] block">FİYAT</span>
                <span className={`font-bold text-sm ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                  ${ticker.lastPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">24S DEĞİŞİM</span>
                <span className={`font-semibold ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {isPositive ? '+' : ''}{ticker.priceChangePercent.toFixed(2)}%
                </span>
              </div>
              <div className="hidden xl:block">
                <span className="text-slate-400 text-[10px] block">24S YÜKSEK</span>
                <span className="text-slate-700">${ticker.highPrice.toLocaleString()}</span>
              </div>
              <div className="hidden xl:block">
                <span className="text-slate-400 text-[10px] block">24S DÜŞÜK</span>
                <span className="text-slate-700">${ticker.lowPrice.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>

        {/* Right: Portfolio Summary, Bot Controls, Mode Selector & Kill Switch */}
        <div className="flex items-center gap-2.5">
          {/* Latency pill */}
          <div className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-50 border border-slate-200 text-[10px] font-mono text-slate-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{latencyMs} ms</span>
          </div>

          {/* Refresh market */}
          <button
            onClick={onRefreshMarket}
            title="Piyasa Verilerini Yenile"
            className="p-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {/* Mode Switcher */}
          <div className="flex items-center rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-[11px]">
            <button
              onClick={() => onSetTradingMode('PAPER')}
              className={`px-2 py-1 rounded font-medium transition ${
                tradingMode === 'PAPER'
                  ? 'bg-white text-slate-900 font-bold shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Paper
            </button>
            <button
              onClick={() => onSetTradingMode('LIVE_TESTNET')}
              className={`px-2 py-1 rounded font-medium transition ${
                tradingMode === 'LIVE_TESTNET'
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Testnet
            </button>
            <button
              onClick={() => onSetTradingMode('LIVE_MAINNET')}
              className={`px-2 py-1 rounded font-medium transition ${
                tradingMode === 'LIVE_MAINNET'
                  ? 'bg-emerald-600 text-white font-bold shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Live
            </button>
          </div>

          {/* Portfolio Metric */}
          <div className="hidden sm:flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <DollarSign className="w-3.5 h-3.5 text-slate-600" />
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block font-mono">BAKİYE</span>
              <span className="text-xs font-bold text-slate-800 font-mono">${paperBalance.toFixed(2)}</span>
            </div>
            {openPositionsCount > 0 && (
              <div className="pl-2 border-l border-slate-200 text-right">
                <span className="text-[10px] text-slate-400 block font-mono">AÇIK PNL</span>
                <span className={`text-xs font-bold font-mono ${totalUnrealizedPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {totalUnrealizedPnl >= 0 ? '+' : ''}${totalUnrealizedPnl.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Bot State Trigger */}
          <button
            onClick={onToggleBotStatus}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
              botStatus === 'RUNNING'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : botStatus === 'PAUSED'
                ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
            }`}
          >
            {botStatus === 'RUNNING' ? (
              <>
                <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-600" />
                <span>BOT AKTİF</span>
              </>
            ) : botStatus === 'PAUSED' ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>DURAKLATILDI</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>DONDURULDU</span>
              </>
            )}
          </button>

          {/* EMERGENCY KILL SWITCH */}
          <div className="relative">
            <button
              onClick={() => setShowKillConfirm(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-xs transition active:scale-95"
              title="Acil Durum Butonu: Tüm pozisyonları kapatır ve botu kilitler"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>KILL SWITCH</span>
            </button>

            {/* Kill Switch Confirmation Popover */}
            {showKillConfirm && (
              <div className="absolute right-0 top-11 w-72 bg-white border border-rose-200 rounded-xl p-4 shadow-xl z-50 animate-in fade-in">
                <div className="flex items-start gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 flex-shrink-0">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Acil Durum Onayı</h4>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      Tüm açık pozisyonlar piyasa fiyatından <strong className="text-rose-600">anında kapatılacak</strong> ve bot dondurulacaktır.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      onTriggerKillSwitch();
                      setShowKillConfirm(false);
                    }}
                    className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition shadow-xs"
                  >
                    Evet, Tümünü Kapat!
                  </button>
                  <button
                    onClick={() => setShowKillConfirm(false)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                  >
                    Vazgeç
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick Logs & Settings */}
          <button
            onClick={onOpenLogs}
            title="Sistem Logları"
            className="p-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition relative"
          >
            <FileText className="w-4 h-4" />
            {logsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-blue-600" />
            )}
          </button>
          <button
            onClick={onOpenSettings}
            title="Ayarlar & API Anahtarları"
            className="p-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Sub-Navigation Navigation Bar */}
      <div className="px-4 py-1.5 bg-slate-50/70 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setActiveTab('terminal')}
            className={`px-3 py-1 rounded-lg font-semibold transition flex items-center gap-1.5 ${
              activeTab === 'terminal'
                ? 'bg-white text-blue-600 font-bold border border-slate-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Ticaret Terminali (Grafik & Emirler)</span>
          </button>

          <button
            onClick={() => setActiveTab('strategies')}
            className={`px-3 py-1 rounded-lg font-semibold transition flex items-center gap-1.5 ${
              activeTab === 'strategies'
                ? 'bg-white text-blue-600 font-bold border border-slate-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Kantitatif Stratejiler & Sinyaller</span>
          </button>

          <button
            onClick={() => setActiveTab('risk')}
            className={`px-3 py-1 rounded-lg font-semibold transition flex items-center gap-1.5 ${
              activeTab === 'risk'
                ? 'bg-white text-blue-600 font-bold border border-slate-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Risk Yönetimi & Kasa</span>
          </button>

          <button
            onClick={() => setActiveTab('backtest')}
            className={`px-3 py-1 rounded-lg font-semibold transition flex items-center gap-1.5 ${
              activeTab === 'backtest'
                ? 'bg-white text-blue-600 font-bold border border-slate-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Backtest & Simülasyon</span>
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`px-3 py-1 rounded-lg font-semibold transition flex items-center gap-1.5 ${
              activeTab === 'ai'
                ? 'bg-purple-50 text-purple-700 font-bold border border-purple-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>Gemini AI Analizi</span>
          </button>
        </div>
      </div>
    </header>
  );
};
