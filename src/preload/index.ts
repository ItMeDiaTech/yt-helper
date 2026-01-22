import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, DownloadOptions, DownloadProgress, VideoInfo, Settings } from '../shared/types'

export interface BackendStatus {
  ready: boolean
  error?: string
}

export interface UpdateStatus {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  info?: {
    version: string
    releaseDate?: string
    releaseNotes?: string
  }
  progress?: {
    percent: number
    bytesPerSecond: number
    total: number
    transferred: number
  }
  error?: string
}

export type ElectronAPI = typeof electronAPI

const electronAPI = {
  getVideoInfo: (url: string): Promise<VideoInfo> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_VIDEO_INFO, url),

  startDownload: (options: DownloadOptions): Promise<{ downloadId: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.START_DOWNLOAD, options),

  cancelDownload: (downloadId: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.CANCEL_DOWNLOAD, downloadId),

  onDownloadProgress: (callback: (progress: DownloadProgress) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, progress: DownloadProgress) => callback(progress)
    ipcRenderer.on(IPC_CHANNELS.DOWNLOAD_PROGRESS, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.DOWNLOAD_PROGRESS, handler)
  },

  onDownloadComplete: (callback: (result: DownloadProgress) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, result: DownloadProgress) => callback(result)
    ipcRenderer.on(IPC_CHANNELS.DOWNLOAD_COMPLETE, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.DOWNLOAD_COMPLETE, handler)
  },

  onDownloadError: (callback: (error: DownloadProgress) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, error: DownloadProgress) => callback(error)
    ipcRenderer.on(IPC_CHANNELS.DOWNLOAD_ERROR, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.DOWNLOAD_ERROR, handler)
  },

  onBackendStatus: (callback: (status: BackendStatus) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, status: BackendStatus) => callback(status)
    ipcRenderer.on('backend:status', handler)
    return () => ipcRenderer.removeListener('backend:status', handler)
  },

  getSettings: (): Promise<Settings> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS),

  setSetting: (key: string, value: unknown): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.SET_SETTINGS, key, value),

  selectOutputDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.SELECT_OUTPUT_DIR),

  getAppVersion: (): Promise<string> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_APP_VERSION),

  getPythonStatus: (): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.PYTHON_STATUS),

  // Auto-updater methods
  checkForUpdates: (): Promise<void> =>
    ipcRenderer.invoke('update:check'),

  installUpdate: (): Promise<void> =>
    ipcRenderer.invoke('update:install'),

  getCurrentVersion: (): Promise<string> =>
    ipcRenderer.invoke('update:get-current-version'),

  onUpdateStatus: (callback: (status: UpdateStatus) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, status: UpdateStatus) => callback(status)
    ipcRenderer.on('update:status', handler)
    return () => ipcRenderer.removeListener('update:status', handler)
  }
}

contextBridge.exposeInMainWorld('electron', electronAPI)
