export interface Kline {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime?: number;
  quoteVolume?: number;
  trades?: number;
}

export interface IndicatorValues {
  rsi?: number;
  ema9?: number;
  ema20?: number;
  ema50?: number;
  ema200?: number;
  sma20?: number;
  bbUpper?: number;
  bbMiddle?: number;
  bbLower?: number;
  bbBandwidth?: number;
  macdLine?: number;
  macdSignal?: number;
  macdHist?: number;
  atr?: number;
  superTrend?: number;
  superTrendDirection?: 'BULLISH' | 'BEARISH';
  adx?: number;
  plusDI?: number;
  minusDI?: number;
  isSqueeze?: boolean;
  volumeMa?: number;
  volumeRatio?: number;
}

export type StrategyType = 
  | 'QUANT_STRATEGY'
  | 'TREND_FOLLOWING'
  | 'MOMENTUM'
  | 'MEAN_REVERSION'
  | 'BREAKOUT_VOLATILITY'
  | 'REGIME_SWITCHING'
  | 'MULTI_FACTOR_QUANT'
  | 'QUANT_TREND_MACRO'
  | 'EMA_CROSS'
  | 'EMA_PULLBACK_PRO'
  | 'SUPERTREND_MOMENTUM'
  | 'SMC_LIQUIDITY_SWEEP'
  | 'VOLATILITY_SQUEEZE'
  | 'RSI_BB_REVERSION'
  | 'MACD_SCALPER'
  | 'DYNAMIC_GRID'
  | 'MULTI_CONFIRMATION'
  | string;

export type StrategyDirection = 'BOTH' | 'LONG' | 'SHORT';

export interface StrategyConfig {
  id: string;
  name: string;
  type: StrategyType;
  family?: string;
  quantStrategyId?: string;
  direction?: StrategyDirection;
  enabled: boolean;
  symbol: string;
  timeframe: string;
  isDefault?: boolean;
  version?: string;
  hypothesis?: string;
  mathematicalFormula?: string;
  economicRationale?: string;
  suitability?: string;
  marketCondition?: string;
  parameters?: Record<string, number | boolean | string>;
  parameterBounds?: Record<string, { min: number; max: number; step: number; default: number; label: string }>;
  tags?: string[];
  description?: string;

  // Direct parameter mappings for flexible quant access
  lookbackHigh?: number;
  lookbackLow?: number;
  atrMultiplier?: number;
  adxFilter?: number;
  fastEma?: number;
  slowEma?: number;
  macroEma?: number;
  lookbackBars?: number;
  thresholdZScore?: number;
  volatilityLookback?: number;
  zScoreThreshold?: number;
  smaPeriod?: number;
  rsiOversold?: number;
  rsiOverbought?: number;
  maxAdxFilter?: number;
  bbPeriod?: number;
  bbStdDev?: number;
  kcPeriod?: number;
  kcMultiplier?: number;
  trendAdxThreshold?: number;
  chopAdxThreshold?: number;
  emaFast?: number;
  emaSlow?: number;
  thresholdScore?: number;
  trendWeight?: number;
  momWeight?: number;
  volWeight?: number;
  volumeWeight?: number;
  
  trendFilterEma?: number;
  rsiPeriod?: number;
  superTrendPeriod?: number;
  superTrendMultiplier?: number;
  gridLevels?: number;
  gridLowerPrice?: number;
  gridUpperPrice?: number;
  gridInvestmentUsdt?: number;
  volumeFilterEnabled?: boolean;
  minVolumeMultiplier?: number;
}

export interface SignalResult {
  symbol: string;
  type: 'BUY' | 'SELL' | 'HOLD';
  confidence: number; // 0 - 100
  price: number;
  timestamp: number;
  reasons: string[];
  suggestedStopLoss?: number;
  suggestedTakeProfit?: number;
  timeframe: string;
  strategyName: string;
}

export interface Position {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  leverage: number;
  pnl: number;
  pnlPercent: number;
  initialMargin: number;
  stopLoss?: number;
  takeProfit?: number;
  trailingStopActive?: boolean;
  trailingStopHighest?: number; // for Long
  trailingStopLowest?: number; // for Short
  trailingStopCallbackRate?: number; // e.g. 1.5%
  breakevenApplied?: boolean;
  entryTime: number;
  mode: 'PAPER' | 'LIVE';
  openedBy?: string; // Bot / Strateji Adı veya 'Manuel İşlem'
  strategyId?: string;
  strategyName?: string;
  botTriggered?: boolean; // true if auto bot opened this
  signalReason?: string;
}

export interface Order {
  id: string;
  clientOrderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'TWAP' | 'ICEBERG';
  status: 'PENDING' | 'OPEN' | 'FILLED' | 'CANCELED' | 'REJECTED';
  price?: number;
  quantity: number;
  filledQuantity: number;
  avgFillPrice?: number;
  timestamp: number;
  mode: 'PAPER' | 'LIVE';
  openedBy?: string;
  strategyName?: string;
  botTriggered?: boolean;
  // Advanced algo fields
  twapTotalParts?: number;
  twapFilledParts?: number;
  twapIntervalSeconds?: number;
  icebergDisplayQty?: number;
  feeUsdt?: number;
  slippagePercent?: number;
}

export type PositionSizingMode = 'FIXED_AMOUNT' | 'PERCENT_PORTFOLIO' | 'ATR_VOLATILITY' | 'KELLY';

export interface RiskSettings {
  maxDrawdownPercent: number; // e.g. 10%
  dailyLossLimitUsdt: number; // e.g. 200 USDT
  positionSizingMode: PositionSizingMode;
  fixedAmountUsdt: number; // e.g. 100 USDT
  percentPortfolio: number; // e.g. 5%
  atrMultiplier: number; // e.g. 1.5x ATR risk
  maxLeverage: number; // e.g. 5x
  maxOpenPositions: number; // e.g. 3
  defaultStopLossPercent: number; // e.g. 2.0%
  defaultTakeProfitPercent: number; // e.g. 4.0%
  trailingStopEnabled: boolean;
  trailingStopPercent: number; // e.g. 1.5%
  breakevenTriggerPercent: number; // e.g. 1.5% profit moves SL to entry
  killSwitchOnDailyLoss: boolean;
  signalTimeoutMinutes?: number; // Sinyalin geçerlilik süresi (dakika) - örn: 3 dk sonra bayat sinyal sayılır
  minSignalConfidence?: number; // Minimum güven puanı (örn: %75)
  requireFreshCross?: boolean; // Sadece son mumda taze kesişim/kırılım varsa al
}

export interface BacktestTrade {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryTime: number;
  entryPrice: number;
  exitTime: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  exitReason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'TRAILING_STOP' | 'SIGNAL_REVERSAL' | 'END_OF_DATA';
  fee: number;
}

export interface BacktestEquityPoint {
  time: number;
  equity: number;
  drawdown: number;
  drawdownPercent: number;
}

export interface BacktestResult {
  symbol: string;
  timeframe: string;
  startDate: string;
  endDate: string;
  initialBalance: number;
  finalBalance: number;
  netProfit: number;
  totalReturnPercent: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  maxDrawdownPercent: number;
  maxDrawdownUsdt: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  avgTradeProfitUsdt: number;
  avgHoldingPeriodMinutes: number;
  trades: BacktestTrade[];
  equityHistory: BacktestEquityPoint[];
  monteCarloSimulations?: {
    medianReturn: number;
    worstCaseReturn: number;
    bestCaseReturn: number;
    riskOfRuinPercent: number;
  };
}

export interface LogEntry {
  id: string;
  timestamp: number;
  level: 'INFO' | 'WARN' | 'SIGNAL' | 'ORDER' | 'ERROR' | 'RISK';
  message: string;
  details?: any;
}

export interface ApiCredentials {
  apiKey: string;
  apiSecret: string;
  isTestnet: boolean;
  isConnected: boolean;
  canTrade: boolean;
  lastChecked?: number;
}

export interface TelegramSettings {
  enabled: boolean;
  botToken: string;
  chatId: string;
  notifyOnTrade: boolean;
  notifyOnStopLoss: boolean;
  notifyOnDailyLimit: boolean;
}

export interface AccountBalance {
  asset: string;
  free: number;
  locked: number;
  total: number;
  valueUsdt?: number;
}

export interface MarketTicker {
  symbol: string;
  lastPrice: number;
  priceChangePercent: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  quoteVolume: number;
}
