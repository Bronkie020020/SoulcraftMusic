// src/utils/audioMetadataScanner.ts
import { SoulcraftTrack } from '../types/track';
import { resolveTrackCover } from './coverHelper';

/**
 * Converteert standaard toonsoorten naar het Camelot Wheel systeem.
 */
export function toCamelot(key?: string): string {
  if (!key) return '8A';
  const clean = key.trim().toLowerCase();

  const map: Record<string, string> = {
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

  for (const [k, code] of Object.entries(map)) {
    if (clean.includes(k)) return `${code} - ${key}`;
  }

  return key;
}

/**
 * Controleert en verrijkt een track met ontbrekende DJ metadata en unieke artwork.
 */
export async function scanAndEnrichTrack(track: SoulcraftTrack): Promise<SoulcraftTrack> {
  const updated = { ...track };

  // 1. Zorg voor een geldige unieke cover
  updated.coverUrl = resolveTrackCover(updated.coverUrl, updated.title, updated.artist);

  // 2. Vul BPM aan indien afwezig
  if (!updated.bpm || updated.bpm === 0) {
    // Schatting of fallback gebaseerd op gemiddelde of audiodata
    updated.bpm = 138;
  }

  // 3. Vul Key / Camelot aan indien afwezig
  if (!updated.camelotKey) {
    updated.camelotKey = updated.key ? toCamelot(updated.key) : '8A - A min';
  }

  // 4. Vul Mood & Genre aan
  if (!updated.genre) {
    updated.genre = 'Club Trance';
  }
  if (!updated.mood) {
    updated.mood = updated.bpm >= 135 ? 'Peak Time / Driving' : 'Melodic / Deep';
  }

  return updated;
}
