#!/usr/bin/env python3
"""
YouTube Helper Backend Server
Flask server with WebSocket support for real-time download progress.
"""

import argparse
import uuid
import threading
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO
from downloader import YouTubeDownloader

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

downloader = YouTubeDownloader()
active_downloads = {}


def emit_progress(download_id: str, data: dict):
    """Emit progress update via WebSocket."""
    data['downloadId'] = download_id
    socketio.emit('progress', data, namespace='/ws/progress')


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

    def progress_callback(data):
        emit_progress(download_id, data)

    def download_thread():
        try:
            active_downloads[download_id] = {'status': 'downloading', 'cancel': False}

            emit_progress(download_id, {
                'status': 'downloading',
                'progress': 0,
                'speed': None,
                'eta': None
            })

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
                emit_progress(download_id, {
                    'status': 'cancelled',
                    'progress': 0
                })
            else:
                emit_progress(download_id, {
                    'status': 'complete',
                    'progress': 100,
                    'filename': result.get('filename')
                })
        except Exception as e:
            emit_progress(download_id, {
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


@socketio.on('connect', namespace='/ws/progress')
def handle_connect():
    """Handle WebSocket connection."""
    print('Client connected')


@socketio.on('disconnect', namespace='/ws/progress')
def handle_disconnect():
    """Handle WebSocket disconnection."""
    print('Client disconnected')


def main():
    parser = argparse.ArgumentParser(description='YouTube Helper Backend Server')
    parser.add_argument('--port', type=int, default=5000, help='Port to run the server on')
    args = parser.parse_args()

    print(f'Starting server on port {args.port}')
    socketio.run(app, host='127.0.0.1', port=args.port, debug=False)


if __name__ == '__main__':
    main()
