#!/usr/bin/env python3
"""
Build script for creating a standalone executable of the YouTube Helper backend.
Uses PyInstaller to bundle Python, yt-dlp, and all dependencies.
"""

import PyInstaller.__main__
import os
import sys
import shutil

def build():
    """Build the executable."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    server_script = os.path.join(script_dir, 'server.py')
    dist_path = os.path.join(script_dir, 'dist')
    build_path = os.path.join(script_dir, 'build')

    # Clean previous builds
    if os.path.exists(dist_path):
        shutil.rmtree(dist_path)
    if os.path.exists(build_path):
        shutil.rmtree(build_path)

    print('Building YouTube Helper Backend...')
    print(f'Script: {server_script}')
    print(f'Output: {dist_path}')

    PyInstaller.__main__.run([
        server_script,
        '--onefile',
        '--name=yt-helper-backend',
        f'--distpath={dist_path}',
        f'--workpath={build_path}',
        f'--specpath={script_dir}',
        # Core dependencies
        '--hidden-import=yt_dlp',
        '--hidden-import=flask',
        '--hidden-import=flask_socketio',
        '--hidden-import=flask_cors',
        '--hidden-import=werkzeug',
        '--hidden-import=engineio',
        '--hidden-import=socketio',
        '--hidden-import=simple_websocket',
        '--hidden-import=wsproto',
        # DNS and network imports for yt-dlp
        '--hidden-import=dns.rdtypes.*',
        '--hidden-import=dns.dnssecalgs.*',
        # Collect all yt-dlp resources
        '--collect-all=yt_dlp',
        '--noconfirm',
        '--clean',
        # Console mode for debugging (can see errors)
        '--console',
    ])

    # Verify build
    exe_path = os.path.join(dist_path, 'yt-helper-backend.exe' if sys.platform == 'win32' else 'yt-helper-backend')

    if os.path.exists(exe_path):
        size_mb = os.path.getsize(exe_path) / (1024 * 1024)
        print(f'\nBuild complete!')
        print(f'Executable: {exe_path}')
        print(f'Size: {size_mb:.1f} MB')
    else:
        print('\nBuild failed - executable not found!')
        sys.exit(1)


if __name__ == '__main__':
    build()
