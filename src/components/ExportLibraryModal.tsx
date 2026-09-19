import React, { useState } from 'react';
import {
  FileSpreadsheet,
  FileCode,
  FileText,
  Download,
  Copy,
  Check,
  X,
  Sparkles,
  HardDrive,
  Clock,
  Music2,
  FolderOpen,
  Calendar,
  Zap,
  Layers,
  Heart,
  ExternalLink,
} from 'lucide-react';
import { MusicTrack, Playlist, AppLanguage } from '../types';
import {
  exportLibraryAsExcel,
  exportLibraryAsJson,
  exportLibraryAsCsv,
  copyLibraryAsJson,
  copyLibraryAsTsv,
} from '../utils/libraryExporter';

interface ExportLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: AppLanguage['code'];
  library: MusicTrack[];
  filteredTracks?: MusicTrack[];
  playlists: Playlist[];
}

export const ExportLibraryModal: React.FC<ExportLibraryModalProps> = ({
  isOpen,
  onClose,
  language,
  library,
  filteredTracks,
  playlists,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<'excel' | 'json' | 'csv'>('excel');
  const [trackScope, setTrackScope] = useState<'all' | 'filtered' | 'favorites'>('all');
  const [copiedFormat, setCopiedFormat] = useState<'json' | 'tsv' | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  // Determine active track list
  const activeTracks = React.useMemo(() => {
    if (trackScope === 'favorites') {
      return library.filter((t) => t.isFavorite);
    }
    if (trackScope === 'filtered' && filteredTracks && filteredTracks.length > 0) {
      return filteredTracks;
    }
    return library;
  }, [library, filteredTracks, trackScope]);

  const totalMb = activeTracks.reduce((sum, t) => sum + (t.fileSizeMb || 0), 0);
  const totalSeconds = activeTracks.reduce((sum, t) => sum + (t.duration || 0), 0);
  const totalMins = Math.floor(totalSeconds / 60);
  const scannedKeysCount = activeTracks.filter((t) => t.bpm || t.key).length;

  const handleExport = (format: 'excel' | 'json' | 'csv') => {
    if (activeTracks.length === 0) return;

    if (format === 'excel') {
      exportLibraryAsExcel(activeTracks, { playlists });
      setExportSuccess(
        language === 'nl'
          ? 'Excel bestand (.xls) succesvol gegenereerd en gedownload!'
          : 'Excel file (.xls) successfully generated and downloaded!'
      );
    } else if (format === 'json') {
      exportLibraryAsJson(activeTracks, { playlists });
      setExportSuccess(
        language === 'nl'
          ? 'JSON metadata archief (.json) succesvol gedownload!'
          : 'JSON metadata archive (.json) successfully downloaded!'
      );
    } else {
      exportLibraryAsCsv(activeTracks, { playlists });
      setExportSuccess(
        language === 'nl'
          ? 'CSV tabel (.csv) succesvol gedownload!'
          : 'CSV table (.csv) successfully downloaded!'
      );
    }

    setTimeout(() => {
      setExportSuccess(null);
    }, 4000);
  };

  const handleCopy = async (type: 'json' | 'tsv') => {
    if (activeTracks.length === 0) return;
    let success = false;
    if (type === 'json') {
      success = await copyLibraryAsJson(activeTracks, { playlists });
    } else {
      success = await copyLibraryAsTsv(activeTracks, { playlists });
    }

    if (success) {
      setCopiedFormat(type);
      setTimeout(() => setCopiedFormat(null), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden text-slate-100 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-yellow-400/10 rounded-full blur-3xl -z-0 pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 pb-5 border-b border-zinc-800 relative z-10 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-yellow-400 text-black flex items-center justify-center font-black shadow-lg shadow-yellow-400/20">
              <FileSpreadsheet className="w-6 h-6 text-black" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                <span>{language === 'nl' ? 'Muziekbibliotheek Exporteren' : 'Export Music Library'}</span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-yellow-400 text-black font-extrabold uppercase">
                  Excel & JSON
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 font-medium">
                {language === 'nl'
                  ? 'Exporteer alle nummers, bestandspaden, download datums en ID3 tags voor archivering & administratie.'
                  : 'Export all tracks, file paths, download timestamps, and ID3 tags for record keeping & backups.'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors border border-zinc-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="space-y-6 py-6 overflow-y-auto pr-1 relative z-10 scrollbar-thin">
          
          {/* Feedback Toast */}
          {exportSuccess && (
            <div className="p-3.5 rounded-2xl bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 text-xs sm:text-sm font-semibold flex items-center gap-2.5 animate-fade-in shadow-lg">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{exportSuccess}</span>
            </div>
          )}

          {/* Scope Selector (All vs Favorites vs Filtered) */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
              {language === 'nl' ? '1. Selecteer Bereik' : '1. Select Scope'}
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setTrackScope('all')}
                className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                  trackScope === 'all'
                    ? 'bg-yellow-400 text-black border-yellow-300 shadow-md font-bold'
                    : 'bg-zinc-800/60 hover:bg-zinc-800 text-zinc-300 border-zinc-700'
                }`}
              >
                <div className="text-xs font-bold">
                  {language === 'nl' ? 'Hele Bibliotheek' : 'Full Library'}
                </div>
                <div className={`text-[11px] ${trackScope === 'all' ? 'text-black/80' : 'text-zinc-400'}`}>
                  {library.length} {language === 'nl' ? 'nummers' : 'tracks'}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTrackScope('favorites')}
                className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                  trackScope === 'favorites'
                    ? 'bg-pink-600 text-white border-pink-400 shadow-md font-bold'
                    : 'bg-zinc-800/60 hover:bg-zinc-800 text-zinc-300 border-zinc-700'
                }`}
              >
                <div className="text-xs font-bold flex items-center gap-1.5">
                  <Heart className="w-3 h-3 fill-current" />
                  <span>{language === 'nl' ? 'Alleen Favorieten' : 'Favorites Only'}</span>
                </div>
                <div className={`text-[11px] ${trackScope === 'favorites' ? 'text-pink-100' : 'text-zinc-400'}`}>
                  {library.filter((t) => t.isFavorite).length} {language === 'nl' ? 'nummers' : 'tracks'}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTrackScope('filtered')}
                disabled={!filteredTracks || filteredTracks.length === 0 || filteredTracks.length === library.length}
                className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between disabled:opacity-40 ${
                  trackScope === 'filtered'
                    ? 'bg-cyan-500 text-black border-cyan-300 shadow-md font-bold'
                    : 'bg-zinc-800/60 hover:bg-zinc-800 text-zinc-300 border-zinc-700'
                }`}
              >
                <div className="text-xs font-bold">
                  {language === 'nl' ? 'Huidige Filter' : 'Current Filter'}
                </div>
                <div className={`text-[11px] ${trackScope === 'filtered' ? 'text-black/80' : 'text-zinc-400'}`}>
                  {filteredTracks?.length || 0} {language === 'nl' ? 'nummers' : 'tracks'}
                </div>
              </button>
            </div>
          </div>

          {/* Quick Stats Summary Card */}
          <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-yellow-400/10 text-yellow-400 flex items-center justify-center shrink-0">
                <Music2 className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-white text-sm">{activeTracks.length}</div>
                <div className="text-[10px] text-zinc-400">{language === 'nl' ? 'Nummers' : 'Tracks'}</div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-400/10 text-purple-400 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-white text-sm">{totalMins} min</div>
                <div className="text-[10px] text-zinc-400">{language === 'nl' ? 'Totale Speelduur' : 'Total Duration'}</div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-400/10 text-emerald-400 flex items-center justify-center shrink-0">
                <HardDrive className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-white text-sm">{totalMb.toFixed(1)} MB</div>
                <div className="text-[10px] text-zinc-400">{language === 'nl' ? 'Bestandsgrootte' : 'File Size'}</div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-cyan-400/10 text-cyan-400 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-white text-sm">{scannedKeysCount} / {activeTracks.length}</div>
                <div className="text-[10px] text-zinc-400">{language === 'nl' ? 'BPM / Key Gescand' : 'BPM/Key Scanned'}</div>
              </div>
            </div>
          </div>

          {/* Included Metadata Checklist */}
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 space-y-2.5 text-xs">
            <div className="flex items-center gap-2 text-zinc-300 font-bold text-[11px] uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
              <span>{language === 'nl' ? 'Inbegrepen Metadata Velden voor Administratie' : 'Included Metadata Fields for Records'}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-zinc-400">
              <div className="flex items-center gap-1.5 text-zinc-300">
                <FolderOpen className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>Bestandspaden (File paths)</span>
              </div>
              <div className="flex items-center gap-1.5 text-zinc-300">
                <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Download Datums & Tijd</span>
              </div>
              <div className="flex items-center gap-1.5 text-zinc-300">
                <Zap className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                <span>BPM & Camelot Toonsoort</span>
              </div>
              <div className="flex items-center gap-1.5 text-zinc-300">
                <Music2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span>ID3 Tags (Artiest, Album, Genre)</span>
              </div>
              <div className="flex items-center gap-1.5 text-zinc-300">
                <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>Afspeellijsten Koppelstatus</span>
              </div>
              <div className="flex items-center gap-1.5 text-zinc-300">
                <ExternalLink className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Originele Stream URLs & Lyrics</span>
              </div>
            </div>
          </div>

          {/* Format Selection Cards */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
              {language === 'nl' ? '2. Kies Exportformaat' : '2. Choose Export Format'}
            </label>

            {/* Option A: EXCEL (.xls / XML Spreadsheet) */}
            <div
              onClick={() => setSelectedFormat('excel')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-4 ${
                selectedFormat === 'excel'
                  ? 'bg-yellow-400/10 border-yellow-400 shadow-lg shadow-yellow-400/5 ring-1 ring-yellow-400/40'
                  : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-black shrink-0 mt-0.5">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">
                      {language === 'nl' ? 'Microsoft Excel Werkmap (.xls / .xlsx)' : 'Microsoft Excel Spreadsheet (.xls / .xlsx)'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                      Aanbevolen
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {language === 'nl'
                      ? 'Opgemaakte kolommen met gele header-rij, automatisch gefilterde rijen, bestandspaden, download timestamps en Camelot toonsoorten.'
                      : 'Formatted columns with colored headers, auto-filters, file paths, download timestamps, and Camelot keys.'}
                  </p>
                </div>
              </div>

              <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-1 ${
                selectedFormat === 'excel' ? 'border-yellow-400 bg-yellow-400 text-black' : 'border-zinc-700'
              }`}>
                {selectedFormat === 'excel' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>
            </div>

            {/* Option B: JSON Archive (.json) */}
            <div
              onClick={() => setSelectedFormat('json')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-4 ${
                selectedFormat === 'json'
                  ? 'bg-yellow-400/10 border-yellow-400 shadow-lg shadow-yellow-400/5 ring-1 ring-yellow-400/40'
                  : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-black shrink-0 mt-0.5">
                  <FileCode className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">
                      {language === 'nl' ? 'Gestructureerd JSON Metadata Archief (.json)' : 'Structured JSON Metadata Archive (.json)'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold">
                      Volledige Backup
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {language === 'nl'
                      ? 'Complete gestructureerde JSON met 100% detailniveau inclusief songteksten, cross-links naar Spotify/SoundCloud/YouTube en afspeellijsten.'
                      : 'Complete structured JSON with 100% fidelity including lyrics, cross-links to Spotify/SoundCloud/YouTube, and playlists.'}
                  </p>
                </div>
              </div>

              <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-1 ${
                selectedFormat === 'json' ? 'border-yellow-400 bg-yellow-400 text-black' : 'border-zinc-700'
              }`}>
                {selectedFormat === 'json' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>
            </div>

            {/* Option C: CSV Spreadsheet (.csv) */}
            <div
              onClick={() => setSelectedFormat('csv')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-4 ${
                selectedFormat === 'csv'
                  ? 'bg-yellow-400/10 border-yellow-400 shadow-lg shadow-yellow-400/5 ring-1 ring-yellow-400/40'
                  : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-black shrink-0 mt-0.5">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">
                      {language === 'nl' ? 'Universeel CSV Tabelbestand (.csv)' : 'Universal CSV Table File (.csv)'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {language === 'nl'
                      ? 'Universeel kommagescheiden bestand met UTF-8 BOM voor compatibiliteit met Google Sheets, Numbers en DJ software.'
                      : 'Universal comma-separated file with UTF-8 BOM for compatibility with Google Sheets, Numbers, and DJ software.'}
                  </p>
                </div>
              </div>

              <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-1 ${
                selectedFormat === 'csv' ? 'border-yellow-400 bg-yellow-400 text-black' : 'border-zinc-700'
              }`}>
                {selectedFormat === 'csv' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer / Actions */}
        <div className="pt-4 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 relative z-10 shrink-0">
          
          {/* Clipboard Copy helpers */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => handleCopy('tsv')}
              disabled={activeTracks.length === 0}
              className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
              title="Kopieer als Excel tabel naar klembord om direct te plakken"
            >
              {copiedFormat === 'tsv' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">{language === 'nl' ? 'Geplakt naar Klembord!' : 'Copied to Clipboard!'}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-yellow-400" />
                  <span>{language === 'nl' ? 'Kopieer Excel Tabel' : 'Copy Excel TSV'}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleCopy('json')}
              disabled={activeTracks.length === 0}
              className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
              title="Kopieer JSON structuur naar klembord"
            >
              {copiedFormat === 'json' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">JSON Gekopieerd!</span>
                </>
              ) : (
                <>
                  <FileCode className="w-3.5 h-3.5 text-blue-400" />
                  <span>Kopieer JSON</span>
                </>
              )}
            </button>
          </div>

          {/* Primary Download Button */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 text-xs font-bold transition-all"
            >
              {language === 'nl' ? 'Sluiten' : 'Close'}
            </button>

            <button
              type="button"
              onClick={() => handleExport(selectedFormat)}
              disabled={activeTracks.length === 0}
              className="px-6 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-yellow-400/20 active:scale-95 disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-black" />
              <span>
                {selectedFormat === 'excel' && (language === 'nl' ? 'Download Excel (.xls)' : 'Download Excel (.xls)')}
                {selectedFormat === 'json' && (language === 'nl' ? 'Download JSON (.json)' : 'Download JSON (.json)')}
                {selectedFormat === 'csv' && (language === 'nl' ? 'Download CSV (.csv)' : 'Download CSV (.csv)')}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
