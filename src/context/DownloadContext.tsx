import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MusicTrack } from '../types';
import { renderTrackToAudioBlob, triggerFileDownload, DownloadProgressInfo } from '../utils/audioEncoder';
import { saveTrackToDb, StoredTrack } from '../db/libraryDb';
import { ArrowDown, CheckCircle2, AlertCircle, Loader2, X, DownloadCloud, Sparkles, Zap } from 'lucide-react';

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
  enqueueDownload: (track: MusicTrack, playlistId?: string, format?: string) => void;
  enqueueBatchDownloads: (tracks: MusicTrack[], playlistId?: string, format?: string) => void;
  cancelDownload: (trackId: string) => void;
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

const MAX_CONCURRENT_DOWNLOADS = 3;

interface DownloadProviderProps {
  children: ReactNode;
  onTrackSavedToLibrary?: (track: MusicTrack) => void;
}

export const DownloadProvider: React.FC<DownloadProviderProps> = ({ children, onTrackSavedToLibrary }) => {
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

  // Enqueue a single track
  const enqueueDownload = useCallback((track: MusicTrack, playlistId: string = 'library', format: string = 'mp3-320') => {
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

    const item: QueuedDownload = {
      track,
      playlistId,
      format,
      enqueuedAt: Date.now(),
    };

    setQueue((prev) => [...prev, item]);
  }, []);

  // Batch "Download All" Enqueue
  const enqueueBatchDownloads = useCallback((tracks: MusicTrack[], playlistId: string = 'library', format: string = 'mp3-320') => {
    const existingActiveIds = new Set(Object.keys(activeDownloadsRef.current));
    const existingQueueIds = new Set(queueRef.current.map((q) => q.track.id));

    const newItems: QueuedDownload[] = [];
    tracks.forEach((track) => {
      if (!existingActiveIds.has(track.id) && !existingQueueIds.has(track.id)) {
        newItems.push({
          track,
          playlistId,
          format,
          enqueuedAt: Date.now(),
        });
      }
    });

    if (newItems.length > 0) {
      setQueue((prev) => [...prev, ...newItems]);
    }
  }, []);

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

  // Execute a single download worker
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
      // 1. Stream & Render audio from server with live progress
      const result = await renderTrackToAudioBlob(
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

      // 3. Trigger native file download in browser
      const sanitize = (s: string) => s.replace(/[/\\?%*:|"<>]/g, '_');
      const filename = `${sanitize(track.artist || 'Unknown')} - ${sanitize(track.title || 'Track')}.${result.ext || 'mp3'}`;
      triggerFileDownload(result.blob, filename);

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
  }, [onTrackSavedToLibrary]);

  // Concurrency Engine: picks up to MAX_CONCURRENT_DOWNLOADS items from queue
  useEffect(() => {
    const currentActiveCount = Object.keys(activeDownloads).length;
    const availableSlots = MAX_CONCURRENT_DOWNLOADS - currentActiveCount;

    if (availableSlots > 0 && queue.length > 0) {
      // Dequeue next available items
      const nextBatch = queue.slice(0, availableSlots);
      const remainingQueue = queue.slice(availableSlots);

      setQueue(remainingQueue);

      // Launch in parallel without blocking UI
      nextBatch.forEach((item) => {
        processDownloadTask(item);
      });
    }
  }, [queue, activeDownloads, processDownloadTask]);

  const activeCount = Object.keys(activeDownloads).length;
  const queueCount = queue.length;
  const isDownloading = activeCount > 0 || queueCount > 0;

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
        enqueueDownload,
        enqueueBatchDownloads,
        cancelDownload,
        clearCompleted,
        getTrackStatus,
      }}
    >
      {children}

      {/* Global Background Floating Download Manager with Framer Motion (Motion v12) */}
      <AnimatePresence>
        {isDownloading && showGlobalFloater && (
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
                <div className="w-8 h-8 rounded-xl bg-yellow-400 text-black flex items-center justify-center font-black animate-pulse shadow-md shadow-yellow-400/20">
                  <DownloadCloud className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-extrabold flex items-center gap-1.5 text-yellow-400">
                    <span>Achtergrond Download Manager</span>
                    <span className="px-1.5 py-0.5 rounded-full bg-yellow-400/20 text-yellow-400 text-[10px] font-mono">
                      {activeCount}/3 parallel
                    </span>
                  </h4>
                  <p className="text-[11px] text-zinc-400 font-medium">
                    {queueCount > 0 ? `${queueCount} in wachtrij • ` : ''}Opgeslagen in IndexedDB
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

            {/* Queue Counter Footer */}
            {queueCount > 0 && (
              <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400 font-medium">
                <span>Volgende in rij: {queue[0]?.track.title}</span>
                <span className="text-yellow-400 font-bold">+{queueCount} tracks</span>
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
