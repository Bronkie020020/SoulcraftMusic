import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MusicTrack } from '../types';
import { renderTrackToAudioBlob, triggerFileDownload, DownloadProgressInfo } from '../utils/audioEncoder';
import { saveTrackToDb, StoredTrack } from '../db/libraryDb';
import { ArrowDown, CheckCircle2, AlertCircle, Loader2, X, DownloadCloud, Sparkles, Zap, FolderCheck } from 'lucide-react';
import { useSettings } from './SettingsContext';

export interface QueuedDownload {
  track: MusicTrack;
  playlistId: string;
  format: string;
  enqueuedAt: number;
}

export interface ActiveDownloadProgress {
  trackId: string;
  track: MusicTrack;
  playlistId: string;
  format: string;
  progress: number; // 0 to 100
  status: 'fetching' | 'converting' | 'encoding' | 'ready' | 'error';
  speedFormatted: string;
  etaFormatted: string;
  loadedMb: number;
  totalMb: number;
  error?: string;
  abortController: AbortController;
}

export interface DownloadContextType {
  queue: QueuedDownload[];
  activeDownloads: Record<string, ActiveDownloadProgress>;
  completedDownloads: Set<string>;
  failedDownloads: Set<string>;
  isDownloading: boolean;
  activeCount: number;
  queueCount: number;
  concurrencyLimit: number;
  enqueueDownload: (track: MusicTrack, playlistId?: string, format?: string) => void;
  enqueueBatchDownloads: (tracks: MusicTrack[], playlistId?: string, format?: string) => void;
  cancelDownload: (trackId: string) => void;
  retryFailedDownloads: () => void;
  clearCompleted: () => void;
  getTrackStatus: (trackId: string) => {
    isQueued: boolean;
    isActive: boolean;
    isCompleted: boolean;
    isFailed: boolean;
    progress?: number;
    metrics?: ActiveDownloadProgress;
  };
}

const DownloadContext = createContext<DownloadContextType | null>(null);

interface DownloadProviderProps {
  children: ReactNode;
  onTrackSavedToLibrary?: (track: MusicTrack) => void;
}

export const DownloadProvider: React.FC<DownloadProviderProps> = ({ children, onTrackSavedToLibrary }) => {
  const { settings, getEffectiveFormatString, writeBlobToLocalFolder } = useSettings();
  const [queue, setQueue] = useState<QueuedDownload[]>([]);
  const [activeDownloads, setActiveDownloads] = useState<Record<string, ActiveDownloadProgress>>({});
  const [completedDownloads, setCompletedDownloads] = useState<Set<string>>(new Set());
  const [failedDownloads, setFailedDownloads] = useState<Set<string>>(new Set());
  const [showGlobalFloater, setShowGlobalFloater] = useState<boolean>(true);

  // Keep ref to avoid stale closures in parallel download coordinator
  const activeDownloadsRef = useRef<Record<string, ActiveDownloadProgress>>({});
  activeDownloadsRef.current = activeDownloads;

  const queueRef = useRef<QueuedDownload[]>([]);
  queueRef.current = queue;

  // Track cache for automatic and manual retry of failed items
  const trackCacheRef = useRef<Map<string, { track: MusicTrack; playlistId: string; format: string }>>(new Map());

  // Enqueue a single track (uses user's configured format by default)
  const enqueueDownload = useCallback((track: MusicTrack, playlistId: string = 'library', format?: string) => {
    // Avoid double queueing
    if (activeDownloadsRef.current[track.id]) return;
    if (queueRef.current.some((q) => q.track.id === track.id)) return;

    setCompletedDownloads((prev) => {
      const next = new Set(prev);
      next.delete(track.id);
      return next;
    });

    setFailedDownloads((prev) => {
      const next = new Set(prev);
      next.delete(track.id);
      return next;
    });

    const targetFormat = format && format !== 'mp3-320' ? format : getEffectiveFormatString();
    trackCacheRef.current.set(track.id, { track, playlistId, format: targetFormat });

    const item: QueuedDownload = {
      track,
      playlistId,
      format: targetFormat,
      enqueuedAt: Date.now(),
    };

    setQueue((prev) => [...prev, item]);
  }, [getEffectiveFormatString]);

  // Batch "Download All" Enqueue (uses user's configured format)
  const enqueueBatchDownloads = useCallback((tracks: MusicTrack[], playlistId: string = 'library', format?: string) => {
    const existingActiveIds = new Set(Object.keys(activeDownloadsRef.current));
    const existingQueueIds = new Set(queueRef.current.map((q) => q.track.id));
    const targetFormat = format && format !== 'mp3-320' ? format : getEffectiveFormatString();

    const newItems: QueuedDownload[] = [];
    tracks.forEach((track) => {
      trackCacheRef.current.set(track.id, { track, playlistId, format: targetFormat });
      setFailedDownloads((prev) => {
        if (!prev.has(track.id)) return prev;
        const next = new Set(prev);
        next.delete(track.id);
        return next;
      });

      if (!existingActiveIds.has(track.id) && !existingQueueIds.has(track.id)) {
        newItems.push({
          track,
          playlistId,
          format: targetFormat,
          enqueuedAt: Date.now(),
        });
      }
    });

    if (newItems.length > 0) {
      setQueue((prev) => [...prev, ...newItems]);
    }
  }, [getEffectiveFormatString]);

  // Retry any failed downloads
  const retryFailedDownloads = useCallback(() => {
    const toRetry: QueuedDownload[] = [];
    failedDownloads.forEach((trackId) => {
      const cached = trackCacheRef.current.get(trackId);
      if (cached) {
        toRetry.push({
          track: cached.track,
          playlistId: cached.playlistId,
          format: cached.format,
          enqueuedAt: Date.now(),
        });
      }
    });

    setFailedDownloads(new Set());
    if (toRetry.length > 0) {
      setQueue((prev) => [...prev, ...toRetry]);
    }
  }, [failedDownloads]);

  // Cancel an active or queued download
  const cancelDownload = useCallback((trackId: string) => {
    // Cancel active abort controller if running
    if (activeDownloadsRef.current[trackId]) {
      activeDownloadsRef.current[trackId].abortController.abort();
      setActiveDownloads((prev) => {
        const next = { ...prev };
        delete next[trackId];
        return next;
      });
    }
    // Remove from queue
    setQueue((prev) => prev.filter((item) => item.track.id !== trackId));
  }, []);

  // Clear completed history
  const clearCompleted = useCallback(() => {
    setCompletedDownloads(new Set());
  }, []);

  // Track status lookup helper
  const getTrackStatus = useCallback((trackId: string) => {
    const isActive = !!activeDownloads[trackId];
    const isQueued = queue.some((q) => q.track.id === trackId);
    const isCompleted = completedDownloads.has(trackId);
    const isFailed = failedDownloads.has(trackId);
    const metrics = activeDownloads[trackId];
    const progress = metrics?.progress ?? (isCompleted ? 100 : 0);

    return {
      isQueued,
      isActive,
      isCompleted,
      isFailed,
      progress,
      metrics,
    };
  }, [activeDownloads, queue, completedDownloads, failedDownloads]);

  // Execute a single download worker with automatic retry
  const processDownloadTask = useCallback(async (item: QueuedDownload) => {
    const { track, playlistId, format } = item;
    const trackId = track.id;
    const abortController = new AbortController();

    // Mark as active
    setActiveDownloads((prev) => ({
      ...prev,
      [trackId]: {
        trackId,
        track,
        playlistId,
        format,
        progress: 5,
        status: 'fetching',
        speedFormatted: 'Verbinden...',
        etaFormatted: 'Berekenen...',
        loadedMb: 0,
        totalMb: 0,
        abortController,
      },
    }));

    try {
      // 1. Stream & Render audio from server with live progress and internal retry
      let result = null;
      let lastErr = null;

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          result = await renderTrackToAudioBlob(
            track,
            format,
            (progressInfo: DownloadProgressInfo) => {
              setActiveDownloads((prev) => {
                if (!prev[trackId]) return prev;
                return {
                  ...prev,
                  [trackId]: {
                    ...prev[trackId],
                    progress: progressInfo.progress,
                    status: progressInfo.progress >= 100 ? 'encoding' : 'converting',
                    speedFormatted: progressInfo.speedFormatted,
                    etaFormatted: progressInfo.etaFormatted,
                    loadedMb: progressInfo.loadedMb,
                    totalMb: progressInfo.totalMb,
                  },
                };
              });
            },
            2,
            abortController.signal
          );
          if (result) break;
        } catch (e: any) {
          lastErr = e;
          if (e?.name === 'AbortError' || abortController.signal.aborted) throw e;
          await new Promise((r) => setTimeout(r, 600));
        }
      }

      if (!result) {
        throw lastErr || new Error(`Download mislukt voor ${track.title}`);
      }

      // 2. Persist binary audio Blob & metadata directly to IndexedDB
      const storedTrack: StoredTrack = {
        id: track.id,
        playlistId: playlistId || 'library',
        title: track.title,
        artist: track.artist,
        audioBlob: result.blob,
        duration: result.validation?.actualDurationSec || track.duration || 180,
        savedAt: Date.now(),
        album: track.album,
        format: result.ext || 'mp3',
        coverUrl: track.coverUrl,
        originalUrl: track.originalUrl || track.streamUrl,
        bpm: track.bpm,
        key: track.key,
        fileSizeMb: Number((result.blob.size / (1024 * 1024)).toFixed(2)),
      };

      await saveTrackToDb(storedTrack);

      // 3. Save file: try writing directly into user-selected directory first (File System Access API)
      const sanitize = (s: string) => s.replace(/[/\\?%*:|"<>]/g, '_');
      const filename = `${sanitize(track.artist || 'Unknown')} - ${sanitize(track.title || 'Track')}.${result.ext || 'mp3'}`;
      
      const savedToFolder = await writeBlobToLocalFolder(filename, result.blob);
      if (!savedToFolder) {
        // Fallback to native browser download manager
        triggerFileDownload(result.blob, filename);
      }

      // 4. Update status sets
      setCompletedDownloads((prev) => new Set(prev).add(trackId));

      if (onTrackSavedToLibrary) {
        onTrackSavedToLibrary({
          ...track,
          isDownloaded: true,
          format: result.ext,
          fileSizeMb: storedTrack.fileSizeMb,
        });
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        console.warn(`[DownloadProvider] Track ${track.title} cancelled by user.`);
      } else {
        console.error(`[DownloadProvider] Download failed for ${track.title}:`, err);
        setFailedDownloads((prev) => new Set(prev).add(trackId));
      }
    } finally {
      // Remove from active downloads
      setActiveDownloads((prev) => {
        const next = { ...prev };
        delete next[trackId];
        return next;
      });
    }
  }, [onTrackSavedToLibrary, writeBlobToLocalFolder]);

  // Concurrency Engine: dynamically limits to user's settings.concurrency (1 to 5) with gentle stagger
  useEffect(() => {
    const currentActiveCount = Object.keys(activeDownloads).length;
    const maxConcurrency = settings.concurrency || 3;
    const availableSlots = maxConcurrency - currentActiveCount;

    if (availableSlots > 0 && queue.length > 0) {
      // Dequeue next available items
      const nextBatch = queue.slice(0, availableSlots);
      const remainingQueue = queue.slice(availableSlots);

      setQueue(remainingQueue);

      // Launch with gentle staggering to prevent burst spikes
      nextBatch.forEach((item, idx) => {
        if (idx === 0) {
          processDownloadTask(item);
        } else {
          setTimeout(() => {
            processDownloadTask(item);
          }, idx * 250);
        }
      });
    }
  }, [queue, activeDownloads, settings.concurrency, processDownloadTask]);

  const activeCount = Object.keys(activeDownloads).length;
  const queueCount = queue.length;
  const isDownloading = activeCount > 0 || queueCount > 0;
  const hasFailed = failedDownloads.size > 0;

  return (
    <DownloadContext.Provider
      value={{
        queue,
        activeDownloads,
        completedDownloads,
        failedDownloads,
        isDownloading,
        activeCount,
        queueCount,
        concurrencyLimit: settings.concurrency,
        enqueueDownload,
        enqueueBatchDownloads,
        cancelDownload,
        retryFailedDownloads,
        clearCompleted,
        getTrackStatus,
      }}
    >
      {children}

      {/* Global Background Floating Download Manager with Framer Motion (Motion v12) */}
      <AnimatePresence>
        {(isDownloading || hasFailed) && showGlobalFloater && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className="fixed bottom-24 right-4 sm:right-8 z-50 max-w-sm sm:max-w-md w-full bg-zinc-950/95 border border-zinc-800 backdrop-blur-2xl rounded-3xl p-4 shadow-2xl shadow-yellow-500/10 text-white font-sans overflow-hidden"
          >
            {/* Top Bar */}
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black shadow-md ${
                  isDownloading ? 'bg-yellow-400 text-black animate-pulse shadow-yellow-400/20' : 'bg-red-500 text-white shadow-red-500/20'
                }`}>
                  <DownloadCloud className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-extrabold flex items-center gap-1.5 text-yellow-400">
                    <span>Achtergrond Download Manager</span>
                    <span className="px-1.5 py-0.5 rounded-full bg-yellow-400/20 text-yellow-400 text-[10px] font-mono">
                      {activeCount}/{settings.concurrency} parallel
                    </span>
                  </h4>
                  <p className="text-[11px] text-zinc-400 font-medium">
                    {queueCount > 0 ? `${queueCount} in wachtrij • ` : ''}
                    {completedDownloads.size > 0 ? `${completedDownloads.size} voltooid • ` : ''}
                    {settings.customDirectoryName ? `Map: ${settings.customDirectoryName}` : 'IndexedDB & Downloads'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowGlobalFloater(false)}
                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                title="Minimaliseren"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Active Parallel Download Items */}
            {activeCount > 0 && (
              <div className="py-2.5 space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {Object.values(activeDownloads).map((active) => (
                  <div key={active.trackId} className="bg-zinc-900/80 rounded-2xl p-2.5 border border-zinc-800/80 space-y-1.5">
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="font-bold text-zinc-200 truncate flex-1">
                        {active.track.title}
                      </span>
                      <span className="text-[10px] font-mono text-yellow-400 font-extrabold shrink-0">
                        {active.progress}%
                      </span>
                    </div>

                    {/* Motion-animated Progress Bar */}
                    <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-300 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${active.progress}%` }}
                        transition={{ ease: 'easeOut', duration: 0.2 }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                      <span className="flex items-center gap-1">
                        <Zap className="w-3 h-3 text-yellow-400" />
                        {active.speedFormatted}
                      </span>
                      <span>ETA: {active.etaFormatted}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Queue Counter Footer */}
            {queueCount > 0 && (
              <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400 font-medium">
                <span>Volgende in rij: {queue[0]?.track.title}</span>
                <span className="text-yellow-400 font-bold">+{queueCount} tracks</span>
              </div>
            )}

            {/* Failed Downloads Alert & Retry Action */}
            {hasFailed && (
              <div className="pt-2 mt-2 border-t border-zinc-800/80 flex items-center justify-between text-xs">
                <span className="text-red-400 font-semibold flex items-center gap-1 text-[11px]">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{failedDownloads.size} nummers niet voltooid</span>
                </span>
                <button
                  onClick={retryFailedDownloads}
                  className="px-2.5 py-1 rounded-lg bg-yellow-400/20 hover:bg-yellow-400 text-yellow-300 hover:text-black font-bold text-[10px] transition-colors"
                >
                  Opnieuw Proberen
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </DownloadContext.Provider>
  );
};

export function useDownload(): DownloadContextType {
  const context = useContext(DownloadContext);
  if (!context) {
    throw new Error('useDownload must be used within a DownloadProvider');
  }
  return context;
}
