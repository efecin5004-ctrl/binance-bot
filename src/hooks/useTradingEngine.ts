import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Kline,
  MarketTicker,
  IndicatorValues,
  StrategyConfig,
  SignalResult,
  Position,
  Order,
  RiskSettings,
  LogEntry,
  ApiCredentials,
  TelegramSettings,
  AccountBalance
} from '../types/trading';
import { getKlines, get24hrTicker, getOrderBookDepth, getRecentTrades, executeBinanceOrder, sendTelegramNotification } from '../services/api';
import { computeAllIndicators, evaluateStrategySignal } from '../utils/indicators';
import { QUANT_STRATEGY_REGISTRY, evaluateQuantStrategySignal } from '../utils/quantStrategies';
import { QuantStrategyDefinition } from '../types/quant';

// Convert all institutional Quantitative Lab strategies into deployable bot configs
export const DEFAULT_QUANT_BOTS: StrategyConfig[] = QUANT_STRATEGY_REGISTRY.map(qs => ({
  id: qs.id,
  quantStrategyId: qs.id,
  name: qs.name,
  type: qs.family as any,
  family: qs.family,
  direction: qs.direction,
  enabled: qs.status === 'APPROVED_LIVE' || qs.status === 'OOS_VALIDATED',
  symbol: qs.defaultSymbol || 'BTCUSDT',
  timeframe: qs.timeframe || '1h',
  isDefault: true,
  version: qs.version,
  hypothesis: qs.hypothesis,
  mathematicalFormula: qs.mathematicalFormula,
  economicRationale: qs.economicRationale,
  marketCondition: qs.expectedRegime === 'BULL_TREND' ? 'Boğa Trendi (Bull Trend)' :
                  qs.expectedRegime === 'BEAR_TREND' ? 'Ayı Trendi (Bear Trend)' :
                  qs.expectedRegime === 'SIDEWAYS_CHOP' ? 'Yatay/Testere (Sideways Chop)' :
                  qs.expectedRegime === 'HIGH_VOLATILITY' ? 'Yüksek Volatilite (High Volatility)' : 'Tüm Rejimler',
  suitability: qs.economicRationale,
  parameters: { ...qs.parameters },
  parameterBounds: qs.parameterBounds,
  tags: [...qs.tags],
  description: qs.hypothesis
}));

const DEFAULT_RISK: RiskSettings = {
  maxDrawdownPercent: 8.0,
  dailyLossLimitUsdt: 250,
  positionSizingMode: 'PERCENT_PORTFOLIO',
  fixedAmountUsdt: 200,
  percentPortfolio: 5.0,
  atrMultiplier: 1.5,
  maxLeverage: 5,
  maxOpenPositions: 3,
  defaultStopLossPercent: 1.8,
  defaultTakeProfitPercent: 3.6,
  trailingStopEnabled: true,
  trailingStopPercent: 1.2,
  breakevenTriggerPercent: 1.5,
  killSwitchOnDailyLoss: true,
  signalTimeoutMinutes: 3,
  minSignalConfidence: 75,
  requireFreshCross: true
};

export function useTradingEngine() {
  // Navigation & Market selection
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTCUSDT');
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('15m');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'chart' | 'strategies' | 'risk' | 'terminal' | 'backtest' | 'ai' | 'logs'>('dashboard');

  // Market Data
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [ticker, setTicker] = useState<MarketTicker | null>(null);
  const [klines, setKlines] = useState<Kline[]>([]);
  const [indicators, setIndicators] = useState<IndicatorValues>({});
  const [orderBook, setOrderBook] = useState<{ bids: [number, number][]; asks: [number, number][] }>({ bids: [], asks: [] });
  const [recentTrades, setRecentTrades] = useState<any[]>([]);
  const [isLoadingMarket, setIsLoadingMarket] = useState<boolean>(true);
  const [latencyMs, setLatencyMs] = useState<number>(45);

  // Bot Lifecycle & Engine
  const [botStatus, setBotStatus] = useState<'RUNNING' | 'PAUSED' | 'EMERGENCY_STOPPED'>('RUNNING');
  const [tradingMode, setTradingMode] = useState<'PAPER' | 'LIVE_TESTNET' | 'LIVE_MAINNET'>('PAPER');
  const [paperBalance, setPaperBalance] = useState<number>(() => {
    const saved = localStorage.getItem('bbot_paper_balance');
    return saved ? parseFloat(saved) : 10000;
  });
  const [initialPaperBalance] = useState<number>(10000);
  const [dailyStartBalance, setDailyStartBalance] = useState<number>(() => {
    const saved = localStorage.getItem('bbot_daily_start_bal');
    return saved ? parseFloat(saved) : 10000;
  });
  const [dailyLossCurrent, setDailyLossCurrent] = useState<number>(0);

  // Strategies & Signals - Initialize with Quant Research Lab Bots
  const [strategies, setStrategies] = useState<StrategyConfig[]>(() => {
    const saved = localStorage.getItem('bbot_quant_bots_v3');
    if (!saved) {
      localStorage.setItem('bbot_quant_bots_v3', JSON.stringify(DEFAULT_QUANT_BOTS));
      return DEFAULT_QUANT_BOTS;
    }
    try {
      const parsed: StrategyConfig[] = JSON.parse(saved);
      // If old format or empty, reseed with Quant Lab default bots
      if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.some(s => s.quantStrategyId || s.id.startsWith('strat-'))) {
        localStorage.setItem('bbot_quant_bots_v3', JSON.stringify(DEFAULT_QUANT_BOTS));
        return DEFAULT_QUANT_BOTS;
      }
      return parsed;
    } catch {
      return DEFAULT_QUANT_BOTS;
    }
  });
  const [signals, setSignals] = useState<SignalResult[]>([]);

  // Positions & Orders
  const [positions, setPositions] = useState<Position[]>(() => {
    const saved = localStorage.getItem('bbot_positions');
    return saved ? JSON.parse(saved) : [];
  });
  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem('bbot_orders');
    return saved ? JSON.parse(saved) : [];
  });
  const [closedTrades, setClosedTrades] = useState<any[]>(() => {
    const saved = localStorage.getItem('bbot_closed_trades');
    return saved ? JSON.parse(saved) : [];
  });

  // Settings & Risk
  const [riskSettings, setRiskSettings] = useState<RiskSettings>(() => {
    const saved = localStorage.getItem('bbot_risk');
    return saved ? JSON.parse(saved) : DEFAULT_RISK;
  });

  const [apiCredentials, setApiCredentials] = useState<ApiCredentials>(() => {
    const saved = localStorage.getItem('bbot_api_creds');
    return saved ? JSON.parse(saved) : { apiKey: '', apiSecret: '', isTestnet: true, isConnected: false, canTrade: false };
  });

  const [telegramSettings, setTelegramSettings] = useState<TelegramSettings>(() => {
    const saved = localStorage.getItem('bbot_telegram');
    return saved ? JSON.parse(saved) : { enabled: false, botToken: '', chatId: '', notifyOnTrade: true, notifyOnStopLoss: true, notifyOnDailyLimit: true };
  });

  const [liveBalances, setLiveBalances] = useState<AccountBalance[]>([]);

  // Logs
  const [logs, setLogs] = useState<LogEntry[]>(() => [
    {
      id: 'log-init',
      timestamp: Date.now(),
      level: 'INFO',
      message: 'Binance Algoritmik Trading Bot motoru başlatıldı. Sistem hazır.'
    }
  ]);

  // Audio alerts ref
  const soundEnabledRef = useRef<boolean>(true);

  // Helper to add structured logs
  const addLog = useCallback((level: LogEntry['level'], message: string, details?: any) => {
    const entry: LogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: Date.now(),
      level,
      message,
      details
    };
    setLogs(prev => [entry, ...prev.slice(0, 400)]);
  }, []);

  // Persist State to LocalStorage
  useEffect(() => {
    localStorage.setItem('bbot_paper_balance', paperBalance.toString());
  }, [paperBalance]);

  useEffect(() => {
    localStorage.setItem('bbot_daily_start_bal', dailyStartBalance.toString());
  }, [dailyStartBalance]);

  useEffect(() => {
    localStorage.setItem('bbot_strategies_v2', JSON.stringify(strategies));
  }, [strategies]);

  useEffect(() => {
    localStorage.setItem('bbot_positions', JSON.stringify(positions));
  }, [positions]);

  useEffect(() => {
    localStorage.setItem('bbot_orders', JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem('bbot_closed_trades', JSON.stringify(closedTrades));
  }, [closedTrades]);

  useEffect(() => {
    localStorage.setItem('bbot_risk', JSON.stringify(riskSettings));
  }, [riskSettings]);

  useEffect(() => {
    localStorage.setItem('bbot_api_creds', JSON.stringify(apiCredentials));
  }, [apiCredentials]);

  useEffect(() => {
    localStorage.setItem('bbot_telegram', JSON.stringify(telegramSettings));
  }, [telegramSettings]);

  // Send Telegram Notification Helper
  const sendAlert = useCallback(async (msg: string) => {
    if (telegramSettings.enabled && telegramSettings.botToken && telegramSettings.chatId) {
      try {
        await sendTelegramNotification(telegramSettings.botToken, telegramSettings.chatId, msg);
      } catch (e) {
        console.error('Telegram notification error:', e);
      }
    }
  }, [telegramSettings]);

  // Fetch Market Data (Klines, Ticker, Depth, Trades)
  const fetchMarketData = useCallback(async () => {
    const start = performance.now();
    try {
      const [klineData, tickerData, depthData, tradesData] = await Promise.all([
        getKlines(selectedSymbol, selectedTimeframe, 150),
        get24hrTicker(selectedSymbol),
        getOrderBookDepth(selectedSymbol, 15),
        getRecentTrades(selectedSymbol, 20)
      ]);

      setLatencyMs(Math.round(performance.now() - start));

      if (klineData && klineData.length > 0) {
        setKlines(klineData);
        const lastBar = klineData[klineData.length - 1];
        setCurrentPrice(lastBar.close);
        const computed = computeAllIndicators(klineData);
        setIndicators(computed);
      }

      if (tickerData && !Array.isArray(tickerData)) {
        setTicker(tickerData);
      }

      if (depthData) {
        setOrderBook(depthData);
      }

      if (tradesData) {
        setRecentTrades(tradesData);
      }
    } catch (err: any) {
      console.error('Market data fetch error:', err);
    } finally {
      setIsLoadingMarket(false);
    }
  }, [selectedSymbol, selectedTimeframe]);

  // Polling loop for Market Data
  useEffect(() => {
    fetchMarketData();
    const interval = setInterval(fetchMarketData, 3000); // Poll every 3 seconds for real-time responsiveness
    return () => clearInterval(interval);
  }, [fetchMarketData]);

  // ----------------------------------------------------
  // RISK & POSITION TRACKING ENGINE
  // ----------------------------------------------------
  useEffect(() => {
    if (currentPrice <= 0 || positions.length === 0) return;

    setPositions(prevPositions => {
      let updatedPositions: Position[] = [];
      let closedThisTick: Position[] = [];

      for (const pos of prevPositions) {
        // Calculate updated PnL
        const priceDiff = pos.side === 'LONG'
          ? (currentPrice - pos.entryPrice)
          : (pos.entryPrice - currentPrice);

        const pnl = priceDiff * pos.quantity * pos.leverage;
        const pnlPercent = (pnl / pos.initialMargin) * 100;

        let updated = { ...pos, currentPrice, pnl, pnlPercent };

        // Trailing Stop Tracking
        if (pos.side === 'LONG') {
          if (currentPrice > (pos.trailingStopHighest || pos.entryPrice)) {
            updated.trailingStopHighest = currentPrice;
          }
        } else {
          if (currentPrice < (pos.trailingStopLowest || pos.entryPrice)) {
            updated.trailingStopLowest = currentPrice;
          }
        }

        // Breakeven Check
        if (
          riskSettings.breakevenTriggerPercent &&
          !pos.breakevenApplied &&
          pnlPercent >= riskSettings.breakevenTriggerPercent
        ) {
          updated.breakevenApplied = true;
          updated.stopLoss = pos.entryPrice;
          addLog('RISK', `🛡️ Breakeven Aktif: ${pos.symbol} pozisyonu kârda olduğu için Stop-Loss giriş seviyesine ($${pos.entryPrice}) çekildi.`);
        }

        // Check Exit Conditions
        let shouldClose = false;
        let exitReason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'TRAILING_STOP' = 'TAKE_PROFIT';

        // 1. Take Profit
        if (pos.takeProfit) {
          if (pos.side === 'LONG' && currentPrice >= pos.takeProfit) {
            shouldClose = true;
            exitReason = 'TAKE_PROFIT';
          } else if (pos.side === 'SHORT' && currentPrice <= pos.takeProfit) {
            shouldClose = true;
            exitReason = 'TAKE_PROFIT';
          }
        }

        // 2. Stop Loss
        if (!shouldClose && pos.stopLoss) {
          if (pos.side === 'LONG' && currentPrice <= pos.stopLoss) {
            shouldClose = true;
            exitReason = 'STOP_LOSS';
          } else if (pos.side === 'SHORT' && currentPrice >= pos.stopLoss) {
            shouldClose = true;
            exitReason = 'STOP_LOSS';
          }
        }

        // 3. Trailing Stop
        if (
          !shouldClose &&
          riskSettings.trailingStopEnabled &&
          riskSettings.trailingStopPercent
        ) {
          if (pos.side === 'LONG' && updated.trailingStopHighest) {
            const trailThreshold = updated.trailingStopHighest * (1 - riskSettings.trailingStopPercent / 100);
            if (currentPrice <= trailThreshold && currentPrice > pos.entryPrice) {
              shouldClose = true;
              exitReason = 'TRAILING_STOP';
            }
          } else if (pos.side === 'SHORT' && updated.trailingStopLowest) {
            const trailThreshold = updated.trailingLowest * (1 + riskSettings.trailingStopPercent / 100);
            if (currentPrice >= trailThreshold && currentPrice < pos.entryPrice) {
              shouldClose = true;
              exitReason = 'TRAILING_STOP';
            }
          }
        }

        if (shouldClose) {
          closedThisTick.push({ ...updated, currentPrice, pnl, pnlPercent });
        } else {
          updatedPositions.push(updated);
        }
      }

      // Handle closed positions
      if (closedThisTick.length > 0) {
        for (const closed of closedThisTick) {
          const fee = (closed.currentPrice * closed.quantity) * 0.00075;
          const netPnl = closed.pnl - fee;

          setPaperBalance(bal => bal + closed.initialMargin + netPnl);

          const tradeRecord = {
            id: `trade-${Date.now()}`,
            symbol: closed.symbol,
            side: closed.side,
            entryPrice: closed.entryPrice,
            exitPrice: closed.currentPrice,
            quantity: closed.quantity,
            leverage: closed.leverage,
            pnl: netPnl,
            pnlPercent: closed.pnlPercent,
            entryTime: closed.entryTime,
            exitTime: Date.now(),
            fee,
            openedBy: closed.openedBy || (closed.botTriggered ? closed.strategyName : 'Manuel İşlem'),
            strategyName: closed.strategyName,
            botTriggered: closed.botTriggered
          };

          setClosedTrades(ct => [tradeRecord, ...ct.slice(0, 100)]);

          const statusIcon = netPnl >= 0 ? '🟢 KÂR' : '🔴 ZARAR';
          const alertMsg = `${statusIcon}: ${closed.symbol} ${closed.side} kapatıldı!\nFiyat: $${closed.currentPrice.toFixed(2)} | Net PnL: ${netPnl >= 0 ? '+' : ''}$${netPnl.toFixed(2)} (%${closed.pnlPercent.toFixed(2)})`;
          
          addLog(netPnl >= 0 ? 'ORDER' : 'RISK', alertMsg);
          sendAlert(`🤖 <b>Binance Bot Bildirimi</b>\n${alertMsg}`);
        }
      }

      return updatedPositions;
    });
  }, [currentPrice, riskSettings, addLog, sendAlert]);

  // ----------------------------------------------------
  // AUTOMATED STRATEGY EVALUATION & BOT LOOP
  // ----------------------------------------------------
  const lastSignalTimeRef = useRef<number>(0);

  useEffect(() => {
    if (botStatus !== 'RUNNING' || klines.length < 30 || currentPrice <= 0) return;

    // Throttle automated checks to every 10 seconds
    const now = Date.now();
    if (now - lastSignalTimeRef.current < 8000) return;
    lastSignalTimeRef.current = now;

    // Check Daily Loss Limit (Total Equity = Available Cash + Open Positions Margin + Unrealized PnL)
    const totalCurrentEquity = paperBalance + positions.reduce((acc, p) => acc + (p.initialMargin || 0) + (p.pnl || 0), 0);
    const lossFromStart = dailyStartBalance - totalCurrentEquity;
    setDailyLossCurrent(lossFromStart > 0 ? lossFromStart : 0);

    if (riskSettings.killSwitchOnDailyLoss && lossFromStart >= riskSettings.dailyLossLimitUsdt) {
      addLog('RISK', `🚨 GÜNLÜK ZARAR LİMİTİ AŞILDI ($${lossFromStart.toFixed(2)} / $${riskSettings.dailyLossLimitUsdt})! Bot donduruluyor.`);
      setBotStatus('EMERGENCY_STOPPED');
      sendAlert(`🚨 <b>DİKKAT:</b> Günlük zarar limiti aşıldı ($${lossFromStart.toFixed(2)}). Bot güvenlik gereği durduruldu.`);
      return;
    }

    // Evaluate active strategies for the current symbol
    const activeStrats = strategies.filter(s => s.enabled && s.symbol === selectedSymbol);

    for (const strat of activeStrats) {
      let signal: SignalResult;
      
      const quantDef = QUANT_STRATEGY_REGISTRY.find(q => q.id === (strat.quantStrategyId || strat.id));
      if (quantDef) {
        const runtimeQuantStrat: QuantStrategyDefinition = {
          ...quantDef,
          name: strat.name,
          defaultSymbol: strat.symbol,
          timeframe: strat.timeframe,
          direction: (strat.direction || quantDef.direction) as any,
          parameters: { ...quantDef.parameters, ...(strat.parameters || {}) }
        };
        signal = evaluateQuantStrategySignal(runtimeQuantStrat, klines);
      } else {
        signal = evaluateStrategySignal(strat, klines, currentPrice);
      }

      if (signal.type === 'BUY' || signal.type === 'SELL') {
        // Sinyal Zaman Aşımı (Timeout) ve Tazelik Kontrolleri
        const maxAgeMs = (riskSettings.signalTimeoutMinutes || 3) * 60 * 1000;
        const signalAge = signal.timestamp ? Math.abs(now - signal.timestamp) : 0;
        const isFresh = signalAge <= maxAgeMs;
        const minConf = riskSettings.minSignalConfidence || 75;
        const isConfident = signal.confidence >= minConf;

        setSignals(prev => [signal, ...prev.slice(0, 20)]);

        if (!isConfident) {
          addLog('SIGNAL', `⚠️ Sinyal [${signal.type}] Atlandı: Güven skoru (%${signal.confidence}) minimum eşiğin (%${minConf}) altında.`);
          continue;
        }

        if (!isFresh) {
          addLog('SIGNAL', `⏳ Sinyal [${signal.type}] Zaman Aşımı: Sinyal ${Math.round(signalAge / 60000)} dk önce oluştuğu için bayat kabul edildi ve işlem açılmadı.`);
          continue;
        }

        addLog('SIGNAL', `⚡ Taze Sinyal [${signal.type}] Onaylandı - ${strat.name} (Güven: %${signal.confidence})`, signal.reasons);

        // Auto execute if max positions not exceeded
        if (positions.length < riskSettings.maxOpenPositions) {
          const hasSamePosition = positions.some(p => p.symbol === selectedSymbol && p.side === (signal.type === 'BUY' ? 'LONG' : 'SHORT'));
          
          if (!hasSamePosition) {
            executeAutomatedTrade(signal, strat);
          }
        }
      }
    }
  }, [klines, currentPrice, botStatus, strategies, selectedSymbol, positions, riskSettings, paperBalance, dailyStartBalance, addLog, sendAlert]);

  // Execute Automated Trade Helper
  const executeAutomatedTrade = useCallback((signal: SignalResult, strat: StrategyConfig) => {
    let orderSizeUsdt = 100;

    if (riskSettings.positionSizingMode === 'PERCENT_PORTFOLIO') {
      orderSizeUsdt = (paperBalance * riskSettings.percentPortfolio) / 100;
    } else if (riskSettings.positionSizingMode === 'FIXED_AMOUNT') {
      orderSizeUsdt = riskSettings.fixedAmountUsdt;
    } else if (riskSettings.positionSizingMode === 'ATR_VOLATILITY' && indicators.atr) {
      const riskPerTrade = paperBalance * 0.015; // 1.5% max capital risk
      const stopDistance = indicators.atr * riskSettings.atrMultiplier;
      orderSizeUsdt = stopDistance > 0 ? (riskPerTrade / stopDistance) * currentPrice : 150;
    }

    // Guard minimum and maximum
    orderSizeUsdt = Math.max(25, Math.min(orderSizeUsdt, paperBalance * 0.8));

    const side = signal.type === 'BUY' ? 'LONG' : 'SHORT';
    const quantity = parseFloat((orderSizeUsdt / currentPrice).toFixed(6));
    const leverage = Math.min(riskSettings.maxLeverage, 5);

    const defaultSl = side === 'LONG'
      ? currentPrice * (1 - riskSettings.defaultStopLossPercent / 100)
      : currentPrice * (1 + riskSettings.defaultStopLossPercent / 100);

    const defaultTp = side === 'LONG'
      ? currentPrice * (1 + riskSettings.defaultTakeProfitPercent / 100)
      : currentPrice * (1 - riskSettings.defaultTakeProfitPercent / 100);

    const newPosition: Position = {
      id: `pos-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      symbol: selectedSymbol,
      side,
      entryPrice: currentPrice,
      currentPrice,
      quantity,
      leverage,
      pnl: 0,
      pnlPercent: 0,
      initialMargin: orderSizeUsdt,
      stopLoss: signal.suggestedStopLoss || defaultSl,
      takeProfit: signal.suggestedTakeProfit || defaultTp,
      trailingStopActive: riskSettings.trailingStopEnabled,
      trailingStopHighest: currentPrice,
      trailingStopLowest: currentPrice,
      entryTime: Date.now(),
      mode: tradingMode === 'PAPER' ? 'PAPER' : 'LIVE',
      openedBy: strat.name,
      strategyId: strat.id,
      strategyName: strat.name,
      botTriggered: true,
      signalReason: signal.reasons?.[0] || 'Strateji Sinyal Teyidi'
    };

    setPaperBalance(b => b - orderSizeUsdt);
    setPositions(p => [newPosition, ...p]);

    const msg = `🎯 Otomatik Bot İşlemi Açıldı [${strat.name}]: ${selectedSymbol} ${side} | Büyüklük: $${orderSizeUsdt.toFixed(2)} (${quantity} ${selectedSymbol.replace('USDT','')}) @ $${currentPrice.toFixed(2)}`;
    addLog('ORDER', msg);
    sendAlert(`🤖 <b>Yeni Bot İşlemi [${strat.name}]</b>\n${msg}\nSL: $${newPosition.stopLoss?.toFixed(2)} | TP: $${newPosition.takeProfit?.toFixed(2)}`);
  }, [currentPrice, paperBalance, riskSettings, selectedSymbol, indicators, tradingMode, addLog, sendAlert]);

  // ----------------------------------------------------
  // MANUAL ORDER EXECUTION (MARKET, LIMIT, TWAP, ICEBERG)
  // ----------------------------------------------------
  const placeManualOrder = useCallback(async (params: {
    symbol: string;
    side: 'BUY' | 'SELL';
    type: 'MARKET' | 'LIMIT' | 'TWAP' | 'ICEBERG';
    amountUsdt: number;
    limitPrice?: number;
    leverage?: number;
    stopLossPercent?: number;
    takeProfitPercent?: number;
    twapParts?: number;
    twapMinutes?: number;
  }) => {
    const { symbol, side, type, amountUsdt, limitPrice, leverage = 1, stopLossPercent, takeProfitPercent, twapParts = 5, twapMinutes = 10 } = params;
    const execPrice = limitPrice && type === 'LIMIT' ? limitPrice : currentPrice;
    const quantity = parseFloat((amountUsdt / execPrice).toFixed(6));

    if (tradingMode === 'LIVE_MAINNET' || tradingMode === 'LIVE_TESTNET') {
      if (!apiCredentials.apiKey || !apiCredentials.apiSecret) {
        addLog('ERROR', 'Canlı emir gönderilemedi: Binance API Anahtarı girilmemiş.');
        return { success: false, message: 'API Anahtarı eksik' };
      }
      try {
        const binanceRes = await executeBinanceOrder({
          apiKey: apiCredentials.apiKey,
          apiSecret: apiCredentials.apiSecret,
          isTestnet: tradingMode === 'LIVE_TESTNET',
          symbol,
          side,
          type: type === 'LIMIT' ? 'LIMIT' : 'MARKET',
          quantity,
          price: limitPrice
        });

        if (binanceRes.success) {
          addLog('ORDER', `✅ Binance Canlı Emir Gerçekleşti: ${symbol} ${side} ${quantity} adet.`);
          return { success: true };
        } else {
          addLog('ERROR', `❌ Binance Emri Reddedildi: ${binanceRes.message}`);
          return { success: false, message: binanceRes.message };
        }
      } catch (err: any) {
        addLog('ERROR', `Bağlantı hatası: ${err.message}`);
        return { success: false, message: err.message };
      }
    }

    // PAPER TRADING MODE
    if (paperBalance < amountUsdt) {
      addLog('WARN', `Yetersiz bakiye! Gerekli: $${amountUsdt.toFixed(2)}, Mevcut: $${paperBalance.toFixed(2)}`);
      return { success: false, message: 'Yetersiz bakiye' };
    }

    if (type === 'MARKET') {
      const posSide: 'LONG' | 'SHORT' = side === 'BUY' ? 'LONG' : 'SHORT';
      const sl = stopLossPercent ? (posSide === 'LONG' ? execPrice * (1 - stopLossPercent / 100) : execPrice * (1 + stopLossPercent / 100)) : undefined;
      const tp = takeProfitPercent ? (posSide === 'LONG' ? execPrice * (1 + takeProfitPercent / 100) : execPrice * (1 - takeProfitPercent / 100)) : undefined;

      const newPos: Position = {
        id: `pos-${Date.now()}`,
        symbol,
        side: posSide,
        entryPrice: execPrice,
        currentPrice: execPrice,
        quantity,
        leverage,
        pnl: 0,
        pnlPercent: 0,
        initialMargin: amountUsdt,
        stopLoss: sl,
        takeProfit: tp,
        trailingStopActive: riskSettings.trailingStopEnabled,
        trailingStopHighest: execPrice,
        trailingStopLowest: execPrice,
        entryTime: Date.now(),
        mode: 'PAPER',
        openedBy: 'Manuel Market Emri',
        botTriggered: false
      };

      setPaperBalance(b => b - amountUsdt);
      setPositions(p => [newPos, ...p]);
      addLog('ORDER', `🛒 Manuel Market Emri Gerçekleşti: ${symbol} ${posSide} $${amountUsdt.toFixed(2)} @ $${execPrice.toFixed(2)}`);
      return { success: true };
    } else if (type === 'LIMIT') {
      const newOrder: Order = {
        id: `ord-${Date.now()}`,
        clientOrderId: `cl-${Date.now()}`,
        symbol,
        side,
        type: 'LIMIT',
        status: 'OPEN',
        price: limitPrice,
        quantity,
        filledQuantity: 0,
        timestamp: Date.now(),
        mode: 'PAPER',
        openedBy: 'Manuel Limit Emri',
        botTriggered: false
      };
      setOrders(o => [newOrder, ...o]);
      addLog('ORDER', `📋 Limit Emir Tahtaya Yazıldı: ${symbol} ${side} ${quantity} @ $${limitPrice?.toFixed(2)}`);
      return { success: true };
    } else if (type === 'TWAP') {
      addLog('ORDER', `⏳ TWAP Algoritmik Emir Başlatıldı: Toplam $${amountUsdt}, ${twapParts} parçaya bölündü (${twapMinutes} dakika boyunca dilimlenecek).`);
      // Execute first slice immediately
      const sliceAmount = amountUsdt / twapParts;
      const sliceQty = parseFloat((sliceAmount / execPrice).toFixed(6));
      const posSide = side === 'BUY' ? 'LONG' : 'SHORT';
      
      const newPos: Position = {
        id: `pos-twap-${Date.now()}`,
        symbol,
        side: posSide,
        entryPrice: execPrice,
        currentPrice: execPrice,
        quantity: sliceQty,
        leverage,
        pnl: 0,
        pnlPercent: 0,
        initialMargin: sliceAmount,
        entryTime: Date.now(),
        mode: 'PAPER',
        openedBy: 'TWAP Algoritmik Emir',
        botTriggered: false
      };
      setPaperBalance(b => b - sliceAmount);
      setPositions(p => [newPos, ...p]);
      return { success: true };
    }

    return { success: true };
  }, [currentPrice, paperBalance, riskSettings, tradingMode, apiCredentials, addLog]);

  // ----------------------------------------------------
  // EMERGENCY KILL SWITCH
  // ----------------------------------------------------
  const triggerKillSwitch = useCallback(() => {
    addLog('RISK', '🛑 ACİL DURUM BUTONU (KILL SWITCH) TETİKLENDİ!');

    let totalReturnedMargin = 0;
    let totalRealizedPnl = 0;

    for (const pos of positions) {
      const fee = (pos.currentPrice * pos.quantity) * 0.00075;
      const netPnl = pos.pnl - fee;
      totalReturnedMargin += pos.initialMargin;
      totalRealizedPnl += netPnl;

      setClosedTrades(ct => [{
        id: `trade-kill-${Date.now()}`,
        symbol: pos.symbol,
        side: pos.side,
        entryPrice: pos.entryPrice,
        exitPrice: pos.currentPrice,
        quantity: pos.quantity,
        leverage: pos.leverage,
        pnl: netPnl,
        pnlPercent: pos.pnlPercent,
        entryTime: pos.entryTime,
        exitTime: Date.now(),
        fee
      }, ...ct]);
    }

    setPaperBalance(b => b + totalReturnedMargin + totalRealizedPnl);
    setPositions([]);
    setOrders([]);
    setBotStatus('EMERGENCY_STOPPED');

    const summaryMsg = `🛑 <b>KILL SWITCH AKTİF:</b>\nTüm açık pozisyonlar anında piyasa fiyatından kapatıldı. Açık emirler iptal edildi ve bot donduruldu.\nToplam realize edilen PnL: $${totalRealizedPnl.toFixed(2)}`;
    addLog('RISK', summaryMsg);
    sendAlert(summaryMsg);
  }, [positions, addLog, sendAlert]);

  // Close Single Position
  const closePosition = useCallback((positionId: string) => {
    const target = positions.find(p => p.id === positionId);
    if (!target) return;

    const fee = (target.currentPrice * target.quantity) * 0.00075;
    const netPnl = target.pnl - fee;

    setPaperBalance(b => b + target.initialMargin + netPnl);
    setPositions(prev => prev.filter(p => p.id !== positionId));

    setClosedTrades(ct => [{
      id: `trade-manual-${Date.now()}`,
      symbol: target.symbol,
      side: target.side,
      entryPrice: target.entryPrice,
      exitPrice: target.currentPrice,
      quantity: target.quantity,
      leverage: target.leverage,
      pnl: netPnl,
      pnlPercent: target.pnlPercent,
      entryTime: target.entryTime,
      exitTime: Date.now(),
      fee
    }, ...ct]);

    addLog('ORDER', `Manuel Pozisyon Kapatıldı: ${target.symbol} ${target.side} | PnL: $${netPnl.toFixed(2)}`);
  }, [positions, addLog]);

  // Cancel Open Order
  const cancelOrder = useCallback((orderId: string) => {
    setOrders(prev => prev.filter(o => o.id !== orderId));
    addLog('ORDER', `Emir iptal edildi: ${orderId}`);
  }, [addLog]);

  // Reset Paper Balance
  const resetPaperAccount = useCallback(() => {
    setPaperBalance(10000);
    setDailyStartBalance(10000);
    setDailyLossCurrent(0);
    setPositions([]);
    setOrders([]);
    setClosedTrades([]);
    addLog('INFO', 'Virtual Paper Trading hesabı $10,000 USDT bakiyeye sıfırlandı.');
  }, [addLog]);

  return {
    selectedSymbol,
    setSelectedSymbol,
    selectedTimeframe,
    setSelectedTimeframe,
    activeTab,
    setActiveTab,
    currentPrice,
    ticker,
    klines,
    indicators,
    orderBook,
    recentTrades,
    isLoadingMarket,
    latencyMs,
    botStatus,
    setBotStatus,
    tradingMode,
    setTradingMode,
    paperBalance,
    initialPaperBalance,
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
    liveBalances,
    setLiveBalances,
    logs,
    addLog,
    triggerKillSwitch,
    closePosition,
    cancelOrder,
    placeManualOrder,
    resetPaperAccount,
    refreshMarket: fetchMarketData
  };
}
