import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Zap,
  Disc,
  Play,
  Pause,
  Sliders,
  Check,
  Sparkles,
  ArrowRight,
  Music2,
  Volume2,
  RefreshCw,
  Info,
  Layers,
  Flame,
  Radio,
} from 'lucide-react';
import { AppLanguage, MusicTrack, KeyAnalysisResult } from '../types';
import {
  CAMELOT_KEY_MAP,
  normalizeToCamelotKey,
  getCompatibleCamelotKeys,
  analyzeTrackBpmAndKey,
  areKeysHarmonicallyCompatible,
  KeyMetadata,
} from '../utils/audioAnalyzer';

interface AudioAnalysisModalProps {
  isOpen: boolean;
  track: MusicTrack | null;
  language: AppLanguage['code'];
  library: MusicTrack[];
  onClose: () => void;
  onSaveTrackAnalysis: (trackId: string, bpm: number, key: string) => void;
  onPlayTrack?: (track: MusicTrack) => void;
  isPlaying?: boolean;
}

export const AudioAnalysisModal: React.FC<AudioAnalysisModalProps> = ({
  isOpen,
  track,
  language,
  library,
  onClose,
  onSaveTrackAnalysis,
  onPlayTrack,
  isPlaying = false,
}) => {
  if (!isOpen || !track) return null;

  const currentCamelot = normalizeToCamelotKey(track.key);
  const [bpm, setBpm] = useState<number>(track.bpm || 126);
  const [selectedKey, setSelectedKey] = useState<string>(currentCamelot);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisConfidence, setAnalysisConfidence] = useState<number>(0.92);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  
  // Tap tempo state
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const [tapFeedback, setTapFeedback] = useState<string | null>(null);

  // Canvas waveform ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sync state with incoming track
  useEffect(() => {
    if (track) {
      setBpm(track.bpm || 126);
      setSelectedKey(normalizeToCamelotKey(track.key));
      setSavedSuccess(false);
    }
  }, [track]);

  // Animated Waveform & Beat Grid Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let phase = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // Dark background grid
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, width, height);

      // Draw horizontal center line
      ctx.strokeStyle = '#27272a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      // Beat grid vertical markers based on BPM
      const beatsPerSec = bpm / 60;
      const beatSpacing = (width / 16);
      const beatOffset = (phase * beatsPerSec * 8) % beatSpacing;

      for (let x = -beatSpacing + beatOffset; x < width + beatSpacing; x += beatSpacing) {
        ctx.strokeStyle = 'rgba(234, 179, 8, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw dual-layer audio frequency waveform
      const keyMeta = CAMELOT_KEY_MAP[selectedKey] || CAMELOT_KEY_MAP['8A'];
      const hue = keyMeta.hue || 240;

      // Glow layer
      ctx.shadowBlur = 12;
      ctx.shadowColor = `hsl(${hue}, 80%, 60%)`;

      // Waveform bars
      const numBars = 72;
      const barWidth = width / numBars;
      for (let i = 0; i < numBars; i++) {
        const x = i * barWidth;
        const normalizedPos = i / numBars;
        
        // Multi-frequency harmonic wave formula
        const wave1 = Math.sin(normalizedPos * 14 + phase * 2.5);
        const wave2 = Math.cos(normalizedPos * 28 - phase * 1.8) * 0.5;
        const wave3 = Math.sin(normalizedPos * 56 + phase * 4) * 0.25;
        const amplitude = Math.abs(wave1 + wave2 + wave3);
        const barHeight = Math.max(6, amplitude * (height * 0.38));

        // Gradient for waveform
        const grad = ctx.createLinearGradient(0, height / 2 - barHeight, 0, height / 2 + barHeight);
        grad.addColorStop(0, `hsla(${hue}, 90%, 65%, 0.85)`);
        grad.addColorStop(0.5, '#facc15'); // Yellow pulse center
        grad.addColorStop(1, `hsla(${hue}, 90%, 65%, 0.85)`);

        ctx.fillStyle = grad;
        ctx.fillRect(x + 1, height / 2 - barHeight, barWidth - 2, barHeight * 2);
      }

      ctx.shadowBlur = 0;
      phase += (bpm / 120) * 0.035;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [bpm, selectedKey]);

  // Handle Tap Tempo
  const handleTap = () => {
    const now = Date.now();
    const newTaps = [...tapTimes, now].filter((t) => now - t < 3000); // Only keep taps within 3s
    setTapTimes(newTaps);

    if (newTaps.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < newTaps.length; i++) {
        intervals.push(newTaps[i] - newTaps[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      let calculated = Math.round(60000 / avgInterval);
      if (calculated >= 60 && calculated <= 220) {
        setBpm(calculated);
        setTapFeedback(`${calculated} BPM (${newTaps.length} taps)`);
      }
    } else {
      setTapFeedback('Keep tapping in rhythm...');
    }
  };

  // Run deep live DSP scan
  const handleRunDeepScan = async () => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      const res = await analyzeTrackBpmAndKey(track);
      setBpm(res.bpm);
      setSelectedKey(res.camelotKey);
      setAnalysisConfidence(res.confidence);
    } catch (e) {
      console.warn('Analysis error:', e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Save changes
  const handleSave = () => {
    onSaveTrackAnalysis(track.id, bpm, selectedKey);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 900);
  };

  // Compatible keys data
  const compatibleKeys = getCompatibleCamelotKeys(selectedKey);
  const activeKeyMeta = CAMELOT_KEY_MAP[selectedKey] || CAMELOT_KEY_MAP['8A'];

  // Other compatible tracks in library
  const matchingLibraryTracks = library.filter((t) => {
    if (t.id === track.id) return false;
    const tKey = normalizeToCamelotKey(t.key);
    const comp = areKeysHarmonicallyCompatible(selectedKey, tKey);
    return comp.isCompatible;
  });

  // Tempo Category description
  const getTempoCategory = (val: number) => {
    if (val < 95) return { label: 'Down-tempo / Hip-Hop / R&B', color: 'text-cyan-400' };
    if (val < 118) return { label: 'Mid-tempo / Pop / Reggaeton', color: 'text-emerald-400' };
    if (val < 128) return { label: 'House / Deep House / Tech', color: 'text-yellow-400' };
    if (val < 140) return { label: 'Electro / Trance / Techno', color: 'text-purple-400' };
    if (val < 165) return { label: 'Hardstyle / Dubstep', color: 'text-pink-400' };
    return { label: 'Drum & Bass / Fast Bass', color: 'text-rose-400' };
  };

  const tempoCat = getTempoCategory(bpm);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl relative text-zinc-100 flex flex-col my-auto">
        
        {/* Top Header */}
        <div className="p-6 border-b border-zinc-800/80 flex items-start justify-between gap-4 sticky top-0 bg-zinc-950/95 backdrop-blur-xl z-20">
          <div className="flex items-center gap-4 min-w-0">
            <div className="relative w-16 h-16 rounded-2xl overflow-hidden border border-zinc-800 shrink-0 shadow-lg group">
              <img
                src={track.coverUrl}
                alt={track.title}
                className="w-full h-full object-cover"
              />
              {onPlayTrack && (
                <button
                  onClick={() => onPlayTrack(track)}
                  className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Luister track"
                >
                  {isPlaying ? (
                    <Pause className="w-6 h-6 text-yellow-400 fill-yellow-400" />
                  ) : (
                    <Play className="w-6 h-6 text-yellow-400 fill-yellow-400 ml-0.5" />
                  )}
                </button>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 text-[10px] font-mono font-bold uppercase tracking-wider">
                  Audio DSP Analyzer
                </span>
                <span className="text-zinc-500 text-xs">• {track.durationFormatted}</span>
                <span className="text-zinc-500 text-xs hidden sm:inline">• {track.genre || 'Music'}</span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white truncate">{track.title}</h2>
              <p className="text-xs sm:text-sm text-zinc-400 truncate">{track.artist}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors shrink-0"
            title="Sluiten"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">

          {/* SECTION 1: Live Waveform & Beat Grid Visualizer */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 space-y-3 relative overflow-hidden shadow-inner">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
                <Radio className="w-4 h-4 text-yellow-400 animate-pulse" />
                <span>Live Beat Grid & Onset Waveform Frequency</span>
              </div>
              <span className="text-[11px] font-mono text-zinc-500">
                Confidence: <strong className="text-emerald-400">{Math.round(analysisConfidence * 100)}%</strong>
              </span>
            </div>

            <div className="relative rounded-xl overflow-hidden border border-zinc-800/80 bg-zinc-950">
              <canvas
                ref={canvasRef}
                width={760}
                height={130}
                className="w-full h-32 block"
              />
              <div className="absolute top-2 right-3 px-2 py-1 rounded bg-black/70 backdrop-blur-md text-[10px] font-mono text-yellow-400 border border-yellow-400/20">
                {bpm} BPM Beat Grid
              </div>
            </div>
          </div>

          {/* SECTION 2: Interactive BPM & Tempo Controller */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* BPM Readout & Manual Tuning Card */}
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 flex items-center justify-center">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">BPM Tempo Matrix</h3>
                    <p className="text-[11px] text-zinc-400">Slagen per minuut</p>
                  </div>
                </div>

                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full bg-zinc-800 ${tempoCat.color}`}>
                  {tempoCat.label}
                </span>
              </div>

              {/* Big BPM Display */}
              <div className="flex items-baseline justify-center gap-2 py-2">
                <span className="text-5xl sm:text-6xl font-black font-mono text-yellow-400 tracking-tight drop-shadow-md">
                  {bpm}
                </span>
                <span className="text-sm font-mono text-zinc-500 font-bold uppercase">BPM</span>
              </div>

              {/* BPM Adjust Controls (Halve, Double, Nudge) */}
              <div className="space-y-2 pt-2 border-t border-zinc-800">
                <div className="flex items-center justify-between gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBpm((prev) => Math.max(40, prev - 1))}
                    className="flex-1 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-zinc-300 text-xs font-mono font-bold border border-zinc-800 transition-all active:scale-95"
                  >
                    -1
                  </button>
                  <button
                    type="button"
                    onClick={() => setBpm((prev) => Math.min(260, prev + 1))}
                    className="flex-1 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-zinc-300 text-xs font-mono font-bold border border-zinc-800 transition-all active:scale-95"
                  >
                    +1
                  </button>
                  <button
                    type="button"
                    onClick={() => setBpm((prev) => Math.round(prev / 2))}
                    className="flex-1 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-amber-300 text-xs font-mono font-bold border border-zinc-800 transition-all active:scale-95"
                    title="Halveer tempo (bijv. 140 -> 70)"
                  >
                    ÷2
                  </button>
                  <button
                    type="button"
                    onClick={() => setBpm((prev) => Math.round(prev * 2))}
                    className="flex-1 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-amber-300 text-xs font-mono font-bold border border-zinc-800 transition-all active:scale-95"
                    title="Verdubbel tempo (bijv. 70 -> 140)"
                  >
                    ×2
                  </button>
                </div>

                {/* Tap Tempo Button */}
                <button
                  type="button"
                  onClick={handleTap}
                  className="w-full py-2.5 rounded-xl bg-yellow-400/10 hover:bg-yellow-400/20 text-yellow-300 border border-yellow-400/30 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm"
                >
                  <Flame className="w-4 h-4 text-yellow-400" />
                  <span>Tap Tempo Pad</span>
                </button>
                {tapFeedback && (
                  <p className="text-center text-[10px] font-mono text-zinc-400 animate-pulse">
                    {tapFeedback}
                  </p>
                )}
              </div>
            </div>

            {/* Camelot Key & Musical Notation Card */}
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                    <Disc className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Camelot Toonsoort</h3>
                    <p className="text-[11px] text-zinc-400">Harmonisch wiel profiel</p>
                  </div>
                </div>

                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${activeKeyMeta.bgClass} ${activeKeyMeta.textClass} ${activeKeyMeta.borderClass}`}>
                  {activeKeyMeta.mode.toUpperCase()}
                </span>
              </div>

              {/* Big Key Display */}
              <div className="flex items-center justify-center gap-3 py-2">
                <span className={`text-5xl sm:text-6xl font-black font-mono tracking-tight drop-shadow-md ${activeKeyMeta.textClass}`}>
                  {selectedKey}
                </span>
                <div className="text-left border-l border-zinc-800 pl-3">
                  <p className="text-base font-extrabold text-white">{activeKeyMeta.standard}</p>
                  <p className="text-xs text-zinc-400 font-medium capitalize">{activeKeyMeta.mode} Scale</p>
                </div>
              </div>

              {/* Quick Re-scan button */}
              <button
                type="button"
                onClick={handleRunDeepScan}
                disabled={isAnalyzing}
                className="w-full py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-purple-300 border border-zinc-800 text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-purple-400 ${isAnalyzing ? 'animate-spin' : ''}`} />
                <span>{isAnalyzing ? 'Audio Heranalyseren...' : 'Herbereken Toonsoort & DSP'}</span>
              </button>
            </div>
          </div>

          {/* SECTION 3: Interactive 24-Key Camelot Wheel Selector */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Disc className="w-4 h-4 text-purple-400" />
                  <span>Interactief Camelot Toonsoort Wiel (24 Keys)</span>
                </h3>
                <p className="text-xs text-zinc-400">
                  Selecteer handmatig een toonsoort om direct de harmonische combinaties te bekijken
                </p>
              </div>
            </div>

            {/* 1A - 12A (Minor Keys) */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono text-zinc-400 font-bold uppercase tracking-wider block">
                Minoor Toonsoorten (A-Wiel / Binnenring)
              </span>
              <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
                {Array.from({ length: 12 }, (_, i) => {
                  const keyStr = `${i + 1}A`;
                  const meta = CAMELOT_KEY_MAP[keyStr];
                  const isSelected = selectedKey === keyStr;

                  return (
                    <button
                      key={keyStr}
                      type="button"
                      onClick={() => setSelectedKey(keyStr)}
                      className={`p-2 rounded-xl text-center flex flex-col items-center justify-center transition-all border ${
                        isSelected
                          ? 'bg-purple-500 text-white border-purple-400 shadow-lg shadow-purple-500/30 scale-105 z-10'
                          : 'bg-zinc-950/80 hover:bg-zinc-800 text-zinc-300 border-zinc-800'
                      }`}
                      title={`${keyStr} - ${meta.standard}`}
                    >
                      <span className="text-xs font-mono font-black">{keyStr}</span>
                      <span className="text-[9px] truncate max-w-full opacity-75">{meta.standard.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 1B - 12B (Major Keys) */}
            <div className="space-y-1.5 pt-2 border-t border-zinc-800">
              <span className="text-[10px] font-mono text-zinc-400 font-bold uppercase tracking-wider block">
                Majoor Toonsoorten (B-Wiel / Buitenring)
              </span>
              <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
                {Array.from({ length: 12 }, (_, i) => {
                  const keyStr = `${i + 1}B`;
                  const meta = CAMELOT_KEY_MAP[keyStr];
                  const isSelected = selectedKey === keyStr;

                  return (
                    <button
                      key={keyStr}
                      type="button"
                      onClick={() => setSelectedKey(keyStr)}
                      className={`p-2 rounded-xl text-center flex flex-col items-center justify-center transition-all border ${
                        isSelected
                          ? 'bg-yellow-400 text-black border-yellow-300 shadow-lg shadow-yellow-400/30 scale-105 z-10'
                          : 'bg-zinc-950/80 hover:bg-zinc-800 text-zinc-300 border-zinc-800'
                      }`}
                      title={`${keyStr} - ${meta.standard}`}
                    >
                      <span className="text-xs font-mono font-black">{keyStr}</span>
                      <span className="text-[9px] truncate max-w-full opacity-75">{meta.standard.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* SECTION 4: Harmonic Mixing Matrix & Compatible Tracks */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-yellow-400" />
                <span>Harmonische DJ Mix Overgangen voor {selectedKey} ({activeKeyMeta.standard})</span>
              </h3>
              <p className="text-xs text-zinc-400">
                Gebruik deze toonsoorten in je DJ set voor vlekkeloze, harmonisch kloppende overgangen
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {compatibleKeys.map((c) => {
                const meta = CAMELOT_KEY_MAP[c.key] || CAMELOT_KEY_MAP['8A'];
                return (
                  <div
                    key={c.key}
                    className="bg-zinc-950 border border-zinc-800 rounded-2xl p-3.5 flex flex-col justify-between space-y-2 hover:border-zinc-700 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded-lg text-xs font-mono font-bold border ${meta.bgClass} ${meta.textClass} ${meta.borderClass}`}>
                        {c.key}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-medium">{meta.standard}</span>
                    </div>

                    <div>
                      <p className="text-xs font-bold text-white">{language === 'nl' ? c.labelNl : c.labelEn}</p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">
                        {c.relation === 'same' && '100% harmonische match'}
                        {c.relation === 'adjacent_up' && 'Verhoogt de energie'}
                        {c.relation === 'adjacent_down' && 'Rustige overgang'}
                        {c.relation === 'relative' && 'Vrolijk/Emotioneel'}
                        {c.relation === 'energy_boost' && 'Maximale climax'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Compatible tracks from Library */}
            <div className="pt-3 border-t border-zinc-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-zinc-300">
                  {language === 'nl'
                    ? `Harmonisch passende nummers in je bibliotheek (${matchingLibraryTracks.length})`
                    : `Harmonically compatible tracks in your library (${matchingLibraryTracks.length})`}
                </span>
              </div>

              {matchingLibraryTracks.length === 0 ? (
                <p className="text-xs text-zinc-500 italic py-2">
                  {language === 'nl'
                    ? 'Nog geen andere nummers in je bibliotheek die aansluiten op deze toonsoort.'
                    : 'No matching tracks in your library yet.'}
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                  {matchingLibraryTracks.slice(0, 6).map((mTrack) => {
                    const mCamelot = normalizeToCamelotKey(mTrack.key);
                    const mMeta = CAMELOT_KEY_MAP[mCamelot];

                    return (
                      <div
                        key={mTrack.id}
                        className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-2.5 flex items-center justify-between gap-2.5 hover:border-zinc-700 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <img
                            src={mTrack.coverUrl}
                            alt={mTrack.title}
                            className="w-8 h-8 rounded-lg object-cover border border-zinc-800 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{mTrack.title}</p>
                            <p className="text-[10px] text-zinc-400 truncate">{mTrack.artist}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {mTrack.bpm && (
                            <span className="text-[10px] font-mono text-yellow-400 font-bold">
                              {mTrack.bpm}
                            </span>
                          )}
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${mMeta?.bgClass || 'bg-purple-500/20'} ${mMeta?.textClass || 'text-purple-300'} ${mMeta?.borderClass || 'border-purple-500/40'}`}>
                            {mCamelot}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-zinc-800/80 flex items-center justify-between gap-4 sticky bottom-0 bg-zinc-950/95 backdrop-blur-xl z-20">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold text-xs transition-colors"
          >
            {language === 'nl' ? 'Annuleren' : 'Cancel'}
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-3 rounded-2xl bg-yellow-400 hover:bg-yellow-300 text-black font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-yellow-400/20 active:scale-95 transition-all"
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4 text-black" />
                <span>{language === 'nl' ? 'Opgeslagen!' : 'Saved!'}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-black" />
                <span>{language === 'nl' ? 'Toepassen op Nummer & ID3 Tags' : 'Apply to Track & ID3 Tags'}</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
