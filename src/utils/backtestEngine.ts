import { Kline, StrategyConfig, BacktestResult, BacktestTrade, BacktestEquityPoint, SignalResult } from '../types/trading';
import { evaluateStrategySignal } from './indicators';
import { QUANT_STRATEGY_REGISTRY, evaluateQuantStrategySignal } from './quantStrategies';
import { QuantStrategyDefinition } from '../types/quant';

export interface BacktestOptions {
  initialBalance: number;
  makerFeePercent: number; // e.g. 0.075%
  takerFeePercent: number; // e.g. 0.075%
  slippagePercent: number; // e.g. 0.05%
  positionSizePercent?: number; // e.g. 80% (portion of balance used per trade)
  allowShorts?: boolean;
}

export function runBacktest(
  klines: Kline[],
  strategy: StrategyConfig,
  options: BacktestOptions
): BacktestResult {
  const initialBalance = options.initialBalance || 10000;
  let currentBalance = initialBalance;
  let peakBalance = initialBalance;
  let maxDrawdownUsdt = 0;
  let maxDrawdownPercent = 0;

  const trades: BacktestTrade[] = [];
  const equityHistory: BacktestEquityPoint[] = [];

  let activePosition: {
    side: 'LONG' | 'SHORT';
    entryTime: number;
    entryPrice: number;
    quantity: number;
    initialMargin: number;
    stopLoss?: number;
    takeProfit?: number;
  } | null = null;

  const minLookback = 35; // Warmup bars for indicators (EMA, SuperTrend, RSI)
  const posSizePct = (options.positionSizePercent ? options.positionSizePercent : 80) / 100;
  const takerFeeRate = (options.takerFeePercent || 0.075) / 100;
  const slipRate = (options.slippagePercent || 0.05) / 100;

  // Resolve whether this is a Quant Registry Strategy or standard config
  const quantDef = QUANT_STRATEGY_REGISTRY.find(q => 
    q.id === strategy.quantStrategyId || 
    q.id === strategy.id ||
    (strategy.id && strategy.id.toLowerCase().includes(q.id.replace('strat-', ''))) ||
    q.family === strategy.family ||
    q.family === (strategy.type as any)
  );

  const runtimeQuantStrat: QuantStrategyDefinition | null = quantDef ? {
    ...quantDef,
    id: strategy.quantStrategyId || strategy.id,
    name: strategy.name,
    defaultSymbol: strategy.symbol,
    timeframe: strategy.timeframe,
    direction: (strategy.direction || quantDef.direction) as any,
    parameters: { ...quantDef.parameters, ...(strategy.parameters || {}) }
  } : null;

  for (let i = minLookback; i < klines.length; i++) {
    const currentBar = klines[i];
    const prevSlice = klines.slice(0, i + 1);
    const closePrice = currentBar.close;
    const time = currentBar.time;

    // 1. INTRA-BAR STOP LOSS / TAKE PROFIT CHECK FOR ACTIVE POSITION
    if (activePosition) {
      if (activePosition.side === 'LONG') {
        // Hit Stop Loss
        if (activePosition.stopLoss && currentBar.low <= activePosition.stopLoss) {
          const finalExitPrice = activePosition.stopLoss * (1 - slipRate);
          const rawPnl = (finalExitPrice - activePosition.entryPrice) * activePosition.quantity;
          const exitFee = (finalExitPrice * activePosition.quantity) * takerFeeRate;
          const netPnl = rawPnl - exitFee;
          currentBalance += (activePosition.initialMargin + netPnl);

          trades.push({
            id: `BT-${trades.length + 1}`,
            symbol: strategy.symbol,
            side: 'LONG',
            entryTime: activePosition.entryTime,
            entryPrice: activePosition.entryPrice,
            exitTime: time,
            exitPrice: finalExitPrice,
            quantity: activePosition.quantity,
            pnl: netPnl,
            pnlPercent: (netPnl / activePosition.initialMargin) * 100,
            exitReason: 'STOP_LOSS',
            fee: exitFee
          });
          activePosition = null;
        } 
        // Hit Take Profit
        else if (activePosition.takeProfit && currentBar.high >= activePosition.takeProfit) {
          const finalExitPrice = activePosition.takeProfit * (1 - slipRate);
          const rawPnl = (finalExitPrice - activePosition.entryPrice) * activePosition.quantity;
          const exitFee = (finalExitPrice * activePosition.quantity) * takerFeeRate;
          const netPnl = rawPnl - exitFee;
          currentBalance += (activePosition.initialMargin + netPnl);

          trades.push({
            id: `BT-${trades.length + 1}`,
            symbol: strategy.symbol,
            side: 'LONG',
            entryTime: activePosition.entryTime,
            entryPrice: activePosition.entryPrice,
            exitTime: time,
            exitPrice: finalExitPrice,
            quantity: activePosition.quantity,
            pnl: netPnl,
            pnlPercent: (netPnl / activePosition.initialMargin) * 100,
            exitReason: 'TAKE_PROFIT',
            fee: exitFee
          });
          activePosition = null;
        }
      } else if (activePosition.side === 'SHORT') {
        // Hit Stop Loss
        if (activePosition.stopLoss && currentBar.high >= activePosition.stopLoss) {
          const finalExitPrice = activePosition.stopLoss * (1 + slipRate);
          const rawPnl = (activePosition.entryPrice - finalExitPrice) * activePosition.quantity;
          const exitFee = (finalExitPrice * activePosition.quantity) * takerFeeRate;
          const netPnl = rawPnl - exitFee;
          currentBalance += (activePosition.initialMargin + netPnl);

          trades.push({
            id: `BT-${trades.length + 1}`,
            symbol: strategy.symbol,
            side: 'SHORT',
            entryTime: activePosition.entryTime,
            entryPrice: activePosition.entryPrice,
            exitTime: time,
            exitPrice: finalExitPrice,
            quantity: activePosition.quantity,
            pnl: netPnl,
            pnlPercent: (netPnl / activePosition.initialMargin) * 100,
            exitReason: 'STOP_LOSS',
            fee: exitFee
          });
          activePosition = null;
        }
        // Hit Take Profit
        else if (activePosition.takeProfit && currentBar.low <= activePosition.takeProfit) {
          const finalExitPrice = activePosition.takeProfit * (1 + slipRate);
          const rawPnl = (activePosition.entryPrice - finalExitPrice) * activePosition.quantity;
          const exitFee = (finalExitPrice * activePosition.quantity) * takerFeeRate;
          const netPnl = rawPnl - exitFee;
          currentBalance += (activePosition.initialMargin + netPnl);

          trades.push({
            id: `BT-${trades.length + 1}`,
            symbol: strategy.symbol,
            side: 'SHORT',
            entryTime: activePosition.entryTime,
            entryPrice: activePosition.entryPrice,
            exitTime: time,
            exitPrice: finalExitPrice,
            quantity: activePosition.quantity,
            pnl: netPnl,
            pnlPercent: (netPnl / activePosition.initialMargin) * 100,
            exitReason: 'TAKE_PROFIT',
            fee: exitFee
          });
          activePosition = null;
        }
      }
    }

    // Pure Strategy Signal Evaluation (No fake intra-candle assumptions)
    let signal: SignalResult;
    if (runtimeQuantStrat) {
      signal = evaluateQuantStrategySignal(runtimeQuantStrat, prevSlice, i);
    } else {
      signal = evaluateStrategySignal(strategy, prevSlice, closePrice);
    }

    if (signal.type === 'BUY') {
      // 1. If currently in SHORT, close SHORT position on BUY reversal signal
      if (activePosition && activePosition.side === 'SHORT') {
        const finalExitPrice = closePrice * (1 + slipRate);
        const rawPnl = (activePosition.entryPrice - finalExitPrice) * activePosition.quantity;
        const exitFee = (finalExitPrice * activePosition.quantity) * takerFeeRate;
        const netPnl = rawPnl - exitFee;
        currentBalance += (activePosition.initialMargin + netPnl);

        trades.push({
          id: `BT-${trades.length + 1}`,
          symbol: strategy.symbol,
          side: 'SHORT',
          entryTime: activePosition.entryTime,
          entryPrice: activePosition.entryPrice,
          exitTime: time,
          exitPrice: finalExitPrice,
          quantity: activePosition.quantity,
          pnl: netPnl,
          pnlPercent: (netPnl / activePosition.initialMargin) * 100,
          exitReason: 'SIGNAL_REVERSAL',
          fee: exitFee
        });
        activePosition = null;
      }

      // 2. If flat, open LONG position
      if (!activePosition && strategy.direction !== 'SHORT') {
        const tradeAmountUsdt = Math.min(currentBalance * posSizePct, currentBalance * 0.98);

        if (tradeAmountUsdt > 20 && currentBalance > 50) {
          const entryPrice = closePrice * (1 + slipRate);
          const quantity = tradeAmountUsdt / entryPrice;
          const entryFee = (entryPrice * quantity) * takerFeeRate;
          currentBalance -= (tradeAmountUsdt + entryFee);

          activePosition = {
            side: 'LONG',
            entryTime: time,
            entryPrice,
            quantity,
            initialMargin: tradeAmountUsdt,
            stopLoss: signal.suggestedStopLoss || (entryPrice * 0.96),
            takeProfit: signal.suggestedTakeProfit || (entryPrice * 1.08)
          };
        }
      }
    } else if (signal.type === 'SELL') {
      // 1. If currently in LONG, close LONG position on SELL reversal signal
      if (activePosition && activePosition.side === 'LONG') {
        const finalExitPrice = closePrice * (1 - slipRate);
        const rawPnl = (finalExitPrice - activePosition.entryPrice) * activePosition.quantity;
        const exitFee = (finalExitPrice * activePosition.quantity) * takerFeeRate;
        const netPnl = rawPnl - exitFee;
        currentBalance += (activePosition.initialMargin + netPnl);

        trades.push({
          id: `BT-${trades.length + 1}`,
          symbol: strategy.symbol,
          side: 'LONG',
          entryTime: activePosition.entryTime,
          entryPrice: activePosition.entryPrice,
          exitTime: time,
          exitPrice: finalExitPrice,
          quantity: activePosition.quantity,
          pnl: netPnl,
          pnlPercent: (netPnl / activePosition.initialMargin) * 100,
          exitReason: 'SIGNAL_REVERSAL',
          fee: exitFee
        });
        activePosition = null;
      }

      // 2. If flat and shorting is allowed, open SHORT position
      if (!activePosition && options.allowShorts && strategy.direction !== 'LONG') {
        const tradeAmountUsdt = Math.min(currentBalance * posSizePct, currentBalance * 0.98);

        if (tradeAmountUsdt > 20 && currentBalance > 50) {
          const entryPrice = closePrice * (1 - slipRate);
          const quantity = tradeAmountUsdt / entryPrice;
          const entryFee = (entryPrice * quantity) * takerFeeRate;
          currentBalance -= (tradeAmountUsdt + entryFee);

          activePosition = {
            side: 'SHORT',
            entryTime: time,
            entryPrice,
            quantity,
            initialMargin: tradeAmountUsdt,
            stopLoss: signal.suggestedStopLoss || (entryPrice * 1.04),
            takeProfit: signal.suggestedTakeProfit || (entryPrice * 0.92)
          };
        }
      }
    }

    // Record Real-Time Equity and Drawdown
    let unrealizedPnl = 0;
    if (activePosition) {
      unrealizedPnl = activePosition.side === 'LONG'
        ? (closePrice - activePosition.entryPrice) * activePosition.quantity
        : (activePosition.entryPrice - closePrice) * activePosition.quantity;
    }
    const currentEquity = currentBalance + (activePosition ? (activePosition.initialMargin + unrealizedPnl) : 0);

    if (currentEquity > peakBalance) {
      peakBalance = currentEquity;
    }
    const currentDd = peakBalance - currentEquity;
    const currentDdPercent = peakBalance > 0 ? (currentDd / peakBalance) * 100 : 0;

    if (currentDd > maxDrawdownUsdt) maxDrawdownUsdt = currentDd;
    if (currentDdPercent > maxDrawdownPercent) maxDrawdownPercent = currentDdPercent;

    if (i % 2 === 0 || i === klines.length - 1) {
      equityHistory.push({
        time,
        equity: parseFloat(currentEquity.toFixed(2)),
        drawdown: parseFloat(currentDd.toFixed(2)),
        drawdownPercent: parseFloat(currentDdPercent.toFixed(2))
      });
    }
  }

  // Settle any remaining active position at final bar close with real candle price
  if (activePosition && klines.length > 0) {
    const lastBar = klines[klines.length - 1];
    const finalExitPrice = activePosition.side === 'LONG'
      ? lastBar.close * (1 - slipRate)
      : lastBar.close * (1 + slipRate);

    const rawPnl = activePosition.side === 'LONG'
      ? (finalExitPrice - activePosition.entryPrice) * activePosition.quantity
      : (activePosition.entryPrice - finalExitPrice) * activePosition.quantity;

    const exitFee = (finalExitPrice * activePosition.quantity) * takerFeeRate;
    const netPnl = rawPnl - exitFee;
    currentBalance += (activePosition.initialMargin + netPnl);

    trades.push({
      id: `BT-${trades.length + 1}`,
      symbol: strategy.symbol,
      side: activePosition.side,
      entryTime: activePosition.entryTime,
      entryPrice: activePosition.entryPrice,
      exitTime: lastBar.time,
      exitPrice: finalExitPrice,
      quantity: activePosition.quantity,
      pnl: netPnl,
      pnlPercent: (netPnl / activePosition.initialMargin) * 100,
      exitReason: 'END_OF_DATA',
      fee: exitFee
    });
    activePosition = null;
  }

  // Calculate Summary Metrics
  const winningTrades = trades.filter(t => t.pnl > 0);
  const losingTrades = trades.filter(t => t.pnl <= 0);
  const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;

  const grossProfit = winningTrades.reduce((acc, t) => acc + t.pnl, 0);
  const grossLoss = Math.abs(losingTrades.reduce((acc, t) => acc + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99.9 : 0;

  const netProfit = currentBalance - initialBalance;
  const totalReturnPercent = (netProfit / initialBalance) * 100;

  // Calculate Sharpe & Sortino (annualized estimate based on returns)
  const returns = trades.map(t => t.pnlPercent / 100);
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  
  const returnVariance = returns.length > 1
    ? returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1)
    : 0;
  const stdDev = Math.sqrt(returnVariance);

  const downsideReturns = returns.filter(r => r < 0);
  const downsideVariance = downsideReturns.length > 1
    ? downsideReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / (downsideReturns.length - 1)
    : 0.0001;
  const downsideStdDev = Math.sqrt(downsideVariance);

  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(365) : 0;
  const sortinoRatio = downsideStdDev > 0 ? (avgReturn / downsideStdDev) * Math.sqrt(365) : 0;
  const calmarRatio = maxDrawdownPercent > 0 ? totalReturnPercent / maxDrawdownPercent : 0;

  const totalHoldingMinutes = trades.reduce((acc, t) => acc + (t.exitTime - t.entryTime) / 60000, 0);
  const avgHoldingPeriodMinutes = trades.length > 0 ? Math.round(totalHoldingMinutes / trades.length) : 0;

  // Monte Carlo Simulation (100 runs resampled)
  const monteCarloRuns: number[] = [];
  for (let m = 0; m < 100; m++) {
    let simulatedBalance = initialBalance;
    for (let s = 0; s < trades.length; s++) {
      const randomTrade = trades[Math.floor(Math.random() * trades.length)];
      if (randomTrade) {
        simulatedBalance += randomTrade.pnl;
      }
    }
    monteCarloRuns.push(((simulatedBalance - initialBalance) / initialBalance) * 100);
  }
  monteCarloRuns.sort((a, b) => a - b);
  const worstCaseReturn = monteCarloRuns[5] || 0; // 5th percentile
  const medianReturn = monteCarloRuns[50] || 0; // 50th percentile
  const bestCaseReturn = monteCarloRuns[95] || 0; // 95th percentile
  const ruinCount = monteCarloRuns.filter(r => r <= -50).length;

  return {
    symbol: strategy.symbol,
    timeframe: strategy.timeframe,
    startDate: klines[0] ? new Date(klines[0].time).toLocaleDateString() : '',
    endDate: klines[klines.length - 1] ? new Date(klines[klines.length - 1].time).toLocaleDateString() : '',
    initialBalance,
    finalBalance: parseFloat(currentBalance.toFixed(2)),
    netProfit: parseFloat(netProfit.toFixed(2)),
    totalReturnPercent: parseFloat(totalReturnPercent.toFixed(2)),
    totalTrades: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate: parseFloat(winRate.toFixed(1)),
    profitFactor: parseFloat(profitFactor.toFixed(2)),
    maxDrawdownPercent: parseFloat(maxDrawdownPercent.toFixed(2)),
    maxDrawdownUsdt: parseFloat(maxDrawdownUsdt.toFixed(2)),
    sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
    sortinoRatio: parseFloat(sortinoRatio.toFixed(2)),
    calmarRatio: parseFloat(calmarRatio.toFixed(2)),
    avgTradeProfitUsdt: trades.length > 0 ? parseFloat((netProfit / trades.length).toFixed(2)) : 0,
    avgHoldingPeriodMinutes,
    trades,
    equityHistory,
    monteCarloSimulations: {
      medianReturn: parseFloat(medianReturn.toFixed(1)),
      worstCaseReturn: parseFloat(worstCaseReturn.toFixed(1)),
      bestCaseReturn: parseFloat(bestCaseReturn.toFixed(1)),
      riskOfRuinPercent: ruinCount
    }
  };
}
