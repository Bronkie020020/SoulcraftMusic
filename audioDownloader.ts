import { runInteractiveCli, downloadAudioFile, sanitizeWindowsFileName } from './src/utils/nodeDownloader';

export * from './src/utils/nodeDownloader';

if (typeof require !== 'undefined' && require.main === module) {
  runInteractiveCli();
} else if (process.argv[1] && (process.argv[1].endsWith('audioDownloader.ts') || process.argv[1].endsWith('audioDownloader.js'))) {
  runInteractiveCli();
}
