import React, { useState, useMemo } from 'react';
import { Kline, IndicatorValues, Position } from '../types/trading';
import { calculateEMA, calculateBollingerBands, calculateRSI, calculateMACD, calculateSuperTrend } from '../utils/indicators';
import { Layers, Eye, TrendingUp, BarChart2, Zap, Compass } from 'lucide-react';

interface ChartContainerProps {
  symbol: string;
  timeframe: string;
  onSelectTimeframe: (tf: string) => void;
  klines: Kline[];
  indicators: IndicatorValues;
  positions: Position[];
  closedTrades: any[];
}

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'];

export const ChartContainer: React.FC<ChartContainerProps> = ({
  symbol,
  timeframe,
  onSelectTimeframe,
  klines,
  indicators,
  positions,
  closedTrades
}) => {
  const [showEma, setShowEma] = useState(true);
  const [showBb, setShowBb] = useState(false);
  const [showSuperTrend, setShowSuperTrend] = useState(true);
  const [subChart, setSubChart] = useState<'RSI' | 'MACD' | 'VOLUME'>('RSI');
  const [candleCount, setCandleCount] = useState<number>(60);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Take the most recent candles based on count
  const visibleKlines = useMemo(() => {
    return klines.slice(-candleCount);
  }, [klines, candleCount]);

  const closes = useMemo(() => visibleKlines.map(k => k.close), [visibleKlines]);

  // Indicator series calculations for visible candles
  const ema20Series = useMemo(() => calculateEMA(closes, 20), [closes]);
  const ema50Series = useMemo(() => calculateEMA(closes, 50), [closes]);
  const ema200Series = useMemo(() => calculateEMA(closes, Math.min(200, closes.length)), [closes]);
  const bbSeries = useMemo(() => calculateBollingerBands(closes, 20, 2), [closes]);
  const rsiSeries = useMemo(() => calculateRSI(closes, 14), [closes]);
  const macdSeries = useMemo(() => calculateMACD(closes, 12, 26, 9), [closes]);
  const stSeries = useMemo(() => calculateSuperTrend(visibleKlines, 10, 3), [visibleKlines]);

  // Dimensions
  const svgWidth = 840;
  const mainChartHeight = 320;
  const subChartHeight = 110;
  const padding = { top: 20, right: 65, bottom: 25, left: 15 };

  const plotWidth = svgWidth - padding.left - padding.right;
  const plotHeight = mainChartHeight - padding.top - padding.bottom;

  // Min & Max Price Bounds
  const { minPrice, maxPrice } = useMemo(() => {
    if (visibleKlines.length === 0) return { minPrice: 0, maxPrice: 1 };
    let min = Math.min(...visibleKlines.map(k => k.low));
    let max = Math.max(...visibleKlines.map(k => k.high));

    if (showBb) {
      bbSeries.lower.forEach(v => { if (v && v < min) min = v; });
      bbSeries.upper.forEach(v => { if (v && v > max) max = v; });
    }

    const margin = (max - min) * 0.05;
    return { minPrice: min - margin, maxPrice: max + margin };
  }, [visibleKlines, showBb, bbSeries]);

  const priceRange = maxPrice - minPrice || 1;

  const getY = (price: number) => {
    return padding.top + plotHeight - ((price - minPrice) / priceRange) * plotHeight;
  };

  const getX = (index: number) => {
    const step = plotWidth / (visibleKlines.length - 1 || 1);
    return padding.left + index * step;
  };

  const hoveredKline = hoverIndex !== null && visibleKlines[hoverIndex] ? visibleKlines[hoverIndex] : visibleKlines[visibleKlines.length - 1];

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs flex flex-col h-full text-slate-800">
      {/* Chart Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs">
        {/* Left: Timeframe Switcher & Candle count */}
        <div className="flex items-center gap-1.5">
          <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => onSelectTimeframe(tf)}
                className={`px-2 py-1 rounded text-xs font-semibold transition ${
                  timeframe === tf ? 'bg-blue-600 text-white font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200 ml-2">
            {[40, 60, 100].map(c => (
              <button
                key={c}
                onClick={() => setCandleCount(c)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition ${
                  candleCount === c ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {c} Mum
              </button>
            ))}
          </div>
        </div>

        {/* Center/Right: Indicator Overlays & Sub-charts */}
        <div className="flex items-center gap-2">
          {/* Indicator toggles */}
          <button
            onClick={() => setShowEma(!showEma)}
            className={`px-2 py-1 rounded text-[11px] font-semibold border transition ${
              showEma ? 'bg-blue-50 text-blue-700 border-blue-300' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            EMA (20/50/200)
          </button>
          <button
            onClick={() => setShowBb(!showBb)}
            className={`px-2 py-1 rounded text-[11px] font-semibold border transition ${
              showBb ? 'bg-amber-50 text-amber-700 border-amber-300' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Bollinger Bands
          </button>
          <button
            onClick={() => setShowSuperTrend(!showSuperTrend)}
            className={`px-2 py-1 rounded text-[11px] font-semibold border transition ${
              showSuperTrend ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            SuperTrend
          </button>

          {/* Subchart toggle */}
          <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200">
            {(['RSI', 'MACD', 'VOLUME'] as const).map(sc => (
              <button
                key={sc}
                onClick={() => setSubChart(sc)}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition ${
                  subChart === sc ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {sc}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* OHLCV Crosshair Info Bar */}
      {hoveredKline && (
        <div className="flex flex-wrap items-center gap-4 px-4 py-1.5 bg-slate-50/60 border-b border-slate-200 text-[11px] font-mono text-slate-500">
          <span>{new Date(hoveredKline.time).toLocaleString()}</span>
          <span>A: <strong className="text-slate-800">${hoveredKline.open.toFixed(2)}</strong></span>
          <span>Y: <strong className="text-emerald-600">${hoveredKline.high.toFixed(2)}</strong></span>
          <span>D: <strong className="text-rose-600">${hoveredKline.low.toFixed(2)}</strong></span>
          <span>K: <strong className={hoveredKline.close >= hoveredKline.open ? 'text-emerald-600' : 'text-rose-600'}>${hoveredKline.close.toFixed(2)}</strong></span>
          <span>Hacim: <strong className="text-slate-800">{hoveredKline.volume.toFixed(2)}</strong></span>
          {indicators.rsi && <span className="text-purple-600">RSI(14): {indicators.rsi.toFixed(1)}</span>}
          {indicators.atr && <span className="text-amber-600">ATR: ${indicators.atr.toFixed(2)}</span>}
        </div>
      )}

      {/* SVG Responsive Candlestick Chart */}
      <div className="flex-1 relative bg-white p-2 overflow-hidden flex flex-col justify-between select-none">
        <svg
          viewBox={`0 0 ${svgWidth} ${mainChartHeight + subChartHeight}`}
          className="w-full h-full"
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="bullishCandle" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0.95" />
            </linearGradient>
            <linearGradient id="bearishCandle" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#dc2626" stopOpacity="0.95" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0.2, 0.4, 0.6, 0.8].map((ratio) => {
            const y = padding.top + plotHeight * ratio;
            const price = maxPrice - ratio * priceRange;
            return (
              <g key={ratio}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={svgWidth - padding.right}
                  y2={y}
                  stroke="#f1f5f9"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                <text
                  x={svgWidth - padding.right + 6}
                  y={y + 3}
                  fill="#94a3b8"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  ${price.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* Bollinger Bands Fill & Lines */}
          {showBb && (
            <>
              <path
                d={bbSeries.upper.reduce((path, up, i) => {
                  if (up === null || bbSeries.lower[i] === null) return path;
                  const x = getX(i);
                  const y = getY(up);
                  return `${path} ${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                }, '')}
                fill="none"
                stroke="#d97706"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.7"
              />
              <path
                d={bbSeries.lower.reduce((path, low, i) => {
                  if (low === null) return path;
                  const x = getX(i);
                  const y = getY(low);
                  return `${path} ${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                }, '')}
                fill="none"
                stroke="#d97706"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.7"
              />
            </>
          )}

          {/* EMA Overlays */}
          {showEma && (
            <>
              {/* EMA 20 (Blue) */}
              <path
                d={ema20Series.reduce((path, val, i) => {
                  if (val === null) return path;
                  const x = getX(i);
                  const y = getY(val);
                  return path ? `${path} L ${x} ${y}` : `M ${x} ${y}`;
                }, '')}
                fill="none"
                stroke="#2563eb"
                strokeWidth="1.5"
              />
              {/* EMA 50 (Amber) */}
              <path
                d={ema50Series.reduce((path, val, i) => {
                  if (val === null) return path;
                  const x = getX(i);
                  const y = getY(val);
                  return path ? `${path} L ${x} ${y}` : `M ${x} ${y}`;
                }, '')}
                fill="none"
                stroke="#d97706"
                strokeWidth="1.5"
              />
              {/* EMA 200 (Purple) */}
              <path
                d={ema200Series.reduce((path, val, i) => {
                  if (val === null) return path;
                  const x = getX(i);
                  const y = getY(val);
                  return path ? `${path} L ${x} ${y}` : `M ${x} ${y}`;
                }, '')}
                fill="none"
                stroke="#9333ea"
                strokeWidth="1.5"
                strokeDasharray="4 2"
              />
            </>
          )}

          {/* SuperTrend Line */}
          {showSuperTrend && (
            <path
              d={stSeries.superTrend.reduce((path, val, i) => {
                if (val === null) return path;
                const x = getX(i);
                const y = getY(val);
                return path ? `${path} L ${x} ${y}` : `M ${x} ${y}`;
              }, '')}
              fill="none"
              stroke={stSeries.direction[stSeries.direction.length - 1] === 'BULLISH' ? '#10b981' : '#ef4444'}
              strokeWidth="2"
            />
          )}

          {/* Candlesticks Rendering */}
          {visibleKlines.map((k, i) => {
            const x = getX(i);
            const isBullish = k.close >= k.open;
            const candleWidth = Math.max(3, (plotWidth / visibleKlines.length) * 0.7);

            const openY = getY(k.open);
            const closeY = getY(k.close);
            const highY = getY(k.high);
            const lowY = getY(k.low);

            const topY = Math.min(openY, closeY);
            const bodyHeight = Math.max(1.5, Math.abs(closeY - openY));

            return (
              <g
                key={k.time}
                onMouseEnter={() => setHoverIndex(i)}
                className="cursor-crosshair"
              >
                {/* Candle Wick */}
                <line
                  x1={x}
                  y1={highY}
                  x2={x}
                  y2={lowY}
                  stroke={isBullish ? '#10b981' : '#ef4444'}
                  strokeWidth="1.2"
                />
                {/* Candle Body */}
                <rect
                  x={x - candleWidth / 2}
                  y={topY}
                  width={candleWidth}
                  height={bodyHeight}
                  fill={isBullish ? 'url(#bullishCandle)' : 'url(#bearishCandle)'}
                  rx="1"
                />
              </g>
            );
          })}

          {/* Open Position Horizontal Lines (Entry, SL, TP) */}
          {positions.filter(p => p.symbol === symbol).map(p => {
            const entryY = getY(p.entryPrice);
            const slY = p.stopLoss ? getY(p.stopLoss) : null;
            const tpY = p.takeProfit ? getY(p.takeProfit) : null;

            return (
              <g key={p.id}>
                {/* Entry line */}
                <line
                  x1={padding.left}
                  y1={entryY}
                  x2={svgWidth - padding.right}
                  y2={entryY}
                  stroke="#2563eb"
                  strokeWidth="1"
                  strokeDasharray="4 2"
                />
                <rect
                  x={svgWidth - padding.right + 2}
                  y={entryY - 8}
                  width="55"
                  height="16"
                  fill="#2563eb"
                  rx="2"
                />
                <text
                  x={svgWidth - padding.right + 5}
                  y={entryY + 4}
                  fill="#ffffff"
                  fontSize="8"
                  fontFamily="monospace"
                >
                  GİRİŞ: ${p.entryPrice.toFixed(0)}
                </text>

                {/* TP line */}
                {tpY !== null && (
                  <>
                    <line
                      x1={padding.left}
                      y1={tpY}
                      x2={svgWidth - padding.right}
                      y2={tpY}
                      stroke="#10b981"
                      strokeWidth="1"
                      strokeDasharray="2 2"
                    />
                    <rect
                      x={svgWidth - padding.right + 2}
                      y={tpY - 8}
                      width="45"
                      height="16"
                      fill="#059669"
                      rx="2"
                    />
                    <text
                      x={svgWidth - padding.right + 5}
                      y={tpY + 4}
                      fill="#ffffff"
                      fontSize="8"
                      fontFamily="monospace"
                    >
                      TP: ${p.takeProfit?.toFixed(0)}
                    </text>
                  </>
                )}

                {/* SL line */}
                {slY !== null && (
                  <>
                    <line
                      x1={padding.left}
                      y1={slY}
                      x2={svgWidth - padding.right}
                      y2={slY}
                      stroke="#ef4444"
                      strokeWidth="1"
                      strokeDasharray="2 2"
                    />
                    <rect
                      x={svgWidth - padding.right + 2}
                      y={slY - 8}
                      width="45"
                      height="16"
                      fill="#dc2626"
                      rx="2"
                    />
                    <text
                      x={svgWidth - padding.right + 5}
                      y={slY + 4}
                      fill="#ffffff"
                      fontSize="8"
                      fontFamily="monospace"
                    >
                      SL: ${p.stopLoss?.toFixed(0)}
                    </text>
                  </>
                )}
              </g>
            );
          })}

          {/* Vertical Crosshair on Hover */}
          {hoverIndex !== null && (
            <g>
              <line
                x1={getX(hoverIndex)}
                y1={padding.top}
                x2={getX(hoverIndex)}
                y2={mainChartHeight + subChartHeight - 10}
                stroke="#cbd5e1"
                strokeDasharray="2 2"
                strokeWidth="1"
              />
            </g>
          )}

          {/* Current Price Marker */}
          {visibleKlines.length > 0 && (
            <g>
              <line
                x1={padding.left}
                y1={getY(visibleKlines[visibleKlines.length - 1].close)}
                x2={svgWidth - padding.right}
                y2={getY(visibleKlines[visibleKlines.length - 1].close)}
                stroke="#2563eb"
                strokeWidth="1.2"
              />
              <rect
                x={svgWidth - padding.right + 2}
                y={getY(visibleKlines[visibleKlines.length - 1].close) - 9}
                width="60"
                height="18"
                fill="#2563eb"
                rx="3"
              />
              <text
                x={svgWidth - padding.right + 5}
                y={getY(visibleKlines[visibleKlines.length - 1].close) + 4}
                fill="#ffffff"
                fontSize="9"
                fontWeight="bold"
                fontFamily="monospace"
              >
                ${visibleKlines[visibleKlines.length - 1].close.toFixed(2)}
              </text>
            </g>
          )}

          {/* ------------------------------------------- */}
          {/* SUB-CHART (RSI / MACD / VOLUME) */}
          {/* ------------------------------------------- */}
          <g transform={`translate(0, ${mainChartHeight})`}>
            {/* Divider line */}
            <line
              x1={padding.left}
              y1={5}
              x2={svgWidth - padding.right}
              y2={5}
              stroke="#e2e8f0"
              strokeWidth="1"
            />

            {subChart === 'RSI' && (
              <>
                {/* 30 & 70 threshold lines */}
                <line
                  x1={padding.left}
                  y1={30}
                  x2={svgWidth - padding.right}
                  y2={30}
                  stroke="#ef4444"
                  strokeDasharray="2 2"
                  strokeWidth="1"
                  opacity="0.5"
                />
                <text x={svgWidth - padding.right + 6} y={33} fill="#ef4444" fontSize="8" fontFamily="monospace">70</text>

                <line
                  x1={padding.left}
                  y1={75}
                  x2={svgWidth - padding.right}
                  y2={75}
                  stroke="#10b981"
                  strokeDasharray="2 2"
                  strokeWidth="1"
                  opacity="0.5"
                />
                <text x={svgWidth - padding.right + 6} y={78} fill="#10b981" fontSize="8" fontFamily="monospace">30</text>

                {/* RSI curve */}
                <path
                  d={rsiSeries.reduce((path, val, i) => {
                    if (val === null) return path;
                    const x = getX(i);
                    const y = 95 - (val / 100) * 80;
                    return path ? `${path} L ${x} ${y}` : `M ${x} ${y}`;
                  }, '')}
                  fill="none"
                  stroke="#9333ea"
                  strokeWidth="1.8"
                />
                <text x={padding.left + 5} y={20} fill="#9333ea" fontSize="9" fontWeight="bold">RSI (14)</text>
              </>
            )}

            {subChart === 'MACD' && (
              <>
                {/* Zero line */}
                <line
                  x1={padding.left}
                  y1={55}
                  x2={svgWidth - padding.right}
                  y2={55}
                  stroke="#cbd5e1"
                  strokeWidth="1"
                />
                {/* MACD Histogram Bars */}
                {macdSeries.histogram.map((hist, i) => {
                  if (hist === null) return null;
                  const x = getX(i);
                  const barH = Math.min(40, Math.abs(hist) * 0.4);
                  const isPos = hist >= 0;
                  const y = isPos ? 55 - barH : 55;
                  return (
                    <rect
                      key={i}
                      x={x - 2}
                      y={y}
                      width="4"
                      height={Math.max(1, barH)}
                      fill={isPos ? '#10b981' : '#ef4444'}
                      opacity="0.85"
                    />
                  );
                })}
                <text x={padding.left + 5} y={20} fill="#2563eb" fontSize="9" fontWeight="bold">MACD (12, 26, 9)</text>
              </>
            )}

            {subChart === 'VOLUME' && (
              <>
                {visibleKlines.map((k, i) => {
                  const x = getX(i);
                  const maxVol = Math.max(...visibleKlines.map(v => v.volume)) || 1;
                  const h = (k.volume / maxVol) * 75;
                  const isBull = k.close >= k.open;
                  return (
                    <rect
                      key={k.time}
                      x={x - 2}
                      y={95 - h}
                      width="4"
                      height={h}
                      fill={isBull ? '#10b981' : '#ef4444'}
                      opacity="0.65"
                    />
                  );
                })}
                <text x={padding.left + 5} y={20} fill="#64748b" fontSize="9" fontWeight="bold">Hacim (Volume)</text>
              </>
            )}
          </g>
        </svg>
      </div>
    </div>
  );
};
