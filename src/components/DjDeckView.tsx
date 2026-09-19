import React, { useState, useMemo } from 'react';
import { Sliders, Zap, Play, Disc, Sparkles, Filter, Music, ArrowRight, ShieldCheck, Heart } from 'lucide-react';
import { MusicTrack, AppLanguage } from '../types';
import { CAMELOT_KEY_MAP, normalizeToCamelotKey, getCompatibleCamelotKeys, areKeysHarmonicallyCompatible, analyzeTrackBpmAndKey } from '../utils/audioAnalyzer';

interface DjDeckViewProps {
  language: AppLanguage['code'];
  library: MusicTrack[];
  playingTrackId: string | null;
  onPlayTrack: (track: MusicTrack, queue?: MusicTrack[]) => void;
  onPlayQueue: (queue: MusicTrack[]) => void;
  onOpenAddToPlaylist: (track: MusicTrack) => void;
  onUpdateTrack: (track: MusicTrack) => void;
}

export const DjDeckView: React.FC<DjDeckViewProps> = ({
  language,
  library,
  playingTrackId,
  onPlayTrack,
  onPlayQueue,
  onOpenAddToPlaylist,
  onUpdateTrack,
}) => {
  const [selectedCamelotKey, setSelectedCamelotKey] = useState<string>('all');
  const [minBpm, setMinBpm] = useState<number>(115);
  const [maxBpm, setMaxBpm] = useState<number>(135);
  const [referenceTrackId, setReferenceTrackId] = useState<string | null>(
    library.length > 0 ? library[0].id : null
  );

  const referenceTrack = useMemo(
    () => library.find((t) => t.id === referenceTrackId) || library[0] || null,
    [library, referenceTrackId]
  );

  // Filtered tracks for DJ view
  const filteredDjTracks = useMemo(() => {
    return library.filter((track) => {
      const bpm = track.bpm || 126;
      if (bpm < minBpm || bpm > maxBpm) return false;

      if (selectedCamelotKey !== 'all') {
        const trackKey = normalizeToCamelotKey(track.key);
        if (trackKey !== selectedCamelotKey) return false;
      }

      return true;
    });
  }, [library, minBpm, maxBpm, selectedCamelotKey]);

  // Harmonic matches relative to reference track
  const harmonicMatches = useMemo(() => {
    if (!referenceTrack) return [];
    const refKey = normalizeToCamelotKey(referenceTrack.key);

    return library
      .filter((t) => t.id !== referenceTrack.id)
      .map((track) => {
        const comp = areKeysHarmonicallyCompatible(refKey, track.key);
        const bpmDiff = Math.abs((track.bpm || 126) - (referenceTrack.bpm || 126));
        return {
          track,
          isCompatible: comp.isCompatible,
          score: comp.score,
          description: comp.description,
          bpmDiff,
        };
      })
      .filter((item) => item.isCompatible)
      .sort((a, b) => b.score - a.score || a.bpmDiff - b.bpmDiff);
  }, [library, referenceTrack]);

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Top DJ Deck Banner */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 md:p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-yellow-400/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-zinc-800 border border-zinc-700 text-yellow-400 flex items-center justify-center font-black shadow-lg shadow-black/40">
                <Disc className="w-6 h-6 animate-spin text-yellow-400" />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  <span>DJ Harmonic Deck & BPM Matrix</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-yellow-400 text-black font-extrabold">
                    Camelot Wheel
                  </span>
                </h2>
                <p className="text-xs md:text-sm text-zinc-400 font-medium">
                  {language === 'nl'
                    ? 'Filter nummers op tempo, vind perfecte toonsoort-matches en creëer vloeiende mixovergangen.'
                    : 'Filter tracks by tempo, find perfect key matches and build seamless DJ transitions.'}
                </p>
              </div>
            </div>

            {filteredDjTracks.length > 0 && (
              <button
                onClick={() => onPlayQueue(filteredDjTracks)}
                className="px-5 py-2.5 rounded-full bg-yellow-400 hover:bg-yellow-300 text-black font-black text-xs md:text-sm flex items-center gap-2 shadow-lg shadow-yellow-400/20 active:scale-95 transition-all self-start md:self-auto"
              >
                <Play className="w-4 h-4 fill-black" />
                <span>{language === 'nl' ? 'Mix Alles Afspelen' : 'Play DJ Mix'} ({filteredDjTracks.length})</span>
              </button>
            )}
          </div>

          {/* Quick BPM Range & Camelot Wheel Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-zinc-800">
            {/* BPM Range Slider Control */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-white">
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-yellow-400" />
                  BPM Bereik ({minBpm} - {maxBpm} BPM)
                </span>
                <span className="text-yellow-400 font-mono">
                  {filteredDjTracks.length} tracks
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="text-[10px] text-zinc-400 block">Min BPM: {minBpm}</span>
                  <input
                    type="range"
                    min="70"
                    max="180"
                    value={minBpm}
                    onChange={(e) => setMinBpm(Math.min(Number(e.target.value), maxBpm - 2))}
                    className="w-full accent-yellow-400"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 block">Max BPM: {maxBpm}</span>
                  <input
                    type="range"
                    min="70"
                    max="190"
                    value={maxBpm}
                    onChange={(e) => setMaxBpm(Math.max(Number(e.target.value), minBpm + 2))}
                    className="w-full accent-yellow-400"
                  />
                </div>
              </div>
            </div>

            {/* Quick Camelot Key Filter */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-white">
                <span className="flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  Camelot Toonsoort Filter
                </span>
                {selectedCamelotKey !== 'all' && (
                  <button
                    onClick={() => setSelectedCamelotKey('all')}
                    className="text-[10px] text-yellow-400 hover:underline"
                  >
                    Reset Filter
                  </button>
                )}
              </div>

              {/* Camelot Wheel Badges Carousel */}
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                <button
                  onClick={() => setSelectedCamelotKey('all')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    selectedCamelotKey === 'all'
                      ? 'bg-yellow-400 text-black shadow'
                      : 'bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700'
                  }`}
                >
                  Alle
                </button>
                {Object.keys(CAMELOT_KEY_MAP).map((k) => {
                  const meta = CAMELOT_KEY_MAP[k];
                  const isSelected = selectedCamelotKey === k;
                  return (
                    <button
                      key={k}
                      onClick={() => setSelectedCamelotKey(k)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition-all border ${
                        isSelected
                          ? 'bg-yellow-400 text-black border-yellow-400 scale-105 shadow'
                          : `${meta.bgClass} ${meta.textClass} ${meta.borderClass} hover:scale-105`
                      }`}
                      title={`${meta.camelot} - ${meta.standard}`}
                    >
                      {k}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Harmonic Matcher & Mixer Tool */}
      {referenceTrack && (
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 text-[10px] font-bold uppercase tracking-wider">
                  Harmonic Mix Reference
                </span>
                <span className="text-xs text-zinc-400">
                  Selecteer een track om direct compatibele mixkandidaten te zien
                </span>
              </div>
              <h3 className="text-base font-extrabold text-white mt-1">
                Huidige Track: {referenceTrack.artist} - {referenceTrack.title}
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-xl bg-yellow-400/20 text-yellow-400 border border-yellow-400/30 text-xs font-mono font-bold">
                {referenceTrack.bpm || 126} BPM
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-mono font-bold">
                Key: {normalizeToCamelotKey(referenceTrack.key)} ({CAMELOT_KEY_MAP[normalizeToCamelotKey(referenceTrack.key)]?.standard})
              </span>
            </div>
          </div>

          {/* Harmonic Matches Grid */}
          <div>
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <span>Harmonisch Compatibele Nummers ({harmonicMatches.length})</span>
            </h4>

            {harmonicMatches.length === 0 ? (
              <div className="text-center py-8 text-xs text-zinc-400 bg-zinc-950 rounded-2xl border border-zinc-800">
                Geen directe harmonische matches gevonden binnen het huidige BPM bereik. Breid het BPM bereik uit of scan meer nummers!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {harmonicMatches.slice(0, 9).map(({ track, score, description, bpmDiff }) => {
                  const trackKey = normalizeToCamelotKey(track.key);
                  const meta = CAMELOT_KEY_MAP[trackKey];
                  const isPlaying = playingTrackId === track.id;

                  return (
                    <div
                      key={track.id}
                      className={`bg-zinc-950 border rounded-2xl p-3.5 flex items-center justify-between gap-3 transition-all hover:border-yellow-400/50 ${
                        isPlaying ? 'border-yellow-400 bg-yellow-400/10' : 'border-zinc-800'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={track.coverUrl}
                          alt={track.title}
                          className="w-11 h-11 rounded-xl object-cover shrink-0 border border-zinc-800"
                        />
                        <div className="min-w-0">
                          <h5 className="text-xs font-bold text-white truncate">{track.title}</h5>
                          <p className="text-[11px] text-zinc-400 truncate">{track.artist}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-yellow-400/15 text-yellow-400 font-bold">
                              {track.bpm || 126} BPM ({bpmDiff === 0 ? 'Exact' : `±${bpmDiff}`})
                            </span>
                            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${meta?.bgClass || 'bg-purple-500/20'} ${meta?.textClass || 'text-purple-300'}`}>
                              {trackKey}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => setReferenceTrackId(track.id)}
                          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-[10px] font-bold transition-colors"
                          title="Stel in als nieuwe mixreferentie"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onPlayTrack(track, harmonicMatches.map((m) => m.track))}
                          className="w-8 h-8 rounded-full bg-yellow-400 text-black flex items-center justify-center hover:scale-105 transition-transform shadow"
                        >
                          <Play className="w-3.5 h-3.5 fill-black ml-0.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filtered Tracks Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Music className="w-4 h-4 text-yellow-400" />
            <span>Alle DJ Tracks ({filteredDjTracks.length})</span>
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 uppercase tracking-wider font-mono">
              <tr>
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">Titel & Artiest</th>
                <th className="py-3 px-4 text-center">BPM</th>
                <th className="py-3 px-4 text-center">Camelot Key</th>
                <th className="py-3 px-4 text-center">Toonsoort</th>
                <th className="py-3 px-4 text-right">Duur</th>
                <th className="py-3 px-4 text-center w-28">Acties</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80 text-zinc-200">
              {filteredDjTracks.map((track, idx) => {
                const isPlaying = playingTrackId === track.id;
                const isRef = referenceTrackId === track.id;
                const trackKey = normalizeToCamelotKey(track.key);
                const meta = CAMELOT_KEY_MAP[trackKey];

                return (
                  <tr
                    key={track.id}
                    className={`hover:bg-zinc-800/50 transition-colors ${
                      isPlaying ? 'bg-yellow-400/10' : ''
                    } ${isRef ? 'bg-zinc-800/30' : ''}`}
                  >
                    <td className="py-3 px-4 text-center font-mono text-zinc-500">
                      {idx + 1}
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={track.coverUrl}
                          alt={track.title}
                          className="w-10 h-10 rounded-xl object-cover shrink-0 border border-zinc-800"
                        />
                        <div className="min-w-0">
                          <p
                            onClick={() => onPlayTrack(track, filteredDjTracks)}
                            className="font-bold text-white truncate hover:text-yellow-400 cursor-pointer"
                          >
                            {track.title}
                          </p>
                          <p className="text-[11px] text-zinc-400 truncate">{track.artist}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-center font-mono font-bold text-yellow-400">
                      {track.bpm || 126} <span className="text-[10px] text-zinc-500 font-normal">BPM</span>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${meta?.bgClass || 'bg-purple-500/20'} ${meta?.textClass || 'text-purple-300'} ${meta?.borderClass || 'border-purple-500/40'}`}>
                        {trackKey}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center text-zinc-400 text-[11px] font-medium">
                      {meta?.standard || 'A minor'}
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-zinc-400">
                      {track.durationFormatted}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setReferenceTrackId(track.id)}
                          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                          title="Selecteer als Harmonic Match referentie"
                        >
                          <Zap className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => onPlayTrack(track, filteredDjTracks)}
                          className="p-1.5 rounded-lg bg-yellow-400 text-black hover:bg-yellow-300 transition-all shadow"
                          title="Afspelen"
                        >
                          <Play className="w-3.5 h-3.5 fill-black" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
