import React from 'react';
import { RiskSettings } from '../types/trading';
import { Shield, AlertTriangle, Lock, Activity, Sliders, CheckCircle2, DollarSign, Crosshair, ArrowRight } from 'lucide-react';

interface RiskManagerProps {
  riskSettings: RiskSettings;
  onUpdateRiskSettings: (settings: RiskSettings) => void;
  paperBalance: number;
  dailyLossCurrent: number;
  openPositionsCount: number;
}

export const RiskManager: React.FC<RiskManagerProps> = ({
  riskSettings,
  onUpdateRiskSettings,
  paperBalance,
  dailyLossCurrent,
  openPositionsCount
}) => {
  const handleChange = <K extends keyof RiskSettings>(key: K, value: RiskSettings[K]) => {
    onUpdateRiskSettings({
      ...riskSettings,
      [key]: value
    });
  };

  const dailyLossPercent = (dailyLossCurrent / (riskSettings.dailyLossLimitUsdt || 1)) * 100;

  return (
    <div className="space-y-4 text-slate-800">
      {/* Top Risk KPI Meters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Daily Loss Gauge */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Günlük Zarar Limiti</span>
            <AlertTriangle className={`w-4 h-4 ${dailyLossCurrent > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold font-mono text-slate-900">${dailyLossCurrent.toFixed(2)}</span>
            <span className="text-xs font-mono text-slate-500">Limit: ${riskSettings.dailyLossLimitUsdt}</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
            <div
              className={`h-full transition-all ${
                dailyLossPercent > 80 ? 'bg-rose-500' : dailyLossPercent > 50 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, dailyLossPercent)}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-500 mt-1.5 block">
            {dailyLossPercent >= 100 ? '🚨 Limit aşıldı! Bot kilitlendi.' : `Kalan tampon: $${Math.max(0, riskSettings.dailyLossLimitUsdt - dailyLossCurrent).toFixed(2)}`}
          </span>
        </div>

        {/* Max Drawdown Protection */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Maksimum Drawdown</span>
            <Shield className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold font-mono text-slate-900">%{riskSettings.maxDrawdownPercent}</span>
            <span className="text-xs font-mono text-slate-500">
              Maks: ${(paperBalance * (riskSettings.maxDrawdownPercent / 100)).toFixed(0)} USDT
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
            Sermaye kaybı bu eşiğe ulaştığında tüm algoritmalar otomatik durdurulur.
          </p>
        </div>

        {/* Concurrent Exposure & Leverage Limit */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Açık Pozisyon Limiti</span>
            <Activity className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold font-mono text-slate-900">{openPositionsCount} / {riskSettings.maxOpenPositions}</span>
            <span className="text-xs font-mono text-blue-600 font-bold">Maks: {riskSettings.maxLeverage}x Kaldıraç</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
            Aynı anda açılabilecek maksimum pozisyon sayısı ve kaldıraç tavanı.
          </p>
        </div>
      </div>

      {/* Detailed Risk Configuration Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-5">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
          <Sliders className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Risk ve Kasa Yönetimi Parametreleri</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
          {/* Section 1: Pre-Trade Sizing Rules */}
          <div className="space-y-3.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h4 className="font-bold text-xs flex items-center gap-1.5 text-blue-700">
              <span>1. Pozisyon Büyüklüğü ve Kasa Kuralları (Position Sizing)</span>
            </h4>

            <div>
              <label className="text-slate-600 block mb-1">Pozisyon Hesaplama Modeli</label>
              <select
                value={riskSettings.positionSizingMode}
                onChange={(e) => handleChange('positionSizingMode', e.target.value as any)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-semibold focus:border-blue-500 outline-none"
              >
                <option value="PERCENT_PORTFOLIO">Kasa Yüzdesi Bazlı (% of Portfolio)</option>
                <option value="FIXED_AMOUNT">Sabit Dolar Tutarı (Fixed USDT)</option>
                <option value="ATR_VOLATILITY">Oynaklık / ATR Bazlı Boyutlandırma (ATR Sizing)</option>
                <option value="KELLY">Kelly Kriteri Modeli (Optimizasyon)</option>
              </select>
            </div>

            {riskSettings.positionSizingMode === 'PERCENT_PORTFOLIO' && (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-600 font-semibold">Her İşlem İçin Kasa Yüzdesi:</span>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500 font-mono">%</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      step="1"
                      value={riskSettings.percentPortfolio}
                      onChange={(e) => handleChange('percentPortfolio', Math.min(100, Math.max(1, parseFloat(e.target.value) || 1)))}
                      className="w-16 px-2 py-0.5 text-right font-bold text-slate-900 font-mono bg-white border border-slate-300 rounded focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  step="1"
                  value={riskSettings.percentPortfolio}
                  onChange={(e) => handleChange('percentPortfolio', parseFloat(e.target.value))}
                  className="w-full accent-blue-600"
                />
                <div className="flex items-center justify-between gap-1 text-[10px]">
                  {[10, 25, 50, 80, 100].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => handleChange('percentPortfolio', pct)}
                      className={`flex-1 py-1 rounded border font-mono font-bold transition ${
                        riskSettings.percentPortfolio === pct
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      %{pct}
                    </button>
                  ))}
                </div>
                <span className="text-[10px] text-slate-500 block">
                  Bot sinyal aldığında mevcut bakiyenin <b>%{riskSettings.percentPortfolio}</b> kadarıyla (≈ ${(paperBalance * (riskSettings.percentPortfolio / 100)).toFixed(2)}) işleme girer.
                </span>
              </div>
            )}

            {riskSettings.positionSizingMode === 'FIXED_AMOUNT' && (
              <div>
                <label className="text-slate-600 block mb-1">Sabit İşlem Tutarı (USDT)</label>
                <input
                  type="number"
                  value={riskSettings.fixedAmountUsdt}
                  onChange={(e) => handleChange('fixedAmountUsdt', parseFloat(e.target.value) || 50)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-900 font-mono focus:border-blue-500 outline-none"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-slate-600 block mb-1">Günlük Zarar Limiti ($)</label>
                <input
                  type="number"
                  value={riskSettings.dailyLossLimitUsdt}
                  onChange={(e) => handleChange('dailyLossLimitUsdt', parseFloat(e.target.value) || 100)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-900 font-mono focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="text-slate-600 block mb-1">Maksimum Açık Pozisyon</label>
                <input
                  type="number"
                  value={riskSettings.maxOpenPositions}
                  onChange={(e) => handleChange('maxOpenPositions', parseInt(e.target.value) || 1)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-900 font-mono focus:border-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: In-Trade Exit & Trailing Rules */}
          <div className="space-y-3.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h4 className="font-bold text-xs flex items-center gap-1.5 text-blue-700">
              <span>2. Pozisyon İçi Koruma ve Çıkış Kuralları (In-Trade Protection)</span>
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-600 block mb-1">Varsayılan Stop-Loss (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={riskSettings.defaultStopLossPercent}
                  onChange={(e) => handleChange('defaultStopLossPercent', parseFloat(e.target.value) || 1.0)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-rose-600 font-bold font-mono focus:border-rose-500 outline-none"
                />
              </div>
              <div>
                <label className="text-slate-600 block mb-1">Varsayılan Take-Profit (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={riskSettings.defaultTakeProfitPercent}
                  onChange={(e) => handleChange('defaultTakeProfitPercent', parseFloat(e.target.value) || 2.0)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-emerald-600 font-bold font-mono focus:border-emerald-500 outline-none"
                />
              </div>
            </div>

            {/* Trailing Stop */}
            <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="font-semibold text-slate-900">Dinamik Trailing Stop (Kâr Takipçisi)</span>
                <input
                  type="checkbox"
                  checked={riskSettings.trailingStopEnabled}
                  onChange={(e) => handleChange('trailingStopEnabled', e.target.checked)}
                  className="accent-blue-600 w-4 h-4 rounded"
                />
              </label>
              {riskSettings.trailingStopEnabled && (
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-500">Geri Çekilme Payı (Callback Rate):</span>
                    <span className="font-bold text-blue-600 font-mono">%{riskSettings.trailingStopPercent}</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="5.0"
                    step="0.1"
                    value={riskSettings.trailingStopPercent}
                    onChange={(e) => handleChange('trailingStopPercent', parseFloat(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </div>
              )}
            </div>

            {/* Breakeven Trigger */}
            <div className="p-3 bg-white rounded-lg border border-slate-200">
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-900 font-semibold">Otomatik Breakeven Tetikleyicisi (% Kârda SL Girişe Çekilir)</span>
                <span className="font-bold text-blue-600 font-mono">%{riskSettings.breakevenTriggerPercent}</span>
              </div>
              <input
                type="number"
                step="0.1"
                value={riskSettings.breakevenTriggerPercent}
                onChange={(e) => handleChange('breakevenTriggerPercent', parseFloat(e.target.value) || 1.0)}
                className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-900 font-mono text-xs focus:bg-white focus:border-blue-500 outline-none"
              />
            </div>

            {/* Sinyal Zaman Aşımı (Timeout) & Tazelik Filtresi */}
            <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-900 block text-xs">⏱️ Sinyal Zaman Aşımı (Signal Timeout)</span>
                  <span className="text-[10px] text-slate-500">Eski/gecikmiş sinyallerin rastgele işlem açmasını engeller</span>
                </div>
                <span className="font-bold text-blue-600 font-mono text-xs">{riskSettings.signalTimeoutMinutes || 3} Dk</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Maks. Sinyal Yaşı (Dk)</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={riskSettings.signalTimeoutMinutes || 3}
                    onChange={(e) => handleChange('signalTimeoutMinutes', parseInt(e.target.value) || 3)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-900 font-mono text-xs focus:bg-white focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Min. Güven Skoru (%)</label>
                  <input
                    type="number"
                    min="50"
                    max="99"
                    value={riskSettings.minSignalConfidence || 75}
                    onChange={(e) => handleChange('minSignalConfidence', parseInt(e.target.value) || 75)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-900 font-mono text-xs focus:bg-white focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
              <label className="flex items-center gap-1.5 pt-1 text-[11px] text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={riskSettings.requireFreshCross ?? true}
                  onChange={(e) => handleChange('requireFreshCross', e.target.checked)}
                  className="accent-blue-600 rounded"
                />
                <span className="font-medium">Sadece taze kırılım/kesişim anında al (Geçmiş trend devamında alım yapma)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Pre-Trade Automated Check Simulator Card */}
        <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <h5 className="font-bold text-emerald-900">Pre-Trade Güvenlik Doğrulaması Aktif</h5>
            <p className="text-emerald-700 leading-relaxed">
              Her emir borsaya veya simülasyona gönderilmeden önce; Bakiye Yeterliliği, Günlük Zarar Sınırı, Maksimum Kaldıraç Eşiği ve Spread genişliği kontrollerinden otomatik geçer.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
