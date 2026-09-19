import React, { useState } from 'react';
import { X, Plus, ListMusic, Check, Sparkles, Disc, FolderPlus } from 'lucide-react';
import { MusicTrack, Playlist, AppLanguage } from '../types';
import { translations } from '../utils/translations';

interface AddToPlaylistModalProps {
  track: MusicTrack;
  playlists: Playlist[];
  language: AppLanguage['code'];
  onCreatePlaylist: (name: string, description?: string, color?: string) => Playlist;
  onToggleTrackInPlaylist: (playlistId: string, trackId: string) => void;
  onClose: () => void;
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
  track,
  playlists,
  language,
  onCreatePlaylist,
  onToggleTrackInPlaylist,
  onClose,
}) => {
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');
  const [selectedColor, setSelectedColor] = useState('yellow');

  const colorOptions = [
    { name: 'yellow', bg: 'bg-yellow-400', border: 'border-yellow-300' },
    { name: 'cyan', bg: 'bg-cyan-400', border: 'border-cyan-300' },
    { name: 'pink', bg: 'bg-pink-400', border: 'border-pink-300' },
    { name: 'purple', bg: 'bg-purple-400', border: 'border-purple-300' },
    { name: 'emerald', bg: 'bg-emerald-400', border: 'border-emerald-300' },
  ];

  const handleCreateAndAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    const newPl = onCreatePlaylist(newPlaylistName.trim(), newPlaylistDesc.trim(), selectedColor);
    onToggleTrackInPlaylist(newPl.id, track.id);
    setNewPlaylistName('');
    setNewPlaylistDesc('');
    setIsCreatingNew(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-6 relative overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center text-yellow-300">
              <ListMusic className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {language === 'nl' ? 'Toevoegen aan Afspeellijst' : 'Add to Playlist'}
              </h2>
              <p className="text-xs text-slate-400 truncate max-w-[240px]">
                {track.artist} - {track.title}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Track Preview Mini Card */}
        <div className="flex items-center gap-3 bg-slate-800/50 border border-slate-700/50 p-3 rounded-2xl">
          <img
            src={track.coverUrl}
            alt={track.title}
            className="w-12 h-12 rounded-xl object-cover"
          />
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold text-white truncate">{track.title}</h4>
            <p className="text-[11px] text-slate-400 truncate">{track.artist}</p>
            <div className="flex items-center gap-2 mt-1">
              {track.bpm && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-yellow-400/15 text-yellow-300 font-bold">
                  {track.bpm} BPM
                </span>
              )}
              {track.key && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 font-bold">
                  {track.key}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Playlists List */}
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {playlists.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400 bg-slate-950/40 rounded-2xl border border-slate-800 p-4">
              <FolderPlus className="w-8 h-8 mx-auto mb-2 text-slate-500" />
              {language === 'nl' ? 'Nog geen afspeellijsten aangemaakt.' : 'No playlists created yet.'}
            </div>
          ) : (
            playlists.map((pl) => {
              const isIncluded = pl.trackIds.includes(track.id);
              return (
                <button
                  key={pl.id}
                  onClick={() => onToggleTrackInPlaylist(pl.id, track.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all text-left ${
                    isIncluded
                      ? 'bg-yellow-400/10 border-yellow-400/40 text-white'
                      : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-slate-700/80 flex items-center justify-center font-bold text-xs text-yellow-300">
                      <Disc className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">{pl.name}</h4>
                      <p className="text-[10px] text-slate-400">
                        {pl.trackIds.length} {language === 'nl' ? 'nummers' : 'tracks'}
                      </p>
                    </div>
                  </div>

                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${
                      isIncluded
                        ? 'bg-yellow-400 text-slate-950 border-yellow-300'
                        : 'border-slate-600 bg-slate-800 text-transparent'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Create New Playlist Form Toggle */}
        {!isCreatingNew ? (
          <button
            onClick={() => setIsCreatingNew(true)}
            className="w-full py-3 rounded-2xl border border-dashed border-yellow-400/40 hover:border-yellow-400 text-yellow-300 font-bold text-xs flex items-center justify-center gap-2 hover:bg-yellow-400/5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'nl' ? 'Nieuwe Afspeellijst Maken' : 'Create New Playlist'}</span>
          </button>
        ) : (
          <form onSubmit={handleCreateAndAdd} className="bg-slate-950/60 border border-slate-700/80 p-4 rounded-2xl space-y-3">
            <h4 className="text-xs font-bold text-white">
              {language === 'nl' ? 'Nieuwe afspeellijst instellen' : 'New Playlist details'}
            </h4>
            <input
              type="text"
              required
              autoFocus
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder={language === 'nl' ? 'Bijv. DJ Peak Time 128 BPM' : 'e.g. Festival Warmup'}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-yellow-400"
            />
            <input
              type="text"
              value={newPlaylistDesc}
              onChange={(e) => setNewPlaylistDesc(e.target.value)}
              placeholder={language === 'nl' ? 'Beschrijving (optioneel)' : 'Description (optional)'}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-yellow-400"
            />
            
            {/* Color tags */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[10px] text-slate-400 font-medium">Kleur:</span>
              {colorOptions.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setSelectedColor(c.name)}
                  className={`w-5 h-5 rounded-full ${c.bg} ${selectedColor === c.name ? 'ring-2 ring-white scale-110' : 'opacity-60'} transition-all`}
                />
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreatingNew(false)}
                className="px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white"
              >
                {language === 'nl' ? 'Annuleren' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-bold text-xs shadow-md transition-all"
              >
                {language === 'nl' ? 'Maken & Toevoegen' : 'Create & Add'}
              </button>
            </div>
          </form>
        )}

        {/* Done Button */}
        <button
          onClick={onClose}
          className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all"
        >
          {language === 'nl' ? 'Klaar' : 'Done'}
        </button>
      </div>
    </div>
  );
};
