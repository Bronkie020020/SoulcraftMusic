import React, { useState, useEffect } from 'react';
import {
  Layers,
  Download,
  Check,
  CheckCircle2,
  AlertCircle,
  FileArchive,
  Sparkles,
  Gauge,
  Clock,
  HardDrive,
  Music,
  Plus,
  RefreshCw,
  XCircle,
  Activity,
  ListOrdered,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { AppLanguage, MusicTrack } from '../types';
import { translations } from '../utils/translations';
import { createTracksZip, triggerFileDownload, BatchProgressCallbackInfo } from '../utils/audioEncoder';
import { safeJsonStringify } from '../utils/jsonUtils';

interface BatchQueueItem {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  durationFormatted?: string;
  platform?: string;
  coverUrl?: string;
  streamUrl?: string;
  originalUrl?: string;
  format?: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  error?: string;
}

interface BatchDownloadSectionProps {
  language: AppLanguage['code'];
  batchTracks?: MusicTrack[];
  downloadState?: Record<string, any>;
  onDownloadTrack?: (track: MusicTrack) => void;
}

export const BatchDownloadSection: React.FC<BatchDownloadSectionProps> = ({
  language,
  batchTracks = [],
}) => {
  const t = translations[language];
  const [urlsInput, setUrlsInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [queueItems, setQueueItems] = useState<BatchQueueItem[]>([]);
  const [showQueueDetails, setShowQueueDetails] = useState(true);
  const [batchMetrics, setBatchMetrics] = useState<{
    speed: string;
    eta: string;
    currentTitle: string;
    currentTrackId: string;
    trackIndex: number;
    totalTracks: number;
    downloadedMb: number;
  }>({
    speed: '0 KB/s',
    eta: 'Berekenen...',
    currentTitle: '',
    currentTrackId: '',
    trackIndex: 0,
    totalTracks: 0,
    downloadedMb: 0,
  });
  const [isDone, setIsDone] = useState(false);

  // Compute status counts for the progress tracker
  const totalInQueue = queueItems.length;
  const pendingCount = queueItems.filter((i) => i.status === 'pending').length;
  const processingCount = queueItems.filter((i) => i.status === 'processing').length;
  const completedCount = queueItems.filter((i) => i.status === 'completed').length;
  const failedCount = queueItems.filter((i) => i.status === 'error').length;

  const handleAddSearchTracksToBatch = () => {
    if (!batchTracks || batchTracks.length === 0) return;
    const urls = batchTracks
      .map((t) => t.originalUrl || t.streamUrl || `${t.artist} - ${t.title}`)
      .join('\n');
    setUrlsInput((prev) => (prev ? `${prev}\n${urls}` : urls));
  };

  const handleClearQueue = () => {
    if (isProcessing) return;
    setQueueItems([]);
    setProgress(0);
    setStatusText('');
    setIsDone(false);
    setBatchMetrics({
      speed: '0 KB/s',
      eta: '0s',
      currentTitle: '',
      currentTrackId: '',
      trackIndex: 0,
      totalTracks: 0,
      downloadedMb: 0,
    });
  };

  const handleProcessBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawLines = urlsInput
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (rawLines.length === 0) return;

    setIsProcessing(true);
    setIsDone(false);
    setProgress(5);
    setStatusText(language === 'nl' ? 'Afspeellijst analyseren...' : 'Analyzing playlist...');

    try {
      // Call backend API to parse links
      const res = await fetch('/api/batch-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: safeJsonStringify({ urls: rawLines }),
      });

      const data = await res.json();
      const tracks: MusicTrack[] = data.tracks || [];

      if (tracks.length === 0) {
        throw new Error(language === 'nl' ? 'Geen geldige nummers gevonden' : 'No valid tracks found');
      }

      // Initialize the visual queue items as pending
      const initialQueue: BatchQueueItem[] = tracks.map((track) => ({
        id: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
        durationFormatted: track.durationFormatted,
        platform: track.platform,
        coverUrl: track.coverUrl,
        streamUrl: track.streamUrl,
        originalUrl: track.originalUrl,
        format: track.format || 'mp3-320',
        status: 'pending',
        progress: 0,
      }));

      setQueueItems(initialQueue);
      setProgress(10);
      setStatusText(
        language === 'nl'
          ? `${tracks.length} nummers in de wachtrij geplaatst. Downloaden & inpakken gestart...`
          : `${tracks.length} tracks queued. Downloading & zipping started...`
      );

      // Generate ZIP containing all rendered tracks with live batch progress callback
      const zipBlob = await createTracksZip(tracks, (batchInfo: BatchProgressCallbackInfo) => {
        setProgress(batchInfo.overallProgress);
        setStatusText(
          language === 'nl'
            ? `Nummer ${batchInfo.currentTrackIndex} van ${batchInfo.totalTracks}: ${batchInfo.currentTrackTitle}`
            : `Track ${batchInfo.currentTrackIndex} of ${batchInfo.totalTracks}: ${batchInfo.currentTrackTitle}`
        );

        setBatchMetrics({
          speed: batchInfo.speedFormatted,
          eta: batchInfo.etaFormatted,
          currentTitle: batchInfo.currentTrackTitle,
          currentTrackId: batchInfo.currentTrackId || '',
          trackIndex: batchInfo.currentTrackIndex,
          totalTracks: batchInfo.totalTracks,
          downloadedMb: Number((batchInfo.totalBytesDownloaded / (1024 * 1024)).toFixed(1)),
        });

        // Update each item in the queue
        setQueueItems((prevItems) =>
          prevItems.map((item, idx) => {
            const statusFromInfo = batchInfo.trackStatuses ? batchInfo.trackStatuses[item.id] : undefined;
            if (statusFromInfo) {
              const isCurrentTrack = batchInfo.currentTrackId === item.id;
              return {
                ...item,
                status: statusFromInfo,
                progress:
                  statusFromInfo === 'completed'
                    ? 100
                    : isCurrentTrack
                    ? batchInfo.currentTrackProgress || 0
                    : statusFromInfo === 'pending'
                    ? 0
                    : item.progress,
              };
            }

            // Fallback index-based progress if no ID mapped
            if (idx < batchInfo.currentTrackIndex - 1) {
              return { ...item, status: 'completed', progress: 100 };
            }
            if (idx === batchInfo.currentTrackIndex - 1) {
              return {
                ...item,
                status: 'processing',
                progress: batchInfo.currentTrackProgress || 50,
              };
            }
            return { ...item, status: 'pending', progress: 0 };
          })
        );
      });

      setProgress(100);
      setStatusText(
        language === 'nl' ? 'ZIP Bestand gereed! Download gestart...' : 'ZIP File ready! Download started...'
      );

      // Mark all items as completed
      setQueueItems((prev) =>
        prev.map((i) => (i.status === 'error' ? i : { ...i, status: 'completed', progress: 100 }))
      );

      // Trigger actual ZIP download
      triggerFileDownload(zipBlob, `Soulcraft_Batch_${Date.now()}.zip`);
      setIsDone(true);
    } catch (err: any) {
      console.error('Batch process error:', err);
      setStatusText(
        language === 'nl'
          ? 'Er is een fout opgetreden bij de batch conversie.'
          : 'An error occurred during batch processing.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center text-yellow-300">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">{t.batchMode}</h2>
            <p className="text-xs text-slate-400">
              {language === 'nl'
                ? 'Converteer meerdere Spotify, SoundCloud of YouTube links tegelijk naar een ZIP archief met realtime batch wachtrij tracking.'
                : 'Convert multiple Spotify, SoundCloud, or YouTube links into a ZIP archive with real-time queue progress tracking.'}
            </p>
          </div>
        </div>

        {batchTracks.length > 0 && !isProcessing && (
          <button
            type="button"
            onClick={handleAddSearchTracksToBatch}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-yellow-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all self-start sm:self-auto cursor-pointer"
            title={language === 'nl' ? 'Gevonden zoekresultaten toevoegen' : 'Add search results to batch'}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>
              {language === 'nl'
                ? `Voeg ${batchTracks.length} zoekresultaten toe`
                : `Add ${batchTracks.length} search tracks`}
            </span>
          </button>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleProcessBatch} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span>{language === 'nl' ? 'Links of Afspeellijsten (één link per regel)' : 'Links or Playlists (one per line)'}</span>
            {urlsInput.trim() && (
              <span className="text-[11px] text-yellow-300/80 font-mono">
                {urlsInput.split('\n').filter((l) => l.trim().length > 0).length}{' '}
                {language === 'nl' ? 'links ingevoerd' : 'links entered'}
              </span>
            )}
          </label>
          <textarea
            rows={4}
            value={urlsInput}
            onChange={(e) => setUrlsInput(e.target.value)}
            placeholder={t.batchPlaceholder}
            disabled={isProcessing}
            className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 focus:border-yellow-400 text-white placeholder-slate-600 text-xs sm:text-sm font-mono outline-none shadow-inner transition-colors disabled:opacity-60"
          />
        </div>

        {/* ========================================================= */}
        {/* VISUAL QUEUE PROGRESS TRACKER SUMMARY & LIVE STATUS       */}
        {/* ========================================================= */}
        {(isProcessing || queueItems.length > 0 || isDone) && (
          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4 shadow-inner">
            {/* Tracker Header & Counters */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-900 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-yellow-400 animate-pulse" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  {t.queueProgressTitle}
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                  {totalInQueue} {language === 'nl' ? 'in wachtrij' : 'in queue'}
                </span>
              </div>

              {/* Status Badges: Pending / Processing / Completed / Failed */}
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                {/* Pending */}
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border transition-all ${
                    pendingCount > 0
                      ? 'bg-slate-900 border-slate-700 text-slate-300'
                      : 'bg-slate-900/40 border-slate-800/40 text-slate-500'
                  }`}
                  title={`${pendingCount} ${t.queuePending}`}
                >
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{t.queuePending}:</span>
                  <span className="font-mono text-slate-200">{pendingCount}</span>
                </div>

                {/* Processing */}
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border transition-all ${
                    processingCount > 0
                      ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 animate-pulse shadow-sm shadow-cyan-500/20'
                      : 'bg-slate-900/40 border-slate-800/40 text-slate-500'
                  }`}
                  title={`${processingCount} ${t.queueProcessing}`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${processingCount > 0 ? 'animate-spin' : ''}`} />
                  <span>{t.queueProcessing}:</span>
                  <span className="font-mono text-cyan-200">{processingCount}</span>
                </div>

                {/* Completed */}
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border transition-all ${
                    completedCount > 0
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-900/40 border-slate-800/40 text-slate-500'
                  }`}
                  title={`${completedCount} ${t.queueCompleted}`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t.queueCompleted}:</span>
                  <span className="font-mono text-emerald-200">{completedCount}</span>
                </div>

                {/* Failed (if any) */}
                {failedCount > 0 && (
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300"
                    title={`${failedCount} ${t.queueFailed}`}
                  >
                    <XCircle className="w-3.5 h-3.5 text-rose-400" />
                    <span>{t.queueFailed}:</span>
                    <span className="font-mono text-rose-200">{failedCount}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Overall Queue Progress Bar & Status Text */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-slate-300 font-semibold">
                <span className="truncate text-yellow-300 flex items-center gap-1.5">
                  {isProcessing && <span className="w-2 h-2 rounded-full bg-yellow-400 animate-ping"></span>}
                  {statusText || (isDone ? 'Alle tracks voltooid!' : 'Wachtrij gereed')}
                </span>
                <span className="text-yellow-300 font-mono text-sm self-end sm:self-auto">{progress}%</span>
              </div>

              {/* Progress Bar Container with segmented styling */}
              <div className="h-3 bg-slate-900 rounded-full overflow-hidden p-0.5 relative border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-yellow-400 via-amber-400 to-cyan-400 rounded-full transition-all duration-300 shadow-sm shadow-yellow-400/50"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>

            {/* Realtime Speed, ETA & Downloaded Size Metrics */}
            <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
              <div className="flex items-center gap-1.5 text-yellow-300 bg-yellow-400/10 px-3 py-2 rounded-xl border border-yellow-400/20">
                <Gauge className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                <span className="truncate">{batchMetrics.speed}</span>
              </div>

              <div className="flex items-center gap-1.5 text-cyan-300 bg-cyan-400/10 px-3 py-2 rounded-xl border border-cyan-400/20">
                <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="truncate">{batchMetrics.eta ? `Nog ${batchMetrics.eta}` : 'Berekenen...'}</span>
              </div>

              <div className="flex items-center gap-1.5 text-emerald-300 bg-emerald-400/10 px-3 py-2 rounded-xl border border-emerald-400/20">
                <HardDrive className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">{batchMetrics.downloadedMb} MB</span>
              </div>
            </div>

            {/* Live Queue Items Tracklist */}
            {queueItems.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-900">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setShowQueueDetails((prev) => !prev)}
                    className="text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ListOrdered className="w-3.5 h-3.5 text-yellow-400" />
                    <span>
                      {language === 'nl' ? 'Wachtrij Details & Nummers' : 'Queue Details & Tracklist'} (
                      {queueItems.length})
                    </span>
                    {showQueueDetails ? (
                      <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </button>

                  {!isProcessing && (
                    <button
                      type="button"
                      onClick={handleClearQueue}
                      className="text-[11px] text-slate-400 hover:text-rose-300 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span>{t.clearBatchQueue}</span>
                    </button>
                  )}
                </div>

                {showQueueDetails && (
                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {queueItems.map((item, index) => (
                      <div
                        key={item.id || index}
                        className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border transition-all ${
                          item.status === 'processing'
                            ? 'bg-slate-900/90 border-cyan-500/50 shadow-md shadow-cyan-500/10'
                            : item.status === 'completed'
                            ? 'bg-slate-900/50 border-slate-800'
                            : item.status === 'error'
                            ? 'bg-rose-950/20 border-rose-900/50'
                            : 'bg-slate-950 border-slate-850 opacity-80'
                        }`}
                      >
                        {/* Left: Index & Artwork Thumbnail & Info */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-5 text-center font-mono text-[11px] text-slate-500 font-bold shrink-0">
                            {index + 1}
                          </span>

                          <div className="w-9 h-9 rounded-lg bg-slate-800 overflow-hidden shrink-0 border border-slate-700/60 relative">
                            {item.coverUrl ? (
                              <img
                                src={item.coverUrl}
                                alt={item.title}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-500">
                                <Music className="w-4 h-4" />
                              </div>
                            )}

                            {item.status === 'processing' && (
                              <div className="absolute inset-0 bg-cyan-950/60 flex items-center justify-center">
                                <span className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></span>
                              </div>
                            )}
                          </div>

                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-white truncate max-w-[180px] sm:max-w-xs md:max-w-md">
                              {item.title}
                            </h4>
                            <p className="text-[11px] text-slate-400 truncate max-w-[160px] sm:max-w-xs">
                              {item.artist} {item.durationFormatted ? `• ${item.durationFormatted}` : ''}
                            </p>
                          </div>
                        </div>

                        {/* Right: Status Pill & Progress */}
                        <div className="flex items-center gap-2 shrink-0">
                          {item.status === 'pending' && (
                            <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-semibold flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{t.queuePending}</span>
                            </span>
                          )}

                          {item.status === 'processing' && (
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold flex items-center gap-1 animate-pulse">
                                <RefreshCw className="w-3 h-3 animate-spin text-cyan-400" />
                                <span>{item.progress > 0 ? `${item.progress}%` : t.queueProcessing}</span>
                              </span>
                            </div>
                          )}

                          {item.status === 'completed' && (
                            <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold flex items-center gap-1">
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span>320k MP3</span>
                            </span>
                          )}

                          {item.status === 'error' && (
                            <span className="px-2 py-0.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-semibold flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 text-rose-400" />
                              <span>{t.queueFailed}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Done banner */}
        {isDone && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-yellow-400/15 to-emerald-500/15 border border-yellow-400/30 text-yellow-300 text-xs font-semibold flex items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>
                {language === 'nl'
                  ? `Alle ${completedCount} nummers zijn succesvol geconverteerd en gebundeld in het ZIP bestand!`
                  : `All ${completedCount} tracks were successfully converted and bundled into the ZIP file!`}
              </span>
            </div>
            <button
              type="button"
              onClick={handleClearQueue}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold transition-colors cursor-pointer shrink-0"
            >
              {language === 'nl' ? 'Nieuwe Batch' : 'New Batch'}
            </button>
          </div>
        )}

        {/* Submit / Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="text-xs text-slate-500">
            {language === 'nl'
              ? 'Ondersteunt Spotify albums/afspeellijsten, SoundCloud sets en YouTube links.'
              : 'Supports Spotify albums/playlists, SoundCloud sets, and YouTube links.'}
          </div>

          <button
            type="submit"
            disabled={isProcessing || !urlsInput.trim()}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-yellow-400 to-cyan-500 text-slate-950 font-bold text-sm hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all shadow-lg shadow-yellow-400/20 flex items-center gap-2 cursor-pointer"
          >
            {isProcessing ? (
              <>
                <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                <span>{language === 'nl' ? 'Wachtrij Verwerken...' : 'Processing Queue...'}</span>
              </>
            ) : (
              <>
                <FileArchive className="w-4 h-4" />
                <span>{t.downloadZip}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
