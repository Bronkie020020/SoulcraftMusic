import { useState, useEffect, useCallback } from 'react';
import { MusicTrack, Playlist } from '../types';

export interface StoredPlaylist {
  id: string;
  name: string;
  coverUrl?: string;
  createdAt: number;
  description?: string;
  color?: string;
}

export interface StoredTrack {
  id: string;
  playlistId: string;
  title: string;
  artist: string;
  audioBlob: Blob;
  duration: number; // in seconds
  savedAt: number;  // timestamp in ms
  album?: string;
  format?: string;
  coverUrl?: string;
  originalUrl?: string;
  bpm?: number;
  key?: string;
  fileSizeMb?: number;
}

const DB_NAME = 'soulcraft_library_db';
const DB_VERSION = 1;

let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Initializes and opens the IndexedDB database with playlists & tracks object stores.
 */
export function openLibraryDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this browser environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. Playlists store
      if (!db.objectStoreNames.contains('playlists')) {
        const playlistStore = db.createObjectStore('playlists', { keyPath: 'id' });
        playlistStore.createIndex('by-name', 'name', { unique: false });
        playlistStore.createIndex('by-created', 'createdAt', { unique: false });
      }

      // 2. Tracks store (includes binary audioBlob)
      if (!db.objectStoreNames.contains('tracks')) {
        const trackStore = db.createObjectStore('tracks', { keyPath: 'id' });
        trackStore.createIndex('by-playlist', 'playlistId', { unique: false });
        trackStore.createIndex('by-artist', 'artist', { unique: false });
        trackStore.createIndex('by-savedAt', 'savedAt', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
        dbPromise = null;
      };
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      dbPromise = null;
      reject((event.target as IDBOpenDBRequest).error);
    };
  });

  return dbPromise;
}

/**
 * Save or update a playlist in IndexedDB
 */
export async function savePlaylistToDb(playlist: StoredPlaylist): Promise<void> {
  const db = await openLibraryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('playlists', 'readwrite');
    const store = tx.objectStore('playlists');
    const req = store.put(playlist);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieve all stored playlists from IndexedDB
 */
export async function getAllPlaylistsFromDb(): Promise<StoredPlaylist[]> {
  const db = await openLibraryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('playlists', 'readonly');
    const store = tx.objectStore('playlists');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Delete a playlist and cascade delete all its associated tracks from IndexedDB
 */
export async function deletePlaylistFromDb(playlistId: string): Promise<void> {
  const db = await openLibraryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['playlists', 'tracks'], 'readwrite');
    const playlistStore = tx.objectStore('playlists');
    const trackStore = tx.objectStore('tracks');

    playlistStore.delete(playlistId);

    // Delete associated tracks using the 'by-playlist' index
    const index = trackStore.index('by-playlist');
    const cursorReq = index.openKeyCursor(IDBKeyRange.only(playlistId));

    cursorReq.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursor | null>).result;
      if (cursor) {
        trackStore.delete(cursor.primaryKey);
        cursor.continue();
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Save or update a track with its audio Blob in IndexedDB
 */
export async function saveTrackToDb(track: StoredTrack): Promise<void> {
  const db = await openLibraryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tracks', 'readwrite');
    const store = tx.objectStore('tracks');
    const req = store.put(track);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieve all tracks from IndexedDB
 */
export async function getAllTracksFromDb(): Promise<StoredTrack[]> {
  const db = await openLibraryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tracks', 'readonly');
    const store = tx.objectStore('tracks');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Strictly query tracks for a specific playlist using IndexedDB index
 */
export async function getTracksByPlaylist(playlistId: string): Promise<StoredTrack[]> {
  const db = await openLibraryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tracks', 'readonly');
    const store = tx.objectStore('tracks');
    const index = store.index('by-playlist');
    const req = index.getAll(IDBKeyRange.only(playlistId));
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieve a specific track by its ID from IndexedDB
 */
export async function getTrackById(id: string): Promise<StoredTrack | undefined> {
  const db = await openLibraryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tracks', 'readonly');
    const store = tx.objectStore('tracks');
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieve just the audio Blob for a track
 */
export async function getTrackBlob(id: string): Promise<Blob | null> {
  const track = await getTrackById(id);
  return track ? track.audioBlob : null;
}

/**
 * Delete an individual track from IndexedDB
 */
export async function deleteTrackFromDb(id: string): Promise<void> {
  const db = await openLibraryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tracks', 'readwrite');
    const store = tx.objectStore('tracks');
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Converts a StoredTrack from IndexedDB to a playable MusicTrack with a valid Blob object URL
 */
export function convertStoredTrackToMusicTrack(stored: StoredTrack): MusicTrack {
  const streamUrl = stored.audioBlob ? URL.createObjectURL(stored.audioBlob) : undefined;
  const mins = Math.floor(stored.duration / 60);
  const secs = Math.floor(stored.duration % 60);
  const durationFormatted = `${mins}:${secs.toString().padStart(2, '0')}`;

  return {
    id: stored.id,
    title: stored.title,
    artist: stored.artist,
    album: stored.album || 'Unknown Album',
    duration: stored.duration,
    durationFormatted,
    releaseYear: new Date(stored.savedAt).getFullYear().toString(),
    genre: 'Various',
    platform: 'youtube',
    originalUrl: stored.originalUrl || '',
    coverUrl: stored.coverUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop',
    streamUrl,
    bitrate: '320kbps',
    format: stored.format || 'mp3',
    fileSizeMb: stored.fileSizeMb || Number((stored.audioBlob.size / (1024 * 1024)).toFixed(2)),
    isDownloaded: true,
    downloadedAt: new Date(stored.savedAt).toISOString(),
    bpm: stored.bpm,
    key: stored.key,
  };
}

/**
 * Custom React Hook: useLibrary()
 * Fetches playlists and tracks on mount from IndexedDB and keeps global state in sync.
 */
export function useLibrary() {
  const [storedPlaylists, setStoredPlaylists] = useState<StoredPlaylist[]>([]);
  const [storedTracks, setStoredTracks] = useState<StoredTrack[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refreshLibrary = useCallback(async () => {
    setIsLoading(true);
    try {
      const [pls, trks] = await Promise.all([
        getAllPlaylistsFromDb(),
        getAllTracksFromDb(),
      ]);
      setStoredPlaylists(pls);
      setStoredTracks(trks);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load library from IndexedDB:', err);
      setError(err?.message || 'Failed to read IndexedDB library');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshLibrary();
  }, [refreshLibrary]);

  const savePlaylist = useCallback(async (pl: StoredPlaylist) => {
    await savePlaylistToDb(pl);
    await refreshLibrary();
  }, [refreshLibrary]);

  const removePlaylist = useCallback(async (id: string) => {
    await deletePlaylistFromDb(id);
    await refreshLibrary();
  }, [refreshLibrary]);

  const saveTrack = useCallback(async (track: StoredTrack) => {
    await saveTrackToDb(track);
    await refreshLibrary();
  }, [refreshLibrary]);

  const removeTrack = useCallback(async (id: string) => {
    await deleteTrackFromDb(id);
    await refreshLibrary();
  }, [refreshLibrary]);

  const getPlaylistTracks = useCallback((playlistId: string) => {
    return storedTracks.filter((t) => t.playlistId === playlistId);
  }, [storedTracks]);

  return {
    storedPlaylists,
    storedTracks,
    isLoading,
    error,
    refreshLibrary,
    savePlaylist,
    removePlaylist,
    saveTrack,
    removeTrack,
    getPlaylistTracks,
  };
}
