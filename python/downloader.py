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

        # H264+AAC preferring format specs with fallback chain:
        # 1. H264 video + AAC audio  2. H264 video + any audio  3. any codecs
        self.h264_quality_map = {
            'best': 'bestvideo[vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[vcodec^=avc1]+bestaudio/bestvideo+bestaudio/best',
            '2160p': 'bestvideo[height<=2160][vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[height<=2160][vcodec^=avc1]+bestaudio/bestvideo[height<=2160]+bestaudio/best[height<=2160]',
            '1440p': 'bestvideo[height<=1440][vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[height<=1440][vcodec^=avc1]+bestaudio/bestvideo[height<=1440]+bestaudio/best[height<=1440]',
            '1080p': 'bestvideo[height<=1080][vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[height<=1080][vcodec^=avc1]+bestaudio/bestvideo[height<=1080]+bestaudio/best[height<=1080]',
            '720p': 'bestvideo[height<=720][vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[height<=720][vcodec^=avc1]+bestaudio/bestvideo[height<=720]+bestaudio/best[height<=720]',
            '480p': 'bestvideo[height<=480][vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[height<=480][vcodec^=avc1]+bestaudio/bestvideo[height<=480]+bestaudio/best[height<=480]',
            '360p': 'bestvideo[height<=360][vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[height<=360][vcodec^=avc1]+bestaudio/bestvideo[height<=360]+bestaudio/best[height<=360]',
        }

    def validate_url(self, url: str) -> bool:
        """Validate if URL is a valid YouTube URL."""
        patterns = [
            r'^(https?://)?(www\.)?youtube\.com/watch\?v=[\w-]+(&[\w=%+-]*)*$',
            r'^(https?://)?(www\.)?youtu\.be/[\w-]+(\?[\w=&+-]*)?$',
            r'^(https?://)?(www\.)?youtube\.com/shorts/[\w-]+(\?[\w=&+-]*)?$',
        ]
        return any(re.match(pattern, url) for pattern in patterns)

    def get_video_info(self, url: str) -> Dict[str, Any]:
        """Fetch video metadata without downloading."""
        if not self.validate_url(url):
            raise ValueError('Invalid YouTube URL')

        ydl_opts = {
            'quiet': True,
            'no_warnings': False,
            'extract_flat': False,
            'socket_timeout': 30,
            'retries': 3,
            'cachedir': False,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)

            if info is None:
                raise ValueError(
                    'Could not retrieve video information. '
                    'The video may be private, deleted, age-restricted, or geo-blocked.'
                )

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
        convert_to_h264: bool = False,
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
        import os
        ydl_opts = {
            'outtmpl': f'{output_dir}/%(title)s.%(ext)s',
            'progress_hooks': [progress_hook],
            'quiet': True,
            'no_warnings': True,
            'socket_timeout': 30,
            'retries': 3,
            'restrictfilenames': True,
            'cachedir': False,
        }

        # Capture the final filename after all postprocessors run
        def postprocessor_hook(d):
            if d['status'] == 'finished':
                filepath = d.get('info_dict', {}).get('filepath', '')
                if filepath:
                    result['filename'] = filepath

        ydl_opts['postprocessor_hooks'] = [postprocessor_hook]

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
            if convert_to_h264:
                qmap = self.h264_quality_map
            else:
                qmap = self.quality_map
            format_spec = qmap.get(quality, qmap['best'])
            ydl_opts['format'] = format_spec
            ydl_opts['merge_output_format'] = video_format
            # Ensure output is always in the requested container format,
            # even when no merge occurs (single-stream fallback)
            ydl_opts['postprocessors'] = [{
                'key': 'FFmpegVideoRemuxer',
                'preferedformat': video_format,
            }]

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        # If postprocessor_hook didn't fire, try to find the output file
        if not result.get('filename') or not os.path.exists(result.get('filename', '')):
            # Scan output directory for the most recently created file with the expected extension
            expected_ext = audio_format if mode == 'audio' else video_format
            try:
                candidates = [
                    os.path.join(output_dir, f)
                    for f in os.listdir(output_dir)
                    if f.endswith(f'.{expected_ext}')
                ]
                if candidates:
                    # Pick the most recently modified file
                    best = max(candidates, key=os.path.getmtime)
                    result['filename'] = best
            except Exception:
                pass  # Best-effort fallback; download itself succeeded

        # Trim if time range specified
        if (start_time or end_time) and result.get('filename'):
            try:
                result['filename'] = self._trim_file(
                    result['filename'],
                    start_time,
                    end_time,
                    progress_callback
                )
            except Exception as e:
                raise ValueError(f'Failed to trim video: {str(e)}')

        # Convert to H264/AAC if requested
        if convert_to_h264 and mode == 'video' and result.get('filename'):
            try:
                result['filename'] = self._check_and_convert_codecs(
                    result['filename'],
                    progress_callback
                )
            except Exception as e:
                raise ValueError(f'Failed to convert to H264/AAC: {str(e)}')

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

    def _validate_time_input(self, time_str: str) -> bool:
        """Validate time string format for safe use with FFmpeg."""
        if not time_str:
            return True
        pattern = r'^\d{1,2}(:\d{2}){0,2}(\.\d+)?$'
        if not re.match(pattern, time_str):
            return False
        parts = time_str.split(':')
        try:
            values = [float(p) for p in parts]
            if any(v < 0 for v in values):
                return False
            if len(parts) >= 2 and values[-1] >= 60:
                return False
            if len(parts) == 3 and values[1] >= 60:
                return False
        except ValueError:
            return False
        return True

    def _trim_file(
        self,
        filepath: str,
        start_time: Optional[str],
        end_time: Optional[str],
        progress_callback: Optional[Callable[[Dict], None]] = None
    ) -> str:
        """Trim media file using FFmpeg."""
        import subprocess
        import os

        # Validate time inputs server-side before passing to FFmpeg
        if start_time and not self._validate_time_input(start_time):
            raise ValueError(f'Invalid start time format: {start_time}')
        if end_time and not self._validate_time_input(end_time):
            raise ValueError(f'Invalid end time format: {end_time}')

        if not os.path.exists(filepath):
            # Try to find the actual output file (yt-dlp may have changed extension)
            base_path = os.path.splitext(filepath)[0]
            for ext in ['.mp4', '.webm', '.mkv', '.mp3', '.m4a', '.ogg', '.wav', '.flac']:
                candidate = base_path + ext
                if os.path.exists(candidate):
                    filepath = candidate
                    break
            else:
                raise FileNotFoundError(f'Downloaded file not found: {filepath}')

        if progress_callback:
            progress_callback({
                'status': 'processing',
                'progress': 95,
                'filename': filepath,
                'message': 'Trimming to selected time range...'
            })

        # Build ffmpeg command
        # Place -ss before -i for fast input seeking, use -t (duration) instead of -to
        temp_output = filepath + '.trimmed.tmp'
        cmd = ['ffmpeg', '-y']

        if start_time:
            cmd.extend(['-ss', start_time])

        cmd.extend(['-i', filepath])

        if end_time:
            if start_time:
                # Calculate duration from start to end
                duration = self._time_to_seconds(end_time) - self._time_to_seconds(start_time)
                if duration > 0:
                    cmd.extend(['-t', str(duration)])
            else:
                cmd.extend(['-to', end_time])

        # Use copy mode for fast trimming (no re-encoding)
        cmd.extend(['-c', 'copy', temp_output])

        try:
            subprocess.run(cmd, check=True, capture_output=True)

            # Replace original with trimmed
            os.remove(filepath)
            os.rename(temp_output, filepath)

            return filepath
        except subprocess.CalledProcessError as e:
            # Clean up temp file if it exists
            if os.path.exists(temp_output):
                os.remove(temp_output)
            stderr = e.stderr.decode() if e.stderr else 'Unknown error'
            raise RuntimeError(f'FFmpeg trimming failed: {stderr}')

    def _check_and_convert_codecs(
        self,
        filepath: str,
        progress_callback: Optional[Callable[[Dict], None]] = None
    ) -> str:
        """Check codecs via ffprobe and re-encode to H264/AAC if needed."""
        import subprocess
        import os
        import json

        if not os.path.exists(filepath):
            raise FileNotFoundError(f'File not found for codec check: {filepath}')

        # Probe codecs
        probe_cmd = [
            'ffprobe', '-v', 'quiet', '-print_format', 'json',
            '-show_streams', filepath
        ]
        probe_result = subprocess.run(probe_cmd, capture_output=True, text=True)
        if probe_result.returncode != 0:
            raise RuntimeError(f'ffprobe failed: {probe_result.stderr}')

        streams = json.loads(probe_result.stdout).get('streams', [])

        video_codec = None
        audio_codec = None
        for stream in streams:
            if stream.get('codec_type') == 'video' and video_codec is None:
                video_codec = stream.get('codec_name', '')
            elif stream.get('codec_type') == 'audio' and audio_codec is None:
                audio_codec = stream.get('codec_name', '')

        video_is_h264 = video_codec in ('h264', 'avc1')
        audio_is_aac = audio_codec == 'aac'

        if video_is_h264 and audio_is_aac:
            return filepath

        if progress_callback:
            parts = []
            if not video_is_h264:
                parts.append(f'video {video_codec} \u2192 H264')
            if not audio_is_aac:
                parts.append(f'audio {audio_codec} \u2192 AAC')
            progress_callback({
                'status': 'converting',
                'progress': 0,
                'message': f'Converting: {", ".join(parts)}...'
            })

        # Build ffmpeg command — only re-encode streams that need it
        ext = os.path.splitext(filepath)[1]
        temp_output = filepath.rsplit('.', 1)[0] + '.h264convert' + ext

        cmd = ['ffmpeg', '-y', '-i', filepath]
        cmd.extend(['-c:v', 'copy' if video_is_h264 else 'libx264'])
        cmd.extend(['-c:a', 'copy' if audio_is_aac else 'aac'])

        if not video_is_h264:
            cmd.extend(['-preset', 'medium', '-crf', '23'])
        if not audio_is_aac:
            cmd.extend(['-b:a', '192k'])

        cmd.append(temp_output)

        try:
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            _, stderr = process.communicate()

            if process.returncode != 0:
                error_msg = stderr.decode() if stderr else 'Unknown error'
                raise RuntimeError(f'FFmpeg conversion failed: {error_msg}')

            # Replace original with converted
            os.remove(filepath)
            os.rename(temp_output, filepath)

            if progress_callback:
                progress_callback({
                    'status': 'converting',
                    'progress': 100,
                    'message': 'Conversion complete'
                })

            return filepath
        except Exception:
            if os.path.exists(temp_output):
                os.remove(temp_output)
            raise
