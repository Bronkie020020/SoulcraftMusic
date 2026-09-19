import React, { useState, useEffect } from 'react';
import { Sparkles, Disc3, ArrowRight } from 'lucide-react';
import { AppTheme } from '../types';

interface StartupSplashScreenProps {
  onComplete?: () => void;
  theme?: AppTheme;
  language?: 'nl' | 'en';
}

export const StartupSplashScreen: React.FC<StartupSplashScreenProps> = ({
  onComplete,
  language = 'nl',
}) => {
  const [progress, setProgress] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isRemoved, setIsRemoved] = useState(false);

  const stepsNl = [
    'Studio Master Audio Engine initialiseren...',
    '320kbps MP3 & Lossless FLAC codecs voorbereiden...',
    'Muziekbibliotheek en configuratie synchroniseren...',
    'Welkom bij Soulcraft Downloader! Starten...',
  ];

  const stepsEn = [
    'Initializing Studio Master Audio Engine...',
    'Preparing 320kbps MP3 & Lossless FLAC codecs...',
    'Synchronizing music library and configuration...',
    'Welcome to Soulcraft Downloader! Launching...',
  ];

  const steps = language === 'nl' ? stepsNl : stepsEn;

  // Determine which step text to show based on progress percentage
  const currentStep =
    progress < 28
      ? steps[0]
      : progress < 60
      ? steps[1]
      : progress < 90
      ? steps[2]
      : steps[3];

  useEffect(() => {
    // Smooth progress increment from 0 to 100% over ~1.8 seconds
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        // Random organic increments for realistic loading sensation
        const increment = Math.floor(Math.random() * 9) + 6;
        return Math.min(100, prev + increment);
      });
    }, 90);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (progress === 100) {
      // Small pause at 100% to let user see "Ready/Klaar", then fade out
      const fadeTimer = setTimeout(() => {
        setIsFadingOut(true);
      }, 400);

      // Remove from DOM after fade out transition finishes (700ms)
      const removeTimer = setTimeout(() => {
        setIsRemoved(true);
        if (onComplete) {
          onComplete();
        }
      }, 1100);

      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(removeTimer);
      };
    }
  }, [progress, onComplete]);

  const handleSkip = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      setIsRemoved(true);
      if (onComplete) {
        onComplete();
      }
    }, 300);
  };

  if (isRemoved) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center select-none overflow-hidden transition-all duration-700 ease-out ${
        isFadingOut
          ? 'opacity-0 scale-105 pointer-events-none'
          : 'opacity-100 scale-100'
      }`}
      style={{
        background: 'radial-gradient(circle at center, #1b0a30 0%, #0c0416 65%, #05020a 100%)',
      }}
      aria-label="Soulcraft Downloader Startup"
    >
      {/* Ambient background glow & particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] rounded-full bg-purple-600/25 blur-[120px] animate-pulse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] h-[380px] rounded-full bg-amber-500/20 blur-[90px]" />
        
        {/* Vinyl groove ring background decoration */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[620px] h-[620px] rounded-full border border-purple-500/10 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full border border-purple-400/10 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] rounded-full border border-amber-400/15 pointer-events-none" />
      </div>

      {/* Skip button in top corner */}
      <button
        onClick={handleSkip}
        className="absolute top-6 right-6 z-20 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-purple-400/30 text-xs font-semibold text-purple-200 transition-all flex items-center gap-1.5 backdrop-blur-md cursor-pointer group active:scale-95"
      >
        <span>{language === 'nl' ? 'Overslaan' : 'Skip'}</span>
        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform text-amber-300" />
      </button>

      {/* Main Logo & Presentation */}
      <div className="relative z-10 flex flex-col items-center px-4 max-w-sm sm:max-w-md text-center">
        {/* Logo Container with glowing rings & vinyl effect */}
        <div className="relative mb-6 flex items-center justify-center">
          {/* Animated pulsing outer halo */}
          <div className="absolute w-44 h-44 sm:w-52 sm:h-52 rounded-full bg-gradient-to-tr from-purple-600/40 via-fuchsia-500/30 to-amber-500/40 blur-xl animate-pulse" />

          {/* Rotating vinyl background */}
          <div className="absolute w-40 h-40 sm:w-48 sm:h-48 rounded-full border-2 border-purple-500/40 flex items-center justify-center shadow-2xl shadow-purple-900/60 animate-[spin_20s_linear_infinite]">
            <Disc3 className="w-full h-full text-purple-800/40 stroke-[0.8]" />
          </div>

          {/* High-res User Logo */}
          <div className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-full p-1.5 bg-gradient-to-b from-purple-500 via-fuchsia-500 to-amber-400 shadow-2xl shadow-purple-500/40 ring-4 ring-purple-900/50 overflow-hidden transform hover:scale-105 transition-transform duration-500">
            <img
              src="/logo.png?v=2"
              alt="Soulcraft Downloader Logo"
              className="w-full h-full object-cover rounded-full"
              onError={(e) => {
                // Fallback to svg if png fails
                (e.target as HTMLImageElement).src = '/icon.svg';
              }}
            />
          </div>
        </div>

        {/* Brand Name with Gold & Neon Gradient */}
        <div className="space-y-1.5 mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-[11px] font-bold tracking-widest uppercase mb-1">
            <Sparkles className="w-3 h-3 text-amber-400 animate-spin" style={{ animationDuration: '4s' }} />
            <span>Studio Master Audio</span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white drop-shadow-md">
            <span className="bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 bg-clip-text text-transparent">
              SOULCRAFT
            </span>{' '}
            <span className="text-purple-200 font-light">DOWNLOADER</span>
          </h1>

          <p className="text-xs sm:text-sm text-purple-300/80 font-medium">
            Spotify • SoundCloud • YouTube Music
          </p>
        </div>

        {/* Animated Soundwave Equalizer Bars */}
        <div className="flex items-end justify-center gap-1.5 h-6 mb-6">
          {[40, 75, 100, 60, 90, 50, 85, 45, 95, 70, 40].map((h, i) => (
            <span
              key={i}
              className="w-1 rounded-full bg-gradient-to-t from-purple-500 to-amber-400 transition-all duration-300"
              style={{
                height: `${Math.max(15, (h * progress) / 100)}%`,
                opacity: 0.3 + (progress / 100) * 0.7,
                animation: `pulse 1.2s ease-in-out ${i * 0.1}s infinite alternate`,
              }}
            />
          ))}
        </div>

        {/* Progress Bar with glowing neon fill */}
        <div className="w-full bg-purple-950/80 rounded-full h-2.5 p-0.5 border border-purple-500/30 shadow-inner overflow-hidden mb-3">
          <div
            className="h-full rounded-full bg-gradient-to-r from-purple-500 via-fuchsia-400 to-amber-400 transition-all duration-150 ease-out shadow-[0_0_12px_rgba(251,191,36,0.6)]"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Real-time Status Text & Percentage */}
        <div className="flex items-center justify-between w-full text-[11px] sm:text-xs text-purple-300/90 font-medium px-1">
          <span className="truncate pr-2">{currentStep}</span>
          <span className="font-mono text-amber-300 font-bold shrink-0">{progress}%</span>
        </div>
      </div>
    </div>
  );
};
