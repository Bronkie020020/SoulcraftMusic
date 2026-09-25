import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { SearchSection } from './components/SearchSection';
import { TrackCard } from './components/TrackCard';
import { TagEditorModal } from './components/TagEditorModal';
import { LyricsModal } from './components/LyricsModal';
import { CrossLinksModal } from './components/CrossLinksModal';
import { QRCodeModal } from './components/QRCodeModal';
import { WindowsInstallModal } from './components/WindowsInstallModal';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { BatchDownloadSection } from './components/BatchDownloadSection';
import { DownloadHistory } from './components/DownloadHistory';
import { FeatureHighlights } from './components/FeatureHighlights';
import { MusicLibrary } from './components/MusicLibrary';
import { StorageCleanupModal } from './components/StorageCleanupModal';
import { AddToPlaylistModal } from './components/AddToPlaylistModal';
import { SmartPlaylistModal } from './components/SmartPlaylistModal';
import { AudioAnalysisModal } from './components/AudioAnalysisModal';
import { StartupSplashScreen } from './components/StartupSplashScreen';
import { SettingsPanel } from './components/SettingsPanel';
import { AppLanguage, AppTheme, MusicTrack, Platform, DownloadMetrics, Playlist } from './types';
import { Play, Download, ListMusic, ShieldCheck, CheckCircle2, WifiOff, Library, HardDrive, AlertTriangle, Sparkles, Loader2, Check } from 'lucide-react';
import { renderTrackToAudioBlob, triggerFileDownload } from './utils/audioEncoder';
import { SAMPLE_LIBRARY_TRACKS, SAMPLE_PLAYLISTS } from './utils/sampleLibraryData';
import { safeJsonStringify } from './utils/jsonUtils';
import { useDownload } from './context/DownloadContext';
import {
  getAllPlaylistsFromDb,
  getAllTracksFromDb,
  convertStoredTrackToMusicTrack,
  savePlaylistToDb,
  deletePlaylistFromDb,
} from './db/libraryDb';

export default function App() {
  const {
    enqueueDownload,
    enqueueBatchDownloads,
    activeDownloads,
    completedDownloads,
    queue,
    getTrackStatus,
  } = useDownload();
  const [showSplashScreen, setShowSplashScreen] = useState<boolean>(true);
  const [theme, setTheme] = useState<AppTheme>(() => {
    try {
      const saved = localStorage.getItem('soundstreamer_theme');
      if (saved === 'light-purple' || saved === 'light-blue' || saved === 'dark') {
        return saved as AppTheme;
      }
    } catch (e) {}
    // Vaste standaardinstelling bij opstarten: Licht Paars Neon Thema
    return 'light-purple';
  });

  const handleToggleTheme = () => {
    setTheme((prev) => {
      let next: AppTheme = 'light-purple';
      if (prev === 'light-purple') next = 'light-blue';
      else if (prev === 'light-blue') next = 'dark';
      else next = 'light-purple';
      try {
        localStorage.setItem('soundstreamer_theme', next);
      } catch (e) {}
      return next;
    });
  };

  useEffect(() => {
    try {
      localStorage.setItem('soundstreamer_theme', theme);
    } catch (e) {}
    if (theme === 'light-purple') {
      document.body.style.backgroundColor = '#f5f0ff';
      document.body.style.color = '#3b0764';
    } else if (theme === 'light-blue') {
      document.body.style.backgroundColor = '#eff6ff';
      document.body.style.color = '#0f172a';
    } else {
      document.body.style.backgroundColor = '#000000';
      document.body.style.color = '#f1f5f9';
    }
  }, [theme]);

  const [language, setLanguage] = useState<AppLanguage['code']>('nl');
  const [activeTab, setActiveTab] = useState<'downloader' | 'library'>('downloader');
    const [selectedPlatformFilter, setSelectedPlatformFilter] = useState<Platform | 'all'>('all');
  const [isSearching, setIsSearching] = useState(false);
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [playlistInfo, setPlaylistInfo] = useState<{ isPlaylist: boolean; title?: string; isSyncVerified?: boolean; matchAccuracy?: string } | null>(null);
  
  // Audio playback & Queue
  const [playingTrack, setPlayingTrack] = useState<MusicTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackQueue, setPlaybackQueue] = useState<MusicTrack[]>([]);
  const [queueIndex, setQueueIndex] = useState<number>(-1);

  // Download history & Music Library persistence & Playlists
  const [downloadHistory, setDownloadHistory] = useState<MusicTrack[]>([]);
  const [libraryTracks, setLibraryTracks] = useState<MusicTrack[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Modals state
  const [activeTagTrack, setActiveTagTrack] = useState<MusicTrack | null>(null);
  const [activeLyricsTrack, setActiveLyricsTrack] = useState<MusicTrack | null>(null);
  const [activeCrossTrack, setActiveCrossTrack] = useState<MusicTrack | null>(null);
  const [activeAddToPlaylistTrack, setActiveAddToPlaylistTrack] = useState<MusicTrack | null>(null);
  const [activeAnalysisTrack, setActiveAnalysisTrack] = useState<MusicTrack | null>(null);
  const [showSmartPlaylistModal, setShowSmartPlaylistModal] = useState<boolean>(false);
  const [showQRCodeModal, setShowQRCodeModal] = useState<boolean>(false);
  const [showStorageModal, setShowStorageModal] = useState<boolean>(false);
  const [showWindowsInstallModal, setShowWindowsInstallModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [hasPromptedStorageAlert, setHasPromptedStorageAlert] = useState<boolean>(false);
  const [storageLimitMb, setStorageLimitMb] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('soundstreamer_storage_limit_mb');
      if (saved !== null) {
        const parsed = Number(saved);
        if (!isNaN(parsed)) return parsed;
      }
    } catch (e) {}
    return 5000; // Default 5 GB (verhoogd vanaf 500 MB)
  });

  const handleUpdateStorageLimit = (newLimit: number) => {
    setStorageLimitMb(newLimit);
    try {
      localStorage.setItem('soundstreamer_storage_limit_mb', String(newLimit));
    } catch (e) {}
  };

  const formatStorageLimit = (mb: number) => {
    if (mb <= 0) return language === 'nl' ? 'Onbeperkt' : 'Unlimited';
    if (mb >= 1000) return `${mb / 1000} GB`;
    return `${mb} MB`;
  };
  const [isAutoEnriching, setIsAutoEnriching] = useState<boolean>(false);
  const [enrichToast, setEnrichToast] = useState<string | null>(null);

  // Handle Save Audio Analysis (BPM & Camelot Key)
  const handleSaveAudioAnalysis = (trackId: string, bpm: number, key: string) => {
    setLibraryTracks((prev) => {
      const updated = prev.map((t) => (t.id === trackId ? { ...t, bpm, key } : t));
      try {
        localStorage.setItem('soundstreamer_library', safeJsonStringify(updated));
      } catch (e) {}
      return updated;
    });

    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, bpm, key } : t)));

    setDownloadHistory((prev) => {
      const updated = prev.map((t) => (t.id === trackId ? { ...t, bpm, key } : t));
      try {
        localStorage.setItem('soundstreamer_history', safeJsonStringify(updated));
      } catch (e) {}
      return updated;
    });

    if (playingTrack?.id === trackId) {
      setPlayingTrack((prev) => (prev ? { ...prev, bpm, key } : null));
    }
  };

  // Capture Windows/Chrome/Edge PWA install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleTriggerPwaInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    if (choiceResult?.outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowWindowsInstallModal(false);
    }
  };

  // Storage calculation metrics
  const historySizeMb = downloadHistory.reduce((sum, t) => sum + (t.fileSizeMb || 7.5), 0);
  const librarySizeMb = libraryTracks.reduce((sum, t) => sum + (t.fileSizeMb || 7.5), 0);
  const nonFavoritesTracks = libraryTracks.filter((t) => !t.isFavorite);
  const nonFavoritesSizeMb = nonFavoritesTracks.reduce((sum, t) => sum + (t.fileSizeMb || 7.5), 0);
  const totalStorageMb = Number((historySizeMb + librarySizeMb).toFixed(1));

  // Auto-populate missing ID3 metadata for all library tracks by querying iTunes, Deezer & Gemini APIs
  const handleAutoEnrichLibrary = async () => {
    if (libraryTracks.length === 0 || isAutoEnriching) return;
    setIsAutoEnriching(true);
    setEnrichToast(null);

    try {
      const res = await fetch('/api/enrich-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: safeJsonStringify({ tracks: libraryTracks }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.tracks)) {
        updateLibrary(data.tracks);
        const msg =
          language === 'nl'
            ? `ID3 Metadata (Genre, Jaar, Album) succesvol bijgewerkt voor ${data.tracks.length} nummers!`
            : `ID3 Metadata (Genre, Year, Album) successfully updated for ${data.tracks.length} tracks!`;
        setEnrichToast(msg);
        setTimeout(() => setEnrichToast(null), 5000);
      }
    } catch (err) {
      console.error('Batch auto-enrich error:', err);
    } finally {
      setIsAutoEnriching(false);
    }
  };

  const isOverStorageLimit = storageLimitMb > 0 && totalStorageMb >= storageLimitMb;

  // Auto-cleanup prompt trigger if cumulative storage exceeds user limit
  useEffect(() => {
    if (isOverStorageLimit && !hasPromptedStorageAlert) {
      setShowStorageModal(true);
      setHasPromptedStorageAlert(true);
    }
  }, [isOverStorageLimit, hasPromptedStorageAlert]);

  // Download state map: trackId -> DownloadMetrics
  const [downloadState, setDownloadState] = useState<Record<string, DownloadMetrics>>({});

  // Merge local downloadState with active background downloads from DownloadProvider
  const combinedDownloadState = React.useMemo<Record<string, DownloadMetrics>>(() => {
    const map: Record<string, DownloadMetrics> = { ...downloadState };
    for (const [id, active] of Object.entries(activeDownloads)) {
      map[id] = {
        progress: active.progress,
        status: active.status,
        speedFormatted: active.speedFormatted,
        etaFormatted: active.etaFormatted,
        loadedMb: active.loadedMb,
        totalMb: active.totalMb,
      };
    }
    return map;
  }, [downloadState, activeDownloads]);

  // Initial load: start clean with saved data or empty state (no auto-mock search)
  useEffect(() => {
    // Load download history from localStorage
    try {
      const savedHistory = localStorage.getItem('soundstreamer_history');
      if (savedHistory) {
        setDownloadHistory(JSON.parse(savedHistory));
      }
    } catch (e) {}

    // Load music library from localStorage
    try {
      const savedLibrary = localStorage.getItem('soundstreamer_library');
      if (savedLibrary) {
        const parsed = JSON.parse(savedLibrary);
        setLibraryTracks(parsed);
      }
    } catch (e) {}

    // Load persisted library & tracks from IndexedDB (preserves audioBlobs)
    getAllTracksFromDb().then((stored) => {
      if (stored && stored.length > 0) {
        const converted = stored.map(convertStoredTrackToMusicTrack);
        setLibraryTracks((prev) => {
          const map = new Map<string, MusicTrack>();
          prev.forEach((t) => map.set(t.id, t));
          converted.forEach((t) => map.set(t.id, t));
          return Array.from(map.values());
        });
      }
    }).catch((err) => console.warn('IndexedDB tracks load note:', err));

    // Load playlists from localStorage
    try {
      const savedPlaylists = localStorage.getItem('soundstreamer_playlists');
      if (savedPlaylists) {
        const parsed = JSON.parse(savedPlaylists);
        setPlaylists(parsed);
      }
    } catch (e) {}

    // Load persisted playlists from IndexedDB
    getAllPlaylistsFromDb().then((stored) => {
      if (stored && stored.length > 0) {
        setPlaylists((prev) => {
          const map = new Map<string, Playlist>();
          prev.forEach((p) => map.set(p.id, p));
          stored.forEach((s) => {
            if (!map.has(s.id)) {
              map.set(s.id, {
                id: s.id,
                name: s.name,
                coverUrl: s.coverUrl,
                trackIds: [],
                createdAt: new Date(s.createdAt).toISOString(),
                description: s.description,
                color: s.color,
              });
            }
          });
          return Array.from(map.values());
        });
      }
    }).catch((err) => console.warn('IndexedDB playlists load note:', err));
  }, []);

  // Refresh library and playlists whenever completed downloads update in background
  useEffect(() => {
    if (completedDownloads.size > 0) {
      getAllTracksFromDb().then((stored) => {
        if (stored && stored.length > 0) {
          const converted = stored.map(convertStoredTrackToMusicTrack);
          setLibraryTracks((prev) => {
            const map = new Map<string, MusicTrack>();
            prev.forEach((t) => map.set(t.id, t));
            converted.forEach((t) => map.set(t.id, t));
            return Array.from(map.values());
          });
        }
      }).catch((err) => console.warn('IndexedDB tracks reload note:', err));

      getAllPlaylistsFromDb().then((stored) => {
        if (stored && stored.length > 0) {
          setPlaylists((prev) => {
            const map = new Map<string, Playlist>();
            prev.forEach((p) => map.set(p.id, p));
            stored.forEach((s) => {
              const existing = map.get(s.id);
              if (existing) {
                map.set(s.id, {
                  ...existing,
                  name: s.name,
                  coverUrl: s.coverUrl || existing.coverUrl,
                });
              } else {
                map.set(s.id, {
                  id: s.id,
                  name: s.name,
                  coverUrl: s.coverUrl,
                  trackIds: [],
                  createdAt: new Date(s.createdAt).toISOString(),
                  description: s.description,
                  color: s.color,
                });
              }
            });
            return Array.from(map.values());
          });
        }
      }).catch((err) => console.warn('IndexedDB playlists reload note:', err));
    }
  }, [completedDownloads]);

  // Sync playlists to state & localStorage
  const updatePlaylists = (newPlaylists: Playlist[]) => {
    setPlaylists(newPlaylists);
    try {
      localStorage.setItem('soundstreamer_playlists', safeJsonStringify(newPlaylists));
    } catch (e) {}
  };

  // Create or add playlist with IndexedDB persistence
  const handleSavePlaylist = (playlist: Playlist) => {
    const exists = playlists.some((p) => p.id === playlist.id);
    let updated: Playlist[];
    if (exists) {
      updated = playlists.map((p) => (p.id === playlist.id ? playlist : p));
    } else {
      updated = [playlist, ...playlists];
    }
    updatePlaylists(updated);
    savePlaylistToDb({
      id: playlist.id,
      name: playlist.name,
      coverUrl: playlist.coverUrl,
      createdAt: playlist.createdAt ? new Date(playlist.createdAt).getTime() : Date.now(),
      description: playlist.description,
      color: playlist.color,
    }).catch((err) => console.warn('IndexedDB playlist save note:', err));
  };

  const handleCreateNewPlaylist = (name: string, description?: string, color?: string): Playlist => {
    const newPl: Playlist = {
      id: `pl-${Date.now()}`,
      name,
      description: description || '',
      color: color || 'yellow',
      trackIds: [],
      createdAt: new Date().toISOString(),
    };
    handleSavePlaylist(newPl);
    return newPl;
  };

  const handleToggleTrackInPlaylist = (playlistId: string, trackId: string) => {
    const updated = playlists.map((p) => {
      if (p.id === playlistId) {
        const hasTrack = p.trackIds.includes(trackId);
        return {
          ...p,
          trackIds: hasTrack ? p.trackIds.filter((id) => id !== trackId) : [...p.trackIds, trackId],
        };
      }
      return p;
    });
    updatePlaylists(updated);
  };

  const handleDeletePlaylist = (playlistId: string) => {
    const updated = playlists.filter((p) => p.id !== playlistId);
    updatePlaylists(updated);
    deletePlaylistFromDb(playlistId).catch((err) => console.warn('IndexedDB playlist delete note:', err));
  };

  const handleRemoveTrackFromPlaylist = (playlistId: string, trackId: string) => {
    const updated = playlists.map((p) => {
      if (p.id === playlistId) {
        return { ...p, trackIds: p.trackIds.filter((id) => id !== trackId) };
      }
      return p;
    });
    updatePlaylists(updated);
  };

  // Sync libraryTracks to localStorage
  const updateLibrary = (newLibrary: MusicTrack[]) => {
    setLibraryTracks(newLibrary);
    try {
      localStorage.setItem('soundstreamer_library', safeJsonStringify(newLibrary));
    } catch (e) {}
  };

  // Seed demo tracks
  const handleSeedDemoTracks = () => {
    updateLibrary(SAMPLE_LIBRARY_TRACKS);
    updatePlaylists(SAMPLE_PLAYLISTS);
  };

  // Save history to localStorage
  const saveToHistory = (track: MusicTrack) => {
    const nowIso = new Date().toISOString();
    const sanitize = (s: string) => s.replace(/[/\\?%*:|"<>]/g, '');
    const ext = track.format || 'mp3';
    const computedFilePath = track.filePath || `Music/${sanitize(track.artist || 'Unknown')} - ${sanitize(track.title || 'Track')}.${ext}`;
    const trackWithMeta: MusicTrack = {
      ...track,
      isDownloaded: true,
      downloadedAt: track.downloadedAt || nowIso,
      filePath: computedFilePath,
      addedAt: track.addedAt || nowIso,
    };

    setDownloadHistory((prev) => {
      const filtered = prev.filter((item) => item.id !== trackWithMeta.id);
      const updated = [trackWithMeta, ...filtered].slice(0, 20);
      try {
        localStorage.setItem('soundstreamer_history', safeJsonStringify(updated));
      } catch (e) {}
      return updated;
    });

    // Also automatically add to music library if not present or update existing
    setLibraryTracks((prev) => {
      const existsIdx = prev.findIndex((t) => t.id === trackWithMeta.id || (t.title === trackWithMeta.title && t.artist === trackWithMeta.artist));
      let updated: MusicTrack[];
      if (existsIdx !== -1) {
        updated = prev.map((t, idx) => (idx === existsIdx ? { ...t, ...trackWithMeta } : t));
      } else {
        updated = [trackWithMeta, ...prev];
      }
      try {
        localStorage.setItem('soundstreamer_library', safeJsonStringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const clearHistory = () => {
    setDownloadHistory([]);
    try {
      localStorage.removeItem('soundstreamer_history');
    } catch (e) {}
  };

  // Storage Cleanup: Remove non-favorite tracks from library
  const handleClearNonFavorites = () => {
    const favoritesOnly = libraryTracks.filter((t) => t.isFavorite);
    updateLibrary(favoritesOnly);
  };

  // Storage Cleanup: Wipe all history and clear non-essential cache
  const handleClearAllCache = () => {
    clearHistory();
    updateLibrary([]);
  };

  // Full App Reset: Wipe all history, library tracks and playlists completely
  const handleResetAllData = () => {
    setTracks([]);
    setDownloadHistory([]);
    setLibraryTracks([]);
    setPlaylists([]);
    setPlayingTrack(null);
    setIsPlaying(false);
    setPlaybackQueue([]);
    setDownloadState({});
    try {
      localStorage.removeItem('soundstreamer_history');
      localStorage.removeItem('soundstreamer_library');
      localStorage.removeItem('soundstreamer_playlists');
    } catch (e) {}
  };

  // Toggle favorite status on a library track
  const handleToggleFavorite = (trackId: string) => {
    const updated = libraryTracks.map((t) =>
      t.id === trackId ? { ...t, isFavorite: !t.isFavorite } : t
    );
    updateLibrary(updated);
  };

  // Delete track from library
  const handleDeleteFromLibrary = (trackId: string) => {
    const updated = libraryTracks.filter((t) => t.id !== trackId);
    updateLibrary(updated);
  };

  // Play a single track with option to pass parent queue list
  const handlePlayTrack = (track: MusicTrack, queueList?: MusicTrack[]) => {
    if (playingTrack?.id === track.id) {
      setIsPlaying(!isPlaying);
      return;
    }
    setPlayingTrack(track);
    setIsPlaying(true);
    if (queueList && queueList.length > 0) {
      setPlaybackQueue(queueList);
      const idx = queueList.findIndex((t) => t.id === track.id);
      setQueueIndex(idx !== -1 ? idx : 0);
    } else {
      setPlaybackQueue([track]);
      setQueueIndex(0);
    }
  };

  // Play an entire queue from index 0
  const handlePlayQueue = (queue: MusicTrack[]) => {
    if (queue.length > 0) {
      setPlaybackQueue(queue);
      setQueueIndex(0);
      setPlayingTrack(queue[0]);
      setIsPlaying(true);
    }
  };

  // Queue Next & Previous controls
  const handleNextTrack = () => {
    if (playbackQueue.length > 0 && queueIndex < playbackQueue.length - 1) {
      const nextIdx = queueIndex + 1;
      setQueueIndex(nextIdx);
      setPlayingTrack(playbackQueue[nextIdx]);
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  };

  const handlePrevTrack = () => {
    if (playbackQueue.length > 0 && queueIndex > 0) {
      const prevIdx = queueIndex - 1;
      setQueueIndex(prevIdx);
      setPlayingTrack(playbackQueue[prevIdx]);
      setIsPlaying(true);
    }
  };

  // Search API handler
  const handleSearch = async (query: string) => {
    setIsSearching(true);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: safeJsonStringify({ query }),
      });

      const data = await res.json();
      if (data.isPlaylist && data.playlistTitle) {
        setPlaylistInfo({
          isPlaylist: true,
          title: data.playlistTitle,
          isSyncVerified: data.isSyncVerified ?? true,
          matchAccuracy: data.matchAccuracy || '100%',
        });
      } else {
        setPlaylistInfo({
          isPlaylist: false,
          isSyncVerified: data.isSyncVerified ?? true,
          matchAccuracy: data.matchAccuracy || '100%',
        });
      }

      if (data.tracks && Array.isArray(data.tracks) && data.tracks.length > 0) {
        setTracks(data.tracks);
      } else if (data.track) {
        setTracks([data.track]);
      }
    } catch (err) {
      console.error('Search request failed', err);
    } finally {
      setIsSearching(false);
    }
  };

  // Single track download action (delegates to global DownloadProvider with IndexedDB persistence)
  const handleDownloadTrack = async (track: MusicTrack, format: string = 'mp3-320') => {
    let targetPlaylistId = track.playlistId || 'library';
    if (playlistInfo?.isPlaylist && playlistInfo.title) {
      const existingPl = playlists.find(
        (p) => p.name.toLowerCase() === (playlistInfo.title || '').toLowerCase()
      );
      if (existingPl) {
        targetPlaylistId = existingPl.id;
      } else {
        const newPl = handleCreateNewPlaylist(playlistInfo.title, `Gedownload via Spotify (${playlistInfo.title})`);
        targetPlaylistId = newPl.id;
      }
    }
    enqueueDownload(track, targetPlaylistId, format);
  };

  // Filtered tracks list based on platform
  const filteredSearchTracks = tracks.filter((t) => {
    if (selectedPlatformFilter === 'all') return true;
    return t.platform === selectedPlatformFilter;
  });

  // Batch download progress & metrics for active search results
  const batchDownloadStats = React.useMemo(() => {
    const total = filteredSearchTracks.length;
    if (total === 0) return { total: 0, completed: 0, activeOrQueued: 0, isDownloading: false, allCompleted: false };

    let completed = 0;
    let activeOrQueued = 0;

    for (const t of filteredSearchTracks) {
      const metric = combinedDownloadState[t.id];
      if (completedDownloads.has(t.id) || t.isDownloaded || metric?.status === 'ready' || metric?.progress === 100) {
        completed++;
      } else if (activeDownloads[t.id] || queue.some((q) => q.track.id === t.id)) {
        activeOrQueued++;
      }
    }

    const isDownloading = activeOrQueued > 0;
    const allCompleted = total > 0 && completed === total;

    return { total, completed, activeOrQueued, isDownloading, allCompleted };
  }, [filteredSearchTracks, completedDownloads, combinedDownloadState, activeDownloads, queue]);

  // Batch "Download Alles" handler for current search / playlist view
  const handleDownloadAllSearchResults = async () => {
    if (filteredSearchTracks.length === 0) return;

    // 1. Ensure playlist entity exists so "Afspeellijsten" counter & directory are created
    const isPlaylist = playlistInfo?.isPlaylist;
    const playlistName = playlistInfo?.title || (isPlaylist ? 'Gedownloade Afspeellijst' : 'Zoekresultaten Batch');

    // Check if playlist already exists or create new
    const existingPl = playlists.find((p) => p.name.toLowerCase() === playlistName.toLowerCase());
    const playlistId = existingPl ? existingPl.id : `pl-${Date.now()}`;
    const trackIds = filteredSearchTracks.map((t) => t.id);

    const targetPlaylist: Playlist = existingPl
      ? {
          ...existingPl,
          trackIds: Array.from(new Set([...existingPl.trackIds, ...trackIds])),
          coverUrl: existingPl.coverUrl || filteredSearchTracks[0]?.coverUrl || '',
        }
      : {
          id: playlistId,
          name: playlistName,
          coverUrl: filteredSearchTracks[0]?.coverUrl || '',
          trackIds,
          createdAt: new Date().toISOString(),
          description: `Gedownload via Spotify / Zoekfunctie (${filteredSearchTracks.length} nummers)`,
          color: 'yellow',
        };

    // Update React State & localStorage & IndexedDB
    handleSavePlaylist(targetPlaylist);

    // 2. Also register tracks to history with playlistId
    filteredSearchTracks.forEach((t) => {
      saveToHistory({
        ...t,
        playlistId,
      });
    });

    // 3. Push batch to global download manager (respects concurrency limit 1-5)
    enqueueBatchDownloads(filteredSearchTracks, playlistId);
  };

  // Save updated ID3 tags
  const handleSaveTags = (updatedTrack: MusicTrack) => {
    setTracks((prev) => prev.map((t) => (t.id === updatedTrack.id ? updatedTrack : t)));
    setLibraryTracks((prev) => prev.map((t) => (t.id === updatedTrack.id ? updatedTrack : t)));
    if (playingTrack?.id === updatedTrack.id) {
      setPlayingTrack(updatedTrack);
    }
    setActiveTagTrack(null);
  };

  return (
    <div
      data-theme={theme}
      className={`min-h-screen min-h-[100dvh] ${
        theme === 'light-purple'
          ? 'theme-light-purple bg-gradient-to-br from-[#faf7ff] via-[#f4ebff] to-[#ebe1fa] text-purple-950'
          : theme === 'light-blue'
          ? 'theme-light-blue bg-gradient-to-br from-sky-100 via-blue-50 to-indigo-100 text-slate-900'
          : 'bg-black text-slate-100'
      } flex flex-col font-sans selection:bg-fuchsia-400 selection:text-purple-950 transition-colors duration-300`}
    >
      
      {/* Toast Notification for ID3 Auto-Enrichment */}
      {enrichToast && (
        <div className="bg-emerald-900/90 text-emerald-100 px-4 py-3 shadow-xl border-b border-emerald-700 flex items-center justify-between gap-3 text-xs sm:text-sm font-semibold z-40 animate-fade-in backdrop-blur-md">
          <div className="flex items-center gap-2 max-w-4xl">
            <Sparkles className="w-4 h-4 text-yellow-400 shrink-0 animate-bounce" />
            <span>{enrichToast}</span>
          </div>
          <button
            onClick={() => setEnrichToast(null)}
            className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-colors shrink-0"
          >
            OK
          </button>
        </div>
      )}

      {/* Cumulative Storage Warning Banner */}
      {isOverStorageLimit && (
        <div className="bg-red-950/90 text-red-100 px-4 py-2.5 shadow-lg border-b border-red-800 flex items-center justify-between gap-3 text-xs sm:text-sm font-semibold z-30 backdrop-blur-md">
          <div className="flex items-center gap-2 max-w-4xl">
            <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
            <span>
              {language === 'nl'
                ? `Opslagwaarschuwing: Cumulatieve opslag is ${totalStorageMb.toFixed(1)} MB (Limiet van ${formatStorageLimit(storageLimitMb)} overschreden).`
                : `Storage Alert: Cumulative storage is ${totalStorageMb.toFixed(1)} MB (Exceeds ${formatStorageLimit(storageLimitMb)} limit).`}
            </span>
          </div>
          <button
            onClick={() => setShowStorageModal(true)}
            className="px-3 py-1 bg-yellow-400 hover:bg-yellow-300 text-slate-950 rounded-lg text-xs font-bold transition-colors shrink-0 flex items-center gap-1.5"
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>{language === 'nl' ? 'Opschonen' : 'Clean Up'}</span>
          </button>
        </div>
      )}

      {/* Header with Downloader / Music Library navigation */}
      <Header
        language={language}
        setLanguage={setLanguage}
        downloadCount={downloadHistory.length}
        totalStorageMb={totalStorageMb}
        storageLimitMb={storageLimitMb}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        libraryCount={libraryTracks.length}
        isOnline={isOnline}
        onOpenQRCode={() => setShowQRCodeModal(true)}
        onOpenStorageManagement={() => setShowStorageModal(true)}
        onOpenWindowsInstall={() => setShowWindowsInstallModal(true)}
        onOpenSettings={() => setShowSettingsModal(true)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />




      {/* Main Search Hero Area (only shown when Downloader tab is active) */}
      {isOnline && activeTab === 'downloader' && (
        <SearchSection
          language={language}
          onSearch={handleSearch}
          isLoading={isSearching}
          selectedPlatformFilter={selectedPlatformFilter}
          setSelectedPlatformFilter={setSelectedPlatformFilter}
        />
      )}

      {/* Main Workspace Body */}
      <main className={`flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-10 ${playingTrack ? 'pb-40 sm:pb-32' : 'pb-16'}`}>
        
        {/* DOWNLOADER TAB */}
        {activeTab === 'downloader' && (
          <>
            {!isOnline && (
              <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center mb-6 border border-zinc-800 shadow-xl">
                  <WifiOff className="w-12 h-12 text-zinc-500" />
                </div>
                <h2 className="text-3xl font-black text-white mb-3 tracking-tight">
                  {language === 'nl' ? 'Geen Internetverbinding' : 'No Internet Connection'}
                </h2>
                <p className="text-zinc-400 text-lg max-w-lg mb-8 font-medium">
                  {language === 'nl' ? 'Je bent momenteel offline. Alleen nummers uit je lokale bibliotheek zijn beschikbaar. Controleer je verbinding om nummers te zoeken en downloaden.' : 'You are currently offline. Only tracks from your local library are available. Please check your connection to search and download tracks.'}
                </p>
                <button
                  onClick={() => setActiveTab('library')}
                  className="px-8 py-3.5 bg-yellow-400 text-black rounded-2xl font-black shadow-[0_4px_14px_0_rgba(250,204,21,0.39)] hover:shadow-[0_6px_20px_rgba(250,204,21,0.23)] hover:bg-yellow-300 transition-all active:scale-95 flex items-center gap-2"
                >
                  <Library className="w-5 h-5" />
                  {language === 'nl' ? 'Ga naar Bibliotheek' : 'Go to Library'}
                </button>
              </div>
            )}
            {/* Single Mode Track Results */}
            {isOnline && (
              <>
                <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/90 p-5 rounded-3xl border border-zinc-800 shadow-xl">
                  <div>
                    <h2 className="text-xl font-extrabold text-white tracking-tight flex flex-wrap items-center gap-2.5">
                      <ListMusic className="w-5 h-5 text-yellow-400" />
                      <span>
                        {playlistInfo?.isPlaylist
                          ? playlistInfo.title || 'Ingetrokken Afspeellijst'
                          : 'Zoekresultaten & Converter'}
                      </span>
                      {playlistInfo?.isSyncVerified && (
                        <span className="px-2.5 py-0.5 rounded-full bg-yellow-400/15 text-yellow-300 border border-yellow-400/30 text-xs font-bold inline-flex items-center gap-1.5 shadow-sm shadow-yellow-400/10">
                          <ShieldCheck className="w-3.5 h-3.5 text-yellow-400" />
                          <span>Sync Verified</span>
                        </span>
                      )}
                      {filteredSearchTracks.length > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 text-xs font-semibold">
                          {filteredSearchTracks.length} {filteredSearchTracks.length === 1 ? 'Nummer' : 'Nummers'}
                        </span>
                      )}
                    </h2>
                    {playlistInfo?.isPlaylist ? (
                      <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-yellow-400" />
                        <span>Smart Sync actief: Exacte nummer-structuur en ID3-metadata van deze afspeellijst geverifieerd.</span>
                      </p>
                    ) : (
                      <p className="text-xs text-zinc-400 mt-1">
                        Alle nummers worden rechtstreeks gecodeerd met originele bitrate en HD albumhoes.
                      </p>
                    )}
                  </div>

                  {filteredSearchTracks.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* PRIMARY BATCH DOWNLOAD ALL BUTTON */}
                      <button
                        onClick={handleDownloadAllSearchResults}
                        disabled={batchDownloadStats.isDownloading}
                        className={`px-5 py-2.5 rounded-xl font-black text-xs md:text-sm flex items-center gap-2 shadow-lg transition-all active:scale-95 cursor-pointer ${
                          batchDownloadStats.allCompleted
                            ? 'bg-emerald-400 hover:bg-emerald-300 text-black shadow-emerald-400/20'
                            : batchDownloadStats.isDownloading
                            ? 'bg-amber-400 text-black shadow-amber-400/20 animate-pulse'
                            : 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-300 hover:from-amber-300 hover:to-yellow-300 text-black shadow-yellow-400/30'
                        }`}
                        title="Download alle nummers van deze afspeellijst gelijktijdig naar je lokale map en IndexedDB"
                      >
                        {batchDownloadStats.isDownloading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-black" />
                            <span>
                              Downloaden... {batchDownloadStats.completed}/{batchDownloadStats.total} voltooid
                            </span>
                          </>
                        ) : batchDownloadStats.allCompleted ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-black" />
                            <span>Alles Gedownload ({batchDownloadStats.total})</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4 text-black stroke-[2.5]" />
                            <span>Download Alles ({filteredSearchTracks.length})</span>
                          </>
                        )}
                      </button>

                      {filteredSearchTracks.length > 1 && (
                        <button
                          onClick={() => handlePlayQueue(filteredSearchTracks)}
                          className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs flex items-center gap-2 border border-zinc-700 transition-all active:scale-95"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Alles Afspelen</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          const isPl = playlistInfo?.isPlaylist;
                          const plName = playlistInfo?.title || (isPl ? 'Gedownloade Afspeellijst' : 'Zoekresultaten');
                          const existingPl = playlists.find((p) => p.name.toLowerCase() === plName.toLowerCase());
                          const plId = existingPl ? existingPl.id : `pl-${Date.now()}`;
                          const newPl: Playlist = existingPl
                            ? {
                                ...existingPl,
                                trackIds: Array.from(new Set([...existingPl.trackIds, ...filteredSearchTracks.map((t) => t.id)])),
                              }
                            : {
                                id: plId,
                                name: plName,
                                coverUrl: filteredSearchTracks[0]?.coverUrl || '',
                                trackIds: filteredSearchTracks.map((t) => t.id),
                                createdAt: new Date().toISOString(),
                                description: `Opgeslagen vanuit zoekopdracht (${filteredSearchTracks.length} nummers)`,
                                color: 'yellow',
                              };
                          handleSavePlaylist(newPl);
                          filteredSearchTracks.forEach((t) => saveToHistory({ ...t, playlistId: plId }));
                        }}
                        className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs flex items-center gap-2 transition-all border border-zinc-700 active:scale-95"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Opslaan in Bibliotheek</span>
                      </button>
                    </div>
                  )}
                </div>

                {isSearching ? (
                  <div className="p-10 text-center bg-zinc-900/90 rounded-3xl border border-zinc-800 space-y-4 animate-pulse shadow-xl shadow-purple-950/20">
                    <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                      <div className="absolute inset-0 rounded-full bg-purple-600/30 blur-md animate-ping" />
                      <img
                        src="/logo.png?v=2"
                        alt="Soulcraft Engine Laden..."
                        className="w-14 h-14 rounded-full object-cover border-2 border-amber-400 shadow-lg shadow-purple-500/40 animate-[spin_6s_linear_infinite]"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-base font-extrabold bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500 bg-clip-text text-transparent">
                        Soulcraft Studio Master Engine
                      </p>
                      <p className="text-sm font-semibold text-zinc-300">
                        {language === 'nl'
                          ? 'Afspeellijst & track informatie ophalen van Spotify, SoundCloud & YouTube Music...'
                          : 'Fetching playlist & track metadata from Spotify, SoundCloud & YouTube Music...'}
                      </p>
                    </div>
                  </div>
                ) : filteredSearchTracks.length === 0 ? (
                  <div className="p-10 text-center bg-zinc-900/80 rounded-3xl border border-zinc-800 text-zinc-400">
                    Geen resultaten gevonden voor dit filter. Plak een geldige Spotify, SoundCloud of YouTube link!
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredSearchTracks.map((track) => (
                      <TrackCard
                        key={track.id}
                        track={track}
                        language={language}
                        isPlaying={playingTrack?.id === track.id && isPlaying}
                        onTogglePlay={(t) => handlePlayTrack(t, filteredSearchTracks)}
                        onDownload={handleDownloadTrack}
                        onOpenTagEditor={(t) => setActiveTagTrack(t)}
                        onOpenLyrics={(t) => setActiveLyricsTrack(t)}
                        onOpenCrossLinks={(t) => setActiveCrossTrack(t)}
                        onOpenAddToPlaylist={(t) => setActiveAddToPlaylistTrack(t)}
                        onOpenAudioAnalysis={(t) => setActiveAnalysisTrack(t)}
                        downloadProgress={combinedDownloadState[track.id]?.progress || 0}
                        downloadStatus={combinedDownloadState[track.id]?.status || 'idle'}
                        downloadMetrics={combinedDownloadState[track.id]}
                      />
                    ))}
                  </div>
                )}
              </div>
              
              <BatchDownloadSection
                batchTracks={tracks}
                downloadState={combinedDownloadState}
                language={language}
                onDownloadTrack={(track) => handleDownloadTrack(track, track.format || 'mp3-320')}
              />
            </>
          )}

            {/* Feature Highlights Grid */}
            <FeatureHighlights language={language} />

            {/* Download History Section */}
            <DownloadHistory
              language={language}
              history={downloadHistory}
              onClearHistory={clearHistory}
              onReDownload={(t) => handleDownloadTrack(t, t.format || 'mp3-320')}
              playingTrackId={playingTrack?.id || null}
              onTogglePlay={(t) => handlePlayTrack(t, downloadHistory)}
              onOpenStorageManagement={() => setShowStorageModal(true)}
              totalStorageMb={totalStorageMb}
              storageLimitMb={storageLimitMb}
            />
          </>
        )}

        {/* MUSIC LIBRARY TAB */}
        {activeTab === 'library' && (
          <MusicLibrary
            language={language}
            library={libraryTracks}
            playlists={playlists}
            playingTrackId={playingTrack?.id || null}
            onPlayTrack={handlePlayTrack}
            onPlayQueue={handlePlayQueue}
            onToggleFavorite={handleToggleFavorite}
            onDeleteTrack={handleDeleteFromLibrary}
            onOpenTagEditor={(t) => setActiveTagTrack(t)}
            onOpenLyrics={(t) => setActiveLyricsTrack(t)}
            onOpenCrossLinks={(t) => setActiveCrossTrack(t)}
            onSeedDemoTracks={handleSeedDemoTracks}
            onReDownloadTrack={(t) => handleDownloadTrack(t, t.format || 'mp3-320')}
            onAutoEnrichLibrary={handleAutoEnrichLibrary}
            isAutoEnriching={isAutoEnriching}
            onOpenAddToPlaylist={(t) => setActiveAddToPlaylistTrack(t)}
            onOpenAudioAnalysis={(t) => setActiveAnalysisTrack(t)}
            onOpenCreatePlaylist={() => setActiveAddToPlaylistTrack(libraryTracks[0] || null)}
            onOpenSmartPlaylist={() => setShowSmartPlaylistModal(true)}
            onUpdatePlaylists={updatePlaylists}
            onDeletePlaylist={handleDeletePlaylist}
            onRemoveTrackFromPlaylist={handleRemoveTrackFromPlaylist}
            onUpdateLibraryTracks={updateLibrary}
            onNavigateToDownloader={() => setActiveTab('downloader')}
          />
        )}
      </main>

      {/* Floating Audio Preview Player */}
      {playingTrack && (
        <AudioPlayerBar
          track={playingTrack}
          language={language}
          isPlaying={isPlaying}
          onTogglePlay={() => setIsPlaying(!isPlaying)}
          onClose={() => { setPlayingTrack(null); setIsPlaying(false); }}
          onDownload={(t) => handleDownloadTrack(t, 'mp3-320')}
          onNextTrack={handleNextTrack}
          onPrevTrack={handlePrevTrack}
          hasNext={playbackQueue.length > 0 && queueIndex < playbackQueue.length - 1}
          hasPrev={playbackQueue.length > 0 && queueIndex > 0}
        />
      )}

      {/* Audio DSP Analysis & Harmonic Mixing Matrix Modal */}
      {activeAnalysisTrack && (
        <AudioAnalysisModal
          isOpen={!!activeAnalysisTrack}
          track={activeAnalysisTrack}
          language={language}
          library={libraryTracks}
          isPlaying={isPlaying && playingTrack?.id === activeAnalysisTrack.id}
          onPlayTrack={(t) => handlePlayTrack(t, libraryTracks)}
          onClose={() => setActiveAnalysisTrack(null)}
          onSaveTrackAnalysis={handleSaveAudioAnalysis}
        />
      )}

      {/* Add To Playlist Modal */}
      {activeAddToPlaylistTrack && (
        <AddToPlaylistModal
          track={activeAddToPlaylistTrack}
          playlists={playlists}
          language={language}
          onCreatePlaylist={handleCreateNewPlaylist}
          onToggleTrackInPlaylist={handleToggleTrackInPlaylist}
          onClose={() => setActiveAddToPlaylistTrack(null)}
        />
      )}

      {/* Smart Playlist Generator Modal */}
      {showSmartPlaylistModal && (
        <SmartPlaylistModal
          library={libraryTracks}
          language={language}
          onClose={() => setShowSmartPlaylistModal(false)}
          onSavePlaylist={(newPl) => {
            handleSavePlaylist(newPl);
            setShowSmartPlaylistModal(false);
          }}
        />
      )}

      {/* ID3 Tag Editor Modal */}
      {activeTagTrack && (
        <TagEditorModal
          track={activeTagTrack}
          language={language}
          onSave={handleSaveTags}
          onClose={() => setActiveTagTrack(null)}
        />
      )}

      {/* Lyrics View Modal */}
      {activeLyricsTrack && (
        <LyricsModal
          track={activeLyricsTrack}
          language={language}
          onClose={() => setActiveLyricsTrack(null)}
        />
      )}

      {/* Cross-Platform Links Modal */}
      {activeCrossTrack && (
        <CrossLinksModal
          track={activeCrossTrack}
          language={language}
          onClose={() => setActiveCrossTrack(null)}
        />
      )}

      {/* Mobile QR Code Modal */}
      {showQRCodeModal && (
        <QRCodeModal
          language={language}
          onClose={() => setShowQRCodeModal(false)}
        />
      )}

      {/* Storage & Cache Management Modal */}
      {showStorageModal && (
        <StorageCleanupModal
          language={language}
          totalStorageMb={totalStorageMb}
          storageLimitMb={storageLimitMb}
          onChangeStorageLimit={handleUpdateStorageLimit}
          historyCount={downloadHistory.length}
          historySizeMb={historySizeMb}
          libraryCount={libraryTracks.length}
          librarySizeMb={librarySizeMb}
          nonFavoritesCount={nonFavoritesTracks.length}
          nonFavoritesSizeMb={nonFavoritesSizeMb}
          onClearHistory={clearHistory}
          onClearNonFavorites={handleClearNonFavorites}
          onClearAllCache={handleClearAllCache}
          onResetAllData={handleResetAllData}
          onClose={() => setShowStorageModal(false)}
        />
      )}

      {/* Windows Desktop App Installation Modal */}
      {showWindowsInstallModal && (
        <WindowsInstallModal
          language={language}
          deferredPrompt={deferredPrompt}
          onTriggerPwaInstall={handleTriggerPwaInstall}
          onClose={() => setShowWindowsInstallModal(false)}
        />
      )}

      {/* Advanced Download & Audio Settings Configuration Panel */}
      <SettingsPanel
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        language={language}
      />

      {/* Startup Splash Screen */}
      {showSplashScreen && (
        <StartupSplashScreen
          onComplete={() => setShowSplashScreen(false)}
          theme={theme}
          language={language as 'nl' | 'en'}
        />
      )}

      {/* Footer */}
      <footer className={`border-t py-8 text-center text-xs space-y-3 ${
        theme === 'light-purple'
          ? 'border-purple-200 bg-white/90 text-purple-700'
          : theme === 'light-blue'
          ? 'border-sky-200 bg-white/90 text-slate-600'
          : 'border-zinc-800 bg-zinc-950 text-zinc-400'
      }`}>
        <p className={`font-bold ${
          theme === 'light-purple'
            ? 'bg-gradient-to-r from-fuchsia-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent font-black'
            : 'bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500 bg-clip-text text-transparent'
        }`}>
          Soulcraft Downloader & Studio Library • Spotify • SoundCloud • YouTube Music
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setShowWindowsInstallModal(true)}
            className={`px-4 py-1.5 rounded-full border text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
              theme === 'light-purple'
                ? 'bg-purple-100 hover:bg-purple-200 border-purple-300 text-purple-900 shadow-sm'
                : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-yellow-400'
            }`}
          >
            🖥️ {language === 'nl' ? 'Installeer als Vaste App op Mac & Windows' : 'Install as Standalone App on Mac & Windows'}
          </button>
        </div>
        <p className={theme === 'light-purple' ? 'text-purple-600/80' : 'text-zinc-500'}>
          Uitsluitend bestemd voor persoonlijk offline archiefgebruik en het beheren van uw eigen muziekcollectie.
        </p>
      </footer>
    </div>
  );
}

