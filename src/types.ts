export type Platform = 'spotify' | 'soundcloud' | 'youtube';

export type QualityFormat = 'mp3-320' | 'mp3-256' | 'mp3-128' | 'wav' | 'flac' | 'm4a';

export interface CrossLinks {
  spotify?: string;
  soundcloud?: string;
  youtube?: string;
}

export interface AudioNote {
  freq: number;
  duration: number;
  type?: OscillatorType;
}

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // in seconds
  durationFormatted: string;
  releaseYear: string;
  genre: string;
  platform: Platform;
  originalUrl: string;
  coverUrl: string;
  streamUrl?: string;
  bitrate: string;
  format: string;
  fileSizeMb: number;
  lyrics?: string;
  bpm?: number;
  key?: string;
  playlistId?: string;
  isDownloaded?: boolean;
  isFavorite?: boolean;
  addedAt?: string;
  downloadedAt?: string;
  filePath?: string;
  downloadProgress?: number;
  downloadStatus?: 'idle' | 'fetching' | 'converting' | 'encoding' | 'ready' | 'error';
  audioNotes?: AudioNote[];
  crossLinks?: CrossLinks;
}

export interface BatchItem {
  id: string;
  url: string;
  track?: MusicTrack;
  status: 'pending' | 'processing' | 'completed' | 'error';
  errorMessage?: string;
}

export interface DownloadMetrics {
  progress: number;
  status: 'idle' | 'fetching' | 'converting' | 'encoding' | 'ready' | 'error';
  speedFormatted?: string; // e.g. "2.4 MB/s"
  etaFormatted?: string;   // e.g. "08s" or "01:12"
  loadedMb?: number;       // e.g. 4.2
  totalMb?: number;        // e.g. 8.5
}

export interface AppLanguage {
  code: 'nl' | 'en';
  label: string;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  color?: string; // e.g. 'pink', 'yellow', 'cyan', 'purple', 'emerald'
  coverUrl?: string;
  trackIds: string[];
  createdAt: string;
  updatedAt?: string;
  isSmartPlaylist?: boolean;
  targetBpmMin?: number;
  targetBpmMax?: number;
  targetKey?: string;
}

export interface KeyAnalysisResult {
  standardKey: string;     // e.g. "A minor" or "C major"
  camelotKey: string;      // e.g. "8A" or "8B"
  confidence: number;      // 0 to 1
  bpm: number;             // e.g. 128
  compatibleKeys: string[]; // e.g. ["8A", "7A", "9A", "8B"]
}

export type AppTheme = 'light-purple' | 'light-blue' | 'dark';
