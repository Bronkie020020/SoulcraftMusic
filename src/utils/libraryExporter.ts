import { MusicTrack, Playlist } from '../types';
import { CAMELOT_KEY_MAP, normalizeToCamelotKey } from './audioAnalyzer';

export interface ExportOptions {
  playlists?: Playlist[];
  filename?: string;
  onlyFavorites?: boolean;
}

// Helper to sanitize filename strings
function sanitize(s?: string): string {
  return (s || '').replace(/[/\\?%*:|"<>]/g, '').trim();
}

// Format seconds into "HH:MM:SS" or "MM:SS"
function formatTotalDuration(tracks: MusicTrack[]): string {
  const totalSeconds = tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}u ${mins}m ${secs}s`;
  }
  return `${mins}m ${secs}s`;
}

// Compute formatted date string e.g. "2026-08-31 14:22"
export function formatFriendlyDate(isoDate?: string): string {
  if (!isoDate) return '-';
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return isoDate;
    return d.toLocaleString('nl-NL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoDate;
  }
}

// Prepare track metadata record
export function getTrackExportRecord(track: MusicTrack, index: number, playlists?: Playlist[]) {
  const camelot = normalizeToCamelotKey(track.key);
  const keyMeta = CAMELOT_KEY_MAP[camelot];
  const ext = (track.format || 'mp3').toLowerCase();
  const artistClean = sanitize(track.artist) || 'Unknown Artist';
  const titleClean = sanitize(track.title) || 'Unknown Title';
  const defaultFilePath = track.filePath || `Music/${artistClean} - ${titleClean}.${ext}`;
  
  const trackPlaylists = playlists
    ? playlists.filter((p) => p.trackIds.includes(track.id)).map((p) => p.name)
    : [];

  const downloadDateIso = track.downloadedAt || track.addedAt || new Date().toISOString();

  return {
    index: index + 1,
    id: track.id,
    title: track.title || 'Unknown Title',
    artist: track.artist || 'Unknown Artist',
    album: track.album || 'Single',
    releaseYear: track.releaseYear || '',
    genre: track.genre || 'Various',
    bpm: track.bpm ?? null,
    camelotKey: camelot,
    standardKey: keyMeta?.standard || track.key || '',
    keyMode: keyMeta?.mode || '',
    duration: track.duration || 0,
    durationFormatted: track.durationFormatted || '00:00',
    format: ext.toUpperCase(),
    bitrate: track.bitrate || '320 kbps',
    fileSizeMb: track.fileSizeMb || 0,
    filePath: defaultFilePath,
    downloadDate: downloadDateIso,
    downloadDateFormatted: formatFriendlyDate(downloadDateIso),
    dateAdded: track.addedAt || downloadDateIso,
    dateAddedFormatted: formatFriendlyDate(track.addedAt || downloadDateIso),
    platform: track.platform || 'youtube',
    originalUrl: track.originalUrl || '',
    coverUrl: track.coverUrl || '',
    streamUrl: track.streamUrl || '',
    isDownloaded: track.isDownloaded ?? true,
    isFavorite: track.isFavorite ?? false,
    playlists: trackPlaylists,
    playlistsFormatted: trackPlaylists.join('; '),
    hasLyrics: !!track.lyrics,
    lyrics: track.lyrics || '',
    crossLinks: track.crossLinks || {},
  };
}

/**
 * 1. EXPORT AS STRUCTURED JSON
 */
export function exportLibraryAsJson(tracks: MusicTrack[], options?: ExportOptions): void {
  if (!tracks || tracks.length === 0) return;

  const targetTracks = options?.onlyFavorites ? tracks.filter((t) => t.isFavorite) : tracks;
  const records = targetTracks.map((t, idx) => getTrackExportRecord(t, idx, options?.playlists));

  const totalMb = targetTracks.reduce((sum, t) => sum + (t.fileSizeMb || 0), 0);

  const archive = {
    application: 'Soulcraft Downloader / Soulcraft Studio',
    version: '2.4.0',
    description: 'Music Library Complete Metadata Archive with File Paths and Download Timestamps',
    exportedAt: new Date().toISOString(),
    totalTracks: targetTracks.length,
    totalStorageMb: Number(totalMb.toFixed(2)),
    totalDuration: formatTotalDuration(targetTracks),
    tracks: records,
    playlists: options?.playlists || [],
  };

  const jsonString = JSON.stringify(archive, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  const filename =
    options?.filename || `music_library_metadata_${new Date().toISOString().slice(0, 10)}.json`;

  triggerBrowserDownload(blob, filename);
}

/**
 * 2. EXPORT AS EXCEL SPREADSHEET (.XLS / XML SPREADSHEETML)
 * Works natively in Microsoft Excel, Apple Numbers, Google Sheets and Calc.
 */
export function exportLibraryAsExcel(tracks: MusicTrack[], options?: ExportOptions): void {
  if (!tracks || tracks.length === 0) return;

  const targetTracks = options?.onlyFavorites ? tracks.filter((t) => t.isFavorite) : tracks;
  const records = targetTracks.map((t, idx) => getTrackExportRecord(t, idx, options?.playlists));

  const xmlEscape = (str: any) =>
    String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  // SpreadsheetML XML Structure
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>Muziekbibliotheek Metadata Export</Title>
  <Author>Soulcraft Downloader / Soulcraft Studio</Author>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#1F2937"/>
  </Style>
  <Style ss:ID="Header">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#D97706"/>
   </Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Bold="1" ss:Color="#000000"/>
   <Interior ss:Color="#FACC15" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="RowEven">
   <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
   <Alignment ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="RowOdd">
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
   <Alignment ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="NumberCell">
   <NumberFormat ss:Format="0"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="DecimalCell">
   <NumberFormat ss:Format="0.00"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="DateCell">
   <NumberFormat ss:Format="yyyy-mm-dd hh:mm"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="CenterCell">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="KeyCell">
   <Font ss:Bold="1" ss:Color="#7C3AED"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="BpmCell">
   <Font ss:Bold="1" ss:Color="#D97706"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="PathCell">
   <Font ss:FontName="Consolas" ss:Size="10" ss:Color="#2563EB"/>
   <Alignment ss:Vertical="Center"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Muziek Collectie">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="35"/>  <!-- # -->
   <Column ss:Width="180"/> <!-- Title -->
   <Column ss:Width="150"/> <!-- Artist -->
   <Column ss:Width="140"/> <!-- Album -->
   <Column ss:Width="50"/>  <!-- Year -->
   <Column ss:Width="110"/> <!-- Genre -->
   <Column ss:Width="60"/>  <!-- BPM -->
   <Column ss:Width="65"/>  <!-- Camelot Key -->
   <Column ss:Width="85"/>  <!-- Musical Key -->
   <Column ss:Width="65"/>  <!-- Duration -->
   <Column ss:Width="55"/>  <!-- Format -->
   <Column ss:Width="65"/>  <!-- Bitrate -->
   <Column ss:Width="75"/>  <!-- Size MB -->
   <Column ss:Width="260"/> <!-- File Path -->
   <Column ss:Width="130"/> <!-- Download Date -->
   <Column ss:Width="130"/> <!-- Date Added -->
   <Column ss:Width="75"/>  <!-- Platform -->
   <Column ss:Width="55"/>  <!-- Favorite -->
   <Column ss:Width="160"/> <!-- Playlists -->
   <Column ss:Width="220"/> <!-- Original URL -->

   <!-- Header Row -->
   <Row ss:Height="26" ss:StyleID="Header">
    <Cell><Data ss:Type="String">#</Data></Cell>
    <Cell><Data ss:Type="String">Titel (Title)</Data></Cell>
    <Cell><Data ss:Type="String">Artiest (Artist)</Data></Cell>
    <Cell><Data ss:Type="String">Album</Data></Cell>
    <Cell><Data ss:Type="String">Jaar</Data></Cell>
    <Cell><Data ss:Type="String">Genre</Data></Cell>
    <Cell><Data ss:Type="String">BPM</Data></Cell>
    <Cell><Data ss:Type="String">Camelot Key</Data></Cell>
    <Cell><Data ss:Type="String">Toonsoort</Data></Cell>
    <Cell><Data ss:Type="String">Duur</Data></Cell>
    <Cell><Data ss:Type="String">Formaat</Data></Cell>
    <Cell><Data ss:Type="String">Bitrate</Data></Cell>
    <Cell><Data ss:Type="String">Bestandsgrootte (MB)</Data></Cell>
    <Cell><Data ss:Type="String">Bestandspad (File Path)</Data></Cell>
    <Cell><Data ss:Type="String">Download Datum</Data></Cell>
    <Cell><Data ss:Type="String">Datum Toegevoegd</Data></Cell>
    <Cell><Data ss:Type="String">Platform</Data></Cell>
    <Cell><Data ss:Type="String">Favoriet</Data></Cell>
    <Cell><Data ss:Type="String">Afspeellijsten (Playlists)</Data></Cell>
    <Cell><Data ss:Type="String">Originele URL</Data></Cell>
   </Row>
`;

  // Data Rows
  records.forEach((r, idx) => {
    const rowStyle = idx % 2 === 0 ? 'RowEven' : 'RowOdd';
    xml += `   <Row ss:Height="22" ss:StyleID="${rowStyle}">
    <Cell ss:StyleID="CenterCell"><Data ss:Type="Number">${r.index}</Data></Cell>
    <Cell><Data ss:Type="String">${xmlEscape(r.title)}</Data></Cell>
    <Cell><Data ss:Type="String">${xmlEscape(r.artist)}</Data></Cell>
    <Cell><Data ss:Type="String">${xmlEscape(r.album)}</Data></Cell>
    <Cell ss:StyleID="CenterCell"><Data ss:Type="String">${xmlEscape(r.releaseYear)}</Data></Cell>
    <Cell><Data ss:Type="String">${xmlEscape(r.genre)}</Data></Cell>
    <Cell ss:StyleID="BpmCell"><Data ss:Type="${r.bpm ? 'Number' : 'String'}">${r.bpm ?? '-'}</Data></Cell>
    <Cell ss:StyleID="KeyCell"><Data ss:Type="String">${xmlEscape(r.camelotKey)}</Data></Cell>
    <Cell ss:StyleID="CenterCell"><Data ss:Type="String">${xmlEscape(r.standardKey)}</Data></Cell>
    <Cell ss:StyleID="CenterCell"><Data ss:Type="String">${xmlEscape(r.durationFormatted)}</Data></Cell>
    <Cell ss:StyleID="CenterCell"><Data ss:Type="String">${xmlEscape(r.format)}</Data></Cell>
    <Cell ss:StyleID="CenterCell"><Data ss:Type="String">${xmlEscape(r.bitrate)}</Data></Cell>
    <Cell ss:StyleID="DecimalCell"><Data ss:Type="Number">${Number(r.fileSizeMb).toFixed(2)}</Data></Cell>
    <Cell ss:StyleID="PathCell"><Data ss:Type="String">${xmlEscape(r.filePath)}</Data></Cell>
    <Cell ss:StyleID="DateCell"><Data ss:Type="String">${xmlEscape(r.downloadDateFormatted)}</Data></Cell>
    <Cell ss:StyleID="DateCell"><Data ss:Type="String">${xmlEscape(r.dateAddedFormatted)}</Data></Cell>
    <Cell ss:StyleID="CenterCell"><Data ss:Type="String">${xmlEscape(r.platform)}</Data></Cell>
    <Cell ss:StyleID="CenterCell"><Data ss:Type="String">${r.isFavorite ? 'Ja ⭐' : 'Nee'}</Data></Cell>
    <Cell><Data ss:Type="String">${xmlEscape(r.playlistsFormatted || '-')}</Data></Cell>
    <Cell><Data ss:Type="String">${xmlEscape(r.originalUrl)}</Data></Cell>
   </Row>\n`;
  });

  xml += `  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const filename =
    options?.filename || `music_library_records_${new Date().toISOString().slice(0, 10)}.xls`;

  triggerBrowserDownload(blob, filename);
}

/**
 * 3. EXPORT AS CSV WITH UTF-8 BOM
 */
export function exportLibraryAsCsv(tracks: MusicTrack[], options?: ExportOptions): void {
  if (!tracks || tracks.length === 0) return;

  const targetTracks = options?.onlyFavorites ? tracks.filter((t) => t.isFavorite) : tracks;
  const records = targetTracks.map((t, idx) => getTrackExportRecord(t, idx, options?.playlists));

  const escapeCsv = (field: any) => `"${String(field ?? '').replace(/"/g, '""')}"`;

  const headers = [
    '#',
    'Track ID',
    'Titel',
    'Artiest',
    'Album',
    'Uitgavejaar',
    'Genre',
    'BPM',
    'Camelot Key',
    'Toonsoort Standaard',
    'Duur Formatted',
    'Duur Seconden',
    'Audio Formaat',
    'Bitrate',
    'Bestandsgrootte MB',
    'Bestandspad (File Path)',
    'Download Datum (ISO)',
    'Download Datum Weergave',
    'Datum Toegevoegd',
    'Platform',
    'Originele URL',
    'Favoriet',
    'Gedownload',
    'Afspeellijsten',
    'Heeft Songtekst',
  ];

  const rows = records.map((r) => [
    r.index,
    escapeCsv(r.id),
    escapeCsv(r.title),
    escapeCsv(r.artist),
    escapeCsv(r.album),
    escapeCsv(r.releaseYear),
    escapeCsv(r.genre),
    escapeCsv(r.bpm ?? ''),
    escapeCsv(r.camelotKey),
    escapeCsv(r.standardKey),
    escapeCsv(r.durationFormatted),
    r.duration,
    escapeCsv(r.format),
    escapeCsv(r.bitrate),
    Number(r.fileSizeMb).toFixed(2),
    escapeCsv(r.filePath),
    escapeCsv(r.downloadDate),
    escapeCsv(r.downloadDateFormatted),
    escapeCsv(r.dateAddedFormatted),
    escapeCsv(r.platform),
    escapeCsv(r.originalUrl),
    escapeCsv(r.isFavorite ? 'Ja' : 'Nee'),
    escapeCsv(r.isDownloaded ? 'Ja' : 'Nee'),
    escapeCsv(r.playlistsFormatted),
    escapeCsv(r.hasLyrics ? 'Ja' : 'Nee'),
  ]);

  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const filename =
    options?.filename || `music_library_${new Date().toISOString().slice(0, 10)}.csv`;

  triggerBrowserDownload(blob, filename);
}

/**
 * 4. COPY JSON TO CLIPBOARD
 */
export async function copyLibraryAsJson(
  tracks: MusicTrack[],
  options?: ExportOptions
): Promise<boolean> {
  try {
    const targetTracks = options?.onlyFavorites ? tracks.filter((t) => t.isFavorite) : tracks;
    const records = targetTracks.map((t, idx) => getTrackExportRecord(t, idx, options?.playlists));
    const payload = {
      exportedAt: new Date().toISOString(),
      totalTracks: targetTracks.length,
      tracks: records,
    };
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    return true;
  } catch (err) {
    console.error('Clipboard copy error:', err);
    return false;
  }
}

/**
 * 5. COPY TAB-SEPARATED VALUES (TSV) TO CLIPBOARD (Direct paste into Excel / Sheets)
 */
export async function copyLibraryAsTsv(
  tracks: MusicTrack[],
  options?: ExportOptions
): Promise<boolean> {
  try {
    const targetTracks = options?.onlyFavorites ? tracks.filter((t) => t.isFavorite) : tracks;
    const records = targetTracks.map((t, idx) => getTrackExportRecord(t, idx, options?.playlists));

    const headers = [
      '#',
      'Titel',
      'Artiest',
      'Album',
      'Jaar',
      'Genre',
      'BPM',
      'Key',
      'Duur',
      'Formaat',
      'MB',
      'Bestandspad',
      'Download Datum',
      'Afspeellijsten',
    ];

    const rows = records.map((r) => [
      r.index,
      r.title,
      r.artist,
      r.album,
      r.releaseYear,
      r.genre,
      r.bpm ?? '',
      r.camelotKey,
      r.durationFormatted,
      r.format,
      Number(r.fileSizeMb).toFixed(2),
      r.filePath,
      r.downloadDateFormatted,
      r.playlistsFormatted,
    ]);

    const tsv = [headers.join('\t'), ...rows.map((row) => row.join('\t'))].join('\n');
    await navigator.clipboard.writeText(tsv);
    return true;
  } catch (err) {
    console.error('Clipboard TSV copy error:', err);
    return false;
  }
}

// Utility to trigger download
function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
