import React, { useState, useMemo, useEffect } from 'react';
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
  FileArchive,
  Folder,
  FolderDown,
  Loader2,
  CheckCircle2,
  Clock,
  HardDrive,
  Zap,
  Wand2,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  Flag,
  Activity,
  Sliders,
  X,
} from 'lucide-react';
import { MusicTrack, Playlist, AppLanguage } from '../types';
import { CAMELOT_KEY_MAP, normalizeToCamelotKey, generateM3uPlaylist } from '../utils/audioAnalyzer';
import { exportLibraryAsExcel, exportLibraryAsJson } from '../utils/libraryExporter';
import { useDownload } from '../context/DownloadContext';
import { exportPlaylistToZip } from '../utils/zipExporter';
import { savePlaylistToDb, saveTrackToDb, StoredPlaylist } from '../db/libraryDb';
import { getCollageCovers, resolveTrackCover } from '../utils/coverHelper';
import { scanAndEnrichTrack } from '../utils/audioMetadataScanner';
import {
  generateHotCues,
  cleanAndFormatMetadata,
  scanAndCheckAudioHealth,
  HotCuePoint,
  HeaderScanResult,
  MetadataFixResult,
} from '../utils/djStudioTools';

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
  const [isExportingZip, setIsExportingZip] = useState<boolean>(false);
  const [zipProgressText, setZipProgressText] = useState<string | null>(null);

  // DJ Studio, Metadata Scanner, Hot Cues, AI Fixer & Health Scanner states
  const [tracksOverride, setTracksOverride] = useState<Record<string, MusicTrack>>({});
  const [isScanningMetadata, setIsScanningMetadata] = useState(false);
  const [metadataScanProgress, setMetadataScanProgress] = useState<string | null>(null);
  const [hotCuesMap, setHotCuesMap] = useState<Record<string, HotCuePoint[]>>({});
  const [isFixingMetadata, setIsFixingMetadata] = useState(false);
  const [isScanningHealth, setIsScanningHealth] = useState(false);
  const [healthScanResults, setHealthScanResults] = useState<HeaderScanResult[] | null>(null);
  const [aiFixResults, setAiFixResults] = useState<MetadataFixResult[] | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'health' | 'ai' | null>(null);

  // Global download manager context
  const { enqueueDownload, enqueueBatchDownloads, getTrackStatus } = useDownload();

  // Selected playlist object & its strictly isolated tracks
  const selectedPlaylist = useMemo(
    () => playlists.find((p) => p.id === selectedPlaylistId) || null,
    [playlists, selectedPlaylistId]
  );

  // Strict Playlist Separation: only tracks explicitly belonging to this playlistId
  const rawPlaylistTracks = useMemo(() => {
    if (!selectedPlaylist) return [];
    const idSet = new Set(selectedPlaylist.trackIds || []);
    const ordered = (selectedPlaylist.trackIds || [])
      .map((id) => library.find((t) => t.id === id))
      .filter(Boolean) as MusicTrack[];
    const additional = library.filter((t) => t.playlistId === selectedPlaylist.id && !idSet.has(t.id));
    return [...ordered, ...additional];
  }, [selectedPlaylist, library]);

  // Merge with locally enriched studio attributes (BPM, Key, Mood, Cleaned Title, etc.)
  const playlistTracks = useMemo(() => {
    return rawPlaylistTracks.map((t) => tracksOverride[t.id] || t);
  }, [rawPlaylistTracks, tracksOverride]);

  // 1. 🔄 Scan and enrich all tracks for active playlist
  const handleScanAndEnrichAll = async () => {
    if (!selectedPlaylist || playlistTracks.length === 0 || isScanningMetadata) return;
    setIsScanningMetadata(true);

    const newOverrides: Record<string, MusicTrack> = {};

    for (let i = 0; i < playlistTracks.length; i++) {
      const current = playlistTracks[i];
      setMetadataScanProgress(`[${i + 1}/${playlistTracks.length}] Scannen: ${current.title}...`);

      try {
        const enriched = await scanAndEnrichTrack({
          id: current.id,
          title: current.title,
          artist: current.artist,
          durationSeconds: current.duration || 180,
          bpm: current.bpm,
          key: current.key,
          camelotKey: current.camelotKey,
          genre: current.genre,
          mood: current.mood,
          coverUrl: current.coverUrl,
        });

        const updatedTrack: MusicTrack = {
          ...current,
          bpm: enriched.bpm,
          key: enriched.key,
          camelotKey: enriched.camelotKey,
          genre: enriched.genre || current.genre,
          mood: enriched.mood,
          coverUrl: enriched.coverUrl || current.coverUrl,
        };

        newOverrides[current.id] = updatedTrack;

        await saveTrackToDb({
          id: updatedTrack.id,
          playlistId: selectedPlaylist.id,
          title: updatedTrack.title,
          artist: updatedTrack.artist,
          duration: updatedTrack.duration || 180,
          savedAt: Date.now(),
          bpm: updatedTrack.bpm,
          key: updatedTrack.key,
          coverUrl: updatedTrack.coverUrl,
          album: updatedTrack.album,
        });
      } catch (err) {
        console.warn(`Scan note for ${current.title}:`, err);
      }
    }

    setTracksOverride((prev) => ({ ...prev, ...newOverrides }));
    setMetadataScanProgress(null);
    setIsScanningMetadata(false);
  };

  // 2. ⚡ Auto Hot Cues & Memory Points Generator
  const handleGenerateAutoHotCues = () => {
    if (!selectedPlaylist || playlistTracks.length === 0) return;
    const newCuesMap: Record<string, HotCuePoint[]> = {};
    playlistTracks.forEach((t) => {
      newCuesMap[t.id] = generateHotCues(t);
    });
    setHotCuesMap((prev) => ({ ...prev, ...newCuesMap }));
  };

  // 3. 🤖 AI Smart Metadata Fixer (Google Gemini + Local Regex Fallback)
  const handleFixMetadataAll = async () => {
    if (!selectedPlaylist || playlistTracks.length === 0 || isFixingMetadata) return;
    setIsFixingMetadata(true);
    const fixes: MetadataFixResult[] = [];
    const newOverrides: Record<string, MusicTrack> = {};

    for (let i = 0; i < playlistTracks.length; i++) {
      const t = playlistTracks[i];
      setMetadataScanProgress(`[${i + 1}/${playlistTracks.length}] AI Opschonen: ${t.title}...`);
      const fixRes = await cleanAndFormatMetadata(t);
      fixes.push(fixRes);

      if (fixRes.changed) {
        const updated: MusicTrack = {
          ...t,
          title: fixRes.cleanedTitle,
          artist: fixRes.cleanedArtist,
        };
        newOverrides[t.id] = updated;

        await saveTrackToDb({
          id: updated.id,
          playlistId: selectedPlaylist.id,
          title: updated.title,
          artist: updated.artist,
          duration: updated.duration || 180,
          savedAt: Date.now(),
        });
      }
    }

    if (Object.keys(newOverrides).length > 0) {
      setTracksOverride((prev) => ({ ...prev, ...newOverrides }));
    }

    setAiFixResults(fixes);
    setActiveModalTab('ai');
    setMetadataScanProgress(null);
    setIsFixingMetadata(false);
  };

  // 4. 🛠️ Broken Files & Corrupt Header Scanner
  const handleScanAudioHealth = async () => {
    if (!selectedPlaylist || playlistTracks.length === 0 || isScanningHealth) return;
    setIsScanningHealth(true);
    setMetadataScanProgress('Audiobestand-headers en integriteit scannen...');

    const results = await scanAndCheckAudioHealth(playlistTracks);
    setHealthScanResults(results);
    setActiveModalTab('health');
    setMetadataScanProgress(null);
    setIsScanningHealth(false);
  };

  // Sync playlist metadata to IndexedDB when created or selected
  useEffect(() => {
    if (selectedPlaylist) {
      const storedPl: StoredPlaylist = {
        id: selectedPlaylist.id,
        name: selectedPlaylist.name,
        coverUrl: selectedPlaylist.coverUrl || playlistTracks[0]?.coverUrl,
        createdAt: selectedPlaylist.createdAt ? new Date(selectedPlaylist.createdAt).getTime() : Date.now(),
        description: selectedPlaylist.description,
        color: selectedPlaylist.color,
      };
      savePlaylistToDb(storedPl).catch((err) => console.warn('Sync playlist to IndexedDB note:', err));
    }
  }, [selectedPlaylist, playlistTracks]);

  // Batch "Download Alles" Action for Active Playlist
  const handleDownloadAllPlaylistTracks = () => {
    if (!selectedPlaylist || playlistTracks.length === 0) return;
    enqueueBatchDownloads(playlistTracks, selectedPlaylist.id, undefined, selectedPlaylist.name);
  };

  // Batch "Exporteer als ZIP" Action from IndexedDB audio Blobs
  const handleExportPlaylistZip = async () => {
    if (!selectedPlaylist || playlistTracks.length === 0 || isExportingZip) return;
    setIsExportingZip(true);
    setZipProgressText(language === 'nl' ? 'Audiobestanden ophalen...' : 'Fetching audio files...');

    try {
      await exportPlaylistToZip(selectedPlaylist.id, selectedPlaylist.name, (info) => {
        setZipProgressText(`${info.percent}% • ${info.currentTitle}`);
      });
      setZipProgressText(language === 'nl' ? 'ZIP gereed!' : 'ZIP ready!');
      setTimeout(() => setZipProgressText(null), 3000);
    } catch (err: any) {
      console.error('ZIP export error:', err);
      alert(err?.message || (language === 'nl' ? 'Fout bij het maken van ZIP archief' : 'Error generating ZIP archive'));
      setZipProgressText(null);
    } finally {
      setIsExportingZip(false);
    }
  };

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

  // DETAIL VIEW FOR A STRICTLY ISOLATED SINGLE PLAYLIST
  if (selectedPlaylist) {
    const totalDuration = playlistTracks.reduce((acc, curr) => acc + (curr.duration || 180), 0);
    const avgBpm =
      playlistTracks.length > 0
        ? Math.round(
            playlistTracks.reduce((acc, curr) => acc + (curr.bpm || 126), 0) / playlistTracks.length
          )
        : 126;

    const downloadedCount = playlistTracks.filter((t) => getTrackStatus(t.id).isCompleted || t.isDownloaded).length;

    return (
      <div className="space-y-6 animate-fade-in">
        {/* Back Button & Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedPlaylistId(null)}
            className="px-4 py-2 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white font-bold text-xs flex items-center gap-2 transition-all shadow"
          >
            <ChevronLeft className="w-4 h-4 text-yellow-400" />
            <span>{language === 'nl' ? 'Terug naar alle Afspeellijsten' : 'Back to Playlists'}</span>
          </button>

          <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>{downloadedCount}/{playlistTracks.length} lokaal opgeslagen</span>
          </div>
        </div>

        {/* Playlist Hero Bento Card */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6">
            
            {/* 2x2 Dynamic Artwork Collage (Voorkomt 4x identieke placeholders) */}
            <div className="w-32 h-32 md:w-36 md:h-36 rounded-2xl overflow-hidden border border-zinc-800 shadow-xl grid grid-cols-2 grid-rows-2 bg-zinc-950 shrink-0">
              {getCollageCovers(playlistTracks).map((coverSrc, idx) => (
                <img
                  key={idx}
                  src={coverSrc}
                  alt={`Artwork ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              ))}
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
                {selectedPlaylist.description || (language === 'nl' ? 'Strikte afspeellijst map • Geïsoleerde weergave' : 'Strict playlist directory')}
              </p>

              {/* VISUELE DJ METADATA BADGES */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <span className="px-3 py-1 rounded-xl bg-zinc-950 text-yellow-400 border border-zinc-800 text-xs font-mono font-bold">
                  ⚡ Gem. {avgBpm} BPM
                </span>
                <span className="px-3 py-1 rounded-xl bg-zinc-950 text-purple-400 border border-zinc-800 text-xs font-mono font-bold">
                  🎹 {playlistTracks[0]?.key ? normalizeToCamelotKey(playlistTracks[0].key) : '8A'} (Dominant)
                </span>
                <span className="px-3 py-1 rounded-xl bg-zinc-950 text-pink-400 border border-zinc-800 text-xs font-mono font-bold">
                  ✨ {avgBpm >= 135 ? 'Peak Time / Driving' : avgBpm >= 124 ? 'Uplifting / Club' : 'Melodic / Deep'}
                </span>
                <span className="px-3 py-1 rounded-xl bg-zinc-950 text-blue-400 border border-zinc-800 text-xs font-mono font-bold">
                  🏷️ {playlistTracks[0]?.genre || 'House / Electronic'}
                </span>
                <span className="px-3 py-1 rounded-xl bg-zinc-950 text-emerald-400 border border-zinc-800 text-xs font-mono font-bold flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5" />
                  IndexedDB ({downloadedCount}/{playlistTracks.length})
                </span>
                <span className="px-3 py-1 rounded-xl bg-zinc-950 text-amber-400 border border-zinc-800 text-xs font-mono font-bold flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  Hot Cues: {Object.keys(hotCuesMap).length > 0 ? `${Object.keys(hotCuesMap).length} Tracks klaar` : 'Niet berekend'}
                </span>
              </div>
            </div>

            {/* Primary & Batch Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 self-stretch md:self-auto justify-end">
              
              {/* REQUIREMENT 4: High-visibility BATCH "DOWNLOAD ALL" BUTTON */}
              <button
                onClick={handleDownloadAllPlaylistTracks}
                disabled={playlistTracks.length === 0}
                className="px-5 py-2.5 rounded-full bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-300 hover:from-amber-300 hover:to-yellow-300 text-black font-black text-xs md:text-sm flex items-center gap-2 shadow-xl shadow-yellow-400/25 active:scale-95 disabled:opacity-50 transition-all border border-yellow-300/50"
                title="Voeg alle nummers van deze afspeellijst in batch toe aan de parallelle downloadrij"
              >
                <Download className="w-4 h-4 text-black stroke-[2.5]" />
                <span>{language === 'nl' ? 'Download Alles' : 'Download All'}</span>
              </button>

              {/* REQUIREMENT 5: BATCH ZIP-EXPORT BUTTON */}
              <button
                onClick={handleExportPlaylistZip}
                disabled={playlistTracks.length === 0 || isExportingZip}
                className="px-5 py-2.5 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-emerald-500/40 text-emerald-400 font-extrabold text-xs md:text-sm flex items-center gap-2 shadow-lg shadow-emerald-950/40 active:scale-95 disabled:opacity-50 transition-all"
                title="Pak alle gedownloade audiobestanden uit IndexedDB in als een .ZIP archief"
              >
                {isExportingZip ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                    <span>{zipProgressText || (language === 'nl' ? 'Inpakken...' : 'Zipping...')}</span>
                  </>
                ) : (
                  <>
                    <FileArchive className="w-4 h-4 text-emerald-400" />
                    <span>{language === 'nl' ? 'Exporteer als ZIP' : 'Export as ZIP'}</span>
                  </>
                )}
              </button>

              <button
                onClick={() => onPlayQueue(playlistTracks)}
                disabled={playlistTracks.length === 0}
                className="px-4 py-2.5 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-bold text-xs flex items-center gap-2 active:scale-95 disabled:opacity-50 transition-all"
              >
                <Play className="w-4 h-4 fill-white" />
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
                <span>Harmoniseer</span>
              </button>

              <button
                onClick={() => handleExportM3u(selectedPlaylist, playlistTracks)}
                disabled={playlistTracks.length === 0}
                className="px-4 py-2.5 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-cyan-400 font-bold text-xs flex items-center gap-2 active:scale-95 disabled:opacity-50 transition-all"
                title="Exporteer als M3U8 voor DJ software"
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
                title="Exporteer naar Excel"
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
                title="Exporteer naar JSON"
              >
                <FileCode className="w-4 h-4 text-blue-400" />
                <span>JSON</span>
              </button>
            </div>
          </div>
        </div>

        {/* DJ STUDIO TOOLS & METADATA SCANNER BAR */}
        <div className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border border-amber-500/30 rounded-3xl p-5 shadow-2xl backdrop-blur-xl space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <span>DJ Studio Toolkit & Metadata Scanner</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-yellow-400 text-[10px] font-mono">
                    Professional DJ Suite
                  </span>
                </h3>
                <p className="text-xs text-zinc-400">
                  Scan toonsoorten, bereken Hot Cues, herstel albumcovers en verwijder spam-tags.
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* 1. Scan BPM, Key, Covers, Mood & Genre */}
              <button
                onClick={handleScanAndEnrichAll}
                disabled={isScanningMetadata || playlistTracks.length === 0}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/25 active:scale-95 transition-all disabled:opacity-50"
                title="Scan en verrijk alle tracks met accurate BPM, Camelot-toonsoort, unieke covers en mood"
              >
                <RefreshCw className={`w-4 h-4 ${isScanningMetadata ? 'animate-spin' : ''}`} />
                <span>{isScanningMetadata ? 'Scannen...' : 'Scan BPM, Key & Covers'}</span>
              </button>

              {/* 2. ⚡ Auto Hot Cues & Memory Points */}
              <button
                onClick={handleGenerateAutoHotCues}
                disabled={playlistTracks.length === 0}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
                title="Bereken automatisch Intro, Drop 1, Breakdown, Drop 2 en Outro cues voor alle tracks"
              >
                <Zap className="w-4 h-4 fill-black text-black" />
                <span>⚡ Auto Hot Cues</span>
              </button>

              {/* 3. 🤖 AI Smart Metadata Fixer */}
              <button
                onClick={handleFixMetadataAll}
                disabled={isFixingMetadata || playlistTracks.length === 0}
                className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-purple-600/25 active:scale-95 transition-all disabled:opacity-50"
                title="Verwijder website-reclame ([www...], [FREE DL]), formatteer titels en corrigeer artiesten"
              >
                <Wand2 className={`w-4 h-4 ${isFixingMetadata ? 'animate-pulse' : ''}`} />
                <span>🤖 AI Smart Metadata Fixer</span>
              </button>

              {/* 4. 🛠️ Broken Files & Corrupt Header Scanner */}
              <button
                onClick={handleScanAudioHealth}
                disabled={isScanningHealth || playlistTracks.length === 0}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-emerald-400 font-bold text-xs flex items-center gap-2 shadow-lg active:scale-95 transition-all disabled:opacity-50"
                title="Scan audiobestanden in IndexedDB op corrupte headers en ontbrekende streams"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>🛠️ Bestands- & Header Scanner</span>
              </button>
            </div>
          </div>

          {/* Active progress feedback banner */}
          {metadataScanProgress && (
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-xs flex items-center gap-2.5 animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
              <span>{metadataScanProgress}</span>
            </div>
          )}
        </div>

        {/* Tracks Table in strictly this playlist */}
        {playlistTracks.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-12 text-center space-y-3">
            <Music2 className="w-12 h-12 mx-auto text-zinc-600" />
            <h4 className="text-base font-bold text-white">Deze afspeellijst map is nog leeg</h4>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              Voeg nummers toe via het 'Toevoegen aan afspeellijst' icoon op elk nummer. Nummers van andere afspeellijsten blijven strikt gescheiden.
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
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">BPM</th>
                    <th className="py-3 px-4 text-center">Key</th>
                    <th className="py-3 px-4 hidden md:table-cell">Mood</th>
                    <th className="py-3 px-4 hidden sm:table-cell">Genre</th>
                    <th className="py-3 px-4 text-right">Duur</th>
                    <th className="py-3 px-4 text-center w-28">Acties</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80 text-zinc-200">
                  {playlistTracks.map((track, idx) => {
                    const isPlaying = playingTrackId === track.id;
                    const trackKey = normalizeToCamelotKey(track.key);
                    const meta = CAMELOT_KEY_MAP[trackKey];
                    const downloadStatus = getTrackStatus(track.id);
                    const cues = hotCuesMap[track.id];

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
                          <div className="flex items-start gap-3">
                            <img
                              src={resolveTrackCover(track.coverUrl, track.title, track.artist)}
                              alt={track.title}
                              className="w-11 h-11 rounded-xl object-cover shrink-0 border border-zinc-800"
                            />
                            <div className="min-w-0 flex-1">
                              <p
                                onClick={() => onPlayTrack(track, playlistTracks)}
                                className="font-bold text-white truncate hover:text-yellow-400 cursor-pointer"
                              >
                                {track.title}
                              </p>
                              <p className="text-[11px] text-zinc-400 truncate">{track.artist}</p>

                              {/* ⚡ Visual Auto Hot Cues Timeline */}
                              {cues && cues.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1 pt-1.5">
                                  {cues.map((cue) => (
                                    <span
                                      key={cue.index}
                                      style={{
                                        borderColor: `${cue.color}50`,
                                        backgroundColor: `${cue.color}15`,
                                        color: cue.color,
                                      }}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border"
                                      title={`${cue.colorName}: ${cue.timeFormatted}`}
                                    >
                                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cue.color }} />
                                      <span>{cue.label}</span>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Status Badge: Active / Completed in IndexedDB / Idle */}
                        <td className="py-3 px-4 text-center">
                          {downloadStatus.isActive ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-400/10 text-yellow-400 font-mono text-[10px] font-bold border border-yellow-400/30">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              {downloadStatus.progress}%
                            </span>
                          ) : downloadStatus.isQueued ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-mono text-[10px]">
                              <Clock className="w-3 h-3" />
                              Rij
                            </span>
                          ) : downloadStatus.isCompleted || track.isDownloaded ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono text-[10px] font-bold border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" />
                              IDB
                            </span>
                          ) : (
                            <span className="text-[10px] text-zinc-500 font-mono">Klaar</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center font-mono font-bold text-yellow-400">
                          {track.bpm || 126}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold border ${meta?.bgClass || 'bg-purple-500/20'} ${meta?.textClass || 'text-purple-300'} ${meta?.borderClass || 'border-purple-500/40'}`}>
                            {trackKey}
                          </span>
                        </td>

                        <td className="py-3 px-4 hidden md:table-cell text-zinc-400">
                          <span className="px-2 py-0.5 rounded-lg bg-pink-500/10 text-pink-300 font-medium text-[11px] border border-pink-500/20">
                            {track.mood || (track.bpm && track.bpm >= 135 ? 'Peak Time' : 'Uplifting')}
                          </span>
                        </td>

                        <td className="py-3 px-4 hidden sm:table-cell text-zinc-400">
                          {track.genre || 'House'}
                        </td>

                        <td className="py-3 px-4 text-right font-mono text-zinc-400">
                          {track.durationFormatted}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {/* Individual Download Action */}
                            <button
                              onClick={() => enqueueDownload(track, selectedPlaylist.id, undefined, selectedPlaylist.name)}
                              disabled={downloadStatus.isActive || downloadStatus.isQueued}
                              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-yellow-400 transition-colors disabled:opacity-40"
                              title="Download track naar lokale opslag"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>

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
                              title="Verwijder uit deze afspeellijst map"
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

        {/* STUDIO SCAN RESULTS MODAL (AI Fixes & Broken Files) */}
        {activeModalTab && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
            <div className="max-w-2xl w-full bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl text-white space-y-4 max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-yellow-400/10 text-yellow-400 border border-yellow-400/30">
                    {activeModalTab === 'health' ? <ShieldCheck className="w-5 h-5" /> : <Wand2 className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white">
                      {activeModalTab === 'health'
                        ? '🛠️ Bestands- & Header Integriteit Rapport'
                        : '🤖 AI Smart Metadata Opschoon Rapport'}
                    </h3>
                    <p className="text-xs text-zinc-400 font-mono">
                      {activeModalTab === 'health'
                        ? `${healthScanResults?.length || 0} bestanden geanalyseerd in IndexedDB`
                        : `${aiFixResults?.filter((r) => r.changed).length || 0} titels opgeschoond`}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setActiveModalTab(null)}
                  className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 font-sans text-xs">
                {activeModalTab === 'health' && healthScanResults && (
                  <div className="space-y-2">
                    {healthScanResults.map((item) => (
                      <div
                        key={item.trackId}
                        className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
                          item.status === 'healthy'
                            ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                            : item.status === 'warning'
                            ? 'bg-amber-950/20 border-amber-500/30 text-amber-300'
                            : 'bg-red-950/20 border-red-500/30 text-red-300'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-white truncate">{item.title}</p>
                          <p className="text-[11px] opacity-80">{item.details}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase shrink-0 border border-current">
                          {item.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {activeModalTab === 'ai' && aiFixResults && (
                  <div className="space-y-2">
                    {aiFixResults.map((item) => (
                      <div
                        key={item.trackId}
                        className={`p-3 rounded-2xl border ${
                          item.changed
                            ? 'bg-purple-950/20 border-purple-500/30 text-purple-200'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-white text-xs truncate">
                            {item.cleanedArtist} - {item.cleanedTitle}
                          </span>
                          {item.changed && (
                            <span className="px-2 py-0.5 rounded-full bg-purple-400/20 text-purple-300 text-[10px] font-mono font-bold">
                              Aangepast
                            </span>
                          )}
                        </div>
                        {item.changed && (
                          <p className="text-[10px] text-zinc-500 line-through pt-0.5">
                            Origineel: {item.originalArtist} - {item.originalTitle}
                          </p>
                        )}
                        {item.fixesApplied.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1.5">
                            {item.fixesApplied.map((fix, fIdx) => (
                              <span key={fIdx} className="px-1.5 py-0.5 rounded bg-zinc-800 text-[9px] text-zinc-300">
                                {fix}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-zinc-800 flex justify-end">
                <button
                  onClick={() => setActiveModalTab(null)}
                  className="px-5 py-2 rounded-xl bg-yellow-400 text-black font-bold text-xs hover:bg-yellow-300 transition-colors"
                >
                  Sluiten
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // REQUIREMENT 2: OVERVIEW OF ALL PLAYLISTS IN AN ORGANIZED DIRECTORY / FOLDER UX
  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Top Banner & Creation Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/90 border border-zinc-800 p-6 rounded-3xl shadow-xl backdrop-blur-md">
        <div className="space-y-1">
          <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Folder className="w-6 h-6 text-yellow-400 fill-yellow-400/20" />
            <span>Afspeellijsten Mappen ({playlists.length})</span>
          </h2>
          <p className="text-xs text-zinc-400">
            Georganiseerde mapstructuur met strikte tracks-scheiding. Klik op een afspeellijst om uitsluitend de bijbehorende nummers te beheren.
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

      {/* Directory Folders Grid */}
      {playlists.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-zinc-800 border border-zinc-700 flex items-center justify-center mx-auto text-yellow-400">
            <Folder className="w-8 h-8 fill-yellow-400/20" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">Nog geen afspeellijst mappen</h3>
            <p className="text-xs md:text-sm text-zinc-400 max-w-md mx-auto">
              Maak een nieuwe afspeellijst map aan om je muziek strikt gescheiden te downloaden en te organiseren.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={onOpenCreatePlaylist}
              className="px-6 py-2.5 rounded-full bg-yellow-400 hover:bg-yellow-300 text-black font-black text-xs transition-all shadow-lg shadow-yellow-400/20"
            >
              Eerste Afspeellijst Maken
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {playlists.map((pl) => {
            const idSet = new Set(pl.trackIds || []);
            const ordered = (pl.trackIds || [])
              .map((id) => library.find((t) => t.id === id))
              .filter(Boolean) as MusicTrack[];
            const additional = library.filter((t) => t.playlistId === pl.id && !idSet.has(t.id));
            const tracksInPl = [...ordered, ...additional];
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
                className="bg-zinc-900/90 border border-zinc-800 hover:border-yellow-400/50 rounded-3xl p-5 flex flex-col justify-between space-y-4 transition-all group cursor-pointer shadow-xl hover:shadow-2xl hover:scale-[1.01] relative overflow-hidden backdrop-blur-sm"
              >
                {/* Folder Header Indicator */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center text-yellow-400 group-hover:bg-yellow-400 group-hover:text-black transition-colors">
                      <Folder className="w-4 h-4 fill-current" />
                    </div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">
                      Map
                    </span>
                  </div>

                  <span className="px-2.5 py-0.5 rounded-full bg-zinc-950 text-yellow-400 text-[10px] font-mono font-bold border border-zinc-800">
                    {tracksInPl.length} tracks
                  </span>
                </div>

                {/* 2x2 Mosaic artwork */}
                <div className="relative aspect-video rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 shadow-inner grid grid-cols-2 grid-rows-2">
                  {tracksInPl.slice(0, 4).map((t, i) => (
                    <img
                      key={t.id + i}
                      src={t.coverUrl}
                      alt={t.title}
                      className="w-full h-full object-cover"
                    />
                  ))}
                  {tracksInPl.length === 0 && (
                    <div className="col-span-2 row-span-2 flex items-center justify-center text-zinc-600">
                      <ListMusic className="w-10 h-10" />
                    </div>
                  )}

                  {/* Play Button Hover Overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlayQueue(tracksInPl);
                      }}
                      disabled={tracksInPl.length === 0}
                      className="w-11 h-11 rounded-full bg-yellow-400 text-black flex items-center justify-center shadow-xl hover:scale-110 active:scale-95 transition-transform"
                      title="Alles afspelen"
                    >
                      <Play className="w-5 h-5 fill-black ml-0.5" />
                    </button>
                  </div>
                </div>

                {/* Playlist Info */}
                <div className="space-y-1">
                  <h3 className="text-base font-extrabold text-white truncate group-hover:text-yellow-400 transition-colors">
                    {pl.name}
                  </h3>
                  <p className="text-xs text-zinc-400 truncate">
                    {pl.description || `${tracksInPl.length} nummers • ${Math.floor(totalDuration / 60)} min`}
                  </p>
                </div>

                {/* Quick Directory Actions Bar */}
                <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-500">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-zinc-400">{avgBpm} BPM</span>
                  </div>

                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {/* Quick Download All icon */}
                    <button
                      onClick={() => enqueueBatchDownloads(tracksInPl, pl.id, undefined, pl.name)}
                      disabled={tracksInPl.length === 0}
                      className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-yellow-400 transition-colors disabled:opacity-30"
                      title="Download alle nummers van deze map"
                    >
                      <FolderDown className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => onDeletePlaylist(pl.id)}
                      className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-red-400 transition-colors"
                      title="Map verwijderen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
