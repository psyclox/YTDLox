<p align="center">
  <img src="icons/ytdlox_logo.png" alt="YTDLox" width="120">
</p>

<h1 align="center">YTDLox</h1>

<p align="center">
  <strong>Advanced Desktop YouTube Downloader</strong><br>
  A modern, feature-rich desktop GUI for downloading videos &amp; audio — powered by yt-dlp and FFmpeg.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-3.8.1-blue?style=flat-square" alt="Version">
  <img src="https://img.shields.io/badge/platform-Windows-0078D6?style=flat-square&logo=windows" alt="Platform">
  <img src="https://img.shields.io/badge/electron-33.x-47848F?style=flat-square&logo=electron" alt="Electron">
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License">
</p>

---

## ✨ Features

### 🎬 Video & Audio Downloads
- **Max quality selection** — download up to 4K/8K video with best available audio
- **Multiple containers** — output as MKV, MP4, or WebM
- **Audio-only mode** — extract audio to MP3, M4A, FLAC, WAV, Opus, or OGG
- **Quality presets** — choose Max, Medium (1080p/720p), or Low (480p/360p) from settings

### 🔤 Subtitles & Metadata
- **Embedded subtitles** — download and embed all subtitle tracks (including auto-generated) directly into the video
- **Subtitle conversion** — auto-converts to SRT for maximum player compatibility
- **Thumbnail embedding** — embed video thumbnails into the file metadata
- **Chapter markers** — preserve chapter information when available

### 🎵 Multi-Track Audio
- **Multiple audio streams** — select and merge multiple audio tracks (different languages, codecs)
- **Auto best audio** — automatically picks the highest quality audio track
- **Audio track picker** — interactive modal to choose exactly which audio tracks to include

### 🔍 Built-in Search & Playlists
- **YouTube search** — search videos directly from the app without a browser
- **Playlist support** — paste a playlist URL to browse and download individual videos
- **Channel browsing** — load videos from any YouTube channel
- **Batch downloads** — select multiple search results and download them all at once

### 📊 Real-Time Progress
- **Live download progress** — percentage, speed, ETA, and file size
- **Detailed processing status** — see exactly what's happening: subtitle downloading, merging, converting, embedding
- **Concurrent downloads** — configure up to 10 simultaneous downloads
- **Download history** — browse and replay past downloads

### 🎨 Premium Interface
- **Dark mode** — sleek glassmorphic dark theme (with light mode option)
- **Three-panel layout** — search panel, settings panel, and download queue
- **Collapsible panels** — maximize your workspace
- **Responsive design** — resizable window with clean typography

---

## 🚀 Getting Started

### Option 1: Portable (No Install)
1. Download `YTDLox-Portable-3.8.1.exe` from [Releases](https://github.com/psyclox/YTDLox/releases)
2. Run the executable — no installation needed

### Option 2: Installer
1. Download `YTDLox Setup 3.8.1.exe` from [Releases](https://github.com/psyclox/YTDLox/releases)
2. Run the installer and follow the setup wizard

> **No Node.js, Python, or command-line tools required.** Everything is bundled inside the app.

---

## 📖 Usage

1. **Set your download folder** — click the ⚙️ Settings icon and choose a Default Save Directory
2. **Find a video** — search in the left sidebar or paste a YouTube URL in the center bar
3. **Choose quality** — the app fetches all available formats automatically; select your preferred resolution
4. **Configure options** — toggle Subtitles, Thumbnail, or Auto Best Audio as needed
5. **Download** — hit the Download button and track progress in the right panel

> **💡 Tip:** If VLC shows a white screen for MKV files with multiple audio tracks, try [PotPlayer](https://potplayer.tv/) — it handles complex MKV containers perfectly.

---

## 🛠️ Development

```bash
# Clone the repository
git clone https://github.com/psyclox/YTDLox.git
cd YTDLox

# Install dependencies
npm install

# Run in development mode
npm start

# Build for production (Windows)
npm run build
```

Build output appears in the `releases/` directory with both portable and installer executables.

---

## 🏗️ Built With

| Technology | Purpose |
|---|---|
| [Electron](https://www.electronjs.org/) | Desktop application framework |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | Video/audio downloading engine |
| [FFmpeg](https://ffmpeg.org/) | Media processing & format conversion |

---

## ☕ Support the Project

If you find YTDLox useful, consider supporting the development!

<a href="https://buymeacoffee.com/psyclox">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" width="200">
</a>

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/psyclox">Psyclox</a>
</p>
