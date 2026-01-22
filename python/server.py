#!/usr/bin/env python3
"""
YouTube Helper Backend Server
Flask server with HTTP polling for download progress.
"""

import argparse
import uuid
import threading
import sys
import os
import subprocess
from flask import Flask, request, jsonify
from flask_cors import CORS
from downloader import YouTubeDownloader

app = Flask(__name__)
CORS(app)

downloader = YouTubeDownloader()
active_downloads = {}
download_progress = {}


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({'status': 'ok'})


@app.route('/api/video/info', methods=['POST'])
def get_video_info():
    """Fetch video metadata."""
    data = request.get_json()
    url = data.get('url')

    if not url:
        return jsonify({'error': 'URL is required'}), 400

    try:
        info = downloader.get_video_info(url)
        return jsonify(info)
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/download/start', methods=['POST'])
def start_download():
    """Start a download."""
    data = request.get_json()

    url = data.get('url')
    output_dir = data.get('outputDir')
    mode = data.get('mode', 'video')
    video_format = data.get('videoFormat', 'mp4')
    audio_format = data.get('audioFormat', 'mp3')
    quality = data.get('quality', 'best')
    start_time = data.get('startTime')
    end_time = data.get('endTime')

    if not url or not output_dir:
        return jsonify({'error': 'URL and outputDir are required'}), 400

    download_id = str(uuid.uuid4())

    # Initialize progress tracking
    download_progress[download_id] = {
        'downloadId': download_id,
        'status': 'downloading',
        'progress': 0,
        'speed': None,
        'eta': None,
        'filename': None,
        'error': None
    }

    def progress_callback(data):
        """Update progress in the shared dict."""
        download_progress[download_id].update(data)
        download_progress[download_id]['downloadId'] = download_id

    def download_thread():
        try:
            active_downloads[download_id] = {'status': 'downloading', 'cancel': False}

            result = downloader.download(
                url=url,
                output_dir=output_dir,
                mode=mode,
                video_format=video_format,
                audio_format=audio_format,
                quality=quality,
                start_time=start_time,
                end_time=end_time,
                progress_callback=progress_callback,
                cancel_check=lambda: active_downloads.get(download_id, {}).get('cancel', False)
            )

            if active_downloads.get(download_id, {}).get('cancel'):
                download_progress[download_id].update({
                    'status': 'cancelled',
                    'progress': 0
                })
            else:
                download_progress[download_id].update({
                    'status': 'complete',
                    'progress': 100,
                    'filename': result.get('filename')
                })
        except Exception as e:
            download_progress[download_id].update({
                'status': 'error',
                'progress': 0,
                'error': str(e)
            })
        finally:
            if download_id in active_downloads:
                del active_downloads[download_id]

    thread = threading.Thread(target=download_thread)
    thread.daemon = True
    thread.start()

    return jsonify({'downloadId': download_id})


@app.route('/api/download/progress', methods=['GET'])
def get_download_progress():
    """Get progress for all active downloads."""
    return jsonify(list(download_progress.values()))


@app.route('/api/download/progress/<download_id>', methods=['GET'])
def get_single_download_progress(download_id):
    """Get progress for a specific download."""
    if download_id in download_progress:
        return jsonify(download_progress[download_id])
    return jsonify({'error': 'Download not found'}), 404


@app.route('/api/download/cancel', methods=['POST'])
def cancel_download():
    """Cancel an active download."""
    data = request.get_json()
    download_id = data.get('downloadId')

    if not download_id:
        return jsonify({'error': 'downloadId is required'}), 400

    if download_id in active_downloads:
        active_downloads[download_id]['cancel'] = True
        return jsonify({'status': 'cancelling'})

    return jsonify({'error': 'Download not found'}), 404


@app.route('/api/download/clear/<download_id>', methods=['DELETE'])
def clear_download(download_id):
    """Clear a completed download from progress tracking."""
    if download_id in download_progress:
        del download_progress[download_id]
        return jsonify({'status': 'cleared'})
    return jsonify({'error': 'Download not found'}), 404


def setup_ffmpeg_path():
    """Set up ffmpeg path for bundled executable."""
    if getattr(sys, 'frozen', False):
        # Running as bundled executable
        bundle_dir = os.path.dirname(sys.executable)
        # Check multiple possible locations for ffmpeg
        possible_paths = [
            os.path.join(bundle_dir, 'ffmpeg'),  # Same level as exe
            os.path.join(bundle_dir, '..', 'ffmpeg'),  # Parent directory
            os.path.join(bundle_dir, '..', '..', 'ffmpeg'),  # resources/ffmpeg
        ]

        for ffmpeg_dir in possible_paths:
            ffmpeg_exe = os.path.join(ffmpeg_dir, 'ffmpeg.exe')
            if os.path.exists(ffmpeg_exe):
                # Add to PATH
                os.environ['PATH'] = ffmpeg_dir + os.pathsep + os.environ.get('PATH', '')
                print(f'FFmpeg found at: {ffmpeg_dir}')
                return True

        print('Warning: FFmpeg not found in expected locations')
        return False
    return True


def print_diagnostics():
    """Print startup diagnostics for debugging."""
    print('=' * 50)
    print('YouTube Helper Backend - Startup Diagnostics')
    print('=' * 50)
    print(f'Python version: {sys.version}')
    print(f'Executable: {sys.executable}')
    print(f'Working directory: {os.getcwd()}')
    print(f'Frozen (bundled): {getattr(sys, "frozen", False)}')

    # Check ffmpeg
    try:
        result = subprocess.run(
            ['ffmpeg', '-version'],
            capture_output=True,
            text=True,
            timeout=5
        )
        ffmpeg_version = result.stdout.split('\n')[0] if result.returncode == 0 else 'Error'
        print(f'FFmpeg: {ffmpeg_version}')
    except FileNotFoundError:
        print('FFmpeg: NOT FOUND (downloads may fail)')
    except Exception as e:
        print(f'FFmpeg: Error checking - {e}')

    # Check yt-dlp
    try:
        import yt_dlp
        print(f'yt-dlp version: {yt_dlp.version.__version__}')
    except Exception as e:
        print(f'yt-dlp: Error - {e}')

    print('=' * 50)


def main():
    parser = argparse.ArgumentParser(description='YouTube Helper Backend Server')
    parser.add_argument('--port', type=int, default=5000, help='Port to run the server on')
    args = parser.parse_args()

    # Setup ffmpeg for bundled mode
    setup_ffmpeg_path()

    # Print diagnostics
    print_diagnostics()

    print(f'Starting server on port {args.port}')
    # Use plain Flask server - simple and reliable
    app.run(host='127.0.0.1', port=args.port, debug=False, threaded=True)


if __name__ == '__main__':
    main()
