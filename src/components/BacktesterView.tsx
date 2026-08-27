import React, { useState } from 'react';
import { StrategyConfig, RiskSettings, BacktestResult, Kline } from '../types/trading';
import { getKlines } from '../services/api';
import { runBacktest } from '../utils/backtestEngine';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { 
  Play, TrendingUp, Award, BarChart3, AlertCircle, Percent, DollarSign, RefreshCw, 
  Layers, Bot, PlusCircle, CheckCircle2, ArrowRight, X, Sparkles, Check, ChevronRight
} from 'lucide-react';

interface BacktesterViewProps {
  strategies: StrategyConfig[];
  riskSettings: RiskSettings;
  defaultSymbol: string;
  onDeployStrategy?: (newStrategy: StrategyConfig) => void;
  onNavigateToStrategies?: () => void;
}

interface StrategyComparisonItem {
  strategy: StrategyConfig;
  result: BacktestResult;
}

interface DeployModalData {
  strategy: StrategyConfig;
  result: BacktestResult;
}

export const BacktesterView: React.FC<BacktesterViewProps> = ({
  strategies,
  defaultSymbol,
  onDeployStrategy,
  onNavigateToStrategies
}) => {
  const [selectedSymbol, setSelectedSymbol] = useState<string>(defaultSymbol || 'BTCUSDT');
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('1h');
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>(strategies[0]?.id || '');
  const [candleLimit, setCandleLimit] = useState<number>(1000);
  const [initialCapital, setInitialCapital] = useState<number>(10000);
  const [positionSizePercent, setPositionSizePercent] = useState<number>(80);
  const [makerFee] = useState<number>(0.075);
  const [takerFee, setTakerFee] = useState<number>(0.075);
  const [slippage, setSlippage] = useState<number>(0.05);
  const [allowShorts, setAllowShorts] = useState<boolean>(true);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isComparingAll, setIsComparingAll] = useState<boolean>(false);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [comparisonResults, setComparisonResults] = useState<StrategyComparisonItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Deploy / Save Strategy Modal State
  const [deployModal, setDeployModal] = useState<DeployModalData | null>(null);
  const [customName, setCustomName] = useState<string>('');
  const [customSymbol, setCustomSymbol] = useState<string>('');
  const [customTimeframe, setCustomTimeframe] = useState<string>('1h');
  const [customDirection, setCustomDirection] = useState<'LONG' | 'SHORT' | 'BOTH'>('BOTH');
  const [autoEnable, setAutoEnable] = useState<boolean>(true);
  const [customSuitability, setCustomSuitability] = useState<string>('');
  const [deployedSuccessMsg, setDeployedSuccessMsg] = useState<{ name: string; id: string } | null>(null);

  const handleOpenDeployModal = (strat: StrategyConfig, res: BacktestResult) => {
    setDeployModal({ strategy: strat, result: res });
    const retSign = res.totalReturnPercent >= 0 ? '+' : '';
    setCustomName(`${strat.name} [${selectedSymbol} %${retSign}${res.totalReturnPercent}]`);
    setCustomSymbol(selectedSymbol);
    setCustomTimeframe(selectedTimeframe);
    setCustomDirection(strat.direction || 'BOTH');
    setAutoEnable(true);
    setCustomSuitability(strat.suitability || `Backtest Skoru: %${res.winRate} Kazanma, +$${res.netProfit} Net Kâr`);
  };

  const handleSaveAndDeploy = () => {
    if (!deployModal) return;
    const newStrategy: StrategyConfig = {
      ...deployModal.strategy,
      id: `strat-custom-${Date.now()}`,
      name: customName.trim() || deployModal.strategy.name,
      symbol: customSymbol,
      timeframe: customTimeframe,
      direction: customDirection,
      enabled: autoEnable,
      suitability: customSuitability,
      isDefault: false
    };

    if (onDeployStrategy) {
      onDeployStrategy(newStrategy);
    }

    setDeployedSuccessMsg({ name: newStrategy.name, id: newStrategy.id });
    setDeployModal(null);
  };

  const handleRunBacktest = async () => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      // 1. Fetch real historical klines from Binance Public API
      const klines: Kline[] = await getKlines(selectedSymbol, selectedTimeframe, candleLimit);
      if (!klines || klines.length < 50) {
        setErrorMsg('Binance üzerinden yeterli mum verisi çekilemedi.');
        setIsLoading(false);
        return;
      }

      // 2. Locate active strategy
      let targetStrategy = strategies.find(s => s.id === selectedStrategyId);
      if (!targetStrategy) {
        targetStrategy = {
          ...strategies[0],
          symbol: selectedSymbol,
          timeframe: selectedTimeframe
        };
      } else {
        targetStrategy = {
          ...targetStrategy,
          symbol: selectedSymbol,
          timeframe: selectedTimeframe
        };
      }

      // 3. Execute 100% pure signal simulation (0 fake heuristics)
      const result = runBacktest(klines, targetStrategy, {
        initialBalance: initialCapital,
        makerFeePercent: makerFee,
        takerFeePercent: takerFee,
        slippagePercent: slippage,
        positionSizePercent,
        allowShorts
      });

      setBacktestResult(result);
    } catch (err: any) {
      console.error('Backtest error:', err);
      setErrorMsg(err.message || 'Backtest çalıştırılırken bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompareAllStrategies = async () => {
    setIsComparingAll(true);
    setErrorMsg(null);
    try {
      const klines: Kline[] = await getKlines(selectedSymbol, selectedTimeframe, 1000);
      if (!klines || klines.length < 50) {
        setErrorMsg('Binance üzerinden yeterli mum verisi çekilemedi.');
        setIsComparingAll(false);
        return;
      }

      const results: StrategyComparisonItem[] = [];
      for (const strat of strategies) {
        const res = runBacktest(
          klines,
          { ...strat, symbol: selectedSymbol, timeframe: selectedTimeframe },
          {
            initialBalance: initialCapital,
            makerFeePercent: makerFee,
            takerFeePercent: takerFee,
            slippagePercent: slippage,
            positionSizePercent,
            allowShorts
          }
        );
        results.push({ strategy: strat, result: res });
      }

      // Sort by Net Profit descending
      results.sort((a, b) => b.result.netProfit - a.result.netProfit);
      setComparisonResults(results);

      // Select top result
      if (results.length > 0) {
        setSelectedStrategyId(results[0].strategy.id);
        setBacktestResult(results[0].result);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Karşılaştırma sırasında bir hata oluştu.');
    } finally {
      setIsComparingAll(false);
    }
  };

  return (
    <div className="space-y-4 text-slate-800">
      {/* Backtest Configuration Form */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Event-Driven Geriye Dönük Test (Backtest) & Simülasyon
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-600" />
                  %100 Saf Algoritmik Sinyal (0 Fake Veri)
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Binance gerçek geçmiş mum kapanışları, gerçek taker komisyonları ve kayma (slippage) ile matematiksel kesinlikte test edilir.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div>
            <label className="text-slate-600 block mb-1">Sembol</label>
            <select
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-900 font-bold font-mono focus:bg-white focus:border-blue-500 outline-none"
            >
              {['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'AVAXUSDT', 'NEARUSDT'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-slate-600 block mb-1">Zaman Dilimi</label>
            <select
              value={selectedTimeframe}
              onChange={(e) => setSelectedTimeframe(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-900 font-semibold focus:bg-white focus:border-blue-500 outline-none"
            >
              {['1m', '5m', '15m', '1h', '4h', '1d'].map(tf => (
                <option key={tf} value={tf}>{tf}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-slate-600 block mb-1">Test Stratejisi</label>
            <select
              value={selectedStrategyId}
              onChange={(e) => setSelectedStrategyId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-900 font-semibold truncate focus:bg-white focus:border-blue-500 outline-none"
            >
              <optgroup label="🟢 LONG STRATEJİLERİ (Boğa / Dip Alımı)">
                {strategies
                  .filter(s => (s.direction || 'LONG') === 'LONG' || s.direction === 'BOTH')
                  .map(s => (
                    <option key={s.id} value={s.id}>
                      🟢 {s.name}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="🔴 SHORT STRATEJİLERİ (Ayı / Tepe Reddi)">
                {strategies
                  .filter(s => s.direction === 'SHORT')
                  .map(s => (
                    <option key={s.id} value={s.id}>
                      🔴 {s.name}
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>

          <div>
            <label className="text-slate-600 block mb-1">Mum Sayısı</label>
            <select
              value={candleLimit}
              onChange={(e) => setCandleLimit(parseInt(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-900 font-mono focus:bg-white focus:border-blue-500 outline-none"
            >
              <option value={200}>200 Mum</option>
              <option value={500}>500 Mum</option>
              <option value={1000}>1000 Mum (Maksimum)</option>
            </select>
          </div>

          <div>
            <label className="text-slate-600 block mb-1">Başlangıç Sermayesi ($)</label>
            <input
              type="number"
              value={initialCapital}
              onChange={(e) => setInitialCapital(parseFloat(e.target.value) || 1000)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 font-mono focus:bg-white focus:border-blue-500 outline-none"
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={handleRunBacktest}
              disabled={isLoading || isComparingAll}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-lg transition flex items-center justify-center gap-1.5 shadow-xs"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Test Ediliyor...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>Backtest Başlat</span>
                </>
              )}
            </button>
            <button
              onClick={handleCompareAllStrategies}
              disabled={isLoading || isComparingAll}
              title="Tüm stratejileri 1000 mum (40+ gün) üzerinde simüle edip en karlı olanları sıralar"
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-lg transition flex items-center justify-center gap-1 shadow-xs"
            >
              {isComparingAll ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Layers className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">Tümünü Karşılaştır</span>
            </button>
          </div>
        </div>

        {/* Execution & Slippage Parameters (Pure Real Signal Modeling) */}
        <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="text-slate-600 font-medium block mb-1">Pozisyon Büyüklüğü (Kasa %)</label>
            <select
              value={positionSizePercent}
              onChange={(e) => setPositionSizePercent(parseInt(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 font-semibold focus:bg-white focus:border-blue-500 outline-none"
            >
              <option value={80}>%80 Kasa (Önerilen Bileşik Getiri)</option>
              <option value={100}>%100 Kasa (Tüm Bakiye)</option>
              <option value={50}>%50 Kasa (Dengeli)</option>
              <option value={25}>%25 Kasa (Muhafazakar)</option>
            </select>
          </div>

          <div>
            <label className="text-slate-600 font-medium block mb-1">Taker Komisyonu (Binance %)</label>
            <select
              value={takerFee}
              onChange={(e) => setTakerFee(parseFloat(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 font-semibold font-mono focus:bg-white focus:border-blue-500 outline-none"
            >
              <option value={0.075}>%0.075 (Standart Spot/Vadeli)</option>
              <option value={0.04}>%0.04 (VIP / BNB İndirimli)</option>
              <option value={0.02}>%0.02 (Düşük Komisyon)</option>
              <option value={0.0}>%0.00 (Sıfır Komisyon)</option>
            </select>
          </div>

          <div>
            <label className="text-slate-600 font-medium block mb-1">Kayma / Slippage Oranı</label>
            <select
              value={slippage}
              onChange={(e) => setSlippage(parseFloat(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 font-semibold font-mono focus:bg-white focus:border-blue-500 outline-none"
            >
              <option value={0.05}>%0.05 (Gerçekçi Piyasa Kayması)</option>
              <option value={0.10}>%0.10 (Yüksek Volatilite)</option>
              <option value={0.02}>%0.02 (Yüksek Likidite)</option>
              <option value={0.0}>%0.00 (Sıfır Kayma)</option>
            </select>
          </div>

          <div>
            <label className="text-slate-600 font-medium block mb-1">Short İşlemleri</label>
            <select
              value={allowShorts ? 'YES' : 'NO'}
              onChange={(e) => setAllowShorts(e.target.value === 'YES')}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 font-semibold focus:bg-white focus:border-blue-500 outline-none"
            >
              <option value="YES">✅ İzin Ver (Çift Yönlü / Long & Short)</option>
              <option value="NO">❌ Sadece Spot / Long</option>
            </select>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-3 p-2.5 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Multi-Strategy Comparison Table */}
        {comparisonResults.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-500" />
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  40+ Günlük Strateji Liderlik Tablosu & Karşılaştırması ({comparisonResults.length} Strateji)
                </h4>
              </div>
              <span className="text-[10px] text-slate-500">1000 Mum Üzerinden Sıralandı</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] text-slate-500 uppercase">
                    <th className="py-2 px-2">Sıra / Strateji</th>
                    <th className="py-2 px-2">Yön</th>
                    <th className="py-2 px-2">Net Kâr ($)</th>
                    <th className="py-2 px-2">Getiri %</th>
                    <th className="py-2 px-2">Kazanma Oranı</th>
                    <th className="py-2 px-2">Profit Factor</th>
                    <th className="py-2 px-2">Max DD</th>
                    <th className="py-2 px-2">Sharpe</th>
                    <th className="py-2 px-2 text-right">Aksiyonlar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {comparisonResults.map((item, idx) => {
                    const isSelected = item.strategy.id === selectedStrategyId;
                    const isProfit = item.result.netProfit >= 0;
                    return (
                      <tr
                        key={item.strategy.id}
                        onClick={() => {
                          setSelectedStrategyId(item.strategy.id);
                          setBacktestResult(item.result);
                        }}
                        className={`cursor-pointer transition hover:bg-blue-50/50 ${isSelected ? 'bg-blue-50 font-semibold' : ''}`}
                      >
                        <td className="py-2 px-2 font-sans flex items-center gap-1.5">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            idx === 0 ? 'bg-amber-100 text-amber-800' : idx === 1 ? 'bg-slate-200 text-slate-700' : idx === 2 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {idx + 1}
                          </span>
                          <span className="truncate max-w-[190px] text-slate-900">{item.strategy.name}</span>
                        </td>
                        <td className="py-2 px-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            item.strategy.direction === 'LONG' ? 'text-emerald-700 bg-emerald-100' : 'text-rose-700 bg-rose-100'
                          }`}>
                            {item.strategy.direction || 'LONG'}
                          </span>
                        </td>
                        <td className={`py-2 px-2 font-bold ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isProfit ? '+' : ''}${item.result.netProfit.toFixed(2)}
                        </td>
                        <td className={`py-2 px-2 font-bold ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isProfit ? '+' : ''}{item.result.totalReturnPercent}%
                        </td>
                        <td className="py-2 px-2 text-blue-600 font-bold">
                          %{item.result.winRate} ({item.result.winningTrades}/{item.result.totalTrades})
                        </td>
                        <td className="py-2 px-2 text-slate-800">
                          {item.result.profitFactor}
                        </td>
                        <td className="py-2 px-2 text-rose-600">
                          -%{item.result.maxDrawdownPercent}
                        </td>
                        <td className="py-2 px-2 text-purple-700">
                          {item.result.sharpeRatio}
                        </td>
                        <td className="py-2 px-2 text-right">
                          <div className="flex items-center justify-end gap-1.5 font-sans">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedStrategyId(item.strategy.id);
                                setBacktestResult(item.result);
                              }}
                              className="px-2 py-1 bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-800 rounded text-[10px] font-bold transition"
                              title="Detaylı grafiği ve işlemleri gör"
                            >
                              Grafik
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDeployModal(item.strategy, item.result);
                              }}
                              className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold shadow-xs transition active:scale-95"
                              title="Bu stratejiyi isimlendir ve bot işlem motoruna aktifleştir"
                            >
                              <Bot className="w-3 h-3" />
                              <span>Bota Ekle / Kullan</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Deployed Success Notification Banner */}
      {deployedSuccessMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-emerald-950">
                🎉 "{deployedSuccessMsg.name}" başarıyla bot hafızasına eklendi ve kullanıma hazır!
              </p>
              <p className="text-[11px] text-emerald-700">
                Bot canlı ve kâğıt üzerinde bu stratejiyi taramaya başladı. İstediğiniz an ayarlarını değiştirebilirsiniz.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onNavigateToStrategies && (
              <button
                onClick={onNavigateToStrategies}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 shadow-xs transition"
              >
                <span>Strateji Yöneticisine Git</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => setDeployedSuccessMsg(null)}
              className="p-1 text-emerald-700 hover:text-emerald-900 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {backtestResult && (
        <div className="space-y-4">
          {/* Active Strategy Deploy Header Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm border border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 flex-shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-white">
                    {strategies.find(s => s.id === selectedStrategyId)?.name || 'Seçili Strateji'}
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/30 border border-blue-400/30 text-blue-200">
                    {selectedSymbol} • {selectedTimeframe}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Gerçek Binance simülasyonu: <strong className="text-emerald-400 font-mono">{backtestResult.netProfit >= 0 ? '+' : ''}${backtestResult.netProfit} (%{backtestResult.totalReturnPercent})</strong> Net Kâr • <strong className="text-blue-300">%{backtestResult.winRate}</strong> Kazanma
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                const currentStrat = strategies.find(s => s.id === selectedStrategyId) || strategies[0];
                handleOpenDeployModal(currentStrat, backtestResult);
              }}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg text-xs shadow-md transition active:scale-95 flex-shrink-0"
            >
              <Bot className="w-4 h-4" />
              <span>Bu Stratejiyi İsimlendir ve Bota Ekle</span>
            </button>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 text-xs">
            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
              <span className="text-[10px] text-slate-500 block uppercase font-medium">Net Kâr / Zarar</span>
              <span className={`text-base font-bold font-mono ${backtestResult.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {backtestResult.netProfit >= 0 ? '+' : ''}${backtestResult.netProfit}
              </span>
              <span className="text-[10px] text-slate-500 block font-mono">
                (%{backtestResult.totalReturnPercent})
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
              <span className="text-[10px] text-slate-500 block uppercase font-medium">Kazanma Oranı</span>
              <span className="text-base font-bold font-mono text-blue-600">
                %{backtestResult.winRate}
              </span>
              <span className="text-[10px] text-slate-500 block">
                {backtestResult.winningTrades}K / {backtestResult.losingTrades}Z
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
              <span className="text-[10px] text-slate-500 block uppercase font-medium">Profit Factor</span>
              <span className="text-base font-bold font-mono text-slate-900">
                {backtestResult.profitFactor}
              </span>
              <span className="text-[10px] text-slate-500 block">Brüt Kâr/Zarar</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
              <span className="text-[10px] text-slate-500 block uppercase font-medium">Max Drawdown</span>
              <span className="text-base font-bold font-mono text-rose-600">
                %{backtestResult.maxDrawdownPercent}
              </span>
              <span className="text-[10px] text-slate-500 block font-mono">
                -${backtestResult.maxDrawdownUsdt}
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
              <span className="text-[10px] text-slate-500 block uppercase font-medium">Sharpe Oranı</span>
              <span className="text-base font-bold font-mono text-purple-700">
                {backtestResult.sharpeRatio}
              </span>
              <span className="text-[10px] text-slate-500 block">Risk Düzeltilmiş</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
              <span className="text-[10px] text-slate-500 block uppercase font-medium">Sortino Oranı</span>
              <span className="text-base font-bold font-mono text-indigo-700">
                {backtestResult.sortinoRatio}
              </span>
              <span className="text-[10px] text-slate-500 block">Düşüş Volatilitesi</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
              <span className="text-[10px] text-slate-500 block uppercase font-medium">Calmar Oranı</span>
              <span className="text-base font-bold font-mono text-emerald-600">
                {backtestResult.calmarRatio}
              </span>
              <span className="text-[10px] text-slate-500 block">Getiri / DD</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
              <span className="text-[10px] text-slate-500 block uppercase font-medium">Toplam İşlem</span>
              <span className="text-base font-bold font-mono text-slate-900">
                {backtestResult.totalTrades}
              </span>
              <span className="text-[10px] text-slate-500 block">
                Ort. {backtestResult.avgHoldingPeriodMinutes} Dk
              </span>
            </div>
          </div>

          {/* Equity History Chart */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Sermaye Eğrisi (Equity Curve & Cumulative Growth)
              </h4>
              <span className="text-[10px] text-slate-500 font-mono">
                {backtestResult.startDate} → {backtestResult.endDate}
              </span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={backtestResult.equityHistory}>
                  <defs>
                    <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="time"
                    tickFormatter={(time) => new Date(time).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
                    stroke="#94a3b8"
                    fontSize={10}
                  />
                  <YAxis
                    domain={['auto', 'auto']}
                    stroke="#94a3b8"
                    fontSize={10}
                    tickFormatter={(val) => `$${val}`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '11px', color: '#0f172a', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(val: any) => [`$${val}`, 'Kasa Değeri']}
                    labelFormatter={(label) => new Date(label).toLocaleString()}
                  />
                  <Area
                    type="monotone"
                    dataKey="equity"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#equityGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monte Carlo Simulation Breakdown */}
          {backtestResult.monteCarloSimulations && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                Monte Carlo Dayanıklılık & Risk Simülasyonu (100 Yeniden Örnekleme)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-500 text-[10px] block font-sans">Medyan Beklenen Getiri (%50)</span>
                  <span className="text-sm font-bold text-blue-700">%{backtestResult.monteCarloSimulations.medianReturn}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-500 text-[10px] block font-sans">En Kötü Senaryo (%5)</span>
                  <span className="text-sm font-bold text-rose-600">%{backtestResult.monteCarloSimulations.worstCaseReturn}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-500 text-[10px] block font-sans">En İyi Senaryo (%95)</span>
                  <span className="text-sm font-bold text-emerald-600">%{backtestResult.monteCarloSimulations.bestCaseReturn}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-500 text-[10px] block font-sans">İflas Riski (Risk of Ruin)</span>
                  <span className="text-sm font-bold text-slate-800">%{backtestResult.monteCarloSimulations.riskOfRuinPercent}</span>
                </div>
              </div>
            </div>
          )}

          {/* Trade-by-Trade Breakdown Table */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
              Backtest İşlem Listesi ({backtestResult.trades.length} İşlem)
            </h4>
            <div className="max-h-64 overflow-y-auto font-mono text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] text-slate-500 uppercase font-sans">
                    <th className="py-2 px-2">#</th>
                    <th className="py-2 px-2">Yön</th>
                    <th className="py-2 px-2">Giriş / Çıkış</th>
                    <th className="py-2 px-2">PnL ($)</th>
                    <th className="py-2 px-2">ROE %</th>
                    <th className="py-2 px-2">Çıkış Sebebi</th>
                    <th className="py-2 px-2 text-right">Tarih</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {backtestResult.trades.map((t, idx) => {
                    const isWin = t.pnl >= 0;
                    return (
                      <tr key={t.id || idx} className="hover:bg-slate-50">
                        <td className="py-2 px-2 text-slate-400">{idx + 1}</td>
                        <td className="py-2 px-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            t.side === 'LONG' ? 'text-emerald-700 bg-emerald-100' : 'text-rose-700 bg-rose-100'
                          }`}>
                            {t.side}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-slate-700">
                          ${t.entryPrice.toFixed(2)} → ${t.exitPrice.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 font-bold">
                          <span className={isWin ? 'text-emerald-600' : 'text-rose-600'}>
                            {isWin ? '+' : ''}${t.pnl.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-2 px-2 font-bold">
                          <span className={isWin ? 'text-emerald-600' : 'text-rose-600'}>
                            {isWin ? '+' : ''}{t.pnlPercent.toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-2 px-2 text-[10px] font-sans">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-medium">
                            {t.exitReason}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right text-[10px] text-slate-400">
                          {new Date(t.exitTime).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Stratejiyi İsimlendir ve Bota Ekle */}
      {deployModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Stratejiyi İsimlendir ve Bota Ekle</h3>
                  <p className="text-[11px] text-slate-300">Bot motorunun canlı taramasına yeni strateji kaydet</p>
                </div>
              </div>
              <button
                onClick={() => setDeployModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Backtest Score Card */}
              <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    Doğrulanmış Backtest Performansı
                  </span>
                  <span className="text-[10px] text-emerald-700 font-semibold font-mono">
                    {selectedSymbol} • {selectedTimeframe} (1000 Mum)
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="bg-white/80 p-1.5 rounded-lg border border-emerald-100 font-mono">
                    <span className="text-[10px] text-slate-500 block font-sans">Net Kâr</span>
                    <span className="font-bold text-emerald-600">
                      {deployModal.result.netProfit >= 0 ? '+' : ''}${deployModal.result.netProfit.toFixed(1)}
                    </span>
                  </div>
                  <div className="bg-white/80 p-1.5 rounded-lg border border-emerald-100 font-mono">
                    <span className="text-[10px] text-slate-500 block font-sans">Getiri</span>
                    <span className="font-bold text-emerald-600">
                      %{deployModal.result.totalReturnPercent}
                    </span>
                  </div>
                  <div className="bg-white/80 p-1.5 rounded-lg border border-emerald-100 font-mono">
                    <span className="text-[10px] text-slate-500 block font-sans">Kazanma</span>
                    <span className="font-bold text-blue-600">
                      %{deployModal.result.winRate}
                    </span>
                  </div>
                  <div className="bg-white/80 p-1.5 rounded-lg border border-emerald-100 font-mono">
                    <span className="text-[10px] text-slate-500 block font-sans">Max DD</span>
                    <span className="font-bold text-rose-600">
                      -%{deployModal.result.maxDrawdownPercent}
                    </span>
                  </div>
                </div>
              </div>

              {/* Form Fields */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Strateji İsmi (Bot Panelinde Görünecek İsim) *
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Örn: 1h BTC Quant Macro Trend (+%14.4 Kâr)"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    İşlem Paritesi (Symbol)
                  </label>
                  <select
                    value={customSymbol}
                    onChange={(e) => setCustomSymbol(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:bg-white focus:border-emerald-500 outline-none"
                  >
                    <option value="BTCUSDT">BTCUSDT (Bitcoin)</option>
                    <option value="ETHUSDT">ETHUSDT (Ethereum)</option>
                    <option value="SOLUSDT">SOLUSDT (Solana)</option>
                    <option value="BNBUSDT">BNBUSDT (BNB)</option>
                    <option value="XRPUSDT">XRPUSDT (Ripple)</option>
                    <option value="DOGEUSDT">DOGEUSDT (Dogecoin)</option>
                    <option value="AVAXUSDT">AVAXUSDT (Avalanche)</option>
                    <option value="LINKUSDT">LINKUSDT (Chainlink)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Zaman Dilimi (Timeframe)
                  </label>
                  <select
                    value={customTimeframe}
                    onChange={(e) => setCustomTimeframe(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:bg-white focus:border-emerald-500 outline-none"
                  >
                    <option value="15m">15 Dakika (15m)</option>
                    <option value="1h">1 Saat (1h - Önerilen)</option>
                    <option value="4h">4 Saat (4h - Swing)</option>
                    <option value="1d">1 Gün (1d - Macro)</option>
                  </select>
                </div>
              </div>

              {/* Direction Selector */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  İzin Verilen İşlem Yönü
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCustomDirection('LONG')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      customDirection === 'LONG'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Sadece Long (Alım)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomDirection('SHORT')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      customDirection === 'SHORT'
                        ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    Sadece Short (Satış)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomDirection('BOTH')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      customDirection === 'BOTH'
                        ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    Çift Yönlü (Both)
                  </button>
                </div>
              </div>

              {/* Description & Suitability */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Strateji Notu / Açıklama
                </label>
                <input
                  type="text"
                  value={customSuitability}
                  onChange={(e) => setCustomSuitability(e.target.value)}
                  placeholder="Neden bu stratejiyi seçtiniz? (Örn: Güçlü trend takibi ve düşük DD)"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-emerald-500 outline-none"
                />
              </div>

              {/* Auto Enable Toggle */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Botta Hemen Aktifleştir</span>
                  <span className="text-[11px] text-slate-500">
                    Kaydedildiğinde bot canlı ve kâğıt üzerinde sinyalleri hemen taramaya başlar.
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoEnable}
                    onChange={(e) => setAutoEnable(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeployModal(null)}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs transition"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleSaveAndDeploy}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center gap-2 active:scale-95"
              >
                <Bot className="w-4 h-4" />
                <span>Kaydet ve Bota Ekle</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
