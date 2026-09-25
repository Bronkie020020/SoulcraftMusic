// src/types/track.ts
export interface SoulcraftTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  durationSeconds: number;
  bpm?: number;
  key?: string;            // bijv. "A min"
  camelotKey?: string;     // bijv. "8A", "11B"
  genre?: string;          // bijv. "Club Trance", "Techno"
  mood?: string;           // bijv. "Peak Time", "Driving", "Melodic"
  coverUrl?: string;       // URL of Base64 Data-URI
  artworkBlob?: Blob;      // Ruwe afbeelding uit ID3/cache
  audioBlob?: Blob;        // Lokaal opgeslagen audio in IndexedDB
  filePath?: string;
  sourceUrl?: string;
  addedAt?: number;
}

export interface PlaylistSummary {
  id: string;
  title: string;
  trackCount: number;
  totalDurationSeconds: number;
  averageBpm: number;
  dominantKey: string;
  dominantGenre: string;
  dominantMood: string;
  covers: string[];        // Array met minstens 4 unieke covers voor de collage
}
