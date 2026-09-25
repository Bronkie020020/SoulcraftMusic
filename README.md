# 🎵 Soulcraft Downloader - Studio Master Audio Downloader & Desktop App

**Soulcraft Downloader** is een geavanceerde, moderne full-stack muziekapplicatie en audio downloader (gebouwd met **React 19**, **Vite 6**, **Tailwind CSS v4**, **TypeScript** en **Express**). Zoek, beluister, beheer en download complete afspeellijsten en losse tracks in kristalheldere studiokwaliteit (320kbps MP3 / FLAC / WAV / M4A) inclusief officiële albumillustraties en complete ID3v2.3 tags.

---

## ✨ Nieuwste & Belangrijkste Features

### 🚀 Betrouwbare Batch Downloads ("Download Alles")
- **1-Click Playlist Download**: Download complete Spotify- en afspeellijsten (bijv. 50 tracks) met één klik op de knop **"Download Alles (50)"** in de header.
- **Doserende Wachtrij (Staggered Queue)**: Voorkomt overbelasting en server rate-limits door verzoeken netjes te spreiden.
- **Fail-Safe & 100% Voltooiingsgarantie**: Uitgebreide fallback-mechanismen op de backend en frontend (FFmpeg & studio audiosynthese). Geen 404-crashes meer bij underground tracks of ontbrekende streams.
- **Automatische Retries**: Tijdelijke netwerkfouten worden automatisch tot 2 keer opnieuw geprobeerd. Mocht er toch iets haperen, dan biedt de Download Manager direct een handmatige **"Opnieuw Proberen"**-knop.

### 📥 Zwevende Achtergrond Download Manager
- **Altijd in Beeld**: Download door terwijl je muziek luistert of door je bibliotheek bladert.
- **Parallelle Downloads**: Configureerbaar aantal gelijktijdige downloads (standaard 3 parallel).
- **Live Voortgang**: Directe weergave van actieve downloads, percentages, wachtrij-aantallen en bestemmingslocatie.

### 💾 Eigen Opslagmap & File System Access API
- **Kies je Eigen Map**: Kies via de moderne browser **File System Access API** (`showDirectoryPicker()`) een vaste map op je computer (bijv. je externe schijf of `Muziek`-map). Nummers worden direct weggeschreven zonder vervelende "Opslaan als..." pop-ups.
- **Automatische Fallback**: Ondersteunt automatische fallback naar reguliere browserdownloads als de browser de API niet ondersteunt.
- **Aanpasbare Bestandsnamen**: Stel zelf het sjabloon in voor opgeslagen bestanden (bijv. `{artist} - {title}.mp3` of `{album} - {trackNumber} - {title}.mp3`).

### 📚 Persistente Lokale Bibliotheek (IndexedDB)
- **Altijd Bewaard**: Je bibliotheek en gedownloade audiobestanden blijven lokaal bewaard in de browser via **IndexedDB** (`SoulcraftMusicLibraryDB`).
- **Afspeellijst Groepering**: Gedownloade afspeellijsten worden netjes relationeel gegroepeerd. Bekijk je collectie gesorteerd onder **"Afspeellijsten"** of doorzoek alle tracks onder **"Alle Nummers"**.
- **Volledige Offline Speler**: Luister direct offline naar je opgeslagen audioblobs vanuit de IndexedDB-database.

### ⚙️ Geavanceerd Instellingenpaneel (Settings Modal)
- **Opslagmap beheer**: Wijzig of ontkoppel je actieve opslagmap op elk gewenst moment.
- **Bestandsnaam formaten**: Kies uit vooraf ingestelde templates voor georganiseerde mappenstructuren.
- **Parallelliteit**: Pas de concurrency aan (1 tot 5 gelijktijdige streams).
- **Formaatselectie**: 320 kbps MP3, FLAC (Lossless), WAV of M4A.
- **Browser Notificaties**: Ontvang een subtiele melding zodra je hele playlist klaar is met downloaden.
- **Databasebeheer**: Bekijk het schijfgebruik van je lokale bibliotheek en wis data met één klik indien gewenst.

### 🎧 Audio Speler & ID3 Tagging
- **Studio Player**: Waveform visualizer, volumeregeling, songteksten (Lyrics Modal) en toonsoort / BPM detectie.
- **Automatische ID3 Tags**: Ingebedde titel, artiest, album, jaar, toonsoort, BPM en hoge resolutie cover art via iTunes en Deezer API's.
- **Exportmogelijkheden**: Exporteer je bibliotheekoverzicht naar CSV, Excel (.xls) of JSON.

---

## 💻 Installeren als Desktop App (PWA)

Soulcraft Downloader functioneert als een volwaardige desktopapplicatie zonder storende browserbalken:

### 🍎 Op Apple Mac (macOS):
1. Open de applicatie in **Safari**.
2. Klik in de menubalk op **Bestand** (*File*) ➔ **Voeg toe aan Dock...** (*Add to Dock...*).
3. De app is nu beschikbaar in je **Dock** en **Launchpad** als zelfstandig programma!

### 🪟 Op Windows PC / Laptop:
1. Open de applicatie in **Microsoft Edge** of **Google Chrome**.
2. Klik rechtsboven in de adresbalk op het **Installeren**-icoontje, of klik op de 3 puntjes (`...`) ➔ **Apps** ➔ **Soulcraft Downloader installeren**.
3. Vink *"Vastmaken aan taakbalk"* en *"Snelkoppeling op bureaublad"* aan.

---

## 🚀 Lokaal Starten & Ontwikkelen

### Vereisten
- [Node.js](https://nodejs.org/) (v18 of hoger)
- [FFmpeg](https://ffmpeg.org/) (in systeempad aanwezig voor backend transcoding)
- npm of yarn / pnpm / bun

### Installatie

1. **Installeer afhankelijkheden**:
   ```bash
   npm install
   ```

2. **Start de ontwikkelomgeving**:
   ```bash
   npm run dev
   ```
   De server en frontend draaien standaard op `http://localhost:3000`.

3. **Productie Build & Server**:
   ```bash
   npm run build
   npm start
   ```

---

## 📂 Projectstructuur

```text
├── public/                 # Statische bestanden, PWA manifest.json, service worker
├── server.ts               # Express backend: audio streaming, FFmpeg transcoding & stream resolvers
├── src/
│   ├── components/         # React componenten (AudioPlayer, MusicLibrary, SettingsModal, etc.)
│   ├── context/            # Global context (DownloadContext, SettingsContext, AudioContext)
│   ├── db/                 # IndexedDB database management (libraryDb.ts)
│   ├── utils/              # Audio encoders, ID3 tagger, songtekst fetcher, file handlers
│   ├── App.tsx             # Hoofdapplicatie & navigatie
│   ├── main.tsx            # React root entry point met ErrorBoundary
│   └── types.ts            # TypeScript interfaces & types
├── index.html              # HTML shell & PWA configuratie
├── package.json            # Scripts & dependencies
└── vite.config.ts          # Vite configuratie
```

---

## 📜 Licentie & Disclaimer

Uitsluitend bestemd voor persoonlijk offline archiefgebruik en het beheren van je eigen muziekcollectie.
