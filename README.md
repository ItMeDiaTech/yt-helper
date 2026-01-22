# YouTube Helper

A modern desktop application for downloading YouTube videos with customizable format, quality, and time range options.

## Features

- **Video Downloads**: Download YouTube videos in MP4, WebM, or MKV format
- **Audio Extraction**: Extract audio in MP3, M4A, OGG, WAV, or FLAC format
- **Quality Selection**: Choose from available qualities (2160p, 1440p, 1080p, 720p, 480p, 360p)
- **Time Range Selection**: Download specific portions of videos using HH:MM:SS format
- **Real-time Progress**: Live download progress with speed and ETA display
- **Auto-Updates**: Automatic updates via GitHub Releases

## Installation

### Windows

1. Download the latest installer from [Releases](https://github.com/ItMeDiaTech/yt-helper/releases)
2. Run `yt-helper-x.x.x-setup.exe`
3. Follow the installation wizard

### Requirements

- Windows 10/11 (64-bit)
- Internet connection for downloading videos

## Usage

1. **Paste URL**: Copy a YouTube video URL and paste it into the app
2. **Select Options**:
   - Choose between Video or Audio Only mode
   - Select format (MP4, WebM, MKV for video; MP3, M4A, etc. for audio)
   - Choose quality (Best, 1080p, 720p, etc.)
   - Optionally set start/end times (HH:MM:SS format)
3. **Download**: Click the Download button and watch the progress

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- [Python](https://www.python.org/) 3.10 or higher
- [Git](https://git-scm.com/)

### Setup

```bash
# Clone the repository
git clone https://github.com/ItMeDiaTech/yt-helper.git
cd yt-helper

# Install Node.js dependencies
npm install

# Create Python virtual environment and install dependencies
cd python
python -m venv venv
venv\Scripts\pip install -r requirements.txt
cd ..
```

### Running in Development

```bash
npm run dev
```

This will start both the Electron app and the Python backend.

### Building

```bash
# Build the app
npm run build

# Build Python backend executable
cd python
venv\Scripts\python build_executable.py
cd ..

# Create Windows installer
npm run package
```

The installer will be created in the `dist/` directory.

## Tech Stack

- **Frontend**: Electron + React + TypeScript + Tailwind CSS
- **Backend**: Python + yt-dlp + Flask
- **Build**: electron-vite + electron-builder + PyInstaller
- **State Management**: Zustand
- **Updates**: electron-updater

## Project Structure

```
yt-helper/
├── src/
│   ├── main/           # Electron main process
│   ├── preload/        # Preload scripts (IPC bridge)
│   ├── renderer/       # React frontend
│   └── shared/         # Shared types
├── python/             # Python backend
│   ├── server.py       # Flask HTTP server
│   ├── downloader.py   # yt-dlp wrapper
│   └── requirements.txt
├── resources/          # App resources (icons)
└── dist/               # Build output
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - YouTube video downloader
- [Electron](https://www.electronjs.org/) - Desktop app framework
- [React](https://reactjs.org/) - UI library
