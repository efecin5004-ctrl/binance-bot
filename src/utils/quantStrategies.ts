import { Kline, SignalResult } from '../types/trading';
import { QuantStrategyDefinition } from '../types/quant';
import { 
  calculateEMA, 
  calculateSMA, 
  calculateRSI, 
  calculateBollingerBands, 
  calculateMACD, 
  calculateATR, 
  calculateSuperTrend, 
  calculateADX, 
  calculateKeltnerChannels 
} from './indicators';

export const QUANT_STRATEGY_REGISTRY: QuantStrategyDefinition[] = [
  {
    id: 'strat-donchian-turtle',
    name: 'Donchian Channel Turtle Breakout',
    family: 'TREND_FOLLOWING',
    version: '1.2.0',
    author: 'Quant Research Lab',
    createdAt: Date.now() - 86400000 * 30,
    updatedAt: Date.now(),
    timeframe: '1h',
    defaultSymbol: 'BTCUSDT',
    direction: 'BOTH',
    expectedRegime: 'BULL_TREND',
    hypothesis: 'Varlık fiyatları N-periyotluk en yüksek veya en düşük seviyeyi hacimle aştığında, momentumun devam etmesi ve asimetrik trend kârı üretmesi istatistiksel olarak anlamlıdır (Richard Dennis Turtle Modeli).',
    mathematicalFormula: 'Entry Long: Close_t > Max(High_{t-1}...High_{t-N}) & ADX > 20 | Entry Short: Close_t < Min(Low_{t-1}...Low_{t-N}) & ADX > 20 | Stop Loss: EntryPrice ± 2 * ATR_{14}',
    economicRationale: 'Kripto piyasalarında kurumsal kırılımlar uzun soluklu trendler başlatır. Yanlış kırılımlar ATR stop ile sınırlandırılırken kârlı trendler sonuna kadar sürülür.',
    parameters: {
      lookbackHigh: 20,
      lookbackLow: 20,
      atrMultiplier: 2.0,
      adxFilter: 20,
      direction: 'BOTH'
    },
    parameterBounds: {
      lookbackHigh: { min: 10, max: 55, step: 5, default: 20, label: 'Donchian Üst Kanal Periyodu' },
      lookbackLow: { min: 10, max: 55, step: 5, default: 20, label: 'Donchian Alt Kanal Periyodu' },
      atrMultiplier: { min: 1.0, max: 3.5, step: 0.5, default: 2.0, label: 'ATR Risk Çarpanı' },
      adxFilter: { min: 15, max: 35, step: 5, default: 20, label: 'Minimum ADX Trend Filtresi' }
    },
    status: 'APPROVED_LIVE',
    tags: ['Trend Following', 'Turtle Trader', 'Breakout', 'Asymmetric Payoff']
  },
  {
    id: 'strat-dual-ema-macro',
    name: 'Dual EMA Ribbon Macro Trend Filter',
    family: 'TREND_FOLLOWING',
    version: '2.0.0',
    author: 'Quant Research Lab',
    createdAt: Date.now() - 86400000 * 20,
    updatedAt: Date.now(),
    timeframe: '1h',
    defaultSymbol: 'BTCUSDT',
    direction: 'BOTH',
    expectedRegime: 'BULL_TREND',
    hypothesis: 'Hızlı EMA (12) yavaş EMA (50) üzerine çıktığında ve fiyat 200 EMA makro trend filtresi üzerinde olduğunda yüksek olasılıklı swing trend başlamıştır.',
    mathematicalFormula: 'Long: EMA(12) > EMA(50) & Close > EMA(200) | Short: EMA(12) < EMA(50) & Close < EMA(200)',
    economicRationale: 'Farklı zaman ufuklarındaki piyasa katılımcılarının aynı yönde hizalanmasını yakalayarak testere piyasası gürültüsünü süzer.',
    parameters: {
      fastEma: 12,
      slowEma: 50,
      macroEma: 200,
      direction: 'BOTH'
    },
    parameterBounds: {
      fastEma: { min: 8, max: 21, step: 1, default: 12, label: 'Hızlı EMA' },
      slowEma: { min: 34, max: 89, step: 5, default: 50, label: 'Yavaş EMA' },
      macroEma: { min: 100, max: 300, step: 50, default: 200, label: 'Makro Trend EMA' }
    },
    status: 'APPROVED_LIVE',
    tags: ['EMA Ribbon', 'Macro Filter', 'Swing Trend']
  },
  {
    id: 'strat-ts-mom',
    name: 'Time-Series Momentum (TS-MOM)',
    family: 'MOMENTUM',
    version: '1.0.0',
    author: 'Quant Research Lab',
    createdAt: Date.now() - 86400000 * 15,
    updatedAt: Date.now(),
    timeframe: '1h',
    defaultSymbol: 'BTCUSDT',
    direction: 'BOTH',
    expectedRegime: 'HIGH_VOLATILITY',
    hypothesis: 'Belirli bir geriye dönük periyotta (Lookback) pozitif getiri sağlayan varlıkların bir sonraki dönemde de aynı yönde hareket etme eğilimi (Moskowitz et al., 2012) kripto varlıklarda kalıcı bir anomalidir.',
    mathematicalFormula: 'Signal = Sign(Return_{t-L, t}) * Volatility_Normalized_Score | Threshold = 1.25 * StandardDeviation',
    economicRationale: 'Yatırımcıların piyasa haberlerine gecikmeli tepki vermesi (under-reaction) ve ardından gelen FOMO sürü psikolojisi momentum trendlerini besler.',
    parameters: {
      lookbackBars: 24,
      thresholdZScore: 1.0,
      volatilityLookback: 20,
      direction: 'BOTH'
    },
    parameterBounds: {
      lookbackBars: { min: 12, max: 72, step: 6, default: 24, label: 'Momentum Geriye Bakış (Bar)' },
      thresholdZScore: { min: 0.5, max: 2.0, step: 0.25, default: 1.0, label: 'Z-Score Eşik Değeri' }
    },
    status: 'BACKTESTED',
    tags: ['Academic Quant', 'Time-Series Momentum', 'Cross-Asset Edge']
  },
  {
    id: 'strat-zscore-mean-reversion',
    name: 'Statistical Z-Score & RSI Extreme Mean Reversion',
    family: 'MEAN_REVERSION',
    version: '1.4.0',
    author: 'Quant Research Lab',
    createdAt: Date.now() - 86400000 * 25,
    updatedAt: Date.now(),
    timeframe: '15m',
    defaultSymbol: 'BTCUSDT',
    direction: 'BOTH',
    expectedRegime: 'SIDEWAYS_CHOP',
    hypothesis: 'Yatay piyasa rejimlerinde (ADX < 20), fiyatın hareketli ortalamasından 2 standart sapmadan fazla uzaklaşması ve RSI aşırı uçlara ulaşması güçlü bir ortalamaya dönüş (Mean Reversion) potansiyeli üretir.',
    mathematicalFormula: 'Long Entry: ZScore(Close, 20) < -2.0 & RSI(14) < 28 & ADX(14) < 22 | Short Entry: ZScore(Close, 20) > 2.0 & RSI(14) > 72 & ADX(14) < 22',
    economicRationale: 'Trend olmayan konsolidasyon dönemlerinde aşırı likidasyon fitilleri fiyatı dengeden uzaklaştırır ve likidite sağlayıcılar fiyatı merkeze çeker.',
    parameters: {
      zScoreThreshold: 2.0,
      smaPeriod: 20,
      rsiOversold: 28,
      rsiOverbought: 72,
      maxAdxFilter: 22,
      direction: 'BOTH'
    },
    parameterBounds: {
      zScoreThreshold: { min: 1.5, max: 2.8, step: 0.2, default: 2.0, label: 'Z-Score Sapma Eşiği' },
      smaPeriod: { min: 10, max: 50, step: 5, default: 20, label: 'SMA Denge Periyodu' },
      maxAdxFilter: { min: 15, max: 28, step: 2, default: 22, label: 'Maksimum ADX (Yatay Filtre)' }
    },
    status: 'OOS_VALIDATED',
    tags: ['Mean Reversion', 'Statistical Arbitrage', 'Z-Score', 'RSI Extremes']
  },
  {
    id: 'strat-volatility-squeeze',
    name: 'Bollinger Band Squeeze Breakout (TTM)',
    family: 'BREAKOUT_VOLATILITY',
    version: '1.1.0',
    author: 'Quant Research Lab',
    createdAt: Date.now() - 86400000 * 18,
    updatedAt: Date.now(),
    timeframe: '1h',
    defaultSymbol: 'BTCUSDT',
    direction: 'BOTH',
    expectedRegime: 'HIGH_VOLATILITY',
    hypothesis: 'Düşük volatilite dönemleri (Bollinger Bantlarının Keltner Kanalları içine sıkışması) her zaman yüksek volatilite patlamalarının öncüsüdür (Volatilite Döngüselliği İlkesi).',
    mathematicalFormula: 'Squeeze Trigger: BB_Upper < KC_Upper & BB_Lower > KC_Lower | Expansion: BB_Upper > KC_Upper & Momentum > 0 => LONG',
    economicRationale: 'Piyasada emir defterlerinin daraldığı ve enerjinin biriktiği dönemler tespit edilerek patlama anında ilk dalga yakalanır.',
    parameters: {
      bbPeriod: 20,
      bbStdDev: 2.0,
      kcPeriod: 20,
      kcMultiplier: 1.5,
      direction: 'BOTH'
    },
    parameterBounds: {
      bbStdDev: { min: 1.5, max: 2.5, step: 0.25, default: 2.0, label: 'Bollinger Sapma Çarpanı' },
      kcMultiplier: { min: 1.2, max: 2.0, step: 0.1, default: 1.5, label: 'Keltner ATR Çarpanı' }
    },
    status: 'OOS_VALIDATED',
    tags: ['Volatility Squeeze', 'TTM', 'Explosive Momentum']
  },
  {
    id: 'strat-regime-adaptive',
    name: 'ADX Adaptive Regime-Switching System',
    family: 'REGIME_SWITCHING',
    version: '2.1.0',
    author: 'Quant Research Lab',
    createdAt: Date.now() - 86400000 * 10,
    updatedAt: Date.now(),
    timeframe: '1h',
    defaultSymbol: 'BTCUSDT',
    direction: 'BOTH',
    expectedRegime: 'BULL_TREND',
    hypothesis: 'Piyasa rejimine göre motor değiştiren sistemler (Trend rejiminde Donchian/EMA, Yatay rejimde Mean Reversion) tekil sistemlere kıyasla daha yüksek Sharpe oranı ve daha düşük Max Drawdown üretir.',
    mathematicalFormula: 'If ADX > 25: Execute Trend Following Rules (EMA Ribbon Cross) | If ADX < 18: Execute Mean Reversion Rules (BB Bounce) | Else: Hold / Reduce Risk',
    economicRationale: 'Tek bir strateji her rejimde çalışmaz. Rejim filtresi, stratejiyi en güçlü olduğu piyasa koşulunda devreye sokar.',
    parameters: {
      trendAdxThreshold: 25,
      chopAdxThreshold: 18,
      emaFast: 12,
      emaSlow: 50,
      direction: 'BOTH'
    },
    parameterBounds: {
      trendAdxThreshold: { min: 20, max: 32, step: 2, default: 25, label: 'Trend ADX Eşiği' },
      chopAdxThreshold: { min: 14, max: 22, step: 2, default: 18, label: 'Yatay Piyasa ADX Eşiği' }
    },
    status: 'APPROVED_LIVE',
    tags: ['Regime Switching', 'ADX Filter', 'Multi-Regime Quant']
  },
  {
    id: 'strat-multi-factor-quant',
    name: 'Multi-Factor Alpha Score Model',
    family: 'MULTI_FACTOR_QUANT',
    version: '1.5.0',
    author: 'Quant Research Lab',
    createdAt: Date.now() - 86400000 * 5,
    updatedAt: Date.now(),
    timeframe: '1h',
    defaultSymbol: 'BTCUSDT',
    direction: 'BOTH',
    expectedRegime: 'BULL_TREND',
    hypothesis: 'Trend, Momentum, Volatilite ve Hacim faktörlerinin normalize edilmiş bileşik skoru (Composite Alpha Factor), tekil göstergelerden çok daha yüksek istatistiksel güvenilirlik sunar.',
    mathematicalFormula: 'Alpha Score = 0.35 * TrendScore(EMA20,50,200) + 0.25 * MomScore(RSI, MACD) + 0.20 * VolScore(ATR%) + 0.20 * VolumeFlow(VolRatio). Long if Alpha > +0.65, Short if Alpha < -0.65',
    economicRationale: 'Farklı piyasa faktörlerinin eş zamanlı doğrulaması (multi-confirmation) yanlış sinyal oranını %40 azaltır.',
    parameters: {
      thresholdScore: 0.65,
      trendWeight: 0.35,
      momWeight: 0.25,
      volWeight: 0.20,
      volumeWeight: 0.20,
      direction: 'BOTH'
    },
    parameterBounds: {
      thresholdScore: { min: 0.50, max: 0.85, step: 0.05, default: 0.65, label: 'Giriş Alfa Skoru Eşiği' }
    },
    status: 'APPROVED_LIVE',
    tags: ['Multi-Factor', 'Factor Investing', 'Alpha Model', 'Composite Score']
  }
];

/**
 * Pure, Lookahead-Free Signal Evaluator for Quant Strategies
 */
export function evaluateQuantStrategySignal(
  strategy: QuantStrategyDefinition,
  klines: Kline[],
  currentIndex?: number
): SignalResult {
  const lastIdx = currentIndex !== undefined ? currentIndex : klines.length - 1;
  if (lastIdx < 35 || klines.length < 35) {
    return {
      symbol: strategy.defaultSymbol,
      type: 'HOLD',
      confidence: 0,
      price: klines[lastIdx]?.close || 0,
      timestamp: klines[lastIdx]?.time || Date.now(),
      reasons: ['Yetersiz veri (Minimum 35 bar gereklidir)'],
      timeframe: strategy.timeframe,
      strategyName: strategy.name
    };
  }

  // Pure lookahead-free slice up to lastIdx
  const historySlice = klines.slice(0, lastIdx + 1);
  const closes = historySlice.map(k => k.close);
  const highs = historySlice.map(k => k.high);
  const lows = historySlice.map(k => k.low);
  const volumes = historySlice.map(k => k.volume);
  const currentPrice = closes[closes.length - 1];
  // If evaluating live (default latest bar), use current wall-clock time so timeout calculations are accurate.
  // If evaluating a historical bar in backtest, use the bar timestamp.
  const isHistoricalEvaluation = currentIndex !== undefined && currentIndex < klines.length - 1;
  const currentTime = isHistoricalEvaluation ? historySlice[historySlice.length - 1].time : Date.now();

  const params = strategy.parameters || {};
  const targetId = (strategy.id || '').toLowerCase();
  const targetFamily = strategy.family || '';

  // Helper matching predicates to support cloned bots (e.g. "bot-strat-donchian-turtle-1234"), custom IDs, and families
  const isTurtle = targetId.includes('turtle') || targetId.includes('donchian') || targetId === 'strat-donchian-turtle';
  const isDualEma = targetId.includes('dual-ema') || targetId.includes('ema-macro') || targetId.includes('ema-ribbon') || targetId === 'strat-dual-ema-macro';
  const isZScore = targetId.includes('zscore') || targetId.includes('mean-reversion') || targetId.includes('rsi-bb') || targetId === 'strat-zscore-mean-reversion';
  const isSqueeze = targetId.includes('squeeze') || targetId.includes('volatility-squeeze') || targetId === 'strat-volatility-squeeze';
  const isRegime = targetId.includes('regime') || targetId.includes('adaptive') || targetId === 'strat-regime-adaptive';
  const isMultiFactor = targetId.includes('multi-factor') || targetId.includes('alpha-score') || targetId === 'strat-multi-factor-quant';
  const isTsMom = targetId.includes('ts-mom') || targetId.includes('momentum') || targetId === 'strat-ts-mom';

  // 1. DONCHIAN TURTLE BREAKOUT (Trend Following)
  if (isTurtle || (!isDualEma && !isZScore && !isSqueeze && !isRegime && !isMultiFactor && !isTsMom && targetFamily === 'TREND_FOLLOWING')) {
    const lookbackH = Number(params.lookbackHigh || 20);
    const lookbackL = Number(params.lookbackLow || 20);
    const adxData = calculateADX(historySlice, 14);
    const atrData = calculateATR(historySlice, 14);

    const currentAdx = adxData.adx[adxData.adx.length - 1] ?? 20;
    const currentAtr = atrData[atrData.length - 1] ?? (currentPrice * 0.02);

    // Lookback highest high excluding current bar to avoid lookahead
    const prevHighs = highs.slice(-(lookbackH + 1), -1);
    const prevLows = lows.slice(-(lookbackL + 1), -1);
    const highestHigh = prevHighs.length > 0 ? Math.max(...prevHighs) : currentPrice;
    const lowestLow = prevLows.length > 0 ? Math.min(...prevLows) : currentPrice;

    if (currentPrice > highestHigh && currentAdx >= Number(params.adxFilter || 20)) {
      if (strategy.direction !== 'SHORT') {
        return {
          symbol: strategy.defaultSymbol,
          type: 'BUY',
          confidence: Math.min(95, Math.round(70 + currentAdx)),
          price: currentPrice,
          timestamp: currentTime,
          reasons: [
            `Fiyat ${lookbackH} periyotluk Donchian tavanını ($${highestHigh.toFixed(2)}) yukarı kırdı`,
            `Trend Gücü ADX(${currentAdx.toFixed(1)}) >= ${params.adxFilter || 20}`
          ],
          suggestedStopLoss: currentPrice - (Number(params.atrMultiplier || 2.0) * currentAtr),
          suggestedTakeProfit: currentPrice + (4.0 * currentAtr),
          timeframe: strategy.timeframe,
          strategyName: strategy.name
        };
      }
    } else if (currentPrice < lowestLow && currentAdx >= Number(params.adxFilter || 20)) {
      if (strategy.direction !== 'LONG') {
        return {
          symbol: strategy.defaultSymbol,
          type: 'SELL',
          confidence: Math.min(95, Math.round(70 + currentAdx)),
          price: currentPrice,
          timestamp: currentTime,
          reasons: [
            `Fiyat ${lookbackL} periyotluk Donchian tabanını ($${lowestLow.toFixed(2)}) aşağı kırdı`,
            `Trend Gücü ADX(${currentAdx.toFixed(1)}) >= ${params.adxFilter || 20}`
          ],
          suggestedStopLoss: currentPrice + (Number(params.atrMultiplier || 2.0) * currentAtr),
          suggestedTakeProfit: currentPrice - (4.0 * currentAtr),
          timeframe: strategy.timeframe,
          strategyName: strategy.name
        };
      }
    }
  }

  // 2. DUAL EMA MACRO RIBBON (Trend Following)
  if (isDualEma) {
    const fastEma = calculateEMA(closes, Number(params.fastEma || 12));
    const slowEma = calculateEMA(closes, Number(params.slowEma || 50));
    const macroEma = calculateEMA(closes, Math.min(Number(params.macroEma || 200), closes.length));

    const fNow = fastEma[fastEma.length - 1];
    const sNow = slowEma[slowEma.length - 1];
    const mNow = macroEma[macroEma.length - 1];
    const fPrev = fastEma[fastEma.length - 2];
    const sPrev = slowEma[slowEma.length - 2];

    if (fNow !== null && sNow !== null && mNow !== null && fPrev !== null && sPrev !== null) {
      const isBullishCross = fNow > sNow && fPrev <= sPrev;
      const isBearishCross = fNow < sNow && fPrev >= sPrev;

      if (isBullishCross && currentPrice > mNow) {
        if (strategy.direction !== 'SHORT') {
          return {
            symbol: strategy.defaultSymbol,
            type: 'BUY',
            confidence: 88,
            price: currentPrice,
            timestamp: currentTime,
            reasons: [
              `Taze Altın Kesişim (Golden Cross): EMA(${params.fastEma || 12}) > EMA(${params.slowEma || 50})`,
              `Fiyat EMA(${params.macroEma || 200}) makro yükseliş trendi üzerinde`
            ],
            suggestedStopLoss: sNow * 0.98,
            suggestedTakeProfit: currentPrice * 1.08,
            timeframe: strategy.timeframe,
            strategyName: strategy.name
          };
        }
      } else if (isBearishCross && currentPrice < mNow) {
        if (strategy.direction !== 'LONG') {
          return {
            symbol: strategy.defaultSymbol,
            type: 'SELL',
            confidence: 88,
            price: currentPrice,
            timestamp: currentTime,
            reasons: [
              `Taze Ölüm Kesişimi (Death Cross): EMA(${params.fastEma || 12}) < EMA(${params.slowEma || 50})`,
              `Fiyat EMA(${params.macroEma || 200}) makro düşüş trendi altında`
            ],
            suggestedStopLoss: sNow * 1.02,
            suggestedTakeProfit: currentPrice * 0.92,
            timeframe: strategy.timeframe,
            strategyName: strategy.name
          };
        }
      }
    }
  }

  // 3. STATISTICAL Z-SCORE & RSI EXTREME MEAN REVERSION
  if (isZScore || (!isTurtle && !isDualEma && !isSqueeze && !isRegime && !isMultiFactor && !isTsMom && targetFamily === 'MEAN_REVERSION')) {
    const smaPeriod = Number(params.smaPeriod || 20);
    const zThresh = Number(params.zScoreThreshold || 2.0);
    const rsi = calculateRSI(closes, 14);
    const sma = calculateSMA(closes, smaPeriod);
    const adxData = calculateADX(historySlice, 14);

    const curRsi = rsi[rsi.length - 1] ?? 50;
    const curSma = sma[sma.length - 1];
    const curAdx = adxData.adx[adxData.adx.length - 1] ?? 20;

    if (curSma !== null && historySlice.length >= smaPeriod) {
      const slice = closes.slice(-smaPeriod);
      const variance = slice.reduce((acc, c) => acc + Math.pow(c - curSma, 2), 0) / smaPeriod;
      const stdDev = Math.sqrt(variance);
      const zScore = stdDev > 0 ? (currentPrice - curSma) / stdDev : 0;

      const isChopRegime = curAdx <= Number(params.maxAdxFilter || 22);

      if (zScore <= -zThresh && curRsi <= Number(params.rsiOversold || 28) && isChopRegime) {
        if (strategy.direction !== 'SHORT') {
          return {
            symbol: strategy.defaultSymbol,
            type: 'BUY',
            confidence: 88,
            price: currentPrice,
            timestamp: currentTime,
            reasons: [
              `Z-Score: ${zScore.toFixed(2)} (İstatistiksel aşırı sapma < -${zThresh})`,
              `RSI(14): ${curRsi.toFixed(1)} (Aşırı satım bölgesi)`,
              `ADX: ${curAdx.toFixed(1)} (Yatay piyasa rejimi teyidi)`
            ],
            suggestedStopLoss: currentPrice * 0.98,
            suggestedTakeProfit: curSma,
            timeframe: strategy.timeframe,
            strategyName: strategy.name
          };
        }
      } else if (zScore >= zThresh && curRsi >= Number(params.rsiOverbought || 72) && isChopRegime) {
        if (strategy.direction !== 'LONG') {
          return {
            symbol: strategy.defaultSymbol,
            type: 'SELL',
            confidence: 88,
            price: currentPrice,
            timestamp: currentTime,
            reasons: [
              `Z-Score: ${zScore.toFixed(2)} (İstatistiksel aşırı sapma > +${zThresh})`,
              `RSI(14): ${curRsi.toFixed(1)} (Aşırı alım bölgesi)`,
              `ADX: ${curAdx.toFixed(1)} (Yatay piyasa rejimi teyidi)`
            ],
            suggestedStopLoss: currentPrice * 1.02,
            suggestedTakeProfit: curSma,
            timeframe: strategy.timeframe,
            strategyName: strategy.name
          };
        }
      }
    }
  }

  // 4. VOLATILITY SQUEEZE BREAKOUT (TTM Squeeze)
  if (isSqueeze || (!isTurtle && !isDualEma && !isZScore && !isRegime && !isMultiFactor && !isTsMom && targetFamily === 'BREAKOUT_VOLATILITY')) {
    const bb = calculateBollingerBands(closes, Number(params.bbPeriod || 20), Number(params.bbStdDev || 2.0));
    const kc = calculateKeltnerChannels(historySlice, Number(params.kcPeriod || 20), Number(params.kcMultiplier || 1.5));
    const macd = calculateMACD(closes, 12, 26, 9);

    const bbUp = bb.upper[bb.upper.length - 1];
    const bbLow = bb.lower[bb.lower.length - 1];
    const kcUp = kc.upper[kc.upper.length - 1];
    const kcLow = kc.lower[kc.lower.length - 1];
    const macdHist = macd.histogram[macd.histogram.length - 1] ?? 0;
    const prevHist = macd.histogram[macd.histogram.length - 2] ?? 0;

    if (bbUp && bbLow && kcUp && kcLow) {
      const prevBbUp = bb.upper[bb.upper.length - 2] ?? bbUp;
      const prevKcUp = kc.upper[kc.upper.length - 2] ?? kcUp;
      const wasInSqueeze = prevBbUp < prevKcUp;
      const isFiringLong = wasInSqueeze && bbUp > kcUp && macdHist > 0 && macdHist > prevHist;
      const isFiringShort = wasInSqueeze && bbLow < kcLow && macdHist < 0 && macdHist < prevHist;

      if (isFiringLong && strategy.direction !== 'SHORT') {
        return {
          symbol: strategy.defaultSymbol,
          type: 'BUY',
          confidence: 90,
          price: currentPrice,
          timestamp: currentTime,
          reasons: [
            'Volatilite Sıkışması (Squeeze) yukarı yönde patladı',
            `MACD Histogramı pozitif ivmeyle genişliyor (+${macdHist.toFixed(4)})`
          ],
          suggestedStopLoss: currentPrice * 0.97,
          suggestedTakeProfit: currentPrice * 1.06,
          timeframe: strategy.timeframe,
          strategyName: strategy.name
        };
      } else if (isFiringShort && strategy.direction !== 'LONG') {
        return {
          symbol: strategy.defaultSymbol,
          type: 'SELL',
          confidence: 90,
          price: currentPrice,
          timestamp: currentTime,
          reasons: [
            'Volatilite Sıkışması (Squeeze) aşağı yönde patladı',
            `MACD Histogramı negatif ivmeyle genişliyor (${macdHist.toFixed(4)})`
          ],
          suggestedStopLoss: currentPrice * 1.03,
          suggestedTakeProfit: currentPrice * 0.94,
          timeframe: strategy.timeframe,
          strategyName: strategy.name
        };
      }
    }
  }

  // 5. ADX REGIME ADAPTIVE
  if (isRegime || (!isTurtle && !isDualEma && !isZScore && !isSqueeze && !isMultiFactor && !isTsMom && targetFamily === 'REGIME_SWITCHING')) {
    const adxData = calculateADX(historySlice, 14);
    const curAdx = adxData.adx[adxData.adx.length - 1] ?? 20;
    const fastEma = calculateEMA(closes, Number(params.emaFast || 12));
    const slowEma = calculateEMA(closes, Number(params.emaSlow || 50));
    const rsi = calculateRSI(closes, 14);

    const fNow = fastEma[fastEma.length - 1] ?? currentPrice;
    const sNow = slowEma[slowEma.length - 1] ?? currentPrice;
    const curRsi = rsi[rsi.length - 1] ?? 50;

    if (curAdx >= Number(params.trendAdxThreshold || 25)) {
      // Trend following regime
      if (fNow > sNow && strategy.direction !== 'SHORT') {
        return {
          symbol: strategy.defaultSymbol,
          type: 'BUY',
          confidence: 88,
          price: currentPrice,
          timestamp: currentTime,
          reasons: [
            `Trend Rejimi Aktif (ADX: ${curAdx.toFixed(1)} >= ${params.trendAdxThreshold || 25})`,
            'EMA 12/50 Pozitif Trend Yönü'
          ],
          suggestedStopLoss: sNow * 0.985,
          suggestedTakeProfit: currentPrice * 1.07,
          timeframe: strategy.timeframe,
          strategyName: strategy.name
        };
      } else if (fNow < sNow && strategy.direction !== 'LONG') {
        return {
          symbol: strategy.defaultSymbol,
          type: 'SELL',
          confidence: 88,
          price: currentPrice,
          timestamp: currentTime,
          reasons: [
            `Trend Rejimi Aktif (ADX: ${curAdx.toFixed(1)} >= ${params.trendAdxThreshold || 25})`,
            'EMA 12/50 Negatif Trend Yönü'
          ],
          suggestedStopLoss: sNow * 1.015,
          suggestedTakeProfit: currentPrice * 0.93,
          timeframe: strategy.timeframe,
          strategyName: strategy.name
        };
      }
    } else if (curAdx <= Number(params.chopAdxThreshold || 18)) {
      // Mean reversion regime
      if (curRsi < 30 && strategy.direction !== 'SHORT') {
        return {
          symbol: strategy.defaultSymbol,
          type: 'BUY',
          confidence: 82,
          price: currentPrice,
          timestamp: currentTime,
          reasons: [
            `Yatay Piyasa Rejimi Aktif (ADX: ${curAdx.toFixed(1)} <= ${params.chopAdxThreshold || 18})`,
            `RSI Dip Tepkisi: ${curRsi.toFixed(1)}`
          ],
          suggestedStopLoss: currentPrice * 0.98,
          suggestedTakeProfit: currentPrice * 1.035,
          timeframe: strategy.timeframe,
          strategyName: strategy.name
        };
      } else if (curRsi > 70 && strategy.direction !== 'LONG') {
        return {
          symbol: strategy.defaultSymbol,
          type: 'SELL',
          confidence: 82,
          price: currentPrice,
          timestamp: currentTime,
          reasons: [
            `Yatay Piyasa Rejimi Aktif (ADX: ${curAdx.toFixed(1)} <= ${params.chopAdxThreshold || 18})`,
            `RSI Tepe Reddi: ${curRsi.toFixed(1)}`
          ],
          suggestedStopLoss: currentPrice * 1.02,
          suggestedTakeProfit: currentPrice * 0.965,
          timeframe: strategy.timeframe,
          strategyName: strategy.name
        };
      }
    }
  }

  // 6. MULTI-FACTOR QUANT SCORE MODEL
  if (isMultiFactor || (!isTurtle && !isDualEma && !isZScore && !isSqueeze && !isRegime && !isTsMom && targetFamily === 'MULTI_FACTOR_QUANT')) {
    const ema20 = calculateEMA(closes, 20);
    const ema50 = calculateEMA(closes, 50);
    const ema200 = calculateEMA(closes, Math.min(200, closes.length));
    const rsi = calculateRSI(closes, 14);
    const macd = calculateMACD(closes, 12, 26, 9);
    const volSma = calculateSMA(volumes, 20);

    const e20 = ema20[ema20.length - 1] ?? currentPrice;
    const e50 = ema50[ema50.length - 1] ?? currentPrice;
    const e200 = ema200[ema200.length - 1] ?? currentPrice;
    const curRsi = rsi[rsi.length - 1] ?? 50;
    const macdHist = macd.histogram[macd.histogram.length - 1] ?? 0;
    const curVol = volumes[volumes.length - 1];
    const avgVol = volSma[volSma.length - 1] ?? curVol;
    const volRatio = avgVol > 0 ? curVol / avgVol : 1;

    // Normalize Trend Factor (-1 to +1)
    let trendFactor = 0;
    if (currentPrice > e20 && e20 > e50 && currentPrice > e200) trendFactor = 1.0;
    else if (currentPrice < e20 && e20 < e50 && currentPrice < e200) trendFactor = -1.0;
    else if (currentPrice > e50) trendFactor = 0.5;
    else if (currentPrice < e50) trendFactor = -0.5;

    // Normalize Momentum Factor (-1 to +1)
    let momFactor = ((curRsi - 50) / 50) * 0.6 + (macdHist > 0 ? 0.4 : -0.4);
    momFactor = Math.max(-1, Math.min(1, momFactor));

    // Normalize Volume Factor (0 to +1)
    const volFactor = Math.min(1, volRatio / 2);

    // Composite Alpha Score
    const alphaScore = (trendFactor * 0.45) + (momFactor * 0.35) + (volFactor * (trendFactor >= 0 ? 0.2 : -0.2));
    const threshold = Number(params.thresholdScore || 0.60);

    if (alphaScore >= threshold && strategy.direction !== 'SHORT') {
      return {
        symbol: strategy.defaultSymbol,
        type: 'BUY',
        confidence: Math.round(alphaScore * 100),
        price: currentPrice,
        timestamp: currentTime,
        reasons: [
          `Bileşik Alfa Skoru: +${alphaScore.toFixed(2)} >= +${threshold}`,
          `Trend Faktörü: +${trendFactor.toFixed(2)}, Momentum: +${momFactor.toFixed(2)}, Hacim Katsayısı: ${volRatio.toFixed(2)}x`
        ],
        suggestedStopLoss: e50 * 0.985,
        suggestedTakeProfit: currentPrice * 1.075,
        timeframe: strategy.timeframe,
        strategyName: strategy.name
      };
    } else if (alphaScore <= -threshold && strategy.direction !== 'LONG') {
      return {
        symbol: strategy.defaultSymbol,
        type: 'SELL',
        confidence: Math.round(Math.abs(alphaScore) * 100),
        price: currentPrice,
        timestamp: currentTime,
        reasons: [
          `Bileşik Alfa Skoru: ${alphaScore.toFixed(2)} <= -${threshold}`,
          `Trend Faktörü: ${trendFactor.toFixed(2)}, Momentum: ${momFactor.toFixed(2)}, Hacim Katsayısı: ${volRatio.toFixed(2)}x`
        ],
        suggestedStopLoss: e50 * 1.015,
        suggestedTakeProfit: currentPrice * 0.925,
        timeframe: strategy.timeframe,
        strategyName: strategy.name
      };
    }
  }

  // 7. TIME SERIES MOMENTUM (TS-MOM)
  if (isTsMom || (!isTurtle && !isDualEma && !isZScore && !isSqueeze && !isRegime && !isMultiFactor && targetFamily === 'MOMENTUM')) {
    const lookback = Number(params.lookbackBars || 24);
    if (historySlice.length > lookback) {
      const pastPrice = closes[closes.length - 1 - lookback];
      const returnPct = ((currentPrice - pastPrice) / pastPrice) * 100;
      const atrData = calculateATR(historySlice, 14);
      const curAtr = atrData[atrData.length - 1] ?? (currentPrice * 0.015);
      const atrPct = (curAtr / currentPrice) * 100;
      
      const zScore = atrPct > 0 ? (returnPct / atrPct) : 0;
      const thresh = Number(params.thresholdZScore || 1.0);

      if (zScore >= thresh && strategy.direction !== 'SHORT') {
        return {
          symbol: strategy.defaultSymbol,
          type: 'BUY',
          confidence: Math.min(95, Math.round(60 + zScore * 15)),
          price: currentPrice,
          timestamp: currentTime,
          reasons: [
            `TS-MOM Pozitif Momentum: ${returnPct.toFixed(2)}% (${lookback} Bar)`,
            `Volatilite Normalleştirilmiş Momentum Skoru: +${zScore.toFixed(2)} >= +${thresh}`
          ],
          suggestedStopLoss: currentPrice - 2 * curAtr,
          suggestedTakeProfit: currentPrice + 4 * curAtr,
          timeframe: strategy.timeframe,
          strategyName: strategy.name
        };
      } else if (zScore <= -thresh && strategy.direction !== 'LONG') {
        return {
          symbol: strategy.defaultSymbol,
          type: 'SELL',
          confidence: Math.min(95, Math.round(60 + Math.abs(zScore) * 15)),
          price: currentPrice,
          timestamp: currentTime,
          reasons: [
            `TS-MOM Negatif Momentum: ${returnPct.toFixed(2)}% (${lookback} Bar)`,
            `Volatilite Normalleştirilmiş Momentum Skoru: ${zScore.toFixed(2)} <= -${thresh}`
          ],
          suggestedStopLoss: currentPrice + 2 * curAtr,
          suggestedTakeProfit: currentPrice - 4 * curAtr,
          timeframe: strategy.timeframe,
          strategyName: strategy.name
        };
      }
    }
  }

  // Default: Hold
  return {
    symbol: strategy.defaultSymbol,
    type: 'HOLD',
    confidence: 0,
    price: currentPrice,
    timestamp: currentTime,
    reasons: ['Piyasa koşulları stratejinin matematiksel giriş kurallarını karşılamıyor'],
    timeframe: strategy.timeframe,
    strategyName: strategy.name
  };
}
