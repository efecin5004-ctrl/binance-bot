import React, { useState } from 'react';
import { useTradingEngine } from './hooks/useTradingEngine';
import { Header } from './components/Header';
import { ChartContainer } from './components/ChartContainer';
import { OrderBookDepth } from './components/OrderBookDepth';
import { OrderTerminal } from './components/OrderTerminal';
import { PositionsAndOrders } from './components/PositionsAndOrders';
import { StrategyManager } from './components/StrategyManager';
import { RiskManager } from './components/RiskManager';
import { BacktesterView } from './components/BacktesterView';
import { AiMarketAdvisor } from './components/AiMarketAdvisor';
import { SettingsModal } from './components/SettingsModal';
import { AuditLogsModal } from './components/AuditLogsModal';
import { AlertTriangle } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'terminal' | 'strategies' | 'risk' | 'backtest' | 'ai'>('terminal');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);

  const {
    selectedSymbol,
    setSelectedSymbol,
    selectedTimeframe,
    setSelectedTimeframe,
    currentPrice,
    ticker,
    klines,
    indicators,
    orderBook,
    recentTrades,
    latencyMs,
    botStatus,
    setBotStatus,
    tradingMode,
    setTradingMode,
    paperBalance,
    dailyLossCurrent,
    strategies,
    setStrategies,
    signals,
    positions,
    orders,
    closedTrades,
    riskSettings,
    setRiskSettings,
    apiCredentials,
    setApiCredentials,
    telegramSettings,
    setTelegramSettings,
    logs,
    triggerKillSwitch,
    closePosition,
    cancelOrder,
    placeManualOrder,
    resetPaperAccount,
    refreshMarket
  } = useTradingEngine();

  const totalUnrealizedPnl = positions.reduce((acc, p) => acc + p.pnl, 0);

  const toggleBotStatus = () => {
    if (botStatus === 'RUNNING') {
      setBotStatus('PAUSED');
    } else {
      setBotStatus('RUNNING');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Main Navigation & Bot Control Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        symbol={selectedSymbol}
        onSelectSymbol={setSelectedSymbol}
        ticker={ticker}
        botStatus={botStatus}
        onToggleBotStatus={toggleBotStatus}
        onTriggerKillSwitch={triggerKillSwitch}
        tradingMode={tradingMode}
        onSetTradingMode={setTradingMode}
        paperBalance={paperBalance}
        openPositionsCount={positions.length}
        totalUnrealizedPnl={totalUnrealizedPnl}
        latencyMs={latencyMs}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenLogs={() => setIsLogsOpen(true)}
        onRefreshMarket={refreshMarket}
        logsCount={logs.length}
      />

      {/* Main Workspace Body */}
      <main className="flex-1 p-3 md:p-4 max-w-[1920px] mx-auto w-full">
        {/* KILL SWITCH ALERT BANNER IF TRIGGERED */}
        {botStatus === 'EMERGENCY_STOPPED' && (
          <div className="mb-3 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <span>
                <strong>EMERGENCY KILL SWITCH DEVREDE:</strong> Tüm algoritmik işlemler durduruldu ve pozisyonlar güvenlik amacıyla donduruldu.
              </span>
            </div>
            <button
              onClick={() => setBotStatus('PAUSED')}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs transition shadow-xs"
            >
              Kilidi Kaldır (Standby)
            </button>
          </div>
        )}

        {/* TAB 1: MAIN TRADING TERMINAL */}
        {activeTab === 'terminal' && (
          <div className="space-y-3">
            {/* Top Grid: Chart (Left) + OrderBook (Middle) + Order Terminal (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-[540px]">
              {/* Candlestick & Technical Analysis Chart */}
              <div className="lg:col-span-7 xl:col-span-7 h-[540px]">
                <ChartContainer
                  symbol={selectedSymbol}
                  timeframe={selectedTimeframe}
                  klines={klines}
                  indicators={indicators}
                  positions={positions}
                  currentPrice={currentPrice}
                  onSelectTimeframe={setSelectedTimeframe}
                />
              </div>

              {/* L2 Order Book & Recent Trades */}
              <div className="lg:col-span-2 xl:col-span-2 h-[540px]">
                <OrderBookDepth
                  symbol={selectedSymbol}
                  orderBook={orderBook}
                  recentTrades={recentTrades}
                  currentPrice={currentPrice}
                />
              </div>

              {/* Order Placement Terminal */}
              <div className="lg:col-span-3 xl:col-span-3 h-[540px]">
                <OrderTerminal
                  symbol={selectedSymbol}
                  currentPrice={currentPrice}
                  paperBalance={paperBalance}
                  tradingMode={tradingMode}
                  onPlaceOrder={placeManualOrder}
                />
              </div>
            </div>

            {/* Bottom Row: Positions, Orders & Trade History */}
            <div className="h-72">
              <PositionsAndOrders
                positions={positions}
                orders={orders}
                closedTrades={closedTrades}
                onClosePosition={closePosition}
                onCancelOrder={cancelOrder}
              />
            </div>
          </div>
        )}

        {/* TAB 2: STRATEGIES MANAGER */}
        {activeTab === 'strategies' && (
          <StrategyManager
            strategies={strategies}
            onUpdateStrategies={setStrategies}
            latestSignals={signals}
            indicators={indicators}
            currentPrice={currentPrice}
          />
        )}

        {/* TAB 3: RISK & CAPITAL MANAGEMENT */}
        {activeTab === 'risk' && (
          <RiskManager
            riskSettings={riskSettings}
            onUpdateRiskSettings={setRiskSettings}
            paperBalance={paperBalance}
            dailyLossCurrent={dailyLossCurrent}
            openPositionsCount={positions.length}
          />
        )}

        {/* TAB 4: EVENT-DRIVEN BACKTESTER */}
        {activeTab === 'backtest' && (
          <BacktesterView
            strategies={strategies}
            riskSettings={riskSettings}
            defaultSymbol={selectedSymbol}
            onDeployStrategy={(newStrategy) => {
              setStrategies(prev => [newStrategy, ...prev.filter(s => s.id !== newStrategy.id)]);
            }}
            onNavigateToStrategies={() => setActiveTab('strategies')}
          />
        )}

        {/* TAB 5: AI QUANTITATIVE & SENTIMENT ADVISOR */}
        {activeTab === 'ai' && (
          <AiMarketAdvisor
            symbol={selectedSymbol}
            currentPrice={currentPrice}
            timeframe={selectedTimeframe}
            indicators={indicators}
            klines={klines}
          />
        )}
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        apiCredentials={apiCredentials}
        onUpdateApiCredentials={setApiCredentials}
        telegramSettings={telegramSettings}
        onUpdateTelegramSettings={setTelegramSettings}
        onResetPaperAccount={resetPaperAccount}
        paperBalance={paperBalance}
      />

      {/* Audit Logs Modal */}
      <AuditLogsModal
        isOpen={isLogsOpen}
        onClose={() => setIsLogsOpen(false)}
        logs={logs}
      />
    </div>
  );
}
