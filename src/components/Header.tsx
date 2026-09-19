import React from 'react';
import { Disc3, Download, Languages, Library, HardDriveDownload, Sparkles, Wifi, WifiOff, QrCode, Laptop, Sun, Moon } from 'lucide-react';
import { AppLanguage, AppTheme } from '../types';
import { translations } from '../utils/translations';

interface HeaderProps {
  language: AppLanguage['code'];
  setLanguage: (lang: AppLanguage['code']) => void;
  downloadCount: number;
  totalStorageMb: number;
  storageLimitMb?: number;
  activeTab: 'downloader' | 'library';
  setActiveTab: (tab: 'downloader' | 'library') => void;
  libraryCount: number;
  isOnline?: boolean;
  onOpenQRCode?: () => void;
  onOpenStorageManagement?: () => void;
  onOpenWindowsInstall?: () => void;
  theme?: AppTheme;
  onToggleTheme?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  language,
  setLanguage,
  downloadCount,
  totalStorageMb,
  storageLimitMb = 5000,
  activeTab,
  setActiveTab,
  libraryCount,
  isOnline = true,
  onOpenQRCode,
  onOpenStorageManagement,
  onOpenWindowsInstall,
  theme = 'light-blue',
  onToggleTheme,
}) => {
  const t = translations[language];
  const isOverLimit = storageLimitMb > 0 && totalStorageMb >= storageLimitMb;

  return (
    <header className={`sticky top-0 z-40 backdrop-blur-xl border-b transition-all pt-[env(safe-area-inset-top,0px)] shadow-md ${
      theme === 'light-blue'
        ? 'bg-white/90 border-blue-200 text-slate-900 shadow-blue-500/5'
        : 'bg-white/90 border-purple-200 text-purple-950 shadow-purple-500/5'
    }`}>
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-0 sm:h-20 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-4">
        {/* Top bar on Mobile / Left side on Desktop: Brand Logo, Title & Mobile Actions */}
        <div className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-3">
          <div className="flex items-center gap-3">
            <div
              onClick={() => setActiveTab('downloader')}
              className="relative flex items-center justify-center w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-white border border-amber-500/40 shadow-lg shadow-amber-500/10 group cursor-pointer shrink-0 overflow-hidden ring-1 ring-amber-400/20"
            >
              <img
                src="/logo.png"
                alt="Soulcraft Logo"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onError={(e) => {
                  // Fallback to SVG if png not loaded
                  (e.target as HTMLImageElement).src = '/icon.svg';
                }}
              />
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center border border-black shadow">
                <Download className="w-2.5 h-2.5 text-black stroke-[3]" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-base sm:text-lg md:text-xl font-black tracking-tight bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500 bg-clip-text text-transparent drop-shadow-sm">
                  Soulcraft Downloader
                </h1>
                <span className="text-[9px] sm:text-[10px] uppercase font-black tracking-wider px-1.5 sm:px-2 py-0.5 rounded-md bg-amber-400 text-black border border-amber-300 shadow-sm">
                  Studio Master
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 hidden md:block font-medium">
                {t.appSubtitle}
              </p>
            </div>
          </div>

          {/* Quick action buttons on mobile */}
          <div className="flex items-center gap-1.5 sm:hidden">
            {onOpenQRCode && (
              <button
                onClick={onOpenQRCode}
                className="p-2 rounded-xl bg-white hover:bg-purple-50 border border-purple-200 text-purple-900 text-xs font-bold transition-colors shadow-sm active:scale-95 min-h-[38px] min-w-[38px] flex items-center justify-center"
                title="QR Code"
              >
                <QrCode className="w-4 h-4 text-purple-700" />
              </button>
            )}
            {onToggleTheme && (
              <button
                onClick={onToggleTheme}
                className="p-2 rounded-xl bg-white hover:bg-purple-50 border border-purple-200 text-xs font-bold transition-colors shadow-sm active:scale-95 min-h-[38px] min-w-[38px] flex items-center justify-center"
                title={theme === 'light-blue' ? (language === 'nl' ? 'Donker thema' : 'Dark theme') : (language === 'nl' ? 'Licht Blauw thema' : 'Light Blue theme')}
              >
                {theme === 'light-blue' ? (
                  <Sun className="w-4 h-4 text-amber-500 fill-amber-500/20" />
                ) : (
                  <Moon className="w-4 h-4 text-purple-600 fill-purple-600/20" />
                )}
              </button>
            )}
            <button
              onClick={() => setLanguage(language === 'nl' ? 'en' : 'nl')}
              className="px-2.5 py-1.5 rounded-xl bg-white border border-purple-200 text-xs font-bold text-purple-950 transition-colors shadow-sm active:scale-95 min-h-[38px] flex items-center gap-1"
            >
              <Languages className="w-3.5 h-3.5 text-purple-700" />
              <span className="uppercase">{language}</span>
            </button>
          </div>
        </div>

        {/* Center Main Navigation Tabs (Touch-friendly 44px targets for iOS) */}
        <div className="w-full sm:w-auto flex items-center justify-center bg-purple-100/80 border border-purple-200 p-1 rounded-2xl sm:rounded-full shadow-inner">
          <button
            onClick={() => setActiveTab('downloader')}
            className={`flex-1 sm:flex-initial px-4 md:px-5 py-2 sm:py-2 rounded-xl sm:rounded-full text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-2 min-h-[40px] ${
              activeTab === 'downloader'
                ? 'bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white shadow-md font-black scale-[1.02]'
                : 'text-purple-800 hover:text-purple-950'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t.navDownloader}</span>
          </button>

          <button
            onClick={() => setActiveTab('library')}
            className={`flex-1 sm:flex-initial px-4 md:px-5 py-2 sm:py-2 rounded-xl sm:rounded-full text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-2 min-h-[40px] ${
              activeTab === 'library'
                ? 'bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white shadow-md font-black scale-[1.02]'
                : 'text-purple-800 hover:text-purple-950'
            }`}
          >
            <Library className="w-3.5 h-3.5" />
            <span>{t.navLibrary}</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                activeTab === 'library'
                  ? 'bg-white text-purple-900 font-black'
                  : 'bg-zinc-800 text-zinc-300'
              }`}
            >
              {libraryCount}
            </span>
          </button>
        </div>

        {/* Desktop Right side stats & language switcher */}
        <div className="hidden sm:flex items-center gap-2 sm:gap-3">
          {/* Connection Status */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold shadow-sm transition-colors ${isOnline ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
            {isOnline ? <Wifi className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5 text-red-400" />}
            <span>{isOnline ? (language === 'nl' ? 'Online' : 'Online') : (language === 'nl' ? 'Offline' : 'Offline')}</span>
          </div>

          {/* Download Stats */}
          {downloadCount > 0 && (
            <button
              onClick={onOpenStorageManagement}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs cursor-pointer transition-all ${
                isOverLimit
                  ? 'bg-red-500/20 border-red-500/50 text-red-900 font-extrabold shadow-sm animate-pulse'
                  : 'bg-white border-purple-200 text-purple-950 hover:bg-purple-50 shadow-sm'
              }`}
              title="Opslag beheren / Manage storage"
            >
              <HardDriveDownload className="w-4 h-4 text-fuchsia-600" />
              <span className="font-bold text-purple-950">{downloadCount}</span>
              <span className="text-fuchsia-600 font-mono font-bold">({totalStorageMb.toFixed(1)} MB)</span>
            </button>
          )}

          {/* Desktop App Installation Button */}
          {onOpenWindowsInstall && (
            <button
              onClick={onOpenWindowsInstall}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white text-xs font-black transition-colors shadow-md shadow-fuchsia-500/20 cursor-pointer"
              title="Installeer als vaste app / Install app"
            >
              <Laptop className="w-3.5 h-3.5 text-white" />
              <span className="hidden md:inline">{t.installDesktopBtn}</span>
              <span className="md:hidden">App Info</span>
            </button>
          )}

          {/* QR Code Button */}
          {onOpenQRCode && (
            <button
              onClick={onOpenQRCode}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-purple-50 border border-purple-200 text-purple-900 text-xs font-bold transition-colors shadow-sm cursor-pointer"
              title="Open QR-code voor mobiel / Open QR code for mobile"
            >
              <QrCode className="w-3.5 h-3.5 text-purple-700" />
              <span className="hidden lg:inline">{language === 'nl' ? 'Mobiel QR' : 'Mobile QR'}</span>
            </button>
          )}

          {/* Theme Toggle Button */}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-purple-50 border border-purple-200 text-xs font-bold text-purple-950 transition-colors shadow-sm cursor-pointer"
              title={theme === 'light-blue' ? (language === 'nl' ? 'Schakel over naar Donker thema' : 'Switch to Dark theme') : (language === 'nl' ? 'Schakel over naar Licht Blauw thema' : 'Switch to Light Blue theme')}
            >
              {theme === 'light-blue' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20" />
                  <span className="hidden lg:inline">{language === 'nl' ? 'Licht Blauw' : 'Light Blue'}</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-purple-600 fill-purple-600/20" />
                  <span className="hidden lg:inline">{language === 'nl' ? 'Licht Paars' : 'Light Purple'}</span>
                </>
              )}
            </button>
          )}

          {/* Language Toggle Button */}
          <button
            onClick={() => setLanguage(language === 'nl' ? 'en' : 'nl')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-purple-50 border border-purple-200 text-xs font-bold text-purple-950 transition-colors shadow-sm"
            title="Switch Language / Taal wijzigen"
          >
            <Languages className="w-3.5 h-3.5 text-purple-700" />
            <span className="uppercase">{language}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
