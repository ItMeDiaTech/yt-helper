#!/usr/bin/env python3
"""
YouTube Downloader module using yt-dlp.
"""

import re
import yt_dlp
from typing import Callable, Optional, Dict, Any


class YouTubeDownloader:
    """YouTube video/audio downloader using yt-dlp."""

    def __init__(self):
        self.quality_map = {
            'best': 'bestvideo+bestaudio/best',
            '2160p': 'bestvideo[height<=2160]+bestaudio/best[height<=2160]',
            '1440p': 'bestvideo[height<=1440]+bestaudio/best[height<=1440]',
            '1080p': 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
            '720p': 'bestvideo[height<=720]+bestaudio/best[height<=720]',
            '480p': 'bestvideo[height<=480]+bestaudio/best[height<=480]',
            '360p': 'bestvideo[height<=360]+bestaudio/best[height<=360]',
        }

    def validate_url(self, url: str) -> bool:
        """Validate if URL is a valid YouTube URL."""
        patterns = [
            r'^(https?://)?(www\.)?youtube\.com/watch\?v=[\w-]+',
            r'^(https?://)?(www\.)?youtu\.be/[\w-]+',
            r'^(https?://)?(www\.)?youtube\.com/shorts/[\w-]+',
        ]
        return any(re.match(pattern, url) for pattern in patterns)

    def get_video_info(self, url: str) -> Dict[str, Any]:
        """Fetch video metadata without downloading."""
        if not self.validate_url(url):
            raise ValueError('Invalid YouTube URL')

        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)

            # Get available qualities
            available_qualities = set()
            for fmt in info.get('formats', []):
                height = fmt.get('height')
                if height:
                    available_qualities.add(f'{height}p')

            # Sort qualities
            quality_order = ['2160p', '1440p', '1080p', '720p', '480p', '360p']
            sorted_qualities = ['best'] + [q for q in quality_order if q in available_qualities]

            return {
                'id': info.get('id', ''),
                'title': info.get('title', 'Unknown'),
                'description': info.get('description', ''),
                'thumbnail': info.get('thumbnail', ''),
                'duration': info.get('duration', 0),
                'channel': info.get('uploader', 'Unknown'),
                'uploadDate': info.get('upload_date', ''),
                'viewCount': info.get('view_count', 0),
                'availableQualities': sorted_qualities,
                'availableVideoFormats': ['mp4', 'webm', 'mkv'],
                'availableAudioFormats': ['mp3', 'm4a', 'ogg', 'wav', 'flac'],
            }

    def download(
        self,
        url: str,
        output_dir: str,
        mode: str = 'video',
        video_format: str = 'mp4',
        audio_format: str = 'mp3',
        quality: str = 'best',
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
        progress_callback: Optional[Callable[[Dict], None]] = None,
        cancel_check: Optional[Callable[[], bool]] = None
    ) -> Dict[str, Any]:
        """
        Download video or audio from YouTube.

        Args:
            url: YouTube video URL
            output_dir: Output directory path
            mode: 'video' or 'audio'
            video_format: Video container format (mp4, webm, mkv)
            audio_format: Audio format for extraction (mp3, m4a, ogg, wav, flac)
            quality: Video quality (best, 2160p, 1440p, 1080p, 720p, 480p, 360p)
            start_time: Start time in HH:MM:SS format
            end_time: End time in HH:MM:SS format
            progress_callback: Callback for progress updates
            cancel_check: Function to check if download should be cancelled

        Returns:
            Dict with download result info
        """
        if not self.validate_url(url):
            raise ValueError('Invalid YouTube URL')

        result = {'filename': None}

        def progress_hook(d):
            if cancel_check and cancel_check():
                raise Exception('Download cancelled')

            if progress_callback and d['status'] == 'downloading':
                # Parse progress info
                progress = 0
                if '_percent_str' in d:
                    try:
                        progress = float(d['_percent_str'].strip().replace('%', ''))
                    except:
                        pass
                elif 'downloaded_bytes' in d and 'total_bytes' in d:
                    progress = (d['downloaded_bytes'] / d['total_bytes']) * 100
                elif 'downloaded_bytes' in d and 'total_bytes_estimate' in d:
                    progress = (d['downloaded_bytes'] / d['total_bytes_estimate']) * 100

                progress_callback({
                    'status': 'downloading',
                    'progress': progress,
                    'speed': d.get('_speed_str', ''),
                    'eta': d.get('_eta_str', ''),
                    'filename': d.get('filename', '')
                })

            elif progress_callback and d['status'] == 'finished':
                result['filename'] = d.get('filename', '')
                progress_callback({
                    'status': 'processing',
                    'progress': 100,
                    'filename': d.get('filename', '')
                })

        # Build yt-dlp options
        ydl_opts = {
            'outtmpl': f'{output_dir}/%(title)s.%(ext)s',
            'progress_hooks': [progress_hook],
            'quiet': True,
            'no_warnings': True,
        }

        if mode == 'audio':
            # Audio only extraction
            ydl_opts['format'] = 'bestaudio/best'
            ydl_opts['postprocessors'] = [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': audio_format,
                'preferredquality': '192',
            }]
        else:
            # Video download
            format_spec = self.quality_map.get(quality, self.quality_map['best'])
            ydl_opts['format'] = format_spec
            ydl_opts['merge_output_format'] = video_format

        # Time range extraction
        if start_time or end_time:
            download_ranges = []

            start_seconds = self._time_to_seconds(start_time) if start_time else 0
            end_seconds = self._time_to_seconds(end_time) if end_time else float('inf')

            ydl_opts['download_ranges'] = lambda info_dict, ydl: [
                {'start_time': start_seconds, 'end_time': end_seconds if end_seconds != float('inf') else None}
            ]
            ydl_opts['force_keyframes_at_cuts'] = True

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        return result

    def _time_to_seconds(self, time_str: str) -> float:
        """Convert HH:MM:SS to seconds."""
        if not time_str:
            return 0

        parts = time_str.split(':')
        if len(parts) == 3:
            h, m, s = map(float, parts)
            return h * 3600 + m * 60 + s
        elif len(parts) == 2:
            m, s = map(float, parts)
            return m * 60 + s
        else:
            return float(parts[0])
