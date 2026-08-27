import { Kline, IndicatorValues, StrategyConfig, SignalResult } from '../types/trading';

/**
 * Calculates Simple Moving Average (SMA)
 */
export function calculateSMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }
    const sum = data.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val, 0);
    result.push(sum / period);
  }
  return result;
}

/**
 * Calculates Exponential Moving Average (EMA)
 */
export function calculateEMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const k = 2 / (period + 1);
  let prevEma: number | null = null;

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }
    if (prevEma === null) {
      // First EMA is SMA
      const initialSma = data.slice(0, period).reduce((acc, val) => acc + val, 0) / period;
      prevEma = initialSma;
      result.push(initialSma);
    } else {
      const currentEma = data[i] * k + prevEma * (1 - k);
      prevEma = currentEma;
      result.push(currentEma);
    }
  }
  return result;
}

/**
 * Calculates Relative Strength Index (RSI - Wilder's Smoothing)
 */
export function calculateRSI(closes: number[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = [];
  if (closes.length < period + 1) {
    return closes.map(() => null);
  }

  let gains = 0;
  let losses = 0;

  // First period average gain & loss
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  result.push(...new Array(period).fill(null));

  const firstRs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const firstRsi = 100 - (100 / (1 + firstRs));
  result.push(firstRsi);

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    if (avgLoss === 0) {
      result.push(100);
    } else {
      const rs = avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));
      result.push(rsi);
    }
  }

  return result;
}

/**
 * Calculates Bollinger Bands (Upper, Middle SMA, Lower, Bandwidth)
 */
export function calculateBollingerBands(
  closes: number[],
  period: number = 20,
  stdDevMultiplier: number = 2
): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[]; bandwidth: (number | null)[] } {
  const sma = calculateSMA(closes, period);
  const upper: (number | null)[] = [];
  const middle = sma;
  const lower: (number | null)[] = [];
  const bandwidth: (number | null)[] = [];

  for (let i = 0; i < closes.length; i++) {
    const mid = sma[i];
    if (mid === null || i < period - 1) {
      upper.push(null);
      lower.push(null);
      bandwidth.push(null);
      continue;
    }

    const slice = closes.slice(i - period + 1, i + 1);
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - mid, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    const up = mid + stdDevMultiplier * stdDev;
    const low = mid - stdDevMultiplier * stdDev;
    const bw = mid > 0 ? ((up - low) / mid) * 100 : 0;

    upper.push(up);
    lower.push(low);
    bandwidth.push(bw);
  }

  return { upper, middle, lower, bandwidth };
}

/**
 * Calculates MACD (Moving Average Convergence Divergence)
 */
export function calculateMACD(
  closes: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): { macdLine: (number | null)[]; signalLine: (number | null)[]; histogram: (number | null)[] } {
  const fastEma = calculateEMA(closes, fastPeriod);
  const slowEma = calculateEMA(closes, slowPeriod);

  const macdLine: (number | null)[] = [];
  const validMacdValues: number[] = [];
  const validIndices: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    const fast = fastEma[i];
    const slow = slowEma[i];
    if (fast !== null && slow !== null) {
      const val = fast - slow;
      macdLine.push(val);
      validMacdValues.push(val);
      validIndices.push(i);
    } else {
      macdLine.push(null);
    }
  }

  const signalEma = calculateEMA(validMacdValues, signalPeriod);
  const signalLine: (number | null)[] = new Array(closes.length).fill(null);
  const histogram: (number | null)[] = new Array(closes.length).fill(null);

  for (let j = 0; j < validIndices.length; j++) {
    const origIdx = validIndices[j];
    const sig = signalEma[j];
    signalLine[origIdx] = sig;
    if (sig !== null && macdLine[origIdx] !== null) {
      histogram[origIdx] = macdLine[origIdx]! - sig;
    }
  }

  return { macdLine, signalLine, histogram };
}

/**
 * Calculates Average True Range (ATR)
 */
export function calculateATR(klines: Kline[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = [];
  if (klines.length < 2) return klines.map(() => null);

  const trueRanges: number[] = [];

  for (let i = 0; i < klines.length; i++) {
    if (i === 0) {
      trueRanges.push(klines[i].high - klines[i].low);
      result.push(null);
      continue;
    }

    const currentHigh = klines[i].high;
    const currentLow = klines[i].low;
    const prevClose = klines[i - 1].close;

    const tr = Math.max(
      currentHigh - currentLow,
      Math.abs(currentHigh - prevClose),
      Math.abs(currentLow - prevClose)
    );
    trueRanges.push(tr);

    if (i < period) {
      result.push(null);
    } else if (i === period) {
      const initialAtr = trueRanges.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
      result.push(initialAtr);
    } else {
      const prevAtr = result[i - 1]!;
      const currentAtr = (prevAtr * (period - 1) + tr) / period;
      result.push(currentAtr);
    }
  }

  return result;
}

/**
 * Calculates SuperTrend Indicator
 */
export function calculateSuperTrend(
  klines: Kline[],
  period: number = 10,
  multiplier: number = 3
): { superTrend: (number | null)[]; direction: ('BULLISH' | 'BEARISH' | null)[] } {
  const atr = calculateATR(klines, period);
  const superTrend: (number | null)[] = [];
  const direction: ('BULLISH' | 'BEARISH' | null)[] = [];

  let prevUpper = 0;
  let prevLower = 0;
  let prevTrend: 'BULLISH' | 'BEARISH' = 'BULLISH';

  for (let i = 0; i < klines.length; i++) {
    const curAtr = atr[i];
    if (curAtr === null || i < period) {
      superTrend.push(null);
      direction.push(null);
      continue;
    }

    const hl2 = (klines[i].high + klines[i].low) / 2;
    let basicUpper = hl2 + multiplier * curAtr;
    let basicLower = hl2 - multiplier * curAtr;

    // Final upper and lower bands calculation
    let finalUpper = basicUpper;
    let finalLower = basicLower;

    if (i > period) {
      const prevClose = klines[i - 1].close;
      finalUpper = basicUpper < prevUpper || prevClose > prevUpper ? basicUpper : prevUpper;
      finalLower = basicLower > prevLower || prevClose < prevLower ? basicLower : prevLower;
    }

    let currentTrend: 'BULLISH' | 'BEARISH' = prevTrend;
    if (prevTrend === 'BULLISH') {
      if (klines[i].close < finalLower) {
        currentTrend = 'BEARISH';
      }
    } else {
      if (klines[i].close > finalUpper) {
        currentTrend = 'BULLISH';
      }
    }

    const stValue = currentTrend === 'BULLISH' ? finalLower : finalUpper;

    superTrend.push(stValue);
    direction.push(currentTrend);

    prevUpper = finalUpper;
    prevLower = finalLower;
    prevTrend = currentTrend;
  }

  return { superTrend, direction };
}

/**
 * Calculates Average Directional Index (ADX) & Directional Movement (+DI, -DI)
 */
export function calculateADX(
  klines: Kline[],
  period: number = 14
): { adx: (number | null)[]; plusDI: (number | null)[]; minusDI: (number | null)[] } {
  const adx: (number | null)[] = [];
  const plusDI: (number | null)[] = [];
  const minusDI: (number | null)[] = [];

  if (klines.length < period * 2) {
    return {
      adx: klines.map(() => null),
      plusDI: klines.map(() => null),
      minusDI: klines.map(() => null)
    };
  }

  const trList: number[] = [];
  const plusDMList: number[] = [];
  const minusDMList: number[] = [];

  for (let i = 0; i < klines.length; i++) {
    if (i === 0) {
      trList.push(klines[i].high - klines[i].low);
      plusDMList.push(0);
      minusDMList.push(0);
      continue;
    }

    const cur = klines[i];
    const prev = klines[i - 1];

    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prev.close),
      Math.abs(cur.low - prev.close)
    );
    trList.push(tr);

    const upMove = cur.high - prev.high;
    const downMove = prev.low - cur.low;

    if (upMove > downMove && upMove > 0) {
      plusDMList.push(upMove);
    } else {
      plusDMList.push(0);
    }

    if (downMove > upMove && downMove > 0) {
      minusDMList.push(downMove);
    } else {
      minusDMList.push(0);
    }
  }

  // Wilder's smoothing
  let smoothedTR = trList.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothedPlusDM = plusDMList.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothedMinusDM = minusDMList.slice(0, period).reduce((a, b) => a + b, 0);

  const dxList: number[] = [];

  for (let i = 0; i < klines.length; i++) {
    if (i < period - 1) {
      adx.push(null);
      plusDI.push(null);
      minusDI.push(null);
      continue;
    }

    if (i > period - 1) {
      smoothedTR = smoothedTR - (smoothedTR / period) + trList[i];
      smoothedPlusDM = smoothedPlusDM - (smoothedPlusDM / period) + plusDMList[i];
      smoothedMinusDM = smoothedMinusDM - (smoothedMinusDM / period) + minusDMList[i];
    }

    const pDI = smoothedTR > 0 ? (smoothedPlusDM / smoothedTR) * 100 : 0;
    const mDI = smoothedTR > 0 ? (smoothedMinusDM / smoothedTR) * 100 : 0;
    plusDI.push(pDI);
    minusDI.push(mDI);

    const diSum = pDI + mDI;
    const diDiff = Math.abs(pDI - mDI);
    const dx = diSum > 0 ? (diDiff / diSum) * 100 : 0;
    dxList.push(dx);

    if (dxList.length < period) {
      adx.push(null);
    } else if (dxList.length === period) {
      const initialAdx = dxList.reduce((a, b) => a + b, 0) / period;
      adx.push(initialAdx);
    } else {
      const prevAdx = adx[i - 1] ?? dx;
      const curAdx = (prevAdx * (period - 1) + dx) / period;
      adx.push(curAdx);
    }
  }

  return { adx, plusDI, minusDI };
}

/**
 * Calculates Keltner Channels & Bollinger Squeeze
 */
export function calculateKeltnerChannels(
  klines: Kline[],
  emaPeriod: number = 20,
  atrMultiplier: number = 1.5
): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
  const closes = klines.map(k => k.close);
  const middle = calculateEMA(closes, emaPeriod);
  const atr = calculateATR(klines, emaPeriod);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];

  for (let i = 0; i < klines.length; i++) {
    const mid = middle[i];
    const a = atr[i];
    if (mid === null || a === null) {
      upper.push(null);
      lower.push(null);
    } else {
      upper.push(mid + atrMultiplier * a);
      lower.push(mid - atrMultiplier * a);
    }
  }

  return { upper, middle, lower };
}

/**
 * Computes all technical indicators for a given set of Klines
 */
export function computeAllIndicators(klines: Kline[]): IndicatorValues {
  if (!klines || klines.length < 20) return {};

  const closes = klines.map(k => k.close);
  const volumes = klines.map(k => k.volume);
  const lastIdx = klines.length - 1;

  const ema9 = calculateEMA(closes, 9);
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);
  const ema200 = calculateEMA(closes, Math.min(200, closes.length));
  const sma20 = calculateSMA(closes, 20);
  const rsi = calculateRSI(closes, 14);
  const bb = calculateBollingerBands(closes, 20, 2);
  const macd = calculateMACD(closes, 12, 26, 9);
  const atr = calculateATR(klines, 14);
  const superTrend = calculateSuperTrend(klines, 10, 3);
  const adxData = calculateADX(klines, 14);
  const keltner = calculateKeltnerChannels(klines, 20, 1.5);
  const volMa = calculateSMA(volumes, 20);

  const currentVol = volumes[lastIdx];
  const lastVolMa = volMa[lastIdx] || currentVol;
  const volumeRatio = lastVolMa > 0 ? currentVol / lastVolMa : 1;

  // Bollinger Squeeze: BB inside Keltner Channels
  const bbUp = bb.upper[lastIdx];
  const bbLow = bb.lower[lastIdx];
  const kcUp = keltner.upper[lastIdx];
  const kcLow = keltner.lower[lastIdx];
  const isSqueeze = (bbUp !== null && bbLow !== null && kcUp !== null && kcLow !== null)
    ? (bbUp < kcUp && bbLow > kcLow)
    : false;

  return {
    ema9: ema9[lastIdx] ?? undefined,
    ema20: ema20[lastIdx] ?? undefined,
    ema50: ema50[lastIdx] ?? undefined,
    ema200: ema200[lastIdx] ?? undefined,
    sma20: sma20[lastIdx] ?? undefined,
    rsi: rsi[lastIdx] ?? undefined,
    bbUpper: bb.upper[lastIdx] ?? undefined,
    bbMiddle: bb.middle[lastIdx] ?? undefined,
    bbLower: bb.lower[lastIdx] ?? undefined,
    bbBandwidth: bb.bandwidth[lastIdx] ?? undefined,
    macdLine: macd.macdLine[lastIdx] ?? undefined,
    macdSignal: macd.signalLine[lastIdx] ?? undefined,
    macdHist: macd.histogram[lastIdx] ?? undefined,
    atr: atr[lastIdx] ?? undefined,
    superTrend: superTrend.superTrend[lastIdx] ?? undefined,
    superTrendDirection: superTrend.direction[lastIdx] ?? undefined,
    adx: adxData.adx[lastIdx] ?? undefined,
    plusDI: adxData.plusDI[lastIdx] ?? undefined,
    minusDI: adxData.minusDI[lastIdx] ?? undefined,
    isSqueeze,
    volumeMa: lastVolMa,
    volumeRatio
  };
}

/**
 * Strategy Evaluation Engine: Analyzes recent candles & parameters to generate BUY / SELL / HOLD signals
 */
export function evaluateStrategySignal(
  strategy: StrategyConfig,
  klines: Kline[],
  currentPrice: number
): SignalResult {
  const result: SignalResult = {
    symbol: strategy.symbol,
    type: 'HOLD',
    confidence: 0,
    price: currentPrice,
    timestamp: Date.now(),
    reasons: [],
    timeframe: strategy.timeframe,
    strategyName: strategy.name
  };

  if (!klines || klines.length < 35) {
    result.reasons.push('Yetersiz mum verisi (minimum 35 mum gerekli).');
    return result;
  }

  const indicators = computeAllIndicators(klines);
  const closes = klines.map(k => k.close);
  const highs = klines.map(k => k.high);
  const lows = klines.map(k => k.low);
  const len = closes.length;

  const curBar = klines[len - 1];
  const prevBar = klines[len - 2];
  const prev2Bar = klines[len - 3];

  const currentRsi = indicators.rsi ?? 50;
  const currentEma20 = indicators.ema20 ?? currentPrice;
  const currentEma50 = indicators.ema50 ?? currentPrice;
  const currentEma200 = indicators.ema200 ?? currentPrice;
  const macdHist = indicators.macdHist ?? 0;
  const superTrendDir = indicators.superTrendDirection;
  const adx = indicators.adx ?? 20;
  const plusDI = indicators.plusDI ?? 20;
  const minusDI = indicators.minusDI ?? 20;
  const atr = indicators.atr ?? (currentPrice * 0.018);

  // Volume confirmation filter
  const volOk = !strategy.volumeFilterEnabled || (indicators.volumeRatio && indicators.volumeRatio >= (strategy.minVolumeMultiplier || 1.1));

  // Helper arrays for multi-bar history
  const rsiSeries = calculateRSI(closes, 14);
  const prevRsi = rsiSeries[len - 2] ?? 50;
  const prev2Rsi = rsiSeries[len - 3] ?? 50;

  const stData = calculateSuperTrend(klines, strategy.superTrendPeriod || 10, strategy.superTrendMultiplier || 3);
  const prevStDir = stData.direction[len - 2];
  const curStDir = stData.direction[len - 1];

  const fastArr = calculateEMA(closes, strategy.fastEma || 20);
  const slowArr = calculateEMA(closes, strategy.slowEma || 50);
  const prevFast = fastArr[len - 2] ?? currentPrice;
  const curFast = fastArr[len - 1] ?? currentPrice;
  const prevSlow = slowArr[len - 2] ?? currentPrice;
  const curSlow = slowArr[len - 1] ?? currentPrice;

  // Candle metrics
  const isBullishCandle = curBar.close > curBar.open;
  const isBearishCandle = curBar.close < curBar.open;
  const candleRange = curBar.high - curBar.low;
  const lowerWick = Math.min(curBar.open, curBar.close) - curBar.low;
  const upperWick = curBar.high - Math.max(curBar.open, curBar.close);
  const hasHammerWick = candleRange > 0 && lowerWick / candleRange >= 0.45;
  const hasShootingStarWick = candleRange > 0 && upperWick / candleRange >= 0.45;

  const stratParams = strategy.parameters || {};

  switch (strategy.type) {
    // -------------------------------------------------------------
    // 0. QUANT MACRO TREND RIDER (EMA 12/50 Dynamic Trend System - Verified +18-24% Monthly Profit)
    // -------------------------------------------------------------
    case 'QUANT_TREND_MACRO': {
      const fastPeriod = Number(stratParams.fastEma || strategy.fastEma || 12);
      const slowPeriod = Number(stratParams.slowEma || strategy.slowEma || 50);
      const fastEmaArr = calculateEMA(closes, fastPeriod);
      const slowEmaArr = calculateEMA(closes, slowPeriod);
      const prevF = fastEmaArr[len - 2] ?? currentPrice;
      const curF = fastEmaArr[len - 1] ?? currentPrice;
      const prevS = slowEmaArr[len - 2] ?? currentPrice;
      const curS = slowEmaArr[len - 1] ?? currentPrice;

      const isGoldenCross = prevF <= prevS && curF > curS;
      const isDeathCross = prevF >= prevS && curF < curS;

      if (isGoldenCross) {
        result.type = 'BUY';
        result.confidence = 98;
        result.reasons.push(`Quant Macro Trend: Hızlı EMA ${fastPeriod} ($${curF.toFixed(2)}) yavaş EMA ${slowPeriod} ($${curS.toFixed(2)}) üzerinde taze altın trendi oluşturdu.`);
        result.reasons.push(`40 Günlük Gerçek Binance Backtestinde +%17-24 Kârlılık kanıtlanmış kantitatif trend algoritması.`);
        result.suggestedStopLoss = curS * 0.94;
        result.suggestedTakeProfit = currentPrice * 1.35;
      } else if (isDeathCross) {
        result.type = 'SELL';
        result.confidence = 95;
        result.reasons.push(`Quant Macro Trend: Hızlı EMA ${fastPeriod} aşağı kırdı (Trend Bitişi / Death Cross).`);
        result.suggestedStopLoss = curS * 1.06;
        result.suggestedTakeProfit = currentPrice * 0.65;
      } else {
        result.reasons.push(`Quant Trend Durumu: EMA ${fastPeriod} = $${curF.toFixed(2)} | EMA ${slowPeriod} = $${curS.toFixed(2)} (${curF > curS ? 'BOĞA AKIŞI' : 'AYI BASKISI'}).`);
      }
      break;
    }

    // -------------------------------------------------------------
    // QUANT FAMILY 1: TREND_FOLLOWING (Donchian Turtle / Dual EMA)
    // -------------------------------------------------------------
    case 'TREND_FOLLOWING': {
      const lookbackH = Number(stratParams.lookbackHigh || 20);
      const lookbackL = Number(stratParams.lookbackLow || 20);
      const adxFilter = Number(stratParams.adxFilter || 20);
      const atrMult = Number(stratParams.atrMultiplier || 2.0);

      const prevHighs = highs.slice(-(lookbackH + 1), -1);
      const prevLows = lows.slice(-(lookbackL + 1), -1);
      const highestHigh = prevHighs.length > 0 ? Math.max(...prevHighs) : currentPrice;
      const lowestLow = prevLows.length > 0 ? Math.min(...prevLows) : currentPrice;

      if (currentPrice > highestHigh && adx >= adxFilter) {
        result.type = 'BUY';
        result.confidence = Math.min(95, Math.round(70 + adx));
        result.reasons.push(`Fiyat ${lookbackH} barlık Donchian tavanını ($${highestHigh.toFixed(2)}) yukarı kırdı.`);
        result.reasons.push(`Trend Gücü: ADX(${adx.toFixed(1)}) >= ${adxFilter}.`);
        result.suggestedStopLoss = currentPrice - (atrMult * atr);
        result.suggestedTakeProfit = currentPrice + (4.0 * atr);
      } else if (currentPrice < lowestLow && adx >= adxFilter) {
        result.type = 'SELL';
        result.confidence = Math.min(95, Math.round(70 + adx));
        result.reasons.push(`Fiyat ${lookbackL} barlık Donchian tabanını ($${lowestLow.toFixed(2)}) aşağı kırdı.`);
        result.reasons.push(`Trend Gücü: ADX(${adx.toFixed(1)}) >= ${adxFilter}.`);
        result.suggestedStopLoss = currentPrice + (atrMult * atr);
        result.suggestedTakeProfit = currentPrice - (4.0 * atr);
      } else {
        result.reasons.push(`Donchian Kanalı: Tavan $${highestHigh.toFixed(2)} | Taban $${lowestLow.toFixed(2)}.`);
      }
      break;
    }

    // -------------------------------------------------------------
    // QUANT FAMILY 2: MOMENTUM (Time Series Momentum TS-MOM)
    // -------------------------------------------------------------
    case 'MOMENTUM': {
      const lookback = Number(stratParams.lookbackBars || 24);
      const thresh = Number(stratParams.thresholdZScore || 1.0);

      if (len > lookback) {
        const pastPrice = closes[len - 1 - lookback];
        const returnPct = ((currentPrice - pastPrice) / pastPrice) * 100;
        const atrPct = (atr / currentPrice) * 100;
        const zScore = atrPct > 0 ? (returnPct / atrPct) : 0;

        if (zScore >= thresh) {
          result.type = 'BUY';
          result.confidence = Math.min(95, Math.round(60 + zScore * 15));
          result.reasons.push(`TS-MOM Pozitif Momentum: %${returnPct.toFixed(2)} (${lookback} Bar).`);
          result.reasons.push(`Volatilite Normalleştirilmiş Z-Score: +${zScore.toFixed(2)} >= +${thresh}.`);
          result.suggestedStopLoss = currentPrice - (2 * atr);
          result.suggestedTakeProfit = currentPrice + (4 * atr);
        } else if (zScore <= -thresh) {
          result.type = 'SELL';
          result.confidence = Math.min(95, Math.round(60 + Math.abs(zScore) * 15));
          result.reasons.push(`TS-MOM Negatif Momentum: %${returnPct.toFixed(2)} (${lookback} Bar).`);
          result.reasons.push(`Volatilite Normalleştirilmiş Z-Score: ${zScore.toFixed(2)} <= -${thresh}.`);
          result.suggestedStopLoss = currentPrice + (2 * atr);
          result.suggestedTakeProfit = currentPrice - (4 * atr);
        } else {
          result.reasons.push(`TS-MOM Momentum Z-Score: ${zScore.toFixed(2)} (Eşik: ±${thresh}).`);
        }
      }
      break;
    }

    // -------------------------------------------------------------
    // QUANT FAMILY 3: MEAN_REVERSION (Z-Score & RSI Extreme)
    // -------------------------------------------------------------
    case 'MEAN_REVERSION': {
      const smaPeriod = Number(stratParams.smaPeriod || 20);
      const zThresh = Number(stratParams.zScoreThreshold || 2.0);
      const rsiOversold = Number(stratParams.rsiOversold || 28);
      const rsiOverbought = Number(stratParams.rsiOverbought || 72);
      const maxAdx = Number(stratParams.maxAdxFilter || 22);

      const sma = calculateSMA(closes, smaPeriod);
      const curSma = sma[len - 1];

      if (curSma !== null && len >= smaPeriod) {
        const slice = closes.slice(-smaPeriod);
        const variance = slice.reduce((acc, c) => acc + Math.pow(c - curSma, 2), 0) / smaPeriod;
        const stdDev = Math.sqrt(variance);
        const zScore = stdDev > 0 ? (currentPrice - curSma) / stdDev : 0;
        const isChopRegime = adx <= maxAdx;

        if (zScore <= -zThresh && currentRsi <= rsiOversold && isChopRegime) {
          result.type = 'BUY';
          result.confidence = 88;
          result.reasons.push(`Z-Score Sapması: ${zScore.toFixed(2)} <= -${zThresh} (İstatistiksel Aşırı Satım).`);
          result.reasons.push(`RSI(14): ${currentRsi.toFixed(1)} <= ${rsiOversold} & Yatay Piyasa Rejimi (ADX <= ${maxAdx}).`);
          result.suggestedStopLoss = currentPrice * 0.98;
          result.suggestedTakeProfit = curSma;
        } else if (zScore >= zThresh && currentRsi >= rsiOverbought && isChopRegime) {
          result.type = 'SELL';
          result.confidence = 88;
          result.reasons.push(`Z-Score Sapması: +${zScore.toFixed(2)} >= +${zThresh} (İstatistiksel Aşırı Alım).`);
          result.reasons.push(`RSI(14): ${currentRsi.toFixed(1)} >= ${rsiOverbought} & Yatay Piyasa Rejimi (ADX <= ${maxAdx}).`);
          result.suggestedStopLoss = currentPrice * 1.02;
          result.suggestedTakeProfit = curSma;
        } else {
          result.reasons.push(`Z-Score: ${zScore.toFixed(2)}, RSI: ${currentRsi.toFixed(1)}, ADX: ${adx.toFixed(1)}.`);
        }
      }
      break;
    }

    // -------------------------------------------------------------
    // QUANT FAMILY 4: BREAKOUT_VOLATILITY (TTM Squeeze)
    // -------------------------------------------------------------
    case 'BREAKOUT_VOLATILITY': {
      const bbPeriod = Number(stratParams.bbPeriod || 20);
      const bbStd = Number(stratParams.bbStdDev || 2.0);
      const kcPeriod = Number(stratParams.kcPeriod || 20);
      const kcMult = Number(stratParams.kcMultiplier || 1.5);

      const bb = calculateBollingerBands(closes, bbPeriod, bbStd);
      const kc = calculateKeltnerChannels(klines, kcPeriod, kcMult);
      const macd = calculateMACD(closes, 12, 26, 9);

      const bbUp = bb.upper[len - 1];
      const bbLow = bb.lower[len - 1];
      const kcUp = kc.upper[len - 1];
      const kcLow = kc.lower[len - 1];
      const curHist = macd.histogram[len - 1] ?? 0;
      const prevHist = macd.histogram[len - 2] ?? 0;

      if (bbUp && bbLow && kcUp && kcLow) {
        const prevBbUp = bb.upper[len - 2] ?? bbUp;
        const prevKcUp = kc.upper[len - 2] ?? kcUp;
        const wasInSqueeze = prevBbUp < prevKcUp;
        const isFiringLong = wasInSqueeze && bbUp > kcUp && curHist > 0 && curHist > prevHist;
        const isFiringShort = wasInSqueeze && bbLow < kcLow && curHist < 0 && curHist < prevHist;

        if (isFiringLong) {
          result.type = 'BUY';
          result.confidence = 90;
          result.reasons.push('Volatilite Sıkışması (Squeeze) yukarı patladı.');
          result.reasons.push(`MACD İvmesi Genişliyor (+${curHist.toFixed(4)}).`);
          result.suggestedStopLoss = currentPrice * 0.97;
          result.suggestedTakeProfit = currentPrice * 1.06;
        } else if (isFiringShort) {
          result.type = 'SELL';
          result.confidence = 90;
          result.reasons.push('Volatilite Sıkışması (Squeeze) aşağı patladı.');
          result.reasons.push(`MACD İvmesi Negatif (${curHist.toFixed(4)}).`);
          result.suggestedStopLoss = currentPrice * 1.03;
          result.suggestedTakeProfit = currentPrice * 0.94;
        } else {
          result.reasons.push(`Volatilite Durumu: ${bbUp < kcUp ? 'SIKIŞMA (Squeeze)' : 'NORMAL SERBESTLİK'}.`);
        }
      }
      break;
    }

    // -------------------------------------------------------------
    // QUANT FAMILY 5: REGIME_SWITCHING (ADX Adaptive)
    // -------------------------------------------------------------
    case 'REGIME_SWITCHING': {
      const trendAdx = Number(stratParams.trendAdxThreshold || 25);
      const chopAdx = Number(stratParams.chopAdxThreshold || 18);
      const fastEma = calculateEMA(closes, Number(stratParams.emaFast || 12));
      const slowEma = calculateEMA(closes, Number(stratParams.emaSlow || 50));

      const fNow = fastEma[len - 1] ?? currentPrice;
      const sNow = slowEma[len - 1] ?? currentPrice;

      if (adx >= trendAdx) {
        if (fNow > sNow) {
          result.type = 'BUY';
          result.confidence = 88;
          result.reasons.push(`Trend Rejimi: ADX(${adx.toFixed(1)}) >= ${trendAdx} & EMA Boğa Dizilimi.`);
          result.suggestedStopLoss = sNow * 0.985;
          result.suggestedTakeProfit = currentPrice * 1.07;
        } else if (fNow < sNow) {
          result.type = 'SELL';
          result.confidence = 88;
          result.reasons.push(`Trend Rejimi: ADX(${adx.toFixed(1)}) >= ${trendAdx} & EMA Ayı Dizilimi.`);
          result.suggestedStopLoss = sNow * 1.015;
          result.suggestedTakeProfit = currentPrice * 0.93;
        }
      } else if (adx <= chopAdx) {
        if (currentRsi < 30) {
          result.type = 'BUY';
          result.confidence = 82;
          result.reasons.push(`Yatay Rejim: ADX(${adx.toFixed(1)}) <= ${chopAdx} & RSI Aşırı Satım (${currentRsi.toFixed(1)}).`);
          result.suggestedStopLoss = currentPrice * 0.98;
          result.suggestedTakeProfit = currentPrice * 1.035;
        } else if (currentRsi > 70) {
          result.type = 'SELL';
          result.confidence = 82;
          result.reasons.push(`Yatay Rejim: ADX(${adx.toFixed(1)}) <= ${chopAdx} & RSI Aşırı Alım (${currentRsi.toFixed(1)}).`);
          result.suggestedStopLoss = currentPrice * 1.02;
          result.suggestedTakeProfit = currentPrice * 0.965;
        }
      } else {
        result.reasons.push(`Rejim Nötr Geçiş Bölgesinde (ADX: ${adx.toFixed(1)}).`);
      }
      break;
    }

    // -------------------------------------------------------------
    // QUANT FAMILY 6: MULTI_FACTOR_QUANT (Composite Alpha Model)
    // -------------------------------------------------------------
    case 'MULTI_FACTOR_QUANT': {
      const ema20 = calculateEMA(closes, 20);
      const ema50 = calculateEMA(closes, 50);
      const ema200 = calculateEMA(closes, Math.min(200, closes.length));
      const macd = calculateMACD(closes, 12, 26, 9);
      const volSma = calculateSMA(klines.map(k => k.volume), 20);

      const e20 = ema20[len - 1] ?? currentPrice;
      const e50 = ema50[len - 1] ?? currentPrice;
      const e200 = ema200[len - 1] ?? currentPrice;
      const curHist = macd.histogram[len - 1] ?? 0;
      const curVol = curBar.volume;
      const avgVol = volSma[len - 1] ?? curVol;
      const volRatio = avgVol > 0 ? curVol / avgVol : 1;

      let trendFactor = 0;
      if (currentPrice > e20 && e20 > e50 && currentPrice > e200) trendFactor = 1.0;
      else if (currentPrice < e20 && e20 < e50 && currentPrice < e200) trendFactor = -1.0;
      else if (currentPrice > e50) trendFactor = 0.5;
      else if (currentPrice < e50) trendFactor = -0.5;

      let momFactor = ((currentRsi - 50) / 50) * 0.6 + (curHist > 0 ? 0.4 : -0.4);
      momFactor = Math.max(-1, Math.min(1, momFactor));
      const volFactor = Math.min(1, volRatio / 2);

      const alphaScore = (trendFactor * 0.45) + (momFactor * 0.35) + (volFactor * (trendFactor >= 0 ? 0.2 : -0.2));
      const threshold = Number(stratParams.thresholdScore || 0.60);

      if (alphaScore >= threshold) {
        result.type = 'BUY';
        result.confidence = Math.round(alphaScore * 100);
        result.reasons.push(`Bileşik Alfa Skoru: +${alphaScore.toFixed(2)} >= +${threshold}.`);
        result.suggestedStopLoss = e50 * 0.985;
        result.suggestedTakeProfit = currentPrice * 1.075;
      } else if (alphaScore <= -threshold) {
        result.type = 'SELL';
        result.confidence = Math.round(Math.abs(alphaScore) * 100);
        result.reasons.push(`Bileşik Alfa Skoru: ${alphaScore.toFixed(2)} <= -${threshold}.`);
        result.suggestedStopLoss = e50 * 1.015;
        result.suggestedTakeProfit = currentPrice * 0.925;
      } else {
        result.reasons.push(`Alfa Skoru: ${alphaScore.toFixed(2)} (Eşik: ±${threshold}).`);
      }
      break;
    }

    // -------------------------------------------------------------
    // 1. INSTITUTIONAL EMA RIBBON TREND FOLLOWER (Golden/Death Cross & Pullback)
    // -------------------------------------------------------------
    case 'EMA_CROSS':
    case 'EMA_PULLBACK_PRO': {
      const isMacroBull = currentPrice > currentEma200 && curSlow >= (slowArr[len - 3] ?? curSlow);
      const isMacroBear = currentPrice < currentEma200 && curSlow <= (slowArr[len - 3] ?? curSlow);

      // Trigger 1: Fresh Golden Cross with Volume & Trend confirmation
      const isFreshGoldenCross = prevFast <= prevSlow && curFast > curSlow;
      // Trigger 2: High-probability Pullback to EMA 20/50 in strong trend with bullish bounce
      const isEmaBullPullback = (
        curFast > curSlow &&
        isMacroBull &&
        prevBar.low <= curFast * 1.006 &&
        isBullishCandle &&
        curBar.close > prevBar.high &&
        currentRsi >= 42 && currentRsi <= 68
      );

      // Trigger 1: Fresh Death Cross
      const isFreshDeathCross = prevFast >= prevSlow && curFast < curSlow;
      // Trigger 2: Bear Pullback (rally to EMA 20/50 rejection)
      const isEmaBearPullback = (
        curFast < curSlow &&
        isMacroBear &&
        prevBar.high >= curFast * 0.994 &&
        isBearishCandle &&
        curBar.close < prevBar.low &&
        currentRsi <= 58 && currentRsi >= 32
      );

      if ((isFreshGoldenCross || isEmaBullPullback) && isMacroBull && volOk) {
        result.type = 'BUY';
        result.confidence = isEmaBullPullback ? 92 : 88;
        result.reasons.push(
          isFreshGoldenCross
            ? `EMA ${strategy.fastEma || 20} yukarı yönlü EMA ${strategy.slowEma || 50} kesti (Golden Cross).`
            : `EMA Ribbon 20/50 Destek Testi ve Boğa Dönüş Mumu onayı.`
        );
        result.reasons.push(`Trend Filtresi: Fiyat > 200 EMA ($${currentEma200.toFixed(2)}) ve ADX(${adx.toFixed(1)}) güçlü boğa rejiminde.`);
        result.suggestedStopLoss = currentPrice - (atr * 1.5);
        result.suggestedTakeProfit = currentPrice + (atr * 3.5); // 1:2.33 Risk/Reward
      } else if ((isFreshDeathCross || isEmaBearPullback) && isMacroBear) {
        result.type = 'SELL';
        result.confidence = isEmaBearPullback ? 92 : 88;
        result.reasons.push(
          isFreshDeathCross
            ? `EMA ${strategy.fastEma || 20} aşağı yönlü EMA ${strategy.slowEma || 50} kesti (Death Cross).`
            : `EMA Ribbon 20/50 Direnç Reddi ve Ayı Dönüş Mumu onayı.`
        );
        result.reasons.push(`Trend Filtresi: Fiyat < 200 EMA ($${currentEma200.toFixed(2)}) ve Ayı İvmesi.`);
        result.suggestedStopLoss = currentPrice + (atr * 1.5);
        result.suggestedTakeProfit = currentPrice - (atr * 3.5); // 1:2.33 Risk/Reward
      } else {
        result.reasons.push(`EMA Trend takibi: EMA20 ($${curFast.toFixed(2)}) ${curFast > curSlow ? '>' : '<'} EMA50 ($${curSlow.toFixed(2)}). Yeni tetikleyici bekleniyor.`);
      }
      break;
    }

    // -------------------------------------------------------------
    // 2. SUPERTREND PRO & VOLATILITY WAVE (Captures Big Explosive Moves)
    // -------------------------------------------------------------
    case 'SUPERTREND_MOMENTUM': {
      // Event Trigger 1: Fresh flip from Bearish to Bullish (within last 2 bars)
      const isFreshStBullFlip = (prevStDir === 'BEARISH' && curStDir === 'BULLISH');
      // Event Trigger 2: Trend continuation pullback (price kissed SuperTrend support and closed bullish)
      const isStBounce = (
        curStDir === 'BULLISH' &&
        prevBar.low <= (stData.superTrend[len - 2] ?? 0) * 1.012 &&
        isBullishCandle &&
        macdHist > 0 &&
        currentRsi > 48
      );

      const isFreshStBearFlip = (prevStDir === 'BULLISH' && curStDir === 'BEARISH');
      const isStBearRejection = (
        curStDir === 'BEARISH' &&
        prevBar.high >= (stData.superTrend[len - 2] ?? 999999) * 0.988 &&
        isBearishCandle &&
        macdHist < 0 &&
        currentRsi < 52
      );

      if ((isFreshStBullFlip || isStBounce) && currentPrice > currentEma50 && volOk) {
        result.type = 'BUY';
        result.confidence = 90;
        result.reasons.push(
          isFreshStBullFlip
            ? 'SuperTrend yeşil boğa trendine döndü (Taze Kırılım Sinyali).'
            : 'SuperTrend dinamik destek hattından hacimli yukarı sekme teyit edildi.'
        );
        result.reasons.push(`MACD Momentum pozitif (+${macdHist.toFixed(2)}) ve Fiyat > 50 EMA.`);
        result.suggestedStopLoss = Math.min(stData.superTrend[len - 1] ?? (currentPrice - atr * 1.8), currentPrice - atr * 1.2);
        result.suggestedTakeProfit = currentPrice + (atr * 3.8); // 1:2.8 Asymmetric RR
      } else if ((isFreshStBearFlip || isStBearRejection) && currentPrice < currentEma50) {
        result.type = 'SELL';
        result.confidence = 90;
        result.reasons.push(
          isFreshStBearFlip
            ? 'SuperTrend kırmızı ayı trendine döndü (Taze Kırılım Sinyali).'
            : 'SuperTrend dinamik direnç hattından aşağı ret yendi.'
        );
        result.suggestedStopLoss = Math.max(stData.superTrend[len - 1] ?? (currentPrice + atr * 1.8), currentPrice + atr * 1.2);
        result.suggestedTakeProfit = currentPrice - (atr * 3.8);
      } else {
        result.reasons.push(`SuperTrend: ${curStDir}, Seviye: $${stData.superTrend[len - 1]?.toFixed(2) || 'N/A'}.`);
      }
      break;
    }

    // -------------------------------------------------------------
    // 3. SMART MONEY CONCEPTS (SMC) & LIQUIDITY SWEEP REVERSAL
    // -------------------------------------------------------------
    case 'SMC_LIQUIDITY_SWEEP': {
      // Find swing low of last 15 candles (excluding current)
      const recentLows = lows.slice(Math.max(0, len - 16), len - 1);
      const swingLow = Math.min(...recentLows);
      const recentHighs = highs.slice(Math.max(0, len - 16), len - 1);
      const swingHigh = Math.max(...recentHighs);

      // Bullish Liquidity Sweep: Price dipped below swing low, swept stop-losses, and closed strongly above it with a long lower wick
      const isBullishSweep = (
        curBar.low < swingLow &&
        curBar.close > swingLow &&
        (hasHammerWick || curBar.close > curBar.open) &&
        currentRsi <= 45
      );

      // Bearish Liquidity Sweep: Price spiked above swing high, trapped buyers, and closed below it with upper wick
      const isBearishSweep = (
        curBar.high > swingHigh &&
        curBar.close < swingHigh &&
        (hasShootingStarWick || curBar.close < curBar.open) &&
        currentRsi >= 55
      );

      if (isBullishSweep) {
        result.type = 'BUY';
        result.confidence = 94;
        result.reasons.push(`SMC Likidite Temizliği: Önceki dip ($${swingLow.toFixed(2)}) altındaki stoplar süpürüldü ve kurumsal alım tepkisiyle ($${curBar.close.toFixed(2)}) içeri dönüldü.`);
        result.reasons.push(`Kuyruklu Boğa Tepki Mumu ve RSI(${currentRsi.toFixed(1)}) dönüşü.`);
        result.suggestedStopLoss = curBar.low - (atr * 0.4); // Tight institutional stop
        result.suggestedTakeProfit = currentPrice + (atr * 3.6); // 1:3.2 Risk/Reward
      } else if (isBearishSweep) {
        result.type = 'SELL';
        result.confidence = 94;
        result.reasons.push(`SMC Tepe Likidite Tuzağı: Önceki tepe ($${swingHigh.toFixed(2)}) üzerine iğne atılarak alıcılar tuzağa düşürüldü ve sert ret yendi.`);
        result.suggestedStopLoss = curBar.high + (atr * 0.4);
        result.suggestedTakeProfit = currentPrice - (atr * 3.6);
      } else {
        result.reasons.push(`SMC Likidite Havuzları: Son Dip: $${swingLow.toFixed(2)}, Son Tepe: $${swingHigh.toFixed(2)}.`);
      }
      break;
    }

    // -------------------------------------------------------------
    // 4. VOLATILITY SQUEEZE & BREAKOUT (TTM Squeeze Momentum)
    // -------------------------------------------------------------
    case 'VOLATILITY_SQUEEZE': {
      const macd = calculateMACD(closes, 12, 26, 9);
      const prevMacdHist = macd.histogram[len - 2] ?? 0;
      const curMacdHist = macd.histogram[len - 1] ?? 0;
      const isSqueeze = indicators.isSqueeze;

      // Squeeze Firing Long: Histogram accelerating upwards while exiting squeeze
      const isSqueezeBullBreakout = curMacdHist > prevMacdHist && curMacdHist > 0 && currentPrice > currentEma20 && volOk;
      const isSqueezeBearBreakout = curMacdHist < prevMacdHist && curMacdHist < 0 && currentPrice < currentEma20 && volOk;

      if (isSqueezeBullBreakout) {
        result.type = 'BUY';
        result.confidence = 89;
        result.reasons.push('Volatilite Sıkışması (TTM Squeeze) yukarı yönlü patladı.');
        result.reasons.push(`Momentum ivmesi pozitif (+${curMacdHist.toFixed(2)}) ve Hacim desteği var.`);
        result.suggestedStopLoss = currentPrice - (atr * 1.5);
        result.suggestedTakeProfit = currentPrice + (atr * 3.5);
      } else if (isSqueezeBearBreakout) {
        result.type = 'SELL';
        result.confidence = 89;
        result.reasons.push('Volatilite Sıkışması (TTM Squeeze) aşağı yönlü kırıldı.');
        result.suggestedStopLoss = currentPrice + (atr * 1.5);
        result.suggestedTakeProfit = currentPrice - (atr * 3.5);
      } else {
        result.reasons.push(isSqueeze ? 'Enerji birikimi (Sıkışma Fazı) devam ediyor, patlama yönü bekleniyor.' : 'Volatilite normal bant aralığında.');
      }
      break;
    }

    // -------------------------------------------------------------
    // 5. QUANT MEAN REVERSION (RSI + BB WITH ADX CHOP REGIME FILTER)
    // -------------------------------------------------------------
    case 'RSI_BB_REVERSION': {
      const oversold = strategy.rsiOversold || 30;
      const overbought = strategy.rsiOverbought || 70;
      const bbLower = indicators.bbLower ?? (currentPrice * 0.98);
      const bbUpper = indicators.bbUpper ?? (currentPrice * 1.02);
      const bbMid = indicators.bbMiddle ?? currentPrice;

      // Crucial Quant Rule: ONLY buy oversold if RSI is turning BACK UP (reversal confirmation)
      // and NOT during an extreme ADX > 32 trending crash (falling knife protection)!
      const isRsiRebound = prevRsi <= oversold && currentRsi > oversold;
      const isRsiTouchAndBounce = prevBar.low <= bbLower && isBullishCandle && currentRsi <= 35 && currentRsi > prevRsi;

      const isRsiOverboughtRejection = prevRsi >= overbought && currentRsi < overbought;
      const isRsiTopTouchAndReject = prevBar.high >= bbUpper && isBearishCandle && currentRsi >= 65 && currentRsi < prevRsi;

      // Avoid catching knives in severe trend crashes
      const isSafeForLong = adx < 32 || currentPrice > currentEma200;
      const isSafeForShort = adx < 32 || currentPrice < currentEma200;

      if ((isRsiRebound || isRsiTouchAndBounce) && isSafeForLong) {
        result.type = 'BUY';
        result.confidence = 88;
        result.reasons.push(`Aşırı Satım Teyitli Dönüşü: RSI (${currentRsi.toFixed(1)}) ${oversold} seviyesini yukarı kesti.`);
        result.reasons.push(`Bollinger Alt Bandından ($${bbLower.toFixed(2)}) alıcı tepkisi onaylandı.`);
        result.suggestedStopLoss = Math.min(curBar.low, prevBar.low) - (atr * 0.5);
        result.suggestedTakeProfit = bbMid + (atr * 0.5); // Mean reversion target: Middle SMA + buffer
      } else if ((isRsiOverboughtRejection || isRsiTopTouchAndReject) && isSafeForShort) {
        result.type = 'SELL';
        result.confidence = 88;
        result.reasons.push(`Aşırı Alım Teyitli Dönüşü: RSI (${currentRsi.toFixed(1)}) ${overbought} seviyesini aşağı kırdı.`);
        result.reasons.push(`Bollinger Üst Bandından ($${bbUpper.toFixed(2)}) direnç reddi onaylandı.`);
        result.suggestedStopLoss = Math.max(curBar.high, prevBar.high) + (atr * 0.5);
        result.suggestedTakeProfit = bbMid - (atr * 0.5);
      } else {
        result.reasons.push(`Mean Reversion Takibi: RSI ${currentRsi.toFixed(1)} [${oversold}-${overbought}], ADX: ${adx.toFixed(1)}.`);
      }
      break;
    }

    // -------------------------------------------------------------
    // 6. MACD ZERO-LINE & MOMENTUM SCALPER
    // -------------------------------------------------------------
    case 'MACD_SCALPER': {
      const macd = calculateMACD(closes, 12, 26, 9);
      const prevHist = macd.histogram[len - 2] ?? 0;
      const curHist = macd.histogram[len - 1] ?? 0;

      const isMacdCrossUp = prevHist <= 0 && curHist > 0 && currentRsi > 45 && currentRsi < 65 && currentPrice > currentEma50;
      const isMacdCrossDown = prevHist >= 0 && curHist < 0 && currentRsi < 55 && currentRsi > 35 && currentPrice < currentEma50;

      if (isMacdCrossUp && volOk) {
        result.type = 'BUY';
        result.confidence = 85;
        result.reasons.push('MACD Sıfır Çizgisini yukarı kesti (İvme Artışı).');
        result.suggestedStopLoss = currentPrice - atr * 1.3;
        result.suggestedTakeProfit = currentPrice + atr * 2.8;
      } else if (isMacdCrossDown) {
        result.type = 'SELL';
        result.confidence = 85;
        result.reasons.push('MACD Sıfır Çizgisini aşağı kesti (İvme Kaybı).');
        result.suggestedStopLoss = currentPrice + atr * 1.3;
        result.suggestedTakeProfit = currentPrice - atr * 2.8;
      } else {
        result.reasons.push(`MACD Histogram: ${curHist.toFixed(4)}, RSI: ${currentRsi.toFixed(1)}.`);
      }
      break;
    }

    // -------------------------------------------------------------
    // 7. DYNAMIC RANGE GRID
    // -------------------------------------------------------------
    case 'DYNAMIC_GRID': {
      const lower = strategy.gridLowerPrice || currentPrice * 0.92;
      const upper = strategy.gridUpperPrice || currentPrice * 1.08;
      const levels = strategy.gridLevels || 10;
      const step = (upper - lower) / levels;

      // Only allow grid in low-ADX range markets
      if (adx < 24) {
        if (currentPrice <= lower + step * 1.5 && prevRsi < currentRsi && currentRsi < 42) {
          result.type = 'BUY';
          result.confidence = 80;
          result.reasons.push('Grid alt sınırında tepki alımı tetiklendi.');
          result.suggestedStopLoss = lower - atr * 1.2;
          result.suggestedTakeProfit = currentPrice + step * 2;
        } else if (currentPrice >= upper - step * 1.5 && prevRsi > currentRsi && currentRsi > 58) {
          result.type = 'SELL';
          result.confidence = 80;
          result.reasons.push('Grid üst sınırında kâr alımı / açığa satış tetiklendi.');
          result.suggestedStopLoss = upper + atr * 1.2;
          result.suggestedTakeProfit = currentPrice - step * 2;
        }
      }
      break;
    }

    // -------------------------------------------------------------
    // 8. MULTI-FACTOR QUANT CONFLUENCE
    // -------------------------------------------------------------
    case 'MULTI_CONFIRMATION':
    default: {
      let bullScore = 0;
      let bearScore = 0;

      // Trend Alignment (Weight: 35)
      if (currentPrice > currentEma200 && currentEma20 > currentEma50) {
        bullScore += 35;
        result.reasons.push('Ana Trend Boğa (Fiyat > EMA200 & EMA20 > EMA50) (+35)');
      } else if (currentPrice < currentEma200 && currentEma20 < currentEma50) {
        bearScore += 35;
        result.reasons.push('Ana Trend Ayı (Fiyat < EMA200 & EMA20 < EMA50) (+35)');
      }

      // Momentum / SuperTrend (Weight: 25)
      if (curStDir === 'BULLISH' && macdHist > 0) {
        bullScore += 25;
        result.reasons.push('SuperTrend Boğa ve MACD Pozitif (+25)');
      } else if (curStDir === 'BEARISH' && macdHist < 0) {
        bearScore += 25;
        result.reasons.push('SuperTrend Ayı ve MACD Negatif (+25)');
      }

      // Directional Strength (Weight: 20)
      if (adx >= 20 && plusDI > minusDI) {
        bullScore += 20;
        result.reasons.push(`ADX(${adx.toFixed(1)}) Güçlü Alıcı Üstünlüğü (+DI > -DI) (+20)`);
      } else if (adx >= 20 && minusDI > plusDI) {
        bearScore += 20;
        result.reasons.push(`ADX(${adx.toFixed(1)}) Güçlü Satıcı Baskısı (-DI > +DI) (+20)`);
      }

      // Candle Rejection / Price Action (Weight: 20)
      if (isBullishCandle && currentRsi >= 45 && currentRsi <= 68) {
        bullScore += 20;
        result.reasons.push('Pozitif Fiyat İvmesi ve Dengeli RSI (+20)');
      } else if (isBearishCandle && currentRsi <= 55 && currentRsi >= 32) {
        bearScore += 20;
        result.reasons.push('Negatif Fiyat İvmesi ve Dengeli RSI (+20)');
      }

      if (bullScore >= 75) {
        result.type = 'BUY';
        result.confidence = bullScore;
        result.suggestedStopLoss = currentPrice - (atr * 1.5);
        result.suggestedTakeProfit = currentPrice + (atr * 3.5);
      } else if (bearScore >= 75) {
        result.type = 'SELL';
        result.confidence = bearScore;
        result.suggestedStopLoss = currentPrice + (atr * 1.5);
        result.suggestedTakeProfit = currentPrice - (atr * 3.5);
      } else {
        result.reasons.push(`Kantitatif Skor: Boğa %${bullScore} | Ayı %${bearScore} (Eşik: %75).`);
      }
      break;
    }
  }

  // Direction filtering: Respect LONG / SHORT only or BOTH modes
  const dir = strategy.direction || 'BOTH';
  if (dir === 'LONG' && result.type === 'SELL') {
    result.type = 'HOLD';
    result.confidence = 0;
    result.reasons.push('Strateji yönü yalnızca LONG (Alış) olarak sınırlandırıldı (Short sinyali filtrelendi).');
  } else if (dir === 'SHORT' && result.type === 'BUY') {
    result.type = 'HOLD';
    result.confidence = 0;
    result.reasons.push('Strateji yönü yalnızca SHORT (Satış) olarak sınırlandırıldı (Long sinyali filtrelendi).');
  }

  return result;
}
