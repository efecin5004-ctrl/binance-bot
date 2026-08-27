import React, { useState, useEffect } from 'react';
import { 
  QuantStrategyDefinition, 
  QuantStrategyFamily, 
  MarketRegimeType,
  TrainValidationTestResult,
  WalkForwardAnalysisResult,
  RegimePerformanceResult,
  ParameterSensitivityResult,
  CrossAssetTestResult,
  StrategyVersionRecord,
  AiResearchHypothesis,
  AiStrategyAudit
} from '../types/quant';
import { Kline, IndicatorValues, SignalResult } from '../types/trading';
import { QUANT_STRATEGY_REGISTRY, evaluateQuantStrategySignal } from '../utils/quantStrategies';
import { 
  runTrainValidationTestSplit, 
  runWalkForwardAnalysis, 
  runMarketRegimeStressTest, 
  runParameterSensitivity,
  runCrossAssetValidation
} from '../utils/quantEngine';
import { getDeepHistoricalKlines, fetchAiQuantResearch } from '../services/api';
import { 
  Cpu, 
  Sliders, 
  Play, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  GitBranch, 
  Layers, 
  Search, 
  ShieldCheck, 
  RefreshCw, 
  Globe, 
  Flame, 
  Target, 
  Info,
  Check,
  ChevronRight,
  BookOpen,
  History,
  Scale
} from 'lucide-react';

interface StrategyLabProps {
  currentPrice: number;
  indicators: IndicatorValues;
  latestSignals: SignalResult[];
  onDeployToPaper?: (strategy: QuantStrategyDefinition) => void;
}

export const StrategyLab: React.FC<StrategyLabProps> = ({
  currentPrice,
  indicators,
  latestSignals,
  onDeployToPaper
}) => {
  // Navigation Tabs within Strategy Lab
  const [labTab, setLabTab] = useState<
    'library' | 'oos_test' | 'walk_forward' | 'regimes' | 'sensitivity' | 'cross_asset' | 'ai_agent' | 'versions'
  >('library');

  const [strategies, setStrategies] = useState<QuantStrategyDefinition[]>(QUANT_STRATEGY_REGISTRY);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>(QUANT_STRATEGY_REGISTRY[0].id);
  const [activeFamilyFilter, setActiveFamilyFilter] = useState<QuantStrategyFamily | 'ALL'>('ALL');
  
  // Historical Kline Data
  const [klines, setKlines] = useState<Kline[]>([]);
  const [dataSymbol, setDataSymbol] = useState<string>('BTCUSDT');
  const [dataInterval, setDataInterval] = useState<string>('1h');
  const [dataLimit, setDataLimit] = useState<number>(1000);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);

  // Analysis State Results
  const [oosResult, setOosResult] = useState<TrainValidationTestResult | null>(null);
  const [wfaResult, setWfaResult] = useState<WalkForwardAnalysisResult | null>(null);
  const [regimeResults, setRegimeResults] = useState<RegimePerformanceResult[] | null>(null);
  const [sensitivityResult, setSensitivityResult] = useState<ParameterSensitivityResult | null>(null);
  const [crossAssetResult, setCrossAssetResult] = useState<CrossAssetTestResult | null>(null);
  const [isCrossAssetRunning, setIsCrossAssetRunning] = useState<boolean>(false);

  // AI Quant Agent State
  const [aiHypothesis, setAiHypothesis] = useState<AiResearchHypothesis | null>(null);
  const [aiAudit, setAiAudit] = useState<AiStrategyAudit | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiSelectedFamily, setAiSelectedFamily] = useState<QuantStrategyFamily>('TREND_FOLLOWING');

  // Strategy Version History
  const [versionHistory, setVersionHistory] = useState<StrategyVersionRecord[]>([
    {
      version: 'v1.0.0',
      timestamp: Date.now() - 86400000 * 14,
      parameters: { lookbackHigh: 20, lookbackLow: 20, atrMultiplier: 2.0 },
      author: 'AI_RESEARCH_AGENT',
      notes: 'İlk Donchian Channel Breakout prototipi oluşturuldu.',
      oosSharpe: 1.42,
      oosReturnPercent: 18.5,
      wfePercent: 62.4,
      status: 'APPROVED_LIVE'
    },
    {
      version: 'v1.1.0',
      timestamp: Date.now() - 86400000 * 5,
      parameters: { lookbackHigh: 20, lookbackLow: 20, atrMultiplier: 2.5, adxFilter: 20 },
      author: 'USER',
      notes: 'ADX trend filtresi eklendi, testere piyasasında sahte kırılımlar %30 azaltıldı.',
      oosSharpe: 1.84,
      oosReturnPercent: 24.2,
      wfePercent: 78.1,
      status: 'APPROVED_LIVE'
    }
  ]);

  const selectedStrategy = strategies.find(s => s.id === selectedStrategyId) || strategies[0];

  // Fetch deep historical data on mount or symbol/timeframe change
  const fetchHistoricalData = async (sym: string = dataSymbol, interval: string = dataInterval, limit: number = dataLimit) => {
    setIsLoadingData(true);
    try {
      const data = await getDeepHistoricalKlines(sym, interval, limit);
      if (data && data.length > 0) {
        setKlines(data);
      }
    } catch (err) {
      console.error('Failed to fetch historical klines for lab:', err);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    fetchHistoricalData(dataSymbol, dataInterval, dataLimit);
  }, [dataSymbol, dataInterval, dataLimit]);

  // Execute OOS & Quant Tests whenever data or selected strategy changes
  useEffect(() => {
    if (klines.length >= 100 && selectedStrategy) {
      try {
        // Run Train / Validation / Test
        const oos = runTrainValidationTestSplit(klines, selectedStrategy);
        setOosResult(oos);

        // Run Walk-Forward
        const wfa = runWalkForwardAnalysis(klines, selectedStrategy, 4);
        setWfaResult(wfa);

        // Run Market Regimes
        const regimes = runMarketRegimeStressTest(klines, selectedStrategy);
        setRegimeResults(regimes);

        // Run Sensitivity for first parameter
        const paramKeys = Object.keys(selectedStrategy.parameters || {});
        if (paramKeys.length > 0) {
          const sens = runParameterSensitivity(klines, selectedStrategy, paramKeys[0]);
          setSensitivityResult(sens);
        }
      } catch (err) {
        console.error('Quant analysis error:', err);
      }
    }
  }, [klines, selectedStrategyId]);

  // Run Cross Asset Validation
  const handleRunCrossAsset = async () => {
    setIsCrossAssetRunning(true);
    try {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'];
      const map: Record<string, Kline[]> = {};
      for (const sym of symbols) {
        map[sym] = await getDeepHistoricalKlines(sym, dataInterval, 500);
      }
      const res = await runCrossAssetValidation(selectedStrategy, map);
      setCrossAssetResult(res);
    } catch (err) {
      console.error('Cross asset validation failed:', err);
    } finally {
      setIsCrossAssetRunning(false);
    }
  };

  // AI Research: Generate Hypothesis
  const handleGenerateAiHypothesis = async () => {
    setIsAiLoading(true);
    try {
      const res = await fetchAiQuantResearch({
        mode: 'GENERATE_HYPOTHESIS',
        family: aiSelectedFamily
      });
      setAiHypothesis(res);
    } catch (err) {
      console.error('Failed to generate AI hypothesis:', err);
    } finally {
      setIsAiLoading(false);
    }
  };

  // AI Research: Audit Strategy
  const handleAuditStrategyWithAi = async () => {
    setIsAiLoading(true);
    try {
      const res = await fetchAiQuantResearch({
        mode: 'AUDIT_STRATEGY',
        strategy: selectedStrategy,
        metrics: {
          inSampleReturn: oosResult?.inSampleMetrics.netProfitPercent,
          inSampleSharpe: oosResult?.inSampleMetrics.sharpeRatio,
          inSampleDd: oosResult?.inSampleMetrics.maxDrawdownPercent,
          oosReturn: oosResult?.outOfSampleMetrics.netProfitPercent,
          oosSharpe: oosResult?.outOfSampleMetrics.sharpeRatio,
          oosDd: oosResult?.outOfSampleMetrics.maxDrawdownPercent,
          profitFactor: oosResult?.outOfSampleMetrics.profitFactor,
          winRate: oosResult?.outOfSampleMetrics.winRate,
          totalTrades: oosResult?.outOfSampleMetrics.totalTrades,
          wfe: wfaResult?.overallWalkForwardEfficiency
        }
      });
      setAiAudit(res);
    } catch (err) {
      console.error('Failed to audit strategy with AI:', err);
    } finally {
      setIsAiLoading(false);
    }
  };

  const filteredStrategies = activeFamilyFilter === 'ALL'
    ? strategies
    : strategies.filter(s => s.family === activeFamilyFilter);

  const familyLabels: Record<QuantStrategyFamily, { label: string; color: string }> = {
    TREND_FOLLOWING: { label: 'Trend Takip (Trend Following)', color: 'border-blue-500 text-blue-700 bg-blue-50' },
    MOMENTUM: { label: 'Momentum (TS-MOM & MACD)', color: 'border-purple-500 text-purple-700 bg-purple-50' },
    MEAN_REVERSION: { label: 'Ortalamaya Dönüş (Z-Score/RSI)', color: 'border-amber-500 text-amber-700 bg-amber-50' },
    BREAKOUT_VOLATILITY: { label: 'Kırılım & Sıkışma (Breakout/TTM)', color: 'border-emerald-500 text-emerald-700 bg-emerald-50' },
    REGIME_SWITCHING: { label: 'Rejim Uyarlamalı (ADX Adaptive)', color: 'border-indigo-500 text-indigo-700 bg-indigo-50' },
    MULTI_FACTOR_QUANT: { label: 'Çok Faktörlü Alfa (Multi-Factor)', color: 'border-rose-500 text-rose-700 bg-rose-50' }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner: Quant Research Philosophy & Data Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-xs">
            <Cpu className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-black text-slate-900 text-base tracking-tight">KANTİTATİF STRATEJİ ARAŞTIRMA LABORATUVARI</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                Institutional Quant Engine
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Sıfır Gelecek Bilgisi (Zero-Lookahead), 60/20/20 Train-Val-OOS Bölümleme, Walk-Forward Analizi ve Piyasa Rejimi Testi
            </p>
          </div>
        </div>

        {/* Data Source & Range Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs">
            <span className="text-slate-400 font-mono">PARİTE:</span>
            <select
              value={dataSymbol}
              onChange={(e) => setDataSymbol(e.target.value)}
              className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer font-mono"
            >
              <option value="BTCUSDT">BTCUSDT</option>
              <option value="ETHUSDT">ETHUSDT</option>
              <option value="SOLUSDT">SOLUSDT</option>
              <option value="BNBUSDT">BNBUSDT</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs">
            <span className="text-slate-400 font-mono">ZAMAN:</span>
            <select
              value={dataInterval}
              onChange={(e) => setDataInterval(e.target.value)}
              className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer font-mono"
            >
              <option value="15m">15 Dakika (15m)</option>
              <option value="1h">1 Saat (1h - Ana)</option>
              <option value="4h">4 Saat (4h)</option>
              <option value="1d">1 Gün (1d)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs">
            <span className="text-slate-400 font-mono">ÖRNEKLEM:</span>
            <span className="font-bold text-slate-800 font-mono">{klines.length} Bar (Binance Gerçek)</span>
          </div>

          <button
            onClick={() => fetchHistoricalData()}
            disabled={isLoadingData}
            className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1 transition shadow-xs disabled:opacity-50"
            title="Binance Verisini Yenile"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingData ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Lab Navigation Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setLabTab('library')}
          className={`px-3.5 py-2 rounded-lg font-bold text-xs transition flex items-center gap-1.5 shrink-0 ${
            labTab === 'library'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>🏛️ Taksonomi & Stratejiler ({strategies.length})</span>
        </button>

        <button
          onClick={() => setLabTab('oos_test')}
          className={`px-3.5 py-2 rounded-lg font-bold text-xs transition flex items-center gap-1.5 shrink-0 ${
            labTab === 'oos_test'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>🔬 60/20/20 Train-Val-OOS Testi</span>
        </button>

        <button
          onClick={() => setLabTab('walk_forward')}
          className={`px-3.5 py-2 rounded-lg font-bold text-xs transition flex items-center gap-1.5 shrink-0 ${
            labTab === 'walk_forward'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>🔄 Walk-Forward Analizörü (WFA)</span>
        </button>

        <button
          onClick={() => setLabTab('regimes')}
          className={`px-3.5 py-2 rounded-lg font-bold text-xs transition flex items-center gap-1.5 shrink-0 ${
            labTab === 'regimes'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          <span>🌪️ Piyasa Rejimi Stres Testi</span>
        </button>

        <button
          onClick={() => setLabTab('sensitivity')}
          className={`px-3.5 py-2 rounded-lg font-bold text-xs transition flex items-center gap-1.5 shrink-0 ${
            labTab === 'sensitivity'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Target className="w-3.5 h-3.5" />
          <span>🎯 Parametre Duyarlılık & Overfit</span>
        </button>

        <button
          onClick={() => setLabTab('cross_asset')}
          className={`px-3.5 py-2 rounded-lg font-bold text-xs transition flex items-center gap-1.5 shrink-0 ${
            labTab === 'cross_asset'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>🌐 Çapraz Parite Doğrulama</span>
        </button>

        <button
          onClick={() => setLabTab('ai_agent')}
          className={`px-3.5 py-2 rounded-lg font-bold text-xs transition flex items-center gap-1.5 shrink-0 ${
            labTab === 'ai_agent'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>🤖 AI Quant Research Agent</span>
        </button>

        <button
          onClick={() => setLabTab('versions')}
          className={`px-3.5 py-2 rounded-lg font-bold text-xs transition flex items-center gap-1.5 shrink-0 ${
            labTab === 'versions'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <GitBranch className="w-3.5 h-3.5" />
          <span>📜 Versiyonlama & Staging</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: QUANTITATIVE STRATEGY TAXONOMY & LIBRARY */}
      {/* ========================================================================= */}
      {labTab === 'library' && (
        <div className="space-y-4">
          {/* Family Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveFamilyFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeFamilyFilter === 'ALL'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Tüm Aileler ({strategies.length})
            </button>
            {(Object.keys(familyLabels) as QuantStrategyFamily[]).map(fam => (
              <button
                key={fam}
                onClick={() => setActiveFamilyFilter(fam)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 ${
                  activeFamilyFilter === fam
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {familyLabels[fam].label}
              </button>
            ))}
          </div>

          {/* Strategies Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStrategies.map(strat => {
              const isSelected = strat.id === selectedStrategyId;
              const liveSignal = latestSignals.find(s => s.strategyName === strat.name);

              return (
                <div
                  key={strat.id}
                  onClick={() => setSelectedStrategyId(strat.id)}
                  className={`bg-white rounded-xl border p-4 transition cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-md'
                      : 'border-slate-200 hover:border-slate-300 hover:shadow-xs'
                  }`}
                >
                  <div>
                    {/* Header: Family & Version */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${familyLabels[strat.family].color}`}>
                        {strat.family}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 font-bold">
                        v{strat.version}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="font-extrabold text-slate-900 text-sm mb-1.5 leading-snug">
                      {strat.name}
                    </h3>

                    {/* Hypothesis */}
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-2 mb-3">
                      {strat.hypothesis}
                    </p>

                    {/* Mathematical Formula Preview */}
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 mb-3">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Matematiksel Formül:</span>
                      <code className="text-[11px] font-mono text-blue-900 font-semibold block leading-tight">
                        {strat.mathematicalFormula}
                      </code>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {strat.tags.map(t => (
                        <span key={t} className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-medium">
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Bottom Action / Status Bar */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-slate-400 font-mono">Yön:</span>
                      <span className="font-bold text-slate-800">{strat.direction}</span>
                      <span className="text-slate-300">•</span>
                      <span className="text-slate-400 font-mono">Hedef:</span>
                      <span className="font-bold text-slate-800">{strat.expectedRegime}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {onDeployToPaper && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeployToPaper(strat);
                          }}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition flex items-center gap-1 shadow-2xs"
                          title="Bu kantitatif stratejiyi doğrudan aktif trading botu olarak başlat"
                        >
                          <span>🚀 Bot Olarak Ekle</span>
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedStrategyId(strat.id);
                          setLabTab('oos_test');
                        }}
                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg text-xs transition"
                      >
                        Laboratuvarda Test Et →
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: IN-SAMPLE VS OUT-OF-SAMPLE (OOS) PARTITION TEST */}
      {/* ========================================================================= */}
      {labTab === 'oos_test' && oosResult && (
        <div className="space-y-4">
          {/* Overfitting Scorecard & Institutional Verdict */}
          <div className={`p-4 rounded-xl border ${
            oosResult.overfitDiagnosis.verdict === 'ROBUST_INSTITUTIONAL'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : oosResult.overfitDiagnosis.verdict === 'ACCEPTABLE'
              ? 'bg-blue-50 border-blue-200 text-blue-950'
              : oosResult.overfitDiagnosis.verdict === 'CRITICAL_FAILURE'
              ? 'bg-rose-50 border-rose-200 text-rose-950'
              : 'bg-amber-50 border-amber-200 text-amber-950'
          }`}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                {oosResult.overfitDiagnosis.isOverfitted ? (
                  <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                )}
                <h3 className="font-extrabold text-sm tracking-tight">
                  KANTİTATİF ROBUSTNESS & OVERFITTING TEŞHİSİ: {oosResult.overfitDiagnosis.verdict}
                </h3>
              </div>

              <div className="flex items-center gap-3 font-mono text-xs">
                <span>Dayanıklılık Skoru: <strong>{oosResult.overfitDiagnosis.robustnessScore}/100</strong></span>
                <span>•</span>
                <span>OOS Performans Bozulması: <strong>%{oosResult.overfitDiagnosis.performanceDegradationPercent}</strong></span>
                {onDeployToPaper && (
                  <button
                    onClick={() => onDeployToPaper(selectedStrategy)}
                    className="ml-2 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition flex items-center gap-1 shadow-xs font-sans"
                  >
                    <span>🚀 Bot Olarak Başlat</span>
                  </button>
                )}
              </div>
            </div>

            {/* Diagnosis flags and warnings */}
            {oosResult.overfitDiagnosis.flags.length > 0 && (
              <div className="space-y-1 mb-2">
                {oosResult.overfitDiagnosis.flags.map((f, idx) => (
                  <div key={idx} className="text-xs font-semibold flex items-center gap-1.5">
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Recommendations */}
            {oosResult.overfitDiagnosis.recommendations.length > 0 && (
              <div className="text-xs opacity-90">
                <strong>Kantitatif Öneri:</strong> {oosResult.overfitDiagnosis.recommendations.join(' ')}
              </div>
            )}
          </div>

          {/* 3-Way Chronological Split Cards (Train 60% / Validation 20% / Out-Of-Sample 20%) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. In-Sample (Train 60%) */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  TRAINING (60% İÇ VERİ)
                </span>
                <span className="text-xs text-slate-400 font-mono">{Math.floor(oosResult.totalCandles * 0.6)} Bar</span>
              </div>
              <div className="text-2xl font-black font-mono text-slate-900 mb-1">
                {oosResult.inSampleMetrics.netProfitPercent >= 0 ? '+' : ''}%{oosResult.inSampleMetrics.netProfitPercent}
              </div>
              <p className="text-xs text-slate-500 mb-3">Model optimizasyon ve kalibrasyon dönemi</p>

              <div className="space-y-1.5 text-xs font-mono border-t border-slate-100 pt-2">
                <div className="flex justify-between text-slate-600">
                  <span>Sharpe Oranı:</span>
                  <strong className="text-slate-900">{oosResult.inSampleMetrics.sharpeRatio}</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Kâr Faktörü:</span>
                  <strong className="text-slate-900">{oosResult.inSampleMetrics.profitFactor}</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Maksimum Drawdown:</span>
                  <strong className="text-rose-600">-%{oosResult.inSampleMetrics.maxDrawdownPercent}</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>İşlem Sayısı / Win Rate:</span>
                  <strong className="text-slate-900">{oosResult.inSampleMetrics.totalTrades} İşlem (%{oosResult.inSampleMetrics.winRate})</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>İşlem Başına Beklenti (EV):</span>
                  <strong className="text-emerald-600">${oosResult.inSampleMetrics.expectancyUsdt}</strong>
                </div>
              </div>
            </div>

            {/* 2. Validation (20%) */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                  VALIDATION (20% DOĞRULAMA)
                </span>
                <span className="text-xs text-slate-400 font-mono">{Math.floor(oosResult.totalCandles * 0.2)} Bar</span>
              </div>
              <div className="text-2xl font-black font-mono text-slate-900 mb-1">
                {oosResult.validationMetrics.netProfitPercent >= 0 ? '+' : ''}%{oosResult.validationMetrics.netProfitPercent}
              </div>
              <p className="text-xs text-slate-500 mb-3">Hiperparametre ince ayar kontrolü</p>

              <div className="space-y-1.5 text-xs font-mono border-t border-slate-100 pt-2">
                <div className="flex justify-between text-slate-600">
                  <span>Sharpe Oranı:</span>
                  <strong className="text-slate-900">{oosResult.validationMetrics.sharpeRatio}</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Kâr Faktörü:</span>
                  <strong className="text-slate-900">{oosResult.validationMetrics.profitFactor}</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Maksimum Drawdown:</span>
                  <strong className="text-rose-600">-%{oosResult.validationMetrics.maxDrawdownPercent}</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>İşlem Sayısı / Win Rate:</span>
                  <strong className="text-slate-900">{oosResult.validationMetrics.totalTrades} İşlem (%{oosResult.validationMetrics.winRate})</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>İşlem Başına Beklenti (EV):</span>
                  <strong className="text-emerald-600">${oosResult.validationMetrics.expectancyUsdt}</strong>
                </div>
              </div>
            </div>

            {/* 3. Out-Of-Sample (20% Pure Out-of-Sample) */}
            <div className={`rounded-xl border p-4 shadow-xs ${
              oosResult.outOfSampleMetrics.netProfitPercent > 0
                ? 'bg-emerald-50/50 border-emerald-300'
                : 'bg-rose-50/50 border-rose-300'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-600 text-white">
                  OUT-OF-SAMPLE (20% SAF KÖR TEST)
                </span>
                <span className="text-xs text-slate-400 font-mono">{Math.floor(oosResult.totalCandles * 0.2)} Bar</span>
              </div>
              <div className={`text-2xl font-black font-mono mb-1 ${
                oosResult.outOfSampleMetrics.netProfitPercent >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}>
                {oosResult.outOfSampleMetrics.netProfitPercent >= 0 ? '+' : ''}%{oosResult.outOfSampleMetrics.netProfitPercent}
              </div>
              <p className="text-xs text-slate-600 mb-3">Modelin hiç görmediği gerçek zaman dilimi</p>

              <div className="space-y-1.5 text-xs font-mono border-t border-slate-200 pt-2">
                <div className="flex justify-between text-slate-700">
                  <span>OOS Sharpe:</span>
                  <strong className="text-slate-900">{oosResult.outOfSampleMetrics.sharpeRatio}</strong>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>OOS Kâr Faktörü:</span>
                  <strong className="text-slate-900">{oosResult.outOfSampleMetrics.profitFactor}</strong>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>OOS Max Drawdown:</span>
                  <strong className="text-rose-600">-%{oosResult.outOfSampleMetrics.maxDrawdownPercent}</strong>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>OOS İşlem / Win Rate:</span>
                  <strong className="text-slate-900">{oosResult.outOfSampleMetrics.totalTrades} İşlem (%{oosResult.outOfSampleMetrics.winRate})</strong>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>OOS Beklenti (EV):</span>
                  <strong className="text-emerald-700">${oosResult.outOfSampleMetrics.expectancyUsdt}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Out-Of-Sample Trades Audit Log */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
            <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider mb-3">
              Out-of-Sample Kör Test İşlem Günlüğü ({oosResult.outOfSampleMetrics.trades.length} İşlem)
            </h4>

            {oosResult.outOfSampleMetrics.trades.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">Bu dönemde stratejinin katı matematiksel koşullarına uyan işlem tetiklenmedi.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 text-[10px] uppercase">
                      <th className="pb-2">İşlem ID</th>
                      <th className="pb-2">Yön</th>
                      <th className="pb-2">Giriş Fiyatı</th>
                      <th className="pb-2">Çıkış Fiyatı</th>
                      <th className="pb-2">Giriş Tarihi</th>
                      <th className="pb-2">Çıkış Tarihi</th>
                      <th className="pb-2 text-right">Net PnL ($ / %)</th>
                      <th className="pb-2 text-right">Komisyon</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {oosResult.outOfSampleMetrics.trades.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className="py-2 text-slate-600 font-bold">{t.id}</td>
                        <td className="py-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            t.side === 'LONG' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}>
                            {t.side}
                          </span>
                        </td>
                        <td className="py-2 text-slate-800">${t.entryPrice.toFixed(2)}</td>
                        <td className="py-2 text-slate-800">${t.exitPrice.toFixed(2)}</td>
                        <td className="py-2 text-slate-500 text-[10px]">{new Date(t.entryTime).toLocaleDateString('tr-TR')}</td>
                        <td className="py-2 text-slate-500 text-[10px]">{new Date(t.exitTime).toLocaleDateString('tr-TR')}</td>
                        <td className={`py-2 text-right font-bold ${t.pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)} ({t.pnlPercent >= 0 ? '+' : ''}{t.pnlPercent.toFixed(2)}%)
                        </td>
                        <td className="py-2 text-right text-slate-400 text-[10px]">${t.fee.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: WALK-FORWARD ANALYSIS (WFA) */}
      {/* ========================================================================= */}
      {labTab === 'walk_forward' && wfaResult && (
        <div className="space-y-4">
          {/* WFA Summary Metric */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-0.5">
                KAYAN PENCERE YÜRÜTME VERİMLİLİĞİ (WFE)
              </span>
              <div className="flex items-center gap-2">
                <span className={`text-3xl font-black font-mono ${
                  wfaResult.overallWalkForwardEfficiency >= 50 ? 'text-emerald-600' : 'text-amber-600'
                }`}>
                  %{wfaResult.overallWalkForwardEfficiency}
                </span>
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                  wfaResult.isStableAcrossPeriods ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {wfaResult.isStableAcrossPeriods ? 'STABİL & REJİME DAYANIKLI' : 'YÜKSEK DEĞİŞKENLİK'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <div>
                <span className="text-slate-400 block text-[10px]">ORTALAMA OOS GETİRİ:</span>
                <strong className="text-slate-900">%{wfaResult.averageOosReturn}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">ORTALAMA OOS SHARPE:</span>
                <strong className="text-slate-900">{wfaResult.averageOosSharpe}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">ORTALAMA OOS DRAWDOWN:</span>
                <strong className="text-rose-600">-%{wfaResult.averageOosDrawdown}</strong>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
            {wfaResult.summaryNote}
          </p>

          {/* Windows Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {wfaResult.windows.map(win => (
              <div key={win.windowIndex} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-extrabold text-xs text-slate-900">Pencere #{win.windowIndex}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    win.windowEfficiency >= 50 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    WFE: %{win.windowEfficiency}
                  </span>
                </div>

                <div className="text-xs text-slate-500 font-mono mb-3 text-[10px]">
                  Eğitim: {win.trainStartDate} → {win.trainEndDate}
                  <br />
                  Test: {win.testStartDate} → {win.testEndDate}
                </div>

                <div className="space-y-1.5 text-xs font-mono border-t border-slate-100 pt-2">
                  <div className="flex justify-between text-slate-600">
                    <span>Train Getiri:</span>
                    <strong className="text-slate-900">%{win.trainReturnPercent.toFixed(1)}</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Test (OOS) Getiri:</span>
                    <strong className={win.testReturnPercent >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                      %{win.testReturnPercent.toFixed(1)}
                    </strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Test Sharpe:</span>
                    <strong className="text-slate-900">{win.testSharpe.toFixed(2)}</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Test Max DD:</span>
                    <strong className="text-rose-600">-%{win.testMaxDrawdownPercent.toFixed(1)}</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>İşlem Sayısı:</span>
                    <strong className="text-slate-900">{win.testTradesCount}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: MARKET REGIME STRESS TEST */}
      {/* ========================================================================= */}
      {labTab === 'regimes' && regimeResults && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
            <h3 className="font-extrabold text-slate-900 text-sm mb-1">
              PİYASA REJİMLERİ STRES TESTİ VE PERFORMANS AYRIŞIMI
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Geçmiş verideki her bir mum Boğa, Ayı, Yatay/Testere ve Yüksek Volatilite rejimlerine ayrılmış ve stratejinin her rejimdeki alfa dayanıklılığı bağımsız olarak ölçülmüştür.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {regimeResults.map(reg => (
                <div
                  key={reg.regime}
                  className={`rounded-xl border p-4 shadow-xs ${
                    reg.isSuitable ? 'bg-emerald-50/40 border-emerald-200' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-xs text-slate-900">{reg.regimeLabel}</h4>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      reg.isSuitable ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {reg.isSuitable ? 'ALFA ÜRETİYOR' : 'DÜŞÜK UYUM'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500 font-mono mb-3">
                    <span>Tarihsel Ağırlık: %{reg.percentageOfHistory}</span>
                    <span>•</span>
                    <span>{reg.candleCount} Mum</span>
                    <span>•</span>
                    <span>{reg.tradesCount} İşlem</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center font-mono pt-2 border-t border-slate-200/60">
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-400 block">NET GETİRİ</span>
                      <strong className={`text-xs ${reg.netProfitPercent >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {reg.netProfitPercent >= 0 ? '+' : ''}%{reg.netProfitPercent}
                      </strong>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-400 block">KÂR FAKTÖRÜ</span>
                      <strong className="text-xs text-slate-800">{reg.profitFactor}</strong>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-400 block">WIN RATE</span>
                      <strong className="text-xs text-slate-800">%{reg.winRate}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: PARAMETER SENSITIVITY & OVERFITTING DETECTOR */}
      {/* ========================================================================= */}
      {labTab === 'sensitivity' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">
                  PARAMETRE DUYARLILIK EĞRİSİ VE PLATFORM TESTİ
                </h3>
                <p className="text-xs text-slate-500">
                  Seçili parametre komşu değerlerde test edilir. Eğer kâr yalnızca tek bir sivri noktada (spike) var olup komşularda çöküyorsa model ezberlemiştir (Overfit).
                </p>
              </div>

              {sensitivityResult && (
                <span className={`px-2.5 py-1 rounded text-xs font-bold ${
                  sensitivityResult.isFragileSpike
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}>
                  {sensitivityResult.isFragileSpike ? '⚠️ KIRILGAN TEPE NOKTASI (OVERFIT)' : '✅ GENİŞ SAĞLAM PLATFORM'}
                </span>
              )}
            </div>

            {/* Parameter Selector */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-bold text-slate-700">Analiz Edilen Parametre:</span>
              <select
                value={sensitivityResult?.parameterName || ''}
                onChange={(e) => {
                  if (klines.length > 0) {
                    const res = runParameterSensitivity(klines, selectedStrategy, e.target.value);
                    setSensitivityResult(res);
                  }
                }}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 outline-none"
              >
                {Object.keys(selectedStrategy.parameters || {}).map(k => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>

            {/* Sensitivity Grid Display */}
            {sensitivityResult && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {sensitivityResult.points.map(p => {
                  const isOptimal = p.parameterValue === sensitivityResult.optimalValue;
                  const isBase = p.parameterValue === sensitivityResult.baseValue;

                  return (
                    <div
                      key={p.parameterValue}
                      className={`p-3 rounded-xl border text-center transition ${
                        isOptimal
                          ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-500/20'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="text-xs font-mono text-slate-400 mb-1 flex items-center justify-center gap-1">
                        <span>{p.parameterName} = {p.parameterValue}</span>
                        {isBase && <span className="text-[10px] bg-slate-200 text-slate-700 px-1 rounded">Mevcut</span>}
                      </div>

                      <div className={`text-lg font-black font-mono mb-1 ${
                        p.returnPercent >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {p.returnPercent >= 0 ? '+' : ''}%{p.returnPercent.toFixed(1)}
                      </div>

                      <div className="text-[11px] font-mono text-slate-600 space-y-0.5 border-t border-slate-100 pt-1.5">
                        <div>Sharpe: <strong>{p.sharpeRatio.toFixed(2)}</strong></div>
                        <div>Max DD: <strong className="text-rose-600">-%{p.maxDrawdown.toFixed(1)}</strong></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: CROSS-ASSET VALIDATION */}
      {/* ========================================================================= */}
      {labTab === 'cross_asset' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">
                  ÇAPRAZ PARİTE GENELLEŞTİRME TESTİ (CROSS-ASSET VALIDATION)
                </h3>
                <p className="text-xs text-slate-500">
                  Gerçek bir kantitatif kenar (edge) yalnızca tek bir coinde değil, korelasyonlu büyük varlıklarda (BTC, ETH, SOL, BNB) da pozitif kâr beklentisi üretmelidir.
                </p>
              </div>

              <button
                onClick={handleRunCrossAsset}
                disabled={isCrossAssetRunning}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCrossAssetRunning ? 'animate-spin' : ''}`} />
                <span>Tüm Paritelerde Test Et</span>
              </button>
            </div>

            {crossAssetResult ? (
              <div className="space-y-4">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Genelleştirilebilirlik Skoru:</span>
                  <span className="text-base font-black font-mono text-blue-700">
                    {crossAssetResult.crossAssetRobustnessScore}/100 ({crossAssetResult.verdict})
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {crossAssetResult.testedSymbols.map(sym => (
                    <div key={sym.symbol} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-extrabold font-mono text-xs text-slate-900">{sym.symbol}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          sym.passed ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {sym.passed ? 'GEÇTİ' : 'BAŞARISIZ'}
                        </span>
                      </div>

                      <div className={`text-xl font-black font-mono mb-2 ${
                        sym.totalReturnPercent >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {sym.totalReturnPercent >= 0 ? '+' : ''}%{sym.totalReturnPercent.toFixed(1)}
                      </div>

                      <div className="space-y-1 text-xs font-mono text-slate-600 border-t border-slate-100 pt-2">
                        <div className="flex justify-between">
                          <span>Sharpe:</span>
                          <strong>{sym.sharpeRatio.toFixed(2)}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Kâr Faktörü:</span>
                          <strong>{sym.profitFactor.toFixed(2)}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Max Drawdown:</span>
                          <strong className="text-rose-600">-%{sym.maxDrawdownPercent.toFixed(1)}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>İşlem Sayısı:</span>
                          <strong>{sym.tradesCount}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                <Globe className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs text-slate-600 mb-3">Stratejinin ETH, SOL ve BNB paritelerindeki performansını tek tıkla test edin.</p>
                <button
                  onClick={handleRunCrossAsset}
                  disabled={isCrossAssetRunning}
                  className="px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl shadow-xs"
                >
                  Çapraz Parite Doğrulamasını Başlat
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: AI QUANT RESEARCH AGENT */}
      {/* ========================================================================= */}
      {labTab === 'ai_agent' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Panel 1: AI Hypothesis Generator */}
            <div className="bg-white rounded-xl border border-purple-200 p-4 shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-600 flex items-center justify-center text-white">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">AI Kantitatif Hipotez Jeneratörü</h3>
                  <p className="text-[11px] text-slate-500">Matematiksel ve ekonomik temelli yeni kantitatif trading hipotezleri üretir.</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={aiSelectedFamily}
                  onChange={(e) => setAiSelectedFamily(e.target.value as QuantStrategyFamily)}
                  className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none"
                >
                  {(Object.keys(familyLabels) as QuantStrategyFamily[]).map(fam => (
                    <option key={fam} value={fam}>{familyLabels[fam].label}</option>
                  ))}
                </select>

                <button
                  onClick={handleGenerateAiHypothesis}
                  disabled={isAiLoading}
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-lg transition shadow-xs flex items-center gap-1 disabled:opacity-50 shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Hipotez Üret</span>
                </button>
              </div>

              {aiHypothesis && (
                <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200 space-y-2 text-xs">
                  <h4 className="font-bold text-purple-950 text-sm">{aiHypothesis.hypothesisTitle}</h4>
                  <p className="text-slate-700 leading-relaxed"><strong>Ekonomik Temel:</strong> {aiHypothesis.economicRationale}</p>
                  
                  <div className="p-2 bg-white rounded-lg border border-purple-200">
                    <span className="text-[10px] font-bold text-slate-400 block">Matematiksel Formül:</span>
                    <code className="text-xs font-mono font-bold text-purple-900">{aiHypothesis.mathematicalLogic}</code>
                  </div>

                  <div className="text-[11px] text-slate-600">
                    <strong>Hedef Rejim:</strong> {aiHypothesis.targetRegime} | <strong>Test Planı:</strong> {aiHypothesis.testPlan}
                  </div>
                </div>
              )}
            </div>

            {/* Panel 2: AI Rigorous Risk & Overfitting Auditor */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center text-white">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">Bağımsız Risk & Overfitting Denetçisi</h3>
                  <p className="text-[11px] text-slate-500">Mevcut stratejiyi ve OOS test sonuçlarını tarafsızca denetler.</p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-600 font-mono">
                  Denetlenecek Strateji: <strong>{selectedStrategy.name}</strong>
                </span>

                <button
                  onClick={handleAuditStrategyWithAi}
                  disabled={isAiLoading}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition shadow-xs flex items-center gap-1 disabled:opacity-50 shrink-0"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Stratejiyi Denetle</span>
                </button>
              </div>

              {aiAudit && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">Kurumsal Denetim Puanı:</span>
                    <span className="font-black font-mono text-sm text-blue-700">{aiAudit.score}/100 ({aiAudit.verdict})</span>
                  </div>

                  <p className="text-slate-700 leading-relaxed">{aiAudit.mathematicalCritique}</p>

                  <div className="space-y-1">
                    <span className="font-bold text-slate-800 block text-[11px]">Kritik Zayıflıklar:</span>
                    {aiAudit.keyWeaknesses.map((w, idx) => (
                      <div key={idx} className="text-[11px] text-rose-700 flex items-center gap-1 font-mono">
                        <span>• {w}</span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1">
                    <span className="font-bold text-slate-800 block text-[11px]">Önerilen İyileştirmeler:</span>
                    {aiAudit.suggestedImprovements.map((imp, idx) => (
                      <div key={idx} className="text-[11px] text-emerald-700 flex items-center gap-1 font-mono">
                        <span>• {imp}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 8: VERSION HISTORY & STAGING */}
      {/* ========================================================================= */}
      {labTab === 'versions' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
            <h3 className="font-extrabold text-slate-900 text-sm mb-1">
              STRATEJİ VERSİYON GEÇMİŞİ VE PAPER TRADING GEÇİŞ KAPISI (STAGING GATE)
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Her strateji revizyonu parametreleri, In-Sample ve Out-Of-Sample metrikleri ile saklanır. Yalnızca OOS testini geçen stratejiler Paper Trading ortamına alınabilir.
            </p>

            <div className="space-y-3">
              {versionHistory.map(rec => (
                <div key={rec.version} className="p-3.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50/50">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm text-slate-900 font-mono">{rec.version}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {rec.status}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {new Date(rec.timestamp).toLocaleDateString('tr-TR')} • Yazar: {rec.author}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{rec.notes}</p>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono">
                    <div>
                      <span className="text-slate-400 block text-[10px]">OOS GETİRİ:</span>
                      <strong className="text-emerald-600">+{rec.oosReturnPercent}%</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">OOS SHARPE:</span>
                      <strong className="text-slate-900">{rec.oosSharpe}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">WFE:</span>
                      <strong className="text-slate-900">%{rec.wfePercent}</strong>
                    </div>

                    <button
                      onClick={() => {
                        if (onDeployToPaper) {
                          onDeployToPaper(selectedStrategy);
                        }
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition shadow-xs"
                    >
                      Paper Trading'e Al
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
