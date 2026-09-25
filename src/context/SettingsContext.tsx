import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export type AudioFormat = 'mp3' | 'm4a' | 'wav';
export type AudioQuality = '128' | '192' | '320';
export type ConcurrencyLimit = 1 | 2 | 3 | 4 | 5;

export interface AppSettings {
  format: AudioFormat;
  quality: AudioQuality;
  concurrency: ConcurrencyLimit;
  customDirectoryName: string | null;
}

export interface SettingsContextType {
  settings: AppSettings;
  setFormat: (format: AudioFormat) => void;
  setQuality: (quality: AudioQuality) => void;
  setConcurrency: (concurrency: ConcurrencyLimit) => void;
  directoryHandle: FileSystemDirectoryHandle | null;
  isFileSystemSupported: boolean;
  chooseDirectory: () => Promise<boolean>;
  resetDirectory: () => Promise<void>;
  getEffectiveFormatString: () => string;
  writeBlobToLocalFolder: (filename: string, blob: Blob) => Promise<boolean>;
}

const SETTINGS_STORAGE_KEYS = {
  FORMAT: 'soulcraft_settings_format',
  QUALITY: 'soulcraft_settings_quality',
  CONCURRENCY: 'soulcraft_settings_concurrency',
  FOLDER_NAME: 'soulcraft_settings_folder_name',
};

// IndexedDB database for persisting FileSystemDirectoryHandle
const HANDLES_DB_NAME = 'soulcraft_directory_handles_db';
const HANDLES_STORE_NAME = 'handles';

function openHandlesDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const req = window.indexedDB.open(HANDLES_DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(HANDLES_STORE_NAME)) {
        db.createObjectStore(HANDLES_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveHandleToDb(handle: FileSystemDirectoryHandle): Promise<void> {
  try {
    const db = await openHandlesDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(HANDLES_STORE_NAME, 'readwrite');
      const store = tx.objectStore(HANDLES_STORE_NAME);
      const req = store.put(handle, 'downloadDirectory');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[SettingsContext] Failed to persist directory handle:', err);
  }
}

async function getHandleFromDb(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openHandlesDB();
    return new Promise((resolve) => {
      const tx = db.transaction(HANDLES_STORE_NAME, 'readonly');
      const store = tx.objectStore(HANDLES_STORE_NAME);
      const req = store.get('downloadDirectory');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function removeHandleFromDb(): Promise<void> {
  try {
    const db = await openHandlesDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(HANDLES_STORE_NAME, 'readwrite');
      const store = tx.objectStore(HANDLES_STORE_NAME);
      const req = store.delete('downloadDirectory');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {}
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // 1. Format
  const [format, setFormatState] = useState<AudioFormat>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEYS.FORMAT);
      if (saved === 'mp3' || saved === 'm4a' || saved === 'wav') return saved;
    } catch {}
    return 'mp3';
  });

  // 2. Quality
  const [quality, setQualityState] = useState<AudioQuality>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEYS.QUALITY);
      if (saved === '128' || saved === '192' || saved === '320') return saved;
    } catch {}
    return '192'; // Default: Standaard (192 kbps)
  });

  // 3. Concurrency
  const [concurrency, setConcurrencyState] = useState<ConcurrencyLimit>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEYS.CONCURRENCY);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (parsed >= 1 && parsed <= 5) return parsed as ConcurrencyLimit;
      }
    } catch {}
    return 3; // Default: 3 parallel downloads
  });

  // 4. File System Access API
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [customDirectoryName, setCustomDirectoryName] = useState<string | null>(() => {
    try {
      return localStorage.getItem(SETTINGS_STORAGE_KEYS.FOLDER_NAME);
    } catch {
      return null;
    }
  });

  const isFileSystemSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

  // Restore directory handle from IndexedDB on initial mount
  useEffect(() => {
    if (isFileSystemSupported) {
      getHandleFromDb().then(async (handle) => {
        if (handle) {
          setDirectoryHandle(handle);
          setCustomDirectoryName(handle.name);
          try {
            localStorage.setItem(SETTINGS_STORAGE_KEYS.FOLDER_NAME, handle.name);
          } catch {}
        }
      });
    }
  }, [isFileSystemSupported]);

  // Setters with persistent localStorage
  const setFormat = useCallback((newFormat: AudioFormat) => {
    setFormatState(newFormat);
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEYS.FORMAT, newFormat);
    } catch {}
  }, []);

  const setQuality = useCallback((newQuality: AudioQuality) => {
    setQualityState(newQuality);
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEYS.QUALITY, newQuality);
    } catch {}
  }, []);

  const setConcurrency = useCallback((newConcurrency: ConcurrencyLimit) => {
    setConcurrencyState(newConcurrency);
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEYS.CONCURRENCY, String(newConcurrency));
    } catch {}
  }, []);

  // Pick local directory using File System Access API
  const chooseDirectory = useCallback(async (): Promise<boolean> => {
    if (!isFileSystemSupported) {
      return false;
    }

    try {
      const handle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'music',
      });

      // Query or request readwrite permission
      if (handle.requestPermission) {
        const permission = await handle.requestPermission({ mode: 'readwrite' });
        if (permission !== 'granted') {
          return false;
        }
      }

      setDirectoryHandle(handle);
      setCustomDirectoryName(handle.name);

      try {
        localStorage.setItem(SETTINGS_STORAGE_KEYS.FOLDER_NAME, handle.name);
      } catch {}

      await saveHandleToDb(handle);
      return true;
    } catch (err: any) {
      // User cancelled picker or error
      if (err?.name !== 'AbortError') {
        console.warn('[SettingsContext] showDirectoryPicker error:', err);
      }
      return false;
    }
  }, [isFileSystemSupported]);

  // Reset to default browser Downloads
  const resetDirectory = useCallback(async () => {
    setDirectoryHandle(null);
    setCustomDirectoryName(null);
    try {
      localStorage.removeItem(SETTINGS_STORAGE_KEYS.FOLDER_NAME);
    } catch {}
    await removeHandleFromDb();
  }, []);

  // Combines format and quality into a string for the backend (e.g. "mp3-192", "wav")
  const getEffectiveFormatString = useCallback((): string => {
    if (format === 'wav') return 'wav';
    return `${format}-${quality}`;
  }, [format, quality]);

  // Writes directly to the user-selected local directory if available
  const writeBlobToLocalFolder = useCallback(async (filename: string, blob: Blob): Promise<boolean> => {
    if (!directoryHandle) return false;

    try {
      // Verify permission before writing
      const handleAny = directoryHandle as any;
      if (handleAny.queryPermission) {
        let perm = await handleAny.queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted' && handleAny.requestPermission) {
          perm = await handleAny.requestPermission({ mode: 'readwrite' });
        }
        if (perm !== 'granted') {
          return false;
        }
      }

      const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
      const writable = await (fileHandle as any).createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (err) {
      console.warn('[SettingsContext] Direct folder write failed, falling back to browser download:', err);
      return false;
    }
  }, [directoryHandle]);

  return (
    <SettingsContext.Provider
      value={{
        settings: {
          format,
          quality,
          concurrency,
          customDirectoryName,
        },
        setFormat,
        setQuality,
        setConcurrency,
        directoryHandle,
        isFileSystemSupported,
        chooseDirectory,
        resetDirectory,
        getEffectiveFormatString,
        writeBlobToLocalFolder,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export function useSettings(): SettingsContextType {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
