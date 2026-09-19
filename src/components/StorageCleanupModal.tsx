import React, { useState } from 'react';
import { HardDrive, Trash2, X, AlertTriangle, CheckCircle2, ShieldAlert, Sparkles, Heart, Sliders } from 'lucide-react';
import { AppLanguage } from '../types';
import { translations } from '../utils/translations';

interface StorageCleanupModalProps {
  language: AppLanguage['code'];
  totalStorageMb: number;
  historyCount: number;
  historySizeMb: number;
  libraryCount: number;
  librarySizeMb: number;
  nonFavoritesCount: number;
  nonFavoritesSizeMb: number;
  onClearHistory: () => void;
  onClearNonFavorites: () => void;
  onClearAllCache: () => void;
  onResetAllData?: () => void;
  onClose: () => void;
  storageLimitMb?: number;
  onChangeStorageLimit?: (newLimit: number) => void;
}

export const StorageCleanupModal: React.FC<StorageCleanupModalProps> = ({
  language,
  totalStorageMb,
  historyCount,
  historySizeMb,
  libraryCount,
  librarySizeMb,
  nonFavoritesCount,
  nonFavoritesSizeMb,
  onClearHistory,
  onClearNonFavorites,
  onClearAllCache,
  onResetAllData,
  onClose,
  storageLimitMb = 5000,
  onChangeStorageLimit,
}) => {
  const t = translations[language];
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState<boolean>(false);

  const limitMb = storageLimitMb;
  const isUnlimited = limitMb <= 0;
  const isOverLimit = !isUnlimited && totalStorageMb >= limitMb;
  const percentUsed = isUnlimited ? 0 : Math.min(100, Math.round((totalStorageMb / limitMb) * 100));

  const formatLimit = (mb: number) => {
    if (mb <= 0) return language === 'nl' ? 'Onbeperkt' : 'Unlimited';
    if (mb >= 1000) return `${mb / 1000} GB`;
    return `${mb} MB`;
  };

  const storageLimitOptions = [
    { label: '1 GB', labelEn: '1 GB', value: 1000 },
    { label: '2 GB', labelEn: '2 GB', value: 2000 },
    { label: '5 GB', labelEn: '5 GB', value: 5000, isDefault: true },
    { label: '10 GB', labelEn: '10 GB', value: 10000 },
    { label: 'Geen limiet', labelEn: 'No limit', value: 0 },
  ];

  const handleAction = (actionFn: () => void, label: string) => {
    actionFn();
    setSuccessMsg(label);
    setTimeout(() => {
      setSuccessMsg(null);
    }, 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden text-white">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isOverLimit ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse' : 'bg-yellow-400/20 text-yellow-300 border border-yellow-400/30'}`}>
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold tracking-tight text-white">{t.storageTitle}</h3>
              <p className="text-xs text-slate-400">{t.storageSubtitle}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning Banner if Over Limit */}
        {isOverLimit && (
          <div className="p-4 rounded-2xl bg-red-500/15 border border-red-500/40 text-red-200 text-xs sm:text-sm space-y-1.5 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-red-300">{t.storageLimitWarning} ({formatLimit(limitMb)})</h4>
              <p className="text-red-200/90 leading-relaxed text-xs">{t.storageLimitDesc}</p>
            </div>
          </div>
        )}

        {/* Storage Meter */}
        <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-300">{t.storageUsed}:</span>
            <span className={`font-mono text-sm font-bold ${isOverLimit ? 'text-red-400' : 'text-yellow-300'}`}>
              {totalStorageMb.toFixed(1)} MB {isUnlimited ? `(${language === 'nl' ? 'Geen limiet' : 'Unlimited'})` : `/ ${formatLimit(limitMb)} (${percentUsed}%)`}
            </span>
          </div>

          <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden p-0.5 border border-slate-700/50">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isOverLimit
                  ? 'bg-gradient-to-r from-red-500 to-rose-600 shadow-[0_0_12px_rgba(239,68,68,0.5)]'
                  : isUnlimited
                  ? 'bg-gradient-to-r from-emerald-400 to-teal-500'
                  : percentUsed > 70
                  ? 'bg-gradient-to-r from-amber-400 to-yellow-500'
                  : 'bg-gradient-to-r from-cyan-400 to-blue-500'
              }`}
              style={{ width: isUnlimited ? `${Math.min(100, Math.max(6, (totalStorageMb / 10000) * 100))}%` : `${percentUsed}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>{isUnlimited ? (language === 'nl' ? 'Opslaglimiet staat uit' : 'Storage limit disabled') : `${t.storageLimit}: ${formatLimit(limitMb)}`}</span>
            <span className="font-mono text-slate-300 font-semibold">{isUnlimited ? (language === 'nl' ? 'Onbeperkt' : 'Unlimited') : formatLimit(limitMb)}</span>
          </div>
        </div>

        {/* Storage Limit Configuration */}
        {onChangeStorageLimit && (
          <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-yellow-400" />
                <span>{t.storageLimitSetting || (language === 'nl' ? 'Maximale Opslaglimiet' : 'Maximum Storage Limit')}</span>
              </span>
              <span className="text-[11px] font-mono font-bold text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-md border border-yellow-400/20">
                {formatLimit(limitMb)}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">
              {t.storageLimitSettingDesc || (language === 'nl' ? 'Kies hoeveel opslagruimte je bibliotheek en gedownloade nummers mogen innemen:' : 'Choose how much storage your library and downloaded tracks may occupy:')}
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 pt-1">
              {storageLimitOptions.map((opt) => {
                const isSelected = limitMb === opt.value;
                const label = language === 'nl' ? opt.label : opt.labelEn;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChangeStorageLimit(opt.value);
                      setSuccessMsg(language === 'nl' ? `Opslaglimiet gewijzigd naar ${label}` : `Storage limit changed to ${label}`);
                    }}
                    className={`py-2 px-1.5 rounded-xl text-xs font-bold transition-all text-center border relative cursor-pointer ${
                      isSelected
                        ? 'bg-yellow-400 text-slate-950 border-yellow-400 shadow-md shadow-yellow-400/25 font-black scale-[1.02]'
                        : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700/60'
                    }`}
                  >
                    <div>{label}</div>
                    {opt.isDefault && (
                      <span className={`text-[9px] block font-mono -mt-0.5 ${isSelected ? 'text-slate-900 font-extrabold' : 'text-slate-400'}`}>
                        {language === 'nl' ? 'standaard' : 'default'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Breakdown stats */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-800 space-y-1">
            <p className="text-slate-400">{t.historyCacheSize}</p>
            <p className="font-bold text-white text-sm">
              {historyCount} {language === 'nl' ? 'nummers' : 'tracks'}{' '}
              <span className="text-xs font-mono text-slate-400">({historySizeMb.toFixed(1)} MB)</span>
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-800 space-y-1">
            <p className="text-slate-400">{t.nonFavoritesSize}</p>
            <p className="font-bold text-white text-sm">
              {nonFavoritesCount} {language === 'nl' ? 'nummers' : 'tracks'}{' '}
              <span className="text-xs font-mono text-slate-400">({nonFavoritesSizeMb.toFixed(1)} MB)</span>
            </p>
          </div>
        </div>

        {/* Success toast if action performed */}
        {successMsg && (
          <div className="p-3.5 rounded-xl bg-green-500/20 border border-green-500/40 text-green-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
            <span>{t.cleanupDoneMsg}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-2 border-t border-slate-800">
          <button
            onClick={() => handleAction(onClearNonFavorites, 'Non-favorites cleaned')}
            disabled={nonFavoritesCount === 0}
            className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700 text-xs font-bold text-slate-200 hover:text-white transition-all flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-pink-400" />
              <span>{t.clearNonFavoritesOnly}</span>
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              -{nonFavoritesSizeMb.toFixed(1)} MB
            </span>
          </button>

          <button
            onClick={() => handleAction(onClearHistory, 'History cleared')}
            disabled={historyCount === 0}
            className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700 text-xs font-bold text-slate-200 hover:text-white transition-all flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-yellow-400" />
              <span>{t.clearHistory}</span>
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              -{historySizeMb.toFixed(1)} MB
            </span>
          </button>

          <button
            onClick={() => handleAction(onClearAllCache, 'All cache cleared')}
            className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs transition-all border border-slate-700 flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4 text-yellow-400" />
            <span>{t.clearAllCache}</span>
          </button>

          {/* Full App Reset & Clear All Stored Data */}
          {onResetAllData && (
            <div className="pt-2 border-t border-slate-800/80">
              {!confirmReset ? (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="w-full py-3 px-4 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-800/60 text-red-300 hover:text-red-200 font-extrabold text-xs transition-all flex items-center justify-center gap-2 shadow-md"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                  <span>{language === 'nl' ? '🗑️ Volledige App Reset (Alle Oude Data Wissen)' : '🗑️ Complete App Reset (Wipe All Data)'}</span>
                </button>
              ) : (
                <div className="p-3.5 rounded-2xl bg-red-950/80 border border-red-600/80 space-y-2.5 animate-fade-in">
                  <div className="flex items-center gap-2 text-red-200 text-xs font-bold">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{language === 'nl' ? 'Weet je zeker dat je alle data & nummers wilt wissen voor een 100% lege app?' : 'Are you sure you want to wipe all tracks & start with a 100% empty app?'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onResetAllData();
                        setConfirmReset(false);
                        setSuccessMsg(language === 'nl' ? 'App is volledig gereset naar een lege staat!' : 'App completely reset to clean state!');
                      }}
                      className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs transition-colors shadow-md"
                    >
                      {language === 'nl' ? 'Ja, Maak App Leeg' : 'Yes, Make App Empty'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
                    >
                      {t.cancel}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Close Button */}
        <div className="pt-2">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-semibold transition-colors"
          >
            {t.close}
          </button>
        </div>

      </div>
    </div>
  );
};
