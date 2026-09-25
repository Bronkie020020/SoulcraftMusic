// src/utils/coverHelper.ts

/**
 * Genereert een deterministische hashcode op basis van een string.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Retourneert de geldige coverUrl, of genereert een unieke dynamische SVG-cover
 * zodat er nooit 4 identieke placeholders in een collage getoond worden.
 */
export function resolveTrackCover(coverUrl?: string, title?: string, artist?: string): string {
  if (coverUrl && coverUrl.trim().length > 0 && !coverUrl.includes('placeholder')) {
    return coverUrl;
  }

  const cleanTitle = (title || 'Track').slice(0, 22);
  const cleanArtist = (artist || 'Soulcraft').slice(0, 22);

  const hash = hashString(`${cleanTitle}-${cleanArtist}`);
  const hue1 = hash % 360;
  const hue2 = (hue1 + 45) % 360;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
      <defs>
        <linearGradient id="grad-${hash}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:hsl(${hue1}, 70%, 25%);stop-opacity:1" />
          <stop offset="100%" style="stop-color:hsl(${hue2}, 85%, 12%);stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#grad-${hash})" />
      <circle cx="150" cy="115" r="46" fill="hsl(${hue1}, 80%, 55%)" opacity="0.9" />
      <polygon points="143,98 143,132 168,115" fill="#ffffff" />
      <text x="150" y="200" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="700" fill="#ffffff" text-anchor="middle">${cleanTitle}</text>
      <text x="150" y="225" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="500" fill="#cbd5e1" text-anchor="middle">${cleanArtist}</text>
    </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Bouwt een lijst van 4 gevarieerde covers voor de 2x2 collage.
 */
export function getCollageCovers(tracks: { coverUrl?: string; title: string; artist: string }[]): string[] {
  if (!tracks || tracks.length === 0) {
    return Array(4).fill(resolveTrackCover());
  }

  const covers: string[] = [];
  for (let i = 0; i < 4; i++) {
    const track = tracks[i % tracks.length];
    covers.push(resolveTrackCover(track.coverUrl, track.title, track.artist));
  }
  return covers;
}
