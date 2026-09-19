import React, { useState } from 'react';
import { X, ExternalLink, Copy, Check, Share2 } from 'lucide-react';
import { AppLanguage, MusicTrack } from '../types';
import { translations } from '../utils/translations';

interface CrossLinksModalProps {
  track: MusicTrack;
  language: AppLanguage['code'];
  onClose: () => void;
}

export const CrossLinksModal: React.FC<CrossLinksModalProps> = ({ track, language, onClose }) => {
  const t = translations[language];
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (url: string, key: string) => {
    navigator.clipboard.writeText(url);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const platforms = [
    {
      key: 'spotify',
      name: 'Spotify',
      color: 'bg-yellow-400/10 text-yellow-300 border-yellow-400/30 hover:bg-yellow-400/20',
      badgeColor: 'bg-yellow-400 text-slate-950',
      url: track.crossLinks?.spotify || `https://open.spotify.com/search/${encodeURIComponent(track.artist + ' ' + track.title)}`,
    },
    {
      key: 'soundcloud',
      name: 'SoundCloud',
      color: 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20',
      badgeColor: 'bg-amber-500 text-slate-950',
      url: track.crossLinks?.soundcloud || `https://soundcloud.com/search?q=${encodeURIComponent(track.artist + ' ' + track.title)}`,
    },
    {
      key: 'youtube',
      name: 'YouTube Music',
      color: 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20',
      badgeColor: 'bg-red-500 text-slate-950',
      url: track.crossLinks?.youtube || `https://music.youtube.com/search?q=${encodeURIComponent(track.artist + ' ' + track.title)}`,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{t.crossLinkTitle}</h3>
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

        {/* Links list */}
        <div className="space-y-3">
          {platforms.map((p) => (
            <div
              key={p.key}
              className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center uppercase ${p.badgeColor}`}>
                  {p.name.substring(0, 2)}
                </span>
                <div className="min-w-0">
                  <span className="text-sm font-semibold text-white block">{p.name}</span>
                  <span className="text-xs text-slate-500 truncate block max-w-[180px]">{p.url}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy(p.url, p.key)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  title={t.copyLink}
                >
                  {copiedKey === p.key ? <Check className="w-4 h-4 text-yellow-300" /> : <Copy className="w-4 h-4" />}
                </button>
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${p.color}`}
                >
                  <span>{t.openOn}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2 text-right">
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
