import React, { useState } from 'react';
import { IndicatorValues, Kline } from '../types/trading';
import { fetchAiMarketAnalysis } from '../services/api';
import { Sparkles, Brain, Compass, ShieldCheck, RefreshCw, TrendingUp, TrendingDown, Target, Zap, AlertCircle } from 'lucide-react';

interface AiMarketAdvisorProps {
  symbol: string;
  currentPrice: number;
  timeframe: string;
  indicators: IndicatorValues;
  klines: Kline[];
}

export const AiMarketAdvisor: React.FC<AiMarketAdvisorProps> = ({
  symbol,
  currentPrice,
  timeframe,
  indicators,
  klines
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRunAnalysis = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetchAiMarketAnalysis({
        symbol,
        currentPrice,
        interval: timeframe,
        indicators,
        recentCandles: klines.slice(-6).map(k => ({
          time: new Date(k.time).toISOString(),
          open: k.open,
          high: k.high,
          low: k.low,
          close: k.close,
          volume: k.volume
        }))
      });

      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setAnalysis(res);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'AI Analizi gerçekleştirilemedi.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4 text-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Gemini AI Kantitatif Piyasa Rejimi & Sinyal Analizi
            </h3>
            <p className="text-[11px] text-slate-500">
              Gerçek zamanlı mum yapısı, volatilite (ATR), EMA Ribbon ve likidite bölgelerini yapay zeka ile skorlar.
            </p>
          </div>
        </div>

        <button
          onClick={handleRunAnalysis}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition shadow-xs flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Analiz Ediliyor...</span>
            </>
          ) : (
            <>
              <Brain className="w-3.5 h-3.5" />
              <span>Piyasayı Analiz Et ({symbol})</span>
            </>
          )}
        </button>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{errorMsg}</span>
        </div>
      )}

      {analysis ? (
        <div className="space-y-4 animate-in fade-in">
          {/* Top Scorecards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* Market Regime */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-500 block uppercase font-medium">Piyasa Rejimi (Regime)</span>
              <span className="text-sm font-bold text-blue-700 block mt-1 font-mono">
                {analysis.regime}
              </span>
              <span className="text-[10px] text-slate-500 block mt-1">
                AI Güven Skoru: <strong className="text-slate-900">%{analysis.aiConfidence}</strong>
              </span>
            </div>

            {/* AI Signal */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-500 block uppercase font-medium">Üretilen AI Sinyali</span>
              <span className={`text-sm font-bold block mt-1 ${
                analysis.signal?.includes('BUY') ? 'text-emerald-700 font-bold' : analysis.signal?.includes('SELL') ? 'text-rose-700 font-bold' : 'text-slate-700'
              }`}>
                {analysis.signal}
              </span>
              <span className="text-[10px] text-slate-500 block mt-1">
                Önerilen: <strong className="text-blue-600">{analysis.recommendedStrategy}</strong>
              </span>
            </div>

            {/* Sentiment Meter */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-500 block uppercase font-medium">Piyasa Duyarlılık Skoru</span>
              <span className={`text-sm font-bold font-mono block mt-1 ${
                analysis.marketSentimentScore >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}>
                {analysis.marketSentimentScore >= 0 ? '+' : ''}{analysis.marketSentimentScore} / 100
              </span>
              <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className={`h-full ${analysis.marketSentimentScore >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                  style={{ width: `${Math.min(100, Math.max(10, Math.abs(analysis.marketSentimentScore)))}%` }}
                />
              </div>
            </div>

            {/* S/R Targets */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-500 block uppercase font-medium">Kritik Destek & Direnç</span>
              <div className="mt-1 font-mono text-xs space-y-0.5">
                <div>Direnç: <strong className="text-rose-600">${analysis.keyResistance?.toFixed(2) || '-'}</strong></div>
                <div>Destek: <strong className="text-emerald-600">${analysis.keySupport?.toFixed(2) || '-'}</strong></div>
              </div>
            </div>
          </div>

          {/* AI Executive Summary & Risk Advice */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5 text-xs">
            <h4 className="font-bold text-blue-700 text-xs flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Kantitatif Değerlendirme & Bot Tavsiyesi</span>
            </h4>
            <p className="text-slate-800 leading-relaxed text-xs">
              {analysis.summary}
            </p>

            {analysis.suggestedRiskNotes && (
              <div className="pt-2 border-t border-slate-200 text-[11px] text-amber-800 flex items-start gap-1.5 bg-amber-50/60 p-2 rounded-lg border border-amber-200">
                <ShieldCheck className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span><strong>Risk Yönetimi Notu:</strong> {analysis.suggestedRiskNotes}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="py-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
          <Brain className="w-8 h-8 text-blue-400 mx-auto mb-2 opacity-60" />
          <p>Yapay Zeka analizini başlatmak için yukarıdaki "Piyasayı Analiz Et" butonuna tıklayın.</p>
        </div>
      )}
    </div>
  );
};
