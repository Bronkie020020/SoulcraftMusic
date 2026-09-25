import fs from 'node:fs';
import path from 'node:path';
import NodeID3 from 'node-id3';

export interface ExtendedTrackMetadata {
  title: string;
  artists: string[];
  album?: string;
  mixName?: string;
  genre?: string;
  mood?: string;
  bpm?: number;
  key?: string; // bijv. "A min", "G# maj", "8A", etc.
  year?: string;
  artworkUrl?: string;
  isrc?: string;
}

/**
 * Converteert standaard muzikale toonsoorten naar de bekende Camelot-notatie (bijv. "A Minor" -> "8A").
 * Dit is de industriestandaard voor DJs in Rekordbox, Traktor en Serato.
 */
export function convertToCamelot(keyName?: string): string {
  if (!keyName) return '';

  const cleanKey = keyName.trim().toLowerCase();
  const camelotMap: Record<string, string> = {
    // Minor keys (A)
    'ab min': '1A', 'g# min': '1A',
    'eb min': '2A', 'd# min': '2A',
    'bb min': '3A', 'a# min': '3A',
    'f min': '4A',
    'c min': '5A',
    'g min': '6A',
    'd min': '7A',
    'a min': '8A',
    'e min': '9A',
    'b min': '10A',
    'f# min': '11A', 'gb min': '11A',
    'c# min': '12A', 'db min': '12A',

    // Major keys (B)
    'b maj': '1B',
    'f# maj': '2B', 'gb maj': '2B',
    'c# maj': '3B', 'db maj': '3B',
    'ab maj': '4B', 'g# maj': '4B',
    'eb maj': '5B', 'd# maj': '5B',
    'bb maj': '6B', 'a# maj': '6B',
    'f maj': '7B',
    'c maj': '8B',
    'g maj': '9B',
    'd maj': '10B',
    'a maj': '11B',
    'e maj': '12B',
  };

  for (const [pattern, code] of Object.entries(camelotMap)) {
    if (cleanKey.includes(pattern)) {
      return `${code} - ${keyName}`;
    }
  }

  return keyName;
}

/**
 * Downloadt de albumhoes parallel met de audio in memory (RAM buffer)
 * zonder schijfvertraging. Schaaft de URL bij naar high-resolution indien Beatport CDN.
 */
export async function fetchArtworkBuffer(artworkUrl?: string): Promise<{ mime: string; imageBuffer: Buffer } | null> {
  if (!artworkUrl) return null;

  try {
    // Beatport CDN URL optimaliseren voor maximale resolutie (bijv. 1400x1400 ipv thumbnail)
    let optimizedUrl = artworkUrl;
    if (optimizedUrl.includes('beatport.com') || optimizedUrl.includes('media.beatport.com')) {
      optimizedUrl = optimizedUrl.replace(/\/image_size\/\d+x\d+\//, '/image_size/1400x1400/');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // max 8 seconden

    const response = await fetch(optimizedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const arrayBuffer = await response.arrayBuffer();
    const mime = response.headers.get('content-type') || 'image/jpeg';

    return {
      mime,
      imageBuffer: Buffer.from(arrayBuffer),
    };
  } catch {
    // Artwork download mag het algemene downloadproces nooit laten crashen
    return null;
  }
}

/**
 * Schrijft direct ID3v2.3 tags (compatibel met Windows Verkenner, VLC, Rekordbox, Traktor, Serato, Apple Music).
 * Geen audio re-encoding nodig; dit proces duurt minder dan 30 milliseconden!
 */
export async function writeTrackId3Tags(
  filePath: string,
  metadata: ExtendedTrackMetadata,
  artworkBuffer?: { mime: string; imageBuffer: Buffer } | null
): Promise<boolean> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Bestand niet gevonden voor tagging: ${filePath}`);
  }

  const primaryArtist = metadata.artists[0] || 'Unknown Artist';
  const allArtists = metadata.artists.join(', ');
  const camelotKey = convertToCamelot(metadata.key);

  const tags: NodeID3.Tags = {
    title: metadata.title,
    artist: allArtists,
    performerInfo: primaryArtist,
    album: metadata.album || (metadata.mixName ? `${metadata.title} (${metadata.mixName})` : metadata.title),
    genre: metadata.genre || 'Electronic',
    year: metadata.year || new Date().getFullYear().toString(),
    bpm: metadata.bpm ? Math.round(metadata.bpm).toString() : undefined,
    initialKey: camelotKey,
    comment: {
      language: 'eng',
      text: `SoulcraftMusic | BPM: ${metadata.bpm || '-'} | Key: ${camelotKey} | Mood: ${metadata.mood || metadata.genre || '-'}`,
    },
    userDefinedText: [
      { description: 'KEY', value: camelotKey },
      { description: 'INITIALKEY', value: camelotKey },
      { description: 'BPM', value: metadata.bpm ? metadata.bpm.toString() : '' },
      { description: 'MOOD', value: metadata.mood || metadata.genre || '' },
    ],
  };

  // Voeg Album Cover / Artwork toe indien beschikbaar
  if (artworkBuffer) {
    tags.image = {
      mime: artworkBuffer.mime,
      type: {
        id: 3,
        name: 'front cover',
      },
      description: 'Album Art',
      imageBuffer: artworkBuffer.imageBuffer,
    };
  }

  // Schrijf tags atomair naar het MP3 bestand
  const success = NodeID3.write(tags, filePath);
  return !!success;
}
