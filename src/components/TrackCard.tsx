import React, { useState } from 'react';
import {
  Download,
  Play,
  Pause,
  Edit3,
  Mic2,
  Share2,
  Check,
  Disc,
  FileAudio,
  Sparkles,
  Zap,
  RotateCcw,
  Clock,
  Gauge,
  FolderPlus,
  ChevronDown,
} from 'lucide-react';
import { AppLanguage, MusicTrack, DownloadMetrics } from '../types';
import { QualityBadge } from './QualityBadge';
import { translations } from '../utils/translations';
import { CAMELOT_KEY_MAP, normalizeToCamelotKey, analyzeTrackBpmAndKey } from '../utils/audioAnalyzer';

interface TrackCardProps {
  track: MusicTrack;
  language: AppLanguage['code'];
  isPlaying: boolean;
  onTogglePlay: (track: MusicTrack) => void;
  onDownload: (track: MusicTrack, format: string) => void;
  onOpenTagEditor: (track: MusicTrack) => void;
  onOpenLyrics: (track: MusicTrack) => void;
  onOpenCrossLinks: (track: MusicTrack) => void;
  onOpenAddToPlaylist?: (track: MusicTrack) => void;
  onOpenAudioAnalysis?: (track: MusicTrack) => void;
  onUpdateTrack?: (updatedTrack: MusicTrack) => void;
  downloadProgress?: number;
  downloadStatus?: 'idle' | 'fetching' | 'converting' | 'encoding' | 'ready' | 'error';
  downloadMetrics?: DownloadMetrics;
}

export const TrackCard: React.FC<TrackCardProps> = ({
  track,
  language,
  isPlaying,
  onTogglePlay,
  onDownload,
  onOpenTagEditor,
  onOpenLyrics,
  onOpenCrossLinks,
  onOpenAddToPlaylist,
  onOpenAudioAnalysis,
  onUpdateTrack,
  downloadProgress = 0,
  downloadStatus = 'idle',
  downloadMetrics,
}) => {
  const t = translations[language];
  const [selectedFormat, setSelectedFormat] = useState<'mp3-320' | 'mp3-256' | 'mp3-128' | 'wav' | 'flac'>('mp3-320');
  const [bpm, setBpm] = useState<number | undefined>(track.bpm);
  const [key, setKey] = useState<string | undefined>(track.key);
  const [isScanningKey, setIsScanningKey] = useState(false);

  // Instant on-demand DSP analysis for BPM & Camelot Key
  const handleScanBpmAndKey = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isScanningKey) return;
    setIsScanningKey(true);
    try {
      const res = await analyzeTrackBpmAndKey(track);
      setBpm(res.bpm);
      setKey(res.camelotKey);
      if (onUpdateTrack) {
        onUpdateTrack({
          ...track,
          bpm: res.bpm,
          key: res.camelotKey,
        });
      }
    } catch (err) {
      console.warn('Track analysis error:', err);
    } finally {
      setIsScanningKey(false);
    }
  };

  const camelotKey = key ? normalizeToCamelotKey(key) : null;
  const keyMeta = camelotKey ? (CAMELOT_KEY_MAP[camelotKey] || CAMELOT_KEY_MAP['8A']) : null;

  const getPlatformBadge = () => {
    switch (track.platform) {
      case 'spotify':
        return {
          label: 'Spotify',
          bgColor: 'bg-yellow-400/10 text-yellow-300 border-yellow-400/20',
          dotColor: 'bg-yellow-300',
        };
      case 'soundcloud':
        return {
          label: 'SoundCloud',
          bgColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          dotColor: 'bg-amber-400',
        };
      case 'youtube':
        return {
          label: 'YouTube Music',
          bgColor: 'bg-red-500/10 text-red-400 border-red-500/20',
          dotColor: 'bg-red-400',
        };
      default:
        return {
          label: 'Soulcraft Studio',
          bgColor: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
          dotColor: 'bg-amber-400',
        };
    }
  };

  const platformBadge = getPlatformBadge();

  return (
    <div className="bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-3xl p-3.5 sm:p-5 shadow-xl transition-all duration-300 group hover:shadow-2xl hover:shadow-yellow-400/5 relative overflow-hidden">
      
      {/* Background ambient glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-yellow-400/5 blur-3xl rounded-full pointer-events-none"></div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 sm:gap-5">
        
        {/* Top row on Mobile / Left block on Desktop: Album Artwork & Main Details */}
        <div className="flex items-start gap-3.5 flex-1 min-w-0">
          {/* Album Artwork & Play button overlay */}
          <div className="relative shrink-0 w-20 h-20 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border border-slate-700/80 group/img shadow-md">
            <img
              src={track.coverUrl}
              alt={track.title}
              className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-slate-950/40 group-hover/img:bg-slate-950/60 transition-colors flex items-center justify-center">
              <button
                onClick={() => onTogglePlay(track)}
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-yellow-400 hover:bg-yellow-300 text-slate-950 flex items-center justify-center shadow-lg transform group-hover/img:scale-110 active:scale-95 transition-all"
                title={t.previewAudio}
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 sm:w-6 sm:h-6 fill-slate-950" />
                ) : (
                  <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-slate-950 ml-0.5" />
                )}
              </button>
            </div>

            {/* Platform badge on image */}
            <div className="absolute top-1.5 left-1.5">
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border backdrop-blur-md flex items-center gap-1 ${platformBadge.bgColor}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${platformBadge.dotColor}`}></span>
                <span className="hidden sm:inline">{platformBadge.label}</span>
                <span className="sm:hidden">{track.platform === 'spotify' ? 'SP' : track.platform === 'soundcloud' ? 'SC' : 'YT'}</span>
              </span>
            </div>
          </div>

          {/* Track Details */}
          <div className="flex-1 min-w-0 space-y-1 sm:space-y-1.5">
            <div className="flex items-start justify-between gap-1.5">
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base md:text-lg font-bold text-white group-hover:text-yellow-300 transition-colors truncate">
                  {track.title}
                </h3>
                <p className="text-xs sm:text-sm font-medium text-slate-300 truncate">{track.artist}</p>
              </div>

              {/* Quality badge */}
              <div className="shrink-0 scale-90 sm:scale-100 origin-top-right">
                <QualityBadge url={track.originalUrl} />
              </div>
            </div>

            {/* Metadata pill list */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] sm:text-xs text-slate-400">
              <span className="flex items-center gap-1 truncate max-w-[130px] sm:max-w-none">
                <Disc className="w-3 h-3 text-slate-500 shrink-0" />
                <span className="truncate">{track.album}</span>
              </span>
              <span>•</span>
              <span className="shrink-0">{track.durationFormatted}</span>
              {track.releaseYear && (
                <>
                  <span>•</span>
                  <span className="shrink-0">{track.releaseYear}</span>
                </>
              )}
            </div>

            {/* DJ Audio Profile: Detected BPM & Camelot Key */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {bpm ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onOpenAudioAnalysis) {
                      onOpenAudioAnalysis(track);
                    }
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-yellow-400/15 hover:bg-yellow-400/25 text-yellow-300 border border-yellow-400/30 text-[10px] sm:text-xs font-mono font-bold transition-all active:scale-95"
                  title="Klik om BPM tempo & matrix te inspecteren"
                >
                  <Zap className="w-3 h-3 text-yellow-400 shrink-0" />
                  <span>{bpm} BPM</span>
                </button>
              ) : null}

              {camelotKey && keyMeta ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onOpenAudioAnalysis) {
                      onOpenAudioAnalysis(track);
                    }
                  }}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] sm:text-xs font-mono font-bold border transition-all active:scale-95 ${keyMeta.bgClass} ${keyMeta.textClass} ${keyMeta.borderClass} hover:brightness-125`}
                  title={`Camelot: ${camelotKey} • Standaard: ${keyMeta.standard} (${keyMeta.mode}) - Klik om te inspecteren`}
                >
                  <Disc className="w-3 h-3 shrink-0" />
                  <span>{camelotKey}</span>
                  <span className="text-[10px] opacity-75 hidden xs:inline">({keyMeta.standard})</span>
                </button>
              ) : null}

              {(!bpm || !camelotKey) && (
                <button
                  type="button"
                  onClick={handleScanBpmAndKey}
                  disabled={isScanningKey}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-yellow-400 hover:text-black text-yellow-300 border border-slate-700 text-[10px] sm:text-xs font-bold transition-all disabled:opacity-50"
                  title="Detecteer automatisch BPM tempo en Camelot toonsoort"
                >
                  <Zap className={`w-3 h-3 ${isScanningKey ? 'animate-bounce' : ''}`} />
                  <span>{isScanningKey ? 'Analyseren...' : '⚡ Scan BPM & Key'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Quality Format Selector & Actions Bar on Desktop / Mobile row */}
        <div className="flex flex-col gap-2.5 sm:border-l sm:border-slate-800/80 sm:pl-4">
          <div className="flex flex-wrap items-center justify-between sm:justify-start gap-2 pt-2 sm:pt-0 border-t border-slate-800/80 sm:border-t-0">
            {/* Format Picker */}
            <div className="relative flex items-center h-9 bg-slate-800/80 hover:bg-slate-700/80 px-2.5 rounded-xl border border-slate-700/80 transition-all text-xs shadow-sm group cursor-pointer">
              <FileAudio className="w-3.5 h-3.5 text-slate-400 group-hover:text-yellow-400 shrink-0 pointer-events-none mr-1.5 transition-colors" />
              <select
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value as any)}
                className="appearance-none bg-transparent text-slate-200 font-bold outline-none text-[11px] sm:text-xs cursor-pointer pr-5 py-1 z-10"
              >
                <option value="mp3-320" className="bg-slate-900 text-white">MP3 - 320k</option>
                <option value="mp3-256" className="bg-slate-900 text-white">AAC - 256k</option>
                <option value="mp3-128" className="bg-slate-900 text-white">MP3 - 128k</option>
                <option value="wav" className="bg-slate-900 text-white">WAV - Pure</option>
                <option value="flac" className="bg-slate-900 text-white">FLAC - HD</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-200 absolute right-2 pointer-events-none transition-colors" />
            </div>

            {/* Sub Action Icons (ID3 edit, Lyrics, Converter, Playlist) */}
            <div className="flex items-center gap-1">
              {onOpenAddToPlaylist && (
                <button
                  onClick={() => onOpenAddToPlaylist(track)}
                  className="h-9 w-9 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-yellow-400 hover:text-yellow-300 border border-slate-700/80 transition-colors flex items-center justify-center active:scale-95 shadow-sm"
                  title="Toevoegen aan Afspeellijst"
                >
                  <FolderPlus className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => onOpenTagEditor(track)}
                className="h-9 w-9 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition-colors flex items-center justify-center active:scale-95 shadow-sm"
                title={t.editTags}
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => onOpenLyrics(track)}
                className="h-9 w-9 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition-colors flex items-center justify-center active:scale-95 shadow-sm"
                title={t.viewLyrics}
              >
                <Mic2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => onOpenCrossLinks(track)}
                className="h-9 w-9 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition-colors flex items-center justify-center active:scale-95 shadow-sm"
                title={t.convertLink}
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Download Action Area */}
          <div className="w-full sm:w-auto shrink-0 flex flex-col justify-center">
            <button
              onClick={() => onDownload(track, selectedFormat)}
              disabled={downloadStatus === 'converting' || downloadStatus === 'fetching' || downloadStatus === 'encoding'}
              title={downloadStatus === 'error' ? (language === 'nl' ? 'Download mislukt. Klik om opnieuw te proberen' : 'Download failed. Click to retry') : undefined}
              className={`w-full sm:w-auto px-5 sm:px-6 py-2.5 sm:py-3 rounded-2xl font-black text-xs sm:text-sm hover:brightness-105 active:scale-95 disabled:opacity-50 transition-all shadow-md flex items-center justify-center gap-2 min-h-[42px] cursor-pointer ${
                downloadStatus === 'error'
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-500/25 ring-2 ring-rose-400/20'
                  : 'bg-gradient-to-r from-yellow-400 via-yellow-300 to-cyan-400 text-slate-950 shadow-yellow-400/20'
              }`}
            >
              {downloadStatus === 'ready' ? (
                <>
                  <Check className="w-4 h-4 text-slate-950" />
                  <span>{t.downloadComplete}</span>
                </>
              ) : downloadStatus === 'converting' || downloadStatus === 'fetching' || downloadStatus === 'encoding' ? (
                <>
                  <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                  <span>{downloadProgress}%</span>
                </>
              ) : downloadStatus === 'error' ? (
                <>
                  <RotateCcw className="w-4 h-4 text-white" />
                  <span>{language === 'nl' ? 'Probeer Opnieuw' : 'Retry'}</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 text-slate-950" />
                  <span>{t.downloadMp3}</span>
                </>
              )}
            </button>

            {/* Live Progress Bar with Real-time Speed & ETA */}
            {(downloadStatus === 'converting' || downloadStatus === 'fetching' || downloadStatus === 'encoding') && (
              <div className="w-full mt-2 bg-slate-950/90 p-2.5 rounded-xl border border-slate-800/80 space-y-1.5 min-w-[200px]">
                {/* Progress Bar */}
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden p-0.5 relative">
                  <div
                    className="h-full bg-gradient-to-r from-yellow-400 via-amber-300 to-cyan-400 rounded-full transition-all duration-300 shadow-sm shadow-yellow-400/50"
                    style={{ width: `${downloadProgress}%` }}
                  ></div>
                </div>

                {/* Speed & ETA stats */}
                <div className="flex items-center justify-between text-[11px] text-slate-300 font-mono">
                  <div className="flex items-center gap-1 text-yellow-300 font-bold" title="Snelheid / Speed">
                    <Gauge className="w-3 h-3 text-yellow-400 shrink-0" />
                    <span>{downloadMetrics?.speedFormatted || '0 KB/s'}</span>
                  </div>

                  <div className="flex items-center gap-1 text-cyan-300 font-medium" title="Resterende tijd / Time remaining">
                    <Clock className="w-3 h-3 text-cyan-400 shrink-0" />
                    <span>{downloadMetrics?.etaFormatted ? `Nog ${downloadMetrics.etaFormatted}` : 'Berekenen...'}</span>
                  </div>
                </div>

                {/* Status and Bytes transferred */}
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="truncate">
                    {downloadStatus === 'fetching'
                      ? (language === 'nl' ? 'Verbinden...' : 'Connecting...')
                      : downloadStatus === 'encoding'
                      ? (language === 'nl' ? 'Coderen...' : 'Encoding...')
                      : (language === 'nl' ? 'Downloaden...' : 'Downloading...')}
                  </span>
                  {downloadMetrics?.loadedMb !== undefined && downloadMetrics.totalMb ? (
                    <span className="font-mono text-slate-400 shrink-0">
                      {downloadMetrics.loadedMb} / {downloadMetrics.totalMb} MB
                    </span>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
