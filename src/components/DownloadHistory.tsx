import React from 'react';
import { HardDriveDownload, Trash2, Play, Pause, Download, HardDrive, AlertCircle } from 'lucide-react';
import { AppLanguage, MusicTrack } from '../types';
import { translations } from '../utils/translations';

interface DownloadHistoryProps {
  language: AppLanguage['code'];
  history: MusicTrack[];
  onClearHistory: () => void;
  onReDownload: (track: MusicTrack) => void;
  playingTrackId: string | null;
  onTogglePlay: (track: MusicTrack) => void;
  onOpenStorageManagement?: () => void;
  totalStorageMb?: number;
  storageLimitMb?: number;
}

export const DownloadHistory: React.FC<DownloadHistoryProps> = ({
  language,
  history,
  onClearHistory,
  onReDownload,
  playingTrackId,
  onTogglePlay,
  onOpenStorageManagement,
  totalStorageMb = 0,
  storageLimitMb = 5000,
}) => {
  const t = translations[language];
  const limitMb = storageLimitMb;
  const isOverLimit = limitMb > 0 && totalStorageMb >= limitMb;

  const formatLimit = (mb: number) => {
    if (mb <= 0) return language === 'nl' ? 'Onbeperkt' : 'Unlimited';
    if (mb >= 1000) return `${mb / 1000} GB`;
    return `${mb} MB`;
  };

  if (history.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
          <HardDriveDownload className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-white">{t.historyTitle}</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">{t.noHistory}</p>

        {onOpenStorageManagement && (
          <button
            onClick={onOpenStorageManagement}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-yellow-300 hover:text-yellow-200 transition-colors inline-flex items-center gap-2"
          >
            <HardDrive className="w-4 h-4" />
            <span>{t.manageStorageBtn}</span>
            <span className="font-mono text-[11px] text-slate-400">({totalStorageMb.toFixed(1)} / {formatLimit(limitMb)})</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2.5 flex-wrap">
          <HardDriveDownload className="w-5 h-5 text-yellow-300" />
          <h3 className="text-lg font-bold text-white">{t.historyTitle}</h3>
          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-xs font-semibold text-slate-300">
            {history.length}
          </span>

          {isOverLimit && (
            <span className="px-2.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 text-[11px] font-extrabold flex items-center gap-1 animate-pulse">
              <AlertCircle className="w-3.5 h-3.5 text-red-400" />
              <span>&gt;{formatLimit(limitMb)} {language === 'nl' ? 'Limiet' : 'Limit'}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onOpenStorageManagement && (
            <button
              onClick={onOpenStorageManagement}
              className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 ${
                isOverLimit
                  ? 'bg-red-500/20 border-red-500/50 text-red-300 hover:bg-red-500/30'
                  : 'bg-slate-800 border-slate-700 text-yellow-300 hover:bg-slate-700 hover:text-yellow-200'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>{t.manageStorageBtn}</span>
              <span className="font-mono text-[10px] opacity-80">({totalStorageMb.toFixed(0)} MB)</span>
            </button>
          )}

          <button
            onClick={onClearHistory}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-red-500/10 hover:border-red-500/20 border border-slate-700 text-xs font-medium text-slate-300 hover:text-red-400 transition-colors flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t.clearHistory}</span>
          </button>
        </div>
      </div>

      <div className="divide-y divide-slate-800/60">
        {history.map((track) => (
          <div
            key={track.id}
            className="py-3 flex items-center justify-between gap-3 group hover:bg-slate-800/30 px-2 rounded-2xl transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <img
                  src={track.coverUrl}
                  alt={track.title}
                  className="w-11 h-11 rounded-xl object-cover border border-slate-700"
                />
                <button
                  onClick={() => onTogglePlay(track)}
                  className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center text-white"
                >
                  {playingTrackId === track.id ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
                </button>
              </div>

              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-white truncate">{track.title}</h4>
                <p className="text-xs text-slate-400 truncate">
                  {track.artist || 'Onbekend'} • {track.fileSizeMb || 7.5} MB • {(track.format || 'mp3').toUpperCase()} (320kbps)
                </p>
              </div>
            </div>

            <button
              onClick={() => onReDownload(track)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Opnieuw downloaden"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
