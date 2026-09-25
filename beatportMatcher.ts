import path from 'node:path';
import { downloadAudioFile, DownloadResult, DownloadProgress, sanitizeWindowsFileName } from './audioDownloader';
// @ts-ignore
import youtubeSrPkg from 'youtube-sr';
const YouTube = (youtubeSrPkg as any).default || youtubeSrPkg;

export interface BeatportMetadata {
  title: string;
  artists: string[];
  remixers?: string[];
  mixName?: string;
  genre?: string;
  bpm?: number;
  key?: string;
  releaseDate?: string;
  label?: string;
  coverUrl?: string;
  durationSec?: number;
}

export interface MatcherDownloadOptions {
  beatportUrl: string;
  destinationDir: string;
  playlistName?: string;
  preferExtendedMix?: boolean;
  onStatusUpdate?: (status: string) => void;
  onProgress?: (progress: DownloadProgress) => void;
  signal?: AbortSignal;
}

/**
 * Scrapes metadata from a Beatport track URL using Next.js data or OpenGraph tags
 */
export async function scrapeBeatportMetadata(beatportUrl: string): Promise<BeatportMetadata> {
  const res = await fetch(beatportUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!res.ok) {
    throw new Error(`Kan Beatport pagina niet ophalen (HTTP ${res.status})`);
  }

  const html = await res.text();

  let title = '';
  let artists: string[] = [];
  let mixName = 'Original Mix';
  let genre: string | undefined;
  let bpm: number | undefined;
  let key: string | undefined;
  let label: string | undefined;
  let coverUrl: string | undefined;
  let releaseDate: string | undefined;

  // 1. Try __NEXT_DATA__
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (nextDataMatch && nextDataMatch[1]) {
    try {
      const nextData = JSON.parse(nextDataMatch[1]);
      const trackData = nextData?.props?.pageProps?.track || nextData?.props?.pageProps?.initialData?.track;
      if (trackData) {
        title = trackData.name || '';
        artists = trackData.artists?.map((a: any) => a.name) || [];
        mixName = trackData.mix_name || trackData.remixers?.length ? 'Extended Mix' : 'Original Mix';
        genre = trackData.genre?.name;
        bpm = trackData.bpm;
        key = trackData.key?.name;
        label = trackData.release?.label?.name || trackData.label?.name;
        coverUrl = trackData.release?.image?.uri || trackData.image?.uri;
        releaseDate = trackData.publish_date || trackData.release_date;
      }
    } catch (_) {}
  }

  // 2. Fallback to OpenGraph / title regex
  if (!title) {
    const ogTitle = html.match(/<meta property="og:title" content="([^"]+)"/i)?.[1];
    if (ogTitle) {
      // Format often: "Track Name - Mix Name by Artist, Artist on Beatport"
      const parts = ogTitle.split(' by ');
      title = parts[0]?.trim() || '';
      if (parts[1]) {
        const artistParts = parts[1].split(' on Beatport')[0];
        artists = artistParts.split(',').map(a => a.trim());
      }
    } else {
      const pageTitle = html.match(/<title>([^<]+)<\/title>/i)?.[1];
      title = pageTitle?.split('|')[0]?.trim() || 'Beatport Track';
    }

    const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/i)?.[1];
    if (ogImage) coverUrl = ogImage;
  }

  if (artists.length === 0) {
    artists = ['Unknown Artist'];
  }

  return {
    title,
    artists,
    mixName,
    genre,
    bpm,
    key,
    label,
    coverUrl,
    releaseDate,
  };
}

/**
 * Searches streaming services for the full track and downloads it
 */
export async function downloadBeatportFullTrack(
  options: MatcherDownloadOptions
): Promise<DownloadResult & { metadata: BeatportMetadata }> {
  const {
    beatportUrl,
    destinationDir,
    playlistName,
    preferExtendedMix = true,
    onStatusUpdate,
    onProgress,
    signal,
  } = options;

  onStatusUpdate?.('Beatport trackpagina analyseren...');
  const metadata = await scrapeBeatportMetadata(beatportUrl);

  const artistStr = metadata.artists.join(', ');
  let searchQuery = `${artistStr} - ${metadata.title}`;
  if (preferExtendedMix && metadata.mixName && !metadata.title.toLowerCase().includes(metadata.mixName.toLowerCase())) {
    searchQuery += ` (${metadata.mixName})`;
  }

  onStatusUpdate?.(`Zoeken naar stream voor: "${searchQuery}"...`);

  // Search YouTube for audio stream match
  let targetAudioUrl: string | null = null;
  try {
    const ytResults = await YouTube.search(searchQuery, { limit: 3, type: 'video' });
    if (ytResults && ytResults.length > 0) {
      const topMatch = ytResults[0];
      targetAudioUrl = `http://localhost:3000/api/stream?url=${encodeURIComponent(topMatch.url)}&title=${encodeURIComponent(searchQuery)}`;
    }
  } catch (err) {
    console.warn('[Beatport Matcher] Direct YouTube search fallback note:', err);
  }

  if (!targetAudioUrl) {
    targetAudioUrl = `http://localhost:3000/api/download?title=${encodeURIComponent(metadata.title)}&artist=${encodeURIComponent(artistStr)}`;
  }

  const rawFilename = `${artistStr} - ${metadata.title}${metadata.mixName ? ` (${metadata.mixName})` : ''}.mp3`;
  const sanitized = sanitizeWindowsFileName(rawFilename);

  onStatusUpdate?.(`Volledige track downloaden: ${sanitized}...`);

  const downloadRes = await downloadAudioFile({
    url: targetAudioUrl,
    destinationDir,
    filename: sanitized,
    playlistName,
    createM3u: true,
    onProgress,
    signal,
  });

  return {
    ...downloadRes,
    metadata,
  };
}
