import React, { useState, useEffect } from 'react';
import { Search, Link as LinkIcon, Music, Layers, CheckCircle2, ArrowRight } from 'lucide-react';
import { Platform, AppLanguage } from '../types';

interface SearchSectionProps {
  onSearch: (query: string, mode: 'single' | 'batch') => void;
  isLoading: boolean;
  selectedPlatformFilter: Platform | 'all';
  setSelectedPlatformFilter: (plt: Platform | 'all') => void;
  language: AppLanguage['code'];
}

export const SearchSection: React.FC<SearchSectionProps> = ({
  onSearch,
  isLoading,
  selectedPlatformFilter,
  setSelectedPlatformFilter,
  language
}) => {
  const [query, setQuery] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [detectedPlatform, setDetectedPlatform] = useState<Platform | null>(null);

  useEffect(() => {
    if (!query) {
      setDetectedPlatform(null);
      return;
    }
    const lower = query.toLowerCase();
    if (lower.includes('spotify.com')) setDetectedPlatform('spotify');
    else if (lower.includes('soundcloud.com')) setDetectedPlatform('soundcloud');
    else if (lower.includes('youtube.com') || lower.includes('youtu.be')) setDetectedPlatform('youtube');
    else setDetectedPlatform(null);
  }, [query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (showPasteBox) {
      if (pastedText.trim()) onSearch(pastedText.trim(), 'single');
    } else {
      if (query.trim()) onSearch(query.trim(), 'single');
    }
  };

  const trendingPresets = [
    { title: 'Dua Lipa - Levitating', platform: 'spotify' },
    { title: 'Billie Eilish - Birds of a Feather', platform: 'spotify' },
    { title: 'Post Malone - Sunflower', platform: 'youtube' },
  ];

  return (
    <div className="w-full bg-black/60 border-b border-zinc-850 border-zinc-800/80 pt-8 pb-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        {/* Platform Selection Filter Tabs (Mobile swipeable & desktop clean) */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-1.5 text-xs overflow-x-auto scrollbar-hide w-full py-0.5">
            <span className="text-zinc-400 mr-1 text-[11px] uppercase font-bold shrink-0">Platform:</span>
            {(['all', 'spotify', 'soundcloud', 'youtube'] as const).map((plt) => (
              <button
                key={plt}
                onClick={() => setSelectedPlatformFilter(plt)}
                className={`px-3 py-1.5 rounded-full capitalize transition-all shrink-0 min-h-[32px] flex items-center gap-1 ${
                  selectedPlatformFilter === plt
                    ? 'bg-yellow-400 text-black font-black shadow-sm'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <span>{plt === 'all' ? (language === 'nl' ? 'Alle' : 'All') : plt}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3.5">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative flex items-center group">
              <div className="absolute left-3.5 sm:left-4 z-10 flex items-center gap-1.5 text-zinc-400 pointer-events-none">
                {detectedPlatform === 'spotify' && (
                  <span className="flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-yellow-400 text-black font-black text-[9px] sm:text-[10px] animate-pulse">SP</span>
                )}
                {detectedPlatform === 'soundcloud' && (
                  <span className="flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-amber-500 text-black font-black text-[9px] sm:text-[10px] animate-pulse">SC</span>
                )}
                {detectedPlatform === 'youtube' && (
                  <span className="flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-red-500 text-white font-black text-[9px] sm:text-[10px] animate-pulse">YT</span>
                )}
                {!detectedPlatform && <LinkIcon className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />}
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Plak Spotify/SoundCloud URL of zoek titel..."
                className="w-full pl-11 sm:pl-14 pr-24 sm:pr-32 py-3.5 sm:py-4 rounded-2xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 outline-none focus:border-yellow-400 focus:bg-zinc-900/90 transition-all shadow-inner shadow-black/40 text-xs sm:text-base font-medium"
              />
              <div className="absolute right-1.5 sm:right-2 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={isLoading || !query.trim()}
                  className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black font-black text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-yellow-400/20 active:scale-95 min-h-[38px] flex items-center justify-center"
                >
                  {isLoading ? (
                    <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <span>Zoeken</span>
                  )}
                </button>
              </div>
            </div>
          </form>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider whitespace-nowrap shrink-0">
                Trending:
              </span>
              {trendingPresets.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setQuery(preset.title);
                    onSearch(preset.title, 'single');
                  }}
                  className="px-2.5 sm:px-3 py-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] sm:text-xs text-zinc-300 hover:text-white transition-all flex items-center gap-1.5 shrink-0 active:scale-95 min-h-[30px]"
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    preset.platform === 'spotify' ? 'bg-yellow-400' :
                    preset.platform === 'soundcloud' ? 'bg-amber-400' : 'bg-red-400'
                  }`}></span>
                  <span className="truncate max-w-[150px] sm:max-w-none">{preset.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
