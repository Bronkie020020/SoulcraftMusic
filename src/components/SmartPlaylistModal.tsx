import React, { useState } from 'react';
import { X, Sparkles, Sliders, Music, Zap, Check, ArrowRight } from 'lucide-react';
import { MusicTrack, Playlist, AppLanguage } from '../types';
import { CAMELOT_KEY_MAP, getCompatibleCamelotKeys, normalizeToCamelotKey } from '../utils/audioAnalyzer';

interface SmartPlaylistModalProps {
  language: AppLanguage['code'];
  library: MusicTrack[];
  onSavePlaylist: (playlist: Playlist) => void;
  onClose: () => void;
}

export const SmartPlaylistModal: React.FC<SmartPlaylistModalProps> = ({
  language,
  library,
  onSavePlaylist,
  onClose,
}) => {
  const [playlistName, setPlaylistName] = useState('🔥 Peak Time Set 126-130 BPM');
  const [minBpm, setMinBpm] = useState<number>(124);
  const [maxBpm, setMaxBpm] = useState<number>(130);
  const [selectedKey, setSelectedKey] = useState<string>('all');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [harmonizeSequence, setHarmonizeSequence] = useState<boolean>(true);

  // Available unique genres
  const availableGenres = Array.from(
    new Set(library.map((t) => t.genre).filter(Boolean))
  ).sort();

  // Calculate matching tracks dynamically
  const matchingTracks = React.useMemo(() => {
    let result = library.filter((t) => {
      const bpm = t.bpm || 126;
      if (bpm < minBpm || bpm > maxBpm) return false;

      if (selectedGenre !== 'all' && t.genre !== selectedGenre) return false;

      if (selectedKey !== 'all') {
        const trackCamelot = normalizeToCamelotKey(t.key);
        const compatible = getCompatibleCamelotKeys(selectedKey).map((c) => c.key);
        if (!compatible.includes(trackCamelot)) return false;
      }

      return true;
    });

    if (harmonizeSequence) {
      // Sort by Camelot wheel progression for smooth DJ flow
      result.sort((a, b) => {
        const keyA = normalizeToCamelotKey(a.key);
        const keyB = normalizeToCamelotKey(b.key);
        const numA = parseInt(keyA, 10) || 8;
        const numB = parseInt(keyB, 10) || 8;
        if (numA !== numB) return numA - numB;
        return (a.bpm || 126) - (b.bpm || 126);
      });
    }

    return result;
  }, [library, minBpm, maxBpm, selectedKey, selectedGenre, harmonizeSequence]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlistName.trim()) return;

    const newPlaylist: Playlist = {
      id: `smart_${Date.now()}`,
      name: playlistName.trim(),
      description: `Slimme DJ afspeellijst: ${minBpm}-${maxBpm} BPM${selectedKey !== 'all' ? ` • Key ${selectedKey}` : ''}`,
      color: 'yellow',
      trackIds: matchingTracks.map((t) => t.id),
      createdAt: new Date().toISOString(),
      isSmartPlaylist: true,
      targetBpmMin: minBpm,
      targetBpmMax: maxBpm,
      targetKey: selectedKey !== 'all' ? selectedKey : undefined,
    };

    onSavePlaylist(newPlaylist);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-6 relative overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center text-yellow-300">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {language === 'nl' ? 'Slimme DJ Afspeellijst Generator' : 'Smart DJ Playlist Generator'}
              </h2>
              <p className="text-xs text-slate-400">
                {language === 'nl'
                  ? 'Genereer automatisch afspeellijsten op basis van BPM en Camelot Keys'
                  : 'Auto-generate playlists based on BPM ranges and Camelot Key matching'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          {/* Playlist Name */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              {language === 'nl' ? 'Naam van afspeellijst' : 'Playlist Name'}
            </label>
            <input
              type="text"
              required
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-yellow-400"
            />
          </div>

          {/* BPM Range Sliders */}
          <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-300 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-yellow-300" />
                BPM Bereik ({minBpm} - {maxBpm} BPM)
              </span>
              <span className="text-yellow-300 font-mono">
                Δ {maxBpm - minBpm} BPM
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-1">
              <div>
                <span className="text-[10px] text-slate-400 block mb-1">Minimale BPM: {minBpm}</span>
                <input
                  type="range"
                  min="60"
                  max="180"
                  step="1"
                  value={minBpm}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setMinBpm(v);
                    if (v > maxBpm) setMaxBpm(v + 4);
                  }}
                  className="w-full accent-yellow-400"
                />
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block mb-1">Maximale BPM: {maxBpm}</span>
                <input
                  type="range"
                  min="60"
                  max="190"
                  step="1"
                  value={maxBpm}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setMaxBpm(v);
                    if (v < minBpm) setMinBpm(Math.max(60, v - 4));
                  }}
                  className="w-full accent-yellow-400"
                />
              </div>
            </div>
          </div>

          {/* Key & Genre Filters */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                {language === 'nl' ? 'Camelot Toonsoort' : 'Root Camelot Key'}
              </label>
              <select
                value={selectedKey}
                onChange={(e) => setSelectedKey(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-yellow-400"
              >
                <option value="all">{language === 'nl' ? 'Alle Toonsoorten' : 'All Keys'}</option>
                {Object.keys(CAMELOT_KEY_MAP).map((k) => (
                  <option key={k} value={k}>
                    {k} ({CAMELOT_KEY_MAP[k].standard})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                {language === 'nl' ? 'Genre' : 'Genre'}
              </label>
              <select
                value={selectedGenre}
                onChange={(e) => setSelectedGenre(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-yellow-400"
              >
                <option value="all">{language === 'nl' ? 'Alle Genres' : 'All Genres'}</option>
                {availableGenres.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Harmonize sequence checkbox */}
          <label className="flex items-center gap-2.5 text-xs text-slate-300 bg-slate-800/40 p-3 rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={harmonizeSequence}
              onChange={(e) => setHarmonizeSequence(e.target.checked)}
              className="rounded accent-yellow-400 w-4 h-4"
            />
            <span>
              {language === 'nl'
                ? 'Harmonisch sorteren (vloeiende Camelot overgangen voor DJ sets)'
                : 'Harmonically sort tracks (smooth Camelot transitions for DJ sets)'}
            </span>
          </label>

          {/* Results preview summary */}
          <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-2xl p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-300" />
              <span className="text-xs font-bold text-white">
                {matchingTracks.length} {language === 'nl' ? 'nummers gevonden' : 'matching tracks'}
              </span>
            </div>
            <span className="text-[11px] text-yellow-200 font-mono font-semibold">
              {Math.floor(matchingTracks.reduce((acc, curr) => acc + (curr.duration || 180), 0) / 60)} min
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs text-slate-400 hover:text-white"
            >
              {language === 'nl' ? 'Annuleren' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={matchingTracks.length === 0}
              className="px-6 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-yellow-400/20 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>{language === 'nl' ? 'Genereer Afspeellijst' : 'Generate Playlist'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
