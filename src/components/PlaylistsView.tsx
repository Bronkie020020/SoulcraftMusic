import React, { useState, useMemo } from 'react';
import {
  ListMusic,
  Plus,
  Sparkles,
  Play,
  Shuffle,
  Trash2,
  Edit3,
  Download,
  Music2,
  ArrowUpDown,
  Check,
  Disc,
  Layers,
  ChevronLeft,
  Share2,
  FileSpreadsheet,
  FileCode,
} from 'lucide-react';
import { MusicTrack, Playlist, AppLanguage } from '../types';
import { CAMELOT_KEY_MAP, normalizeToCamelotKey, generateM3uPlaylist } from '../utils/audioAnalyzer';
import { exportLibraryAsExcel, exportLibraryAsJson } from '../utils/libraryExporter';

interface PlaylistsViewProps {
  language: AppLanguage['code'];
  playlists: Playlist[];
  library: MusicTrack[];
  playingTrackId: string | null;
  onPlayTrack: (track: MusicTrack, queue?: MusicTrack[]) => void;
  onPlayQueue: (queue: MusicTrack[]) => void;
  onOpenCreatePlaylist: () => void;
  onOpenSmartPlaylist: () => void;
  onUpdatePlaylists: (playlists: Playlist[]) => void;
  onDeletePlaylist: (playlistId: string) => void;
  onRemoveTrackFromPlaylist: (playlistId: string, trackId: string) => void;
}

export const PlaylistsView: React.FC<PlaylistsViewProps> = ({
  language,
  playlists,
  library,
  playingTrackId,
  onPlayTrack,
  onPlayQueue,
  onOpenCreatePlaylist,
  onOpenSmartPlaylist,
  onUpdatePlaylists,
  onDeletePlaylist,
  onRemoveTrackFromPlaylist,
}) => {
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);

  // Selected playlist object & its actual tracks
  const selectedPlaylist = useMemo(
    () => playlists.find((p) => p.id === selectedPlaylistId) || null,
    [playlists, selectedPlaylistId]
  );

  const playlistTracks = useMemo(() => {
    if (!selectedPlaylist) return [];
    return selectedPlaylist.trackIds
      .map((id) => library.find((t) => t.id === id))
      .filter(Boolean) as MusicTrack[];
  }, [selectedPlaylist, library]);

  // Export Playlist as .M3U file
  const handleExportM3u = (playlist: Playlist, tracks: MusicTrack[]) => {
    const m3uContent = generateM3uPlaylist(playlist, tracks);
    const blob = new Blob([m3uContent], { type: 'audio/x-mpegurl;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${playlist.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.m3u8`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Harmonize track sequence (Sort by Camelot Wheel + BPM for seamless DJ set flow)
  const handleHarmonizeSequence = () => {
    if (!selectedPlaylist) return;
    const sorted = [...playlistTracks].sort((a, b) => {
      const keyA = normalizeToCamelotKey(a.key);
      const keyB = normalizeToCamelotKey(b.key);
      const numA = parseInt(keyA, 10) || 8;
      const numB = parseInt(keyB, 10) || 8;
      if (numA !== numB) return numA - numB;
      return (a.bpm || 126) - (b.bpm || 126);
    });

    const updatedPlaylists = playlists.map((p) => {
      if (p.id === selectedPlaylist.id) {
        return { ...p, trackIds: sorted.map((t) => t.id) };
      }
      return p;
    });

    onUpdatePlaylists(updatedPlaylists);
  };

  // DETAIL VIEW FOR A SINGLE PLAYLIST
  if (selectedPlaylist) {
    const totalDuration = playlistTracks.reduce((acc, curr) => acc + (curr.duration || 180), 0);
    const avgBpm =
      playlistTracks.length > 0
        ? Math.round(
            playlistTracks.reduce((acc, curr) => acc + (curr.bpm || 126), 0) / playlistTracks.length
          )
        : 126;

    return (
      <div className="space-y-6 animate-fade-in">
        {/* Back Button & Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedPlaylistId(null)}
            className="px-4 py-2 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white font-bold text-xs flex items-center gap-2 transition-all shadow"
          >
            <ChevronLeft className="w-4 h-4 text-yellow-400" />
            <span>{language === 'nl' ? 'Terug naar alle Afspeellijsten' : 'Back to Playlists'}</span>
          </button>
        </div>

        {/* Playlist Hero Bento Card */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6">
            
            {/* 2x2 Artwork Mosaic */}
            <div className="w-32 h-32 md:w-36 md:h-36 rounded-2xl overflow-hidden border border-zinc-800 shadow-xl grid grid-cols-2 grid-rows-2 bg-zinc-950 shrink-0">
              {playlistTracks.slice(0, 4).map((t, idx) => (
                <img
                  key={t.id + idx}
                  src={t.coverUrl}
                  alt={t.title}
                  className="w-full h-full object-cover"
                />
              ))}
              {playlistTracks.length === 0 && (
                <div className="col-span-2 row-span-2 flex items-center justify-center text-yellow-400">
                  <ListMusic className="w-12 h-12" />
                </div>
              )}
            </div>

            {/* Meta info */}
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="px-3 py-0.5 rounded-full bg-yellow-400 text-black text-[10px] font-black uppercase tracking-wider">
                  {selectedPlaylist.isSmartPlaylist ? 'Slimme DJ Afspeellijst' : 'Afspeellijst'}
                </span>
                <span className="text-xs text-zinc-400 font-mono">
                  {playlistTracks.length} {language === 'nl' ? 'nummers' : 'tracks'} • {Math.floor(totalDuration / 60)} min
                </span>
              </div>

              <h2 className="text-2xl md:text-3xl font-black text-white truncate">
                {selectedPlaylist.name}
              </h2>
              <p className="text-xs md:text-sm text-zinc-400 font-medium">
                {selectedPlaylist.description || 'Persoonlijke samengestelde afspeellijst'}
              </p>

              {/* Stats pill */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <span className="px-3 py-1 rounded-xl bg-zinc-950 text-yellow-400 border border-zinc-800 text-xs font-mono font-bold">
                  ⚡ Gem. Tempo: {avgBpm} BPM
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 self-stretch md:self-auto justify-end">
              <button
                onClick={() => onPlayQueue(playlistTracks)}
                disabled={playlistTracks.length === 0}
                className="px-5 py-2.5 rounded-full bg-yellow-400 hover:bg-yellow-300 text-black font-extrabold text-xs md:text-sm flex items-center gap-2 shadow-lg shadow-yellow-400/20 active:scale-95 disabled:opacity-50 transition-all"
              >
                <Play className="w-4 h-4 fill-black" />
                <span>{language === 'nl' ? 'Alles Afspelen' : 'Play All'}</span>
              </button>

              <button
                onClick={() => {
                  const shuffled = [...playlistTracks].sort(() => Math.random() - 0.5);
                  onPlayQueue(shuffled);
                }}
                disabled={playlistTracks.length === 0}
                className="px-4 py-2.5 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-bold text-xs flex items-center gap-2 active:scale-95 disabled:opacity-50 transition-all"
              >
                <Shuffle className="w-4 h-4 text-yellow-400" />
                <span>Shuffle</span>
              </button>

              <button
                onClick={handleHarmonizeSequence}
                disabled={playlistTracks.length < 2}
                className="px-4 py-2.5 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-yellow-400 font-bold text-xs flex items-center gap-2 active:scale-95 disabled:opacity-50 transition-all"
                title="Harmonisch sorteren (vloeiende Camelot overgang)"
              >
                <Sparkles className="w-4 h-4 text-yellow-400" />
                <span>Harmoniseer Volgorde</span>
              </button>

              <button
                onClick={() => handleExportM3u(selectedPlaylist, playlistTracks)}
                disabled={playlistTracks.length === 0}
                className="px-4 py-2.5 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-cyan-400 font-bold text-xs flex items-center gap-2 active:scale-95 disabled:opacity-50 transition-all"
                title="Exporteer als M3U8 bestand voor Rekordbox, Serato, Traktor, Virtual DJ"
              >
                <Download className="w-4 h-4 text-cyan-400" />
                <span>M3U (DJ)</span>
              </button>

              <button
                onClick={() =>
                  exportLibraryAsExcel(playlistTracks, {
                    filename: `playlist_${selectedPlaylist.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toISOString().slice(0, 10)}.xls`,
                    playlists: [selectedPlaylist],
                  })
                }
                disabled={playlistTracks.length === 0}
                className="px-4 py-2.5 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-emerald-400 font-bold text-xs flex items-center gap-2 active:scale-95 disabled:opacity-50 transition-all"
                title="Exporteer deze afspeellijst inclusief bestandspaden naar Excel"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Excel</span>
              </button>

              <button
                onClick={() =>
                  exportLibraryAsJson(playlistTracks, {
                    filename: `playlist_${selectedPlaylist.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`,
                    playlists: [selectedPlaylist],
                  })
                }
                disabled={playlistTracks.length === 0}
                className="px-4 py-2.5 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-blue-400 font-bold text-xs flex items-center gap-2 active:scale-95 disabled:opacity-50 transition-all"
                title="Exporteer deze afspeellijst naar JSON backup"
              >
                <FileCode className="w-4 h-4 text-blue-400" />
                <span>JSON</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tracks in this playlist */}
        {playlistTracks.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-12 text-center space-y-3">
            <Music2 className="w-12 h-12 mx-auto text-zinc-600" />
            <h4 className="text-base font-bold text-white">Deze afspeellijst is nog leeg</h4>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              Voeg nummers toe via het 'Toevoegen aan afspeellijst' icoon op elk gewenst nummer in de bibliotheek of downloader.
            </p>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 uppercase tracking-wider font-mono">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">Titel & Artiest</th>
                    <th className="py-3 px-4 text-center">BPM</th>
                    <th className="py-3 px-4 text-center">Key</th>
                    <th className="py-3 px-4 hidden sm:table-cell">Genre</th>
                    <th className="py-3 px-4 text-right">Duur</th>
                    <th className="py-3 px-4 text-center w-24">Acties</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80 text-zinc-200">
                  {playlistTracks.map((track, idx) => {
                    const isPlaying = playingTrackId === track.id;
                    const trackKey = normalizeToCamelotKey(track.key);
                    const meta = CAMELOT_KEY_MAP[trackKey];

                    return (
                      <tr
                        key={track.id}
                        className={`hover:bg-zinc-800/50 transition-colors group ${
                          isPlaying ? 'bg-yellow-400/10' : ''
                        }`}
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
                                onClick={() => onPlayTrack(track, playlistTracks)}
                                className="font-bold text-white truncate hover:text-yellow-400 cursor-pointer"
                              >
                                {track.title}
                              </p>
                              <p className="text-[11px] text-zinc-400 truncate">{track.artist}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-center font-mono font-bold text-yellow-400">
                          {track.bpm || 126}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold border ${meta?.bgClass || 'bg-purple-500/20'} ${meta?.textClass || 'text-purple-300'} ${meta?.borderClass || 'border-purple-500/40'}`}>
                            {trackKey}
                          </span>
                        </td>

                        <td className="py-3 px-4 hidden sm:table-cell text-zinc-400">
                          {track.genre || 'Pop'}
                        </td>

                        <td className="py-3 px-4 text-right font-mono text-zinc-400">
                          {track.durationFormatted}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => onPlayTrack(track, playlistTracks)}
                              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                              title="Afspelen"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                            </button>

                            <button
                              onClick={() => onRemoveTrackFromPlaylist(selectedPlaylist.id, track.id)}
                              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-red-400 transition-colors"
                              title="Verwijder uit afspeellijst"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
        )}
      </div>
    );
  }

  // OVERVIEW OF ALL PLAYLISTS
  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Top Banner & Creation Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/90 border border-zinc-800 p-6 rounded-3xl shadow-xl">
        <div className="space-y-1">
          <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <ListMusic className="w-6 h-6 text-yellow-400" />
            <span>Mijn Afspeellijsten ({playlists.length})</span>
          </h2>
          <p className="text-xs text-zinc-400">
            Creëer handmatige afspeellijsten of laat de slimme DJ generator harmonische sets samenstellen op basis van BPM en Key.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenSmartPlaylist}
            className="px-5 py-2.5 rounded-full bg-yellow-400 hover:bg-yellow-300 text-black font-black text-xs md:text-sm flex items-center gap-2 shadow-lg shadow-yellow-400/20 active:scale-95 transition-all"
          >
            <Sparkles className="w-4 h-4 text-black" />
            <span>Slimme DJ Generator</span>
          </button>

          <button
            onClick={onOpenCreatePlaylist}
            className="px-5 py-2.5 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-bold text-xs md:text-sm flex items-center gap-2 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4 text-yellow-400" />
            <span>Nieuwe Afspeellijst</span>
          </button>
        </div>
      </div>

      {/* Playlists Grid */}
      {playlists.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-zinc-800 border border-zinc-700 flex items-center justify-center mx-auto text-yellow-400">
            <ListMusic className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">Nog geen afspeellijsten</h3>
            <p className="text-xs md:text-sm text-zinc-400 max-w-md mx-auto">
              Maak een nieuwe afspeellijst aan of gebruik de Slimme DJ Generator om direct een set te genereren van je gedownloade nummers.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={onOpenSmartPlaylist}
              className="px-6 py-2.5 rounded-full bg-yellow-400 hover:bg-yellow-300 text-black font-black text-xs transition-all shadow-lg shadow-yellow-400/20"
            >
              Slimme Generator Starten
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {playlists.map((pl) => {
            const tracksInPl = pl.trackIds
              .map((id) => library.find((t) => t.id === id))
              .filter(Boolean) as MusicTrack[];
            const totalDuration = tracksInPl.reduce((acc, curr) => acc + (curr.duration || 180), 0);
            const avgBpm =
              tracksInPl.length > 0
                ? Math.round(
                    tracksInPl.reduce((acc, curr) => acc + (curr.bpm || 126), 0) / tracksInPl.length
                  )
                : 126;

            return (
              <div
                key={pl.id}
                onClick={() => setSelectedPlaylistId(pl.id)}
                className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-3xl p-5 flex flex-col justify-between space-y-4 transition-all group cursor-pointer shadow-xl hover:shadow-2xl"
              >
                {/* 2x2 Mosaic artwork */}
                <div className="relative aspect-square rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 shadow-md grid grid-cols-2 grid-rows-2">
                  {tracksInPl.slice(0, 4).map((t, i) => (
                    <img
                      key={t.id + i}
                      src={t.coverUrl}
                      alt={t.title}
                      className="w-full h-full object-cover"
                    />
                  ))}
                  {tracksInPl.length === 0 && (
                    <div className="col-span-2 row-span-2 flex items-center justify-center text-yellow-400">
                      <ListMusic className="w-12 h-12" />
                    </div>
                  )}

                  {/* Play Button Hover Overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlayQueue(tracksInPl);
                      }}
                      disabled={tracksInPl.length === 0}
                      className="w-12 h-12 rounded-full bg-yellow-400 text-black flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-transform"
                    >
                      <Play className="w-5 h-5 fill-black ml-0.5" />
                    </button>
                  </div>
                </div>

                {/* Playlist Info */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-white truncate group-hover:text-yellow-400 transition-colors">
                      {pl.name}
                    </h3>
                  </div>
                  <p className="text-xs text-zinc-400 truncate">
                    {pl.description || `${tracksInPl.length} nummers`}
                  </p>
                </div>

                {/* Stats & Actions Footer */}
                <div className="pt-3 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-zinc-950 text-[10px] font-mono text-yellow-400 font-bold border border-zinc-800">
                      {tracksInPl.length} tracks
                    </span>
                    <span className="text-[11px] font-mono">{avgBpm} BPM</span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeletePlaylist(pl.id);
                    }}
                    className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-red-400 transition-colors"
                    title="Afspeellijst Verwijderen"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
