import React, { useState } from 'react';
import { StrategyConfig, SignalResult, IndicatorValues } from '../types/trading';
import { StrategyLab } from './StrategyLab';
import { QUANT_STRATEGY_REGISTRY } from '../utils/quantStrategies';
import { QuantStrategyDefinition, QuantStrategyFamily } from '../types/quant';
import { 
  Zap, 
  Sliders, 
  Play, 
  Pause, 
  Plus, 
  ArrowUpRight, 
  ArrowDownRight, 
  Trash2, 
  Sparkles, 
  Check, 
  TrendingUp,
  TrendingDown,
  X,
  FlaskConical,
  Activity,
  Layers,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Cpu,
  BarChart3,
  Scale
} from 'lucide-react';

interface StrategyManagerProps {
  strategies: StrategyConfig[];
  onUpdateStrategies: (newStrategies: StrategyConfig[]) => void;
  latestSignals: SignalResult[];
  indicators: IndicatorValues;
  currentPrice: number;
}

const FAMILY_METADATA: Record<QuantStrategyFamily, { label: string; badgeColor: string; icon: string }> = {
  TREND_FOLLOWING: { label: 'Trend Takip (Trend Following)', badgeColor: 'bg-blue-50 text-blue-700 border-blue-200', icon: '📈' },
  MOMENTUM: { label: 'Zaman Serisi Momentum (TS-MOM)', badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: '⚡' },
  MEAN_REVERSION: { label: 'Ortalamaya Dönüş (Z-Score & RSI)', badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: '🔄' },
  BREAKOUT_VOLATILITY: { label: 'Volatilite & Sıkışma Kırılımı', badgeColor: 'bg-amber-50 text-amber-700 border-amber-200', icon: '💥' },
  REGIME_SWITCHING: { label: 'Rejim Değişim Adaptasyonu', badgeColor: 'bg-purple-50 text-purple-700 border-purple-200', icon: '🎛️' },
  MULTI_FACTOR_QUANT: { label: 'Çok Faktörlü Kantitatif Skor', badgeColor: 'bg-violet-50 text-violet-700 border-violet-200', icon: '🧬' },
};

export const StrategyManager: React.FC<StrategyManagerProps> = ({
  strategies,
  onUpdateStrategies,
  latestSignals,
  indicators,
  currentPrice
}) => {
  const [viewMode, setViewMode] = useState<'LAB' | 'LIVE_BOTS'>('LAB');
  const [activeFamilyFilter, setActiveFamilyFilter] = useState<string>('ALL');
  const [activeDirectionFilter, setActiveDirectionFilter] = useState<'ALL' | 'LONG' | 'SHORT' | 'BOTH'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Selected strategy to pass to StrategyLab when user clicks "Lab'da İncele"
  const [labInitialStrategyId, setLabInitialStrategyId] = useState<string | null>(null);

  // Modals state
  const [isAddBotModalOpen, setIsAddBotModalOpen] = useState<boolean>(false);
  const [selectedRegistryStrat, setSelectedRegistryStrat] = useState<QuantStrategyDefinition>(QUANT_STRATEGY_REGISTRY[0]);
  const [editingBot, setEditingBot] = useState<StrategyConfig | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deploymentSuccessMessage, setDeploymentSuccessMessage] = useState<string | null>(null);

  // New Bot Form State
  const [newBotSymbol, setNewBotSymbol] = useState<string>('BTCUSDT');
  const [newBotTimeframe, setNewBotTimeframe] = useState<string>('1h');
  const [newBotDirection, setNewBotDirection] = useState<'LONG' | 'SHORT' | 'BOTH'>('BOTH');
  const [newBotParams, setNewBotParams] = useState<Record<string, any>>({});

  // Toggle Bot Enable/Disable
  const toggleStrategy = (id: string) => {
    const updated = strategies.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s);
    onUpdateStrategies(updated);
  };

  // Deploy from Quant Lab
  const handleDeployFromLab = (quantStrat: QuantStrategyDefinition) => {
    const existingIndex = strategies.findIndex(s => s.quantStrategyId === quantStrat.id || s.id === quantStrat.id);
    
    const botConfig: StrategyConfig = {
      id: quantStrat.id,
      quantStrategyId: quantStrat.id,
      name: quantStrat.name,
      type: quantStrat.family as any,
      family: quantStrat.family,
      direction: quantStrat.direction,
      enabled: true,
      symbol: quantStrat.defaultSymbol || 'BTCUSDT',
      timeframe: quantStrat.timeframe || '1h',
      isDefault: true,
      version: quantStrat.version,
      hypothesis: quantStrat.hypothesis,
      mathematicalFormula: quantStrat.mathematicalFormula,
      economicRationale: quantStrat.economicRationale,
      marketCondition: quantStrat.expectedRegime,
      suitability: quantStrat.economicRationale,
      parameters: { ...quantStrat.parameters },
      parameterBounds: quantStrat.parameterBounds,
      tags: [...quantStrat.tags],
      description: quantStrat.hypothesis
    };

    let updatedList: StrategyConfig[];
    if (existingIndex >= 0) {
      updatedList = [...strategies];
      updatedList[existingIndex] = { ...botConfig, enabled: true };
    } else {
      updatedList = [botConfig, ...strategies];
    }

    onUpdateStrategies(updatedList);
    setViewMode('LIVE_BOTS');
    setDeploymentSuccessMessage(`🚀 "${quantStrat.name}" başarıyla aktif trading botlarına eklendi ve başlatıldı!`);
    setTimeout(() => setDeploymentSuccessMessage(null), 4000);
  };

  // Add new bot from Registry Modal
  const handleAddRegistryBot = () => {
    const uniqueId = `bot-${selectedRegistryStrat.id}-${Date.now().toString().slice(-4)}`;
    const newConfig: StrategyConfig = {
      id: uniqueId,
      quantStrategyId: selectedRegistryStrat.id,
      name: `${selectedRegistryStrat.name} (${newBotSymbol} ${newBotTimeframe})`,
      type: selectedRegistryStrat.family as any,
      family: selectedRegistryStrat.family,
      direction: newBotDirection,
      enabled: true,
      symbol: newBotSymbol.toUpperCase(),
      timeframe: newBotTimeframe,
      isDefault: false,
      version: selectedRegistryStrat.version,
      hypothesis: selectedRegistryStrat.hypothesis,
      mathematicalFormula: selectedRegistryStrat.mathematicalFormula,
      economicRationale: selectedRegistryStrat.economicRationale,
      marketCondition: selectedRegistryStrat.expectedRegime,
      suitability: selectedRegistryStrat.economicRationale,
      parameters: { ...selectedRegistryStrat.parameters, ...newBotParams },
      parameterBounds: selectedRegistryStrat.parameterBounds,
      tags: [...selectedRegistryStrat.tags],
      description: selectedRegistryStrat.hypothesis
    };

    onUpdateStrategies([newConfig, ...strategies]);
    setIsAddBotModalOpen(false);
    setDeploymentSuccessMessage(`✅ "${newConfig.name}" bot filonuza başarıyla eklendi!`);
    setTimeout(() => setDeploymentSuccessMessage(null), 3500);
  };

  // Save Bot Parameter Edits
  const handleSaveBotEdits = (updatedBot: StrategyConfig) => {
    const updated = strategies.map(s => s.id === updatedBot.id ? updatedBot : s);
    onUpdateStrategies(updated);
    setEditingBot(null);
    setDeploymentSuccessMessage(`💾 "${updatedBot.name}" parametreleri güncellendi.`);
    setTimeout(() => setDeploymentSuccessMessage(null), 3000);
  };

  // Delete Bot
  const handleDeleteBot = (id: string) => {
    const updated = strategies.filter(s => s.id !== id);
    onUpdateStrategies(updated);
    setDeleteConfirmId(null);
  };

  // Open Lab with specific strategy
  const handleOpenInLab = (quantStrategyId?: string) => {
    if (quantStrategyId) {
      setLabInitialStrategyId(quantStrategyId);
    }
    setViewMode('LAB');
  };

  // Filtered Strategies for Live Bots tab
  const filteredBots = strategies.filter(s => {
    // Family filter
    if (activeFamilyFilter !== 'ALL' && s.family !== activeFamilyFilter) return false;
    // Direction filter
    if (activeDirectionFilter !== 'ALL') {
      if (activeDirectionFilter === 'LONG' && s.direction !== 'LONG' && s.direction !== 'BOTH') return false;
      if (activeDirectionFilter === 'SHORT' && s.direction !== 'SHORT' && s.direction !== 'BOTH') return false;
      if (activeDirectionFilter === 'BOTH' && s.direction !== 'BOTH') return false;
    }
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = s.name.toLowerCase().includes(q);
      const matchSymbol = s.symbol.toLowerCase().includes(q);
      const matchFormula = (s.mathematicalFormula || '').toLowerCase().includes(q);
      const matchHypothesis = (s.hypothesis || '').toLowerCase().includes(q);
      if (!matchName && !matchSymbol && !matchFormula && !matchHypothesis) return false;
    }
    return true;
  });

  const activeBotsCount = strategies.filter(s => s.enabled).length;
  const longBotsCount = strategies.filter(s => s.direction === 'LONG' || s.direction === 'BOTH').length;
  const shortBotsCount = strategies.filter(s => s.direction === 'SHORT' || s.direction === 'BOTH').length;

  return (
    <div className="space-y-4 text-slate-800">
      {/* Top Main Mode Switcher: Quant Research Lab vs Live Active Bots */}
      <div className="bg-white border border-slate-200 rounded-xl p-2 shadow-xs flex flex-col sm:flex-row items-center gap-2">
        <button
          onClick={() => setViewMode('LAB')}
          className={`flex-1 w-full py-2.5 px-4 rounded-lg font-extrabold text-xs transition flex items-center justify-center gap-2 ${
            viewMode === 'LAB'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <FlaskConical className="w-4 h-4 text-blue-400" />
          <span>🔬 KANTİTATİF ARAŞTIRMA LABORATUVARI (QUANT RESEARCH LAB)</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-600 text-white font-mono">
            8 Modül & OOS
          </span>
        </button>

        <button
          onClick={() => setViewMode('LIVE_BOTS')}
          className={`flex-1 w-full py-2.5 px-4 rounded-lg font-extrabold text-xs transition flex items-center justify-center gap-2 ${
            viewMode === 'LIVE_BOTS'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Activity className="w-4 h-4 text-emerald-400" />
          <span>⚡ AKTİF KANTİTATİF BOTLAR & CANLI SİNYALLER</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600 text-white font-mono">
            {activeBotsCount} / {strategies.length} Çalışıyor
          </span>
        </button>
      </div>

      {/* Deployment Notification Banner */}
      {deploymentSuccessMessage && (
        <div className="p-3.5 bg-emerald-600 text-white rounded-xl shadow-md flex items-center justify-between text-xs font-bold animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{deploymentSuccessMessage}</span>
          </div>
          <button onClick={() => setDeploymentSuccessMessage(null)} className="p-1 hover:bg-emerald-700 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 1: QUANTITATIVE RESEARCH LAB */}
      {/* ========================================================================= */}
      {viewMode === 'LAB' ? (
        <StrategyLab
          currentPrice={currentPrice}
          indicators={indicators}
          latestSignals={latestSignals}
          onDeployToPaper={handleDeployFromLab}
        />
      ) : (
        /* ========================================================================= */
        /* VIEW 2: ACTIVE QUANT TRADING BOTS & LIVE SIGNALS */
        /* ========================================================================= */
        <div className="space-y-4">
          
          {/* Header Stats Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-blue-600" />
                  <h3 className="text-base font-extrabold text-slate-900">
                    Kantitatif Algoritmik Trading Bot Filosu
                  </h3>
                  <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[10px] font-bold font-mono">
                    Zero-Lookahead Engine
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                  Laboratuvarda istatistiksel testlerden geçen, overfitting riskine karşı Out-of-Sample ve Walk-Forward ile doğrulanmış kurumsal modeller canlı veya simülasyon (paper) ortamında anlık sinyal üretir ve otomatik emir yürütür.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    setSelectedRegistryStrat(QUANT_STRATEGY_REGISTRY[0]);
                    setNewBotSymbol('BTCUSDT');
                    setNewBotTimeframe('1h');
                    setNewBotDirection('BOTH');
                    setNewBotParams({ ...QUANT_STRATEGY_REGISTRY[0].parameters });
                    setIsAddBotModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Laboratuvardan Bot Ekle</span>
                </button>

                <button
                  onClick={() => setViewMode('LAB')}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
                >
                  <FlaskConical className="w-3.5 h-3.5 text-blue-600" />
                  <span>Lab'a Git</span>
                </button>
              </div>
            </div>

            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Toplam Bot</span>
                <span className="text-lg font-black font-mono text-slate-900">{strategies.length}</span>
              </div>
              <div className="p-3 bg-emerald-50/70 rounded-lg border border-emerald-200">
                <span className="text-[10px] uppercase font-bold text-emerald-700 block mb-0.5">Aktif Çalışan</span>
                <span className="text-lg font-black font-mono text-emerald-800">{activeBotsCount} Bot</span>
              </div>
              <div className="p-3 bg-blue-50/70 rounded-lg border border-blue-200">
                <span className="text-[10px] uppercase font-bold text-blue-700 block mb-0.5">Long Yetkili</span>
                <span className="text-lg font-black font-mono text-blue-800">{longBotsCount} Bot</span>
              </div>
              <div className="p-3 bg-rose-50/70 rounded-lg border border-rose-200">
                <span className="text-[10px] uppercase font-bold text-rose-700 block mb-0.5">Short Yetkili</span>
                <span className="text-lg font-black font-mono text-rose-800">{shortBotsCount} Bot</span>
              </div>
            </div>
          </div>

          {/* Real-time Quantitative Signals Ribbon */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                  Canlı Kantitatif Sinyal Monitörü
                </h3>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                {latestSignals.length} Sinyal Yakalandı
              </span>
            </div>

            {latestSignals.length === 0 ? (
              <div className="py-5 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
                Piyasa taranıyor... Aktif Long veya Short kantitatif stratejilerinin matematiksel koşulları sağlandığında canlı sinyaller anlık olarak burada görüntülenecektir.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {latestSignals.slice(0, 4).map((sig, idx) => {
                  const isBuy = sig.type === 'BUY';
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border flex flex-col justify-between ${
                        isBuy ? 'bg-emerald-50/60 border-emerald-200' : 'bg-rose-50/60 border-rose-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-xs">
                          {isBuy ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 flex items-center gap-1 font-bold">
                              <ArrowUpRight className="w-3.5 h-3.5" />
                              AL (LONG SİNYALİ)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 flex items-center gap-1 font-bold">
                              <ArrowDownRight className="w-3.5 h-3.5" />
                              SAT (SHORT SİNYALİ)
                            </span>
                          )}
                          <span className="text-slate-900">{sig.symbol}</span>
                          <span className="text-[10px] text-slate-500 font-mono">({sig.timeframe})</span>
                        </div>
                        <span className="text-xs font-mono font-bold text-blue-700">
                          Güven: %{sig.confidence}
                        </span>
                      </div>

                      <div className="my-2 text-[11px] text-slate-700 space-y-1">
                        {sig.reasons.map((r, i) => (
                          <p key={i} className="flex items-start gap-1">
                            <span className="text-blue-600 font-bold">•</span>
                            <span>{r}</span>
                          </p>
                        ))}
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-200">
                        <span>Önerilen SL: <strong className="text-rose-600">${sig.suggestedStopLoss?.toFixed(2) || '-'}</strong></span>
                        <span>Önerilen TP: <strong className="text-emerald-600">${sig.suggestedTakeProfit?.toFixed(2) || '-'}</strong></span>
                        <span>{new Date(sig.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Filter Toolbar */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Bot adı, formül, hipotez veya sembol ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:bg-white focus:border-blue-500 outline-none"
                />
              </div>

              {/* Direction Filter */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs font-bold">
                <button
                  onClick={() => setActiveDirectionFilter('ALL')}
                  className={`px-2.5 py-1 rounded transition ${activeDirectionFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Tüm Yönler
                </button>
                <button
                  onClick={() => setActiveDirectionFilter('LONG')}
                  className={`px-2.5 py-1 rounded transition flex items-center gap-1 ${activeDirectionFilter === 'LONG' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600 hover:text-emerald-700'}`}
                >
                  <TrendingUp className="w-3 h-3" />
                  <span>Long</span>
                </button>
                <button
                  onClick={() => setActiveDirectionFilter('SHORT')}
                  className={`px-2.5 py-1 rounded transition flex items-center gap-1 ${activeDirectionFilter === 'SHORT' ? 'bg-rose-600 text-white shadow-2xs' : 'text-slate-600 hover:text-rose-700'}`}
                >
                  <TrendingDown className="w-3 h-3" />
                  <span>Short</span>
                </button>
                <button
                  onClick={() => setActiveDirectionFilter('BOTH')}
                  className={`px-2.5 py-1 rounded transition flex items-center gap-1 ${activeDirectionFilter === 'BOTH' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-blue-700'}`}
                >
                  <Scale className="w-3 h-3" />
                  <span>Çift Yönlü</span>
                </button>
              </div>
            </div>

            {/* Family Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <button
                onClick={() => setActiveFamilyFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition ${
                  activeFamilyFilter === 'ALL'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Tüm Aileler ({strategies.length})
              </button>
              {(Object.keys(FAMILY_METADATA) as QuantStrategyFamily[]).map(fam => {
                const count = strategies.filter(s => s.family === fam).length;
                return (
                  <button
                    key={fam}
                    onClick={() => setActiveFamilyFilter(fam)}
                    className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition flex items-center gap-1.5 ${
                      activeFamilyFilter === fam
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>{FAMILY_METADATA[fam].icon}</span>
                    <span>{FAMILY_METADATA[fam].label.split('(')[0]}</span>
                    <span className="text-[10px] opacity-75 font-mono">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Bots Grid */}
          {filteredBots.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Cpu className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">Filtreye Uygun Bot Bulunamadı</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Seçtiğiniz filtreleme kriterlerine uygun bot bulunamadı. Filtreleri temizleyebilir veya Quant Lab'dan yeni bir bot ekleyebilirsiniz.
              </p>
              <button
                onClick={() => {
                  setActiveFamilyFilter('ALL');
                  setActiveDirectionFilter('ALL');
                  setSearchQuery('');
                }}
                className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold"
              >
                Filtreleri Sıfırla
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredBots.map((strat) => {
                const famMeta = strat.family && FAMILY_METADATA[strat.family as QuantStrategyFamily]
                  ? FAMILY_METADATA[strat.family as QuantStrategyFamily]
                  : FAMILY_METADATA.TREND_FOLLOWING;

                const liveSignal = latestSignals.find(s => s.strategyName === strat.name);

                return (
                  <div
                    key={strat.id}
                    className={`bg-white border rounded-xl p-4 transition shadow-xs flex flex-col justify-between ${
                      strat.enabled
                        ? 'border-blue-500/80 ring-1 ring-blue-500/20'
                        : 'border-slate-200 opacity-90 hover:opacity-100'
                    }`}
                  >
                    <div>
                      {/* Top Header: Family, Direction & Power Switch */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold border ${famMeta.badgeColor}`}>
                            {famMeta.icon} {famMeta.label.split('(')[0]}
                          </span>

                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold font-mono ${
                            strat.direction === 'LONG'
                              ? 'bg-emerald-100 text-emerald-800'
                              : strat.direction === 'SHORT'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {strat.direction === 'LONG' ? '🟢 LONG' : strat.direction === 'SHORT' ? '🔴 SHORT' : '⚖️ BOTH'}
                          </span>

                          {strat.version && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono">
                              v{strat.version}
                            </span>
                          )}
                        </div>

                        {/* Power Toggle Button */}
                        <button
                          onClick={() => toggleStrategy(strat.id)}
                          className={`p-2 rounded-lg transition flex-shrink-0 ${
                            strat.enabled
                              ? 'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                          title={strat.enabled ? 'Botu Duraklat' : 'Botu Başlat'}
                        >
                          {strat.enabled ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      {/* Bot Title */}
                      <h4 className="font-extrabold text-slate-900 text-sm mb-1 leading-snug">
                        {strat.name}
                      </h4>

                      {/* Symbol & Timeframe badge */}
                      <div className="flex items-center gap-2 text-xs font-mono mb-2">
                        <span className="font-bold text-slate-800">{strat.symbol}</span>
                        <span className="text-slate-300">•</span>
                        <span className="text-blue-700 font-bold">{strat.timeframe}</span>
                        <span className="text-slate-300">•</span>
                        <span className="text-slate-500 text-[11px] font-sans">Hedef: {strat.marketCondition || 'Trend'}</span>
                      </div>

                      {/* Mathematical Formula Preview Box */}
                      {strat.mathematicalFormula && (
                        <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg mb-2 text-[11px] font-mono text-slate-800 font-semibold line-clamp-2">
                          <code className="text-blue-900">{strat.mathematicalFormula}</code>
                        </div>
                      )}

                      {/* Hypothesis preview */}
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-3">
                        {strat.hypothesis || strat.description}
                      </p>

                      {/* Live Signal Status if any */}
                      {liveSignal && (
                        <div className={`p-2 rounded-lg border text-xs mb-3 flex items-center justify-between ${
                          liveSignal.type === 'BUY'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-950 font-bold'
                            : liveSignal.type === 'SELL'
                            ? 'bg-rose-50 border-rose-200 text-rose-950 font-bold'
                            : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}>
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-current animate-ping" />
                            <span>Son Sinyal: {liveSignal.type === 'BUY' ? 'AL' : liveSignal.type === 'SELL' ? 'SAT' : 'NÖTR'}</span>
                          </div>
                          <span className="font-mono text-[11px]">Güven: %{liveSignal.confidence}</span>
                        </div>
                      )}

                      {/* Parameters Summary */}
                      {strat.parameters && Object.keys(strat.parameters).length > 0 && (
                        <div className="p-2 bg-slate-50/80 rounded-lg border border-slate-200/80 text-[11px] font-mono grid grid-cols-2 gap-1.5 mb-3">
                          {Object.entries(strat.parameters).slice(0, 4).map(([key, val]) => (
                            <div key={key} className="truncate">
                              <span className="text-slate-400 capitalize">{key}: </span>
                              <strong className="text-slate-800">{String(val)}</strong>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Card Actions Footer */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${strat.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                        <span className="text-[11px] font-medium text-slate-600">
                          {strat.enabled ? 'Bot Aktif (Çalışıyor)' : 'Duraklatıldı'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Open in Lab for testing */}
                        <button
                          onClick={() => handleOpenInLab(strat.quantStrategyId || strat.id)}
                          className="px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition flex items-center gap-1"
                          title="Kantitatif Lab'da OOS & Walk-Forward Testi Yap"
                        >
                          <FlaskConical className="w-3 h-3" />
                          <span>Lab Testi</span>
                        </button>

                        {/* Edit Parameters */}
                        <button
                          onClick={() => setEditingBot({ ...strat })}
                          className="p-1.5 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
                          title="Parametreleri Düzenle"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Bot */}
                        <button
                          onClick={() => setDeleteConfirmId(strat.id)}
                          className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          title="Botu Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODAL 1: ADD NEW BOT FROM QUANTITATIVE LAB REGISTRY */}
          {/* ========================================================================= */}
          {isAddBotModalOpen && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
              <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-5 shadow-xl space-y-4 max-h-[92vh] overflow-y-auto animate-in fade-in">
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                      <Plus className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900">
                        Kantitatif Laboratuvardan Yeni Bot Ekle
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Test edilmiş ve kurumsal standartlarda modellenmiş kantitatif stratejiyi seçip canlı/paper botu olarak başlatın.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsAddBotModalOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Strategy Catalog Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-800 block">
                    1. Kantitatif Strateji Şablonu Seçin ({QUANT_STRATEGY_REGISTRY.length} Kurumsal Model)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                    {QUANT_STRATEGY_REGISTRY.map((qs) => {
                      const isSelected = selectedRegistryStrat.id === qs.id;
                      return (
                        <button
                          key={qs.id}
                          type="button"
                          onClick={() => {
                            setSelectedRegistryStrat(qs);
                            setNewBotDirection(qs.direction);
                            setNewBotParams({ ...qs.parameters });
                          }}
                          className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                            isSelected
                              ? 'bg-blue-50/80 border-blue-600 ring-2 ring-blue-500/20'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                                {qs.family}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">v{qs.version}</span>
                            </div>
                            <h5 className="font-extrabold text-xs text-slate-900 leading-tight mb-1">
                              {qs.name}
                            </h5>
                            <p className="text-[10px] text-slate-500 line-clamp-2 leading-tight">
                              {qs.hypothesis}
                            </p>
                          </div>
                          <div className="mt-2 pt-1 border-t border-slate-100 text-[10px] text-blue-700 font-bold flex items-center justify-between">
                            <span>Hedef: {qs.expectedRegime}</span>
                            <span>{isSelected ? '✓ Seçildi' : 'Seç →'}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selected Strategy Details Box */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{selectedRegistryStrat.name}</span>
                    <span className="text-[10px] font-mono text-blue-700 font-bold">Matematiksel Formül</span>
                  </div>
                  <code className="text-[11px] font-mono text-blue-950 font-semibold block bg-white p-2 rounded border border-slate-200 leading-tight">
                    {selectedRegistryStrat.mathematicalFormula}
                  </code>
                </div>

                {/* Target Trading Configurations */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="text-slate-600 block mb-1 font-medium">İşlem Sembolü</label>
                    <input
                      type="text"
                      value={newBotSymbol}
                      onChange={(e) => setNewBotSymbol(e.target.value.toUpperCase())}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-mono font-bold focus:bg-white focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 block mb-1 font-medium">Zaman Dilimi</label>
                    <select
                      value={newBotTimeframe}
                      onChange={(e) => setNewBotTimeframe(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:bg-white focus:border-blue-500 outline-none font-bold"
                    >
                      {['1m', '5m', '15m', '1h', '4h', '1d'].map(tf => (
                        <option key={tf} value={tf}>{tf}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-600 block mb-1 font-medium">İşlem Yönü</label>
                    <select
                      value={newBotDirection}
                      onChange={(e) => setNewBotDirection(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:bg-white focus:border-blue-500 outline-none font-bold"
                    >
                      <option value="BOTH">⚖️ Long & Short (Çift Yönlü)</option>
                      <option value="LONG">🟢 Sadece Long (Alış/Dip)</option>
                      <option value="SHORT">🔴 Sadece Short (Satış/Tepe)</option>
                    </select>
                  </div>
                </div>

                {/* Dynamic Parameters for the selected Strategy */}
                {selectedRegistryStrat.parameterBounds && (
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <Sliders className="w-3.5 h-3.5 text-blue-600" />
                      <span>Kantitatif Model Parametreleri</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {Object.entries(selectedRegistryStrat.parameterBounds).map(([paramKey, rawBounds]) => {
                        const bounds = rawBounds as { min: number; max: number; step: number; default: number; label?: string };
                        const currentVal = newBotParams[paramKey] !== undefined ? newBotParams[paramKey] : bounds.default;
                        return (
                          <div key={paramKey} className="p-2.5 bg-white rounded-lg border border-slate-200">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-semibold text-slate-700">{bounds.label || paramKey}</span>
                              <span className="font-mono font-bold text-blue-700">{currentVal}</span>
                            </div>
                            <input
                              type="range"
                              min={bounds.min}
                              max={bounds.max}
                              step={bounds.step}
                              value={currentVal}
                              onChange={(e) => setNewBotParams({
                                ...newBotParams,
                                [paramKey]: parseFloat(e.target.value)
                              })}
                              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                            <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-0.5">
                              <span>Min: {bounds.min}</span>
                              <span>Max: {bounds.max}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Modal Footer */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsAddBotModalOpen(false)}
                    className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="button"
                    onClick={handleAddRegistryBot}
                    className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Bot Olarak Başlat ve Ekle</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODAL 2: EDIT EXISTING BOT PARAMETERS */}
          {/* ========================================================================= */}
          {editingBot && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
              <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-5 shadow-xl space-y-4 max-h-[92vh] overflow-y-auto animate-in fade-in">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                      <Sliders className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900">
                        Bot Parametrelerini Düzenle: {editingBot.name}
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Modelin çalışma frekansı, sembolü, yönü ve matematiksel parametrelerini güncelleyin.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setEditingBot(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-slate-600 block mb-1 font-medium">Bot Adı</label>
                    <input
                      type="text"
                      value={editingBot.name}
                      onChange={(e) => setEditingBot({ ...editingBot, name: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-bold focus:bg-white focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-slate-600 block mb-1 font-medium">Sembol</label>
                      <input
                        type="text"
                        value={editingBot.symbol}
                        onChange={(e) => setEditingBot({ ...editingBot, symbol: e.target.value.toUpperCase() })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-mono font-bold focus:bg-white focus:border-blue-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-slate-600 block mb-1 font-medium">Zaman Dilimi</label>
                      <select
                        value={editingBot.timeframe}
                        onChange={(e) => setEditingBot({ ...editingBot, timeframe: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:bg-white focus:border-blue-500 outline-none font-bold"
                      >
                        {['1m', '5m', '15m', '1h', '4h', '1d'].map(tf => (
                          <option key={tf} value={tf}>{tf}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-600 block mb-1 font-medium">İşlem Yönü</label>
                      <select
                        value={editingBot.direction || 'BOTH'}
                        onChange={(e) => setEditingBot({ ...editingBot, direction: e.target.value as any })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:bg-white focus:border-blue-500 outline-none font-bold"
                      >
                        <option value="BOTH">⚖️ Long & Short (Çift Yönlü)</option>
                        <option value="LONG">🟢 Sadece Long</option>
                        <option value="SHORT">🔴 Sadece Short</option>
                      </select>
                    </div>
                  </div>

                  {/* Mathematical Parameters */}
                  {editingBot.parameters && Object.keys(editingBot.parameters).length > 0 && (
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                        <Sliders className="w-3.5 h-3.5 text-blue-600" />
                        <span>Parametre Değerleri</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        {Object.entries(editingBot.parameters).map(([key, val]) => {
                          const bounds = editingBot.parameterBounds?.[key];
                          return (
                            <div key={key} className="p-2.5 bg-white rounded-lg border border-slate-200">
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-semibold text-slate-700">{bounds?.label || key}</span>
                                <span className="font-mono font-bold text-blue-700">{val}</span>
                              </div>
                              {bounds ? (
                                <>
                                  <input
                                    type="range"
                                    min={bounds.min}
                                    max={bounds.max}
                                    step={bounds.step}
                                    value={Number(val)}
                                    onChange={(e) => setEditingBot({
                                      ...editingBot,
                                      parameters: {
                                        ...editingBot.parameters,
                                        [key]: parseFloat(e.target.value)
                                      }
                                    })}
                                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                  />
                                  <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-0.5">
                                    <span>Min: {bounds.min}</span>
                                    <span>Max: {bounds.max}</span>
                                  </div>
                                </>
                              ) : (
                                <input
                                  type="text"
                                  value={String(val)}
                                  onChange={(e) => setEditingBot({
                                    ...editingBot,
                                    parameters: {
                                      ...editingBot.parameters,
                                      [key]: isNaN(Number(e.target.value)) ? e.target.value : parseFloat(e.target.value)
                                    }
                                  })}
                                  className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 font-mono text-slate-900"
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setEditingBot(null)}
                    className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveBotEdits(editingBot)}
                    className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs"
                  >
                    Değişiklikleri Kaydet
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODAL 3: DELETE CONFIRMATION */}
          {/* ========================================================================= */}
          {deleteConfirmId && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
              <div className="bg-white border border-slate-200 rounded-xl max-w-sm w-full p-5 shadow-xl space-y-4 animate-in fade-in">
                <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
                  <Trash2 className="w-4 h-4" />
                  <span>Botu Sil</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Bu trading botunu listeden silmek istediğinizden emin misiniz? İstediğiniz zaman Laboratuvardan tekrar ekleyebilirsiniz.
                </p>
                <div className="flex gap-2 pt-2 border-t border-slate-200">
                  <button
                    onClick={() => handleDeleteBot(deleteConfirmId)}
                    className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs transition"
                  >
                    Evet, Sil
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                  >
                    Vazgeç
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};
