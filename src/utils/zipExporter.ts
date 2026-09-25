import JSZip from 'jszip';
import { getTracksByPlaylist, getTrackBlob, StoredTrack } from '../db/libraryDb';
import { MusicTrack } from '../types';

export interface ZipExportProgress {
  current: number;
  total: number;
  currentTitle: string;
  percent: number;
}

/**
 * Sanitizes a string for use in zip / filesystems by removing illegal characters.
 */
export function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '_').trim();
}

/**
 * Triggers a native browser file download from a Blob
 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 2000);
}

/**
 * Export all tracks of a specific playlist into a .zip file directly from IndexedDB.
 * Each audio file inside the zip is named: `[Artist] - [Title].mp3` (or original format).
 *
 * @param playlistId - The unique ID of the playlist
 * @param playlistName - Optional custom name for the resulting zip archive
 * @param onProgress - Optional callback for live progress updates
 */
export async function exportPlaylistToZip(
  playlistId: string,
  playlistName: string = 'Playlist',
  onProgress?: (info: ZipExportProgress) => void
): Promise<Blob> {
  const tracks: StoredTrack[] = await getTracksByPlaylist(playlistId);

  if (tracks.length === 0) {
    throw new Error('Geen gedownloade audiobestanden gevonden in deze afspeellijst.');
  }

  const zip = new JSZip();
  const total = tracks.length;

  for (let i = 0; i < total; i++) {
    const track = tracks[i];
    const trackTitle = `${track.artist} - ${track.title}`;

    if (onProgress) {
      onProgress({
        current: i + 1,
        total,
        currentTitle: trackTitle,
        percent: Math.round(((i + 0.5) / total) * 100),
      });
    }

    let blob = track.audioBlob;
    if (!blob) {
      const fetched = await getTrackBlob(track.id);
      if (fetched) blob = fetched;
    }

    if (blob) {
      const ext = track.format || 'mp3';
      const cleanArtist = sanitizeFilename(track.artist || 'Unknown Artist');
      const cleanTitle = sanitizeFilename(track.title || 'Track');
      const filename = `${cleanArtist} - ${cleanTitle}.${ext}`;

      // Add binary audio file to zip archive
      zip.file(filename, blob);
    }
  }

  if (onProgress) {
    onProgress({
      current: total,
      total,
      currentTitle: 'Inpakken van archief...',
      percent: 95,
    });
  }

  // Compress & generate ZIP archive
  const zipBlob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    },
    (metadata) => {
      if (onProgress) {
        onProgress({
          current: total,
          total,
          currentTitle: 'Archief comprimeren...',
          percent: 95 + Math.round(metadata.percent * 0.05),
        });
      }
    }
  );

  const cleanZipName = `${sanitizeFilename(playlistName)}.zip`;
  triggerBlobDownload(zipBlob, cleanZipName);

  if (onProgress) {
    onProgress({
      current: total,
      total,
      currentTitle: 'Voltooid!',
      percent: 100,
    });
  }

  return zipBlob;
}

/**
 * Export arbitrary tracks array to ZIP archive (e.g. selected items, queue, or search results)
 */
export async function exportTracksToZip(
  tracks: (MusicTrack | StoredTrack)[],
  archiveName: string = 'Soulcraft_Music_Export',
  onProgress?: (info: ZipExportProgress) => void
): Promise<Blob> {
  if (!tracks || tracks.length === 0) {
    throw new Error('Geen nummers geselecteerd voor ZIP export.');
  }

  const zip = new JSZip();
  const total = tracks.length;

  for (let i = 0; i < total; i++) {
    const track = tracks[i];
    const trackTitle = `${track.artist} - ${track.title}`;

    if (onProgress) {
      onProgress({
        current: i + 1,
        total,
        currentTitle: trackTitle,
        percent: Math.round(((i + 0.5) / total) * 100),
      });
    }

    let blob: Blob | null = (track as StoredTrack).audioBlob || null;

    if (!blob) {
      blob = await getTrackBlob(track.id);
    }

    if (blob) {
      const ext = track.format || 'mp3';
      const cleanArtist = sanitizeFilename(track.artist || 'Unknown Artist');
      const cleanTitle = sanitizeFilename(track.title || 'Track');
      const filename = `${cleanArtist} - ${cleanTitle}.${ext}`;

      zip.file(filename, blob);
    }
  }

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  triggerBlobDownload(zipBlob, `${sanitizeFilename(archiveName)}.zip`);
  return zipBlob;
}
