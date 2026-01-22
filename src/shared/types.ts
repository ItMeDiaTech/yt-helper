export interface VideoInfo {
  id: string
  title: string
  description: string
  thumbnail: string
  duration: number
  channel: string
  uploadDate: string
  viewCount: number
  availableQualities: string[]
  availableVideoFormats: string[]
  availableAudioFormats: string[]
}

export interface DownloadOptions {
  url: string
  outputDir: string
  mode: 'video' | 'audio'
  videoFormat?: string
  audioFormat?: string
  quality?: string
  startTime?: string
  endTime?: string
}

export interface DownloadProgress {
  downloadId: string
  status: 'pending' | 'downloading' | 'processing' | 'complete' | 'error' | 'cancelled'
  progress: number
  speed?: string
  eta?: string
  filename?: string
  error?: string
}

export interface Settings {
  outputDirectory: string
  defaultVideoFormat: string
  defaultAudioFormat: string
  defaultQuality: string
}

export const IPC_CHANNELS = {
  GET_VIDEO_INFO: 'video:get-info',
  START_DOWNLOAD: 'download:start',
  CANCEL_DOWNLOAD: 'download:cancel',
  DOWNLOAD_PROGRESS: 'download:progress',
  DOWNLOAD_COMPLETE: 'download:complete',
  DOWNLOAD_ERROR: 'download:error',
  GET_SETTINGS: 'settings:get',
  SET_SETTINGS: 'settings:set',
  SELECT_OUTPUT_DIR: 'dialog:select-output-dir',
  GET_APP_VERSION: 'app:version',
  PYTHON_STATUS: 'python:status'
} as const

export const VIDEO_FORMATS = ['mp4', 'webm', 'mkv'] as const
export const AUDIO_FORMATS = ['mp3', 'm4a', 'ogg', 'wav', 'flac'] as const
export const QUALITY_OPTIONS = ['best', '2160p', '1440p', '1080p', '720p', '480p', '360p'] as const

export type VideoFormat = typeof VIDEO_FORMATS[number]
export type AudioFormat = typeof AUDIO_FORMATS[number]
export type Quality = typeof QUALITY_OPTIONS[number]
