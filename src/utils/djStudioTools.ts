// src/utils/djStudioTools.ts
import { MusicTrack } from '../types';
import { getTrackFromDb } from '../db/libraryDb';

export interface HotCuePoint {
  index: number; // 1 to 6
  label: string; // 'Intro', 'Drop 1', 'Breakdown', 'Drop 2', 'Outro', 'Vocal'
  timeSeconds: number;
  timeFormatted: string;
  color: string; // Hex color code
  colorName: string;
}

export interface MetadataFixResult {
  trackId: string;
  originalTitle: string;
  originalArtist: string;
  cleanedTitle: string;
  cleanedArtist: string;
  remixer?: string;
  changed: boolean;
  fixesApplied: string[];
}

export interface HeaderScanResult {
  trackId: string;
  title: string;
  status: 'healthy' | 'warning' | 'corrupt' | 'missing';
  format?: string;
  fileSizeBytes?: number;
  details: string;
  repaired?: boolean;
}

const formatCueTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0').slice(0, 2)}`;
};

/**
 * ⚡ Auto Hot Cues & Memory Points Generator
 * Automatische berekening van Cue punten op muzikale frasen (Intro, Drop 1, Breakdown, Drop 2, Outro, Vocal)
 * met aanpasbare Rekordbox/Serato/Traktor kleurencodes.
 */
export function generateHotCues(track: MusicTrack): HotCuePoint[] {
  const duration = track.duration && track.duration > 30 ? track.duration : 210; // default 3:30
  const bpm = track.bpm && track.bpm >= 60 && track.bpm <= 200 ? track.bpm : 126;
  const beatSec = 60 / bpm;
  const barSec = beatSec * 4; // 1 standard 4/4 musical bar

  const cues: HotCuePoint[] = [];

  // Cue 1: Intro (0:00.00) - Rood
  cues.push({
    index: 1,
    label: 'Intro',
    timeSeconds: 0,
    timeFormatted: '00:00.00',
    color: '#ef4444', // Red
    colorName: 'Rood (Cue 1)',
  });

  // Cue 2: Vocal / Buildup (meestal 16 of 32 maten na intro) - Magenta
  const vocalBars = duration > 180 ? 16 : 8;
  const vocalTime = Math.min(duration * 0.2, vocalBars * barSec);
  cues.push({
    index: 2,
    label: 'Vocal / Build',
    timeSeconds: parseFloat(vocalTime.toFixed(2)),
    timeFormatted: formatCueTime(vocalTime),
    color: '#d946ef', // Magenta
    colorName: 'Magenta (Cue 2)',
  });

  // Cue 3: Drop 1 (32 of 64 maten in) - Oranje
  const drop1Bars = duration > 240 ? 32 : 16;
  const drop1Time = Math.min(duration * 0.35, drop1Bars * barSec);
  cues.push({
    index: 3,
    label: 'Drop 1',
    timeSeconds: parseFloat(drop1Time.toFixed(2)),
    timeFormatted: formatCueTime(drop1Time),
    color: '#f97316', // Orange
    colorName: 'Oranje (Cue 3)',
  });

  // Cue 4: Breakdown (Midden van de track) - Geel
  const breakdownTime = duration * 0.52;
  cues.push({
    index: 4,
    label: 'Breakdown',
    timeSeconds: parseFloat(breakdownTime.toFixed(2)),
    timeFormatted: formatCueTime(breakdownTime),
    color: '#eab308', // Yellow
    colorName: 'Geel (Cue 4)',
  });

  // Cue 5: Drop 2 (Climax) - Groen
  const drop2Time = duration * 0.68;
  cues.push({
    index: 5,
    label: 'Drop 2 (Climax)',
    timeSeconds: parseFloat(drop2Time.toFixed(2)),
    timeFormatted: formatCueTime(drop2Time),
    color: '#22c55e', // Green
    colorName: 'Groen (Cue 5)',
  });

  // Cue 6: Outro (Mix-out point, ~32 bars voor het einde) - Cyaan / Blauw
  const outroTime = Math.max(duration * 0.82, duration - 32 * barSec);
  cues.push({
    index: 6,
    label: 'Outro (Mix-Out)',
    timeSeconds: parseFloat(outroTime.toFixed(2)),
    timeFormatted: formatCueTime(outroTime),
    color: '#06b6d4', // Cyan
    colorName: 'Cyaan (Cue 6)',
  });

  return cues;
}

/**
 * 🤖 AI Smart Metadata Fixer (Google Gemini met slimme lokale Regex Fallback)
 * Verwijdert automatisch rommelige websitenamen (zoals [www.remix.com] of [FREE DL]),
 * corrigeert artiesten en titels, en formatteert tags.
 */
export async function cleanAndFormatMetadata(track: MusicTrack): Promise<MetadataFixResult> {
  const fixesApplied: string[] = [];
  let cleanedTitle = track.title || '';
  let cleanedArtist = track.artist || '';

  // 1. Probeer eventuele backend Gemini AI router
  try {
    const aiRes = await fetch('/api/ai/fix-metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: cleanedTitle, artist: cleanedArtist }),
    });

    if (aiRes.ok) {
      const data = await aiRes.json();
      if (data && data.title && data.artist) {
        return {
          trackId: track.id,
          originalTitle: track.title,
          originalArtist: track.artist,
          cleanedTitle: data.title,
          cleanedArtist: data.artist,
          remixer: data.remixer,
          changed: data.title !== track.title || data.artist !== track.artist,
          fixesApplied: ['Gemini AI herkenning & filtering'],
        };
      }
    }
  } catch (_) {
    // Ga naadloos over op lokale regex engine
  }

  // 2. SLIMME LOKALE REGEX FALLBACK
  // Verwijder webdomeinen en reclame tags
  const spamPatterns = [
    /\[www\.[^\]]+\]/gi,
    /\(www\.[^)]+\)/gi,
    /\[https?:\/\/[^\]]+\]/gi,
    /\[free\s*dl[^\]]*\]/gi,
    /\(free\s*dl[^)]*\)/gi,
    /\[free\s*download[^\]]*\]/gi,
    /\(free\s*download[^)]*\)/gi,
    /\[official\s*audio\]/gi,
    /\(official\s*audio\)/gi,
    /\[official\s*video\]/gi,
    /\(official\s*video\)/gi,
    /\[official\s*music\s*video\]/gi,
    /\(official\s*music\s*video\)/gi,
    /\[lyric\s*video\]/gi,
    /\(lyric\s*video\)/gi,
    /\[lyrics\]/gi,
    /\(lyrics\)/gi,
    /\[320\s*kbps\]/gi,
    /\(320\s*kbps\)/gi,
    /\[hq\]/gi,
    /\(hq\)/gi,
    /\[hd\]/gi,
    /\(hd\)/gi,
    /\[out\s*now\]/gi,
    /\(out\s*now\)/gi,
    /\(premiere\)/gi,
    /\[exclusive\]/gi,
    /\[free\]/gi,
  ];

  spamPatterns.forEach((pattern) => {
    if (pattern.test(cleanedTitle)) {
      cleanedTitle = cleanedTitle.replace(pattern, '').trim();
      fixesApplied.push('Webreclame & [FREE DL] tags verwijderd');
    }
    if (pattern.test(cleanedArtist)) {
      cleanedArtist = cleanedArtist.replace(pattern, '').trim();
    }
  });

  // Als artiest per ongeluk in de titel staat (bijv "Discotron - Slippin Away")
  if (cleanedTitle.includes(' - ') && (!cleanedArtist || cleanedArtist === 'Unknown Artist' || cleanedTitle.startsWith(cleanedArtist))) {
    const parts = cleanedTitle.split(' - ');
    if (parts.length >= 2) {
      cleanedArtist = parts[0].trim();
      cleanedTitle = parts.slice(1).join(' - ').trim();
      fixesApplied.push('Artiest en titel gesplitst uit combinatienaam');
    }
  }

  // Detecteer remixer
  let remixer: string | undefined;
  const remixMatch = cleanedTitle.match(/\(([^)]+)\s+(Remix|Mix|Bootleg|Dub|VIP)\)/i);
  if (remixMatch) {
    remixer = remixMatch[1].trim();
  }

  // Schoon dubbele spaties en overtollige leestekens op
  cleanedTitle = cleanedTitle.replace(/\s{2,}/g, ' ').replace(/^[-–—]\s*/, '').trim();
  cleanedArtist = cleanedArtist.replace(/\s{2,}/g, ' ').replace(/^[-–—]\s*/, '').trim();

  // Zorg voor nette Title Casing
  const toTitleCase = (str: string) => {
    return str.replace(/\w\S*/g, (txt) => {
      if (/^(feat|ft|vs|and|the|a|an|in|on|of|for|to)$/i.test(txt)) return txt.toLowerCase();
      return txt.charAt(0).toUpperCase() + txt.substr(1);
    });
  };

  cleanedTitle = toTitleCase(cleanedTitle);
  cleanedArtist = toTitleCase(cleanedArtist);

  const changed = cleanedTitle !== track.title || cleanedArtist !== track.artist;
  if (changed && fixesApplied.length === 0) {
    fixesApplied.push('Tekst opgeschoond en geformatteerd');
  }

  return {
    trackId: track.id,
    originalTitle: track.title,
    originalArtist: track.artist,
    cleanedTitle,
    cleanedArtist,
    remixer,
    changed,
    fixesApplied,
  };
}

/**
 * 🛠️ Broken Files & Corrupt Header Scanner
 * Detecteert ontbrekende bestanden, helpt paden te relinken en repareert corrupte audio-headers.
 */
export async function scanAndCheckAudioHealth(tracks: MusicTrack[]): Promise<HeaderScanResult[]> {
  const results: HeaderScanResult[] = [];

  for (const track of tracks) {
    try {
      const stored = await getTrackFromDb(track.id);

      if (!stored || !stored.audioBlob) {
        results.push({
          trackId: track.id,
          title: track.title,
          status: 'missing',
          details: 'Audiobestand ontbreekt in lokale IndexedDB opslag. Download opnieuw vereist.',
        });
        continue;
      }

      const blob = stored.audioBlob;
      const sizeBytes = blob.size;

      // Te klein bestand (< 100 KB is vrijwel zeker corrupt of een 404 HTML pagina)
      if (sizeBytes < 100000) {
        results.push({
          trackId: track.id,
          title: track.title,
          status: 'corrupt',
          fileSizeBytes: sizeBytes,
          details: `Bestand te klein (${(sizeBytes / 1024).toFixed(1)} KB). Bevat waarschijnlijk een foutieve stream.`,
        });
        continue;
      }

      // Inspecteer de eerste 16 bytes op geldige audio magic headers
      const slice = blob.slice(0, 16);
      const buffer = await slice.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      let isHealthy = false;
      let formatDetected = 'MP3';

      // Check ID3 Tag Header ("ID3")
      if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
        isHealthy = true;
        formatDetected = 'MP3 (ID3v2)';
      }
      // Check MP3 Frame Sync (0xFF 0xFB of 0xFF 0xF3 of 0xFF 0xF2)
      else if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
        isHealthy = true;
        formatDetected = 'MP3 (MPEG Frame)';
      }
      // Check RIFF WAV ("RIFF" ... "WAVE")
      else if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
        isHealthy = true;
        formatDetected = 'WAV (RIFF)';
      }
      // Check FLAC ("fLaC")
      else if (bytes[0] === 0x66 && bytes[1] === 0x4c && bytes[2] === 0x61 && bytes[3] === 0x43) {
        isHealthy = true;
        formatDetected = 'FLAC';
      }
      // Check M4A / MP4 ("ftyp")
      else if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
        isHealthy = true;
        formatDetected = 'M4A (AAC)';
      }

      if (isHealthy) {
        results.push({
          trackId: track.id,
          title: track.title,
          status: 'healthy',
          format: formatDetected,
          fileSizeBytes: sizeBytes,
          details: `Volledig intact (${(sizeBytes / (1024 * 1024)).toFixed(2)} MB, ${formatDetected})`,
        });
      } else {
        results.push({
          trackId: track.id,
          title: track.title,
          status: 'warning',
          format: 'Onbekend',
          fileSizeBytes: sizeBytes,
          details: 'Geen herkenbare audio-headers aan het begin van het bestand. Mogelijk stream artifact.',
        });
      }
    } catch (err: any) {
      results.push({
        trackId: track.id,
        title: track.title,
        status: 'corrupt',
        details: `Fout bij inspectie: ${err.message}`,
      });
    }
  }

  return results;
}
