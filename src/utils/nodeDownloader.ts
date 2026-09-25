import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import * as readline from 'node:readline';

export interface DownloadProgress {
  bytesDownloaded: number;
  totalBytes: number | null;
  percentage: number;
  speedBytesPerSec: number;
  etaSeconds: number | null;
}

export interface DownloadOptions {
  url: string;
  destinationDir: string;
  filename?: string;
  playlistName?: string; // Optionele afspeellijst- of albummap
  createM3u?: boolean;   // Genereert/updatet automatisch een .m3u bestand voor mediaspelers
  maxRetries?: number;
  timeoutMs?: number;
  onProgress?: (progress: DownloadProgress) => void;
  signal?: AbortSignal;
}

export interface DownloadResult {
  filePath: string;
  fileSizeBytes: number;
  durationMs: number;
  playlistPath?: string;
  m3uPath?: string;
}

/**
 * Saniteert bestands- en mapnamen specifiek voor Windows.
 * Voorkomt Path Traversal en Windows Reserved Device Names (CON, PRN, AUX, NUL, COM1-9, LPT1-9).
 */
export function sanitizeWindowsFileName(rawName: string): string {
  const base = path.basename(rawName).trim();
  // Strip ongeldige Windows tekens: < > : " / \ | ? * en control characters
  let clean = base.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');

  // Controleer op Windows gereserveerde apparaatnamen
  const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i;
  if (reservedNames.test(clean)) {
    clean = `audio_${clean}`;
  }

  // Verwijder spaties of punten aan het einde (niet toegestaan in Windows)
  clean = clean.replace(/[. ]+$/, '');

  return clean.length > 0 ? clean : `track_${Date.now()}.mp3`;
}

/**
 * Voegt een track toe aan een .m3u bestand in de playlist-map
 * zodat muziekspelers (zoals VLC of Windows Media Player) de lijst direct herkennen.
 */
async function appendToM3uPlaylist(playlistFolder: string, playlistName: string, audioFileName: string): Promise<string> {
  const m3uFile = path.resolve(playlistFolder, `${playlistName}.m3u`);
  
  if (!fs.existsSync(m3uFile)) {
    await fs.promises.writeFile(m3uFile, '#EXTM3U\n', 'utf-8');
  }

  const existingContent = await fs.promises.readFile(m3uFile, 'utf-8');
  const lines = existingContent.split(/\r?\n/).map(l => l.trim());

  if (!lines.includes(audioFileName)) {
    await fs.promises.appendFile(m3uFile, `${audioFileName}\n`, 'utf-8');
  }

  return m3uFile;
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

export function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`;
}

export function renderProgressBar(percentage: number, length: number = 25): string {
  const safePercentage = Math.min(100, Math.max(0, percentage));
  const filledLength = Math.round((length * safePercentage) / 100);
  const emptyLength = length - filledLength;
  const bar = '█'.repeat(filledLength) + '░'.repeat(emptyLength);
  return `[${bar}] ${safePercentage.toFixed(1)}%`;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function downloadAudioFile(options: DownloadOptions): Promise<DownloadResult> {
  const {
    url,
    destinationDir,
    filename,
    playlistName,
    createM3u = true,
    maxRetries = 3,
    timeoutMs = 45000,
    onProgress,
    signal,
  } = options;

  const startTime = Date.now();

  // Valideer URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error(`[Windows Engine] Ongeldige URL: "${url}"`);
  }

  // Bepaal de effectieve doelmap: hoofdmap of specifieke afspeellijst-submap
  let targetFolder = destinationDir;
  let cleanPlaylistName: string | undefined;

  if (playlistName && playlistName.trim().length > 0) {
    cleanPlaylistName = sanitizeWindowsFileName(playlistName.trim());
    targetFolder = path.resolve(destinationDir, cleanPlaylistName);
  }

  // Zorg dat de doelmap veilig en recursief wordt aangemaakt
  await fs.promises.mkdir(targetFolder, { recursive: true });

  // Bepaal veilige Windows bestandsnaam en doelpad
  const urlBaseName = path.basename(parsedUrl.pathname);
  const defaultName = urlBaseName && urlBaseName.includes('.') ? urlBaseName : `audio_${Date.now()}.mp3`;
  const resolvedFileName = sanitizeWindowsFileName(filename || defaultName);

  const finalPath = path.resolve(targetFolder, resolvedFileName);
  const partPath = path.resolve(targetFolder, `${resolvedFileName}.part`);

  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt < maxRetries) {
    attempt++;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const abortHandler = () => controller.abort();
    if (signal) {
      signal.addEventListener('abort', abortHandler, { once: true });
    }

    try {
      const response = await fetch(parsedUrl.toString(), {
        signal: controller.signal,
        headers: {
          'User-Agent': 'SoulcraftMusic-Downloader/1.3 (Windows NT 10.0; Win64; x64)',
          'Accept': 'audio/*, application/octet-stream, */*',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP Status ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Geen data-stream ontvangen van de audioserver.');
      }

      const contentLengthHeader = response.headers.get('content-length');
      const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : null;

      let bytesDownloaded = 0;
      let lastTime = Date.now();
      let lastBytes = 0;
      let currentSpeed = 0;

      const nodeReadableStream = Readable.fromWeb(response.body as any);

      nodeReadableStream.on('data', (chunk: Buffer) => {
        bytesDownloaded += chunk.length;
        const now = Date.now();
        const elapsed = (now - lastTime) / 1000;

        if (elapsed >= 0.3) {
          currentSpeed = Math.round((bytesDownloaded - lastBytes) / elapsed);
          lastBytes = bytesDownloaded;
          lastTime = now;

          if (onProgress) {
            const percentage = totalBytes ? Math.min(100, (bytesDownloaded / totalBytes) * 100) : 0;
            const remainingBytes = totalBytes ? totalBytes - bytesDownloaded : null;
            const etaSeconds = remainingBytes && currentSpeed > 0 ? Math.round(remainingBytes / currentSpeed) : null;

            onProgress({
              bytesDownloaded,
              totalBytes,
              percentage: Number(percentage.toFixed(2)),
              speedBytesPerSec: currentSpeed,
              etaSeconds,
            });
          }
        }
      });

      // Stream direct naar het tijdelijke bestand
      const fileWriteStream = fs.createWriteStream(partPath, { flags: 'w' });
      await pipeline(nodeReadableStream, fileWriteStream);

      // Verwijder eventueel al bestaand doelbestand (voorkomt Windows lock collisions)
      if (fs.existsSync(finalPath)) {
        await fs.promises.unlink(finalPath).catch(() => {});
      }

      // Atomische hernoeming
      await fs.promises.rename(partPath, finalPath);

      const stats = await fs.promises.stat(finalPath);

      // Optioneel: voeg toe aan .m3u afspeellijst
      let m3uPath: string | undefined;
      if (cleanPlaylistName && createM3u) {
        m3uPath = await appendToM3uPlaylist(targetFolder, cleanPlaylistName, resolvedFileName);
      }

      return {
        filePath: finalPath,
        fileSizeBytes: stats.size,
        durationMs: Date.now() - startTime,
        playlistPath: cleanPlaylistName ? targetFolder : undefined,
        m3uPath,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (signal) {
        signal.removeEventListener('abort', abortHandler);
      }

      lastError = err;

      // Schoon .part bestand op bij fout
      if (fs.existsSync(partPath)) {
        await fs.promises.unlink(partPath).catch(() => {});
      }

      if (signal?.aborted || err.name === 'AbortError') {
        throw new Error('Download geannuleerd of time-out bereikt.');
      }

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        await sleep(delay);
      }
    }
  }

  throw new Error(`Download mislukt na ${maxRetries} pogingen. Reden: ${lastError?.message || 'Onbekende fout'}`);
}

export async function runInteractiveCli() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (query: string): Promise<string> =>
    new Promise((resolve) => rl.question(query, resolve));

  console.log('\n=======================================================');
  console.log('  SoulcraftMusic Downloader - Playlist & Windows Ready  ');
  console.log('=======================================================\n');

  try {
    const inputUrl = (await question('Voer audio URL in: ')).trim();

    if (!inputUrl) {
      console.log('Geen URL ingevoerd. Afgesloten.');
      rl.close();
      return;
    }

    const defaultDir = path.join(process.cwd(), 'downloads');
    const inputDir = (await question(`Hoofdmap [Standaard: ${defaultDir}]: `)).trim();
    const targetDir = inputDir || defaultDir;

    const inputPlaylist = (await question('Afspeellijst / Mapnaam (optioneel, Enter voor losse tracks): ')).trim();

    console.log(`\nDownload gestart...`);
    if (inputPlaylist) {
      console.log(`Doelmap: ${path.join(targetDir, sanitizeWindowsFileName(inputPlaylist))}`);
    } else {
      console.log(`Doelmap: ${targetDir}`);
    }

    const result = await downloadAudioFile({
      url: inputUrl,
      destinationDir: targetDir,
      playlistName: inputPlaylist || undefined,
      createM3u: true,
      onProgress: (p) => {
        const bar = renderProgressBar(p.percentage, 20);
        const downloaded = formatBytes(p.bytesDownloaded);
        const total = p.totalBytes ? formatBytes(p.totalBytes) : 'Onbekend';
        const speed = formatSpeed(p.speedBytesPerSec);
        const eta = p.etaSeconds !== null ? `${p.etaSeconds}s` : '--';

        process.stdout.write(`\r${bar} | ${downloaded} / ${total} | ${speed} | ETA: ${eta}  `);
      },
    });

    console.log('\n\n Download succesvol voltooid!');
    console.log(`- Opgeslagen als: ${result.filePath}`);
    console.log(`- Bestandsgrootte: ${formatBytes(result.fileSizeBytes)}`);
    console.log(`- Duur: ${(result.durationMs / 1000).toFixed(2)} seconden`);
    if (result.m3uPath) {
      console.log(`- Afspeellijst-bestand bijgewerkt: ${result.m3uPath}`);
    }
    console.log('');
  } catch (err: any) {
    console.error(`\n\n Fout opgetreden: ${err.message}\n`);
  } finally {
    rl.close();
  }
}

// Start CLI automatisch bij direct uitvoeren
if (typeof require !== 'undefined' && require.main === module) {
  runInteractiveCli();
} else if (process.argv[1] && (process.argv[1].endsWith('audioDownloader.ts') || process.argv[1].endsWith('nodeDownloader.ts'))) {
  runInteractiveCli();
}
