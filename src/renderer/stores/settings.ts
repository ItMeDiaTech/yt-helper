import { create } from 'zustand'
import { Settings } from '../../shared/types'

interface SettingsState extends Settings {
  isLoading: boolean
  loadSettings: () => Promise<void>
  setOutputDirectory: (dir: string) => Promise<void>
  setDefaultVideoFormat: (format: string) => Promise<void>
  setDefaultAudioFormat: (format: string) => Promise<void>
  setDefaultQuality: (quality: string) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set) => ({
  outputDirectory: '',
  defaultVideoFormat: 'mp4',
  defaultAudioFormat: 'mp3',
  defaultQuality: 'best',
  isLoading: true,

  loadSettings: async () => {
    try {
      const settings = await window.electron.getSettings()
      set({ ...settings, isLoading: false })
    } catch (error) {
      console.error('Failed to load settings:', error)
      set({ isLoading: false })
    }
  },

  setOutputDirectory: async (dir) => {
    await window.electron.setSetting('outputDirectory', dir)
    set({ outputDirectory: dir })
  },

  setDefaultVideoFormat: async (format) => {
    await window.electron.setSetting('defaultVideoFormat', format)
    set({ defaultVideoFormat: format })
  },

  setDefaultAudioFormat: async (format) => {
    await window.electron.setSetting('defaultAudioFormat', format)
    set({ defaultAudioFormat: format })
  },

  setDefaultQuality: async (quality) => {
    await window.electron.setSetting('defaultQuality', quality)
    set({ defaultQuality: quality })
  }
}))
