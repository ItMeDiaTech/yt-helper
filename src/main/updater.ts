import electronUpdater from 'electron-updater'
import type { UpdateCheckResult, UpdateInfo, ProgressInfo } from 'electron-updater'

const { autoUpdater } = electronUpdater
import { BrowserWindow, ipcMain } from 'electron'
import log from 'electron-log'

export interface UpdateStatus {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  info?: UpdateInfo
  progress?: ProgressInfo
  error?: string
}

let mainWindow: BrowserWindow | null = null

function sendUpdateStatus(status: UpdateStatus): void {
  mainWindow?.webContents.send('update:status', status)
}

export function setupAutoUpdater(window: BrowserWindow): void {
  mainWindow = window

  // Configure auto-updater
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = log

  // Event handlers
  autoUpdater.on('checking-for-update', () => {
    log.info('Checking for updates...')
    sendUpdateStatus({ status: 'checking' })
  })

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    log.info('Update available:', info.version)
    sendUpdateStatus({ status: 'available', info })
  })

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    log.info('No updates available')
    sendUpdateStatus({ status: 'not-available', info })
  })

  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    log.info(`Download progress: ${progress.percent.toFixed(1)}%`)
    sendUpdateStatus({ status: 'downloading', progress })
  })

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    log.info('Update downloaded:', info.version)
    sendUpdateStatus({ status: 'downloaded', info })
  })

  autoUpdater.on('error', (error: Error) => {
    log.error('Auto-updater error:', error)
    sendUpdateStatus({ status: 'error', error: error.message })
  })

  // IPC handlers
  ipcMain.handle('update:check', async () => {
    try {
      const result = await autoUpdater.checkForUpdates()
      return result
    } catch (error) {
      log.error('Failed to check for updates:', error)
      throw error
    }
  })

  ipcMain.handle('update:install', () => {
    log.info('Installing update and restarting...')
    autoUpdater.quitAndInstall(false, true)
  })

  ipcMain.handle('update:get-current-version', () => {
    return autoUpdater.currentVersion.version
  })
}

export function checkForUpdates(): Promise<UpdateCheckResult | null> {
  return autoUpdater.checkForUpdates()
}
