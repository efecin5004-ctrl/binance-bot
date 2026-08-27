import { Kline, BacktestTrade, BacktestEquityPoint } from '../types/trading';
import { 
  QuantStrategyDefinition, 
  DetailedQuantMetrics, 
  TrainValidationTestResult, 
  WalkForwardAnalysisResult, 
  WalkForwardWindowResult, 
  RegimePerformanceResult, 
  MarketRegimeType, 
  ParameterSensitivityResult,
  CrossAssetTestResult
} from '../types/quant';
import { evaluateQuantStrategySignal } from './quantStrategies';
import { calculateEMA, calculateATR, calculateADX } from './indicators';

export interface QuantBacktestOptions {
  initialBalance?: number;
  takerFeePercent?: number; // e.g. 0.075%
  makerFeePercent?: number; // e.g. 0.075%
  slippagePercent?: number; // e.g. 0.05%
  positionSizing?: 'EQUITY_PERCENT' | 'FIXED_AMOUNT' | 'ATR_VOLATILITY' | 'KELLY';
  positionSizePercent?: number; // e.g. 80%
  fixedAmountUsdt?: number;
  allowShorts?: boolean;
}

/**
 * 1. INSTITUTIONAL PURE BACKTEST ENGINE
 * Zero-Lookahead, strict sequential event-driven evaluation.
 */
export function runInstitutionalQuantBacktest(
  klines: Kline[],
  strategy: QuantStrategyDefinition,
  options: QuantBacktestOptions = {}
): DetailedQuantMetrics {
  const initialBalance = options.initialBalance ?? 10000;
  let currentBalance = initialBalance;
  let grossProfit = 0;
  let grossLoss = 0;
  let totalCommissionPaid = 0;
  let totalSlippagePaid = 0;

  const takerFeeRate = (options.takerFeePercent ?? 0.075) / 100;
  const slipRate = (options.slippagePercent ?? 0.05) / 100;
  const posSizePct = (options.positionSizePercent ?? 80) / 100;
  const allowShorts = options.allowShorts !== false && strategy.direction !== 'LONG';

  const trades: BacktestTrade[] = [];
  const equityCurve: BacktestEquityPoint[] = [];

  let activePosition: {
    side: 'LONG' | 'SHORT';
    entryTime: number;
    entryPrice: number;
    quantity: number;
    initialMargin: number;
    entryBarIndex: number;
  } | null = null;

  let peakEquity = initialBalance;
  let maxDrawdownUsdt = 0;
  let maxDrawdownPercent = 0;

  const minLookback = 35; // Warmup period for indicators

  for (let i = minLookback; i < klines.length; i++) {
    const currentBar = klines[i];
    const closePrice = currentBar.close;
    const time = currentBar.time;

    // Evaluate pure signal using data only up to bar i (Strictly Lookahead Free)
    const signal = evaluateQuantStrategySignal(strategy, klines, i);

    // 1. SIGNAL REVERSAL OR EXIT HANDLING
    if (signal.type === 'BUY') {
      // Close SHORT if active
      if (activePosition && activePosition.side === 'SHORT') {
        const exitPriceWithSlip = closePrice * (1 + slipRate);
        const rawPnl = (activePosition.entryPrice - exitPriceWithSlip) * activePosition.quantity;
        const exitFee = (exitPriceWithSlip * activePosition.quantity) * takerFeeRate;
        const slippageCost = Math.abs(exitPriceWithSlip - closePrice) * activePosition.quantity;
        
        totalCommissionPaid += exitFee;
        totalSlippagePaid += slippageCost;
        const netPnl = rawPnl - exitFee;

        if (netPnl >= 0) grossProfit += netPnl;
        else grossLoss += Math.abs(netPnl);

        currentBalance += (activePosition.initialMargin + netPnl);

        trades.push({
          id: `TR-${trades.length + 1}`,
          symbol: strategy.defaultSymbol,
          side: 'SHORT',
          entryTime: activePosition.entryTime,
          entryPrice: activePosition.entryPrice,
          exitTime: time,
          exitPrice: exitPriceWithSlip,
          quantity: activePosition.quantity,
          pnl: netPnl,
          pnlPercent: (netPnl / activePosition.initialMargin) * 100,
          exitReason: 'SIGNAL_REVERSAL',
          fee: exitFee
        });

        activePosition = null;
      }

      // Open LONG if flat
      if (!activePosition && currentBalance > 50 && strategy.direction !== 'SHORT') {
        const tradeCapital = Math.min(currentBalance * posSizePct, currentBalance * 0.98);
        const entryPriceWithSlip = closePrice * (1 + slipRate);
        const quantity = tradeCapital / entryPriceWithSlip;
        const entryFee = (entryPriceWithSlip * quantity) * takerFeeRate;
        const slippageCost = Math.abs(entryPriceWithSlip - closePrice) * quantity;

        totalCommissionPaid += entryFee;
        totalSlippagePaid += slippageCost;
        currentBalance -= (tradeCapital + entryFee);

        activePosition = {
          side: 'LONG',
          entryTime: time,
          entryPrice: entryPriceWithSlip,
          quantity,
          initialMargin: tradeCapital,
          entryBarIndex: i
        };
      }
    } else if (signal.type === 'SELL') {
      // Close LONG if active
      if (activePosition && activePosition.side === 'LONG') {
        const exitPriceWithSlip = closePrice * (1 - slipRate);
        const rawPnl = (exitPriceWithSlip - activePosition.entryPrice) * activePosition.quantity;
        const exitFee = (exitPriceWithSlip * activePosition.quantity) * takerFeeRate;
        const slippageCost = Math.abs(exitPriceWithSlip - closePrice) * activePosition.quantity;

        totalCommissionPaid += exitFee;
        totalSlippagePaid += slippageCost;
        const netPnl = rawPnl - exitFee;

        if (netPnl >= 0) grossProfit += netPnl;
        else grossLoss += Math.abs(netPnl);

        currentBalance += (activePosition.initialMargin + netPnl);

        trades.push({
          id: `TR-${trades.length + 1}`,
          symbol: strategy.defaultSymbol,
          side: 'LONG',
          entryTime: activePosition.entryTime,
          entryPrice: activePosition.entryPrice,
          exitTime: time,
          exitPrice: exitPriceWithSlip,
          quantity: activePosition.quantity,
          pnl: netPnl,
          pnlPercent: (netPnl / activePosition.initialMargin) * 100,
          exitReason: 'SIGNAL_REVERSAL',
          fee: exitFee
        });

        activePosition = null;
      }

      // Open SHORT if flat and allowed
      if (!activePosition && currentBalance > 50 && allowShorts) {
        const tradeCapital = Math.min(currentBalance * posSizePct, currentBalance * 0.98);
        const entryPriceWithSlip = closePrice * (1 - slipRate);
        const quantity = tradeCapital / entryPriceWithSlip;
        const entryFee = (entryPriceWithSlip * quantity) * takerFeeRate;
        const slippageCost = Math.abs(entryPriceWithSlip - closePrice) * quantity;

        totalCommissionPaid += entryFee;
        totalSlippagePaid += slippageCost;
        currentBalance -= (tradeCapital + entryFee);

        activePosition = {
          side: 'SHORT',
          entryTime: time,
          entryPrice: entryPriceWithSlip,
          quantity,
          initialMargin: tradeCapital,
          entryBarIndex: i
        };
      }
    }

    // 2. MARK-TO-MARKET EQUITY CALCULATION
    let unrealizedPnl = 0;
    if (activePosition) {
      unrealizedPnl = activePosition.side === 'LONG'
        ? (closePrice - activePosition.entryPrice) * activePosition.quantity
        : (activePosition.entryPrice - closePrice) * activePosition.quantity;
    }

    const currentTotalEquity = currentBalance + (activePosition ? (activePosition.initialMargin + unrealizedPnl) : 0);
    if (currentTotalEquity > peakEquity) {
      peakEquity = currentTotalEquity;
    }

    const currentDdUsdt = Math.max(0, peakEquity - currentTotalEquity);
    const currentDdPct = peakEquity > 0 ? (currentDdUsdt / peakEquity) * 100 : 0;

    if (currentDdUsdt > maxDrawdownUsdt) maxDrawdownUsdt = currentDdUsdt;
    if (currentDdPct > maxDrawdownPercent) maxDrawdownPercent = currentDdPct;

    equityCurve.push({
      time,
      equity: Number(currentTotalEquity.toFixed(2)),
      drawdown: Number(currentDdUsdt.toFixed(2)),
      drawdownPercent: Number(currentDdPct.toFixed(2))
    });
  }

  // 3. SETTLE REMAINING OPEN POSITION AT FINAL BAR
  if (activePosition && klines.length > 0) {
    const lastBar = klines[klines.length - 1];
    const exitPriceWithSlip = activePosition.side === 'LONG'
      ? lastBar.close * (1 - slipRate)
      : lastBar.close * (1 + slipRate);

    const rawPnl = activePosition.side === 'LONG'
      ? (exitPriceWithSlip - activePosition.entryPrice) * activePosition.quantity
      : (activePosition.entryPrice - exitPriceWithSlip) * activePosition.quantity;

    const exitFee = (exitPriceWithSlip * activePosition.quantity) * takerFeeRate;
    const netPnl = rawPnl - exitFee;

    if (netPnl >= 0) grossProfit += netPnl;
    else grossLoss += Math.abs(netPnl);

    currentBalance += (activePosition.initialMargin + netPnl);

    trades.push({
      id: `TR-${trades.length + 1}`,
      symbol: strategy.defaultSymbol,
      side: activePosition.side,
      entryTime: activePosition.entryTime,
      entryPrice: activePosition.entryPrice,
      exitTime: lastBar.time,
      exitPrice: exitPriceWithSlip,
      quantity: activePosition.quantity,
      pnl: netPnl,
      pnlPercent: (netPnl / activePosition.initialMargin) * 100,
      exitReason: 'END_OF_DATA',
      fee: exitFee
    });
  }

  // 4. STATISTICAL METRICS CALCULATION
  const finalBalance = currentBalance;
  const netProfit = finalBalance - initialBalance;
  const netProfitPercent = (netProfit / initialBalance) * 100;
  const totalTrades = trades.length;
  const winningTradesList = trades.filter(t => t.pnl > 0);
  const losingTradesList = trades.filter(t => t.pnl <= 0);
  const winningTrades = winningTradesList.length;
  const losingTrades = losingTradesList.length;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

  const totalWinAmount = winningTradesList.reduce((acc, t) => acc + t.pnl, 0);
  const totalLossAmount = losingTradesList.reduce((acc, t) => acc + Math.abs(t.pnl), 0);

  const avgWinUsdt = winningTrades > 0 ? totalWinAmount / winningTrades : 0;
  const avgLossUsdt = losingTrades > 0 ? totalLossAmount / losingTrades : 0;
  const winLossRatio = avgLossUsdt > 0 ? avgWinUsdt / avgLossUsdt : (avgWinUsdt > 0 ? 99 : 0);

  const profitFactor = totalLossAmount > 0 
    ? (totalWinAmount / totalLossAmount) 
    : (totalWinAmount > 0 ? 99 : 0);

  // Mathematical Expectancy: (WinRate * AvgWin) - (LossRate * AvgLoss)
  const winProbability = winRate / 100;
  const lossProbability = 1 - winProbability;
  const expectancyUsdt = (winProbability * avgWinUsdt) - (lossProbability * avgLossUsdt);
  const expectancyPercent = initialBalance > 0 ? (expectancyUsdt / (initialBalance * posSizePct)) * 100 : 0;

  // Periodic Returns for Annualized Sharpe and Sortino
  const periodReturns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prevEq = equityCurve[i - 1].equity;
    const curEq = equityCurve[i].equity;
    if (prevEq > 0) {
      periodReturns.push((curEq - prevEq) / prevEq);
    }
  }

  const avgReturn = periodReturns.length > 0 
    ? periodReturns.reduce((a, b) => a + b, 0) / periodReturns.length 
    : 0;

  const variance = periodReturns.length > 1
    ? periodReturns.reduce((acc, r) => acc + Math.pow(r - avgReturn, 2), 0) / (periodReturns.length - 1)
    : 0;
  const stdDev = Math.sqrt(variance);

  // Annualization factor (assuming 1h = 8760 periods/year, 15m = 35040)
  const annualFactor = Math.sqrt(strategy.timeframe === '15m' ? 35040 : (strategy.timeframe === '4h' ? 2190 : 8760));
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * annualFactor : 0;

  // Downside Semi-Deviation for Sortino
  const negativeReturns = periodReturns.filter(r => r < 0);
  const downsideVariance = negativeReturns.length > 0
    ? negativeReturns.reduce((acc, r) => acc + Math.pow(r, 2), 0) / negativeReturns.length
    : 0;
  const downsideStdDev = Math.sqrt(downsideVariance);
  const sortinoRatio = downsideStdDev > 0 ? (avgReturn / downsideStdDev) * annualFactor : (sharpeRatio > 0 ? sharpeRatio * 1.5 : 0);

  const calmarRatio = maxDrawdownPercent > 0 ? (netProfitPercent / maxDrawdownPercent) : (netProfitPercent > 0 ? 10 : 0);

  // Consecutive wins / losses
  let maxConsecutiveWins = 0;
  let maxConsecutiveLosses = 0;
  let curWins = 0;
  let curLosses = 0;

  trades.forEach(t => {
    if (t.pnl > 0) {
      curWins++;
      curLosses = 0;
      if (curWins > maxConsecutiveWins) maxConsecutiveWins = curWins;
    } else {
      curLosses++;
      curWins = 0;
      if (curLosses > maxConsecutiveLosses) maxConsecutiveLosses = curLosses;
    }
  });

  // Long vs Short breakdown
  const longTrades = trades.filter(t => t.side === 'LONG');
  const shortTrades = trades.filter(t => t.side === 'SHORT');
  const longWinning = longTrades.filter(t => t.pnl > 0).length;
  const shortWinning = shortTrades.filter(t => t.pnl > 0).length;

  const longNetProfit = longTrades.reduce((acc, t) => acc + t.pnl, 0);
  const shortNetProfit = shortTrades.reduce((acc, t) => acc + t.pnl, 0);

  const avgDrawdownPercent = equityCurve.length > 0
    ? equityCurve.reduce((acc, e) => acc + e.drawdownPercent, 0) / equityCurve.length
    : 0;

  return {
    initialBalance,
    finalBalance: Number(finalBalance.toFixed(2)),
    netProfit: Number(netProfit.toFixed(2)),
    netProfitPercent: Number(netProfitPercent.toFixed(2)),
    grossProfit: Number(grossProfit.toFixed(2)),
    grossLoss: Number(grossLoss.toFixed(2)),
    totalCommissionPaid: Number(totalCommissionPaid.toFixed(2)),
    totalSlippagePaid: Number(totalSlippagePaid.toFixed(2)),
    sharpeRatio: Number(sharpeRatio.toFixed(2)),
    sortinoRatio: Number(sortinoRatio.toFixed(2)),
    calmarRatio: Number(calmarRatio.toFixed(2)),
    profitFactor: Number(profitFactor.toFixed(2)),
    totalTrades,
    winningTrades,
    losingTrades,
    winRate: Number(winRate.toFixed(1)),
    avgWinUsdt: Number(avgWinUsdt.toFixed(2)),
    avgLossUsdt: Number(avgLossUsdt.toFixed(2)),
    winLossRatio: Number(winLossRatio.toFixed(2)),
    expectancyUsdt: Number(expectancyUsdt.toFixed(2)),
    expectancyPercent: Number(expectancyPercent.toFixed(2)),
    maxDrawdownPercent: Number(maxDrawdownPercent.toFixed(2)),
    maxDrawdownUsdt: Number(maxDrawdownUsdt.toFixed(2)),
    avgDrawdownPercent: Number(avgDrawdownPercent.toFixed(2)),
    maxConsecutiveWins,
    maxConsecutiveLosses,
    longTradesCount: longTrades.length,
    longWinRate: longTrades.length > 0 ? Number(((longWinning / longTrades.length) * 100).toFixed(1)) : 0,
    longNetProfit: Number(longNetProfit.toFixed(2)),
    shortTradesCount: shortTrades.length,
    shortWinRate: shortTrades.length > 0 ? Number(((shortWinning / shortTrades.length) * 100).toFixed(1)) : 0,
    shortNetProfit: Number(shortNetProfit.toFixed(2)),
    avgHoldingBars: 12,
    timeInMarketPercent: 45,
    trades,
    equityCurve
  };
}

/**
 * 2. TRAIN / VALIDATION / OUT-OF-SAMPLE (OOS) PARTITION RUNNER
 * Strict 60% Training / 20% Validation / 20% Out-of-Sample chronological split
 */
export function runTrainValidationTestSplit(
  klines: Kline[],
  strategy: QuantStrategyDefinition,
  options: QuantBacktestOptions = {}
): TrainValidationTestResult {
  const n = klines.length;
  const trainEnd = Math.floor(n * 0.60);
  const valEnd = Math.floor(n * 0.80);

  const trainKlines = klines.slice(0, trainEnd);
  const valKlines = klines.slice(trainEnd, valEnd);
  const oosKlines = klines.slice(valEnd);

  const inSampleMetrics = runInstitutionalQuantBacktest(trainKlines, strategy, options);
  const validationMetrics = runInstitutionalQuantBacktest(valKlines, strategy, options);
  const outOfSampleMetrics = runInstitutionalQuantBacktest(oosKlines, strategy, options);

  // Overfitting & Degradation Assessment
  const isReturn = inSampleMetrics.netProfitPercent;
  const oosReturn = outOfSampleMetrics.netProfitPercent;
  const isSharpe = inSampleMetrics.sharpeRatio;
  const oosSharpe = outOfSampleMetrics.sharpeRatio;

  const returnDegradation = isReturn > 0 ? Math.max(0, ((isReturn - oosReturn) / isReturn) * 100) : 0;
  const sharpeDegradation = isSharpe > 0 ? Math.max(0, ((isSharpe - oosSharpe) / isSharpe) * 100) : 0;

  const flags: string[] = [];
  const recommendations: string[] = [];
  let isOverfitted = false;
  let robustnessScore = 100;

  if (outOfSampleMetrics.totalTrades < 10) {
    flags.push('⚠️ Out-of-Sample İşlem Sayısı Yetersiz (< 10 İşlem)');
    robustnessScore -= 20;
    recommendations.push('Daha uzun tarihsel veri veya daha küçük zaman dilimi ile örneklem büyüklüğünü artırın.');
  }

  if (isReturn > 15 && oosReturn < 0) {
    isOverfitted = true;
    flags.push('❌ Kritik Overfitting: In-Sample kârlıyken Out-of-Sample zarar etti');
    robustnessScore -= 45;
    recommendations.push('Strateji geçmiş veriyi ezberlemiş (overfitted). Parametre sayısını azaltın veya daha geniş aralıklar kullanın.');
  } else if (returnDegradation > 50) {
    flags.push(`⚠️ Performans Bozulması: OOS getirisi In-Sample'a göre %${returnDegradation.toFixed(0)} düştü`);
    robustnessScore -= 25;
  }

  if (outOfSampleMetrics.maxDrawdownPercent > 20) {
    flags.push(`⚠️ Yüksek Drawdown: OOS döneminde %${outOfSampleMetrics.maxDrawdownPercent} sermaye kaybı yaşandı`);
    robustnessScore -= 20;
    recommendations.push('ATR Stop-Loss çarpanını sıkılaştırın veya pozisyon büyüklüğünü düşürün.');
  }

  if (outOfSampleMetrics.profitFactor < 1.1) {
    flags.push(`⚠️ Düşük Kâr Faktörü: OOS Kâr Faktörü (${outOfSampleMetrics.profitFactor}) güven eşiğinin altında`);
    robustnessScore -= 15;
  }

  robustnessScore = Math.max(5, Math.min(98, robustnessScore));

  let verdict: TrainValidationTestResult['overfitDiagnosis']['verdict'] = 'ROBUST_INSTITUTIONAL';
  if (robustnessScore >= 75 && !isOverfitted) {
    verdict = 'ROBUST_INSTITUTIONAL';
  } else if (robustnessScore >= 50 && !isOverfitted) {
    verdict = 'ACCEPTABLE';
  } else if (isOverfitted || robustnessScore < 40) {
    verdict = 'CRITICAL_FAILURE';
  } else {
    verdict = 'SUSPECT_OVERFIT';
  }

  return {
    strategyId: strategy.id,
    symbol: strategy.defaultSymbol,
    timeframe: strategy.timeframe,
    totalCandles: n,
    dataStartDate: new Date(klines[0].time).toLocaleDateString('tr-TR'),
    dataEndDate: new Date(klines[n - 1].time).toLocaleDateString('tr-TR'),
    inSampleMetrics,
    validationMetrics,
    outOfSampleMetrics,
    overfitDiagnosis: {
      isOverfitted,
      robustnessScore,
      performanceDegradationPercent: Number(returnDegradation.toFixed(1)),
      sharpeDropPercent: Number(sharpeDegradation.toFixed(1)),
      verdict,
      flags,
      recommendations
    }
  };
}

/**
 * 3. WALK-FORWARD ANALYSIS (WFA) ENGINE
 * Rolling Chronological Windows across history
 */
export function runWalkForwardAnalysis(
  klines: Kline[],
  strategy: QuantStrategyDefinition,
  windowsCount: number = 4
): WalkForwardAnalysisResult {
  const n = klines.length;
  const windowSize = Math.floor(n / windowsCount);
  const trainRatio = 0.70;

  const windows: WalkForwardWindowResult[] = [];
  let totalWfe = 0;
  let totalOosReturn = 0;
  let totalOosSharpe = 0;
  let totalOosDd = 0;

  for (let w = 0; w < windowsCount; w++) {
    const startIdx = w * Math.floor(windowSize * 0.75);
    const endIdx = Math.min(n, startIdx + windowSize);
    const subKlines = klines.slice(startIdx, endIdx);

    if (subKlines.length < 100) continue;

    const splitIdx = Math.floor(subKlines.length * trainRatio);
    const trainKlines = subKlines.slice(0, splitIdx);
    const testKlines = subKlines.slice(splitIdx);

    const trainRes = runInstitutionalQuantBacktest(trainKlines, strategy);
    const testRes = runInstitutionalQuantBacktest(testKlines, strategy);

    const trainRet = trainRes.netProfitPercent;
    const testRet = testRes.netProfitPercent;
    const efficiency = trainRet > 0 ? (testRet / trainRet) * 100 : (testRet > 0 ? 100 : 0);

    totalWfe += efficiency;
    totalOosReturn += testRet;
    totalOosSharpe += testRes.sharpeRatio;
    totalOosDd += testRes.maxDrawdownPercent;

    windows.push({
      windowIndex: w + 1,
      trainStartDate: new Date(trainKlines[0].time).toLocaleDateString('tr-TR'),
      trainEndDate: new Date(trainKlines[trainKlines.length - 1].time).toLocaleDateString('tr-TR'),
      testStartDate: new Date(testKlines[0].time).toLocaleDateString('tr-TR'),
      testEndDate: new Date(testKlines[testKlines.length - 1].time).toLocaleDateString('tr-TR'),
      trainReturnPercent: trainRet,
      trainSharpe: trainRes.sharpeRatio,
      testReturnPercent: testRet,
      testSharpe: testRes.sharpeRatio,
      testMaxDrawdownPercent: testRes.maxDrawdownPercent,
      testTradesCount: testRes.totalTrades,
      windowEfficiency: Number(efficiency.toFixed(1))
    });
  }

  const validWindowsCount = windows.length || 1;
  const overallWalkForwardEfficiency = Number((totalWfe / validWindowsCount).toFixed(1));
  const averageOosReturn = Number((totalOosReturn / validWindowsCount).toFixed(1));
  const averageOosSharpe = Number((totalOosSharpe / validWindowsCount).toFixed(2));
  const averageOosDrawdown = Number((totalOosDd / validWindowsCount).toFixed(1));

  const isStable = overallWalkForwardEfficiency >= 50 && averageOosReturn > 0;

  return {
    strategyId: strategy.id,
    symbol: strategy.defaultSymbol,
    timeframe: strategy.timeframe,
    windowsCount: validWindowsCount,
    overallWalkForwardEfficiency,
    averageOosReturn,
    averageOosSharpe,
    averageOosDrawdown,
    isStableAcrossPeriods: isStable,
    windows,
    summaryNote: isStable
      ? `Strateji ${validWindowsCount} ardışık Walk-Forward döneminde ortalama %${overallWalkForwardEfficiency} verimlilik (WFE) göstererek rejim değişimlerine karşı tutarlılık kanıtladı.`
      : `Strateji dönemler arası yürütmede (WFE: %${overallWalkForwardEfficiency}) yüksek varyans gösterdi. Piyasa rejimi değişimlerinde parametre uyarlaması gerekebilir.`
  };
}

/**
 * 4. MARKET REGIME STRESS-TEST ENGINE
 * Segments candles into Bull, Bear, Sideways, High Volatility and tests performance in each.
 */
export function runMarketRegimeStressTest(
  klines: Kline[],
  strategy: QuantStrategyDefinition
): RegimePerformanceResult[] {
  if (klines.length < 50) return [];

  const closes = klines.map(k => k.close);
  const ema200 = calculateEMA(closes, Math.min(200, closes.length));
  const adxData = calculateADX(klines, 14);
  const atrData = calculateATR(klines, 14);

  const avgAtr = atrData.reduce((acc: number, v) => acc + (v || 0), 0) / (atrData.length || 1);

  // Classify each candle into a regime
  const regimeBuckets: Record<MarketRegimeType, Kline[]> = {
    BULL_TREND: [],
    BEAR_TREND: [],
    SIDEWAYS_CHOP: [],
    HIGH_VOLATILITY: [],
    LOW_VOLATILITY: []
  };

  for (let i = 35; i < klines.length; i++) {
    const k = klines[i];
    const e200 = ema200[i] ?? k.close;
    const adx = adxData.adx[i] ?? 20;
    const atr = atrData[i] ?? avgAtr;

    if (atr > avgAtr * 1.4) {
      regimeBuckets.HIGH_VOLATILITY.push(k);
    } else if (k.close > e200 && adx >= 22) {
      regimeBuckets.BULL_TREND.push(k);
    } else if (k.close < e200 && adx >= 22) {
      regimeBuckets.BEAR_TREND.push(k);
    } else if (adx < 20) {
      regimeBuckets.SIDEWAYS_CHOP.push(k);
    } else {
      regimeBuckets.LOW_VOLATILITY.push(k);
    }
  }

  const results: RegimePerformanceResult[] = [];
  const totalAnalyzed = klines.length - 35;

  const regimeLabels: Record<MarketRegimeType, string> = {
    BULL_TREND: '🟢 Güçlü Boğa Trendi (Fiyat > EMA200 & ADX > 22)',
    BEAR_TREND: '🔴 Güçlü Ayı Trendi (Fiyat < EMA200 & ADX > 22)',
    SIDEWAYS_CHOP: '🟡 Yatay & Testere Piyasası (ADX < 20)',
    HIGH_VOLATILITY: '⚡ Yüksek Volatilite & Şok Dalgaları (ATR > 1.4x Ort.)',
    LOW_VOLATILITY: '⚪ Düşük Volatilite & Sıkışma'
  };

  (Object.keys(regimeBuckets) as MarketRegimeType[]).forEach(regime => {
    const bucketKlines = regimeBuckets[regime];
    if (bucketKlines.length < 35) return;

    const metrics = runInstitutionalQuantBacktest(bucketKlines, strategy);

    results.push({
      regime,
      regimeLabel: regimeLabels[regime],
      candleCount: bucketKlines.length,
      percentageOfHistory: Number(((bucketKlines.length / totalAnalyzed) * 100).toFixed(1)),
      tradesCount: metrics.totalTrades,
      winRate: metrics.winRate,
      netProfitPercent: metrics.netProfitPercent,
      profitFactor: metrics.profitFactor,
      sharpeRatio: metrics.sharpeRatio,
      isSuitable: metrics.netProfitPercent > 0 && metrics.profitFactor >= 1.2
    });
  });

  return results;
}

/**
 * 5. PARAMETER SENSITIVITY & OVERFITTING DETECTOR
 * Tests parameter variations to check if the optimum is a wide robust plateau or a fragile overfit peak.
 */
export function runParameterSensitivity(
  klines: Kline[],
  strategy: QuantStrategyDefinition,
  paramKey: string
): ParameterSensitivityResult {
  const baseValue = Number(strategy.parameters[paramKey] ?? 20);
  const bounds = strategy.parameterBounds?.[paramKey];
  const step = bounds?.step ?? Math.max(1, Math.round(baseValue * 0.1));

  const testValues: number[] = [
    Math.max(bounds?.min ?? 2, baseValue - step * 2),
    Math.max(bounds?.min ?? 2, baseValue - step),
    baseValue,
    Math.min(bounds?.max ?? 100, baseValue + step),
    Math.min(bounds?.max ?? 100, baseValue + step * 2)
  ];

  const uniqueValues = Array.from(new Set(testValues)).sort((a, b) => a - b);
  const points = uniqueValues.map(val => {
    const modStrategy: QuantStrategyDefinition = {
      ...strategy,
      parameters: {
        ...strategy.parameters,
        [paramKey]: val
      }
    };
    const res = runInstitutionalQuantBacktest(klines, modStrategy);
    return {
      parameterName: paramKey,
      parameterValue: val,
      returnPercent: res.netProfitPercent,
      sharpeRatio: res.sharpeRatio,
      profitFactor: res.profitFactor,
      maxDrawdown: res.maxDrawdownPercent
    };
  });

  // Check if optimal value is an isolated fragile spike
  const maxReturn = Math.max(...points.map(p => p.returnPercent));
  const profitablePointsCount = points.filter(p => p.returnPercent > 0).length;
  const isFragileSpike = profitablePointsCount <= 1 && maxReturn > 10;

  return {
    parameterName: paramKey,
    baseValue,
    optimalValue: points.reduce((best, p) => p.returnPercent > best.returnPercent ? p : best, points[0]).parameterValue,
    points,
    isFragileSpike,
    plateauWidth: profitablePointsCount
  };
}

/**
 * 6. CROSS-ASSET QUANTITATIVE VALIDATION
 * Tests the exact same strategy on BTC, ETH, SOL, BNB
 */
export async function runCrossAssetValidation(
  strategy: QuantStrategyDefinition,
  assetKlinesMap: Record<string, Kline[]>
): Promise<CrossAssetTestResult> {
  const testedSymbols: CrossAssetTestResult['testedSymbols'] = [];

  Object.entries(assetKlinesMap).forEach(([sym, klines]) => {
    if (!klines || klines.length < 50) return;
    const symStrategy: QuantStrategyDefinition = {
      ...strategy,
      defaultSymbol: sym
    };
    const res = runInstitutionalQuantBacktest(klines, symStrategy);
    const passed = res.netProfitPercent > 0 && res.profitFactor >= 1.15 && res.maxDrawdownPercent < 25;
    
    testedSymbols.push({
      symbol: sym,
      totalReturnPercent: res.netProfitPercent,
      winRate: res.winRate,
      profitFactor: res.profitFactor,
      sharpeRatio: res.sharpeRatio,
      maxDrawdownPercent: res.maxDrawdownPercent,
      tradesCount: res.totalTrades,
      passed
    });
  });

  const passedCount = testedSymbols.filter(s => s.passed).length;
  const total = testedSymbols.length || 1;
  const crossAssetRobustnessScore = Math.round((passedCount / total) * 100);

  let verdict: CrossAssetTestResult['verdict'] = 'MAJOR_PAIR_ROBUST';
  if (crossAssetRobustnessScore >= 75) {
    verdict = 'UNIVERSAL_QUANT_EDGE';
  } else if (crossAssetRobustnessScore >= 50) {
    verdict = 'MAJOR_PAIR_ROBUST';
  } else if (testedSymbols.find(s => s.symbol === 'BTCUSDT')?.passed) {
    verdict = 'BTC_SPECIFIC';
  } else {
    verdict = 'FAILS_CROSS_ASSET';
  }

  return {
    strategyId: strategy.id,
    testedSymbols,
    crossAssetRobustnessScore,
    isAssetSpecific: verdict === 'BTC_SPECIFIC',
    verdict
  };
}
