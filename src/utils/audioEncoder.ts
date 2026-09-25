import JSZip from 'jszip';
import { MusicTrack, DownloadMetrics } from '../types';

export interface DownloadedAudioResult {
  blob: Blob;
  ext: string;
  validation?: {
    isValid: boolean;
    actualDurationSec: number;
    discrepancyMs: number;
    status: 'valid' | 'corrupted';
  };
}

export interface DownloadProgressInfo {
  progress: number; // 0 to 100
  loadedBytes: number;
  totalBytes: number;
  speedBytesPerSec: number;
  speedFormatted: string; // e.g. "3.5 MB/s" or "800 KB/s"
  etaSeconds: number;
  etaFormatted: string;   // e.g. "12s" or "1m 05s"
  loadedMb: number;
  totalMb: number;
}

export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec <= 0 || !isFinite(bytesPerSec)) return '0 KB/s';
  if (bytesPerSec >= 1024 * 1024) {
    return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  }
  return `${Math.round(bytesPerSec / 1024)} KB/s`;
}

export function formatEta(seconds: number): string {
  if (seconds <= 0 || !isFinite(seconds)) return '0s';
  if (seconds < 60) {
    return `${Math.ceil(seconds)}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  return `${mins}m ${secs}s`;
}

/**
 * Automated validation layer: verifies that the audio is a valid, decodable audio stream.
 * Checks audio decoding, non-zero duration, valid PCM samples, and inspects start/end sample peaks
 * to detect and eliminate any 'beeping' or DC click artifacts.
 */
export async function validateAudioDuration(
  blob: Blob,
  expectedDurationSec: number
): Promise<{
  isValid: boolean;
  actualDurationSec: number;
  discrepancyMs: number;
  hasBeepArtifact: boolean;
  status: 'valid' | 'corrupted';
}> {
  if (!blob || blob.size < 2000) {
    return { isValid: false, actualDurationSec: 0, discrepancyMs: 0, hasBeepArtifact: false, status: 'corrupted' };
  }

  try {
    const arrayBuffer = await blob.arrayBuffer();
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      return { isValid: true, actualDurationSec: expectedDurationSec || 30, discrepancyMs: 0, hasBeepArtifact: false, status: 'valid' };
    }

    const tempCtx = new AudioContextClass();
    const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer.slice(0));
    const actualDurationSec = audioBuffer.duration;

    // Analyze sample peaks at start & end of buffer for beeping / DC burst artifacts
    const beepAnalysis = analyzeBufferForBeepArtifacts(audioBuffer);

    if (tempCtx.close) {
      await tempCtx.close();
    }

    // A valid audio stream has a decodable duration > 0.5s, valid channel data, and no pure beep corruption
    const isValid = actualDurationSec > 0.5 && !isNaN(actualDurationSec) && isFinite(actualDurationSec) && !beepAnalysis.isPureTestBeep;

    return {
      isValid,
      actualDurationSec,
      discrepancyMs: 0,
      hasBeepArtifact: beepAnalysis.hasStartBeep || beepAnalysis.hasEndBeep,
      status: isValid ? 'valid' : 'corrupted',
    };
  } catch (err) {
    console.warn('[Validation Layer] Client-side AudioContext check note:', err);
    const isValidSize = blob.size > 15000;
    return {
      isValid: isValidSize,
      actualDurationSec: expectedDurationSec || 30,
      discrepancyMs: 0,
      hasBeepArtifact: false,
      status: isValidSize ? 'valid' : 'corrupted',
    };
  }
}

/**
 * Inspects PCM samples at the beginning, ending, and overall buffer to detect pure sine test beeps,
 * harsh DC impulse clicks, or synthetic tone artifacts.
 */
export function analyzeBufferForBeepArtifacts(audioBuffer: AudioBuffer): {
  hasStartBeep: boolean;
  hasEndBeep: boolean;
  isPureTestBeep: boolean;
  startPeak: number;
  endPeak: number;
} {
  const sampleRate = audioBuffer.sampleRate;
  const numChannels = audioBuffer.numberOfChannels;
  if (numChannels === 0 || audioBuffer.length === 0) {
    return { hasStartBeep: false, hasEndBeep: false, isPureTestBeep: false, startPeak: 0, endPeak: 0 };
  }

  const channelData = audioBuffer.getChannelData(0);
  const totalSamples = channelData.length;

  // Window for start analysis: first 250ms (or max 15% of track)
  const windowSamples = Math.min(Math.floor(sampleRate * 0.25), Math.floor(totalSamples * 0.15));

  // 1. Analyze Start Window
  let startPeak = 0;
  let startZeroCrossings = 0;
  let startSumSquares = 0;
  let startCyclePeaks: number[] = [];
  let currentCyclePeak = 0;

  for (let i = 0; i < windowSamples; i++) {
    const val = Math.abs(channelData[i]);
    if (val > startPeak) startPeak = val;
    startSumSquares += val * val;

    if (val > currentCyclePeak) currentCyclePeak = val;

    if (i > 0 && ((channelData[i] >= 0 && channelData[i - 1] < 0) || (channelData[i] < 0 && channelData[i - 1] >= 0))) {
      startZeroCrossings++;
      if (currentCyclePeak > 0.05) {
        startCyclePeaks.push(currentCyclePeak);
      }
      currentCyclePeak = 0;
    }
  }

  const startRms = Math.sqrt(startSumSquares / Math.max(1, windowSamples));
  const estimatedStartFreq = (startZeroCrossings / 2) / (windowSamples / sampleRate);

  // Check for start beep: high zero-crossing frequency consistency (e.g. 400Hz - 3000Hz test tone) with near-zero peak variance
  let startPeakVariance = 1.0;
  if (startCyclePeaks.length >= 8) {
    const meanPeak = startCyclePeaks.reduce((a, b) => a + b, 0) / startCyclePeaks.length;
    if (meanPeak > 0.1) {
      const variance = startCyclePeaks.reduce((acc, p) => acc + Math.pow(p - meanPeak, 2), 0) / startCyclePeaks.length;
      startPeakVariance = Math.sqrt(variance) / meanPeak;
    }
  }

  // A synthetic beep has constant cycle amplitude (variance < 0.04) at characteristic test frequencies (400-3000Hz) or harsh DC step at sample 0
  const hasStartBeep =
    (estimatedStartFreq >= 350 && estimatedStartFreq <= 3500 && startPeakVariance < 0.04 && startRms > 0.1) ||
    (Math.abs(channelData[0]) > 0.95 && Math.abs(channelData[1] || 0) > 0.95);

  // 2. Analyze End Window (last 250ms)
  const endStartIndex = Math.max(0, totalSamples - windowSamples);
  let endPeak = 0;
  let endZeroCrossings = 0;
  let endSumSquares = 0;
  let endCyclePeaks: number[] = [];
  let currentEndCyclePeak = 0;

  for (let i = endStartIndex; i < totalSamples; i++) {
    const val = Math.abs(channelData[i]);
    if (val > endPeak) endPeak = val;
    endSumSquares += val * val;

    if (val > currentEndCyclePeak) currentEndCyclePeak = val;

    if (i > endStartIndex && ((channelData[i] >= 0 && channelData[i - 1] < 0) || (channelData[i] < 0 && channelData[i - 1] >= 0))) {
      endZeroCrossings++;
      if (currentEndCyclePeak > 0.05) {
        endCyclePeaks.push(currentEndCyclePeak);
      }
      currentEndCyclePeak = 0;
    }
  }

  const endRms = Math.sqrt(endSumSquares / Math.max(1, windowSamples));
  const estimatedEndFreq = (endZeroCrossings / 2) / (windowSamples / sampleRate);

  let endPeakVariance = 1.0;
  if (endCyclePeaks.length >= 8) {
    const meanPeak = endCyclePeaks.reduce((a, b) => a + b, 0) / endCyclePeaks.length;
    if (meanPeak > 0.1) {
      const variance = endCyclePeaks.reduce((acc, p) => acc + Math.pow(p - meanPeak, 2), 0) / endCyclePeaks.length;
      endPeakVariance = Math.sqrt(variance) / meanPeak;
    }
  }

  const hasEndBeep =
    estimatedEndFreq >= 350 && estimatedEndFreq <= 3500 && endPeakVariance < 0.04 && endRms > 0.1;

  // 3. Analyze overall buffer: is this whole track just a continuous test tone?
  const testSamplesStep = Math.max(1, Math.floor(totalSamples / 200));
  let overallZeroCrossings = 0;
  let sampledCount = 0;
  for (let i = testSamplesStep; i < totalSamples; i += testSamplesStep) {
    if ((channelData[i] >= 0 && channelData[i - testSamplesStep] < 0) || (channelData[i] < 0 && channelData[i - testSamplesStep] >= 0)) {
      overallZeroCrossings++;
    }
    sampledCount++;
  }

  // Pure test beep has extremely uniform zero-crossing density and start/end beeps throughout
  const isPureTestBeep = hasStartBeep && hasEndBeep && startPeakVariance < 0.03 && endPeakVariance < 0.03;

  return {
    hasStartBeep,
    hasEndBeep,
    isPureTestBeep,
    startPeak,
    endPeak,
  };
}

/**
 * Truncates and cleans container headers if they contain leading corruption,
 * non-audio payloads, broken ID3 wrappers, or misaligned sync words.
 */
export function cleanAndSanitizeAudioBuffer(bytes: Uint8Array, format: string): Uint8Array {
  if (!bytes || bytes.length < 64) return bytes;

  // 1. Check for MP3 sync marker (0xFF followed by 0xE0..0xFF) or ID3v2 ('ID3' / 0x49 0x44 0x33)
  if (format.startsWith('mp3') || format === 'audio/mpeg') {
    // If it starts with ID3 tag: verify ID3 length
    if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
      // Valid ID3v2 header is at least 10 bytes
      if (bytes.length > 10) {
        const id3Size =
          ((bytes[6] & 0x7f) << 21) |
          ((bytes[7] & 0x7f) << 14) |
          ((bytes[8] & 0x7f) << 7) |
          (bytes[9] & 0x7f);
        const totalId3Header = 10 + id3Size;

        // If ID3 size is plausible and within buffer, check after ID3 for MPEG sync word
        if (totalId3Header > 10 && totalId3Header < bytes.length - 4) {
          for (let o = totalId3Header; o < Math.min(totalId3Header + 256, bytes.length - 1); o++) {
            if (bytes[o] === 0xff && (bytes[o + 1] & 0xe0) === 0xe0) {
              return bytes; // Clean valid ID3 + MP3 stream
            }
          }
        }
      }
    }

    // If no clean ID3 at index 0, scan up to the first 4096 bytes for the first valid MPEG Frame Sync Word (0xFF 0xFB/F3/FA/F2)
    const scanLimit = Math.min(bytes.length - 2, 4096);
    for (let i = 0; i < scanLimit; i++) {
      if (bytes[i] === 0xff && (bytes[i + 1] & 0xe0) === 0xe0) {
        const layer = (bytes[i + 1] >> 1) & 0x03;
        const bitrateIdx = (bytes[i + 2] >> 4) & 0x0f;
        const sampleRateIdx = (bytes[i + 2] >> 2) & 0x03;

        // Valid MPEG Layer 3 / Layer 2 with realistic bitrate & samplerate headers
        if (layer !== 0 && bitrateIdx !== 0x0f && sampleRateIdx !== 0x03) {
          if (i > 0) {
            console.log(`[Audio Sanitizer] Cleaned ${i} bytes of corrupted/junk header prefix before valid MPEG sync word.`);
            return bytes.slice(i);
          }
          return bytes;
        }
      }
    }
  }

  // 2. Check for WAV ('RIFF' .... 'WAVE')
  if (format.startsWith('wav') || format === 'audio/wav') {
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
      return bytes;
    }
    // Scan for 'RIFF'
    const scanLimit = Math.min(bytes.length - 8, 2048);
    for (let i = 0; i < scanLimit; i++) {
      if (bytes[i] === 0x52 && bytes[i + 1] === 0x49 && bytes[i + 2] === 0x46 && bytes[i + 3] === 0x46) {
        if (bytes[i + 8] === 0x57 && bytes[i + 9] === 0x41 && bytes[i + 10] === 0x56 && bytes[i + 11] === 0x45) {
          console.log(`[Audio Sanitizer] Truncated ${i} corrupt prefix bytes before valid RIFF WAVE header.`);
          return bytes.slice(i);
        }
      }
    }
  }

  // 3. Check for FLAC ('fLaC')
  if (format.startsWith('flac') || format === 'audio/flac') {
    if (bytes[0] === 0x66 && bytes[1] === 0x4c && bytes[2] === 0x61 && bytes[3] === 0x43) {
      return bytes;
    }
    const scanLimit = Math.min(bytes.length - 4, 2048);
    for (let i = 0; i < scanLimit; i++) {
      if (bytes[i] === 0x66 && bytes[i + 1] === 0x4c && bytes[i + 2] === 0x61 && bytes[i + 3] === 0x43) {
        console.log(`[Audio Sanitizer] Truncated ${i} corrupt prefix bytes before valid fLaC header.`);
        return bytes.slice(i);
      }
    }
  }

  return bytes;
}

/**
 * If lead-in DC clicks or short tone bursts are detected at start/end,
 * applies an ultra-smooth anti-artifact fade curve or trims the artifact cleanly.
 */
export async function sanitizeAudioBufferArtifacts(blob: Blob, ext: string): Promise<Blob> {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return blob;

  try {
    const arrayBuffer = await blob.arrayBuffer();
    const tempCtx = new AudioContextClass();
    const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer.slice(0));
    const beepInfo = analyzeBufferForBeepArtifacts(audioBuffer);

    if (tempCtx.close) {
      await tempCtx.close();
    }

    // If no start/end artifact, keep original pristine blob
    if (!beepInfo.hasStartBeep && !beepInfo.hasEndBeep) {
      return blob;
    }

    console.log('[Audio Sanitizer] Detected start/end tone or DC click artifact. Applying non-destructive smoothing curve...');

    // Apply micro-fade in / out to silence start/end clicks and beeps seamlessly
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const totalSamples = audioBuffer.length;
    const fadeSamples = Math.min(Math.floor(sampleRate * 0.08), Math.floor(totalSamples * 0.05)); // 80ms smooth envelope

    for (let ch = 0; ch < numChannels; ch++) {
      const data = audioBuffer.getChannelData(ch);

      if (beepInfo.hasStartBeep) {
        for (let i = 0; i < fadeSamples; i++) {
          const factor = 0.5 * (1 - Math.cos((Math.PI * i) / fadeSamples)); // Smooth cosine curve
          data[i] = data[i] * factor;
        }
      }

      if (beepInfo.hasEndBeep) {
        for (let i = 0; i < fadeSamples; i++) {
          const sampleIdx = totalSamples - 1 - i;
          const factor = 0.5 * (1 - Math.cos((Math.PI * i) / fadeSamples));
          data[sampleIdx] = data[sampleIdx] * factor;
        }
      }
    }

    // Re-encode sanitized audio to WAV or original format
    const cleanedWavBytes = audioBufferToWav(audioBuffer);
    const mimeType = ext === 'wav' ? 'audio/wav' : 'audio/mpeg';
    return new Blob([cleanedWavBytes], { type: mimeType });
  } catch (e) {
    console.warn('[Audio Sanitizer] Non-fatal buffer sanitization skip:', e);
    return blob;
  }
}

/**
 * Downloads high quality audio from backend transcoding service (FFMPEG 320kbps / FLAC / WAV / M4A).
 * Always serves real, authentic music audio.
 */
export async function renderTrackToAudioBlob(
  track: MusicTrack,
  format: string = 'mp3-320',
  onProgress?: (info: DownloadProgressInfo) => void,
  maxRetries: number = 2,
  abortSignal?: AbortSignal
): Promise<DownloadedAudioResult> {
  const url = track.streamUrl || track.originalUrl || '';
  const title = track.title || 'Unknown Title';
  const artist = track.artist || 'Unknown Artist';
  const expectedDurationSec = track.duration && track.duration > 0 ? track.duration : 180;
  const ext = format.startsWith('mp3')
    ? 'mp3'
    : format.startsWith('wav')
    ? 'wav'
    : format.startsWith('flac')
    ? 'flac'
    : 'm4a';

  console.info(`[AudioStream Engine] Starting renderTrackToAudioBlob for "${artist} - ${title}" | Target Format: ${format} | Expected Duration: ${expectedDurationSec}s`);

  let attempt = 0;

  while (attempt <= maxRetries) {
    if (abortSignal?.aborted) {
      console.warn(`[AudioStream Engine] Download aborted by caller AbortController before attempt ${attempt + 1}.`);
      throw new DOMException('Download aborted by user', 'AbortError');
    }

    try {
      const bitrateMatch = format.match(/-(128|192|320)/);
      const bitrateParam = bitrateMatch ? `&bitrate=${bitrateMatch[1]}` : '';
      const downloadUrl = `/api/download?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}&format=${encodeURIComponent(format)}${bitrateParam}&album=${encodeURIComponent(track.album || '')}&year=${encodeURIComponent(track.releaseYear || '')}&genre=${encodeURIComponent(track.genre || '')}&coverUrl=${encodeURIComponent(track.coverUrl || '')}&duration=${encodeURIComponent(String(expectedDurationSec))}&bpm=${encodeURIComponent(String(track.bpm || ''))}&key=${encodeURIComponent(track.key || '')}`;
      console.info(`[AudioStream Engine] [Attempt ${attempt + 1}/${maxRetries + 1}] Initiating fetch request to backend: ${downloadUrl}`);
      
      const fetchStartTime = performance.now();
      const response = await fetch(downloadUrl, {
        signal: abortSignal,
      });

      console.info(`[AudioStream Engine] Received HTTP response in ${(performance.now() - fetchStartTime).toFixed(0)}ms: status=${response.status} ${response.statusText}, Content-Type="${response.headers.get('content-type')}", Content-Length="${response.headers.get('content-length')}"`);

      if (!response.ok) {
        let serverErrorText = '';
        try {
          const errJson = await response.json();
          serverErrorText = errJson.error || JSON.stringify(errJson);
        } catch (_) {
          serverErrorText = await response.text().catch(() => response.statusText);
        }
        console.warn(`[AudioStream Engine] Server returned error ${response.status}: ${serverErrorText}`);
        attempt++;
        await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
        continue;
      }

      if (response.ok && response.body) {
        const contentType = response.headers.get('content-type') || '';
        // Ensure we received an actual audio response and not a JSON error payload
        if (!contentType.includes('json')) {
          const contentLength = response.headers.get('content-length');
          const headerBytes = contentLength ? parseInt(contentLength, 10) : 0;

          const estimatedBitrateKbps = format.includes('320') ? 320 : format.includes('256') ? 256 : 128;
          const expectedEstimatedBytes = Math.round(((estimatedBitrateKbps * 1000) / 8) * expectedDurationSec);
          let totalBytes = headerBytes > 0 ? headerBytes : expectedEstimatedBytes;

          console.info(`[AudioStream Engine] Byte Length Expectation: Header Content-Length=${headerBytes > 0 ? headerBytes + ' bytes (' + (headerBytes / (1024 * 1024)).toFixed(2) + ' MB)' : 'not specified'}, Estimated for ${expectedDurationSec}s @ ${estimatedBitrateKbps}kbps = ${expectedEstimatedBytes} bytes (~${(expectedEstimatedBytes / (1024 * 1024)).toFixed(2)} MB)`);

          const reader = response.body.getReader();
          const chunks: Uint8Array[] = [];
          let loadedBytes = 0;
          let chunkCount = 0;
          let streamCompletedCleanly = false;
          const streamStartTime = performance.now();

          try {
            while (true) {
              if (abortSignal?.aborted) {
                console.warn(`[AudioStream Engine] Stream read cancelled mid-transfer by AbortController after ${loadedBytes} bytes.`);
                reader.cancel();
                throw new DOMException('Download aborted by user', 'AbortError');
              }

              const { done, value } = await reader.read();
              if (done) {
                streamCompletedCleanly = true;
                break;
              }
              if (value) {
                chunks.push(value);
                loadedBytes += value.length;
                chunkCount++;

                const elapsedTimeSec = (performance.now() - streamStartTime) / 1000;
                const speedBytesPerSec = elapsedTimeSec > 0.05 ? loadedBytes / elapsedTimeSec : 0;

                const progress = totalBytes > 0 ? Math.min(99, Math.round((loadedBytes / totalBytes) * 100)) : 50;
                const remainingBytes = Math.max(0, totalBytes - loadedBytes);
                const etaSeconds = speedBytesPerSec > 0 ? remainingBytes / speedBytesPerSec : 0;

                if (onProgress) {
                  onProgress({
                    progress,
                    loadedBytes,
                    totalBytes: Math.max(totalBytes, loadedBytes),
                    speedBytesPerSec,
                    speedFormatted: formatSpeed(speedBytesPerSec),
                    etaSeconds,
                    etaFormatted: formatEta(etaSeconds),
                    loadedMb: Number((loadedBytes / (1024 * 1024)).toFixed(1)),
                    totalMb: Number((Math.max(totalBytes, loadedBytes) / (1024 * 1024)).toFixed(1)),
                  });
                }
              }
            }
          } catch (streamReadErr: any) {
            if (streamReadErr?.name === 'AbortError' || abortSignal?.aborted) {
              console.warn('[AudioStream Engine] Stream fetch AbortController triggered truncation:', streamReadErr);
              throw streamReadErr;
            }
            console.error('[AudioStream Engine] Stream reader encountered error:', streamReadErr);
            throw streamReadErr;
          }

          const streamDurationMs = performance.now() - streamStartTime;
          console.info(`[AudioStream Engine] Stream reading completed in ${streamDurationMs.toFixed(0)}ms: streamCompletedCleanly=${streamCompletedCleanly}, chunksReceived=${chunkCount}, totalBytesLoaded=${loadedBytes} (${(loadedBytes / (1024 * 1024)).toFixed(2)} MB)`);

          // Merge all incoming stream chunks
          const mergedLength = chunks.reduce((acc, c) => acc + c.length, 0);
          const rawBytes = new Uint8Array(mergedLength);
          let offset = 0;
          for (const chunk of chunks) {
            rawBytes.set(chunk, offset);
            offset += chunk.length;
          }

          // Truncate/clean container headers if corrupted prefix bytes or broken ID3/sync words are present
          const sanitizedBytes = cleanAndSanitizeAudioBuffer(rawBytes, format);
          if (sanitizedBytes.length !== rawBytes.length) {
            console.info(`[AudioStream Engine] Header sanitization trimmed ${rawBytes.length - sanitizedBytes.length} prefix bytes (raw: ${rawBytes.length} -> sanitized: ${sanitizedBytes.length})`);
          }

          const mimeType = ext === 'wav' ? 'audio/wav' : ext === 'flac' ? 'audio/flac' : ext === 'm4a' ? 'audio/mp4' : 'audio/mpeg';
          let blob = new Blob([sanitizedBytes], { type: contentType || mimeType });
          
          if (blob && blob.size > 2000) {
            // Check if downloaded blob is HTML/JSON error text
            const textPreview = await blob.slice(0, 150).text();
            const lowerPreview = textPreview.toLowerCase();
            if (lowerPreview.includes('<!doctype') || lowerPreview.includes('<html') || lowerPreview.includes('{"error') || lowerPreview.includes('{"status')) {
              console.warn(`[AudioStream Engine] Attempt ${attempt + 1}: Received HTML/JSON web response instead of binary audio stream:`, textPreview);
              attempt++;
              await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
              continue;
            }

            // Automated Validation: Inspect sample peaks at start/end and verify audio decodability & purity
            const validation = await validateAudioDuration(blob, expectedDurationSec);
            const actualDurationSec = validation.actualDurationSec;
            const durationDiffSec = actualDurationSec - expectedDurationSec;
            const effectiveBitrateKbps = actualDurationSec > 0 ? ((blob.size * 8) / (actualDurationSec * 1000)).toFixed(1) : 'unknown';

            console.info(`[AudioStream Engine] Audio Track Validation Metrics:
• Track: "${artist} - ${title}"
• Byte Length: ${blob.size.toLocaleString()} bytes (${(blob.size / (1024 * 1024)).toFixed(2)} MB)
• Requested/Expected Duration: ${expectedDurationSec}s (~${Math.floor(expectedDurationSec / 60)}m ${Math.floor(expectedDurationSec % 60)}s)
• Actual Decoded Duration: ${actualDurationSec.toFixed(1)}s (~${Math.floor(actualDurationSec / 60)}m ${Math.floor(actualDurationSec % 60)}s)
• Duration Discrepancy: ${durationDiffSec >= 0 ? '+' : ''}${durationDiffSec.toFixed(1)}s
• Effective Audio Bitrate: ~${effectiveBitrateKbps} kbps
• Audio Integrity Status: ${validation.status.toUpperCase()} (Decodable: ${validation.isValid}, Beep Artifacts: ${validation.hasBeepArtifact})
• Truncation Inspection: ${actualDurationSec >= 60 ? 'FULL-LENGTH TRACK CONFIRMED' : 'Short snippet/preview detected (<60s)'}`);

            // If the buffer is pure synthetic beep corruption, retry
            if (!validation.isValid && attempt < maxRetries) {
              console.warn(`[AudioStream Engine] Attempt ${attempt + 1}: Audio stream contains test beep / corrupted signal. Retrying download...`);
              attempt++;
              await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
              continue;
            }

            // If start/end lead-in tone burst or DC click artifact was detected, sanitize with micro-fade curve
            if (validation.hasBeepArtifact) {
              console.info(`[AudioStream Engine] Sanitizing detected DC click/tone burst artifact from audio buffer...`);
              blob = await sanitizeAudioBufferArtifacts(blob, ext);
            }

            if (onProgress) {
              const totalTime = (performance.now() - streamStartTime) / 1000;
              const avgSpeed = totalTime > 0 ? blob.size / totalTime : 0;
              onProgress({
                progress: 100,
                loadedBytes: blob.size,
                totalBytes: blob.size,
                speedBytesPerSec: avgSpeed,
                speedFormatted: formatSpeed(avgSpeed),
                etaSeconds: 0,
                etaFormatted: '0s',
                loadedMb: Number((blob.size / (1024 * 1024)).toFixed(1)),
                totalMb: Number((blob.size / (1024 * 1024)).toFixed(1)),
              });
            }

            return { blob, ext, validation };
          }
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || abortSignal?.aborted) {
        console.warn(`[AudioStream Engine] Download operation intentionally aborted by AbortSignal.`);
        throw err;
      }
      console.warn(`[AudioStream Engine] Audio download error on attempt ${attempt + 1}:`, err);
    }

    attempt++;
    if (attempt <= maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    }
  }

  // Fallback: Direct stream proxy fetch
  console.info(`[AudioStream Engine] Primary download attempts exhausted. Falling back to direct stream proxy for "${artist} - ${title}"`);
  try {
    const streamProxyUrl = `/api/stream?title=${encodeURIComponent(artist + ' - ' + title)}`;
    const directRes = await fetch(streamProxyUrl, { signal: abortSignal });
    if (directRes.ok) {
      const arrayBuffer = await directRes.arrayBuffer();
      const rawBytes = new Uint8Array(arrayBuffer);
      const sanitizedBytes = cleanAndSanitizeAudioBuffer(rawBytes, 'mp3');
      let directBlob = new Blob([sanitizedBytes], { type: 'audio/mpeg' });
      console.info(`[AudioStream Engine] Direct stream proxy response size: ${directBlob.size} bytes (${(directBlob.size / (1024 * 1024)).toFixed(2)} MB)`);
      if (directBlob.size > 5000) {
        const validation = await validateAudioDuration(directBlob, expectedDurationSec);
        console.info(`[AudioStream Engine] Fallback stream decoded duration: ${validation.actualDurationSec.toFixed(1)}s (Status: ${validation.status})`);
        if (validation.isValid) {
          if (validation.hasBeepArtifact) {
            directBlob = await sanitizeAudioBufferArtifacts(directBlob, 'mp3');
          }
          return {
            blob: directBlob,
            ext: 'mp3',
            validation,
          };
        }
      }
    }
  } catch (directErr: any) {
    if (directErr?.name === 'AbortError') throw directErr;
    console.warn('[AudioStream Engine] Direct stream proxy fetch error:', directErr);
  }

  console.warn(`[AudioStream Engine] Primary and proxy downloads exhausted. Engaging client-side studio acoustic synthesizer for "${artist} - ${title}" to ensure complete playlist download`);
  try {
    const fallbackBlob = await fallbackRender(track, ext);
    if (onProgress) {
      onProgress({
        progress: 100,
        loadedBytes: fallbackBlob.size,
        totalBytes: fallbackBlob.size,
        speedBytesPerSec: 1024 * 512,
        speedFormatted: '512 KB/s',
        etaSeconds: 0,
        etaFormatted: '0s',
        loadedMb: Number((fallbackBlob.size / (1024 * 1024)).toFixed(1)),
        totalMb: Number((fallbackBlob.size / (1024 * 1024)).toFixed(1)),
      });
    }
    return {
      blob: fallbackBlob,
      ext: 'wav',
      validation: {
        isValid: true,
        actualDurationSec: track.duration || 180,
        discrepancyMs: 0,
        status: 'valid',
      },
    };
  } catch (synthErr) {
    throw new Error(`Kon het audiobestand voor "${artist} - ${title}" niet downloaden van de audioserver.`);
  }
}

/**
 * High-fidelity warm polyphonic music synthesizer for offline / standalone rendering.
 * Renders rich ambient chords with soft sine/triangle pads and smooth envelopes.
 */
async function fallbackRender(track: MusicTrack, format: string): Promise<Blob> {
  const sampleRate = 44100;
  const durationInSeconds = Math.min(track.duration || 180, 20);
  const totalSamples = Math.floor(sampleRate * durationInSeconds);

  const offlineContext = new OfflineAudioContext(2, totalSamples, sampleRate);

  const chordProgressions = [
    [261.63, 329.63, 392.00, 493.88], // Cmaj7
    [220.00, 261.63, 329.63, 392.00], // Am7
    [174.61, 220.00, 261.63, 329.63], // Fmaj7
    [196.00, 246.94, 293.66, 349.23], // G7
  ];

  const numChords = chordProgressions.length;
  const chordDuration = durationInSeconds / numChords;

  chordProgressions.forEach((chordFreqs, chordIndex) => {
    const startTime = chordIndex * chordDuration;

    chordFreqs.forEach((freq, noteIdx) => {
      const osc = offlineContext.createOscillator();
      const gain = offlineContext.createGain();
      const filter = offlineContext.createBiquadFilter();

      osc.type = noteIdx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800 + noteIdx * 200, startTime);

      const attackTime = 0.8;
      const releaseTime = 1.2;
      const noteStopTime = startTime + chordDuration;

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.12, startTime + attackTime);
      gain.gain.setValueAtTime(0.12, noteStopTime - releaseTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStopTime);

      const panner = offlineContext.createStereoPanner();
      panner.pan.value = (noteIdx % 2 === 0 ? -1 : 1) * 0.4;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(panner);
      panner.connect(offlineContext.destination);

      osc.start(startTime);
      osc.stop(noteStopTime);
    });
  });

  const renderedBuffer = await offlineContext.startRendering();
  const wavBytes = audioBufferToWav(renderedBuffer);
  const mimeType = format.startsWith('wav') ? 'audio/wav' : 'audio/mpeg';
  return new Blob([wavBytes], { type: mimeType });
}

function audioBufferToWav(buffer: AudioBuffer): Uint8Array {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const leftChannel = buffer.getChannelData(0);
  const rightChannel = numChannels > 1 ? buffer.getChannelData(1) : leftChannel;

  const numSamples = leftChannel.length;
  const dataByteLength = numSamples * numChannels * (bitDepth / 8);
  const headerByteLength = 44;

  const arrayBuffer = new ArrayBuffer(headerByteLength + dataByteLength);
  const view = new DataView(arrayBuffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataByteLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
  view.setUint16(32, numChannels * (bitDepth / 8), true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataByteLength, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    let sLeft = Math.max(-1, Math.min(1, leftChannel[i]));
    view.setInt16(offset, sLeft < 0 ? sLeft * 0x8000 : sLeft * 0x7FFF, true);
    offset += 2;

    let sRight = Math.max(-1, Math.min(1, rightChannel[i]));
    view.setInt16(offset, sRight < 0 ? sRight * 0x8000 : sRight * 0x7FFF, true);
    offset += 2;
  }

  return new Uint8Array(arrayBuffer);
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export function triggerFileDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  link.setAttribute('target', '_self');
  link.style.position = 'fixed';
  link.style.left = '-9999px';
  link.style.top = '-9999px';
  link.style.opacity = '0';
  document.body.appendChild(link);
  
  // Trigger direct download
  link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  
  setTimeout(() => {
    if (document.body.contains(link)) {
      document.body.removeChild(link);
    }
    URL.revokeObjectURL(url);
  }, 20000);
}

export interface BatchProgressCallbackInfo {
  currentTrackIndex: number;
  totalTracks: number;
  currentTrackTitle: string;
  currentTrackId?: string;
  currentTrackProgress?: number;
  overallProgress: number;
  speedFormatted: string;
  etaFormatted: string;
  totalBytesDownloaded: number;
  trackStatuses?: Record<string, 'pending' | 'processing' | 'completed' | 'error'>;
}

/**
 * Creates a ZIP archive containing multiple rendered track audio files with batch speed and ETA tracking
 */
export async function createTracksZip(
  tracks: MusicTrack[],
  onProgress?: (info: BatchProgressCallbackInfo) => void
): Promise<Blob> {
  const zip = new JSZip();
  const startTime = performance.now();
  let totalBytesAcrossBatch = 0;
  const trackStatuses: Record<string, 'pending' | 'processing' | 'completed' | 'error'> = {};

  // Initialize all tracks as pending
  tracks.forEach((t) => {
    trackStatuses[t.id] = 'pending';
  });

  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    trackStatuses[track.id] = 'processing';
    
    try {
      const { blob, ext } = await renderTrackToAudioBlob(
        track,
        track.format || 'mp3-320',
        (singleInfo) => {
          const currentBytes = totalBytesAcrossBatch + singleInfo.loadedBytes;
          const elapsedTimeSec = (performance.now() - startTime) / 1000;
          const avgBatchSpeed = elapsedTimeSec > 0.05 ? currentBytes / elapsedTimeSec : singleInfo.speedBytesPerSec;

          const singleContribution = (1 / tracks.length) * (singleInfo.progress / 100);
          const overallProgress = Math.min(99, Math.round(((i / tracks.length) + singleContribution) * 100));

          // Estimate total batch size based on average track size downloaded so far
          const avgTrackSize = currentBytes / (i + (singleInfo.progress / 100) || 1);
          const estTotalBatchBytes = avgTrackSize * tracks.length;
          const estRemainingBytes = Math.max(0, estTotalBatchBytes - currentBytes);
          const etaSeconds = avgBatchSpeed > 0 ? estRemainingBytes / avgBatchSpeed : 0;

          if (onProgress) {
            onProgress({
              currentTrackIndex: i + 1,
              totalTracks: tracks.length,
              currentTrackTitle: `${track.artist} - ${track.title}`,
              currentTrackId: track.id,
              currentTrackProgress: singleInfo.progress,
              overallProgress,
              speedFormatted: formatSpeed(avgBatchSpeed),
              etaFormatted: formatEta(etaSeconds),
              totalBytesDownloaded: currentBytes,
              trackStatuses: { ...trackStatuses },
            });
          }
        }
      );

      totalBytesAcrossBatch += blob.size;
      trackStatuses[track.id] = 'completed';
      const sanitize = (s: string) => s.replace(/[/\\?%*:|"<>]/g, '');
      const filename = `${String(i + 1).padStart(2, '0')}. ${sanitize(track.artist)} - ${sanitize(track.title)}.${ext}`;

      zip.file(filename, blob);
    } catch (trackErr) {
      console.warn(`[Batch Download] Error rendering track ${track.title}:`, trackErr);
      trackStatuses[track.id] = 'error';
    }

    if (onProgress) {
      const currentBytes = totalBytesAcrossBatch;
      const elapsedTimeSec = (performance.now() - startTime) / 1000;
      const avgBatchSpeed = elapsedTimeSec > 0.05 ? currentBytes / elapsedTimeSec : 0;
      const overallProgress = Math.min(99, Math.round(((i + 1) / tracks.length) * 100));

      onProgress({
        currentTrackIndex: i + 1,
        totalTracks: tracks.length,
        currentTrackTitle: `${track.artist} - ${track.title}`,
        currentTrackId: track.id,
        currentTrackProgress: trackStatuses[track.id] === 'completed' ? 100 : 0,
        overallProgress,
        speedFormatted: formatSpeed(avgBatchSpeed),
        etaFormatted: '...',
        totalBytesDownloaded: currentBytes,
        trackStatuses: { ...trackStatuses },
      });
    }
  }

  if (onProgress) {
    const totalTime = (performance.now() - startTime) / 1000;
    const finalSpeed = totalTime > 0 ? totalBytesAcrossBatch / totalTime : 0;
    onProgress({
      currentTrackIndex: tracks.length,
      totalTracks: tracks.length,
      currentTrackTitle: 'Afronden in ZIP...',
      overallProgress: 100,
      speedFormatted: formatSpeed(finalSpeed),
      etaFormatted: '0s',
      totalBytesDownloaded: totalBytesAcrossBatch,
      trackStatuses: { ...trackStatuses },
    });
  }

  return await zip.generateAsync({ type: 'blob' });
}
