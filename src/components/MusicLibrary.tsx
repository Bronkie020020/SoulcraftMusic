import React, { useState, useMemo } from 'react';
import {
  Library,
  Play,
  Shuffle,
  Search,
  Filter,
  ArrowUpDown,
  Grid,
  List as ListIcon,
  Heart,
  Music2,
  Disc,
  Trash2,
  Edit3,
  FileText,
  ExternalLink,
  PlusCircle,
  Download,
  HardDrive,
  Sparkles,
  Clock,
  Layers,
  ChevronRight,
  Share2,
  Zap,
  ListMusic,
  Sliders,
  FolderPlus,
  FileSpreadsheet,
  FileCode,
  ChevronDown,
} from 'lucide-react';
import { AppLanguage, MusicTrack, Platform, Playlist } from '../types';
import { translations } from '../utils/translations';
import {
  CAMELOT_KEY_MAP,
  normalizeToCamelotKey,
  analyzeTrackBpmAndKey,
  compareTracksByBpm,
  compareTracksByCamelot,
  areKeysHarmonicallyCompatible,
} from '../utils/audioAnalyzer';
import { DjDeckView } from './DjDeckView';
import { PlaylistsView } from './PlaylistsView';
import { AudioAnalysisModal } from './AudioAnalysisModal';
import { ExportLibraryModal } from './ExportLibraryModal';
import {
  exportLibraryAsExcel,
  exportLibraryAsJson,
  exportLibraryAsCsv,
} from '../utils/libraryExporter';

interface MusicLibraryProps {
  language: AppLanguage['code'];
  library: MusicTrack[];
  playlists: Playlist[];
  playingTrackId: string | null;
  onPlayTrack: (track: MusicTrack, queue?: MusicTrack[]) => void;
  onPlayQueue: (queue: MusicTrack[]) => void;
  onToggleFavorite: (trackId: string) => void;
  onDeleteTrack: (trackId: string) => void;
  onOpenTagEditor: (track: MusicTrack) => void;
  onOpenLyrics: (track: MusicTrack) => void;
  onOpenCrossLinks: (track: MusicTrack) => void;
  onSeedDemoTracks: () => void;
  onReDownloadTrack: (track: MusicTrack) => void;
  onAutoEnrichLibrary?: () => void;
  isAutoEnriching?: boolean;
  onOpenAddToPlaylist: (track: MusicTrack) => void;
  onOpenCreatePlaylist: () => void;
  onOpenSmartPlaylist: () => void;
  onOpenAudioAnalysis?: (track: MusicTrack) => void;
  onUpdatePlaylists: (playlists: Playlist[]) => void;
  onDeletePlaylist: (playlistId: string) => void;
  onRemoveTrackFromPlaylist: (playlistId: string, trackId: string) => void;
  onUpdateLibraryTracks: (tracks: MusicTrack[]) => void;
  onNavigateToDownloader?: () => void;
}

type CategoryTab = 'all' | 'playlists' | 'dj_deck' | 'artists' | 'albums' | 'genres' | 'favorites';
export type SortOption =
  | 'artist'
  | 'album'
  | 'genre'
  | 'title'
  | 'newest'
  | 'duration'
  | 'bpm_desc'
  | 'bpm_asc'
  | 'camelot_asc'
  | 'camelot_desc'
  | 'key_standard'
  | 'bpm'
  | 'key';

export const MusicLibrary: React.FC<MusicLibraryProps> = ({
  language,
  library,
  playlists,
  playingTrackId,
  onPlayTrack,
  onPlayQueue,
  onToggleFavorite,
  onDeleteTrack,
  onOpenTagEditor,
  onOpenLyrics,
  onOpenCrossLinks,
  onSeedDemoTracks,
  onReDownloadTrack,
  onAutoEnrichLibrary,
  isAutoEnriching = false,
  onOpenAddToPlaylist,
  onOpenCreatePlaylist,
  onOpenSmartPlaylist,
  onOpenAudioAnalysis,
  onUpdatePlaylists,
  onDeletePlaylist,
  onRemoveTrackFromPlaylist,
  onUpdateLibraryTracks,
  onNavigateToDownloader,
}) => {
  const t = translations[language];

  // Active view states
  const [activeCategory, setActiveCategory] = useState<CategoryTab>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | 'all'>('all');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [expandedArtist, setExpandedArtist] = useState<string | null>(null);

  // Internal Audio Analysis Modal State
  const [internalAnalysisTrack, setInternalAnalysisTrack] = useState<MusicTrack | null>(null);

  // Live Batch BPM & Key Scanner State
  const [isScanningBpmKey, setIsScanningBpmKey] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<{ current: number; total: number; trackTitle?: string; detectedBpm?: number; detectedKey?: string } | null>(null);

  // Export Library Modal State & Dropdown
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);

  // Quick Export Handlers
  const handleQuickExportExcel = () => {
    setShowExportMenu(false);
    exportLibraryAsExcel(library, { playlists });
  };

  const handleQuickExportJson = () => {
    setShowExportMenu(false);
    exportLibraryAsJson(library, { playlists });
  };

  const handleQuickExportCsv = () => {
    setShowExportMenu(false);
    exportLibraryAsCsv(library, { playlists });
  };

  const handleOpenExportModal = () => {
    setShowExportMenu(false);
    setIsExportModalOpen(true);
  };

  const handleOpenInspector = (track: MusicTrack) => {
    if (onOpenAudioAnalysis) {
      onOpenAudioAnalysis(track);
    } else {
      setInternalAnalysisTrack(track);
    }
  };

  const handleSaveInternalAnalysis = (trackId: string, bpm: number, key: string) => {
    const updated = library.map((t) =>
      t.id === trackId ? { ...t, bpm, key } : t
    );
    onUpdateLibraryTracks(updated);
  };

  // Scan all tracks in library for BPM & Camelot Key
  const handleBatchScanBpmKey = async () => {
    if (library.length === 0 || isScanningBpmKey) return;
    setIsScanningBpmKey(true);

    const updated = [...library];
    for (let i = 0; i < updated.length; i++) {
      const track = updated[i];
      setScanProgress({
        current: i + 1,
        total: updated.length,
        trackTitle: `${track.artist} - ${track.title}`,
      });

      // Small delay for UI smoothness & DSP processing
      await new Promise((r) => setTimeout(r, 60));

      const analysis = await analyzeTrackBpmAndKey(track);
      updated[i] = {
        ...track,
        bpm: analysis.bpm,
        key: analysis.camelotKey,
      };

      setScanProgress({
        current: i + 1,
        total: updated.length,
        trackTitle: `${track.artist} - ${track.title}`,
        detectedBpm: analysis.bpm,
        detectedKey: analysis.camelotKey,
      });
    }

    onUpdateLibraryTracks(updated);
    setIsScanningBpmKey(false);
    setTimeout(() => setScanProgress(null), 3000);
  };

  // Scan a single track for BPM & Key
  const handleSingleScanTrack = async (track: MusicTrack) => {
    const analysis = await analyzeTrackBpmAndKey(track);
    const updated = library.map((t) =>
      t.id === track.id ? { ...t, bpm: analysis.bpm, key: analysis.camelotKey } : t
    );
    onUpdateLibraryTracks(updated);
  };

  // Extract unique genres for filter
  const availableGenres = useMemo(() => {
    const genres = new Set<string>();
    library.forEach((track) => {
      if (track.genre) genres.add(track.genre);
    });
    return Array.from(genres).sort();
  }, [library]);

  // Compute statistics
  const stats = useMemo(() => {
    const totalTracks = library.length;
    const artists = new Set(library.map((t) => t.artist)).size;
    const albums = new Set(library.map((t) => t.album)).size;
    const genres = new Set(library.map((t) => t.genre)).size;
    const scannedBpmCount = library.filter((t) => t.bpm && t.key).length;
    const totalStorageMb = library.reduce((acc, curr) => acc + (curr.fileSizeMb || 7.5), 0);
    const totalSeconds = library.reduce((acc, curr) => acc + (curr.duration || 180), 0);
    const totalMinutes = Math.floor(totalSeconds / 60);

    return { totalTracks, artists, albums, genres, scannedBpmCount, totalStorageMb, totalMinutes };
  }, [library]);

  // Filtered and Sorted Tracks
  const filteredTracks = useMemo(() => {
    let result = [...library];

    // Category filter
    if (activeCategory === 'favorites') {
      result = result.filter((t) => t.isFavorite);
    }

    // Platform filter
    if (selectedPlatform !== 'all') {
      result = result.filter((t) => t.platform === selectedPlatform);
    }

    // Genre filter
    if (selectedGenre !== 'all') {
      result = result.filter((t) => t.genre === selectedGenre);
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          (t.title || '').toLowerCase().includes(q) ||
          (t.artist || '').toLowerCase().includes(q) ||
          (t.album || '').toLowerCase().includes(q) ||
          (t.genre || '').toLowerCase().includes(q) ||
          (t.key || '').toLowerCase().includes(q) ||
          String(t.bpm || '').includes(q)
      );
    }

    // Sorting logic
    result.sort((a, b) => {
      switch (sortBy) {
        case 'artist':
          return (a.artist || '').localeCompare(b.artist || '');
        case 'album':
          return (a.album || '').localeCompare(b.album || '');
        case 'genre':
          return (a.genre || '').localeCompare(b.genre || '');
        case 'title':
          return (a.title || '').localeCompare(b.title || '');
        case 'duration':
          return (b.duration || 0) - (a.duration || 0);
        case 'bpm_desc':
        case 'bpm':
          return compareTracksByBpm(a, b, false);
        case 'bpm_asc':
          return compareTracksByBpm(a, b, true);
        case 'camelot_asc':
        case 'key':
          return compareTracksByCamelot(a, b, true);
        case 'camelot_desc':
          return compareTracksByCamelot(a, b, false);
        case 'key_standard': {
          const keyA = CAMELOT_KEY_MAP[normalizeToCamelotKey(a.key)]?.standard || 'Z';
          const keyB = CAMELOT_KEY_MAP[normalizeToCamelotKey(b.key)]?.standard || 'Z';
          return keyA.localeCompare(keyB);
        }
        case 'newest':
        default:
          return (
            new Date(b.addedAt || '2026-01-01').getTime() -
            new Date(a.addedAt || '2026-01-01').getTime()
          );
      }
    });

    return result;
  }, [library, activeCategory, selectedPlatform, selectedGenre, searchQuery, sortBy]);

  // Grouped by Artist
  const artistGroups = useMemo(() => {
    const groups: Record<string, MusicTrack[]> = {};
    filteredTracks.forEach((track) => {
      const artistKey = track.artist || 'Onbekende Artiest';
      if (!groups[artistKey]) groups[artistKey] = [];
      groups[artistKey].push(track);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredTracks]);

  // Grouped by Album
  const albumGroups = useMemo(() => {
    const groups: Record<string, { artist: string; year: string; genre: string; tracks: MusicTrack[] }> = {};
    filteredTracks.forEach((track) => {
      const albumTitle = track.album || 'Single';
      const artistName = track.artist || 'Onbekend';
      const key = `${albumTitle} - ${artistName}`;
      if (!groups[key]) {
        groups[key] = {
          artist: artistName,
          year: track.releaseYear || '2024',
          genre: track.genre || 'Pop',
          tracks: [],
        };
      }
      groups[key].tracks.push(track);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredTracks]);

  // Grouped by Genre
  const genreGroups = useMemo(() => {
    const groups: Record<string, MusicTrack[]> = {};
    filteredTracks.forEach((track) => {
      const g = track.genre || 'Onbekend';
      if (!groups[g]) groups[g] = [];
      groups[g].push(track);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredTracks]);

  // Play All handler
  const handlePlayAll = () => {
    if (filteredTracks.length > 0) onPlayQueue(filteredTracks);
  };

  // Shuffle All handler
  const handleShufflePlay = () => {
    if (filteredTracks.length > 0) {
      const shuffled = [...filteredTracks].sort(() => Math.random() - 0.5);
      onPlayQueue(shuffled);
    }
  };

  // Export Library as CSV handler
  const handleExportCsv = () => {
    if (library.length === 0) return;
    const escapeCsv = (field: any) => `"${String(field ?? '').replace(/"/g, '""')}"`;
    const headers = ['Artist', 'Title', 'Album', 'Year', 'Genre', 'BPM', 'Key', 'Format'];
    const rows = library.map((t) => [
      escapeCsv(t.artist),
      escapeCsv(t.title),
      escapeCsv(t.album),
      escapeCsv(t.releaseYear || ''),
      escapeCsv(t.genre || ''),
      escapeCsv(t.bpm || ''),
      escapeCsv(t.key || ''),
      escapeCsv(t.format || 'MP3'),
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `music_library_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Top Header Bento Card */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-400/5 rounded-full blur-3xl -z-0 pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-zinc-800 border border-zinc-700 text-yellow-400 flex items-center justify-center font-black shadow-lg shadow-black/40">
                <Library className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
                  <span>{t.libraryTitle}</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-yellow-400 text-black font-extrabold">
                    DJ Library & Playlists
                  </span>
                </h1>
                <p className="text-xs md:text-sm text-zinc-400 font-medium">
                  {t.librarySubtitle} • BPM & Toonsoort Scanner • Slimme Afspeellijsten
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handlePlayAll}
              disabled={filteredTracks.length === 0}
              className="px-5 py-2.5 rounded-full bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-xs md:text-sm flex items-center gap-2 transition-all shadow-lg shadow-yellow-400/20 active:scale-95 disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-black" />
              <span>{t.playAll}</span>
            </button>

            <button
              onClick={handleShufflePlay}
              disabled={filteredTracks.length === 0}
              className="px-5 py-2.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs md:text-sm border border-zinc-700 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            >
              <Shuffle className="w-4 h-4 text-yellow-400" />
              <span>{t.shuffle}</span>
            </button>

            {/* Batch Scan BPM & Key Button */}
            {library.length > 0 && (
              <button
                onClick={handleBatchScanBpmKey}
                disabled={isScanningBpmKey}
                className="px-5 py-2.5 rounded-full bg-yellow-400 hover:bg-yellow-300 disabled:opacity-60 text-black font-black text-xs md:text-sm flex items-center gap-2 transition-all shadow-lg shadow-yellow-400/20 active:scale-95"
                title="Scan en bereken realtime BPM tempo en Camelot Key voor alle nummers"
              >
                <Zap className={`w-4 h-4 text-black ${isScanningBpmKey ? 'animate-bounce' : ''}`} />
                <span>{isScanningBpmKey ? t.scanningBpmKey : t.scanAllLibraryBpmKey}</span>
              </button>
            )}

            {/* Smart Playlist Generator Quick Button */}
            <button
              onClick={onOpenSmartPlaylist}
              className="px-5 py-2.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-yellow-400 border border-zinc-700 font-bold text-xs md:text-sm flex items-center gap-2 transition-all active:scale-95"
              title="Genereer automatisch DJ afspeellijsten op basis van BPM en Camelot toonsoorten"
            >
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <span>{t.smartPlaylistBtn}</span>
            </button>

            {library.length > 0 && (
              <div className="relative">
                <div className="inline-flex rounded-full shadow-lg overflow-hidden border border-zinc-700 bg-zinc-800">
                  <button
                    onClick={handleOpenExportModal}
                    className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-yellow-400 font-bold text-xs md:text-sm flex items-center gap-2 transition-all"
                    title={t.exportLibraryBtn}
                  >
                    <FileSpreadsheet className="w-4 h-4 text-yellow-400" />
                    <span>{t.exportLibraryBtn}</span>
                  </button>
                  <button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    className="px-2.5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-yellow-400 border-l border-zinc-700 flex items-center justify-center transition-all"
                    title="Snelle export opties"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>

                {/* Quick Dropdown Menu */}
                {showExportMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => setShowExportMenu(false)}
                    />
                    <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl p-2 z-40 space-y-1 animate-fade-in text-xs font-semibold">
                      <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                        {language === 'nl' ? 'Direct Exporteren' : 'Quick Export'}
                      </div>
                      <button
                        onClick={handleQuickExportExcel}
                        className="w-full px-3 py-2 rounded-xl text-left hover:bg-zinc-800 text-emerald-300 flex items-center gap-2.5 transition-colors"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div>
                          <div className="font-bold text-white">Excel Werkmap (.xls)</div>
                          <div className="text-[10px] text-zinc-400">Inclusief bestandspaden & datums</div>
                        </div>
                      </button>

                      <button
                        onClick={handleQuickExportJson}
                        className="w-full px-3 py-2 rounded-xl text-left hover:bg-zinc-800 text-blue-300 flex items-center gap-2.5 transition-colors"
                      >
                        <FileCode className="w-4 h-4 text-blue-400 shrink-0" />
                        <div>
                          <div className="font-bold text-white">JSON Archief (.json)</div>
                          <div className="text-[10px] text-zinc-400">100% volledige metadata backup</div>
                        </div>
                      </button>

                      <button
                        onClick={handleQuickExportCsv}
                        className="w-full px-3 py-2 rounded-xl text-left hover:bg-zinc-800 text-amber-300 flex items-center gap-2.5 transition-colors"
                      >
                        <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                        <div>
                          <div className="font-bold text-white">CSV Tabel (.csv)</div>
                          <div className="text-[10px] text-zinc-400">Universele tabel met UTF-8</div>
                        </div>
                      </button>

                      <div className="border-t border-zinc-800 my-1 pt-1">
                        <button
                          onClick={handleOpenExportModal}
                          className="w-full px-3 py-2 rounded-xl text-left bg-yellow-400/10 hover:bg-yellow-400/20 text-yellow-400 font-bold flex items-center gap-2 transition-colors"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>{language === 'nl' ? 'Uitgebreide Export Opties...' : 'Advanced Export Modal...'}</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {library.length === 0 && (
              <button
                onClick={onSeedDemoTracks}
                className="px-5 py-2.5 rounded-full bg-yellow-400/10 hover:bg-yellow-400/20 text-yellow-400 border border-yellow-400/30 font-bold text-xs md:text-sm flex items-center gap-2 transition-all"
              >
                <Sparkles className="w-4 h-4" />
                <span>{t.seedDemoTracks}</span>
              </button>
            )}
          </div>
        </div>

        {/* Live BPM/Key Scanning Progress Toast */}
        {scanProgress && (
          <div className="mt-6 bg-black/90 border border-yellow-400/40 rounded-2xl p-4 space-y-2 animate-fade-in shadow-xl">
            <div className="flex items-center justify-between text-xs font-bold text-white">
              <span className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400 animate-pulse" />
                <span>BPM & Key DSP Scanner: {scanProgress.trackTitle}</span>
              </span>
              <span className="text-yellow-400 font-mono">
                {scanProgress.current} / {scanProgress.total} (
                {Math.round((scanProgress.current / scanProgress.total) * 100)}%)
              </span>
            </div>

            <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-yellow-400 h-full transition-all duration-300 rounded-full"
                style={{ width: `${(scanProgress.current / scanProgress.total) * 100}%` }}
              ></div>
            </div>

            {scanProgress.detectedBpm && (
              <div className="text-[11px] text-yellow-300 flex items-center gap-3">
                <span>Gedetecteerd: <strong>{scanProgress.detectedBpm} BPM</strong></span>
                <span>Camelot Key: <strong>{scanProgress.detectedKey}</strong></span>
              </div>
            )}
          </div>
        )}

        {/* Bento Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center text-yellow-400">
              <Music2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl md:text-2xl font-bold text-white">{stats.totalTracks}</div>
              <div className="text-[10px] md:text-xs text-zinc-400 uppercase font-semibold tracking-wider">
                {t.totalTracks}
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center text-yellow-400">
              <ListMusic className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl md:text-2xl font-bold text-white">{playlists.length}</div>
              <div className="text-[10px] md:text-xs text-zinc-400 uppercase font-semibold tracking-wider">
                Afspeellijsten
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl md:text-2xl font-bold text-white">{stats.scannedBpmCount}</div>
              <div className="text-[10px] md:text-xs text-zinc-400 uppercase font-semibold tracking-wider">
                BPM/Key Gescand
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl md:text-2xl font-bold text-white">{stats.artists}</div>
              <div className="text-[10px] md:text-xs text-zinc-400 uppercase font-semibold tracking-wider">
                {t.totalArtists}
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl md:text-2xl font-bold text-white">
                {stats.totalStorageMb.toFixed(1)} <span className="text-xs font-normal text-zinc-400">MB</span>
              </div>
              <div className="text-[10px] md:text-xs text-zinc-400 uppercase font-semibold tracking-wider">
                {stats.totalMinutes} min audio
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Category Tabs & Filter Navigation */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-5 md:p-6 space-y-5">
        
        {/* Main Category Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap ${
                activeCategory === 'all'
                  ? 'bg-yellow-400 text-black shadow-md font-black'
                  : 'bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700'
              }`}
            >
              {t.viewAllTracks} ({library.length})
            </button>

            <button
              onClick={() => setActiveCategory('playlists')}
              className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeCategory === 'playlists'
                  ? 'bg-yellow-400 text-black shadow-md font-black'
                  : 'bg-zinc-800 text-yellow-400 hover:text-white border border-zinc-700'
              }`}
            >
              <ListMusic className="w-3.5 h-3.5" />
              <span>Afspeellijsten ({playlists.length})</span>
            </button>

            <button
              onClick={() => setActiveCategory('dj_deck')}
              className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeCategory === 'dj_deck'
                  ? 'bg-yellow-400 text-black shadow-md font-black'
                  : 'bg-zinc-800 text-cyan-400 hover:text-white border border-zinc-700'
              }`}
            >
              <Disc className="w-3.5 h-3.5" />
              <span>DJ Deck & Harmonic Mix</span>
            </button>

            <button
              onClick={() => setActiveCategory('artists')}
              className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap ${
                activeCategory === 'artists'
                  ? 'bg-yellow-400 text-black shadow-md font-black'
                  : 'bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700'
              }`}
            >
              {t.viewArtists} ({stats.artists})
            </button>

            <button
              onClick={() => setActiveCategory('albums')}
              className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap ${
                activeCategory === 'albums'
                  ? 'bg-yellow-400 text-black shadow-md font-black'
                  : 'bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700'
              }`}
            >
              {t.viewAlbums} ({stats.albums})
            </button>

            <button
              onClick={() => setActiveCategory('genres')}
              className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap ${
                activeCategory === 'genres'
                  ? 'bg-yellow-400 text-black shadow-md font-black'
                  : 'bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700'
              }`}
            >
              {t.viewGenres} ({stats.genres})
            </button>

            <button
              onClick={() => setActiveCategory('favorites')}
              className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeCategory === 'favorites'
                  ? 'bg-pink-600 text-white shadow-md'
                  : 'bg-zinc-800 text-pink-400 hover:text-pink-300 border border-zinc-700'
              }`}
            >
              <Heart className="w-3.5 h-3.5 fill-current" />
              <span>{t.viewFavorites}</span>
            </button>
          </div>

          {/* Grid / List Layout Switcher */}
          {activeCategory !== 'playlists' && activeCategory !== 'dj_deck' && (
            <div className="flex items-center gap-1 bg-zinc-950 rounded-xl p-1 border border-zinc-800">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                  viewMode === 'grid' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
                }`}
                title={t.gridView}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                  viewMode === 'list' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
                }`}
                title={t.listView}
              >
                <ListIcon className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Search & Sort Controls Bar (Only when in list or grid category) */}
        {activeCategory !== 'playlists' && activeCategory !== 'dj_deck' && (
          <div className="space-y-3">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              
              {/* Live Search Field */}
              <div className="relative w-full md:w-96">
                <Search className="w-4 h-4 text-zinc-400 absolute left-4 top-3.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Zoek op titel, artiest, album, genre, BPM of key..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 pl-11 pr-4 text-xs md:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-yellow-400 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-3 text-xs text-zinc-400 hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Sorting & Filter Selectors */}
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
                
                {/* Sort Select */}
                <div className="flex items-center gap-2 bg-zinc-950 px-3 py-2 rounded-xl border border-zinc-800 text-xs">
                  <ArrowUpDown className="w-3.5 h-3.5 text-yellow-400" />
                  <span className="text-zinc-400 hidden sm:inline">{t.sortBy}:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
                  >
                    <option value="newest" className="bg-zinc-900">{t.sortByNewest}</option>
                    <option value="bpm_desc" className="bg-zinc-900">⚡ {t.sortByBpmDesc}</option>
                    <option value="bpm_asc" className="bg-zinc-900">⚡ {t.sortByBpmAsc}</option>
                    <option value="camelot_asc" className="bg-zinc-900">🎵 {t.sortByCamelotAsc}</option>
                    <option value="camelot_desc" className="bg-zinc-900">🎵 {t.sortByCamelotDesc}</option>
                    <option value="key_standard" className="bg-zinc-900">🎹 {t.sortByStandardKey}</option>
                    <option value="artist" className="bg-zinc-900">{t.sortByArtist}</option>
                    <option value="album" className="bg-zinc-900">{t.sortByAlbum}</option>
                    <option value="genre" className="bg-zinc-900">{t.sortByGenre}</option>
                    <option value="title" className="bg-zinc-900">{t.sortByTitle}</option>
                    <option value="duration" className="bg-zinc-900">{t.sortByDuration}</option>
                  </select>
                </div>

                {/* Platform Filter */}
                <div className="flex items-center gap-2 bg-zinc-950 px-3 py-2 rounded-xl border border-zinc-800 text-xs">
                  <Filter className="w-3.5 h-3.5 text-zinc-400" />
                  <select
                    value={selectedPlatform}
                    onChange={(e) => setSelectedPlatform(e.target.value as any)}
                    className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
                  >
                    <option value="all" className="bg-zinc-900">Alle Platformen</option>
                    <option value="spotify" className="bg-zinc-900">Spotify</option>
                    <option value="soundcloud" className="bg-zinc-900">SoundCloud</option>
                    <option value="youtube" className="bg-zinc-900">YouTube Music</option>
                  </select>
                </div>

                {/* Genre Filter dropdown */}
                {availableGenres.length > 0 && (
                  <div className="flex items-center gap-2 bg-zinc-950 px-3 py-2 rounded-xl border border-zinc-800 text-xs">
                    <select
                      value={selectedGenre}
                      onChange={(e) => setSelectedGenre(e.target.value)}
                      className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
                    >
                      <option value="all" className="bg-zinc-900">Alle Genres</option>
                      {availableGenres.map((g) => (
                        <option key={g} value={g} className="bg-zinc-900">
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Quick DJ Organization Chips */}
            <div className="flex flex-wrap items-center gap-2 pt-2 text-xs">
              <span className="text-zinc-500 font-semibold text-[11px] flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-yellow-400" />
                <span>DJ Quick Sort:</span>
              </span>

              {/* Quick Sort BPM Descending */}
              <button
                type="button"
                onClick={() => setSortBy(sortBy === 'bpm_desc' ? 'bpm_asc' : 'bpm_desc')}
                className={`px-3 py-1 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 border ${
                  sortBy === 'bpm_desc' || sortBy === 'bpm_asc'
                    ? 'bg-yellow-400 text-slate-950 border-yellow-300 shadow-md shadow-yellow-400/20'
                    : 'bg-zinc-950/80 hover:bg-zinc-800 text-yellow-300 border-zinc-800'
                }`}
              >
                <span>⚡ BPM</span>
                <span>{sortBy === 'bpm_asc' ? '70 ↑ 175' : '175 ↓ 70'}</span>
              </button>

              {/* Quick Sort Camelot Key */}
              <button
                type="button"
                onClick={() => setSortBy(sortBy === 'camelot_asc' ? 'camelot_desc' : 'camelot_asc')}
                className={`px-3 py-1 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 border ${
                  sortBy === 'camelot_asc' || sortBy === 'camelot_desc'
                    ? 'bg-purple-500 text-white border-purple-400 shadow-md shadow-purple-500/20'
                    : 'bg-zinc-950/80 hover:bg-zinc-800 text-purple-300 border-zinc-800'
                }`}
              >
                <span>🎧 Camelot</span>
                <span>{sortBy === 'camelot_desc' ? '12B → 1A' : '1A → 12B'}</span>
              </button>

              {/* Quick Sort Standard Musical Key */}
              <button
                type="button"
                onClick={() => setSortBy('key_standard')}
                className={`px-3 py-1 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 border ${
                  sortBy === 'key_standard'
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/20'
                    : 'bg-zinc-950/80 hover:bg-zinc-800 text-cyan-300 border-zinc-800'
                }`}
              >
                <span>🎹 Key A-Z</span>
              </button>

              {/* Scan All BPM & Key if tracks unscanned */}
              {stats.scannedBpmCount < stats.totalTracks && (
                <button
                  type="button"
                  onClick={handleBatchScanBpmKey}
                  disabled={isScanningBpmKey}
                  className="ml-auto px-3 py-1 rounded-xl bg-yellow-400/10 hover:bg-yellow-400/20 text-yellow-300 border border-yellow-400/30 text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <Zap className={`w-3.5 h-3.5 ${isScanningBpmKey ? 'animate-spin' : ''}`} />
                  <span>{isScanningBpmKey ? 'Analyseren...' : '✨ Scan Alle Nummers'}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* EMPTY LIBRARY STATE */}
      {library.length === 0 && (
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-8 sm:p-12 text-center space-y-6 shadow-2xl">
          <div className="w-20 h-20 rounded-3xl bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 flex items-center justify-center mx-auto shadow-inner shadow-yellow-400/5">
            <Music2 className="w-10 h-10" />
          </div>

          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-xl sm:text-2xl font-black text-white">
              {language === 'nl' ? 'Je Muziekbibliotheek is Leeg' : 'Your Music Library is Empty'}
            </h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {language === 'nl'
                ? 'Plak een link van Spotify, SoundCloud of YouTube om je eigen tracks en DJ afspeellijsten direct in de cloud op te bouwen.'
                : 'Paste a link from Spotify, SoundCloud or YouTube to build your own tracks and DJ playlists directly in the cloud.'}
            </p>
          </div>

          {/* Cloud Info Banner */}
          <div className="max-w-lg mx-auto p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 text-left space-y-1 text-xs">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>{language === 'nl' ? '☁️ 100% Cloud Hosting (Google Cloud Run)' : '☁️ 100% Cloud Hosted (Google Cloud Run)'}</span>
            </div>
            <p className="text-zinc-400 text-[11px] leading-relaxed">
              {language === 'nl'
                ? 'Alle audio downloads, ID3 tag extracties, en BPM/Camelot scans worden direct via de veilige cloud server uitgevoerd. Er draait niets lokaal op je computer.'
                : 'All audio downloads, ID3 tag extraction, and BPM/Camelot key scanning run directly through the secure cloud server. Nothing runs locally on your machine.'}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {onNavigateToDownloader && (
              <button
                type="button"
                onClick={onNavigateToDownloader}
                className="px-6 py-3.5 rounded-2xl bg-yellow-400 hover:bg-yellow-300 text-black font-black text-sm flex items-center gap-2 shadow-lg shadow-yellow-400/20 active:scale-95 transition-all"
              >
                <Download className="w-4 h-4 text-black" />
                <span>{language === 'nl' ? '🎵 Nummers Zoeken & Downloaden' : '🎵 Search & Download Tracks'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onSeedDemoTracks}
              className="px-5 py-3.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 font-bold text-xs flex items-center gap-2 transition-all active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <span>{language === 'nl' ? '✨ Voorbeeld Tracks Laden (Demo)' : '✨ Load Demo Tracks'}</span>
            </button>
          </div>
        </div>
      )}

      {/* FILTER SEARCH EMPTY STATE */}
      {library.length > 0 && (activeCategory === 'all' || activeCategory === 'favorites') && filteredTracks.length === 0 && (
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-8 text-center space-y-4 shadow-xl">
          <p className="text-base font-bold text-white">Geen nummers gevonden</p>
          <p className="text-xs text-zinc-400">Probeer een andere zoekopdracht of filter.</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedPlatform('all');
              setSelectedGenre('all');
            }}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-yellow-400 border border-zinc-700 text-xs font-bold transition-all"
          >
            Filters Resetten
          </button>
        </div>
      )}

      {/* CATEGORY: PLAYLISTS VIEW */}
      {activeCategory === 'playlists' && (
        <PlaylistsView
          language={language}
          playlists={playlists}
          library={library}
          playingTrackId={playingTrackId}
          onPlayTrack={onPlayTrack}
          onPlayQueue={onPlayQueue}
          onOpenCreatePlaylist={onOpenCreatePlaylist}
          onOpenSmartPlaylist={onOpenSmartPlaylist}
          onUpdatePlaylists={onUpdatePlaylists}
          onDeletePlaylist={onDeletePlaylist}
          onRemoveTrackFromPlaylist={onRemoveTrackFromPlaylist}
        />
      )}

      {/* CATEGORY: DJ DECK & HARMONIC MIX VIEW */}
      {activeCategory === 'dj_deck' && (
        <DjDeckView
          language={language}
          library={library}
          playingTrackId={playingTrackId}
          onPlayTrack={onPlayTrack}
          onPlayQueue={onPlayQueue}
          onOpenAddToPlaylist={onOpenAddToPlaylist}
          onUpdateTrack={(updatedTrack) => {
            const updated = library.map((t) => (t.id === updatedTrack.id ? updatedTrack : t));
            onUpdateLibraryTracks(updated);
          }}
        />
      )}

      {/* CATEGORY: ARTISTS VIEW */}
      {activeCategory === 'artists' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {artistGroups.map(([artistName, artistTracks]) => {
            const totalArtistDuration = artistTracks.reduce((acc, curr) => acc + curr.duration, 0);

            return (
              <div
                key={artistName}
                className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-3xl p-6 transition-all flex flex-col justify-between space-y-4 shadow-xl"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <img
                      src={artistTracks[0].coverUrl}
                      alt={artistName}
                      className="w-14 h-14 rounded-2xl object-cover border border-zinc-800 shadow-md"
                    />
                    <div>
                      <h3 className="text-base font-bold text-white">{artistName}</h3>
                      <p className="text-xs text-zinc-400">
                        {artistTracks.length} {t.totalTracks} • {Math.floor(totalArtistDuration / 60)} min
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => onPlayQueue(artistTracks)}
                    className="w-10 h-10 rounded-full bg-yellow-400 text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-md shrink-0"
                    title="Artiest afspelen"
                  >
                    <Play className="w-4 h-4 fill-black ml-0.5" />
                  </button>
                </div>

                {/* Song previews */}
                <div className="space-y-2 border-t border-zinc-800 pt-3">
                  {artistTracks.slice(0, 3).map((track) => (
                    <div
                      key={track.id}
                      onClick={() => onPlayTrack(track, artistTracks)}
                      className="flex items-center justify-between p-2 rounded-xl hover:bg-zinc-800/80 cursor-pointer text-xs group"
                    >
                      <span className="font-medium text-zinc-300 truncate group-hover:text-yellow-400">
                        {track.title}
                      </span>
                      <div className="flex items-center gap-2">
                        {track.bpm && (
                          <span className="text-[10px] font-mono text-yellow-400 font-bold">
                            {track.bpm} BPM
                          </span>
                        )}
                        <span className="text-zinc-500 text-[10px]">{track.durationFormatted}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CATEGORY: ALBUMS VIEW */}
      {activeCategory === 'albums' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {albumGroups.map(([albumKey, albumData]) => {
            const sampleTrack = albumData.tracks[0];

            return (
              <div
                key={albumKey}
                className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-3xl p-5 flex flex-col justify-between space-y-4 group shadow-xl"
              >
                <div className="relative aspect-square rounded-2xl overflow-hidden border border-zinc-800 shadow-lg">
                  <img
                    src={sampleTrack.coverUrl}
                    alt={sampleTrack.album}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-4">
                    <button
                      onClick={() => onPlayQueue(albumData.tracks)}
                      className="w-12 h-12 rounded-full bg-yellow-400 text-black flex items-center justify-center shadow-2xl hover:scale-110 transition-transform"
                    >
                      <Play className="w-5 h-5 fill-black ml-0.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-bold text-white truncate">{sampleTrack.album}</h3>
                  <p className="text-xs text-zinc-400 truncate">{albumData.artist}</p>
                  <div className="flex items-center justify-between text-[11px] text-zinc-500 mt-2">
                    <span>{albumData.year || '2024'}</span>
                    <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-medium">
                      {albumData.tracks.length} tracks
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CATEGORY: GENRES VIEW */}
      {activeCategory === 'genres' && (
        <div className="space-y-6">
          {genreGroups.map(([genreName, genreTracks]) => (
            <div key={genreName} className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-full bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 text-xs font-bold uppercase tracking-wider">
                    {genreName}
                  </span>
                  <span className="text-xs text-zinc-400 font-semibold">
                    {genreTracks.length} {t.totalTracks}
                  </span>
                </div>

                <button
                  onClick={() => onPlayQueue(genreTracks)}
                  className="text-xs text-zinc-400 hover:text-white font-bold flex items-center gap-1"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{t.playAll}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {genreTracks.map((track) => (
                  <div
                    key={track.id}
                    onClick={() => onPlayTrack(track, genreTracks)}
                    className="bg-zinc-950 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-3 flex items-center justify-between gap-3 cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={track.coverUrl}
                        alt={track.title}
                        className="w-10 h-10 rounded-xl object-cover shrink-0 border border-zinc-800"
                      />
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-white truncate group-hover:text-yellow-400 transition-colors">
                          {track.title}
                        </h4>
                        <p className="text-[11px] text-zinc-400 truncate">{track.artist}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {track.bpm && (
                        <span className="text-[10px] font-mono text-yellow-400 font-bold">
                          {track.bpm}
                        </span>
                      )}
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {track.durationFormatted}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ALL TRACKS / FAVORITES VIEW (GRID MODE) */}
      {(activeCategory === 'all' || activeCategory === 'favorites') && viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTracks.map((track) => {
            const isPlaying = playingTrackId === track.id;
            const trackCamelot = normalizeToCamelotKey(track.key);
            const keyMeta = CAMELOT_KEY_MAP[trackCamelot];

            // Platform glow styling
            let glowClass = 'text-yellow-400';
            if (track.platform === 'soundcloud') glowClass = 'text-amber-400';
            if (track.platform === 'youtube') glowClass = 'text-red-400';

            return (
              <div
                key={track.id}
                className={`bg-zinc-900 border rounded-3xl p-5 flex flex-col justify-between space-y-4 transition-all hover:border-zinc-700 relative group shadow-xl hover:shadow-2xl ${
                  isPlaying ? 'border-yellow-400/80 shadow-yellow-400/10' : 'border-zinc-800'
                }`}
              >
                {/* Top Artwork & Badges */}
                <div className="relative aspect-square rounded-2xl overflow-hidden border border-zinc-800 shadow-md">
                  <img
                    src={track.coverUrl}
                    alt={track.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />

                  {/* Favorite Button Overlay */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(track.id);
                    }}
                    className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-md transition-all ${
                      track.isFavorite
                        ? 'bg-pink-600 text-white'
                        : 'bg-black/60 text-zinc-400 hover:text-white'
                    }`}
                    title="Favoriet"
                  >
                    <Heart className={`w-4 h-4 ${track.isFavorite ? 'fill-current' : ''}`} />
                  </button>

                  {/* Platform Tag */}
                  <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur-md border border-zinc-800 text-[10px] font-mono uppercase font-bold text-white">
                    <span className={glowClass}>{track.platform}</span>
                  </div>

                  {/* Play Button Overlay */}
                  <div
                    onClick={() => onPlayTrack(track, filteredTracks)}
                    className={`absolute inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center cursor-pointer transition-opacity ${
                      isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <div className="w-14 h-14 rounded-full bg-yellow-400 text-black flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-transform">
                      <Play className="w-6 h-6 fill-black ml-1" />
                    </div>
                  </div>
                </div>

                {/* Metadata & DJ BPM/Key Pills */}
                <div className="space-y-2">
                  <h3
                    className="text-sm font-bold text-white truncate hover:text-yellow-400 transition-colors cursor-pointer"
                    onClick={() => onPlayTrack(track, filteredTracks)}
                  >
                    {track.title}
                  </h3>
                  <p className="text-xs text-zinc-400 truncate">{track.artist}</p>

                  {/* BPM & Key Tag Badges */}
                  <div className="flex items-center gap-2 pt-1">
                    {track.bpm ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenInspector(track);
                        }}
                        className="px-2 py-0.5 rounded-lg bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-400 border border-yellow-400/30 text-[10px] font-mono font-bold transition-all active:scale-95 flex items-center gap-1"
                        title="Klik om BPM tempo & beat grid te inspecteren / fine-tunen"
                      >
                        <Zap className="w-2.5 h-2.5" />
                        <span>{track.bpm} BPM</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSingleScanTrack(track)}
                        className="px-2 py-0.5 rounded-lg bg-zinc-800 hover:bg-yellow-400 hover:text-black text-yellow-400 border border-zinc-700 text-[10px] font-bold flex items-center gap-1 transition-all active:scale-95"
                      >
                        <Zap className="w-2.5 h-2.5" />
                        <span>Scan BPM</span>
                      </button>
                    )}

                    {track.key ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenInspector(track);
                        }}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold border transition-all active:scale-95 flex items-center gap-1 ${keyMeta?.bgClass || 'bg-purple-500/20'} ${keyMeta?.textClass || 'text-purple-300'} ${keyMeta?.borderClass || 'border-purple-500/40'} hover:brightness-125`}
                        title={`Camelot: ${trackCamelot} • ${keyMeta?.standard} (${keyMeta?.mode}) - Klik voor harmonisch wiel`}
                      >
                        <Disc className="w-2.5 h-2.5" />
                        <span>{trackCamelot}</span>
                        <span className="opacity-75 hidden sm:inline">({keyMeta?.standard})</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSingleScanTrack(track)}
                        className="px-2 py-0.5 rounded-lg bg-zinc-800 hover:bg-purple-400 hover:text-black text-purple-300 border border-zinc-700 text-[10px] font-bold transition-all active:scale-95"
                      >
                        Scan Key
                      </button>
                    )}
                  </div>
                </div>

                {/* Footer Stats & Quick Action Bar */}
                <div className="pt-3 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-zinc-800 text-[10px] font-mono text-zinc-300 border border-zinc-700">
                      {track.format?.toUpperCase() || 'MP3'}
                    </span>
                    <span>{track.durationFormatted}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Audio DSP Analysis Inspector */}
                    <button
                      onClick={() => handleOpenInspector(track)}
                      className="p-1.5 rounded-lg hover:bg-zinc-800 text-yellow-400 hover:text-yellow-300 transition-colors"
                      title="Audio DSP, BPM & Camelot Key Inspecteren"
                    >
                      <Zap className="w-3.5 h-3.5" />
                    </button>

                    {/* Add to Playlist button */}
                    <button
                      onClick={() => onOpenAddToPlaylist(track)}
                      className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-yellow-300 transition-colors"
                      title="Toevoegen aan afspeellijst"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => onOpenTagEditor(track)}
                      className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                      title={t.editTags}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    {track.lyrics && (
                      <button
                        onClick={() => onOpenLyrics(track)}
                        className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                        title={t.viewLyrics}
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => onReDownloadTrack(track)}
                      className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-yellow-400 transition-colors"
                      title="Opnieuw Downloaden"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => onDeleteTrack(track.id)}
                      className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-red-400 transition-colors"
                      title={t.deleteTrack}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ALL TRACKS / FAVORITES VIEW (COMPACT LIST TABLE MODE) */}
      {(activeCategory === 'all' || activeCategory === 'favorites') && viewMode === 'list' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 uppercase tracking-wider font-mono">
                <tr>
                  <th className="py-3.5 px-4 w-12 text-center">#</th>
                  <th
                    className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors"
                    onClick={() => setSortBy('title')}
                  >
                    <div className="flex items-center gap-1">
                      <span>{t.titleLabel}</span>
                      {sortBy === 'title' && <span className="text-yellow-400">▲</span>}
                    </div>
                  </th>
                  <th
                    className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors"
                    onClick={() => setSortBy('artist')}
                  >
                    <div className="flex items-center gap-1">
                      <span>{t.artistLabel}</span>
                      {sortBy === 'artist' && <span className="text-yellow-400">▲</span>}
                    </div>
                  </th>
                  <th
                    className="py-3.5 px-4 text-center cursor-pointer hover:text-yellow-300 transition-colors"
                    onClick={() => setSortBy(sortBy === 'bpm_desc' ? 'bpm_asc' : 'bpm_desc')}
                    title="Klik om te sorteren op BPM (snel / langzaam)"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <Zap className="w-3 h-3 text-yellow-400" />
                      <span>BPM</span>
                      {sortBy === 'bpm_desc' && <span className="text-yellow-400">▼</span>}
                      {sortBy === 'bpm_asc' && <span className="text-yellow-400">▲</span>}
                    </div>
                  </th>
                  <th
                    className="py-3.5 px-4 text-center cursor-pointer hover:text-purple-300 transition-colors"
                    onClick={() => setSortBy(sortBy === 'camelot_asc' ? 'camelot_desc' : 'camelot_asc')}
                    title="Klik om te sorteren op Camelot toonsoort (1A -> 12B)"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <Disc className="w-3 h-3 text-purple-400" />
                      <span>Camelot Key</span>
                      {sortBy === 'camelot_asc' && <span className="text-purple-400">▲</span>}
                      {sortBy === 'camelot_desc' && <span className="text-purple-400">▼</span>}
                    </div>
                  </th>
                  <th className="py-3.5 px-4 hidden md:table-cell">{t.albumLabel}</th>
                  <th className="py-3.5 px-4 hidden sm:table-cell">{t.genreLabel}</th>
                  <th
                    className="py-3.5 px-4 text-right cursor-pointer hover:text-white transition-colors"
                    onClick={() => setSortBy('duration')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Duur</span>
                      {sortBy === 'duration' && <span className="text-yellow-400">▼</span>}
                    </div>
                  </th>
                  <th className="py-3.5 px-4 text-center w-40">Acties</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80 text-zinc-200">
                {filteredTracks.map((track, idx) => {
                  const isPlaying = playingTrackId === track.id;
                  const trackCamelot = normalizeToCamelotKey(track.key);
                  const keyMeta = CAMELOT_KEY_MAP[trackCamelot];
                  
                  // Check harmonic compatibility with playing track
                  const playingTrack = library.find((t) => t.id === playingTrackId);
                  const isHarmonicMatch = playingTrack && playingTrack.id !== track.id && track.key && playingTrack.key
                    ? areKeysHarmonicallyCompatible(playingTrack.key, track.key).isCompatible
                    : false;

                  return (
                    <tr
                      key={track.id}
                      className={`hover:bg-zinc-800/60 transition-colors group ${
                        isPlaying ? 'bg-yellow-400/10' : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-center font-mono text-zinc-500">
                        <button
                          onClick={() => onPlayTrack(track, filteredTracks)}
                          className="hover:text-white"
                        >
                          {isPlaying ? (
                            <Disc className="w-4 h-4 text-yellow-400 animate-spin mx-auto" />
                          ) : (
                            <span>{idx + 1}</span>
                          )}
                        </button>
                      </td>

                      <td className="py-3 px-4 font-medium">
                        <div className="flex items-center gap-3">
                          <img
                            src={track.coverUrl}
                            alt={track.title}
                            className="w-10 h-10 rounded-xl object-cover shrink-0 border border-zinc-800"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p
                                onClick={() => onPlayTrack(track, filteredTracks)}
                                className="font-bold text-white truncate hover:text-yellow-400 cursor-pointer"
                              >
                                {track.title}
                              </p>
                              {isHarmonicMatch && (
                                <span
                                  className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold shrink-0 hidden sm:inline"
                                  title="Harmonisch compatibel met huidig afspelend nummer!"
                                >
                                  ✨ Mix Match
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] uppercase font-mono text-zinc-500 sm:hidden">
                              {track.artist}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-zinc-300 font-semibold">{track.artist}</td>

                      {/* BPM Cell with interactive badge */}
                      <td className="py-3 px-4 text-center font-mono font-bold">
                        {track.bpm ? (
                          <button
                            type="button"
                            onClick={() => handleOpenInspector(track)}
                            className="px-2 py-0.5 rounded-lg bg-yellow-400/10 hover:bg-yellow-400/20 text-yellow-400 border border-yellow-400/20 hover:border-yellow-400/40 text-xs font-mono font-bold transition-all active:scale-95 inline-flex items-center gap-1"
                            title="Klik om BPM & tap tempo matrix te openen"
                          >
                            <Zap className="w-3 h-3 text-yellow-400" />
                            <span>{track.bpm}</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSingleScanTrack(track)}
                            className="px-2 py-0.5 rounded-md bg-zinc-800 text-[10px] text-zinc-400 hover:text-yellow-400 hover:bg-zinc-700 transition-colors border border-zinc-700"
                          >
                            Scan
                          </button>
                        )}
                      </td>

                      {/* Camelot Key Cell with interactive colored badge */}
                      <td className="py-3 px-4 text-center">
                        {track.key ? (
                          <button
                            type="button"
                            onClick={() => handleOpenInspector(track)}
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold border transition-all active:scale-95 ${keyMeta?.bgClass || 'bg-purple-500/20'} ${keyMeta?.textClass || 'text-purple-300'} ${keyMeta?.borderClass || 'border-purple-500/40'} hover:brightness-125`}
                            title={`Camelot: ${trackCamelot} • Standaard: ${keyMeta?.standard} (${keyMeta?.mode}) - Klik voor harmonisch mengwiel`}
                          >
                            <Disc className="w-3 h-3 shrink-0" />
                            <span>{trackCamelot}</span>
                            <span className="opacity-75 hidden xl:inline text-[10px]">({keyMeta?.standard})</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSingleScanTrack(track)}
                            className="px-2 py-0.5 rounded-md bg-zinc-800 text-[10px] text-zinc-400 hover:text-purple-300 hover:bg-zinc-700 transition-colors border border-zinc-700"
                          >
                            Scan
                          </button>
                        )}
                      </td>

                      <td className="py-3 px-4 text-zinc-400 hidden md:table-cell">{track.album}</td>

                      <td className="py-3 px-4 hidden sm:table-cell">
                        <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 text-[10px] border border-zinc-700">
                          {track.genre}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-zinc-400">
                        {track.durationFormatted}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Audio DSP Analysis button */}
                          <button
                            onClick={() => handleOpenInspector(track)}
                            className="p-1.5 rounded-lg text-yellow-400 hover:text-yellow-300 hover:bg-zinc-800 transition-colors"
                            title="BPM & Camelot Toonsoort Inspecteren"
                          >
                            <Zap className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onOpenAddToPlaylist(track)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-yellow-300 hover:bg-zinc-800 transition-colors"
                            title="Toevoegen aan afspeellijst"
                          >
                            <FolderPlus className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onToggleFavorite(track.id)}
                            className={`p-1.5 rounded-lg transition-colors hover:bg-zinc-800 ${
                              track.isFavorite ? 'text-pink-500' : 'text-zinc-500 hover:text-white'
                            }`}
                          >
                            <Heart className={`w-3.5 h-3.5 ${track.isFavorite ? 'fill-current' : ''}`} />
                          </button>

                          <button
                            onClick={() => onOpenTagEditor(track)}
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
                            title="ID3 Tags bewerken"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onReDownloadTrack(track)}
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-yellow-400 hover:bg-zinc-800 transition-colors"
                            title="Opnieuw Downloaden"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onDeleteTrack(track.id)}
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                            title={t.deleteTrack}
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

      {/* Internal Audio Analysis Modal fallback */}
      {internalAnalysisTrack && (
        <AudioAnalysisModal
          isOpen={!!internalAnalysisTrack}
          track={internalAnalysisTrack}
          language={language}
          library={library}
          isPlaying={playingTrackId === internalAnalysisTrack.id}
          onPlayTrack={(t) => onPlayTrack(t, library)}
          onClose={() => setInternalAnalysisTrack(null)}
          onSaveTrackAnalysis={handleSaveInternalAnalysis}
        />
      )}

      {/* Export Library Metadata Modal (Excel, JSON, CSV) */}
      <ExportLibraryModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        language={language}
        library={library}
        filteredTracks={filteredTracks}
        playlists={playlists}
      />
    </div>
  );
};
