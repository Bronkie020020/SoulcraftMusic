import React, { useState } from 'react';
import { X, Save, Image, Sparkles, Music, Calendar, Disc, Hash, Zap } from 'lucide-react';
import { AppLanguage, MusicTrack } from '../types';
import { translations } from '../utils/translations';
import { analyzeTrackBpmAndKey, CAMELOT_KEY_MAP } from '../utils/audioAnalyzer';

interface TagEditorModalProps {
  track: MusicTrack;
  language: AppLanguage['code'];
  onSave: (updatedTrack: MusicTrack) => void;
  onClose: () => void;
}

export const TagEditorModal: React.FC<TagEditorModalProps> = ({
  track,
  language,
  onSave,
  onClose,
}) => {
  const t = translations[language];

  const [title, setTitle] = useState(track.title);
  const [artist, setArtist] = useState(track.artist);
  const [album, setAlbum] = useState(track.album);
  const [releaseYear, setReleaseYear] = useState(track.releaseYear || '2024');
  const [genre, setGenre] = useState(track.genre || 'Pop');
  const [bpm, setBpm] = useState<number | undefined>(track.bpm);
  const [key, setKey] = useState<string | undefined>(track.key || '8A');
  const [coverUrl, setCoverUrl] = useState(track.coverUrl);
  const [isGeneratingAiCover, setIsGeneratingAiCover] = useState(false);
  const [isAutoEnriching, setIsAutoEnriching] = useState(false);
  const [isAnalyzingAudio, setIsAnalyzingAudio] = useState(false);
  const [autoEnrichNotice, setAutoEnrichNotice] = useState<string | null>(null);

  const handleAutoDetectTags = async () => {
    setIsAutoEnriching(true);
    setAutoEnrichNotice(null);
    try {
      const res = await fetch('/api/enrich-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track: { title, artist } }),
      });
      const data = await res.json();
      if (data.success && data.track) {
        if (data.track.album) setAlbum(data.track.album);
        if (data.track.genre) setGenre(data.track.genre);
        if (data.track.releaseYear) setReleaseYear(data.track.releaseYear);
        if (data.track.coverUrl) setCoverUrl(data.track.coverUrl);
        if (data.track.bpm) setBpm(data.track.bpm);
        if (data.track.key) setKey(data.track.key);
        setAutoEnrichNotice(t.autoEnrichSingleSuccess);
        setTimeout(() => setAutoEnrichNotice(null), 4000);
      }
    } catch (err) {
      console.error('Auto-detect tags failed:', err);
    } finally {
      setIsAutoEnriching(false);
    }
  };

  const handleDetectBpmAndKey = async () => {
    setIsAnalyzingAudio(true);
    try {
      const result = await analyzeTrackBpmAndKey({
        ...track,
        title,
        artist,
        genre,
      });
      setBpm(result.bpm);
      setKey(result.camelotKey);
      setAutoEnrichNotice(`BPM (${result.bpm}) en Camelot Toonsoort (${result.camelotKey}) succesvol gedetecteerd!`);
      setTimeout(() => setAutoEnrichNotice(null), 4000);
    } catch (err) {
      console.error('BPM/Key analysis failed:', err);
    } finally {
      setIsAnalyzingAudio(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...track,
      title,
      artist,
      album,
      releaseYear,
      genre,
      bpm: bpm ? Number(bpm) : undefined,
      key,
      coverUrl,
    });
  };

  const handleGenerateAiCover = () => {
    setIsGeneratingAiCover(true);
    setTimeout(() => {
      // Pick dynamic fresh Unsplash music abstract cover art
      const dynamicCovers = [
        'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&auto=format&fit=crop&q=80',
      ];
      const selected = dynamicCovers[Math.floor(Math.random() * dynamicCovers.length)];
      setCoverUrl(selected);
      setIsGeneratingAiCover(false);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center text-yellow-300">
              <Disc className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{t.tagEditorTitle}</h3>
              <p className="text-xs text-slate-400">ID3 v2.4 Tag Metadata Spec</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="space-y-4">

          {/* Auto-populate banner button */}
          <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-950/80 border border-slate-800">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <Sparkles className="w-4 h-4 text-yellow-300 animate-pulse" />
              <span>{t.autoFetchTags}</span>
            </div>
            <button
              type="button"
              onClick={handleAutoDetectTags}
              disabled={isAutoEnriching}
              className="px-3 py-1.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-slate-950 font-bold text-xs transition-all flex items-center gap-1.5 shadow-md shadow-yellow-400/10 active:scale-95"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isAutoEnriching ? 'animate-spin' : ''}`} />
              <span>{isAutoEnriching ? t.autoEnriching : t.autoFetchTags}</span>
            </button>
          </div>

          {autoEnrichNotice && (
            <div className="p-2.5 rounded-xl bg-green-500/20 border border-green-500/40 text-green-300 text-xs font-semibold text-center animate-fade-in">
              {autoEnrichNotice}
            </div>
          )}

          {/* Cover Art Preview & AI Generator */}
          <div className="flex items-center gap-4 bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
            <img
              src={coverUrl}
              alt="Cover Art"
              className="w-20 h-20 rounded-xl object-cover border border-slate-700 shadow-md"
            />
            <div className="flex-1 space-y-2">
              <label className="text-xs font-medium text-slate-300 block">{t.coverLabel}</label>
              <input
                type="text"
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white outline-none focus:border-yellow-400"
              />
              <button
                type="button"
                onClick={handleGenerateAiCover}
                disabled={isGeneratingAiCover}
                className="px-3 py-1 rounded-lg bg-yellow-400/10 hover:bg-yellow-400/20 border border-yellow-400/30 text-yellow-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {isGeneratingAiCover ? 'Genereren...' : t.aiArtGenerator}
              </button>
            </div>
          </div>

          {/* Fields Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Title */}
            <div className="space-y-1">
              <label className="text-xs text-slate-400 flex items-center gap-1">
                <Music className="w-3.5 h-3.5 text-yellow-300" />
                {t.titleLabel}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:border-yellow-400 outline-none"
              />
            </div>

            {/* Artist */}
            <div className="space-y-1">
              <label className="text-xs text-slate-400 flex items-center gap-1">
                <Music className="w-3.5 h-3.5 text-cyan-400" />
                {t.artistLabel}
              </label>
              <input
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:border-yellow-400 outline-none"
              />
            </div>

            {/* Album */}
            <div className="space-y-1">
              <label className="text-xs text-slate-400 flex items-center gap-1">
                <Disc className="w-3.5 h-3.5 text-amber-400" />
                {t.albumLabel}
              </label>
              <input
                type="text"
                value={album}
                onChange={(e) => setAlbum(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:border-yellow-400 outline-none"
              />
            </div>

            {/* Year */}
            <div className="space-y-1">
              <label className="text-xs text-slate-400 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-purple-400" />
                {t.yearLabel}
              </label>
              <input
                type="text"
                value={releaseYear}
                onChange={(e) => setReleaseYear(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:border-yellow-400 outline-none"
              />
            </div>

            {/* Genre */}
            <div className="space-y-1">
              <label className="text-xs text-slate-400 flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 text-pink-400" />
                {t.genreLabel}
              </label>
              <input
                type="text"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:border-yellow-400 outline-none"
              />
            </div>

            {/* BPM & Key Container */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-400 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-yellow-400" />
                  BPM & Camelot Toonsoort
                </label>
                <button
                  type="button"
                  onClick={handleDetectBpmAndKey}
                  disabled={isAnalyzingAudio}
                  className="text-[10px] text-yellow-300 hover:underline flex items-center gap-0.5"
                >
                  <Zap className="w-2.5 h-2.5" />
                  {isAnalyzingAudio ? 'Scannen...' : 'Auto-detect'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="BPM (bijv. 128)"
                  value={bpm || ''}
                  onChange={(e) => setBpm(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:border-yellow-400 outline-none font-mono"
                />
                <select
                  value={key || '8A'}
                  onChange={(e) => setKey(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:border-yellow-400 outline-none font-mono cursor-pointer"
                >
                  {Object.entries(CAMELOT_KEY_MAP).map(([code, meta]) => (
                    <option key={code} value={code} className="bg-slate-900 text-white">
                      {code} - {meta.standard} ({meta.mode})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 text-slate-950 text-xs font-bold flex items-center gap-2 hover:brightness-110 shadow-lg shadow-yellow-400/20 transition-all"
            >
              <Save className="w-4 h-4" />
              {t.saveTags}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
