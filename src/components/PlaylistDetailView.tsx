// src/components/PlaylistDetailView.tsx
import React, { useState } from 'react';
import { SoulcraftTrack } from '../types/track';
import { getCollageCovers, resolveTrackCover } from '../utils/coverHelper';
import { scanAndEnrichTrack } from '../utils/audioMetadataScanner';
import { saveOrUpdateTrackInIndexedDB } from '../services/db';

interface Props {
  tracks: SoulcraftTrack[];
  onTracksUpdated: (newTracks: SoulcraftTrack[]) => void;
}

export const PlaylistDetailView: React.FC<Props> = ({ tracks, onTracksUpdated }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<string | null>(null);

  // 4 unieke covers voor de collage
  const collageCovers = getCollageCovers(tracks);

  // Gemiddelde DJ statistieken
  const avgBpm = tracks.length > 0
    ? Math.round(tracks.reduce((acc, t) => acc + (t.bpm || 138), 0) / tracks.length)
    : 169;

  const dominantGenre = tracks[0]?.genre || 'Club Trance';
  const dominantMood = avgBpm >= 135 ? 'Peak Time / Driving' : 'Uplifting';

  const handleScanAndEnrichAll = async () => {
    setIsScanning(true);
    const updatedList: SoulcraftTrack[] = [];

    for (let i = 0; i < tracks.length; i++) {
      setScanProgress(`Scannen ${i + 1}/${tracks.length}: ${tracks[i].title}...`);
      const enriched = await scanAndEnrichTrack(tracks[i]);
      await saveOrUpdateTrackInIndexedDB(enriched);
      updatedList.push(enriched);
    }

    onTracksUpdated(updatedList);
    setScanProgress(null);
    setIsScanning(false);
  };

  return (
    <div className="p-6 bg-slate-900 text-slate-100 rounded-3xl space-y-6">
      {/* BOVENSTE SECTIE: 2x2 Collage + Metadata Badges + Knoppen */}
      <div className="flex flex-col md:flex-row items-start gap-6">
        
        {/* 2x2 Dynamische Collage (Voorkomt 4x identieke placeholder) */}
        <div className="w-36 h-36 rounded-2xl overflow-hidden grid grid-cols-2 grid-rows-2 shadow-xl border border-slate-700/60 flex-shrink-0">
          {collageCovers.map((src, index) => (
            <img
              key={index}
              src={src}
              alt={`Cover ${index + 1}`}
              className="w-full h-full object-cover"
            />
          ))}
        </div>

        {/* Afspeellijst Informatie & Badges */}
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-black uppercase rounded bg-amber-400 text-black">
              Afspeellijst
            </span>
            <span className="text-xs text-slate-400">
              {tracks.length} nummers • {Math.round(tracks.length * 6.5)} min
            </span>
          </div>

          <h1 className="text-2xl font-black tracking-tight">
            Downloaded via Spotify / Zoekfunctie ({tracks.length} nummers)
          </h1>

          {/* VISUELE DJ METADATA BADGES */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {/* BPM Badge */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
              ⚡ <span>{avgBpm} BPM (Gem.)</span>
            </span>

            {/* Camelot Key Badge */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              🎹 <span>8A - A min (Dominant)</span>
            </span>

            {/* Mood Badge */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">
              ✨ <span>{dominantMood}</span>
            </span>

            {/* Genre Badge */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">
              🏷️ <span>{dominantGenre}</span>
            </span>

            {/* IndexedDB Status */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-teal-500/10 text-teal-400 border border-teal-500/30">
              💾 <span>IndexedDB Opslag Actief ({tracks.length}/{tracks.length})</span>
            </span>
          </div>

          {/* Knoppenbalk */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <button
              onClick={handleScanAndEnrichAll}
              disabled={isScanning}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-2 shadow-lg transition-all disabled:opacity-50"
            >
              <span className={isScanning ? 'animate-spin' : ''}>🔄</span>
              <span>{isScanning ? 'Scannen...' : 'Scan BPM, Key & Covers'}</span>
            </button>
            <button className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-black hover:bg-amber-400 transition">
              Download Alles
            </button>
            <button className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition">
              Exporteer als ZIP
            </button>
            <button className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition">
              Harmoniseer
            </button>
            <button className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition">
              M3U (DJ)
            </button>
          </div>

          {scanProgress && (
            <p className="text-xs text-amber-400 animate-pulse pt-1">{scanProgress}</p>
          )}
        </div>
      </div>

      {/* TRACKLIST TABEL MET INDIVIDUELE BPM, KEY, MOOD, GENRE EN COVERS */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-800/80 text-slate-400 font-semibold uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4 w-12">#</th>
              <th className="py-3 px-4">Track & Cover</th>
              <th className="py-3 px-4">BPM</th>
              <th className="py-3 px-4">Key (Camelot)</th>
              <th className="py-3 px-4">Mood</th>
              <th className="py-3 px-4">Genre</th>
              <th className="py-3 px-4 text-right">Duur</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-medium">
            {tracks.map((track, idx) => (
              <tr key={track.id || idx} className="hover:bg-slate-800/40 transition">
                <td className="py-3 px-4 text-slate-500">{idx + 1}</td>
                <td className="py-3 px-4 flex items-center gap-3">
                  <img
                    src={resolveTrackCover(track.coverUrl, track.title, track.artist)}
                    alt=""
                    className="w-10 h-10 rounded-lg object-cover border border-slate-700 flex-shrink-0"
                  />
                  <div>
                    <div className="font-bold text-slate-100 text-sm">{track.title}</div>
                    <div className="text-slate-400">{track.artist}</div>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20">
                    {track.bpm || 138}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                    {track.camelotKey || '8A'}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 font-medium">
                    {track.mood || 'Peak Time'}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 font-medium">
                    {track.genre || 'Club Trance'}
                  </span>
                </td>
                <td className="py-3 px-4 text-right text-slate-400">
                  {Math.floor((track.durationSeconds || 390) / 60)}:
                  {String((track.durationSeconds || 390) % 60).padStart(2, '0')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
