import { create } from 'zustand'
import { VideoInfo, DownloadProgress, DownloadOptions } from '../../shared/types'

interface DownloadState {
  url: string
  videoInfo: VideoInfo | null
  isLoadingInfo: boolean
  infoError: string | null

  mode: 'video' | 'audio'
  videoFormat: string
  audioFormat: string
  quality: string
  startTime: string
  endTime: string

  currentDownload: DownloadProgress | null
  downloadHistory: DownloadProgress[]

  setUrl: (url: string) => void
  setVideoInfo: (info: VideoInfo | null) => void
  setLoadingInfo: (loading: boolean) => void
  setInfoError: (error: string | null) => void

  setMode: (mode: 'video' | 'audio') => void
  setVideoFormat: (format: string) => void
  setAudioFormat: (format: string) => void
  setQuality: (quality: string) => void
  setStartTime: (time: string) => void
  setEndTime: (time: string) => void

  setCurrentDownload: (download: DownloadProgress | null) => void
  addToHistory: (download: DownloadProgress) => void
  clearHistory: () => void

  reset: () => void
}

const initialState = {
  url: '',
  videoInfo: null,
  isLoadingInfo: false,
  infoError: null,
  mode: 'video' as const,
  videoFormat: 'mp4',
  audioFormat: 'mp3',
  quality: 'best',
  startTime: '',
  endTime: '',
  currentDownload: null,
  downloadHistory: []
}

export const useDownloadStore = create<DownloadState>((set) => ({
  ...initialState,

  setUrl: (url) => set({ url }),
  setVideoInfo: (videoInfo) => set({ videoInfo }),
  setLoadingInfo: (isLoadingInfo) => set({ isLoadingInfo }),
  setInfoError: (infoError) => set({ infoError }),

  setMode: (mode) => set({ mode }),
  setVideoFormat: (videoFormat) => set({ videoFormat }),
  setAudioFormat: (audioFormat) => set({ audioFormat }),
  setQuality: (quality) => set({ quality }),
  setStartTime: (startTime) => set({ startTime }),
  setEndTime: (endTime) => set({ endTime }),

  setCurrentDownload: (currentDownload) => set({ currentDownload }),
  addToHistory: (download) =>
    set((state) => ({
      downloadHistory: [download, ...state.downloadHistory].slice(0, 50)
    })),
  clearHistory: () => set({ downloadHistory: [] }),

  reset: () => set(initialState)
}))
