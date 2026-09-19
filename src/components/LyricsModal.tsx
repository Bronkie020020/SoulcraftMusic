import React, { useState } from 'react';
import { X, Copy, Check, Mic2 } from 'lucide-react';
import { AppLanguage, MusicTrack } from '../types';
import { translations } from '../utils/translations';

interface LyricsModalProps {
  track: MusicTrack;
  language: AppLanguage['code'];
  onClose: () => void;
}

export const LyricsModal: React.FC<LyricsModalProps> = ({ track, language, onClose }) => {
  const t = translations[language];
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (track.lyrics) {
      navigator.clipboard.writeText(track.lyrics);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
              <Mic2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{t.lyricsTitle}</h3>
              <p className="text-xs text-slate-400 truncate max-w-[200px]">
                {track.artist} - {track.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Lyrics body */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 max-h-80 overflow-y-auto space-y-3 font-sans text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
          {track.lyrics || 'Geen songtekst beschikbaar voor dit nummer.'}
        </div>

        {/* Action Footer */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={handleCopy}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-yellow-300" />
                <span className="text-yellow-300">{t.copied}</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Songtekst Kopiëren</span>
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};
