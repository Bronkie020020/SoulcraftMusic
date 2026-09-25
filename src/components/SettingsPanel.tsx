import React, { useState } from 'react';
import {
  X,
  Settings,
  Folder,
  FolderCheck,
  FolderOpen,
  RotateCcw,
  Check,
  Music,
  Disc,
  Sliders,
  Gauge,
  Sparkles,
  Info,
  CheckCircle2,
  HardDrive,
  Cpu,
  Layers,
  Zap,
} from 'lucide-react';
import { useSettings, AudioFormat, AudioQuality, ConcurrencyLimit } from '../context/SettingsContext';
import { AppLanguage } from '../types';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  language: AppLanguage['code'];
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose, language }) => {
  const {
    settings,
    setFormat,
    setQuality,
    setConcurrency,
    isFileSystemSupported,
    chooseDirectory,
    resetDirectory,
  } = useSettings();

  const [isPickingFolder, setIsPickingFolder] = useState(false);
  const [folderSuccessMsg, setFolderSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePickDirectory = async () => {
    setIsPickingFolder(true);
    const success = await chooseDirectory();
    setIsPickingFolder(false);
    if (success) {
      setFolderSuccessMsg(language === 'nl' ? 'Opslagmap succesvol gekoppeld!' : 'Storage folder linked successfully!');
      setTimeout(() => setFolderSuccessMsg(null), 3000);
    }
  };

  const handleResetDirectory = async () => {
    await resetDirectory();
    setFolderSuccessMsg(language === 'nl' ? 'Hersteld naar standaard browser Downloads' : 'Reset to default browser Downloads');
    setTimeout(() => setFolderSuccessMsg(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-md animate-fade-in font-sans">
      <div
        className="bg-zinc-950 border border-zinc-800 text-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400 shadow-md shadow-amber-500/10">
              <Settings className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                <span>{language === 'nl' ? 'Download- & Audio-instellingen' : 'Download & Audio Settings'}</span>
              </h3>
              <p className="text-xs text-zinc-400">
                {language === 'nl'
                  ? 'Beheer opslaglocatie, bestandstype, kwaliteit en parallelle downloads'
                  : 'Configure storage destination, format, quality and concurrency'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors border border-zinc-800 cursor-pointer"
            title="Sluiten"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs sm:text-sm">
          
          {/* SECTION 1: STORAGE DESTINATION (File System Access API) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-extrabold text-zinc-200 flex items-center gap-2 text-xs uppercase tracking-wider text-amber-400 font-mono">
                <Folder className="w-4 h-4" />
                <span>1. {language === 'nl' ? 'Opslagbestemming' : 'Storage Destination'}</span>
              </label>

              {isFileSystemSupported ? (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  File System Access API
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[10px] font-mono">
                  Browser Fallback
                </span>
              )}
            </div>

            <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-4 space-y-3 shadow-inner">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                    settings.customDirectoryName
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                  }`}>
                    {settings.customDirectoryName ? (
                      <FolderCheck className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <HardDrive className="w-5 h-5 text-zinc-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">
                      {settings.customDirectoryName ? (
                        <span className="text-emerald-400 flex items-center gap-1.5">
                          <span>Map:</span>
                          <strong className="underline decoration-emerald-500/40">{settings.customDirectoryName}</strong>
                        </span>
                      ) : (
                        language === 'nl' ? 'Standaard browser "Downloads" map' : 'Default browser "Downloads" folder'
                      )}
                    </p>
                    <p className="text-[11px] text-zinc-400">
                      {settings.customDirectoryName
                        ? (language === 'nl' ? 'Downloads worden direct in deze lokale map opgeslagen.' : 'Files write directly into this local folder.')
                        : (language === 'nl' ? 'Browser vraagt of bewaart automatisch in downloads.' : 'Files saved via default browser prompt/folder.')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isFileSystemSupported && (
                    <button
                      onClick={handlePickDirectory}
                      disabled={isPickingFolder}
                      className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-amber-400/20 active:scale-95 transition-all cursor-pointer"
                    >
                      <FolderOpen className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>{language === 'nl' ? 'Kies opslagmap' : 'Choose Folder'}</span>
                    </button>
                  )}

                  {settings.customDirectoryName && (
                    <button
                      onClick={handleResetDirectory}
                      className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-red-400 border border-zinc-700 transition-colors cursor-pointer"
                      title={language === 'nl' ? 'Herstellen naar standaard Downloads' : 'Reset to default Downloads'}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {folderSuccessMsg && (
                <div className="text-emerald-400 text-xs font-semibold flex items-center gap-1.5 bg-emerald-950/40 border border-emerald-800/60 px-3 py-1.5 rounded-lg animate-fade-in">
                  <Check className="w-3.5 h-3.5" />
                  <span>{folderSuccessMsg}</span>
                </div>
              )}

              {!isFileSystemSupported && (
                <p className="text-[11px] text-amber-400/90 bg-amber-950/30 border border-amber-900/40 p-2.5 rounded-xl flex items-start gap-2">
                  <Info className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                  <span>
                    {language === 'nl'
                      ? 'De File System Access API is niet beschikbaar in deze browser. Je downloads worden veilig gestreamd naar je standaard browser Downloads-map.'
                      : 'File System Access API is not available in this browser. Downloads will fall back to your browser default Downloads directory.'}
                  </span>
                </p>
              )}
            </div>
          </div>

          {/* SECTION 2: FILE FORMAT SELECTION */}
          <div className="space-y-3">
            <label className="font-extrabold text-zinc-200 flex items-center gap-2 text-xs uppercase tracking-wider text-amber-400 font-mono">
              <Music className="w-4 h-4" />
              <span>2. {language === 'nl' ? 'Bestandsformaat (Output)' : 'File Format'}</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  id: 'mp3',
                  label: 'MP3 (.mp3)',
                  badge: 'Universeel',
                  desc: language === 'nl' ? 'Maximale compatibiliteit op alle apparaten en autoradio’s' : 'Universal compatibility across all devices',
                },
                {
                  id: 'm4a',
                  label: 'M4A (.m4a)',
                  badge: 'AAC Audio',
                  desc: language === 'nl' ? 'Hoge efficiëntie codec, ideaal voor Apple & mobiel' : 'High-efficiency AAC codec, ideal for Apple',
                },
                {
                  id: 'wav',
                  label: 'WAV (.wav)',
                  badge: 'Studio Lossless',
                  desc: language === 'nl' ? 'Ongecomprimeerd studiogeluid zonder kwaliteitsverlies' : 'Uncompressed lossless studio master audio',
                },
              ].map((item) => {
                const isSelected = settings.format === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setFormat(item.id as AudioFormat)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                      isSelected
                        ? 'bg-amber-400/10 border-amber-400 shadow-lg shadow-amber-400/10 ring-1 ring-amber-400/40'
                        : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-white text-xs sm:text-sm">
                        {item.label}
                      </span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                        isSelected ? 'bg-amber-400 text-black' : 'bg-zinc-800 text-zinc-400'
                      }`}>
                        {item.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-snug">
                      {item.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 3: AUDIO QUALITY LEVEL */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-extrabold text-zinc-200 flex items-center gap-2 text-xs uppercase tracking-wider text-amber-400 font-mono">
                <Disc className="w-4 h-4" />
                <span>3. {language === 'nl' ? 'Audiokwaliteit & Bitrate' : 'Audio Quality & Bitrate'}</span>
              </label>

              {settings.format === 'wav' && (
                <span className="text-[10px] font-mono text-cyan-400 font-bold bg-cyan-950/40 border border-cyan-800/50 px-2 py-0.5 rounded-full">
                  WAV = 1411 kbps PCM (Vaste Studio Kwaliteit)
                </span>
              )}
            </div>

            <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 ${settings.format === 'wav' ? 'opacity-40 pointer-events-none' : ''}`}>
              {[
                {
                  id: '128',
                  label: language === 'nl' ? 'Laag' : 'Low',
                  kbps: '128 kbps',
                  desc: language === 'nl' ? 'Snelste download, compacte bestandsgrootte' : 'Fast download, smallest file size',
                },
                {
                  id: '192',
                  label: language === 'nl' ? 'Standaard' : 'Standard',
                  kbps: '192 kbps',
                  desc: language === 'nl' ? 'Gebalanceerd (standaard, uitstekende balans)' : 'Balanced default fidelity & speed',
                },
                {
                  id: '320',
                  label: language === 'nl' ? 'Hoog' : 'High',
                  kbps: '320 kbps',
                  desc: language === 'nl' ? 'Beste audiokwaliteit (kristalheldere studio master)' : 'Studio master fidelity for DJing & Hi-Fi',
                },
              ].map((item) => {
                const isSelected = settings.quality === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setQuality(item.id as AudioQuality)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                      isSelected
                        ? 'bg-amber-400/10 border-amber-400 shadow-lg shadow-amber-400/10 ring-1 ring-amber-400/40'
                        : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-white text-xs sm:text-sm">
                        {item.label}
                      </span>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                        isSelected ? 'bg-amber-400 text-black' : 'bg-zinc-800 text-yellow-400'
                      }`}>
                        {item.kbps}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-snug">
                      {item.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 4: CONCURRENT DOWNLOADS LIMIT */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-extrabold text-zinc-200 flex items-center gap-2 text-xs uppercase tracking-wider text-amber-400 font-mono">
                <Cpu className="w-4 h-4" />
                <span>4. {language === 'nl' ? 'Gelijktijdige Downloads (Concurrency)' : 'Concurrent Downloads'}</span>
              </label>

              <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-black text-[11px] font-mono font-black shadow-sm">
                {settings.concurrency} {language === 'nl' ? 'parallel' : 'parallel'}
              </span>
            </div>

            <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-4 space-y-4 shadow-inner">
              <div className="flex items-center justify-between gap-2">
                {([1, 2, 3, 4, 5] as ConcurrencyLimit[]).map((num) => {
                  const isSelected = settings.concurrency === num;
                  return (
                    <button
                      key={num}
                      onClick={() => setConcurrency(num)}
                      className={`flex-1 py-2.5 rounded-xl font-mono font-extrabold text-xs sm:text-sm transition-all border cursor-pointer ${
                        isSelected
                          ? 'bg-amber-400 text-black border-amber-300 shadow-lg shadow-amber-400/20 scale-105'
                          : 'bg-zinc-950 text-zinc-300 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800'
                      }`}
                    >
                      {num}x
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 pt-1">
                <span>1x: Sequentieel (stabielst)</span>
                <span className="text-amber-400 font-bold">3x: Aanbevolen</span>
                <span>5x: Turbo parallel</span>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800/80 bg-zinc-900/50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{language === 'nl' ? 'Instellingen worden direct lokaal bewaard' : 'Settings auto-saved to localStorage'}</span>
          </div>

          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs sm:text-sm transition-all shadow-lg shadow-amber-400/20 active:scale-95 cursor-pointer"
          >
            {language === 'nl' ? 'Klaar' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
};
