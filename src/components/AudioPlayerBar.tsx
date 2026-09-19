import React, { useEffect, useState, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, Download, X, Disc, SkipBack, SkipForward, AlertCircle, Zap } from 'lucide-react';
import { AppLanguage, MusicTrack } from '../types';
import { translations } from '../utils/translations';
import { CAMELOT_KEY_MAP, normalizeToCamelotKey } from '../utils/audioAnalyzer';

interface AudioPlayerBarProps {
  track: MusicTrack;
  language: AppLanguage['code'];
  isPlaying: boolean;
  onTogglePlay: () => void;
  onClose: () => void;
  onDownload: (track: MusicTrack) => void;
  onPrevTrack?: () => void;
  onNextTrack?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  track,
  language,
  isPlaying,
  onTogglePlay,
  onClose,
  onDownload,
  onPrevTrack,
  onNextTrack,
  hasNext,
  hasPrev,
}) => {
  const t = translations[language];
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(track.duration || 180);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Construct working stream URL
  const audioSourceUrl = track.streamUrl || `/api/stream?url=${encodeURIComponent(track.originalUrl)}&title=${encodeURIComponent(track.artist + ' - ' + track.title)}`;

  // Format time (seconds -> MM:SS)
  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Synchronize audio playback with track changes
  useEffect(() => {
    if (!audioRef.current) return;

    setHasError(false);
    setIsLoading(true);
    setCurrentTime(0);
    setDuration(track.duration || 180);

    const audio = audioRef.current;
    audio.src = audioSourceUrl;
    audio.load();

    if (isPlaying) {
      audio.play().catch((err) => {
        console.warn('Auto-play blocked or stream error:', err);
        setIsLoading(false);
      });
    }
  }, [track.id, audioSourceUrl]);

  // Synchronize play/pause state
  useEffect(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;

    if (isPlaying) {
      audio.play().catch((err) => {
        console.warn('Playback error:', err);
      });
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  // Synchronize volume & mute
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = isMuted ? 0 : volume;
    audioRef.current.muted = isMuted;
  }, [volume, isMuted]);

  // Setup Web Audio API visualizer
  useEffect(() => {
    if (!audioRef.current || !canvasRef.current) return;

    const setupVisualizer = () => {
      try {
        if (!audioCtxRef.current) {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            audioCtxRef.current = new AudioContextClass();
          }
        }

        const ctx = audioCtxRef.current;
        if (!ctx) return;

        if (ctx.state === 'suspended' && isPlaying) {
          ctx.resume();
        }

        if (!analyserRef.current) {
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 128;
          analyserRef.current = analyser;
        }

        if (!sourceNodeRef.current && audioRef.current) {
          try {
            const source = ctx.createMediaElementSource(audioRef.current);
            source.connect(analyserRef.current);
            analyserRef.current.connect(ctx.destination);
            sourceNodeRef.current = source;
          } catch (e) {
            // MediaElementSource already connected or cross-origin restricted
          }
        }
      } catch (e) {
        console.warn('Visualizer setup warning:', e);
      }
    };

    setupVisualizer();

    const draw = () => {
      if (!canvasRef.current || !analyserRef.current) return;
      const canvas = canvasRef.current;
      const canvasCtx = canvas.getContext('2d');
      if (!canvasCtx) return;

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserRef.current.getByteFrequencyData(dataArray);

      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 1.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        canvasCtx.fillStyle = '#fde047'; // yellow-300
        canvasCtx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
        x += barWidth;
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    if (isPlaying) {
      draw();
    } else if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlaying]);

  // Handle Seek Bar click
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = percentage * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950/95 backdrop-blur-2xl border-t border-slate-800 text-white shadow-2xl px-3 sm:px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] animate-slide-up">
      {/* Hidden HTML5 Audio Element */}
      <audio
        ref={audioRef}
        crossOrigin="anonymous"
        playsInline
        onTimeUpdate={() => {
          if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
          }
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) {
            const d = audioRef.current.duration;
            if (d && !isNaN(d) && isFinite(d)) {
              setDuration(d);
            } else if (track.duration) {
              setDuration(track.duration);
            }
            setIsLoading(false);
          }
        }}
        onCanPlay={() => setIsLoading(false)}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => setIsLoading(false)}
        onEnded={() => {
          if (hasNext && onNextTrack) {
            onNextTrack();
          } else {
            onTogglePlay();
          }
        }}
        onError={(e) => {
          console.warn('Audio stream playback failed:', e);
          setIsLoading(false);
          setHasError(true);
        }}
      />

      <div className="max-w-7xl mx-auto flex flex-col gap-2">
        {/* Top bar on Mobile / Full flex on Desktop */}
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          {/* Left: Track Info & Artwork */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1 sm:flex-initial sm:w-1/4">
            <div className="relative group shrink-0">
              <img
                src={track.coverUrl}
                alt={track.title}
                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl object-cover border border-slate-800 shadow-md ${isPlaying ? 'ring-2 ring-yellow-400' : ''}`}
              />
              {isPlaying && (
                <div className="absolute inset-0 bg-slate-950/40 rounded-xl flex items-center justify-center">
                  <Disc className="w-4 h-4 text-yellow-300 animate-spin" />
                </div>
              )}
            </div>
            <div className="min-w-0 pr-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <h4 className="text-xs sm:text-sm font-bold text-white truncate">{track.title}</h4>
                {track.bpm ? (
                  <span className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-yellow-400/20 text-yellow-300 text-[9px] font-mono font-bold shrink-0">
                    <Zap className="w-2.5 h-2.5" />
                    {track.bpm}
                  </span>
                ) : null}
                {track.key ? (
                  <span className={`hidden md:inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-mono font-bold border shrink-0 ${CAMELOT_KEY_MAP[normalizeToCamelotKey(track.key)]?.bgClass || 'bg-purple-500/20'} ${CAMELOT_KEY_MAP[normalizeToCamelotKey(track.key)]?.textClass || 'text-purple-300'} ${CAMELOT_KEY_MAP[normalizeToCamelotKey(track.key)]?.borderClass || 'border-purple-500/30'}`}>
                    {normalizeToCamelotKey(track.key)}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-1.5">
                <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">{track.artist}</p>
                {track.bpm || track.key ? (
                  <span className="md:hidden text-[9px] font-mono text-yellow-300/90 shrink-0">
                    • {track.bpm ? `${track.bpm} BPM` : ''} {track.key ? `(${normalizeToCamelotKey(track.key)})` : ''}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {/* Previous */}
            <button
              onClick={onPrevTrack}
              disabled={!hasPrev}
              className="p-2 rounded-full hover:bg-slate-800 text-slate-300 hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-transparent min-h-[36px] min-w-[36px] flex items-center justify-center"
              title={t.prevTrack}
            >
              <SkipBack className="w-4 h-4 fill-current" />
            </button>

            {/* Play/Pause */}
            <button
              onClick={onTogglePlay}
              className="w-10 h-10 rounded-full bg-yellow-400 text-slate-950 flex items-center justify-center hover:scale-105 active:scale-95 shadow-md shadow-yellow-400/20 transition-all font-bold shrink-0"
            >
              {isLoading ? (
                <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
              ) : isPlaying ? (
                <Pause className="w-5 h-5 fill-slate-950" />
              ) : (
                <Play className="w-5 h-5 fill-slate-950 ml-0.5" />
              )}
            </button>

            {/* Next */}
            <button
              onClick={onNextTrack}
              disabled={!hasNext}
              className="p-2 rounded-full hover:bg-slate-800 text-slate-300 hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-transparent min-h-[36px] min-w-[36px] flex items-center justify-center"
              title={t.nextTrack}
            >
              <SkipForward className="w-4 h-4 fill-current" />
            </button>

            {/* Desktop Real Frequency Visualizer Canvas */}
            <canvas ref={canvasRef} width={70} height={20} className="hidden lg:block ml-2 w-16 h-5" />
          </div>

          {/* Right: Volume & Actions */}
          <div className="flex items-center justify-end gap-1.5 sm:gap-3 shrink-0 sm:w-1/4">
            {/* Mute & Volume Slider (Desktop) */}
            <div className="hidden sm:flex items-center gap-2">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 transition-colors"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-slate-300" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setVolume(val);
                  if (val > 0 && isMuted) setIsMuted(false);
                  if (val === 0 && !isMuted) setIsMuted(true);
                }}
                className="w-16 md:w-20 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-yellow-400"
              />
            </div>

            {/* Download button */}
            <button
              onClick={() => onDownload(track)}
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-yellow-400/10 hover:bg-yellow-400/20 border border-yellow-400/30 text-yellow-300 text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0"
              title={t.downloadMp3}
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{t.downloadMp3}</span>
            </button>

            {/* Close Player */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress Seek Bar across the full width */}
        <div className="w-full flex items-center gap-2 text-[10px] sm:text-[11px] text-slate-400 font-mono">
          <span className="shrink-0 w-9 text-left">{formatTime(currentTime)}</span>
          <div
            onClick={handleSeek}
            className="flex-1 h-3 sm:h-2 bg-slate-800/80 rounded-full overflow-hidden cursor-pointer relative group flex items-center p-0.5"
          >
            <div
              className="h-full bg-gradient-to-r from-yellow-400 to-cyan-400 rounded-full transition-all duration-100"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
          <span className="shrink-0 w-9 text-right">{formatTime(duration)}</span>
        </div>

        {hasError && (
          <p className="text-[10px] text-amber-400 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 shrink-0" />
            <span>{language === 'nl' ? 'Stream preview beperkt, audio wordt gesynthetiseerd.' : 'Stream preview limited, fallback audio enabled.'}</span>
          </p>
        )}
      </div>
    </div>
  );
};
