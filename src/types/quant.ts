import { Kline, BacktestTrade, BacktestEquityPoint } from './trading';

export type QuantStrategyFamily = 
  | 'TREND_FOLLOWING'
  | 'MOMENTUM'
  | 'MEAN_REVERSION'
  | 'BREAKOUT_VOLATILITY'
  | 'REGIME_SWITCHING'
  | 'MULTI_FACTOR_QUANT';

export type MarketRegimeType = 
  | 'BULL_TREND'
  | 'BEAR_TREND'
  | 'SIDEWAYS_CHOP'
  | 'HIGH_VOLATILITY'
  | 'LOW_VOLATILITY';

export type StrategyApprovalStatus = 
  | 'RESEARCH' 
  | 'BACKTESTED'
  | 'OOS_FAILED'
  | 'OOS_VALIDATED'
  | 'STAGED_PAPER'
  | 'REJECTED'
  | 'APPROVED_LIVE';

export interface QuantStrategyDefinition {
  id: string;
  name: string;
  family: QuantStrategyFamily;
  version: string;
  author: string;
  createdAt: number;
  updatedAt: number;
  timeframe: string;
  defaultSymbol: string;
  direction: 'LONG' | 'SHORT' | 'BOTH';
  expectedRegime: MarketRegimeType;
  hypothesis: string;
  mathematicalFormula: string;
  economicRationale: string;
  parameters: Record<string, number | boolean | string>;
  parameterBounds?: Record<string, { min: number; max: number; step: number; default: number; label: string }>;
  status: StrategyApprovalStatus;
  notes?: string;
  tags: string[];
}

export interface DetailedQuantMetrics {
  initialBalance: number;
  finalBalance: number;
  netProfit: number;
  netProfitPercent: number;
  grossProfit: number;
  grossLoss: number;
  totalCommissionPaid: number;
  totalSlippagePaid: number;
  
  // Risk-adjusted metrics
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  profitFactor: number;
  
  // Trade statistics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWinUsdt: number;
  avgLossUsdt: number;
  winLossRatio: number;
  expectancyUsdt: number; // EV per trade
  expectancyPercent: number;
  
  // Drawdown
  maxDrawdownPercent: number;
  maxDrawdownUsdt: number;
  avgDrawdownPercent: number;
  maxConsecutiveLosses: number;
  maxConsecutiveWins: number;
  
  // Directional Breakdown
  longTradesCount: number;
  longWinRate: number;
  longNetProfit: number;
  shortTradesCount: number;
  shortWinRate: number;
  shortNetProfit: number;
  
  // Time in market
  avgHoldingBars: number;
  timeInMarketPercent: number;
  
  // Trade array & equity
  trades: BacktestTrade[];
  equityCurve: BacktestEquityPoint[];
}

export interface TrainValidationTestResult {
  strategyId: string;
  symbol: string;
  timeframe: string;
  totalCandles: number;
  dataStartDate: string;
  dataEndDate: string;
  
  inSampleMetrics: DetailedQuantMetrics;    // 60%
  validationMetrics: DetailedQuantMetrics;  // 20%
  outOfSampleMetrics: DetailedQuantMetrics; // 20%
  
  // Overfitting and Robustness Assessment
  overfitDiagnosis: {
    isOverfitted: boolean;
    robustnessScore: number; // 0 to 100
    performanceDegradationPercent: number; // IS return vs OOS return drop
    sharpeDropPercent: number;
    verdict: 'ROBUST_INSTITUTIONAL' | 'ACCEPTABLE' | 'SUSPECT_OVERFIT' | 'CRITICAL_FAILURE';
    flags: string[];
    recommendations: string[];
  };
}

export interface WalkForwardWindowResult {
  windowIndex: number;
  trainStartDate: string;
  trainEndDate: string;
  testStartDate: string;
  testEndDate: string;
  trainReturnPercent: number;
  trainSharpe: number;
  testReturnPercent: number;
  testSharpe: number;
  testMaxDrawdownPercent: number;
  testTradesCount: number;
  windowEfficiency: number; // Test Return / Train Return
}

export interface WalkForwardAnalysisResult {
  strategyId: string;
  symbol: string;
  timeframe: string;
  windowsCount: number;
  overallWalkForwardEfficiency: number; // WFE %
  averageOosReturn: number;
  averageOosSharpe: number;
  averageOosDrawdown: number;
  isStableAcrossPeriods: boolean;
  windows: WalkForwardWindowResult[];
  summaryNote: string;
}

export interface RegimePerformanceResult {
  regime: MarketRegimeType;
  regimeLabel: string;
  candleCount: number;
  percentageOfHistory: number;
  tradesCount: number;
  winRate: number;
  netProfitPercent: number;
  profitFactor: number;
  sharpeRatio: number;
  isSuitable: boolean;
}

export interface CrossAssetTestResult {
  strategyId: string;
  testedSymbols: {
    symbol: string;
    totalReturnPercent: number;
    winRate: number;
    profitFactor: number;
    sharpeRatio: number;
    maxDrawdownPercent: number;
    tradesCount: number;
    passed: boolean;
  }[];
  crossAssetRobustnessScore: number; // 0 - 100
  isAssetSpecific: boolean;
  verdict: 'UNIVERSAL_QUANT_EDGE' | 'MAJOR_PAIR_ROBUST' | 'BTC_SPECIFIC' | 'FAILS_CROSS_ASSET';
}

export interface ParameterSensitivityPoint {
  parameterName: string;
  parameterValue: number;
  returnPercent: number;
  sharpeRatio: number;
  profitFactor: number;
  maxDrawdown: number;
}

export interface ParameterSensitivityResult {
  parameterName: string;
  baseValue: number;
  optimalValue: number;
  points: ParameterSensitivityPoint[];
  isFragileSpike: boolean; // Overfitting check: is there a wide plateau or sharp isolated peak?
  plateauWidth: number;
}

export interface StrategyVersionRecord {
  version: string;
  timestamp: number;
  parameters: Record<string, any>;
  author: 'USER' | 'AI_RESEARCH_AGENT';
  notes: string;
  oosSharpe?: number;
  oosReturnPercent?: number;
  wfePercent?: number;
  status: StrategyApprovalStatus;
}

export interface AiResearchHypothesis {
  hypothesisTitle: string;
  family: QuantStrategyFamily;
  economicRationale: string;
  mathematicalLogic: string;
  targetRegime: MarketRegimeType;
  proposedParameters: Record<string, number>;
  expectedRiskFactors: string[];
  testPlan: string;
}

export interface AiStrategyAudit {
  strategyName: string;
  score: number; // 0 - 100
  verdict: 'APPROVED_FOR_PAPER' | 'REJECT_OVERFIT' | 'REJECT_HIGH_DRAWDOWN' | 'INSUFFICIENT_EDGE';
  mathematicalCritique: string;
  overfittingRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  marketRegimeFit: string;
  keyWeaknesses: string[];
  suggestedImprovements: string[];
}
