import { downloadAudioFile, DownloadResult, DownloadOptions, sanitizeWindowsFileName } from './audioDownloader';
import { downloadBeatportFullTrack, MatcherDownloadOptions, BeatportMetadata } from './beatportMatcher';
import path from 'node:path';

export type DetectedLinkType = 'beatport' | 'direct_audio' | 'unknown';

export interface UniversalDownloadOptions {
  inputUrl: string;
  destinationDir?: string;
  playlistName?: string;
  preferExtendedMix?: boolean;
  onStatusUpdate?: (status: string) => void;
  onProgress?: DownloadOptions['onProgress'];
  signal?: AbortSignal;
}

export interface UniversalDownloadResult extends DownloadResult {
  linkType: DetectedLinkType;
  metadata?: BeatportMetadata;
}

/**
 * Analyseert de geplakte URL en bepaalt het bron-type.
 */
export function detectLinkType(url: string): DetectedLinkType {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();

    if (host.includes('beatport.com') && pathname.includes('/track/')) {
      return 'beatport';
    }

    if (pathname.endsWith('.mp3') || pathname.endsWith('.wav') || pathname.endsWith('.flac') || pathname.endsWith('.m4a') || pathname.endsWith('.aac')) {
      return 'direct_audio';
    }

    // Algemene fallback voor directe webstreams
    return 'direct_audio';
  } catch {
    return 'unknown';
  }
}

/**
 * Hoofdfunctie: "Gewoon een link plakken"
 * Ontvangt elke willekeurige link, routeert automatisch naar de juiste download-engine,
 * haalt indien nodig metadata op en slaat het audiobestand georganiseerd op.
 */
export async function downloadFromAnyLink(options: UniversalDownloadOptions): Promise<UniversalDownloadResult> {
  const {
    inputUrl,
    destinationDir = path.join(process.cwd(), 'downloads'),
    playlistName,
    preferExtendedMix = true,
    onStatusUpdate,
    onProgress,
    signal,
  } = options;

  const cleanUrl = inputUrl.trim();
  if (!cleanUrl) {
    throw new Error('Geen geldige URL meegegeven. Voer een link in.');
  }

  const linkType = detectLinkType(cleanUrl);

  if (linkType === 'unknown') {
    throw new Error(`Ongeldig URL-formaat: "${cleanUrl}". Controleer of de link begint met http:// of https://`);
  }

  // 1. ROUTE: Beatport Link
  if (linkType === 'beatport') {
    onStatusUpdate?.('Beatport-link herkend. Track-gegevens en metadata worden opgehaald...');
    
    const result = await downloadBeatportFullTrack({
      beatportUrl: cleanUrl,
      destinationDir,
      playlistName,
      preferExtendedMix,
      onStatusUpdate,
      onProgress,
    });

    return {
      ...result,
      linkType: 'beatport',
    };
  }

  // 2. ROUTE: Direct Audiobestand of algemene audiostream
  onStatusUpdate?.('Directe audiolink herkend. Download wordt gestart via de streaming engine...');

  const result = await downloadAudioFile({
    url: cleanUrl,
    destinationDir,
    playlistName,
    createM3u: true,
    onProgress,
    signal,
  });

  return {
    ...result,
    linkType: 'direct_audio',
  };
}
