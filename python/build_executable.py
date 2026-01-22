#!/usr/bin/env python3
"""
Build script for creating a standalone executable of the YouTube Helper backend.
Uses PyInstaller to bundle Python, yt-dlp, and all dependencies.
"""

import PyInstaller.__main__
import os
import sys

def build():
    """Build the executable."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    server_script = os.path.join(script_dir, 'server.py')

    PyInstaller.__main__.run([
        server_script,
        '--onefile',
        '--name=yt-helper-backend',
        '--distpath=' + os.path.join(script_dir, 'dist'),
        '--workpath=' + os.path.join(script_dir, 'build'),
        '--specpath=' + script_dir,
        '--hidden-import=yt_dlp',
        '--hidden-import=flask',
        '--hidden-import=flask_socketio',
        '--hidden-import=flask_cors',
        '--hidden-import=engineio.async_drivers.eventlet',
        '--hidden-import=eventlet.hubs.epolls',
        '--hidden-import=eventlet.hubs.kqueue',
        '--hidden-import=eventlet.hubs.selects',
        '--hidden-import=dns.rdtypes.*',
        '--hidden-import=dns.dnssecalgs.*',
        '--collect-all=yt_dlp',
        '--noconfirm',
        '--clean',
    ])

    print('Build complete! Executable is in python/dist/')

if __name__ == '__main__':
    build()
