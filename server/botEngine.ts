import fs from 'fs';
import path from 'path';
import { 
  Kline, 
  Position, 
  Order, 
  TradeRecord, 
  StrategyConfig, 
  RiskSettings, 
  ApiCredentials, 
  TelegramSettings, 
  SignalResult, 
  LogEntry, 
  BotStatus, 
  TradingMode
} from '../src/types/trading';
import { computeAllIndicators, evaluateStrategySignal } from '../src/utils/indicators';
import { QUANT_STRATEGY_REGISTRY, evaluateQuantStrategySignal } from '../src/utils/quantStrategies';
import { QuantStrategyDefinition } from '../src/types/quant';

const STATE_FILE_PATH = path.join(process.cwd(), 'server_bot_state.json');

// Default initial strategies from Quant registry
const DEFAULT_STRATEGIES: StrategyConfig[] = QUANT_STRATEGY_REGISTRY.map(qs => ({
  id: qs.id,
  name: qs.name,
  type: 'QUANT_STRATEGY' as const,
  family: qs.family,
  quantStrategyId: qs.id,
  direction: qs.direction,
  enabled: qs.id === 'strat-donchian-turtle' || qs.id === 'strat-dual-ema-macro',
  symbol: qs.defaultSymbol || 'BTCUSDT',
  timeframe: qs.timeframe || '1h',
  parameters: qs.parameters,
  hypothesis: qs.hypothesis,
  mathematicalFormula: qs.mathematicalFormula,
  economicRationale: qs.economicRationale,
  tags: qs.tags,
  description: qs.hypothesis
}));

export interface ServerBotState {
  botStatus: BotStatus;
  tradingMode: TradingMode;
  paperBalance: number;
  dailyStartBalance: number;
  positions: Position[];
  orders: Order[];
  closedTrades: TradeRecord[];
  strategies: StrategyConfig[];
  riskSettings: RiskSettings;
  apiCredentials: ApiCredentials;
  telegramSettings: TelegramSettings;
  selectedSymbol: string;
  selectedTimeframe: string;
  logs: LogEntry[];
  lastLoopTime: number;
  signals: SignalResult[];
  isServerDaemonRunning: boolean;
}

const DEFAULT_RISK_SETTINGS: RiskSettings = {
  maxDrawdownPercent: 10,
  maxOpenPositions: 3,
  dailyLossLimitUsdt: 500,
  killSwitchOnDailyLoss: true,
  maxLeverage: 5,
  defaultStopLossPercent: 2.5,
  defaultTakeProfitPercent: 5.0,
  trailingStopEnabled: true,
  trailingStopPercent: 1.5,
  breakevenTriggerPercent: 2.0,
  signalTimeoutMinutes: 5,
  minSignalConfidence: 75,
  requireFreshCross: false,
  positionSizingMode: 'PERCENT_PORTFOLIO',
  fixedAmountUsdt: 100,
  percentPortfolio: 10,
  atrMultiplier: 2.0
};

const DEFAULT_API_CREDENTIALS: ApiCredentials = {
  apiKey: '',
  apiSecret: '',
  isTestnet: true,
  isConnected: false,
  canTrade: false
};

const DEFAULT_TELEGRAM_SETTINGS: TelegramSettings = {
  enabled: false,
  botToken: '',
  chatId: '',
  notifyOnTrade: true,
  notifyOnStopLoss: true,
  notifyOnDailyLimit: true
};

export class AutonomousBotEngine {
  private state: ServerBotState;
  private isProcessing: boolean = false;
  private timer: NodeJS.Timeout | null = null;
  private lastSignalTimes: Map<string, number> = new Map();

  constructor() {
    this.state = this.loadState();
    this.state.isServerDaemonRunning = true;
    this.addLog('INFO', '🚀 Ubuntu 7/24 Server Bot Motoru başlatıldı. Arka plan otonom taraması devrede.');
  }

  private deduplicateTrades(trades: TradeRecord[]): TradeRecord[] {
    if (!Array.isArray(trades)) return [];
    const seen = new Set<string>();
    const result: TradeRecord[] = [];
    for (let i = 0; i < trades.length; i++) {
      const t = trades[i];
      if (!t) continue;
      const uniqueId = t.id || `trade-${t.exitTime || Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      if (!seen.has(uniqueId)) {
        seen.add(uniqueId);
        result.push({ ...t, id: uniqueId });
      }
    }
    return result;
  }

  private loadState(): ServerBotState {
    try {
      if (fs.existsSync(STATE_FILE_PATH)) {
        const raw = fs.readFileSync(STATE_FILE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          botStatus: parsed.botStatus || 'RUNNING',
          tradingMode: parsed.tradingMode || 'PAPER',
          paperBalance: typeof parsed.paperBalance === 'number' ? parsed.paperBalance : 10000,
          dailyStartBalance: typeof parsed.dailyStartBalance === 'number' ? parsed.dailyStartBalance : 10000,
          positions: Array.isArray(parsed.positions) ? parsed.positions : [],
          orders: Array.isArray(parsed.orders) ? parsed.orders : [],
          closedTrades: Array.isArray(parsed.closedTrades) ? this.deduplicateTrades(parsed.closedTrades) : [],
          strategies: Array.isArray(parsed.strategies) && parsed.strategies.length > 0 ? parsed.strategies : DEFAULT_STRATEGIES,
          riskSettings: parsed.riskSettings || DEFAULT_RISK_SETTINGS,
          apiCredentials: parsed.apiCredentials || DEFAULT_API_CREDENTIALS,
          telegramSettings: parsed.telegramSettings || DEFAULT_TELEGRAM_SETTINGS,
          selectedSymbol: parsed.selectedSymbol || 'BTCUSDT',
          selectedTimeframe: parsed.selectedTimeframe || '1h',
          logs: Array.isArray(parsed.logs) ? parsed.logs.slice(0, 200) : [],
          lastLoopTime: Date.now(),
          signals: [],
          isServerDaemonRunning: true
        };
      }
    } catch (e) {
      console.error('Failed to load server_bot_state.json, using defaults:', e);
    }

    return {
      botStatus: 'RUNNING',
      tradingMode: 'PAPER',
      paperBalance: 10000,
      dailyStartBalance: 10000,
      positions: [],
      orders: [],
      closedTrades: [],
      strategies: DEFAULT_STRATEGIES,
      riskSettings: DEFAULT_RISK_SETTINGS,
      apiCredentials: DEFAULT_API_CREDENTIALS,
      telegramSettings: DEFAULT_TELEGRAM_SETTINGS,
      selectedSymbol: 'BTCUSDT',
      selectedTimeframe: '1h',
      logs: [],
      lastLoopTime: Date.now(),
      signals: [],
      isServerDaemonRunning: true
    };
  }

  public saveState(): void {
    try {
      const dataToSave = {
        ...this.state,
        logs: this.state.logs.slice(0, 300)
      };
      fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(dataToSave, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to write server_bot_state.json:', e);
    }
  }

  public getState(): ServerBotState {
    return {
      ...this.state,
      lastLoopTime: Date.now()
    };
  }

  public addLog(level: LogEntry['level'], message: string, details?: any) {
    const entry: LogEntry = {
      id: `srv-log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      level,
      message,
      details
    };
    this.state.logs = [entry, ...this.state.logs.slice(0, 300)];
    console.log(`[BOT-ENGINE] [${level}] ${message}`);
  }

  public async sendTelegramAlert(msg: string): Promise<void> {
    const { enabled, botToken, chatId } = this.state.telegramSettings;
    if (!enabled || !botToken || !chatId) return;

    try {
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: msg,
          parse_mode: 'HTML'
        })
      });
    } catch (err) {
      console.error('[TELEGRAM ERROR]', err);
    }
  }

  public updateStatePartial(partial: Partial<ServerBotState>): ServerBotState {
    if (partial.botStatus) this.state.botStatus = partial.botStatus;
    if (partial.tradingMode) this.state.tradingMode = partial.tradingMode;
    if (typeof partial.paperBalance === 'number') this.state.paperBalance = partial.paperBalance;
    if (typeof partial.dailyStartBalance === 'number') this.state.dailyStartBalance = partial.dailyStartBalance;
    if (Array.isArray(partial.positions)) this.state.positions = partial.positions;
    if (Array.isArray(partial.orders)) this.state.orders = partial.orders;
    if (Array.isArray(partial.closedTrades)) this.state.closedTrades = this.deduplicateTrades(partial.closedTrades);
    if (Array.isArray(partial.strategies)) this.state.strategies = partial.strategies;
    if (partial.riskSettings) this.state.riskSettings = partial.riskSettings;
    if (partial.apiCredentials) this.state.apiCredentials = partial.apiCredentials;
    if (partial.telegramSettings) this.state.telegramSettings = partial.telegramSettings;
    if (partial.selectedSymbol) this.state.selectedSymbol = partial.selectedSymbol;
    if (partial.selectedTimeframe) this.state.selectedTimeframe = partial.selectedTimeframe;

    this.saveState();
    return this.getState();
  }

  // Start the 7/24 Autonomous Loop
  public start(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.runTick().catch(err => {
        console.error('[BOT-ENGINE TICK ERROR]', err);
      });
    }, 4000); // Check market every 4 seconds

    this.addLog('INFO', '🟢 7/24 Otonom Alım-Satım Döngüsü aktif edildi. Tarayıcı kapalıyken de sürekli çalışır.');
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.state.botStatus = 'PAUSED';
    this.saveState();
    this.addLog('INFO', '⏸️ Bot motoru duraklatıldı.');
  }

  private async fetchBinanceKlines(symbol: string, interval: string = '1h', limit: number = 100): Promise<Kline[]> {
    try {
      const url = `https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${limit}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      return data.map((item: any[]) => ({
        time: item[0],
        open: parseFloat(item[1]),
        high: parseFloat(item[2]),
        low: parseFloat(item[3]),
        close: parseFloat(item[4]),
        volume: parseFloat(item[5]),
        closeTime: item[6],
        quoteVolume: parseFloat(item[7]),
        trades: item[8]
      }));
    } catch (e) {
      console.error(`Failed to fetch klines for ${symbol}:`, e);
      return [];
    }
  }

  private async fetchCurrentPrice(symbol: string): Promise<number> {
    try {
      const url = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol.toUpperCase()}`;
      const res = await fetch(url);
      if (!res.ok) return 0;
      const data = await res.json();
      return parseFloat(data.price || '0');
    } catch (e) {
      return 0;
    }
  }

  // ----------------------------------------------------
  // CORE 7/24 TRADING LOGIC TICK
  // ----------------------------------------------------
  private async runTick(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const { botStatus, riskSettings, strategies, positions, paperBalance, dailyStartBalance } = this.state;
      this.state.lastLoopTime = Date.now();

      // Gather all symbols needed to scan
      const activeSymbols = new Set<string>();
      activeSymbols.add(this.state.selectedSymbol || 'BTCUSDT');
      
      for (const st of strategies) {
        if (st.enabled && st.symbol) {
          activeSymbols.add(st.symbol.toUpperCase());
        }
      }

      for (const pos of positions) {
        if (pos.symbol) activeSymbols.add(pos.symbol.toUpperCase());
      }

      // 1. Process Open Positions for Exits (SL, TP, Trailing Stop, Breakeven)
      if (positions.length > 0) {
        await this.manageOpenPositions();
      }

      // If Bot is not running or emergency stopped, skip new entries
      if (botStatus !== 'RUNNING') {
        this.isProcessing = false;
        return;
      }

      // Check Daily Loss Killswitch
      const totalCurrentEquity = paperBalance + positions.reduce((acc, p) => acc + (p.initialMargin || 0) + (p.pnl || 0), 0);
      const lossFromStart = dailyStartBalance - totalCurrentEquity;

      if (riskSettings.killSwitchOnDailyLoss && lossFromStart >= riskSettings.dailyLossLimitUsdt) {
        this.addLog('RISK', `🚨 GÜNLÜK ZARAR LİMİTİ AŞILDI ($${lossFromStart.toFixed(2)} / $${riskSettings.dailyLossLimitUsdt})! Bot donduruldu.`);
        this.state.botStatus = 'EMERGENCY_STOPPED';
        await this.sendTelegramAlert(`🚨 <b>DİKKAT:</b> Günlük zarar limiti aşıldı ($${lossFromStart.toFixed(2)}). Bot 7/24 güvenlik gereği durduruldu.`);
        this.saveState();
        this.isProcessing = false;
        return;
      }

      // 2. Scan active symbols for signals
      for (const sym of Array.from(activeSymbols)) {
        await this.evaluateSymbolStrategies(sym);
      }

    } catch (err) {
      console.error('[TICK LOOP ERROR]', err);
    } finally {
      this.isProcessing = false;
    }
  }

  // Monitor and manage open positions
  private async manageOpenPositions(): Promise<void> {
    const { riskSettings } = this.state;
    const remainingPositions: Position[] = [];
    const closedPositions: Position[] = [];

    for (const pos of this.state.positions) {
      const currentPrice = await this.fetchCurrentPrice(pos.symbol);
      if (currentPrice <= 0) {
        remainingPositions.push(pos);
        continue;
      }

      const priceDiff = pos.side === 'LONG'
        ? (currentPrice - pos.entryPrice)
        : (pos.entryPrice - currentPrice);

      const pnl = priceDiff * pos.quantity * pos.leverage;
      const pnlPercent = (pnl / pos.initialMargin) * 100;

      let updated = { ...pos, currentPrice, pnl, pnlPercent };

      // Trailing stop high/low updates
      if (pos.side === 'LONG') {
        if (currentPrice > (pos.trailingStopHighest || pos.entryPrice)) {
          updated.trailingStopHighest = currentPrice;
        }
      } else {
        if (currentPrice < (pos.trailingStopLowest || pos.entryPrice)) {
          updated.trailingStopLowest = currentPrice;
        }
      }

      // Breakeven check
      if (
        riskSettings.breakevenTriggerPercent &&
        !pos.breakevenApplied &&
        pnlPercent >= riskSettings.breakevenTriggerPercent
      ) {
        updated.breakevenApplied = true;
        updated.stopLoss = pos.entryPrice;
        this.addLog('RISK', `🛡️ Breakeven Aktif: ${pos.symbol} Stop-Loss giriş fiyatına ($${pos.entryPrice}) çekildi.`);
      }

      // Exit Conditions Check
      let shouldClose = false;

      // 1. Take Profit
      if (pos.takeProfit) {
        if (pos.side === 'LONG' && currentPrice >= pos.takeProfit) {
          shouldClose = true;
        } else if (pos.side === 'SHORT' && currentPrice <= pos.takeProfit) {
          shouldClose = true;
        }
      }

      // 2. Stop Loss
      if (!shouldClose && pos.stopLoss) {
        if (pos.side === 'LONG' && currentPrice <= pos.stopLoss) {
          shouldClose = true;
        } else if (pos.side === 'SHORT' && currentPrice >= pos.stopLoss) {
          shouldClose = true;
        }
      }

      // 3. Trailing Stop
      if (!shouldClose && riskSettings.trailingStopEnabled && riskSettings.trailingStopPercent) {
        if (pos.side === 'LONG' && updated.trailingStopHighest) {
          const trailThreshold = updated.trailingStopHighest * (1 - riskSettings.trailingStopPercent / 100);
          if (currentPrice <= trailThreshold && currentPrice > pos.entryPrice) {
            shouldClose = true;
          }
        } else if (pos.side === 'SHORT' && updated.trailingStopLowest) {
          const trailThreshold = (updated.trailingStopLowest || pos.entryPrice) * (1 + riskSettings.trailingStopPercent / 100);
          if (currentPrice >= trailThreshold && currentPrice < pos.entryPrice) {
            shouldClose = true;
          }
        }
      }

      if (shouldClose) {
        closedPositions.push({ ...updated, currentPrice, pnl, pnlPercent });
      } else {
        remainingPositions.push(updated);
      }
    }

    if (closedPositions.length > 0) {
      for (const closed of closedPositions) {
        const fee = (closed.currentPrice * closed.quantity) * 0.00075;
        const netPnl = closed.pnl - fee;

        this.state.paperBalance += (closed.initialMargin + netPnl);

        const tradeRecord: TradeRecord = {
          id: `trade-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
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
          openedBy: closed.openedBy || closed.strategyName || 'Otonom Server Bot',
          strategyName: closed.strategyName,
          botTriggered: true
        };

        this.state.closedTrades = [tradeRecord, ...this.state.closedTrades.slice(0, 200)];

        const statusIcon = netPnl >= 0 ? '🟢 KÂR İLE KAPANDI' : '🔴 STOP OLDU';
        const alertMsg = `🤖 <b>7/24 Ubuntu Bot Pozisyon Kapatma</b>\n${statusIcon}: ${closed.symbol} ${closed.side}\nÇıkış Fiyatı: $${closed.currentPrice.toFixed(2)}\nNet PnL: ${netPnl >= 0 ? '+' : ''}$${netPnl.toFixed(2)} (%${closed.pnlPercent.toFixed(2)})\nKasa: $${this.state.paperBalance.toFixed(2)}`;

        this.addLog(netPnl >= 0 ? 'ORDER' : 'RISK', alertMsg);
        await this.sendTelegramAlert(alertMsg);
      }

      this.state.positions = remainingPositions;
      this.saveState();
    } else {
      this.state.positions = remainingPositions;
    }
  }

  // Evaluate strategies for a single symbol
  private async evaluateSymbolStrategies(symbol: string): Promise<void> {
    const activeStrats = this.state.strategies.filter(s => s.enabled && s.symbol.toUpperCase() === symbol.toUpperCase());
    if (activeStrats.length === 0) return;

    const timeframe = activeStrats[0]?.timeframe || this.state.selectedTimeframe || '1h';
    const klines = await this.fetchBinanceKlines(symbol, timeframe, 120);
    if (klines.length < 30) return;

    const lastBar = klines[klines.length - 1];
    const currentPrice = lastBar.close;
    const now = Date.now();

    for (const strat of activeStrats) {
      const stratKey = `${symbol}_${strat.id}`;
      const lastExecution = this.lastSignalTimes.get(stratKey) || 0;
      if (now - lastExecution < 20000) continue; // Throttle per strategy to 20s

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
        const minConf = this.state.riskSettings.minSignalConfidence || 75;
        if (signal.confidence < minConf) continue;

        this.lastSignalTimes.set(stratKey, now);

        // Check if we already have position in this symbol
        if (this.state.positions.length >= this.state.riskSettings.maxOpenPositions) {
          this.addLog('SIGNAL', `⚠️ Sinyal [${signal.type}] Atlandı: Maksimum açık pozisyon limitine (${this.state.riskSettings.maxOpenPositions}) ulaşıldı.`);
          continue;
        }

        const targetSide = signal.type === 'BUY' ? 'LONG' : 'SHORT';
        const hasExisting = this.state.positions.some(p => p.symbol.toUpperCase() === symbol.toUpperCase() && p.side === targetSide);
        if (hasExisting) continue;

        // Execute 7/24 automated trade
        await this.executeServerTrade(signal, strat, currentPrice, klines);
      }
    }
  }

  // Execute trade on server
  private async executeServerTrade(signal: SignalResult, strat: StrategyConfig, currentPrice: number, klines: Kline[]): Promise<void> {
    const { riskSettings, paperBalance } = this.state;
    let orderSizeUsdt = 100;

    const indicators = computeAllIndicators(klines);

    if (riskSettings.positionSizingMode === 'PERCENT_PORTFOLIO') {
      orderSizeUsdt = (paperBalance * riskSettings.percentPortfolio) / 100;
    } else if (riskSettings.positionSizingMode === 'FIXED_AMOUNT') {
      orderSizeUsdt = riskSettings.fixedAmountUsdt;
    } else if (riskSettings.positionSizingMode === 'ATR_VOLATILITY' && indicators.atr) {
      const riskPerTrade = paperBalance * 0.015;
      const stopDistance = indicators.atr * riskSettings.atrMultiplier;
      orderSizeUsdt = stopDistance > 0 ? (riskPerTrade / stopDistance) * currentPrice : 150;
    }

    orderSizeUsdt = Math.max(10, Math.min(orderSizeUsdt, paperBalance * 0.95));
    const leverage = riskSettings.maxLeverage || 5;
    const quantity = (orderSizeUsdt / currentPrice);
    const initialMargin = orderSizeUsdt / leverage;

    if (initialMargin > paperBalance) {
      this.addLog('RISK', `❌ Bakiye yetersiz: Gerekli Teminat $${initialMargin.toFixed(2)}, Mevcut Bakiye: $${paperBalance.toFixed(2)}`);
      return;
    }

    const side = signal.type === 'BUY' ? 'LONG' : 'SHORT';
    const slPercent = strat.parameters?.stopLossPercent 
      ? Number(strat.parameters.stopLossPercent) 
      : riskSettings.defaultStopLossPercent;

    const tpPercent = strat.parameters?.takeProfitPercent 
      ? Number(strat.parameters.takeProfitPercent) 
      : riskSettings.defaultTakeProfitPercent;

    const stopLoss = side === 'LONG'
      ? currentPrice * (1 - slPercent / 100)
      : currentPrice * (1 + slPercent / 100);

    const takeProfit = side === 'LONG'
      ? currentPrice * (1 + tpPercent / 100)
      : currentPrice * (1 - tpPercent / 100);

    const newPosition: Position = {
      id: `pos-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      symbol: strat.symbol.toUpperCase(),
      side,
      entryPrice: currentPrice,
      currentPrice,
      quantity,
      leverage,
      initialMargin,
      pnl: 0,
      pnlPercent: 0,
      entryTime: Date.now(),
      mode: this.state.tradingMode || 'PAPER',
      stopLoss,
      takeProfit,
      trailingStopHighest: side === 'LONG' ? currentPrice : undefined,
      trailingStopLowest: side === 'SHORT' ? currentPrice : undefined,
      strategyName: strat.name,
      botTriggered: true,
      openedBy: `7/24 Server Bot (${strat.name})`
    };

    // Deduct margin
    this.state.paperBalance -= initialMargin;
    this.state.positions = [newPosition, ...this.state.positions];

    const logMsg = `⚡ 7/24 Otonom Pozisyon Açıldı: ${newPosition.symbol} ${newPosition.side} @ $${currentPrice.toFixed(2)} (Boyut: $${orderSizeUsdt.toFixed(2)}, Kaldıraç: ${leverage}x)`;
    this.addLog('ORDER', logMsg, { strategy: strat.name, confidence: signal.confidence, sl: stopLoss, tp: takeProfit });

    await this.sendTelegramAlert(
      `🚀 <b>7/24 Ubuntu Bot Yeni İşlem!</b>\n` +
      `<b>Sembol:</b> ${newPosition.symbol} (${newPosition.side})\n` +
      `<b>Strateji:</b> ${strat.name}\n` +
      `<b>Giriş Fiyatı:</b> $${currentPrice.toFixed(2)}\n` +
      `<b>Kaldıraç:</b> ${leverage}x | <b>Teminat:</b> $${initialMargin.toFixed(2)}\n` +
      `<b>Stop-Loss:</b> $${stopLoss.toFixed(2)} | <b>Take-Profit:</b> $${takeProfit.toFixed(2)}\n` +
      `<b>Kalan Kasa:</b> $${this.state.paperBalance.toFixed(2)}`
    );

    this.saveState();
  }

  // Manual order directly executed by server
  public async executeManualOrder(
    symbol: string, 
    side: 'LONG' | 'SHORT', 
    orderType: 'MARKET' | 'LIMIT', 
    quantityUsdt: number, 
    leverage: number = 5,
    stopLoss?: number,
    takeProfit?: number
  ): Promise<Position | null> {
    const currentPrice = await this.fetchCurrentPrice(symbol);
    if (currentPrice <= 0) throw new Error('Fiyat alınamadı.');

    const initialMargin = quantityUsdt / leverage;
    if (initialMargin > this.state.paperBalance) {
      throw new Error(`Yetersiz bakiye. Gerekli: $${initialMargin.toFixed(2)}, Mevcut: $${this.state.paperBalance.toFixed(2)}`);
    }

    const quantity = quantityUsdt / currentPrice;

    const newPosition: Position = {
      id: `man-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      symbol: symbol.toUpperCase(),
      side,
      entryPrice: currentPrice,
      currentPrice,
      quantity,
      leverage,
      initialMargin,
      pnl: 0,
      pnlPercent: 0,
      entryTime: Date.now(),
      mode: this.state.tradingMode || 'PAPER',
      stopLoss,
      takeProfit,
      trailingStopHighest: side === 'LONG' ? currentPrice : undefined,
      trailingStopLowest: side === 'SHORT' ? currentPrice : undefined,
      strategyName: 'Manuel İşlem',
      botTriggered: false,
      openedBy: 'Kullanıcı Manuel'
    };

    this.state.paperBalance -= initialMargin;
    this.state.positions = [newPosition, ...this.state.positions];

    this.addLog('ORDER', `🖐️ Manuel Pozisyon Açıldı: ${symbol} ${side} @ $${currentPrice.toFixed(2)} ($${quantityUsdt.toFixed(2)})`);
    this.saveState();
    return newPosition;
  }

  public async closePositionById(positionId: string): Promise<boolean> {
    const pos = this.state.positions.find(p => p.id === positionId);
    if (!pos) return false;

    const currentPrice = await this.fetchCurrentPrice(pos.symbol);
    const exitPrice = currentPrice > 0 ? currentPrice : pos.currentPrice;

    const priceDiff = pos.side === 'LONG'
      ? (exitPrice - pos.entryPrice)
      : (pos.entryPrice - exitPrice);

    const pnl = priceDiff * pos.quantity * pos.leverage;
    const fee = (exitPrice * pos.quantity) * 0.00075;
    const netPnl = pnl - fee;

    this.state.paperBalance += (pos.initialMargin + netPnl);

    const tradeRecord: TradeRecord = {
      id: `trade-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      symbol: pos.symbol,
      side: pos.side,
      entryPrice: pos.entryPrice,
      exitPrice,
      quantity: pos.quantity,
      leverage: pos.leverage,
      pnl: netPnl,
      pnlPercent: (pnl / pos.initialMargin) * 100,
      entryTime: pos.entryTime,
      exitTime: Date.now(),
      fee,
      openedBy: pos.openedBy || 'Manuel Kapatma',
      strategyName: pos.strategyName,
      botTriggered: pos.botTriggered
    };

    this.state.closedTrades = this.deduplicateTrades([tradeRecord, ...this.state.closedTrades.slice(0, 200)]);
    this.state.positions = this.state.positions.filter(p => p.id !== positionId);

    this.addLog('ORDER', `🔒 Pozisyon Kapatıldı: ${pos.symbol} ${pos.side} @ $${exitPrice.toFixed(2)} | Net PnL: $${netPnl.toFixed(2)}`);
    this.saveState();
    return true;
  }

  public resetAccount(balance: number = 10000): void {
    this.state.paperBalance = balance;
    this.state.dailyStartBalance = balance;
    this.state.positions = [];
    this.state.orders = [];
    this.state.closedTrades = [];
    this.addLog('INFO', `🔄 Demo Hesap Sıfırlandı. Yeni Bakiye: $${balance}`);
    this.saveState();
  }
}

// Global Singleton Instance on Server
export const serverBot = new AutonomousBotEngine();
serverBot.start();
