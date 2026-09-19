import React, { useState, useEffect } from 'react';
import {
  X,
  Monitor,
  Download,
  CheckCircle2,
  Copy,
  ExternalLink,
  Laptop,
  AppWindow,
  Sparkles,
  ShieldCheck,
  Command,
} from 'lucide-react';
import { AppLanguage } from '../types';
import { translations } from '../utils/translations';

interface DesktopInstallModalProps {
  onClose: () => void;
  language: AppLanguage['code'];
  deferredPrompt?: any;
  onTriggerPwaInstall?: () => void;
}

export const DesktopInstallModal: React.FC<DesktopInstallModalProps> = ({
  onClose,
  language,
  deferredPrompt,
  onTriggerPwaInstall,
}) => {
  const t = translations[language];
  const [activeTab, setActiveTab] = useState<'mac' | 'windows'>('mac');
  const [copiedLink, setCopiedLink] = useState(false);
  const [downloadedShortcut, setDownloadedShortcut] = useState(false);

  // Auto-detect OS on load
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.userAgent) {
      const isMac = /mac/i.test(navigator.userAgent) || /macintosh/i.test(navigator.userAgent);
      if (isMac) {
        setActiveTab('mac');
      } else {
        setActiveTab('windows');
      }
    }
  }, []);

  const currentAppUrl = window.location.href;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentAppUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  // Download a Windows Internet Shortcut (.url file)
  const handleDownloadWindowsShortcut = () => {
    const shortcutContent = `[InternetShortcut]\nURL=${currentAppUrl}\nIDList=\nHotKey=0\nIconFile=${window.location.origin}/favicon.ico\nIconIndex=0\n`;
    const blob = new Blob([shortcutContent], { type: 'application/x-mswinurl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Soulcraft Downloader - Muziek Downloader.url';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setDownloadedShortcut(true);
    setTimeout(() => setDownloadedShortcut(false), 4000);
  };

  // Download a Mac Web Location (.webloc file)
  const handleDownloadMacWebloc = () => {
    const weblocContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>URL</key>
	<string>${currentAppUrl}</string>
</dict>
</plist>`;
    const blob = new Blob([weblocContent], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Soulcraft Downloader.webloc';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setDownloadedShortcut(true);
    setTimeout(() => setDownloadedShortcut(false), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-white my-8">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-pink-600 via-purple-600 to-cyan-600 p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors cursor-pointer"
            title="Sluiten"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl border border-white/30 text-white">
              <Laptop className="w-7 h-7" />
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-widest font-extrabold px-2.5 py-0.5 rounded-full bg-yellow-400 text-slate-950">
                Desktop Software • Mac & Windows
              </span>
              <h2 className="text-xl md:text-2xl font-black text-white mt-1">
                {t.installDesktopTitle}
              </h2>
            </div>
          </div>
          <p className="text-xs md:text-sm text-pink-100 opacity-90 max-w-xl">
            {t.installDesktopSubtitle}
          </p>
        </div>

        {/* Tab Selection Bar (Mac vs Windows) */}
        <div className="bg-slate-950 px-6 pt-4 border-b border-slate-800 flex items-center gap-3">
          <button
            onClick={() => setActiveTab('mac')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-t-2xl font-bold text-xs md:text-sm transition-all border-t border-x cursor-pointer ${
              activeTab === 'mac'
                ? 'bg-slate-900 text-yellow-300 border-slate-700 shadow-md'
                : 'bg-slate-950/50 text-slate-400 border-transparent hover:text-white'
            }`}
          >
            <Command className="w-4 h-4 text-pink-400" />
            <span>macOS (Apple Mac)</span>
          </button>

          <button
            onClick={() => setActiveTab('windows')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-t-2xl font-bold text-xs md:text-sm transition-all border-t border-x cursor-pointer ${
              activeTab === 'windows'
                ? 'bg-slate-900 text-yellow-300 border-slate-700 shadow-md'
                : 'bg-slate-950/50 text-slate-400 border-transparent hover:text-white'
            }`}
          >
            <Monitor className="w-4 h-4 text-cyan-400" />
            <span>Windows Laptop / PC</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Direct 1-Click PWA Install Trigger if available */}
          {deferredPrompt && (
            <div className="bg-gradient-to-r from-yellow-500/20 via-pink-500/20 to-cyan-500/20 border-2 border-yellow-400/50 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Sparkles className="w-6 h-6 text-yellow-400 shrink-0 animate-bounce" />
                <div>
                  <h3 className="text-sm font-extrabold text-white">
                    {language === 'nl' ? 'Directe 1-Klik Installatie Beschikbaar!' : 'Direct 1-Click Install Available!'}
                  </h3>
                  <p className="text-xs text-slate-300">
                    {language === 'nl'
                      ? 'Je browser ondersteunt directe installatie als zelfstandige applicatie.'
                      : 'Your browser supports direct installation as a standalone app.'}
                  </p>
                </div>
              </div>

              <button
                onClick={onTriggerPwaInstall}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black text-xs md:text-sm flex items-center justify-center gap-2 shadow-lg shadow-yellow-400/20 active:scale-95 shrink-0 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{language === 'nl' ? 'Nu Installeer als App' : 'Install as Desktop App'}</span>
              </button>
            </div>
          )}

          {/* MAC CONTENT */}
          {activeTab === 'mac' && (
            <div className="space-y-5">
              {/* Safari Add to Dock */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
                    <Command className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      {language === 'nl' ? 'Methode 1: Safari - "Voeg toe aan Dock" (Aanbevolen op Mac)' : 'Method 1: Safari - "Add to Dock" (Recommended for Mac)'}
                    </h4>
                    <p className="text-xs text-slate-400">
                      {language === 'nl'
                        ? 'Maakt direct een echt macOS-programma met eigen venster en Dock-icoon:'
                        : 'Creates a full macOS application with its own Dock icon and window:'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
                    <div className="text-xs font-black text-pink-400">STAP 1</div>
                    <p className="text-xs text-slate-200">
                      {language === 'nl' ? 'Open deze pagina in Safari op je Mac.' : 'Open this page in Safari on your Mac.'}
                    </p>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
                    <div className="text-xs font-black text-yellow-400">STAP 2</div>
                    <p className="text-xs text-slate-200">
                      {language === 'nl' ? 'Klik in het Safari bovenmenu op "Bestand" (File).' : 'In top Safari menu, click "File".'}
                    </p>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
                    <div className="text-xs font-black text-cyan-400">STAP 3</div>
                    <p className="text-xs text-slate-200">
                      {language === 'nl' ? 'Kies "Voeg toe aan Dock...". KLAAR!' : 'Click "Add to Dock...". DONE!'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Mac Chrome / Edge */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                    <Monitor className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      {language === 'nl' ? 'Methode 2: Chrome of Edge op Mac' : 'Method 2: Chrome or Edge on Mac'}
                    </h4>
                    <p className="text-xs text-slate-400">
                      {language === 'nl'
                        ? 'Klik rechtsboven in de adresbalk op het installatie-icoon (schermpje met pijl) of kies in het menu: "Opslaan en delen" ➔ "Aanmaken als app...".'
                        : 'Click install icon in address bar or go to Menu ➔ "Save and Share" ➔ "Create Shortcut...".'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Mac Webloc Shortcut file download */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-400">
                      <AppWindow className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">
                        {language === 'nl' ? 'Methode 3: Download Mac Snelkoppeling (.webloc)' : 'Method 3: Download Mac Shortcut (.webloc)'}
                      </h4>
                      <p className="text-xs text-slate-400">
                        {language === 'nl'
                          ? 'Sla een bestandje op om naar je Mac Bureaublad of Dock te slepen.'
                          : 'Save a shortcut file to drag onto your Mac Desktop or Dock.'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleDownloadMacWebloc}
                    className="px-4 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-extrabold text-xs flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{downloadedShortcut ? (language === 'nl' ? 'Gedownload!' : 'Downloaded!') : (language === 'nl' ? 'Mac Snelkoppeling' : 'Mac Shortcut')}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* WINDOWS CONTENT */}
          {activeTab === 'windows' && (
            <div className="space-y-5">
              {/* Windows Shortcut File Download */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                      <AppWindow className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">
                        {language === 'nl' ? 'Windows Snelkoppeling (.url)' : 'Windows Shortcut (.url)'}
                      </h4>
                      <p className="text-xs text-slate-400">
                        {language === 'nl'
                          ? 'Download een snelkoppeling direct naar je Windows Bureaublad.'
                          : 'Download a shortcut file directly to your Windows Desktop.'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleDownloadWindowsShortcut}
                    className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-xs flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{downloadedShortcut ? (language === 'nl' ? 'Gedownload!' : 'Downloaded!') : (language === 'nl' ? 'Snelkoppeling Maken' : 'Create Shortcut')}</span>
                  </button>
                </div>
              </div>

              {/* Edge & Chrome Guide */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
                    <Monitor className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      {language === 'nl' ? 'Installeer via Microsoft Edge of Google Chrome' : 'Install via Microsoft Edge or Google Chrome'}
                    </h4>
                    <p className="text-xs text-slate-400">
                      {language === 'nl'
                        ? 'Verandert de app in een vaste Windows applicatie:'
                        : 'Turns the app into a dedicated Windows program:'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2">
                    <div className="text-xs font-black text-pink-400">STAP 1</div>
                    <p className="text-xs text-slate-200">
                      {language === 'nl' ? 'Open deze pagina op je Windows PC.' : 'Open this page on your Windows PC.'}
                    </p>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2">
                    <div className="text-xs font-black text-yellow-400">STAP 2</div>
                    <p className="text-xs text-slate-200">
                      {language === 'nl'
                        ? 'Klik op de 3 puntjes (...) rechtsboven, ga naar "Apps" en kies "Soulcraft Downloader installeren".'
                        : 'Click 3 dots (...) top-right, go to "Apps" and select "Install Soulcraft Downloader".'}
                    </p>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2">
                    <div className="text-xs font-black text-cyan-400">STAP 3</div>
                    <p className="text-xs text-slate-200">
                      {language === 'nl'
                        ? 'Vink aan "Vastpinnen aan Taakbalk" & "Snelkoppeling op Bureaublad".'
                        : 'Check "Pin to Taskbar" & "Create Desktop Shortcut".'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Copy URL Section */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="space-y-0.5">
              <h5 className="text-xs font-bold text-white">
                {language === 'nl' ? 'Link van de app kopiëren?' : 'Copy link of the app?'}
              </h5>
              <p className="text-[11px] text-slate-400 truncate max-w-sm">
                {currentAppUrl}
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handleCopyLink}
                className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedLink ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-yellow-300" />}
                <span>{copiedLink ? (language === 'nl' ? 'Gekopieerd!' : 'Copied!') : (language === 'nl' ? 'Kopieer Link' : 'Copy Link')}</span>
              </button>

              <a
                href={currentAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                title="Open in nieuw venster"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Advantages list */}
          <div className="pt-1 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>{language === 'nl' ? 'Werkt in een eigen venster zonder adresbalk' : 'Runs in a standalone window without address bar'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>{language === 'nl' ? 'Op te starten vanuit Mac Dock, Launchpad of Windows Start' : 'Launches directly from Mac Dock, Launchpad or Windows Start'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>{language === 'nl' ? 'Onthoudt al je gedownloade muziek & bibliotheek' : 'Persists all downloaded tracks & library'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>{language === 'nl' ? 'Hoge kwaliteit 320kbps MP3 speler' : 'High quality 320kbps MP3 player'}</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-950 p-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            {language === 'nl' ? 'Begrepen / Sluiten' : 'Got it / Close'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Backwards compatibility export
export const WindowsInstallModal = DesktopInstallModal;
