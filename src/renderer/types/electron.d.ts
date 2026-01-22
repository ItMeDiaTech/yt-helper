import type { ElectronAPI, BackendStatus, UpdateStatus } from '../../preload/index'

declare global {
  interface Window {
    electron: ElectronAPI & {
      onBackendStatus: (callback: (status: BackendStatus) => void) => () => void
      onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void
      checkForUpdates: () => Promise<void>
      installUpdate: () => Promise<void>
      getCurrentVersion: () => Promise<string>
    }
  }
}

export {}
