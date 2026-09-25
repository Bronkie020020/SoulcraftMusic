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
  maxRetries?: number;
  timeoutMs?: number;
  onProgress?: (progress: DownloadProgress) => void;
  signal?: AbortSignal;
}

export interface DownloadResult {
  filePath: string;
  fileSizeBytes: number;
  durationMs: number;
}

export function sanitizeWindowsFileName(rawName: string): string {
  const base = path.basename(rawName).trim();
  let clean = base.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
  const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i;
  if (reservedNames.test(clean)) {
    clean = `audio_${clean}`;
  }
  clean = clean.replace(/[. ]+$/, '');
  return clean.length > 0 ? clean : `track_${Date.now()}.mp3`;
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
    maxRetries = 3,
    timeoutMs = 45000,
    onProgress,
    signal,
  } = options;

  const startTime = Date.now();

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error(`[Windows Engine] Ongeldige URL: "${url}"`);
  }

  const urlBaseName = path.basename(parsedUrl.pathname);
  const defaultName = urlBaseName && urlBaseName.includes('.') ? urlBaseName : `audio_${Date.now()}.mp3`;
  const resolvedFileName = sanitizeWindowsFileName(filename || defaultName);

  await fs.promises.mkdir(destinationDir, { recursive: true });

  const finalPath = path.resolve(destinationDir, resolvedFileName);
  const partPath = path.resolve(destinationDir, `${resolvedFileName}.part`);

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
          'User-Agent': 'SoulcraftMusic-Downloader/1.2 (Windows NT 10.0; Win64; x64)',
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

      const fileWriteStream = fs.createWriteStream(partPath, { flags: 'w' });
      await pipeline(nodeReadableStream, fileWriteStream);

      if (fs.existsSync(finalPath)) {
        await fs.promises.unlink(finalPath).catch(() => {});
      }

      await fs.promises.rename(partPath, finalPath);

      const stats = await fs.promises.stat(finalPath);

      return {
        filePath: finalPath,
        fileSizeBytes: stats.size,
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (signal) {
        signal.removeEventListener('abort', abortHandler);
      }

      lastError = err;

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
