import React, { useState } from 'react';
import { LogEntry } from '../types/trading';
import { FileText, Search, Download, Trash2, X, AlertTriangle, Zap, Shield, Info } from 'lucide-react';

interface AuditLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: LogEntry[];
  onClearLogs?: () => void;
}

export const AuditLogsModal: React.FC<AuditLogsModalProps> = ({
  isOpen,
  onClose,
  logs,
  onClearLogs
}) => {
  const [filterLevel, setFilterLevel] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  if (!isOpen) return null;

  const filteredLogs = logs.filter(l => {
    if (filterLevel !== 'ALL' && l.level !== filterLevel) return false;
    if (searchQuery && !l.message.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const exportLogsJson = () => {
    const jsonStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', jsonStr);
    link.setAttribute('download', `binance_bot_logs_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getBadge = (level: LogEntry['level']) => {
    switch (level) {
      case 'SIGNAL':
        return <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200 text-[10px] font-bold">SIGNAL</span>;
      case 'ORDER':
        return <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold">ORDER</span>;
      case 'RISK':
        return <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-bold">RISK</span>;
      case 'WARN':
        return <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold">WARN</span>;
      case 'ERROR':
        return <span className="px-2 py-0.5 rounded bg-rose-200 text-rose-900 border border-rose-300 text-[10px] font-bold">ERROR</span>;
      default:
        return <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold">INFO</span>;
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 text-slate-800">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full p-6 shadow-xl space-y-4 max-h-[85vh] flex flex-col animate-in fade-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider">
              Sistem Audit & İşlem Logları
            </h2>
            <span className="text-xs text-slate-500 font-mono">({logs.length} Kayıt)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportLogsJson}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>JSON İndir</span>
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Level tabs */}
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            {['ALL', 'SIGNAL', 'ORDER', 'RISK', 'WARN', 'ERROR', 'INFO'].map(lvl => (
              <button
                key={lvl}
                onClick={() => setFilterLevel(lvl)}
                className={`px-3 py-1 rounded font-semibold transition ${
                  filterLevel === lvl ? 'bg-white text-blue-600 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          {/* Search box */}
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Log ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-slate-900 text-xs outline-none focus:bg-white focus:border-blue-500 font-mono"
            />
          </div>
        </div>

        {/* Log Stream Body */}
        <div className="flex-1 bg-slate-50 rounded-xl border border-slate-200 p-3 overflow-y-auto font-mono text-xs space-y-2">
          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              Arama kriterlerine uygun log kaydı bulunamadı.
            </div>
          ) : (
            filteredLogs.map(l => (
              <div key={l.id} className="p-2 rounded bg-white border border-slate-200 hover:bg-slate-100/60 transition flex items-start gap-3 shadow-2xs">
                <span className="text-[10px] text-slate-400 whitespace-nowrap pt-0.5">
                  {new Date(l.timestamp).toLocaleTimeString()}
                </span>
                <div className="flex-shrink-0">
                  {getBadge(l.level)}
                </div>
                <div className="flex-1 text-slate-800 text-[11px] leading-relaxed">
                  <p>{l.message}</p>
                  {l.details && (
                    <div className="mt-1 text-[10px] text-slate-600 bg-slate-50 p-1.5 rounded border border-slate-200">
                      {Array.isArray(l.details) ? (
                        l.details.map((d, i) => <div key={i}>• {d}</div>)
                      ) : (
                        JSON.stringify(l.details)
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
