# 🎵 Soulcraft Downloader - Studio Master Audio Downloader & Desktop App

**Soulcraft Downloader** is een krachtige, moderne full-stack muziekapplicatie en audio downloader. Zoek, beluister, verrijk en download muziekbestanden in kristalheldere studio-kwaliteit (320kbps MP3 / FLAC / WAV / M4A) met complete ID3-tags en embedded cover art vanaf platformen zoals Spotify, SoundCloud en YouTube Music.

---

## ✨ Belangrijkste Features

- 🎧 **Ingebouwde Audio Player**: Complete audiospeler met waveform visualizer, volumeregeling, songteksten (Lyrics Modal) en directe cross-platform links.
- 💎 **Echte, Volledige Muziekbestanden**: Download nummers in 320 kbps MP3, FLAC, WAV of M4A inclusief automatisch ingebedde albumillustraties (front cover artwork) en ID3v2.3 tags (titel, artiest, album, jaar, genre, BPM en Camelot Key).
- 💻 **Vaste Desktop App op Mac & Windows**:
  - **macOS**: Eenvoudig toe te voegen aan het Mac Dock via Safari ("Voeg toe aan Dock") of Chrome/Edge PWA.
  - **Windows**: Installeerbaar als zelfstandig programma met snelkoppeling op het Bureaublad (`.url`) en op de Taakbalk.
- 🏷️ **Automatische ID3 Tags & Albumhoes Verrijking**: Automatische detectie van artiest, album, uitgavejaar, genre en hoge resolutie albumillustraties via iTunes, Deezer en AI-services.
- 📁 **Muziekbibliotheek & Downloadgeschiedenis**:
  - Filteren op platform (Spotify, SoundCloud, YouTube).
  - Sorteren op titel, artiest, album, genre, BPM of Camelot Toonsoort voor DJ mixing.
  - Exporteren van je bibliotheek naar CSV, Excel (.xls) of JSON.
- ⚡ **Turbo Audio Transcoder**: Cross-platform multi-threaded FFmpeg engine met instant disk & memory caching.
- 📱 **QR-Code mobiele sync**: Snel de web-app openen op je smartphone of tablet via de ingebouwde QR-codescanner.
- 💾 **Opslagbeheer**: Bekijk het schijfgebruik van je lokale geschiedenis en bibliotheek met automatische en handmatige opruimmogelijkheden.

---

## 🚀 Lokaal Starten & Ontwikkelen

### Vereisten
- [Node.js](https://nodejs.org/) (v18 of hoger aanbevolen)
- FFmpeg (geïnstalleerd en beschikbaar in PATH)
- npm of bun

### Installatie

1. **Installeer alle afhankelijkheden**:
   ```bash
   npm install
   ```

2. **Start de ontwikkelserver**:
   ```bash
   npm run dev
   ```
   De app draait standaard op `http://localhost:3000`.

3. **Productie Build**:
   ```bash
   npm run build
   npm start
   ```

---

## 💻 Installeren als Vaste Software (Desktop App)

Je kunt **Soulcraft Downloader** gebruiken zonder browserbalken als een zelfstandig programma op je computer:

### 🍎 Op Apple Mac (macOS):
1. Open de app in **Safari**.
2. Klik in de bovenste menubalk van Safari op **Bestand** (*File*).
3. Kies **Voeg toe aan Dock...** (*Add to Dock...*).
4. De app staat nu tussen je Mac programma's in de **Dock** en in **Launchpad**!

### 🪟 Op Windows PC / Laptop:
1. Open de app in **Microsoft Edge** of **Google Chrome**.
2. Klik rechtsboven op het pictogram voor installeren in de adresbalk of klik op de 3 puntjes (`...`) ➔ **Apps** ➔ **Dj Darty Farty installeren**.
3. Vink aan: *"Vastpinnen aan Taakbalk"* en *"Snelkoppeling op Bureaublad aanmaken"*.

*(Je kunt in de app ook op de knop **"Installeer op Mac & Windows"** klikken voor een directe download van snelkoppelingen zoals `.url` of `.webloc`).*

---

## 📂 Projectstructuur

```text
├── public/                 # Statische bestanden (PWA manifest.json, sw.js, icon.svg)
├── server.ts               # Express backend server voor audio streaming & downloads
├── src/
│   ├── components/         # React componenten (AudioPlayer, MusicLibrary, Modals, etc.)
│   ├── utils/              # Audio encoders, ID3 tagger, vertalingen, sample data
│   ├── App.tsx             # Hoofdcomponent & applicatiestatus
│   ├── main.tsx            # Entry point met React ErrorBoundary
│   └── types.ts            # TypeScript interfaces & types
├── index.html              # HTML template met PWA Service Worker
├── package.json            # Dependencies & scripts
└── vite.config.ts          # Vite configuratie
```

---

## 📜 Licentie & Disclaimer

Uitsluitend bestemd voor persoonlijk offline archiefgebruik en het beheren van je eigen muziekcollectie.
