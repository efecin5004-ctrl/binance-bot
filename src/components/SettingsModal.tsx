import React, { useState } from 'react';
import { ApiCredentials, TelegramSettings } from '../types/trading';
import { testBinanceApiConnection, sendTelegramNotification } from '../services/api';
import { Settings, Key, Shield, Send, CheckCircle2, AlertCircle, RefreshCw, X, Download, Upload, RotateCcw } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiCredentials: ApiCredentials;
  onUpdateApiCredentials: (creds: ApiCredentials) => void;
  telegramSettings: TelegramSettings;
  onUpdateTelegramSettings: (settings: TelegramSettings) => void;
  onResetPaperAccount: () => void;
  paperBalance: number;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  apiCredentials,
  onUpdateApiCredentials,
  telegramSettings,
  onUpdateTelegramSettings,
  onResetPaperAccount,
  paperBalance
}) => {
  const [apiKey, setApiKey] = useState(apiCredentials.apiKey);
  const [apiSecret, setApiSecret] = useState(apiCredentials.apiSecret);
  const [isTestnet, setIsTestnet] = useState(apiCredentials.isTestnet);

  const [telegramToken, setTelegramToken] = useState(telegramSettings.botToken);
  const [telegramChatId, setTelegramChatId] = useState(telegramSettings.chatId);
  const [telegramEnabled, setTelegramEnabled] = useState(telegramSettings.enabled);

  const [isTestingApi, setIsTestingApi] = useState(false);
  const [apiTestResult, setApiTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [telegramTestResult, setTelegramTestResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleTestAndSaveApi = async () => {
    setIsTestingApi(true);
    setApiTestResult(null);

    try {
      const res = await testBinanceApiConnection(apiKey, apiSecret, isTestnet);
      if (res.success) {
        setApiTestResult({ success: true, message: `Bağlantı Başarılı! Hesap Türü: ${res.accountType || 'SPOT'}, İşlem İzni: ${res.canTrade ? 'EVET' : 'HAYIR'}` });
        onUpdateApiCredentials({
          apiKey,
          apiSecret,
          isTestnet,
          isConnected: true,
          canTrade: res.canTrade,
          lastChecked: Date.now()
        });
      } else {
        setApiTestResult({ success: false, message: res.message || 'Binance bağlantısı başarısız oldu.' });
      }
    } catch (err: any) {
      setApiTestResult({ success: false, message: err.message || 'Bağlantı hatası' });
    } finally {
      setIsTestingApi(false);
    }
  };

  const handleTestAndSaveTelegram = async () => {
    setIsTestingTelegram(true);
    setTelegramTestResult(null);

    try {
      const res = await sendTelegramNotification(
        telegramToken,
        telegramChatId,
        '🤖 <b>Binance Quant Bot Bildirim Testi:</b>\nTelegram entegrasyonu başarıyla doğrulandı ve aktif edildi!'
      );

      if (res.success) {
        setTelegramTestResult({ success: true, message: 'Test mesajı Telegram hesabınıza başarıyla iletildi!' });
        onUpdateTelegramSettings({
          ...telegramSettings,
          enabled: telegramEnabled,
          botToken: telegramToken,
          chatId: telegramChatId
        });
      } else {
        setTelegramTestResult({ success: false, message: res.message || 'Telegram mesajı iletilemedi. Token ve Chat ID kontrol edin.' });
      }
    } catch (err: any) {
      setTelegramTestResult({ success: false, message: err.message });
    } finally {
      setIsTestingTelegram(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 text-slate-800">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 shadow-xl space-y-6 max-h-[90vh] overflow-y-auto animate-in fade-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider">Sistem Ayarları & Entegrasyonlar</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section 1: Binance API Credentials */}
        <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-slate-900">
              <Key className="w-4 h-4 text-blue-600" />
              <span>Binance API Anahtarları (Spot & Futures)</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                <input
                  type="checkbox"
                  checked={isTestnet}
                  onChange={(e) => setIsTestnet(e.target.checked)}
                  className="accent-blue-600 rounded"
                />
                <span className="font-medium">Testnet Modu (Güvenli Test)</span>
              </label>
            </div>
          </div>

          <p className="text-slate-500 text-[11px] leading-relaxed">
            API anahtarınız borsa emirlerini yerel olarak imzalamak için kullanılır. Güvenliğiniz için API anahtarınızda <strong className="text-slate-800">Çekim (Withdrawal) iznini KAPALI</strong> tutunuz, sadece Okuma ve Ticaret (Read & Trade) izinleri yeterlidir.
          </p>

          <div className="space-y-3">
            <div>
              <label className="text-slate-600 block mb-1">API Key</label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Örn: vmPUZE6mv9SD5VNH..."
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-mono text-xs focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="text-slate-600 block mb-1">API Secret</label>
              <input
                type="password"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder="Örn: nhqPtmdSJYdKjv..."
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-mono text-xs focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {apiTestResult && (
            <div
              className={`p-3 rounded-lg flex items-center gap-2 ${
                apiTestResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {apiTestResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
              <span>{apiTestResult.message}</span>
            </div>
          )}

          <button
            onClick={handleTestAndSaveApi}
            disabled={isTestingApi || !apiKey || !apiSecret}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-lg transition flex items-center justify-center gap-2 shadow-xs"
          >
            {isTestingApi ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            <span>Binance Bağlantısını Test Et & Kaydet</span>
          </button>
        </div>

        {/* Section 2: Telegram Bot Notifications */}
        <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-slate-900">
              <Send className="w-4 h-4 text-blue-600" />
              <span>Telegram Anlık Bildirim & Alarm Botu</span>
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
              <input
                type="checkbox"
                checked={telegramEnabled}
                onChange={(e) => setTelegramEnabled(e.target.checked)}
                className="accent-blue-600 rounded"
              />
              <span className="font-medium">Aktif</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-600 block mb-1">Telegram Bot Token</label>
              <input
                type="text"
                value={telegramToken}
                onChange={(e) => setTelegramToken(e.target.value)}
                placeholder="123456:ABC-DEF..."
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-mono text-xs focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="text-slate-600 block mb-1">Chat ID</label>
              <input
                type="text"
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                placeholder="987654321"
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-mono text-xs focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {telegramTestResult && (
            <div
              className={`p-3 rounded-lg flex items-center gap-2 ${
                telegramTestResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {telegramTestResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
              <span>{telegramTestResult.message}</span>
            </div>
          )}

          <button
            onClick={handleTestAndSaveTelegram}
            disabled={isTestingTelegram || !telegramToken || !telegramChatId}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-lg transition flex items-center justify-center gap-2 shadow-xs"
          >
            {isTestingTelegram ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>Telegram Bildirimini Test Et & Kaydet</span>
          </button>
        </div>

        {/* Section 3: Paper Account Reset */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
          <div>
            <span className="font-bold text-slate-900 block">Paper Trading Bakiyesini Sıfırla</span>
            <span className="text-[11px] text-slate-500">
              Sanal simülasyon bakiyesini $10,000 USDT seviyesine sıfırlar ve pozisyonları temizler.
            </span>
          </div>
          <button
            onClick={onResetPaperAccount}
            className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-lg transition flex items-center gap-1.5 shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Sıfırla ($10K)</span>
          </button>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition shadow-xs"
          >
            Tamamla & Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
