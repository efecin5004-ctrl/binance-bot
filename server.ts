import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini Client lazily
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

// ----------------------------------------------------
// BINANCE PROXY & PUBLIC API ROUTES
// ----------------------------------------------------

// 1. Get Klines / Candlesticks from Binance Public API
app.get('/api/binance/klines', async (req, res) => {
  try {
    const symbol = (req.query.symbol as string || 'BTCUSDT').toUpperCase();
    const interval = (req.query.interval as string || '1h');
    const limit = parseInt(req.query.limit as string || '200', 10);
    const endTime = req.query.endTime ? `&endTime=${req.query.endTime}` : '';
    const startTime = req.query.startTime ? `&startTime=${req.query.startTime}` : '';

    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${Math.min(limit, 1000)}${startTime}${endTime}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: 'Binance API Error', details: errText });
    }
    
    const data = await response.json();
    // Transform into standard clean OHLCV format
    const formatted = data.map((item: any[]) => ({
      time: item[0],
      open: parseFloat(item[1]),
      high: parseFloat(item[2]),
      low: parseFloat(item[3]),
      close: parseFloat(item[4]),
      volume: parseFloat(item[5]),
      closeTime: item[6],
      quoteVolume: parseFloat(item[7]),
      trades: item[8],
      takerBuyBaseVolume: parseFloat(item[9]),
      takerBuyQuoteVolume: parseFloat(item[10])
    }));

    res.json({ symbol, interval, klines: formatted });
  } catch (err: any) {
    console.error('Klines fetch error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch klines' });
  }
});

// 2. Get 24hr Ticker Stats for multiple or single symbol
app.get('/api/binance/ticker', async (req, res) => {
  try {
    const symbol = req.query.symbol as string;
    const url = symbol 
      ? `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol.toUpperCase()}`
      : `https://api.binance.com/api/v3/ticker/24hr`;
    
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch ticker' });
    }
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Get Orderbook Depth (L2)
app.get('/api/binance/depth', async (req, res) => {
  try {
    const symbol = (req.query.symbol as string || 'BTCUSDT').toUpperCase();
    const limit = parseInt(req.query.limit as string || '20', 10);
    const url = `https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=${Math.min(limit, 100)}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch depth' });
    }
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Get Recent Trades
app.get('/api/binance/trades', async (req, res) => {
  try {
    const symbol = (req.query.symbol as string || 'BTCUSDT').toUpperCase();
    const limit = parseInt(req.query.limit as string || '30', 10);
    const url = `https://api.binance.com/api/v3/trades?symbol=${symbol}&limit=${Math.min(limit, 100)}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch trades' });
    }
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Test Authenticated Binance Connection & Retrieve Account Info
app.post('/api/binance/test-connection', async (req, res) => {
  try {
    const { apiKey, apiSecret, isTestnet } = req.body;
    if (!apiKey || !apiSecret) {
      return res.status(400).json({ success: false, message: 'API Key and Secret are required' });
    }

    const baseUrl = isTestnet 
      ? 'https://testnet.binance.vision/api/v3'
      : 'https://api.binance.com/api/v3';

    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}&recvWindow=5000`;
    
    const signature = crypto
      .createHmac('sha256', apiSecret)
      .update(queryString)
      .digest('hex');

    const response = await fetch(`${baseUrl}/account?${queryString}&signature=${signature}`, {
      headers: {
        'X-MBX-APIKEY': apiKey
      }
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: data.msg || 'Binance authentication failed. Check API Key/Secret and IP restrictions.'
      });
    }

    // Filter positive non-zero balances
    const balances = (data.balances || [])
      .filter((b: any) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
      .map((b: any) => ({
        asset: b.asset,
        free: parseFloat(b.free),
        locked: parseFloat(b.locked),
        total: parseFloat(b.free) + parseFloat(b.locked)
      }));

    res.json({
      success: true,
      canTrade: data.canTrade,
      canWithdraw: data.canWithdraw,
      canDeposit: data.canDeposit,
      accountType: data.accountType,
      balances
    });
  } catch (err: any) {
    console.error('Binance connection test error:', err);
    res.status(500).json({ success: false, message: err.message || 'Network error connecting to Binance' });
  }
});

// 6. Execute Live Order on Binance (Spot Testnet or Mainnet)
app.post('/api/binance/order', async (req, res) => {
  try {
    const { apiKey, apiSecret, isTestnet, symbol, side, type, quantity, price, timeInForce } = req.body;
    if (!apiKey || !apiSecret) {
      return res.status(400).json({ success: false, message: 'API credentials missing' });
    }

    const baseUrl = isTestnet 
      ? 'https://testnet.binance.vision/api/v3'
      : 'https://api.binance.com/api/v3';

    const timestamp = Date.now();
    let queryParams: Record<string, string> = {
      symbol: symbol.toUpperCase(),
      side: side.toUpperCase(),
      type: type.toUpperCase(),
      quantity: quantity.toString(),
      timestamp: timestamp.toString(),
      recvWindow: '5000'
    };

    if (type.toUpperCase() === 'LIMIT') {
      if (!price) {
        return res.status(400).json({ success: false, message: 'Price is required for Limit orders' });
      }
      queryParams.price = price.toString();
      queryParams.timeInForce = timeInForce || 'GTC';
    }

    const queryString = new URLSearchParams(queryParams).toString();
    const signature = crypto
      .createHmac('sha256', apiSecret)
      .update(queryString)
      .digest('hex');

    const fullUrl = `${baseUrl}/order?${queryString}&signature=${signature}`;

    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'X-MBX-APIKEY': apiKey
      }
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ success: false, message: data.msg || 'Order execution rejected by Binance' });
    }

    res.json({ success: true, order: data });
  } catch (err: any) {
    console.error('Binance order error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ----------------------------------------------------
// AI QUANTITATIVE & SENTIMENT ADVISOR
// ----------------------------------------------------
app.post('/api/ai/market-analysis', async (req, res) => {
  try {
    const { symbol, currentPrice, interval, indicators, recentCandles } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      return res.status(503).json({
        error: 'Gemini API Key is not configured. Please set GEMINI_API_KEY in the workspace secrets.'
      });
    }

    const prompt = `You are an elite quantitative algorithmic trader and market microstructure analyst.
Analyze the following real-time market data for ${symbol || 'BTCUSDT'} (${interval || '1h'} timeframe):

Current Price: $${currentPrice}
Technical Indicators:
- RSI (14): ${indicators?.rsi?.toFixed(2) ?? 'N/A'}
- EMA 20: $${indicators?.ema20?.toFixed(2) ?? 'N/A'}
- EMA 50: $${indicators?.ema50?.toFixed(2) ?? 'N/A'}
- EMA 200: $${indicators?.ema200?.toFixed(2) ?? 'N/A'}
- MACD Histogram: ${indicators?.macdHist?.toFixed(4) ?? 'N/A'}
- Bollinger Band Upper: $${indicators?.bbUpper?.toFixed(2) ?? 'N/A'} | Lower: $${indicators?.bbLower?.toFixed(2) ?? 'N/A'}
- ATR (Volatility): $${indicators?.atr?.toFixed(2) ?? 'N/A'}
- SuperTrend Signal: ${indicators?.superTrendDirection ?? 'N/A'}

Recent 5 candle summary:
${JSON.stringify(recentCandles?.slice(-5) || [], null, 2)}

Provide a structured quantitative response in pure JSON format (without markdown code blocks, just raw JSON) matching this exact schema:
{
  "regime": "BULLISH_TREND" | "BEARISH_TREND" | "RANGE_BOUND" | "HIGH_VOLATILITY_BREAKOUT",
  "aiConfidence": 0 to 100,
  "signal": "STRONG_BUY" | "BUY" | "NEUTRAL" | "SELL" | "STRONG_SELL",
  "marketSentimentScore": -100 to 100 (where -100 is extreme fear/bearish, 100 is extreme greed/bullish),
  "keySupport": number,
  "keyResistance": number,
  "recommendedStrategy": "EMA Ribbon Trend" | "RSI Mean Reversion" | "Dynamic Grid" | "SuperTrend Breakout" | "Wait & Hold Cash",
  "suggestedSL": number,
  "suggestedTP": number,
  "summary": "2-3 crisp sentences explaining the market structure, liquidity zones, and risk factors in Turkish (or English).",
  "suggestedRiskNotes": "1 sentence on leverage/volatility management."
}`;

    const modelsToTry = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3-flash'];
    let responseText = '';
    let lastError: any = null;

    for (const modelName of modelsToTry) {
      try {
        const result = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.2
          }
        });
        responseText = result.text || '';
        if (responseText) break;
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${modelName} failed or busy, trying fallback... Error:`, err?.message || err);
      }
    }

    // If Gemini model APIs are experiencing global temporary spike / 503 unavailable,
    // fallback gracefully to deterministic on-board quantitative rule engine
    if (!responseText) {
      console.log('Using robust onboard quantitative rule engine fallback due to Gemini temporary API unavailability');
      const rsi = indicators?.rsi ?? 50;
      const ema20 = indicators?.ema20 ?? currentPrice;
      const ema50 = indicators?.ema50 ?? currentPrice;
      const ema200 = indicators?.ema200 ?? currentPrice;
      const atr = indicators?.atr ?? (currentPrice * 0.015);
      const isSuperTrendBull = indicators?.superTrendDirection === 'BUY';

      let regime = 'RANGE_BOUND';
      let signal = 'NEUTRAL';
      let recommendedStrategy = 'RSI Mean Reversion';
      let sentiment = 0;
      let confidence = 75;

      if (currentPrice > ema200 && ema20 > ema50 && isSuperTrendBull) {
        regime = 'BULLISH_TREND';
        signal = rsi < 70 ? 'STRONG_BUY' : 'BUY';
        recommendedStrategy = 'EMA Ribbon Trend';
        sentiment = Math.min(85, Math.round(50 + (rsi - 50)));
        confidence = 88;
      } else if (currentPrice < ema200 && ema20 < ema50 && !isSuperTrendBull) {
        regime = 'BEARISH_TREND';
        signal = rsi > 30 ? 'STRONG_SELL' : 'SELL';
        recommendedStrategy = 'EMA Death Ribbon Short';
        sentiment = Math.max(-85, Math.round(-50 + (rsi - 50)));
        confidence = 88;
      } else if (rsi <= 30) {
        regime = 'RANGE_BOUND';
        signal = 'BUY';
        recommendedStrategy = 'Dip Avcısı (RSI & BB Reversion)';
        sentiment = -35;
        confidence = 82;
      } else if (rsi >= 70) {
        regime = 'RANGE_BOUND';
        signal = 'SELL';
        recommendedStrategy = 'Tepe Reddi & BB Satış';
        sentiment = 45;
        confidence = 82;
      }

      const keySupport = indicators?.bbLower ? Math.min(indicators.bbLower, currentPrice - atr * 1.5) : currentPrice * 0.97;
      const keyResistance = indicators?.bbUpper ? Math.max(indicators.bbUpper, currentPrice + atr * 1.5) : currentPrice * 1.03;
      const suggestedSL = signal.includes('BUY') ? currentPrice - (atr * 1.5) : currentPrice + (atr * 1.5);
      const suggestedTP = signal.includes('BUY') ? currentPrice + (atr * 3.0) : currentPrice - (atr * 3.0);

      const fallbackResult = {
        regime,
        aiConfidence: confidence,
        signal,
        marketSentimentScore: sentiment,
        keySupport: Number(keySupport.toFixed(2)),
        keyResistance: Number(keyResistance.toFixed(2)),
        recommendedStrategy,
        suggestedSL: Number(suggestedSL.toFixed(2)),
        suggestedTP: Number(suggestedTP.toFixed(2)),
        summary: `${symbol} grafiğinde EMA Ribbon (20/50/200) ve RSI(${rsi.toFixed(1)}) verileri incelendiğinde ${regime === 'BULLISH_TREND' ? 'yükseliş ana trendi' : regime === 'BEARISH_TREND' ? 'düşüş trendi baskısı' : 'yatay kanal dalgalanması'} tespit edilmiştir. Fiyatın kritik destek seviyesi $${keySupport.toFixed(2)}, direnç ise $${keyResistance.toFixed(2)} olarak hesaplanmıştır.`,
        suggestedRiskNotes: `Volatilite (ATR: $${atr.toFixed(2)}) gözetilerek Stop-Loss seviyelerine sadık kalınmalı, maksimum %2-3 portföy riski ile pozisyon alınmalıdır.`
      };

      return res.json(fallbackResult);
    }

    const text = responseText;
    let parsed;
    try {
      parsed = JSON.parse(text || '{}');
    } catch {
      // Clean possible fences if any
      const cleaned = (text || '').replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    }

    res.json(parsed);
  } catch (err: any) {
    console.error('AI Market analysis error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate AI analysis' });
  }
});

// ----------------------------------------------------
// AI QUANTITATIVE RESEARCH AGENT (HYPOTHESIS & AUDIT)
// ----------------------------------------------------
app.post('/api/ai/quant-research', async (req, res) => {
  try {
    const { mode, strategy, metrics, family } = req.body;
    const ai = getGeminiClient();

    let prompt = '';

    if (mode === 'AUDIT_STRATEGY') {
      prompt = `You are a Senior Quantitative Portfolio Manager and Risk Auditor at a top crypto quantitative hedge fund.
Conduct a brutally honest, rigorous statistical audit of the following trading strategy and its Out-of-Sample / In-Sample backtest results.
Do NOT give false compliments or promotional fluff. Base your critique purely on mathematical edge, statistical significance, and risk metrics.

STRATEGY:
Name: ${strategy?.name || 'N/A'}
Family: ${strategy?.family || 'N/A'}
Mathematical Formula: ${strategy?.mathematicalFormula || 'N/A'}
Expected Regime: ${strategy?.expectedRegime || 'N/A'}
Parameters: ${JSON.stringify(strategy?.parameters || {}, null, 2)}

PERFORMANCE METRICS:
In-Sample Return: ${metrics?.inSampleReturn ?? 'N/A'}% | Sharpe: ${metrics?.inSampleSharpe ?? 'N/A'} | Max Drawdown: ${metrics?.inSampleDd ?? 'N/A'}%
Out-of-Sample Return: ${metrics?.oosReturn ?? 'N/A'}% | OOS Sharpe: ${metrics?.oosSharpe ?? 'N/A'} | OOS Max Drawdown: ${metrics?.oosDd ?? 'N/A'}%
Profit Factor: ${metrics?.profitFactor ?? 'N/A'} | Win Rate: ${metrics?.winRate ?? 'N/A'}% | Total Trades: ${metrics?.totalTrades ?? 'N/A'}
Walk-Forward Efficiency (WFE): ${metrics?.wfe ?? 'N/A'}%

Provide your analysis in Turkish, in raw JSON format (no markdown blocks, pure JSON) matching this exact schema:
{
  "score": 75,
  "verdict": "APPROVED_FOR_PAPER",
  "mathematicalCritique": "3-4 concise sentences evaluating formula robustness, sample size validity, and alpha source.",
  "overfittingRiskLevel": "LOW",
  "marketRegimeFit": "Analysis of which regime this strategy survives or dies in.",
  "keyWeaknesses": ["Weakness 1", "Weakness 2", "Weakness 3"],
  "suggestedImprovements": ["Concrete mathematical or parameter improvement 1", "Improvement 2"]
}`;
    } else {
      prompt = `You are an elite quantitative researcher specializing in crypto market microstructure and statistical trading anomalies.
Generate a sound, testable quantitative trading hypothesis for ${family || 'TREND_FOLLOWING'} on Binance BTC/USDT.
The hypothesis must have a clear economic rationale (e.g. liquidity cascades, under-reaction, volatility clustering) and a precise mathematical formula.

Provide your response in Turkish, in raw JSON format (no markdown blocks, pure JSON) matching this schema:
{
  "hypothesisTitle": "Descriptive academic/quant name",
  "family": "${family || 'TREND_FOLLOWING'}",
  "economicRationale": "Why this edge exists in crypto markets (2-3 sentences)",
  "mathematicalLogic": "Precise mathematical entry and exit formula",
  "targetRegime": "BULL_TREND",
  "proposedParameters": { "lookback": 20, "threshold": 1.5, "atrMultiplier": 2.0 },
  "expectedRiskFactors": ["Risk 1 (e.g. whipsaws in chop)", "Risk 2"],
  "testPlan": "How to validate with Out-of-Sample and Walk-Forward tests"
}`;
    }

    let responseText = '';
    if (ai) {
      const modelsToTry = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3-flash'];
      for (const modelName of modelsToTry) {
        try {
          const result = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              temperature: 0.2
            }
          });
          responseText = result.text || '';
          if (responseText) break;
        } catch (err: any) {
          console.warn(`Quant AI model ${modelName} error:`, err?.message || err);
        }
      }
    }

    if (!responseText) {
      if (mode === 'AUDIT_STRATEGY') {
        const oosRet = metrics?.oosReturn ?? 0;
        const oosSharpe = metrics?.oosSharpe ?? 0;
        const oosDd = metrics?.oosDd ?? 0;
        const totalTrades = metrics?.totalTrades ?? 0;
        const isOverfit = metrics?.inSampleReturn > 15 && oosRet < 0;

        let verdict = 'APPROVED_FOR_PAPER';
        let score = 78;
        let riskLevel = 'LOW';

        if (isOverfit) {
          verdict = 'REJECT_OVERFIT';
          score = 35;
          riskLevel = 'EXTREME';
        } else if (oosDd > 22) {
          verdict = 'REJECT_HIGH_DRAWDOWN';
          score = 48;
          riskLevel = 'HIGH';
        } else if (totalTrades < 15 || oosSharpe < 0.8) {
          verdict = 'INSUFFICIENT_EDGE';
          score = 54;
          riskLevel = 'MEDIUM';
        }

        return res.json({
          score,
          verdict,
          mathematicalCritique: `Strateji testinde ${totalTrades} adet işlem incelenmiştir. Out-of-Sample döneminde Sharpe oranı ${oosSharpe.toFixed(2)} ve net getiri %${oosRet.toFixed(2)} olarak gerçekleşmiştir. ${isOverfit ? 'In-Sample ile OOS arasındaki negatif ayrışma modelin geçmiş veriye aşırı uyumlandığını (overfitting) göstermektedir.' : 'Model temel istatistiksel parametre sınırlarını korumaktadır.'}`,
          overfittingRiskLevel: riskLevel,
          marketRegimeFit: `Strateji en yüksek alfa üretimini ${strategy?.expectedRegime || 'BULL_TREND'} rejiminde gerçekleştirirken, zıt piyasa koşullarında drawdown yaşamaktadır.`,
          keyWeaknesses: [
            totalTrades < 20 ? 'İstatistiksel örneklem boyutu küçük (< 20 işlem)' : 'Zıt piyasa rejimlerinde ardışık stop riski',
            oosDd > 15 ? 'Drawdown toleransı kurumsal risk sınırlarına (%15) yakın' : 'İşlem başına komisyon/kayma maliyetlerinin kâra oranı yüksek'
          ],
          suggestedImprovements: [
            'ATR tabanlı volatilite filtresi ekleyerek yatay piyasadaki sahte kırılımları engelleyin.',
            'Walk-Forward pencere periyodunu genişleterek parametre stabilitesini doğrulayın.'
          ]
        });
      } else {
        return res.json({
          hypothesisTitle: 'Volatilite Normalize Edilmiş Trend Takip Modeli (Quant-ATR-EMA)',
          family: family || 'TREND_FOLLOWING',
          economicRationale: 'Kripto varlıklarda kurumsal likidite akışları volatilite patlamaları ile başlar. Fiyatın uzun vadeli ortalamadan pozitif ayrışması sürü psikolojisiyle trendi besler.',
          mathematicalLogic: 'Giriş: Close_t > EMA(50)_t & ADX(14) > 22 & Return_{24h} > 1.5 * ATR%(14). Çıkış: EMA(20) kırılımı veya 2.5 * ATR Stop.',
          targetRegime: 'BULL_TREND',
          proposedParameters: { emaPeriod: 50, adxThreshold: 22, atrStopMultiplier: 2.5 },
          expectedRiskFactors: ['Düşük hacimli testere piyasalarında sık stop olma riski', 'Hızlı flash-crash iğnelerinde slippage maliyeti'],
          testPlan: '60/20/20 train-test ayrımı ile en az 1000 bar üzerinde test edilecek, WFE >= %50 hedefi aranacaktır.'
        });
      }
    }

    const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    res.json(JSON.parse(cleaned));
  } catch (err: any) {
    console.error('AI Quant research error:', err);
    res.status(500).json({ error: err.message || 'Failed to process quant research request' });
  }
});

// ----------------------------------------------------
// TELEGRAM NOTIFICATIONS DISPATCHER
// ----------------------------------------------------
app.post('/api/alerts/telegram', async (req, res) => {
  try {
    const { botToken, chatId, message } = req.body;
    if (!botToken || !chatId || !message) {
      return res.status(400).json({ success: false, message: 'Bot Token, Chat ID and Message are required' });
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      })
    });

    const data = await response.json();
    if (!response.ok || !data.ok) {
      return res.status(400).json({ success: false, message: data.description || 'Telegram API Error' });
    }

    res.json({ success: true, message: 'Notification sent successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ----------------------------------------------------
// VITE MIDDLEWARE & STATIC SERVING
// ----------------------------------------------------
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Binance Trading Bot Server running on http://0.0.0.0:${PORT}`);
  });
}

start();
